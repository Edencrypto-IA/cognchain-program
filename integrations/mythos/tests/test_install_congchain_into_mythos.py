"""Tests for the CongChain Mythos installer."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from integrations.mythos.scripts.install_congchain_into_mythos import (
    PACK_ROOT,
    install_files,
    update_config,
    write_env_hint,
)


class CongChainMythosInstallerTest(unittest.TestCase):
    def test_installs_adapter_skills_and_optional_plugins(self):
        with tempfile.TemporaryDirectory() as raw:
            home = Path(raw)

            installed = install_files(home)
            update_config(home)

            self.assertIn("plugins/congchain-adapter", installed)
            self.assertTrue((home / "plugins" / "congchain-adapter" / "__init__.py").exists())
            self.assertTrue((home / "plugins" / "observability" / "congchain" / "__init__.py").exists())
            self.assertTrue((home / "plugins" / "interpretability" / "congchain-cna" / "__init__.py").exists())
            self.assertTrue((home / "plugins" / "context_engine" / "congchain" / "__init__.py").exists())
            self.assertTrue((home / "skills" / "blockchain" / "congchain" / "SKILL.md").exists())
            self.assertTrue(
                (home / "skills" / "software-development" / "congchain-forge" / "SKILL.md").exists()
            )
            self.assertTrue((home / "skills" / "congchain" / "session-audit" / "SKILL.md").exists())
            self.assertTrue(
                (home / "skills" / "congchain" / "solana-wallet-ecosystem-bridge" / "SKILL.md").exists()
            )

            config = (home / "config.yaml").read_text(encoding="utf-8")
            self.assertIn("- congchain-adapter", config)
            self.assertIn("- nvidia-router", config)
            self.assertIn("- observability/congchain", config)
            self.assertIn("- interpretability/congchain-cna", config)
            self.assertIn("- context_engine/congchain", config)
            self.assertIn("engine: congchain", config)

    def test_config_update_preserves_existing_enabled_plugins(self):
        with tempfile.TemporaryDirectory() as raw:
            home = Path(raw)
            home.mkdir(parents=True, exist_ok=True)
            (home / "config.yaml").write_text(
                "model: nvidia\n\nplugins:\n  enabled:\n    - observability/langfuse\n",
                encoding="utf-8",
            )

            update_config(home)
            config = (home / "config.yaml").read_text(encoding="utf-8")

            self.assertIn("model: nvidia", config)
            self.assertIn("- observability/langfuse", config)
            self.assertIn("- congchain-adapter", config)
            self.assertIn("- nvidia-router", config)
            self.assertEqual(config.count("- congchain-adapter"), 1)

    def test_config_update_removes_legacy_malformed_plugin_list(self):
        with tempfile.TemporaryDirectory() as raw:
            home = Path(raw)
            home.mkdir(parents=True, exist_ok=True)
            (home / "config.yaml").write_text(
                "plugins:\n"
                "  enabled:\n"
                "    - congchain-adapter\n"
                "  - congchain-adapter\n"
                "  - observability/congchain\n"
                "session_reset:\n"
                "  mode: both\n",
                encoding="utf-8",
            )

            update_config(home)
            config = (home / "config.yaml").read_text(encoding="utf-8")

            self.assertIn("plugins:\n  enabled:\n    - congchain-adapter", config)
            self.assertNotIn("  - observability/congchain\nsession_reset", config)
            self.assertIn("session_reset:\n  mode: both", config)

    def test_env_hint_does_not_require_api_key(self):
        with tempfile.TemporaryDirectory() as raw:
            home = Path(raw)

            env_path = write_env_hint(
                home,
                api_url="https://example.test",
                agent_id="mythos-ci",
                api_key=None,
            )
            content = env_path.read_text(encoding="utf-8")

            self.assertIn("CONGCHAIN_API_URL=https://example.test", content)
            self.assertIn("CONGCHAIN_AGENT_ID=mythos-ci", content)
            self.assertNotIn("CONGCHAIN_API_KEY", content)

    def test_pack_root_points_to_integration_pack(self):
        self.assertTrue((PACK_ROOT / "plugins" / "congchain-adapter" / "plugin.yaml").exists())
        self.assertTrue((PACK_ROOT / "plugins" / "nvidia-router" / "plugin.yaml").exists())


if __name__ == "__main__":
    unittest.main()
