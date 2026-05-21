"""Install the CongChain Mythos integration pack into a real Mythos runtime.

The installer is intentionally stdlib-only. It copies the CongChain adapter and
skills into MYTHOS_HOME, enables the adapter in config.yaml, and can verify the
real Mythos plugin manager when a runtime path is provided.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


PACK_ROOT = Path(__file__).resolve().parents[1]
PLUGIN_KEYS = (
    "congchain-adapter",
    "observability/congchain",
    "interpretability/congchain-cna",
    "context_engine/congchain",
)


def mythos_home(raw: str | None = None) -> Path:
    if raw:
        return Path(raw).expanduser().resolve()
    env_home = os.environ.get("MYTHOS_HOME", "").strip()
    if env_home:
        return Path(env_home).expanduser().resolve()
    return (Path.home() / ".mythos").resolve()


def copy_tree(src: Path, dst: Path) -> None:
    if not src.exists():
        raise FileNotFoundError(f"Missing source path: {src}")
    if dst.exists():
        shutil.rmtree(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dst)


def install_files(home: Path, *, include_optional_plugins: bool = True) -> list[str]:
    installed: list[str] = []

    copy_tree(
        PACK_ROOT / "plugins" / "congchain-adapter",
        home / "plugins" / "congchain-adapter",
    )
    installed.append("plugins/congchain-adapter")

    copy_tree(
        PACK_ROOT / "optional-skills" / "blockchain" / "congchain",
        home / "skills" / "blockchain" / "congchain",
    )
    installed.append("skills/blockchain/congchain")

    copy_tree(
        PACK_ROOT / "skills" / "software-development" / "congchain-forge",
        home / "skills" / "software-development" / "congchain-forge",
    )
    installed.append("skills/software-development/congchain-forge")

    if include_optional_plugins:
        copy_tree(
            PACK_ROOT / "plugins" / "observability" / "congchain",
            home / "plugins" / "observability" / "congchain",
        )
        installed.append("plugins/observability/congchain")

        copy_tree(
            PACK_ROOT / "plugins" / "interpretability" / "congchain-cna",
            home / "plugins" / "interpretability" / "congchain-cna",
        )
        installed.append("plugins/interpretability/congchain-cna")

        copy_tree(
            PACK_ROOT / "plugins" / "context_engine" / "congchain",
            home / "plugins" / "context_engine" / "congchain",
        )
        installed.append("plugins/context_engine/congchain")

    return installed


def _find_enabled_block(lines: list[str]) -> tuple[int, int] | None:
    for index, line in enumerate(lines):
        if line.strip() != "enabled:":
            continue
        indent = len(line) - len(line.lstrip(" "))
        parent_index = index - 1
        while parent_index >= 0 and not lines[parent_index].strip():
            parent_index -= 1
        if parent_index < 0 or lines[parent_index].strip() != "plugins:":
            continue
        end = index + 1
        while end < len(lines):
            stripped = lines[end].strip()
            current_indent = len(lines[end]) - len(lines[end].lstrip(" "))
            if stripped and current_indent <= indent:
                break
            end += 1
        return index, end
    return None


def _enabled_values(lines: list[str], block: tuple[int, int]) -> set[str]:
    values: set[str] = set()
    for line in lines[block[0] + 1 : block[1]]:
        stripped = line.strip()
        if stripped.startswith("- "):
            values.add(stripped[2:].strip().strip("\"'"))
    return values


def update_config(
    home: Path,
    *,
    enable_optional_plugins: bool = True,
    enable_context_engine: bool = True,
) -> Path:
    config_path = home / "config.yaml"
    home.mkdir(parents=True, exist_ok=True)
    lines = config_path.read_text(encoding="utf-8").splitlines() if config_path.exists() else []

    desired = ["congchain-adapter"]
    if enable_optional_plugins:
        desired.extend(["observability/congchain", "interpretability/congchain-cna"])
    if enable_context_engine:
        desired.append("context_engine/congchain")

    block = _find_enabled_block(lines)
    if block is None:
        if lines and lines[-1].strip():
            lines.append("")
        lines.extend(["plugins:", "  enabled:"])
        block = (len(lines) - 1, len(lines))

    existing = _enabled_values(lines, block)
    additions = [key for key in desired if key not in existing]
    if additions:
        insert_at = block[1]
        lines[insert_at:insert_at] = [f"    - {key}" for key in additions]

    if enable_context_engine and not any(line.strip() == "engine: congchain" for line in lines):
        if lines and lines[-1].strip():
            lines.append("")
        lines.extend(["context:", "  engine: congchain"])

    config_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    return config_path


def write_env_hint(home: Path, *, api_url: str | None, agent_id: str | None, api_key: str | None) -> Path:
    env_path = home / ".env"
    existing = env_path.read_text(encoding="utf-8").splitlines() if env_path.exists() else []
    keys = {line.split("=", 1)[0].strip() for line in existing if "=" in line}
    additions: list[str] = []

    if api_url and "CONGCHAIN_API_URL" not in keys:
        additions.append(f"CONGCHAIN_API_URL={api_url}")
    if agent_id and "CONGCHAIN_AGENT_ID" not in keys:
        additions.append(f"CONGCHAIN_AGENT_ID={agent_id}")
    if api_key and "CONGCHAIN_API_KEY" not in keys:
        additions.append(f"CONGCHAIN_API_KEY={api_key}")

    if additions:
        if existing and existing[-1].strip():
            existing.append("")
        existing.extend(additions)
        env_path.write_text("\n".join(existing).rstrip() + "\n", encoding="utf-8")
    return env_path


def _write_yaml_contract_shim(directory: Path) -> None:
    """Write a tiny YAML shim for dependency-light plugin contract checks.

    This is not a replacement for PyYAML in a real Mythos install. It only
    understands the simple config.yaml/plugin.yaml fields needed by this
    installer verification.
    """
    (directory / "yaml.py").write_text(
        "\n".join(
            [
                "def safe_load(stream):",
                "    text = stream.read() if hasattr(stream, 'read') else str(stream or '')",
                "    lines = text.splitlines()",
                "    if 'enabled:' in text and 'congchain-adapter' in text:",
                "        enabled = []",
                "        for line in lines:",
                "            stripped = line.strip()",
                "            if stripped.startswith('- '):",
                "                enabled.append(stripped[2:].strip())",
                "        return {'plugins': {'enabled': enabled}}",
                "    data = {}",
                "    for line in lines:",
                "        if ':' in line and not line.startswith(' ') and not line.strip().startswith('-'):",
                "            key, value = line.split(':', 1)",
                "            value = value.strip().strip(chr(34)).strip(chr(39))",
                "            if value:",
                "                data[key.strip()] = value",
                "    hooks = []",
                "    requires = []",
                "    target = None",
                "    for raw in lines:",
                "        line = raw.rstrip()",
                "        if line.startswith('hooks:'):",
                "            target = hooks",
                "        elif line.startswith('requires_env:'):",
                "            target = requires",
                "        elif line.strip().startswith('- ') and target is not None:",
                "            target.append(line.strip()[2:].strip())",
                "        elif line and not line.startswith(' ') and not line.strip().startswith('-'):",
                "            if not line.startswith(('hooks:', 'requires_env:')):",
                "                target = None",
                "    if hooks:",
                "        data['hooks'] = hooks; data['provides_hooks'] = hooks",
                "    if requires:",
                "        data['requires_env'] = requires",
                "    return data",
            ]
        )
        + "\n",
        encoding="utf-8",
    )


def verify_runtime(
    runtime_path: Path,
    home: Path,
    *,
    allow_yaml_shim: bool = False,
) -> subprocess.CompletedProcess[str]:
    code = (
        "from mythos_cli.plugins import discover_plugins, get_plugin_manager; "
        "discover_plugins(force=True); "
        "m=get_plugin_manager(); "
        "plugins=m.list_plugins(); "
        "target=[p for p in plugins if p.get('key')=='congchain-adapter']; "
        "hooks=sorted([k for k,v in m._hooks.items() if v]); "
        "print({'plugin': target, 'hooks': hooks}); "
        "raise SystemExit(0 if target and target[0].get('enabled') and "
        "'pre_tool_call' in hooks and 'post_tool_call' in hooks else 2)"
    )
    env = os.environ.copy()
    env["MYTHOS_HOME"] = str(home)
    env.setdefault("CONGCHAIN_API_KEY", "cog_live_runtime_contract_only")

    shim_dir: tempfile.TemporaryDirectory[str] | None = None
    try:
        python_path_parts = [str(runtime_path)]
        if allow_yaml_shim:
            shim_dir = tempfile.TemporaryDirectory()
            shim_path = Path(shim_dir.name)
            _write_yaml_contract_shim(shim_path)
            python_path_parts.insert(0, str(shim_path))
        env["PYTHONPATH"] = os.pathsep.join(python_path_parts)
        return subprocess.run(
            [sys.executable, "-c", code],
            text=True,
            capture_output=True,
            env=env,
            check=False,
        )
    finally:
        if shim_dir is not None:
            shim_dir.cleanup()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Install CongChain into Mythos Agent.")
    parser.add_argument("--mythos-home", help="Target Mythos home. Defaults to MYTHOS_HOME or ~/.mythos.")
    parser.add_argument("--runtime-path", help="Optional Mythos runtime root for plugin-manager verification.")
    parser.add_argument("--api-url", default="https://cognchain-program-production.up.railway.app")
    parser.add_argument("--agent-id", default="mythos-local")
    parser.add_argument("--api-key", help="Optional local CONGCHAIN_API_KEY to append to MYTHOS_HOME/.env.")
    parser.add_argument("--core-only", action="store_true", help="Install only adapter and skills, not optional plugins.")
    parser.add_argument("--no-context-engine", action="store_true", help="Do not set context.engine=congchain.")
    parser.add_argument(
        "--allow-yaml-shim",
        action="store_true",
        help="For local contract checks only: verify plugin loading even when PyYAML is not installed.",
    )
    args = parser.parse_args(argv)

    home = mythos_home(args.mythos_home)
    installed = install_files(home, include_optional_plugins=not args.core_only)
    config_path = update_config(
        home,
        enable_optional_plugins=not args.core_only,
        enable_context_engine=not args.no_context_engine,
    )
    env_path = write_env_hint(home, api_url=args.api_url, agent_id=args.agent_id, api_key=args.api_key)

    print(f"Installed CongChain Mythos pack into {home}")
    for item in installed:
        print(f"- {item}")
    print(f"Updated config: {config_path}")
    print(f"Env file: {env_path}")
    if not args.api_key:
        print("Set CONGCHAIN_API_KEY in the Mythos environment before live writes.")

    if args.runtime_path:
        result = verify_runtime(
            Path(args.runtime_path).expanduser().resolve(),
            home,
            allow_yaml_shim=args.allow_yaml_shim,
        )
        if result.stdout.strip():
            print(result.stdout.strip())
        if result.stderr.strip():
            print(result.stderr.strip(), file=sys.stderr)
        if result.returncode != 0:
            print("Runtime verification failed.", file=sys.stderr)
            return result.returncode
        print("Runtime verification passed: congchain-adapter enabled and hooks registered.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
