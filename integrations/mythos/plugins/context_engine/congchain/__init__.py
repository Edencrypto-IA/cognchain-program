"""CognChain Context Engine para Mythos Agent.

Estende o ContextCompressor padrão com uma camada de memória verificável.
Antes de comprimir o contexto, extrai os turnos de maior valor semântico
e os salva na CongChain como memórias verificáveis.

Isso garante que nenhum insight importante seja perdido na compressão —
ele fica disponível por hash em qualquer sessão futura, em qualquer modelo.

Ativação (config.yaml):
    context:
      engine: congchain

Variáveis de ambiente necessárias:
    CONGCHAIN_API_URL   — URL base da API CognChain
    CONGCHAIN_API_KEY   — API key cog_live_* criada em /dashboard/keys
    CONGCHAIN_AGENT_ID  — identificador opcional do Mythos local

O engine herda 100% do comportamento do ContextCompressor padrão.
A única diferença é o hook pre-compress que ancora antes de comprimir.
Se a CognChain estiver indisponível, o engine continua funcionando
normalmente como o compressor padrão — nunca bloqueia a sessão.
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
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Importar o compressor padrão como base
# ---------------------------------------------------------------------------
try:
    from agent.context_compressor import ContextCompressor as _BaseCompressor
    _BASE_AVAILABLE = True
except Exception as _import_err:
    logger.warning(
        "CognChain context engine: não foi possível importar ContextCompressor: %s. "
        "Usando fallback mínimo.",
        _import_err,
    )
    _BASE_AVAILABLE = False
    from agent.context_engine import ContextEngine as _BaseCompressor  # type: ignore

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
_API_URL_ENV = "CONGCHAIN_API_URL"
_API_KEY_ENV = "CONGCHAIN_API_KEY"
_AGENT_ID_ENV = "CONGCHAIN_AGENT_ID"
_DEFAULT_API_URL = "https://cognchain-program-production.up.railway.app"
_DEFAULT_AGENT_ID = "mythos-local"

# Mínimo de chars para um turno ser considerado âncora
_MIN_ANCHOR_CHARS = 200

# Palavras-chave que elevam a confiança de um turno
_HIGH_VALUE_KEYWORDS = {
    "solana", "anchor", "program", "congchain", "memory", "vault",
    "implementation", "architecture", "algorithm", "solution", "error",
    "bug", "fix", "deploy", "contract", "transaction", "signature",
    "typescript", "python", "rust", "function", "class", "async",
    "resultado", "solução", "implementação", "arquitetura", "erro",
    "conclusão", "importante", "descoberta", "análise", "resumo",
}

# Timeout para chamadas HTTP à CognChain (não bloqueia o fluxo principal)
_HTTP_TIMEOUT = 8


# ---------------------------------------------------------------------------
# Helpers HTTP (stdlib apenas, sem dependências extras)
# ---------------------------------------------------------------------------

def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _api_url() -> str:
    return _env(_API_URL_ENV) or _DEFAULT_API_URL


def _api_key() -> str:
    return _env(_API_KEY_ENV)


def _agent_id() -> str:
    return _env(_AGENT_ID_ENV, _DEFAULT_AGENT_ID) or _DEFAULT_AGENT_ID


def _is_available() -> bool:
    return bool(_api_key())


def _headers(user_agent: str) -> dict:
    headers = {"Content-Type": "application/json", "User-Agent": user_agent}
    key = _api_key()
    if key:
        headers["Authorization"] = f"Bearer {key}"
    return headers


def _http_post(path: str, body: dict, *, retries: int = 2) -> Optional[dict]:
    """POST JSON para a API CognChain. Retorna None em qualquer falha."""
    if not _api_key():
        return None
    url = f"{_api_url().rstrip('/')}{path}"
    payload = json.dumps(body).encode()
    headers = _headers("mythos-congchain-engine/1.1")

    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < retries:
                time.sleep(2 ** attempt)
                continue
            logger.debug("CognChain POST %s falhou HTTP %s", path, exc.code)
            return None
        except Exception as exc:
            logger.debug("CognChain POST %s falhou: %s", path, exc)
            return None
    return None


def _http_get(path: str) -> Optional[dict]:
    """GET para a API CognChain. Retorna None em qualquer falha."""
    url = f"{_api_url().rstrip('/')}{path}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "mythos-congchain-engine/1.0"})
        with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
            return json.loads(resp.read().decode())
    except Exception as exc:
        logger.debug("CognChain GET %s falhou: %s", path, exc)
        return None


# ---------------------------------------------------------------------------
# Seleção de turnos de alto valor
# ---------------------------------------------------------------------------

def _extract_text(content: Any) -> str:
    """Extrai texto plano do conteúdo de uma mensagem (str ou lista multimodal)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and item.get("type") in ("text", "input_text"):
                parts.append(item.get("text", ""))
        return "\n".join(p for p in parts if p)
    return str(content or "")


