"""CongChain Adapter for Mythos Agent.

This plugin connects the real Mythos runtime loop to CongChain without
removing or weakening Mythos tools. It observes the native Mythos hooks,
builds safe audit memories, and writes them through the authenticated
Agent Memory Bridge.

Runtime events:
- onTaskStart      -> on_session_start
- onSkillSelected  -> pre_llm_call on the first turn
- onToolCall       -> pre_tool_call
- onToolResult     -> post_tool_call
- onMemoryCompress -> post_api_request when the model reports length/max_tokens
- onTaskComplete   -> on_session_end and cleanup on on_session_finalize
- onSafetyBlock    -> post_tool_call and post_llm_call refusal/block detection

Required environment:
- CONGCHAIN_API_KEY=cog_live_...

Optional environment:
- CONGCHAIN_API_URL=https://cognchain-program-production.up.railway.app
- CONGCHAIN_AGENT_ID=mythos-local
- CONGCHAIN_ADAPTER_DEBUG=true
- CONGCHAIN_ADAPTER_MIN_TOOLS=1
- CONGCHAIN_ADAPTER_ANCHOR_<EVENT>=false
"""

from __future__ import annotations

import json
import logging
import os
import re
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_API_URL_ENV = "CONGCHAIN_API_URL"
_API_KEY_ENV = "CONGCHAIN_API_KEY"
_AGENT_ID_ENV = "CONGCHAIN_AGENT_ID"
_DEFAULT_URL = "https://cognchain-program-production.up.railway.app"
_DEFAULT_AGENT_ID = "mythos-local"
_HTTP_TIMEOUT = 8
_RETRY_WAIT = 2
_MAX_CONTENT_CHARS = 3600

_EVENT_TASK_START = "onTaskStart"
_EVENT_SKILL = "onSkillSelected"
_EVENT_TOOL_CALL = "onToolCall"
_EVENT_TOOL_RESULT = "onToolResult"
_EVENT_MEM_COMPRESS = "onMemoryCompress"
_EVENT_TASK_COMPLETE = "onTaskComplete"
_EVENT_SAFETY_BLOCK = "onSafetyBlock"

_HIGH_IMPACT_TOOLS = {
    "write_file",
    "patch",
    "terminal",
    "execute_code",
    "delegate_task",
    "memory",
    "skill_manage",
    "browser_navigate",
    "send_message",
    "image_generate",
    "video_generate",
    "cron",
    "scheduler",
}

_SECRET_PATTERNS = [
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----", re.I),
    re.compile(r"\b(seed phrase|mnemonic|private key|secret key)\b", re.I),
    re.compile(r"\b[A-Z0-9_]*(API_KEY|SECRET|TOKEN|PRIVATE_KEY)\s*=\s*[^\s,;\"']+", re.I),
    re.compile(r"\bcog_live_[a-f0-9]{24,}\b", re.I),
    re.compile(r"\b(?:[1-9A-HJ-NP-Za-km-z]{80,})\b"),
]


@dataclass
class _Session:
    session_id: str
    model: str = ""
    platform: str = ""
    started_at: float = field(default_factory=time.time)
    llm_calls: int = 0
    tool_calls: List[Dict[str, Any]] = field(default_factory=list)
    compress_events: int = 0
    safety_blocks: int = 0
    skill_anchored: bool = False
    anchored_hashes: List[str] = field(default_factory=list)


_SESSIONS: Dict[str, _Session] = {}
_LOCK = threading.Lock()


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _flag(name: str, default: bool = True) -> bool:
    value = _env(name).lower()
    if value in ("false", "0", "no", "off"):
        return False
    if value in ("true", "1", "yes", "on"):
        return True
    return default


def _api_url() -> str:
    return _env(_API_URL_ENV, _DEFAULT_URL) or _DEFAULT_URL


def _api_key() -> str:
    return _env(_API_KEY_ENV)


def _agent_id() -> str:
    return _env(_AGENT_ID_ENV, _DEFAULT_AGENT_ID) or _DEFAULT_AGENT_ID


def _is_configured() -> bool:
    return bool(_api_key())


def _debug(message: str, *args: Any) -> None:
    if _flag("CONGCHAIN_ADAPTER_DEBUG", False):
        logger.info("CongChain adapter: " + message, *args)


def _min_tools() -> int:
    try:
        return max(0, int(_env("CONGCHAIN_ADAPTER_MIN_TOOLS", "1")))
    except ValueError:
        return 1


def _truncate(value: Any, max_chars: int = 500) -> str:
    text = value if isinstance(value, str) else repr(value)
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + f"...[+{len(text) - max_chars}]"


