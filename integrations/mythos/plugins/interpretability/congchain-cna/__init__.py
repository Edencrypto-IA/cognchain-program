"""CognChain CNA Interpretability Plugin para Mythos Agent.

Implementa Contrastive Neuron Attribution (CNA) baseado no paper:
"Targeted Neuron Modulation via Contrastive Pair Search"
Herring, Naviasky, Malhotra — Nous Research, 2026
arXiv:2605.12290

O que este plugin faz:
----------------------
Durante cada sessão do Mythos com um modelo local, o plugin:
1. Coleta os prompts reais da conversa (turnos user/assistant)
2. Ao final da sessão, roda o algoritmo CNA sobre esses prompts
3. Identifica os top 0.1% de neurônios MLP com maior diferença de ativação
4. Serializa o fingerprint: { layer, neuron_idx, mean_delta, rank }
5. Ancora esse fingerprint na CognChain como memória de interpretabilidade

O resultado é um log verificável do estado interno do modelo
durante aquela sessão — o primeiro agente do mundo com interpretabilidade
auditável por hash CongChain.

Modos de operação:
------------------
MODO COMPLETO (CNA_MODEL_PATH definido):
  - Carrega o modelo local via transformers
  - Registra hooks nos MLP layers durante forward pass
  - Calcula fingerprint real de neurônios

MODO PASSIVO (sem CNA_MODEL_PATH):
  - Ancora apenas metadados da sessão (modelo, plataforma, contagem de turnos)
  - Útil para rastrear sessões sem acesso aos pesos

Variáveis de ambiente:
----------------------
  CNA_MODEL_PATH      — caminho local do modelo (ex: /models/Llama-3.2-3B-Instruct)
                        ou HuggingFace ID (ex: NousResearch/Hermes-3-Llama-3.1-8B)
  CNA_TOP_K_FRACTION  — fração de neurônios a selecionar (padrão: 0.001 = 0.1%)
  CNA_MIN_PROMPTS     — mínimo de pares para rodar CNA (padrão: 4)
  CNA_ANCHOR_FINGERPRINT — "true" para ancorar (padrão: true)
  CNA_DEVICE          — dispositivo PyTorch (padrão: "cuda" se disponível, else "cpu")

Filosofia de falha:
-------------------
Todos os hooks são silenciosos. Erros são logados como WARNING.
Nunca bloqueia a sessão. O CNA roda em thread separada após a sessão.
Se torch/transformers não estiverem instalados, opera em modo passivo.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constantes e config
# ---------------------------------------------------------------------------
_API_URL_ENV = "CONGCHAIN_API_URL"
_API_KEY_ENV = "CONGCHAIN_API_KEY"
_AGENT_ID_ENV = "CONGCHAIN_AGENT_ID"
_DEFAULT_API_URL = "https://cognchain-program-production.up.railway.app"
_DEFAULT_AGENT_ID = "mythos-local"
_HTTP_TIMEOUT = 12
_RETRY_WAIT = 2

# Defaults do CNA (baseados no paper)
_DEFAULT_TOP_K_FRACTION = 0.001   # 0.1% dos neurônios MLP
_DEFAULT_MIN_PROMPTS = 4          # mínimo de prompts para CNA ser confiável
_DEFAULT_DEVICE = "cpu"

# Máximo de pares de prompt para CNA (evitar OOM em modelos grandes)
_MAX_PROMPT_PAIRS = 20

# ---------------------------------------------------------------------------
# Estado de sessão
# ---------------------------------------------------------------------------

@dataclass
class _SessionState:
    session_id: str
    model_name: str = ""
    platform: str = ""
    started_at: float = field(default_factory=time.time)
    user_prompts: List[str] = field(default_factory=list)   # positivo: prompts reais
    benign_prompts: List[str] = field(default_factory=list) # negativo: prompts neutros
    llm_turns: int = 0
    cna_fingerprint: Optional[Dict] = None
    anchored: bool = False


_SESSIONS: Dict[str, _SessionState] = {}
_SESSIONS_LOCK = threading.Lock()

# Prompts benignos padrão (classe negativa para contraste)
# Baseados no Appendix A.2 do paper CNA
_DEFAULT_BENIGN_PROMPTS = [
    "What is the capital of France?",
    "Can you explain how photosynthesis works?",
    "Write a short poem about the ocean.",
    "What are the main differences between Python and JavaScript?",
    "How do I make a simple pasta dish?",
    "Explain quantum entanglement in simple terms.",
    "What is the history of the Roman Empire?",
    "Help me write a professional email to my manager.",
    "What are some good books to read this year?",
    "How does machine learning work?",
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _api_url() -> str:
    return _env(_API_URL_ENV) or _DEFAULT_API_URL


def _api_key() -> str:
    return _env(_API_KEY_ENV)


def _agent_id() -> str:
    return _env(_AGENT_ID_ENV, _DEFAULT_AGENT_ID) or _DEFAULT_AGENT_ID


def _is_configured() -> bool:
    return bool(_api_key())


def _headers(user_agent: str) -> dict:
    headers = {"Content-Type": "application/json", "User-Agent": user_agent}
    key = _api_key()
    if key:
        headers["Authorization"] = f"Bearer {key}"
    return headers


def _top_k_fraction() -> float:
    try:
        return float(_env("CNA_TOP_K_FRACTION", str(_DEFAULT_TOP_K_FRACTION)))
    except ValueError:
        return _DEFAULT_TOP_K_FRACTION


def _min_prompts() -> int:
    try:
        return int(_env("CNA_MIN_PROMPTS", str(_DEFAULT_MIN_PROMPTS)))
    except ValueError:
        return _DEFAULT_MIN_PROMPTS


def _should_anchor() -> bool:
    return _env("CNA_ANCHOR_FINGERPRINT", "true").lower() not in ("false", "0", "no")


def _device() -> str:
    explicit = _env("CNA_DEVICE")
    if explicit:
        return explicit
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return _DEFAULT_DEVICE


def _http_post(path: str, body: dict, *, retries: int = 2) -> Optional[dict]:
    if not _is_configured():
        return None
    url = f"{_api_url().rstrip('/')}{path}"
    payload = json.dumps(body, default=str).encode()
    headers = _headers("mythos-congchain-cna/1.1")
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < retries:
                time.sleep(_RETRY_WAIT)
                continue
            logger.debug("CNA: POST %s HTTP %s", path, exc.code)
            return None
        except Exception as exc:
            logger.debug("CNA: POST %s erro: %s", path, exc)
            return None
    return None

# ---------------------------------------------------------------------------
# CORE CNA — implementação baseada no paper arXiv:2605.12290
# ---------------------------------------------------------------------------

def _extract_text(content: Any) -> str:
    """Extrai texto de conteúdo multimodal."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and item.get("type") in ("text", "input_text"):
                parts.append(item.get("text", ""))
        return " ".join(p for p in parts if p)
    return str(content or "")


