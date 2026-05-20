"""CognChain Observability Plugin para Mythos Agent.

Registra o COMPORTAMENTO do agente como memória verificável — não o conteúdo das conversas,
mas as decisões: quais ferramentas foram chamadas, em que ordem, com que
resultado, e quais foram as respostas finais de alto valor.

Isso cria um log de auditoria verificável por hash para cada sessão Mythos.
Qualquer pessoa com o hash pode verificar exatamente o que
o agente fez e decidiu em uma sessão passada.

Diferença do memory provider:
  - Memory provider → ancora o CONTEÚDO das conversas (o que foi dito)
  - Este plugin     → ancora o COMPORTAMENTO do agente (o que foi feito)

Ativação:
    mythos plugins enable observability/congchain

Variáveis de ambiente:
    CONGCHAIN_API_URL       — URL base da API CognChain
    CONGCHAIN_API_KEY       — API key cog_live_* criada em /dashboard/keys
    CONGCHAIN_AGENT_ID      — identificador opcional do Mythos local
    CONGCHAIN_OBS_MIN_TOOLS — mínimo de tool calls para ancorar sessão (padrão: 2)
    CONGCHAIN_OBS_DEBUG     — "true" para logs verbosos

Filosofia de falha:
    Todos os hooks são silenciosos. Qualquer erro é logado como WARNING.
    Nunca levanta exceção. Nunca bloqueia a sessão.
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
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
_API_URL_ENV = "CONGCHAIN_API_URL"
_API_KEY_ENV = "CONGCHAIN_API_KEY"
_AGENT_ID_ENV = "CONGCHAIN_AGENT_ID"
_DEFAULT_API_URL = "https://cognchain-program-production.up.railway.app"
_DEFAULT_AGENT_ID = "mythos-local"
_HTTP_TIMEOUT = 8
_MAX_CONTENT_CHARS = 3000
_MIN_TOOLS_TO_ANCHOR = int(os.environ.get("CONGCHAIN_OBS_MIN_TOOLS", "2"))

# Ferramentas de alto valor que sempre valem ancorar individualmente
_HIGH_VALUE_TOOLS = {
    "write_file", "patch", "terminal", "execute_code",
    "delegate_task", "memory", "skill_manage",
}

# ---------------------------------------------------------------------------
# Estado de sessão (por session_id, thread-safe)
# ---------------------------------------------------------------------------

@dataclass
class _SessionState:
    session_id: str
    model: str = ""
    platform: str = ""
    started_at: float = field(default_factory=time.time)
    tool_calls: List[Dict[str, Any]] = field(default_factory=list)
    llm_turns: int = 0
    final_response: str = ""
    anchored_hashes: List[str] = field(default_factory=list)


_SESSIONS: Dict[str, _SessionState] = {}
_SESSIONS_LOCK = threading.Lock()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _debug_enabled() -> bool:
    return _env("CONGCHAIN_OBS_DEBUG", "").lower() in ("1", "true", "yes")


def _debug(msg: str) -> None:
    if _debug_enabled():
        logger.info("CognChain obs: %s", msg)


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


def _truncate(value: Any, max_chars: int = _MAX_CONTENT_CHARS) -> str:
    text = str(value) if not isinstance(value, str) else value
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + f"… [+{len(text) - max_chars} chars]"


def _safe_json(value: Any) -> Any:
    """Serializa de forma segura para JSON — sem levantar exceção."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, dict):
        return {str(k): _safe_json(v) for k, v in list(value.items())[:30]}
    if isinstance(value, (list, tuple)):
        return [_safe_json(v) for v in list(value)[:30]]
    return _truncate(repr(value), 500)


def _http_post(path: str, body: dict, *, retries: int = 2) -> Optional[dict]:
    """POST JSON para CognChain. Silencioso em falha."""
    if not _is_configured():
        return None

    url = f"{_api_url().rstrip('/')}{path}"
    payload = json.dumps(body, default=str).encode()
    headers = {
        **_headers("mythos-congchain-observability/1.1"),
    }

    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < retries:
                time.sleep(2 ** attempt)
                continue
            _debug(f"POST {path} HTTP {exc.code}")
            return None
        except Exception as exc:
            _debug(f"POST {path} erro: {exc}")
            return None
    return None