def _confidence_bps(text: str) -> int:
    """Calcula confiança em basis points (0–10000) para um turno do assistente."""
    if len(text) < _MIN_ANCHOR_CHARS:
        return 0

    score = 6000  # base: 60%

    # Comprimento: +500 bps acima de 500 chars, +500 acima de 2000
    if len(text) > 500:
        score += 500
    if len(text) > 2000:
        score += 500

    # Palavras-chave técnicas: +100 bps por palavra única encontrada, máximo +1500
    words_found = sum(1 for kw in _HIGH_VALUE_KEYWORDS if kw in text.lower())
    score += min(words_found * 100, 1500)

    # Código presente: +500 bps
    if "```" in text or "def " in text or "function " in text or "async " in text:
        score += 500

    return min(score, 10000)


def _select_anchor_turns(
    messages: List[Dict[str, Any]],
    *,
    protect_first_n: int = 3,
    protect_last_n: int = 6,
) -> List[Dict[str, Any]]:
    """Seleciona turnos do assistente que valem ser salvos no bridge.

    Foca na região do meio — os turnos que serão comprimidos.
    Retorna lista de dicts com: content, confidence_bps, importance_bps, summary.
    """
    # Identificar região que será comprimida (mesma lógica do ContextCompressor)
    non_system = [m for m in messages if m.get("role") != "system"]
    head = non_system[:protect_first_n]
    tail = non_system[-protect_last_n:] if protect_last_n else []
    head_ids = {id(m) for m in head}
    tail_ids = {id(m) for m in tail}

    candidates = []
    for msg in messages:
        if msg.get("role") != "assistant":
            continue
        if id(msg) in head_ids or id(msg) in tail_ids:
            continue

        text = _extract_text(msg.get("content", ""))
        confidence = _confidence_bps(text)
        if confidence < 7000:  # só ancora confiança ≥ 70%
            continue

        # Resumo: primeiros 500 chars do turno
        summary = text[:500].strip()
        content_hash = hashlib.sha256(text.encode()).hexdigest()[:32]

        candidates.append({
            "content": text[:4000],  # limitar tamanho enviado
            "confidence_bps": confidence,
            "importance_bps": min(confidence + 500, 10000),
            "summary": summary,
            "content_hash_local": content_hash,
        })

    return candidates


# ---------------------------------------------------------------------------
# Ancoragem assíncrona (thread separada — nunca bloqueia o agente)
# ---------------------------------------------------------------------------