def _redact(value: Any, max_chars: int = 500) -> str:
    text = _truncate(value, max_chars)
    for pattern in _SECRET_PATTERNS:
        text = pattern.sub("[REDACTED]", text)
    return text


def _safe_json(value: Any, max_items: int = 20) -> Any:
    if value is None or isinstance(value, (bool, int, float, str)):
        return _redact(value, 500) if isinstance(value, str) else value
    if isinstance(value, dict):
        return {
            _redact(str(key), 80): _safe_json(item, max_items)
            for key, item in list(value.items())[:max_items]
        }
    if isinstance(value, (list, tuple)):
        return [_safe_json(item, max_items) for item in list(value)[:max_items]]
    return _redact(repr(value), 500)


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_api_key()}",
        "Content-Type": "application/json",
        "User-Agent": "mythos-congchain-adapter/2.0",
    }


def _http_post(path: str, body: dict, *, retries: int = 2) -> Optional[dict]:
    if not _is_configured():
        return None

    url = f"{_api_url().rstrip('/')}{path}"
    payload = json.dumps(body, default=str).encode("utf-8")

    for attempt in range(retries + 1):
        try:
            request = urllib.request.Request(
                url,
                data=payload,
                headers=_headers(),
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=_HTTP_TIMEOUT) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < retries:
                time.sleep(_RETRY_WAIT * (attempt + 1))
                continue
            _debug("POST %s HTTP %s", path, exc.code)
            return None
        except Exception as exc:
            _debug("POST %s error: %s", path, exc)
            return None
    return None


def _content_type(event_type: str) -> str:
    if event_type in (_EVENT_TOOL_RESULT, _EVENT_TASK_COMPLETE):
        return "mythos_task_result"
    if event_type == _EVENT_SKILL:
        return "mythos_skill"
    return "mythos_memory"


def _anchor(
    event_type: str,
    content: str,
    confidence_bps: int,
    importance_bps: int,
    metadata: dict,
) -> None:
    if not _is_configured():
        return

    safe_content = _redact(content, _MAX_CONTENT_CHARS)
    safe_metadata = _safe_json(metadata)

    def _worker() -> None:
        try:
            body = {
                "content": safe_content,
                "model": "mythos",
                "metadata": {
                    "source": "mythos",
                    "contentType": _content_type(event_type),
                    "agentId": _agent_id(),
                    "agentName": "Mythos",
                    "origin": "mythos-runtime-congchain-adapter",
                    "skillName": str(safe_metadata.get("skill_name") or event_type)[:80],
                    "taskId": str(safe_metadata.get("task_id") or safe_metadata.get("session_id") or "")[:80],
                    "runId": str(safe_metadata.get("session_id") or "")[:80],
                    "proofMode": "none",
                    "anchorMode": "requested",
                    "eventType": event_type,
                    "confidenceBps": confidence_bps,
                    "importanceBps": importance_bps,
                    "runtime": {
                        "namespace": "mythos",
                        "compatibilityMode": "hermes_compatible_mythos_primary",
                        "cognitiveArchitecture": "mythos_verifiable_brain_v1",
                    },
                    "runtimeEvent": safe_metadata,
                    "safety": {
                        "containsSecrets": False,
                        "containsPrivateKeys": False,
                        "containsSignedPayloads": False,
                        "canMoveFunds": False,
                        "requiresHumanReview": True,
                    },
                },
            }
            result = _http_post("/api/memory/write", body)
            memory_hash = (
                result.get("hash")
                or result.get("content_hash")
                or result.get("contentHash")
                if result
                else None
            )
            if memory_hash:
                session_id = str(safe_metadata.get("session_id") or "")
                if session_id:
                    with _LOCK:
                        state = _SESSIONS.get(session_id)
                        if state:
                            state.anchored_hashes.append(memory_hash)
                logger.info(
                    "CongChain [%s]: saved hash=%s",
                    event_type,
                    str(memory_hash)[:16],
                )
            else:
                _debug("[%s] memory write skipped or failed", event_type)
        except Exception as exc:
            logger.warning("CongChain adapter [%s]: %s", event_type, exc)

    threading.Thread(
        target=_worker,
        daemon=True,
        name=f"congchain-{event_type.lower()}",
    ).start()


def _get_session(session_id: str) -> Optional[_Session]:
    with _LOCK:
        return _SESSIONS.get(session_id)