def _anchor_async(content: str, confidence_bps: int, importance_bps: int,
                  metadata: dict, state: _SessionState) -> None:
    """Ancora uma entrada na CognChain em thread daemon."""

    def _worker():
        try:
            result = _http_post("/api/memory/write", {
                "content": content,
                "model": "mythos",
                "metadata": {
                    "source": "mythos",
                    "contentType": "mythos_task_result",
                    "agentId": _agent_id(),
                    "agentName": "Mythos",
                    "namespace": "mythos",
                    "lineage": "Hermes-compatible fork",
                    "compatibilityMode": "hermes_compatible_mythos_primary",
                    "identityProgram": "mythos_six_pillar_agent_identity",
                    "origin": "mythos-observability",
                    "proofMode": "none",
                    "anchorMode": "none",
                    "safety": {
                        "containsSecrets": False,
                        "containsPrivateKeys": False,
                        "containsSignedPayloads": False,
                        "canMoveFunds": False,
                        "requiresHumanReview": True,
                    },
                    **metadata,
                },
            })
            if result and result.get("content_hash"):
                h = result["content_hash"]
                with _SESSIONS_LOCK:
                    if state.session_id in _SESSIONS:
                        _SESSIONS[state.session_id].anchored_hashes.append(h)
                logger.info(
                    "CognChain obs: ancorado — hash=%s session=%s...",
                    h[:16], state.session_id[:8],
                )
        except Exception as exc:
            logger.warning("CognChain obs: erro ao ancorar: %s", exc)

    t = threading.Thread(target=_worker, daemon=True, name="congchain-obs-anchor")
    t.start()


# ---------------------------------------------------------------------------
# Hooks
# ---------------------------------------------------------------------------

def on_session_start(*, session_id: str = "", model: str = "",
                     platform: str = "", **_: Any) -> None:
    """Inicializa o estado de observabilidade da sessão."""
    if not session_id or not _is_configured():
        return

    try:
        with _SESSIONS_LOCK:
            _SESSIONS[session_id] = _SessionState(
                session_id=session_id,
                model=model,
                platform=platform,
            )
        _debug(f"sessão iniciada: {session_id[:16]}")
    except Exception as exc:
        logger.warning("CognChain obs: on_session_start falhou: %s", exc)


def on_post_tool_call(*, tool_name: str = "", args: Any = None,
                      result: Any = None, task_id: str = "",
                      session_id: str = "", tool_call_id: str = "",
                      **_: Any) -> None:
    """Registra tool call no estado da sessão. Ancora imediatamente se for alta relevância."""
    if not session_id or not _is_configured():
        return

    try:
        with _SESSIONS_LOCK:
            state = _SESSIONS.get(session_id)
            if state is None:
                return

            # Resultado resumido
            result_text = _truncate(result, 800) if result is not None else ""
            args_safe = _safe_json(args)

            entry = {
                "tool": tool_name,
                "args": args_safe,
                "result_preview": result_text,
                "tool_call_id": tool_call_id or "",
                "ts": time.time(),
            }
            state.tool_calls.append(entry)

        # Ancorar individualmente ferramentas de alto impacto
        if tool_name in _HIGH_VALUE_TOOLS:
            args_str = json.dumps(args_safe, ensure_ascii=False, default=str)
            content = (
                f"[Tool Call] {tool_name}\n"
                f"Args: {_truncate(args_str, 600)}\n"
                f"Result: {result_text}"
            )
            _anchor_async(
                content=content,
                confidence_bps=8500,
                importance_bps=9000,
                metadata={
                    "source": "mythos-observability",
                    "type": "tool_call",
                    "tool_name": tool_name,
                    "session_id": session_id,
                    "task_id": task_id or "",
                },
                state=state,
            )
            _debug(f"tool de alto valor ancorado: {tool_name}")

    except Exception as exc:
        logger.warning("CognChain obs: on_post_tool_call falhou: %s", exc)