class CNAEngine:
    """Implementação do algoritmo CNA baseada no paper Nous Research 2026.

    Seção 3 do paper:
    3.1 Contrastive Discovery — forward pass em pares de prompts
    3.2 Universal Neuron Filtering — top-k por mean contrastive difference
    3.3 Targeted Ablation — verificação causal (opcional)
    """

    def __init__(self, model_path: str, device: str = "cpu",
                 top_k_fraction: float = 0.001):
        self.model_path = model_path
        self.device = device
        self.top_k_fraction = top_k_fraction
        self._model = None
        self._tokenizer = None
        self._hooks: List = []
        self._activations: Dict[str, Any] = {}
        self._loaded = False

    def _load(self) -> bool:
        """Carrega modelo e tokenizer. Retorna False se falhar."""
        if self._loaded:
            return True
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer
            import torch

            logger.info("CNA: carregando modelo %s em %s...", self.model_path, self.device)
            self._tokenizer = AutoTokenizer.from_pretrained(
                self.model_path,
                trust_remote_code=True,
            )
            self._model = AutoModelForCausalLM.from_pretrained(
                self.model_path,
                torch_dtype=torch.float16 if self.device != "cpu" else torch.float32,
                device_map=self.device,
                trust_remote_code=True,
            )
            self._model.eval()
            self._loaded = True
            logger.info("CNA: modelo carregado — %s", self.model_path)
            return True
        except Exception as exc:
            logger.warning("CNA: falha ao carregar modelo: %s", exc)
            return False

    def _register_mlp_hooks(self) -> Dict[str, Any]:
        """Registra hooks nos MLP layers para capturar ativações pós-ativação.

        Implementa Seção 3.1: captura h_l(x) — output do MLP na camada l
        para o último token (posição -1).
        """
        import torch
        activations = {}

        def _make_hook(layer_name: str):
            def _hook(module, input, output):
                # Captura ativação do último token, post-activation
                # Conforme paper: "post-activation hidden units"
                if isinstance(output, tuple):
                    act = output[0]
                else:
                    act = output
                # Shape: [batch, seq_len, hidden] → pegar último token
                activations[layer_name] = act[:, -1, :].detach().cpu()
            return _hook

        self._hooks = []
        # Detectar arquitetura do modelo (Llama, Qwen, Mistral, etc)
        for name, module in self._model.named_modules():
            # MLP layers em Llama: model.layers.N.mlp
            # MLP layers em Qwen: model.layers.N.mlp
            # Gate projection ou down projection dependendo da arquitetura
            if any(pattern in name for pattern in [
                ".mlp.down_proj", ".mlp.c_proj",    # Llama/Mistral
                ".mlp.dense_4h_to_h",               # GPT-NeoX
                ".ff_out", ".ffn.fc2",               # outros
            ]):
                h = module.register_forward_hook(_make_hook(name))
                self._hooks.append(h)

        # Fallback: capturar qualquer módulo Linear com "mlp" no nome
        if not self._hooks:
            for name, module in self._model.named_modules():
                if "mlp" in name.lower() and hasattr(module, "weight"):
                    if "down" in name.lower() or "out" in name.lower():
                        h = module.register_forward_hook(_make_hook(name))
                        self._hooks.append(h)

        logger.debug("CNA: %d hooks MLP registrados", len(self._hooks))
        return activations

    def _remove_hooks(self) -> None:
        for h in self._hooks:
            h.remove()
        self._hooks = []

    def _forward_single(self, prompt: str, activations: Dict) -> Optional[Dict[str, Any]]:
        """Roda um forward pass e retorna snapshot das ativações MLP."""
        import torch
        try:
            inputs = self._tokenizer(
                prompt,
                return_tensors="pt",
                max_length=512,
                truncation=True,
            ).to(self.device)

            with torch.no_grad():
                self._model(**inputs)

            # Snapshot das ativações atuais (copy)
            return {k: v.clone() for k, v in activations.items()}
        except Exception as exc:
            logger.debug("CNA: forward pass falhou: %s", exc)
            return None

    def run(
        self,
        positive_prompts: List[str],
        negative_prompts: List[str],
    ) -> Optional[Dict[str, Any]]:
        """Executa o algoritmo CNA completo.

        Implementa Seções 3.1 e 3.2 do paper:

        1. Forward pass em todos os prompts (positivos e negativos)
        2. Para cada neurônio n na camada l:
           delta_n = mean(h_l^+(x)) - mean(h_l^-(x))
        3. Selecionar top-k neurônios por |delta_n|
        4. Retornar fingerprint: lista de (layer, neuron_idx, mean_delta)
        """
        import torch

        if not self._load():
            return None

        if not positive_prompts or not negative_prompts:
            logger.warning("CNA: prompts insuficientes para análise")
            return None

        # Limitar número de prompts para evitar OOM
        pos = positive_prompts[:_MAX_PROMPT_PAIRS]
        neg = negative_prompts[:_MAX_PROMPT_PAIRS]

        logger.info(
            "CNA: rodando análise — %d prompts positivos, %d negativos",
            len(pos), len(neg),
        )

        activations_ref = self._register_mlp_hooks()

        # Coletar ativações para cada prompt
        pos_acts: List[Dict] = []
        neg_acts: List[Dict] = []

        for prompt in pos:
            snap = self._forward_single(prompt, activations_ref)
            if snap:
                pos_acts.append(snap)

        activations_ref.clear()  # reset para prompts negativos

        for prompt in neg:
            snap = self._forward_single(prompt, activations_ref)
            if snap:
                neg_acts.append(snap)

        self._remove_hooks()

        if not pos_acts or not neg_acts:
            logger.warning("CNA: ativações insuficientes coletadas")
            return None

        # Calcular diferença contrastiva por neurônio
        # delta_n = mean(activações positivas) - mean(activações negativas)
        fingerprint_neurons = []
        total_neurons = 0

        # Processar por camada
        all_layers = set(pos_acts[0].keys()) & set(neg_acts[0].keys())

        for layer_name in sorted(all_layers):
            # Stack ativações: [n_prompts, hidden_size]
            try:
                pos_stack = torch.stack([a[layer_name] for a in pos_acts
                                         if layer_name in a]).squeeze(1)
                neg_stack = torch.stack([a[layer_name] for a in neg_acts
                                         if layer_name in a]).squeeze(1)

                # Mean contrastive difference (Seção 3.1)
                pos_mean = pos_stack.mean(dim=0)  # [hidden_size]
                neg_mean = neg_stack.mean(dim=0)  # [hidden_size]
                delta = (pos_mean - neg_mean).abs()  # [hidden_size]

                n_neurons = delta.shape[0]
                total_neurons += n_neurons

                # Guardar deltas por neurônio com índice e layer
                for neuron_idx in range(n_neurons):
                    fingerprint_neurons.append({
                        "layer": layer_name,
                        "neuron_idx": neuron_idx,
                        "mean_delta": float(delta[neuron_idx]),
                    })
            except Exception as exc:
                logger.debug("CNA: erro ao processar camada %s: %s", layer_name, exc)
                continue

        if not fingerprint_neurons:
            logger.warning("CNA: nenhum neurônio processado")
            return None

        # Selecionar top-k por |delta| (Seção 3.2 — Universal Neuron Filtering)
        k = max(1, int(total_neurons * self.top_k_fraction))
        fingerprint_neurons.sort(key=lambda x: x["mean_delta"], reverse=True)
        top_neurons = fingerprint_neurons[:k]

        # Adicionar rank
        for rank, neuron in enumerate(top_neurons):
            neuron["rank"] = rank

        # Calcular hash do fingerprint para identificação
        fingerprint_str = json.dumps(
            [(n["layer"], n["neuron_idx"]) for n in top_neurons[:50]],
            sort_keys=True,
        )
        fingerprint_hash = hashlib.sha256(fingerprint_str.encode()).hexdigest()[:32]

        # Estatísticas de camadas
        layer_counts: Dict[str, int] = {}
        for n in top_neurons:
            layer_counts[n["layer"]] = layer_counts.get(n["layer"], 0) + 1

        result = {
            "fingerprint_hash": fingerprint_hash,
            "top_k_fraction": self.top_k_fraction,
            "k_selected": k,
            "total_neurons_analyzed": total_neurons,
            "n_layers": len(all_layers),
            "n_prompts_positive": len(pos_acts),
            "n_prompts_negative": len(neg_acts),
            "top_neurons": top_neurons[:100],   # máximo 100 no payload
            "layer_distribution": layer_counts,
            "max_delta": float(top_neurons[0]["mean_delta"]) if top_neurons else 0.0,
            "mean_delta_top_k": float(
                sum(n["mean_delta"] for n in top_neurons) / len(top_neurons)
            ) if top_neurons else 0.0,
            "model_path": self.model_path,
            "algorithm": "CNA",
            "paper": "arXiv:2605.12290",
        }

        logger.info(
            "CNA: fingerprint calculado — hash=%s k=%d total_neurons=%d",
            fingerprint_hash, k, total_neurons,
        )
        return result