def on_session_start(
    *,
    session_id: str = "",
    model: str = "",
    platform: str = "",
    **_: Any,
) -> None:
    if not session_id or not _is_configured():
        return
    if not _flag("CONGCHAIN_ADAPTER_ANCHOR_TASK_START"):
        return
    try:
        with _LOCK:
            _SESSIONS[session_id] = _Session(
                session_id=session_id,
                model=model,
                platform=platform,
            )
        content = "\n".join([
            "[onTaskStart]",
            f"Session: {session_id}",
            f"Model: {model or 'unknown'}",
            f"Platform: {platform or 'unknown'}",
            f"Started: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}",
        ])
        _anchor(
            _EVENT_TASK_START,
            content,
            confidence_bps=7000,
            importance_bps=7000,
            metadata={"session_id": session_id, "model": model, "platform": platform},
        )
    except Exception as exc:
        logger.warning("CongChain adapter on_session_start: %s", exc)


def pre_llm_call(
    *,
    session_id: str = "",
    user_message: str = "",
    conversation_history: list = None,
    is_first_turn: bool = False,
    model: str = "",
    platform: str = "",
    sender_id: str = "",
    **_: Any,
) -> None:
    if not session_id or not _is_configured():
        return
    if not _flag("CONGCHAIN_ADAPTER_ANCHOR_SKILL"):
        return
    try:
        state = _get_session(session_id)
        if state is None:
            return
        with _LOCK:
            state.llm_calls += 1
            if model and not state.model:
                state.model = model
            already_anchored = state.skill_anchored

        if already_anchored or not is_first_turn:
            return

        history_len = len(conversation_history or [])
        task_preview = _redact(user_message, 300)
        content = "\n".join([
            "[onSkillSelected]",
            f"Session: {session_id}",
            f"Model selected: {model or 'unknown'}",
            f"Platform: {platform or 'unknown'}",
            f"Initial task: {task_preview}",
            f"Preloaded history: {history_len} messages",
        ])
        _anchor(
            _EVENT_SKILL,
            content,
            confidence_bps=8000,
            importance_bps=8000,
            metadata={
                "session_id": session_id,
                "model": model,
                "platform": platform,
                "sender_id": _redact(sender_id, 120),
                "task_preview": task_preview,
                "history_len": history_len,
                "skill_name": "Mythos runtime first-turn selection",
            },
        )
        with _LOCK:
            state.skill_anchored = True
    except Exception as exc:
        logger.warning("CongChain adapter pre_llm_call: %s", exc)


def pre_tool_call(
    *,
    tool_name: str = "",
    args: Any = None,
    session_id: str = "",
    task_id: str = "",
    tool_call_id: str = "",
    **_: Any,
) -> None:
    if not session_id or not _is_configured():
        return
    if not _flag("CONGCHAIN_ADAPTER_ANCHOR_TOOL_CALL"):
        return
    try:
        state = _get_session(session_id)
        if state is None:
            return

        args_safe = _safe_json(args)
        with _LOCK:
            state.tool_calls.append({
                "tool": tool_name,
                "args_preview": args_safe,
                "task_id": task_id or "",
                "tool_call_id": tool_call_id or "",
                "ts": time.time(),
                "result": None,
                "duration_ms": None,
                "error": False,
            })

        if tool_name in _HIGH_IMPACT_TOOLS:
            content = "\n".join([
                "[onToolCall]",
                f"Session: {session_id}",
                f"Tool: {tool_name}",
                f"Task: {task_id or 'n/a'}",
                f"Args: {json.dumps(args_safe, ensure_ascii=False, default=str)}",
            ])
            _anchor(
                _EVENT_TOOL_CALL,
                content,
                confidence_bps=8500,
                importance_bps=9000,
                metadata={
                    "session_id": session_id,
                    "tool_name": tool_name,
                    "task_id": task_id or "",
                    "tool_call_id": tool_call_id or "",
                    "high_impact": True,
                },
            )
    except Exception as exc:
        logger.warning("CongChain adapter pre_tool_call: %s", exc)


def _detect_tool_error(result: Any) -> bool:
    text = str(result).lower()[:200]
    return any(token in text for token in ("error", "exception", "traceback", "failed"))


def _check_safety_block(tool_name: str, result: Any, session_id: str, task_id: str) -> None:
    if not result or not _flag("CONGCHAIN_ADAPTER_ANCHOR_SAFETY"):
        return
    text = str(result).lower()[:300]
    blocked = any(token in text for token in (
        "denied",
        "blocked",
        "not allowed",
        "permission denied",
        "tool denied",
        "whitelist",
        "approval required",
    ))
    if not blocked:
        return

    state = _get_session(session_id)
    if state:
        with _LOCK:
            state.safety_blocks += 1

    content = "\n".join([
        "[onSafetyBlock]",
        f"Session: {session_id}",
        f"Blocked tool: {tool_name}",
        f"Task: {task_id or 'n/a'}",
        f"Detected reason: {_redact(result, 300)}",
    ])
    _anchor(
        _EVENT_SAFETY_BLOCK,
        content,
        confidence_bps=9000,
        importance_bps=9500,
        metadata={
            "session_id": session_id,
            "tool_name": tool_name,
            "task_id": task_id or "",
            "blocked": True,
        },
    )