def on_post_llm_call(*, session_id: str = "", model: str = "",
                     assistant_response: Any = None,
                     assistant_message: Any = None,
                     task_id: str = "", platform: str = "",
                     **_: Any) -> None:
    """Conta turnos LLM e captura a resposta final da sessão."""
    if not session_id or not _is_configured():
        return

    try:
        with _SESSIONS_LOCK:
            state = _SESSIONS.get(session_id)
            if state is None:
                return

            state.llm_turns += 1

            # Capturar resposta final (texto do assistente)
            if assistant_response and isinstance(assistant_response, str):
                state.final_response = _truncate(assistant_response, _MAX_CONTENT_CHARS)
            elif assistant_message:
                content = getattr(assistant_message, "content", None)
                if isinstance(content, str) and content:
                    state.final_response = _truncate(content, _MAX_CONTENT_CHARS)

            if model and not state.model:
                state.model = model
            if platform and not state.platform:
                state.platform = platform

    except Exception as exc:
        logger.warning("CognChain obs: on_post_llm_call falhou: %s", exc)


def on_session_end(*, session_id: str = "", messages: Any = None, **_: Any) -> None:
    """Salva o resumo completo da sessão ao encerrar."""
    if not session_id or not _is_configured():
        return

    try:
        with _SESSIONS_LOCK:
            state = _SESSIONS.pop(session_id, None)
        if state is None:
            return

        tool_count = len(state.tool_calls)
        duration_s = round(time.time() - state.started_at, 1)

        # Só ancora sessões com atividade mínima
        if tool_count < _MIN_TOOLS_TO_ANCHOR and not state.final_response:
            _debug(f"sessão {session_id[:16]}: poucos eventos, não ancorando resumo")
            return

        # Construir resumo estruturado da sessão
        tool_summary_lines = []
        for tc in state.tool_calls[:20]:  # máximo 20 tool calls no resumo
            result_preview = tc.get("result_preview", "")[:120]
            tool_summary_lines.append(
                f"  • {tc['tool']} → {result_preview}"
            )

        tool_summary = "\n".join(tool_summary_lines) or "  (nenhuma tool call)"

        anchored_hashes = state.anchored_hashes
        hashes_block = (
            "\n".join(f"  {h[:32]}" for h in anchored_hashes[:10])
            if anchored_hashes else "  (nenhum)"
        )

        content = (
            f"[Resumo de Sessão Mythos]\n"
            f"Session: {session_id}\n"
            f"Modelo: {state.model or 'desconhecido'}\n"
            f"Plataforma: {state.platform or 'desconhecida'}\n"
            f"Duração: {duration_s}s\n"
            f"Turnos LLM: {state.llm_turns}\n"
            f"Tool calls ({tool_count}):\n{tool_summary}\n"
            f"Hashes ancorados:\n{hashes_block}\n"
        )

        if state.final_response:
            content += f"\nResposta final:\n{state.final_response}"

        # Confiança baseada na atividade da sessão
        confidence = min(7000 + tool_count * 100, 9500)

        session_hash = hashlib.sha256(session_id.encode()).hexdigest()[:16]

        _anchor_async(
            content=content,
            confidence_bps=confidence,
            importance_bps=min(confidence + 500, 10000),
            metadata={
                "source": "mythos-observability",
                "type": "session_summary",
                "session_id": session_id,
                "session_hash": session_hash,
                "tool_count": tool_count,
                "llm_turns": state.llm_turns,
                "duration_s": duration_s,
                "model": state.model,
                "platform": state.platform,
                "child_hashes": anchored_hashes[:10],
            },
            state=_SessionState(session_id=session_id),  # estado dummy para receber o hash
        )

        logger.info(
            "CognChain obs: sessão %s... encerrada — %d tools, %d hashes ancorados, %.1fs",
            session_id[:12], tool_count, len(anchored_hashes), duration_s,
        )

    except Exception as exc:
        logger.warning("CognChain obs: on_session_end falhou: %s", exc)


# ---------------------------------------------------------------------------
# register() — ponto de entrada do plugin
# ---------------------------------------------------------------------------

def register(ctx) -> None:
    """Registra os hooks de observabilidade CognChain."""
    if not _is_configured():
        logger.debug(
            "CognChain obs: CONGCHAIN_API_KEY não definido. "
            "Plugin desativado silenciosamente."
        )
        return

    ctx.register_hook("on_session_start", on_session_start)
    ctx.register_hook("on_session_end", on_session_end)
    ctx.register_hook("post_tool_call", on_post_tool_call)
    ctx.register_hook("post_llm_call", on_post_llm_call)

    logger.info(
        "CognChain observability ativo — agent=%s",
        _agent_id(),
    )