# Cache do engine por model_path (evitar recarregar a cada sessão)
_ENGINE_CACHE: Dict[str, CNAEngine] = {}
_ENGINE_LOCK = threading.Lock()


def _get_engine(model_path: str) -> Optional[CNAEngine]:
    """Retorna (ou cria) um CNAEngine para o model_path dado."""
    with _ENGINE_LOCK:
        if model_path not in _ENGINE_CACHE:
            _ENGINE_CACHE[model_path] = CNAEngine(
                model_path=model_path,
                device=_device(),
                top_k_fraction=_top_k_fraction(),
            )
        return _ENGINE_CACHE[model_path]


# ---------------------------------------------------------------------------
# Ancoragem na CognChain
# ---------------------------------------------------------------------------

def _anchor_fingerprint(state: _SessionState, fingerprint: Dict) -> None:
    """Ancora o fingerprint CNA na CognChain em thread daemon."""

    def _worker():
        # Construir conteúdo legível para a memória
        top_3 = fingerprint.get("top_neurons", [])[:3]
        top_3_str = ", ".join(
            f"{n['layer']}[{n['neuron_idx']}]={n['mean_delta']:.4f}"
            for n in top_3
        )

        content = (
            f"[CNA Interpretability Fingerprint]\n"
            f"Session: {state.session_id}\n"
            f"Model: {state.model_name or fingerprint.get('model_path', '?')}\n"
            f"Platform: {state.platform or '?'}\n"
            f"Algorithm: CNA (arXiv:2605.12290, Nous Research 2026)\n"
            f"Fingerprint Hash: {fingerprint['fingerprint_hash']}\n"
            f"Neurons Analyzed: {fingerprint['total_neurons_analyzed']:,}\n"
            f"Top-K Selected: {fingerprint['k_selected']} "
            f"({fingerprint['top_k_fraction']*100:.1f}%)\n"
            f"Layers: {fingerprint['n_layers']}\n"
            f"Prompts (pos/neg): {fingerprint['n_prompts_positive']}/"
            f"{fingerprint['n_prompts_negative']}\n"
            f"Max Delta: {fingerprint['max_delta']:.6f}\n"
            f"Mean Delta (top-k): {fingerprint['mean_delta_top_k']:.6f}\n"
            f"Top-3 Neurons: {top_3_str}\n"
            f"Layer Distribution: {json.dumps(fingerprint['layer_distribution'])}\n"
        )

        result = _http_post("/api/memory/write", {
            "content": content,
            "model": "mythos",
            "metadata": {
                "source": "mythos",
                "contentType": "mythos_task_result",
                "agentId": _agent_id(),
                "agentName": "Mythos",
                "origin": "mythos-cna-interpretability",
                "type": "cna_fingerprint",
                "session_id": state.session_id,
                "fingerprint_hash": fingerprint["fingerprint_hash"],
                "model_path": fingerprint.get("model_path", ""),
                "algorithm": "CNA",
                "paper": "arXiv:2605.12290",
                "k_selected": fingerprint["k_selected"],
                "total_neurons": fingerprint["total_neurons_analyzed"],
                "top_neurons_preview": fingerprint.get("top_neurons", [])[:10],
                "proofMode": "none",
                "anchorMode": "none",
                "safety": {
                    "containsSecrets": False,
                    "containsPrivateKeys": False,
                    "containsSignedPayloads": False,
                    "canMoveFunds": False,
                    "requiresHumanReview": True,
                },
            },
        })

        if result and result.get("content_hash"):
            logger.info(
                "CNA: fingerprint ancorado na CognChain — hash=%s session=%s...",
                result["content_hash"][:16], state.session_id[:12],
            )
            with _SESSIONS_LOCK:
                if state.session_id in _SESSIONS:
                    _SESSIONS[state.session_id].anchored = True
        else:
            logger.warning("CNA: falha ao ancorar fingerprint na CognChain")

    t = threading.Thread(target=_worker, daemon=True, name="congchain-cna-anchor")
    t.start()


