"""NVIDIA Router v1 for Mythos.

This plugin is intentionally a recommender, not an automatic model switcher.
The current Mythos ``pre_llm_call`` contract safely supports context injection,
so v1 returns ``{"context": ...}`` with a routing recommendation. It does not
return model_override/api_key_override/base_url_override fields.

If CongChain credentials are present, v1 can record the recommendation as
metadata-only memory. It does not claim on-chain anchoring; anchoring belongs to
the explicit blockchain endpoint flow.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

REASONING = "reasoning"
CODE = "code"
LONG_CONTEXT = "long_context"
FAST = "fast"
MULTILINGUAL = "multilingual"
CREATIVE = "creative"
GENERAL = "general"

_DEFAULT_AGENT_ID = "mythos-local"
_SESSION_ROUTES: dict[str, str] = {}


@dataclass(frozen=True)
class Route:
    category: str
    primary: str
    fallback: str
    purpose: str
    signals: tuple[str, ...]


ROUTES: dict[str, Route] = {
    GENERAL: Route(
        GENERAL,
        "nvidia/nemotron-3-super-120b-a12b",
        "meta/llama-3.3-70b-instruct",
        "default agent loop, tool use, and mixed tasks",
        ("general agent loop", "tool use", "mixed task"),
    ),
    REASONING: Route(
        REASONING,
        "openai/gpt-oss-120b",
        "nvidia/nemotron-3-super-120b-a12b",
        "heavy reasoning, architecture tradeoffs, math, and deep analysis",
        ("reasoning", "math", "architecture", "tradeoff"),
    ),
    CODE: Route(
        CODE,
        "deepseek-ai/deepseek-v4-pro",
        "qwen/qwen3.5-122b-a10b",
        "code, debugging, tests, APIs, pull requests, and DevOps",
        ("code", "debug", "tests", "api", "repo"),
    ),
    LONG_CONTEXT: Route(
        LONG_CONTEXT,
        "moonshotai/kimi-k2.6",
        "qwen/qwen3.5-122b-a10b",
        "long documents, repository review, transcripts, and large context",
        ("long context", "repository", "document", "transcript"),
    ),
    FAST: Route(
        FAST,
        "microsoft/phi-4-mini-instruct",
        "google/gemma-3n-e2b-it",
        "simple answers, formatting, extraction, and low-latency checks",
        ("quick", "format", "extract", "simple"),
    ),
    MULTILINGUAL: Route(
        MULTILINGUAL,
        "z-ai/glm-5.1",
        "meta/llama-3.3-70b-instruct",
        "Portuguese, translation, and multilingual user communication",
        ("portuguese", "translation", "multilingual"),
    ),
    CREATIVE: Route(
        CREATIVE,
        "google/gemma-4-31b-it",
        "mistralai/mistral-large-3-675b-instruct-2512",
        "creative writing, content, brainstorming, and marketing copy",
        ("creative", "content", "story", "copywriting"),
    ),
}

_SIGNALS: tuple[tuple[re.Pattern[str], int, str], ...] = (
    (
        re.compile(
            r"\b(code|codigo|c[oó]digo|debug|bug|stack trace|refactor|"
            r"typescript|javascript|python|rust|go|java|api|graphql|rest|"
            r"test|pytest|jest|docker|deploy|pull request|commit)\b",
            re.I,
        ),
        3,
        CODE,
    ),
    (
        re.compile(
            r"\b(reason|racioc[ií]nio|math|matem[aá]tica|prove|calcule|"
            r"architecture|arquitetura|trade[- ]?off|strategy|estrat[eé]gia|"
            r"deep analysis|an[aá]lise profunda|why|por que|explique)\b",
            re.I,
        ),
        2,
        REASONING,
    ),
    (
        re.compile(
            r"\b(long context|contexto longo|repository|repo|codebase|"
            r"documento longo|pdf|transcript|transcri[cç][aã]o|"
            r"todos os arquivos|projeto inteiro|leia tudo)\b",
            re.I,
        ),
        3,
        LONG_CONTEXT,
    ),
    (
        re.compile(
            r"\b(quick|r[aá]pido|simples|simple|format|formate|extract|"
            r"extraia|classifique|yes|no|true|false|apenas|somente)\b",
            re.I,
        ),
        2,
        FAST,
    ),
    (
        re.compile(
            r"\b(translate|tradu[zç][aã]o?|portugu[eê]s|english|spanish|"
            r"espanhol|fran[cç][eê]s|multilingual|idioma|language)\b",
            re.I,
        ),
        3,
        MULTILINGUAL,
    ),
    (
        re.compile(
            r"\b(create|creative|criativo|conte[uú]do|content|story|"
            r"hist[oó]ria|post|tweet|copy|copywriting|marketing|"
            r"brainstorm|slogan|roteiro)\b",
            re.I,
        ),
        2,
        CREATIVE,
    ),
)


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _flag(name: str, default: bool = True) -> bool:
    value = _env(name).lower()
    if value in {"0", "false", "no", "off"}:
        return False
    if value in {"1", "true", "yes", "on"}:
        return True
    return default


def classify_task(text: str) -> tuple[str, dict[str, int]]:
    """Return the recommended route category and non-zero scores."""
    scores = {key: 0 for key in ROUTES}
    normalized = text or ""
    if len(normalized.strip()) < 5:
        return FAST, {}

    for pattern, weight, category in _SIGNALS:
        matches = pattern.findall(normalized)
        if matches:
            scores[category] += weight * len(matches)

    word_count = len(normalized.split())
    if word_count > 500:
        scores[LONG_CONTEXT] += 3
    elif word_count > 200:
        scores[LONG_CONTEXT] += 1
    if "```" in normalized or "\n    " in normalized or "\n\t" in normalized:
        scores[CODE] += 4

    best_score = max(scores.values())
    if best_score <= 0:
        return GENERAL, {}
    best = max(scores, key=lambda key: scores[key])
    return best, {key: value for key, value in scores.items() if value > 0}


def recommend_model(task: str) -> dict[str, Any]:
    category, scores = classify_task(task)
    route = ROUTES.get(category, ROUTES[GENERAL])
    return {
        "category": route.category,
        "recommendedModel": _env("NVIDIA_ROUTER_DEFAULT_MODEL") or route.primary,
        "fallbackModel": route.fallback,
        "purpose": route.purpose,
        "signals": list(route.signals),
        "scores": scores,
        "runtimeMode": "recommendation_only",
        "safeContract": {
            "doesSwitchModel": False,
            "doesExposeApiKeys": False,
            "doesMoveFunds": False,
            "claimsOnChainAnchor": False,
        },
    }


def _preview(text: str, limit: int = 320) -> str:
    clean = re.sub(r"(cog_live_[A-Za-z0-9_=-]+|sk-[A-Za-z0-9_-]+)", "[REDACTED]", text or "")
    return clean[:limit]


def _fingerprint(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def _congchain_configured() -> bool:
    return bool(_env("CONGCHAIN_API_URL") and _env("CONGCHAIN_API_KEY"))


def _record_congchain(recommendation: dict[str, Any], *, session_id: str, model: str, task: str) -> None:
    if not _flag("NVIDIA_ROUTER_RECORD_CONGCHAIN", True):
        return
    if not _congchain_configured():
        return

    api_url = _env("CONGCHAIN_API_URL").rstrip("/")
    api_key = _env("CONGCHAIN_API_KEY")
    body = {
        "content": "\n".join(
            [
                "[nvidia-router]",
                f"Session: {session_id or 'unknown'}",
                f"Current model: {model or 'unknown'}",
                f"Recommended model: {recommendation['recommendedModel']}",
                f"Category: {recommendation['category']}",
                f"Task fingerprint: {_fingerprint(task)}",
                f"Task preview: {_preview(task)}",
                "Mode: recommendation_only",
            ]
        ),
        "model": "mythos",
        "metadata": {
            "source": "mythos",
            "agentName": "Mythos",
            "agentId": _env("CONGCHAIN_AGENT_ID", _DEFAULT_AGENT_ID),
            "contentType": "mythos_skill",
            "eventType": "nvidiaRouterRecommendation",
            "origin": "mythos-nvidia-router-v1",
            "namespace": "mythos",
            "category": recommendation["category"],
            "recommendedModel": recommendation["recommendedModel"],
            "fallbackModel": recommendation["fallbackModel"],
            "runtimeMode": "recommendation_only",
            "taskFingerprint": _fingerprint(task),
            "timestamp": int(time.time()),
            "safety": {
                "containsSecrets": False,
                "containsPrivateKeys": False,
                "containsSignedPayloads": False,
                "canMoveFunds": False,
                "claimsOnChainAnchor": False,
            },
        },
        "importance": 0.62,
        "confidence": 0.78,
    }
    request = urllib.request.Request(
        f"{api_url}/api/memory/write",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "mythos-nvidia-router/1.0",
        },
    )
    try:
        urllib.request.urlopen(request, timeout=8).read()
    except (OSError, urllib.error.URLError, urllib.error.HTTPError) as exc:
        logger.warning("NVIDIA Router CongChain record failed: %s", exc)


def _context_text(recommendation: dict[str, Any]) -> str:
    scores = recommendation.get("scores") or {}
    score_text = ", ".join(f"{key}:{value}" for key, value in scores.items()) or "no strong signal"
    return "\n".join(
        [
            "NVIDIA Router v1 recommendation:",
            f"- Category: {recommendation['category']}",
            f"- Recommended model for a future supported switch: {recommendation['recommendedModel']}",
            f"- Fallback model: {recommendation['fallbackModel']}",
            f"- Why: {recommendation['purpose']}",
            f"- Scores: {score_text}",
            "- Contract: recommendation only. Do not claim the active Mythos model changed unless the runtime config actually changed.",
            "- CongChain wording: say registered/auditable/verifiable, not on-chain, unless an explicit blockchain anchor endpoint was called.",
        ]
    )


def on_session_start(*, session_id: str = "", **_: Any) -> None:
    if session_id:
        _SESSION_ROUTES[session_id] = GENERAL


def on_session_end(*, session_id: str = "", **_: Any) -> None:
    if session_id:
        _SESSION_ROUTES.pop(session_id, None)


def pre_llm_call(
    *,
    session_id: str = "",
    user_message: str = "",
    model: str = "",
    is_first_turn: bool = False,
    **_: Any,
) -> dict[str, str] | None:
    if not _flag("NVIDIA_ROUTER_ENABLED", True):
        return None
    if not user_message:
        return None

    recommendation = recommend_model(user_message)
    if session_id:
        _SESSION_ROUTES[session_id] = recommendation["category"]
    if is_first_turn or _flag("NVIDIA_ROUTER_RECORD_EVERY_CALL", False):
        _record_congchain(recommendation, session_id=session_id, model=model, task=user_message)

    if _flag("NVIDIA_ROUTER_DEBUG", False):
        logger.info("NVIDIA Router recommendation: %s", recommendation)
    return {"context": _context_text(recommendation)}


def _handle_router_info(args: dict[str, Any], **_: Any) -> str:
    task = str((args or {}).get("task") or "")
    if task:
        return json.dumps(recommend_model(task), indent=2, ensure_ascii=False)
    return json.dumps(
        {
            "mode": "recommendation_only",
            "routes": {key: route.__dict__ for key, route in ROUTES.items()},
            "sessions": dict(_SESSION_ROUTES),
        },
        indent=2,
        ensure_ascii=False,
    )


_ROUTER_INFO_SCHEMA = {
    "name": "nvidia_router_info",
    "description": "Explain which NVIDIA/OpenRouter-style model Mythos should use for a task. Does not switch models.",
    "parameters": {
        "type": "object",
        "properties": {
            "task": {
                "type": "string",
                "description": "Optional task text to classify.",
            }
        },
        "required": [],
    },
}


def register(ctx) -> None:
    if not _flag("NVIDIA_ROUTER_ENABLED", True):
        logger.info("NVIDIA Router disabled by NVIDIA_ROUTER_ENABLED=false")
        return
    ctx.register_hook("on_session_start", on_session_start)
    ctx.register_hook("pre_llm_call", pre_llm_call)
    ctx.register_hook("on_session_end", on_session_end)
    try:
        ctx.register_tool(schema=_ROUTER_INFO_SCHEMA, handler=_handle_router_info)
    except Exception:
        logger.debug("NVIDIA Router tool registration skipped", exc_info=True)