def post_tool_call(
    *,
    tool_name: str = "",
    args: Any = None,
    result: Any = None,
    session_id: str = "",
    task_id: str = "",
    tool_call_id: str = "",
    duration_ms: float = 0,
    error: Any = None,
    **_: Any,
) -> None:
    if not session_id or not _is_configured():
        return
    if not _flag("CONGCHAIN_ADAPTER_ANCHOR_TOOL_RESULT"):
        return
    try:
        state = _get_session(session_id)
        if state is None:
            return

        result_text = _redact(error or result or "", 700)
        is_error = bool(error) or _detect_tool_error(result)
        with _LOCK:
            for tool_call in reversed(state.tool_calls):
                if tool_call.get("tool_call_id") == tool_call_id or tool_call.get("tool") == tool_name:
                    tool_call["result"] = result_text[:220]
                    tool_call["duration_ms"] = duration_ms
                    tool_call["error"] = is_error
                    break

        _check_safety_block(tool_name, error or result, session_id, task_id)

        if tool_name in _HIGH_IMPACT_TOOLS:
            status = "ERROR" if is_error else "OK"
            content = "\n".join([
                "[onToolResult]",
                f"Session: {session_id}",
                f"Tool: {tool_name}",
                f"Status: {status}",
                f"Duration: {duration_ms:.0f}ms",
                f"Result: {result_text}",
            ])
            confidence = 7000 if is_error else 8500
            _anchor(
                _EVENT_TOOL_RESULT,
                content,
                confidence_bps=confidence,
                importance_bps=min(confidence + 500, 10000),
                metadata={
                    "session_id": session_id,
                    "tool_name": tool_name,
                    "task_id": task_id or "",
                    "tool_call_id": tool_call_id or "",
                    "duration_ms": duration_ms,
                    "is_error": is_error,
                },
            )
    except Exception as exc:
        logger.warning("CongChain adapter post_tool_call: %s", exc)


def post_api_request(
    *,
    session_id: str = "",
    task_id: str = "",
    platform: str = "",
    model: str = "",
    api_call_count: int = 0,
    api_duration: float = 0,
    finish_reason: str = "",
    message_count: int = 0,
    **_: Any,
) -> None:
    if not session_id or not _is_configured():
        return
    if not _flag("CONGCHAIN_ADAPTER_ANCHOR_COMPRESS"):
        return
    try:
        state = _get_session(session_id)
        if state is None:
            return
        is_compress_event = finish_reason in ("length", "max_tokens")
        if not is_compress_event:
            return

        with _LOCK:
            state.compress_events += 1
            compress_count = state.compress_events

        content = "\n".join([
            "[onMemoryCompress]",
            f"Session: {session_id}",
            f"Model: {model or 'unknown'}",
            f"Event: {compress_count}",
            f"Reason: {finish_reason}",
            f"API calls so far: {api_call_count}",
            f"Messages in context: {message_count}",
            "Note: context compression/truncation was detected; high-value memory should be preserved through CongChain.",
        ])
        _anchor(
            _EVENT_MEM_COMPRESS,
            content,
            confidence_bps=8000,
            importance_bps=8500,
            metadata={
                "session_id": session_id,
                "task_id": task_id or "",
                "platform": platform,
                "model": model,
                "finish_reason": finish_reason,
                "api_call_count": api_call_count,
                "api_duration": api_duration,
                "message_count": message_count,
                "compress_event_n": compress_count,
            },
        )
    except Exception as exc:
        logger.warning("CongChain adapter post_api_request: %s", exc)


