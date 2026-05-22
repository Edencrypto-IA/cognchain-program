"""Tests for the Mythos NVIDIA Router v1 recommendation plugin."""

from __future__ import annotations

import importlib.util
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROUTER_PATH = (
    Path(__file__).resolve().parents[1]
    / "plugins"
    / "nvidia-router"
    / "__init__.py"
)


def load_router():
    spec = importlib.util.spec_from_file_location("mythos_nvidia_router", ROUTER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load NVIDIA router module")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class FakeContext:
    def __init__(self):
        self.hooks = {}
        self.tools = {}

    def register_hook(self, name, callback):
        self.hooks[name] = callback

    def register_tool(self, *, schema, handler):
        self.tools[schema["name"]] = handler


class NvidiaRouterTest(unittest.TestCase):
    def setUp(self):
        self.old_env = os.environ.copy()
        os.environ.pop("NVIDIA_ROUTER_DEFAULT_MODEL", None)
        os.environ["NVIDIA_ROUTER_RECORD_CONGCHAIN"] = "false"
        self.router = load_router()

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self.old_env)

    def test_recommends_code_model_without_secret_requirements(self):
        recommendation = self.router.recommend_model("debug this Python API and add pytest coverage")

        self.assertEqual(recommendation["category"], "code")
        self.assertEqual(recommendation["recommendedModel"], "deepseek-ai/deepseek-v4-pro")
        self.assertFalse(recommendation["safeContract"]["doesSwitchModel"])
        self.assertFalse(recommendation["safeContract"]["doesExposeApiKeys"])

    def test_pre_llm_call_injects_context_not_model_override(self):
        result = self.router.pre_llm_call(
            session_id="session-1",
            user_message="Analise este repositório inteiro e explique os riscos.",
            model="nvidia/nemotron-3-super-120b-a12b",
            is_first_turn=True,
        )

        self.assertIsInstance(result, dict)
        self.assertIn("context", result)
        self.assertIn("recommendation only", result["context"])
        self.assertNotIn("model_override", result)
        self.assertNotIn("api_key_override", result)
        self.assertNotIn("base_url_override", result)

    def test_registers_supported_hooks_and_info_tool(self):
        ctx = FakeContext()
        self.router.register(ctx)

        self.assertEqual(set(ctx.hooks), {"on_session_start", "pre_llm_call", "on_session_end"})
        self.assertIn("nvidia_router_info", ctx.tools)

    def test_optional_congchain_record_is_metadata_only(self):
        os.environ["NVIDIA_ROUTER_RECORD_CONGCHAIN"] = "true"
        os.environ["CONGCHAIN_API_URL"] = "https://example.test"
        os.environ["CONGCHAIN_API_KEY"] = "cog_live_1234567890abcdef"
        captured = {}

        class FakeResponse:
            def read(self):
                return b'{"ok":true}'

        def fake_urlopen(request, timeout=8):
            captured["request"] = request
            captured["body"] = request.data.decode("utf-8")
            captured["timeout"] = timeout
            return FakeResponse()

        with patch.object(self.router.urllib.request, "urlopen", side_effect=fake_urlopen):
            self.router.pre_llm_call(
                session_id="session-1",
                user_message="Use cog_live_secret and debug this repo",
                model="nvidia",
                is_first_turn=True,
            )

        self.assertIn("nvidiaRouterRecommendation", captured["body"])
        self.assertIn("[REDACTED]", captured["body"])
        self.assertNotIn("cog_live_secret", captured["body"])
        self.assertIn('"claimsOnChainAnchor": false', captured["body"])


if __name__ == "__main__":
    unittest.main()
