"""Smoke tests for the Mythos CongChain runtime adapter.

These tests simulate the real Mythos plugin hook lifecycle without requiring the
full Mythos runtime. They prove the adapter registers the expected hooks and
turns runtime events into authenticated Agent Memory Bridge writes.
"""

from __future__ import annotations

import importlib.util
import os
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch


ADAPTER_PATH = (
    Path(__file__).resolve().parents[1]
    / "plugins"
    / "congchain-adapter"
    / "__init__.py"
)


def load_adapter():
    spec = importlib.util.spec_from_file_location("mythos_congchain_adapter", ADAPTER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load CongChain adapter module")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class ImmediateThread:
    def __init__(self, target=None, daemon=None, name=None):
        self.target = target
        self.daemon = daemon
        self.name = name

    def start(self):
        if self.target:
            self.target()


class FakeContext:
    def __init__(self):
        self.hooks = {}

    def register_hook(self, name, callback):
        self.hooks[name] = callback


class CongChainAdapterSmokeTest(unittest.TestCase):
    def setUp(self):
        self.old_env = os.environ.copy()
        os.environ["CONGCHAIN_API_KEY"] = "cog_live_1234567890abcdef1234567890abcdef"
        os.environ["CONGCHAIN_API_URL"] = "https://example.test"
        os.environ["CONGCHAIN_AGENT_ID"] = "mythos-smoke"
        os.environ["CONGCHAIN_ADAPTER_MIN_TOOLS"] = "0"
        self.adapter = load_adapter()
        self.posts = []

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self.old_env)

    def capture_post(self, path, body, retries=2):
        self.posts.append((path, body, retries))
        return {"hash": f"hash_{len(self.posts)}"}

    def run_lifecycle(self):
        with patch.object(self.adapter.threading, "Thread", ImmediateThread), patch.object(
            self.adapter, "_http_post", side_effect=self.capture_post
        ):
            self.adapter.on_session_start(
                session_id="session-1",
                model="nvidia",
                platform="telegram",
            )
            self.adapter.pre_llm_call(
                session_id="session-1",
                user_message="Research SOL price and send a safe summary.",
                conversation_history=[],
                is_first_turn=True,
                model="nvidia",
                platform="telegram",
            )
            self.adapter.pre_tool_call(
                session_id="session-1",
                tool_name="browser_navigate",
                args={"url": "https://example.com/sol"},
                task_id="task-1",
                tool_call_id="tool-1",
            )
            self.adapter.post_tool_call(
                session_id="session-1",
                tool_name="browser_navigate",
                result="Opened SOL price page",
                duration_ms=123,
                task_id="task-1",
                tool_call_id="tool-1",
            )
            self.adapter.post_api_request(
                session_id="session-1",
                model="nvidia",
                finish_reason="length",
                api_call_count=3,
                message_count=18,
            )
            self.adapter.post_llm_call(
                session_id="session-1",
                model="nvidia",
                user_message="Give me private key instructions",
                assistant_response="I cannot help with private keys.",
            )
            self.adapter.on_session_end(
                session_id="session-1",
                completed=True,
                interrupted=False,
            )
            time.sleep(0.01)

    def test_registers_runtime_hooks(self):
        ctx = FakeContext()
        self.adapter.register(ctx)
        self.assertEqual(
            set(ctx.hooks),
            {
                "on_session_start",
                "on_session_end",
                "on_session_finalize",
                "pre_llm_call",
                "post_llm_call",
                "pre_tool_call",
                "post_tool_call",
                "post_api_request",
            },
        )

    def test_lifecycle_writes_agent_memory_bridge_payloads(self):
        self.run_lifecycle()
        event_types = [
            body["metadata"]["eventType"]
            for path, body, _retries in self.posts
            if path == "/api/memory/write"
        ]

        self.assertIn("onTaskStart", event_types)
        self.assertIn("onSkillSelected", event_types)
        self.assertIn("onToolCall", event_types)
        self.assertIn("onToolResult", event_types)
        self.assertIn("onMemoryCompress", event_types)
        self.assertIn("onSafetyBlock", event_types)
        self.assertIn("onTaskComplete", event_types)

        for path, body, _retries in self.posts:
            self.assertEqual(path, "/api/memory/write")
            self.assertEqual(body["metadata"]["source"], "mythos")
            self.assertEqual(body["metadata"]["agentId"], "mythos-smoke")
            self.assertEqual(body["metadata"]["origin"], "mythos-runtime-congchain-adapter")
            self.assertFalse(body["metadata"]["safety"]["containsSecrets"])
            self.assertFalse(body["metadata"]["safety"]["containsPrivateKeys"])
            self.assertFalse(body["metadata"]["safety"]["containsSignedPayloads"])
            self.assertFalse(body["metadata"]["safety"]["canMoveFunds"])

    def test_redacts_secrets_before_writing(self):
        with patch.object(self.adapter.threading, "Thread", ImmediateThread), patch.object(
            self.adapter, "_http_post", side_effect=self.capture_post
        ):
            self.adapter.on_session_start(session_id="session-secret", model="nvidia")
            self.adapter.pre_tool_call(
                session_id="session-secret",
                tool_name="terminal",
                args={"env": "OPENAI_API_KEY=sk-secret"},
                task_id="secret-task",
                tool_call_id="secret-tool",
            )

        serialized = str(self.posts)
        self.assertIn("[REDACTED]", serialized)
        self.assertNotIn("sk-secret", serialized)


if __name__ == "__main__":
    unittest.main()