def _anchor_turns_async(turns: List[Dict[str, Any]], session_id: str) -> None:
    """Ancora turnos na CognChain em thread daemon. Nunca levanta exceção."""

    def _worker():
        if not _api_key():
            return

        anchored = 0
        for turn in turns:
            try:
                result = _http_post("/api/memory/write", {
                    "content": turn["content"],
                    "model": "mythos",
                    "metadata": {
                        "source": "mythos",
                        "contentType": "mythos_memory",
                        "agentId": _agent_id(),
                        "agentName": "Mythos",
                        "namespace": "mythos",
                        "lineage": "Hermes-compatible fork",
                        "compatibilityMode": "hermes_compatible_mythos_primary",
                        "identityProgram": "mythos_six_pillar_agent_identity",
                        "cognitiveArchitecture": "mythos_verifiable_brain_v1",
                        "decisionTraceSchema": "mythos_decision_trace_v1",
                        "session_id": session_id or "",
                        "local_hash": turn["content_hash_local"],
                        "engine": "congchain",
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
                    anchored += 1
                    logger.info(
                        "CognChain engine: turno ancorado — hash=%s confiança=%s%%",
                        result["content_hash"][:16],
                        turn["confidence_bps"] // 100,
                    )
            except Exception as exc:
                logger.warning("CognChain engine: falha ao ancorar turno: %s", exc)

        if anchored:
            logger.info(
                "CognChain engine: %d/%d turnos ancorados antes da compressão",
                anchored, len(turns),
            )

    t = threading.Thread(target=_worker, daemon=True, name="congchain-anchor")
    t.start()


# ---------------------------------------------------------------------------
# CognChainContextEngine
# ---------------------------------------------------------------------------

class CognChainContextEngine(_BaseCompressor):  # type: ignore[misc]
    """Context engine que ancora turnos valiosos na CognChain antes de comprimir.

    Herda 100% do ContextCompressor padrão. A única adição é o hook
    pre-compress: antes de comprimir, seleciona os turnos de alto valor
    da região do meio e os salva em background.

    Se a CognChain estiver indisponível, o comportamento é idêntico ao
    ContextCompressor original — nunca bloqueia a sessão.
    """

    @property
    def name(self) -> str:
        return "congchain"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._session_id: str = ""
        self._anchor_count: int = 0
        self._congchain_available: Optional[bool] = None  # None = não testado ainda

    def _check_congchain(self) -> bool:
        """Verifica conectividade com a CognChain uma vez por sessão."""
        if self._congchain_available is not None:
            return self._congchain_available

        if not _is_available():
            logger.debug(
                "CognChain engine: CONGCHAIN_API_KEY não definido. "
                "Operando como ContextCompressor padrão."
            )
            self._congchain_available = False
            return False

        result = _http_get("/api/memory/health")
        ok = bool(result and result.get("status") in ("ok", "healthy", "online"))
        if ok:
            logger.info(
                "CognChain engine: conectado — agent=%s",
                _agent_id(),
            )
        else:
            logger.warning(
                "CognChain engine: API indisponível. "
                "Operando como ContextCompressor padrão até o próximo ciclo."
            )
        self._congchain_available = ok
        return ok

    def on_session_start(self, session_id: str, **kwargs: Any) -> None:
        self._session_id = session_id or ""
        self._anchor_count = 0
        self._congchain_available = None  # re-testar na próxima compressão
        super().on_session_start(session_id, **kwargs)

    def on_session_reset(self) -> None:
        self._anchor_count = 0
        self._congchain_available = None
        super().on_session_reset()

    def compress(
        self,
        messages: List[Dict[str, Any]],
        current_tokens: int = None,
        focus_topic: str = None,
    ) -> List[Dict[str, Any]]:
        """Salva turnos valiosos e depois comprime normalmente."""

        # --- Pré-compressão: selecionar e ancorar ---
        try:
            if self._check_congchain():
                turns = _select_anchor_turns(
                    messages,
                    protect_first_n=self.protect_first_n,
                    protect_last_n=self.protect_last_n,
                )
                if turns:
                    logger.info(
                        "CognChain engine: %d turno(s) selecionado(s) para ancoragem antes de comprimir",
                        len(turns),
                    )
                    _anchor_turns_async(turns, self._session_id)
                    self._anchor_count += len(turns)
        except Exception as exc:
            # Nunca interrompe a compressão
            logger.warning("CognChain engine: erro na fase de ancoragem: %s", exc)

        # --- Compressão normal (ContextCompressor) ---
        return super().compress(
            messages,
            current_tokens=current_tokens,
            focus_topic=focus_topic,
        )

    def get_status(self) -> Dict[str, Any]:
        status = super().get_status()
        status["congchain_anchor_count"] = self._anchor_count
        status["congchain_agent_id"] = _agent_id()
        status["congchain_auth"] = "configurado" if _api_key() else "não configurado"
        status["congchain_available"] = self._congchain_available
        return status

    def is_available(self) -> bool:
        """Sempre disponível — degrada graciosamente sem CognChain."""
        return True


# ---------------------------------------------------------------------------
# Ferramenta exposta ao agente: congchain_recall
# ---------------------------------------------------------------------------

_CONGCHAIN_RECALL_SCHEMA = {
    "name": "congchain_recall",
    "description": (
        "Recupera uma memória verificável da CognChain pelo hash. "
        "Use quando o usuário mencionar um hash CognChain ou pedir para retomar "
        "a partir de um checkpoint CongChain anterior."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "hash": {
                "type": "string",
                "description": "Hash da memória CognChain (32+ chars hex)",
            },
        },
        "required": ["hash"],
    },
}


def _handle_congchain_recall(args: Dict[str, Any], **kwargs: Any) -> str:
    """Handler da ferramenta congchain_recall."""
    memory_hash = str(args.get("hash", "")).strip()
    if not memory_hash:
        return json.dumps({"error": "hash é obrigatório"})

    result = _http_get(f"/api/memory/{memory_hash}")
    if not result:
        return json.dumps({
            "error": f"Memória não encontrada ou CognChain indisponível para hash={memory_hash}"
        })

    # Formatar como bloco verificado para o agente
    on_chain = result.get("on_chain", False)
    content = result.get("content", result.get("summary", ""))
    model_origin = result.get("model", "desconhecido")
    created_at = result.get("created_at", "desconhecido")
    confidence = result.get("confidence_bps", 0)

    header = (
        f"⚡ Memória Verificada · CongChain Bridge\n"
        f"{'━' * 48}\n"
        f"Hash: {memory_hash[:32]}...\n"
        f"Origem: {model_origin} · {created_at}\n"
        f"Status: {'✓ On-chain' if on_chain else '⏳ Pendente'} · "
        f"Score: {confidence // 100}%\n"
        f"{'━' * 48}\n"
        f"{str(content)[:2000]}"
    )

    return json.dumps({
        "verified_memory": header,
        "raw": result,
        "on_chain": on_chain,
    })


# ---------------------------------------------------------------------------
# register() — ponto de entrada do plugin
# ---------------------------------------------------------------------------

def register(ctx) -> None:
    """Registra o CognChainContextEngine no sistema de plugins do Mythos."""
    if not _BASE_AVAILABLE:
        logger.warning(
            "CognChain context engine nao foi registrado porque o ContextCompressor "
            "do Mythos nao esta disponivel neste ambiente. Instale as dependencias "
            "do runtime Mythos para ativar context.engine=congchain."
        )
        return
    engine = CognChainContextEngine()
    ctx.register_context_engine(engine)
    logger.debug("CognChain context engine registrado")