def _anchor_passive(state: _SessionState) -> None:
    """Ancora apenas metadados da sessão (modo passivo, sem modelo local)."""

    def _worker():
        content = (
            f"[CNA Session Metadata — Passive Mode]\n"
            f"Session: {state.session_id}\n"
            f"Model: {state.model_name or 'desconhecido'}\n"
            f"Platform: {state.platform or 'desconhecida'}\n"
            f"Turnos LLM: {state.llm_turns}\n"
            f"Prompts coletados: {len(state.user_prompts)}\n"
            f"Nota: modelo local não configurado — fingerprint CNA não disponível.\n"
            f"Configure CNA_MODEL_PATH para habilitar fingerprinting completo.\n"
        )
        result = _http_post("/api/memory/write", {
            "content": content,
            "model": "mythos",
            "metadata": {
                "source": "mythos",
                "contentType": "mythos_task_result",
                "agentId": _agent_id(),
                "agentName": "Mythos",
                "origin": "mythos-cna-interpretability",
                "type": "session_metadata_passive",
                "session_id": state.session_id,
                "model": state.model_name,
                "llm_turns": state.llm_turns,
                "algorithm": "CNA-passive",
                "proofMode": "none",
                "anchorMode": "none",
                "safety": {
                    "containsSecrets": False,
                    "containsPrivateKeys": False,
                    "containsSignedPayloads": False,
                    "canMoveFunds": False,
                    "requiresHumanReview": True,
                },
            },
        })
        if result and result.get("content_hash"):
            logger.info(
                "CNA passivo: metadados ancorados — hash=%s",
                result["content_hash"][:16],
            )

    t = threading.Thread(target=_worker, daemon=True, name="congchain-cna-passive")
    t.start()