def post_llm_call(
    *,
    session_id: str = "",
    user_message: str = "",
    assistant_response: str = "",
    conversation_history: list = None,
    model: str = "",
    platform: str = "",
    **_: Any,
) -> None:
    if not session_id or not _is_configured():
        return
    try:
        state = _get_session(session_id)
        if state is None:
            return
        with _LOCK:
            if model and not state.model:
                state.model = model

        if not assistant_response or not _flag("CONGCHAIN_ADAPTER_ANCHOR_SAFETY"):
            return
        lower = assistant_response.lower()[:400]
        refusal = any(phrase in lower for phrase in (
            "i cannot",
            "i can't",
            "i am unable",
            "i'm unable",
            "i won't",
            "i will not",
            "nao posso",
            "não posso",
            "nao consigo",
            "não consigo",
            "nao vou",
            "não vou",
        ))
        if not refusal:
            return

        with _LOCK:
            state.safety_blocks += 1
        content = "\n".join([
            "[onSafetyBlock - Model Refusal]",
            f"Session: {session_id}",
            f"Model: {model or 'unknown'}",
            f"Prompt: {_redact(user_message, 220)}",
            f"Response start: {_redact(assistant_response, 320)}",
        ])
        _anchor(
            _EVENT_SAFETY_BLOCK,
            content,
            confidence_bps=8500,
            importance_bps=9000,
            metadata={
                "session_id": session_id,
                "model": model,
                "platform": platform,
                "refusal_type": "model_response",
            },
        )
    except Exception as exc:
        logger.warning("CongChain adapter post_llm_call: %s", exc)


def _build_task_complete_content(state: _Session, completed: bool) -> str:
    duration_s = round(time.time() - state.started_at, 1)
    tool_lines = []
    for tool_call in state.tool_calls[:15]:
        status = "ERROR" if tool_call.get("error") else "OK"
        duration = f"{tool_call['duration_ms']:.0f}ms" if tool_call.get("duration_ms") else "?"
        tool_lines.append(f"  {status} {tool_call['tool']} ({duration})")
    tool_summary = "\n".join(tool_lines) or "  (none)"
    status_text = "COMPLETE" if completed else "INTERRUPTED"

    return "\n".join([
        "[onTaskComplete]",
        f"Session: {state.session_id}",
        f"Status: {status_text}",
        f"Model: {state.model or 'unknown'}",
        f"Platform: {state.platform or 'unknown'}",
        f"Duration: {duration_s}s",
        f"LLM calls: {state.llm_calls}",
        f"Tool calls ({len(state.tool_calls)}):",
        tool_summary,
        f"Context compressions: {state.compress_events}",
        f"Safety blocks: {state.safety_blocks}",
        f"Hashes saved in this session: {len(state.anchored_hashes)}",
    ])


def on_session_end(
    *,
    session_id: str = "",
    completed: bool = True,
    interrupted: bool = False,
    model: str = "",
    platform: str = "",
    **_: Any,
) -> None:
    if not session_id or not _is_configured():
        return
    if not _flag("CONGCHAIN_ADAPTER_ANCHOR_TASK_COMPLETE"):
        return
    try:
        state = _get_session(session_id)
        if state is None:
            return
        tool_count = len(state.tool_calls)
        if tool_count < _min_tools() and state.llm_calls < 2:
            _debug("short session skipped: %s", session_id[:12])
            return

        finished = completed and not interrupted
        content = _build_task_complete_content(state, finished)
        confidence = 9000 if finished else 7500
        _anchor(
            _EVENT_TASK_COMPLETE,
            content,
            confidence_bps=confidence,
            importance_bps=min(confidence + 500, 10000),
            metadata={
                "session_id": session_id,
                "model": state.model or model,
                "platform": state.platform or platform,
                "completed": completed,
                "interrupted": interrupted,
                "tool_count": tool_count,
                "llm_calls": state.llm_calls,
                "compress_events": state.compress_events,
                "safety_blocks": state.safety_blocks,
                "duration_s": round(time.time() - state.started_at, 1),
            },
        )
    except Exception as exc:
        logger.warning("CongChain adapter on_session_end: %s", exc)


def on_session_finalize(*, session_id: str = "", **_: Any) -> None:
    if not session_id:
        return
    try:
        with _LOCK:
            _SESSIONS.pop(session_id, None)
    except Exception as exc:
        logger.warning("CongChain adapter on_session_finalize: %s", exc)


def register(ctx) -> None:
    if not _is_configured():
        logger.debug("CongChain adapter disabled: CONGCHAIN_API_KEY is not configured.")
        return

    ctx.register_hook("on_session_start", on_session_start)
    ctx.register_hook("on_session_end", on_session_end)
    ctx.register_hook("on_session_finalize", on_session_finalize)
    ctx.register_hook("pre_llm_call", pre_llm_call)
    ctx.register_hook("post_llm_call", post_llm_call)
    ctx.register_hook("pre_tool_call", pre_tool_call)
    ctx.register_hook("post_tool_call", post_tool_call)
    ctx.register_hook("post_api_request", post_api_request)

    logger.info(
        "CongChain Adapter active for Mythos runtime. agent_id=%s events=%s",
        _agent_id(),
        "TaskStart SkillSelected ToolCall ToolResult MemCompress TaskComplete SafetyBlock",
    )