# ---------------------------------------------------------------------------
# CNA runner (thread separada — não bloqueia a sessão)
# ---------------------------------------------------------------------------

def _run_cna_and_anchor(state: _SessionState) -> None:
    """Roda CNA completo e ancora na CognChain. Executado em thread daemon."""

    def _worker():
        model_path = _env("CNA_MODEL_PATH")
        if not model_path:
            logger.info(
                "CNA: CNA_MODEL_PATH não definido — ancorando em modo passivo"
            )
            _anchor_passive(state)
            return

        if len(state.user_prompts) < _min_prompts():
            logger.info(
                "CNA: apenas %d prompts coletados (mínimo: %d) — ancorando em modo passivo",
                len(state.user_prompts), _min_prompts(),
            )
            _anchor_passive(state)
            return

        try:
            engine = _get_engine(model_path)
            fingerprint = engine.run(
                positive_prompts=state.user_prompts,
                negative_prompts=_DEFAULT_BENIGN_PROMPTS,
            )

            if fingerprint:
                state.cna_fingerprint = fingerprint
                if _should_anchor():
                    _anchor_fingerprint(state, fingerprint)
            else:
                logger.warning("CNA: análise retornou vazio — ancorando em modo passivo")
                _anchor_passive(state)

        except Exception as exc:
            logger.warning("CNA: erro durante análise: %s — ancorando em modo passivo", exc)
            _anchor_passive(state)

    t = threading.Thread(target=_worker, daemon=True, name="congchain-cna-runner")
    t.start()


# ---------------------------------------------------------------------------
# Hooks do plugin
# ---------------------------------------------------------------------------

def on_session_start(*, session_id: str = "", model: str = "",
                     platform: str = "", **_: Any) -> None:
    if not session_id or not _is_configured():
        return
    try:
        with _SESSIONS_LOCK:
            _SESSIONS[session_id] = _SessionState(
                session_id=session_id,
                model_name=model,
                platform=platform,
            )
        logger.debug("CNA: sessão iniciada — %s", session_id[:16])
    except Exception as exc:
        logger.warning("CNA: on_session_start falhou: %s", exc)


def on_post_llm_call(*, session_id: str = "", model: str = "",
                     messages: Any = None, assistant_response: Any = None,
                     **_: Any) -> None:
    """Coleta prompts da conversa para análise CNA posterior."""
    if not session_id or not _is_configured():
        return
    try:
        with _SESSIONS_LOCK:
            state = _SESSIONS.get(session_id)
            if state is None:
                return
            state.llm_turns += 1
            if model and not state.model_name:
                state.model_name = model

            # Coletar turnos do usuário como "prompts positivos"
            if messages and isinstance(messages, list):
                for msg in messages[-4:]:  # últimas 4 mensagens
                    if isinstance(msg, dict) and msg.get("role") == "user":
                        text = _extract_text(msg.get("content", ""))
                        if text and len(text) > 20:
                            if text not in state.user_prompts:
                                state.user_prompts.append(text[:512])
    except Exception as exc:
        logger.warning("CNA: on_post_llm_call falhou: %s", exc)


def on_session_end(*, session_id: str = "", **_: Any) -> None:
    """Dispara análise CNA e ancoragem ao fim da sessão."""
    if not session_id or not _is_configured():
        return
    try:
        with _SESSIONS_LOCK:
            state = _SESSIONS.pop(session_id, None)
        if state is None:
            return

        logger.info(
            "CNA: sessão encerrada — %d prompts coletados, disparando análise...",
            len(state.user_prompts),
        )
        _run_cna_and_anchor(state)

    except Exception as exc:
        logger.warning("CNA: on_session_end falhou: %s", exc)


# ---------------------------------------------------------------------------
# register() — ponto de entrada do plugin
# ---------------------------------------------------------------------------

def register(ctx) -> None:
    """Registra os hooks do plugin CNA."""
    if not _is_configured():
        logger.debug(
            "CNA: CONGCHAIN_API_KEY não definido. "
            "Plugin desativado silenciosamente."
        )
        return

    ctx.register_hook("on_session_start", on_session_start)
    ctx.register_hook("on_session_end", on_session_end)
    ctx.register_hook("post_llm_call", on_post_llm_call)

    model_path = _env("CNA_MODEL_PATH")
    mode = f"COMPLETO ({model_path})" if model_path else "PASSIVO (sem modelo local)"
    logger.info(
        "CNA Interpretability Plugin ativo — modo: %s | agent: %s",
        mode, _agent_id(),
    )
