#!/usr/bin/env python3
"""CognChain CLI — cliente stdlib para a API CognChain.

Uso:
    python3 congchain_client.py health
    python3 congchain_client.py write "Seu insight" --confidence 9000 --importance 8500
    python3 congchain_client.py read <hash>
    python3 congchain_client.py list --limit 10
    python3 congchain_client.py verify <hash>
    python3 congchain_client.py chain <hash1> <hash2>

Variáveis de ambiente:
    CONGCHAIN_API_URL       — URL base (padrão: https://cognchain-program-production.up.railway.app)
    CONGCHAIN_API_KEY       — API key cog_live_* criada em /dashboard/keys
    CONGCHAIN_AGENT_ID      — identificador opcional do Mythos local
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Optional

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
_DEFAULT_API_URL = "https://cognchain-program-production.up.railway.app"
_DEFAULT_AGENT_ID = "mythos-local"
_HTTP_TIMEOUT = 12
_RETRY_WAIT = 2


def _api_url() -> str:
    return os.environ.get("CONGCHAIN_API_URL", "").strip() or _DEFAULT_API_URL


def _api_key() -> str:
    return os.environ.get("CONGCHAIN_API_KEY", "").strip()


def _agent_id() -> str:
    return os.environ.get("CONGCHAIN_AGENT_ID", "").strip() or _DEFAULT_AGENT_ID


def _require_api_key() -> str:
    key = _api_key()
    if not key:
        _die("CONGCHAIN_API_KEY não definido. "
             "Crie uma key em /dashboard/keys e exporte: CONGCHAIN_API_KEY=cog_live_...")
    return key


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _request(method: str, path: str, body: Optional[dict] = None,
             *, retries: int = 2) -> dict:
    url = f"{_api_url().rstrip('/')}{path}"
    payload = json.dumps(body).encode() if body else None
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "mythos-congchain-client/1.1",
    }
    key = _api_key()
    if key:
        headers["Authorization"] = f"Bearer {key}"

    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=payload, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < retries:
                print(f"[rate limit] aguardando {_RETRY_WAIT}s...", file=sys.stderr)
                time.sleep(_RETRY_WAIT)
                continue
            body_text = ""
            try:
                body_text = exc.read().decode()[:300]
            except Exception:
                pass
            _die(f"HTTP {exc.code} em {url}: {body_text}")
        except urllib.error.URLError as exc:
            _die(f"Erro de conexão em {url}: {exc.reason}")
        except Exception as exc:
            _die(f"Erro inesperado: {exc}")
    _die("Máximo de tentativas atingido")


def _get(path: str) -> dict:
    return _request("GET", path)


def _post(path: str, body: dict) -> dict:
    return _request("POST", path, body)


def _die(msg: str) -> None:
    print(f"erro: {msg}", file=sys.stderr)
    sys.exit(1)


def _out(data: Any, *, as_json: bool = False) -> None:
    if as_json:
        print(json.dumps(data, indent=2, ensure_ascii=False, default=str))
    else:
        if isinstance(data, str):
            print(data)
        else:
            print(json.dumps(data, indent=2, ensure_ascii=False, default=str))


# ---------------------------------------------------------------------------
# Comandos
# ---------------------------------------------------------------------------

def cmd_health(args: argparse.Namespace) -> None:
    result = _get("/api/memory/health")
    if args.json:
        _out(result, as_json=True)
        return
    status = result.get("status", "?")
    cluster = result.get("cluster", result.get("network", "?"))
    program = result.get("program_id", result.get("programId", "?"))
    print(f"status:     {status}")
    print(f"cluster:    {cluster}")
    print(f"program_id: {program}")


def cmd_vault_info(args: argparse.Namespace) -> None:
    _require_api_key()
    result = _get("/api/memory/list?source=mythos&limit=1")
    if args.json:
        _out(result, as_json=True)
        return
    print(f"owner:        {result.get('owner', '?')}")
    print(f"agent_id:     {_agent_id()}")
    print(f"memory_count: {result.get('count', '?')}")
    print("mode:         API-key vault lógico (agent:<keyId>:mythos:<agentId>)")


def cmd_write(args: argparse.Namespace) -> None:
    _require_api_key()
    result = _post("/api/memory/write", {
        "content": args.content,
        "model": "mythos",
        "metadata": {
            "source": "mythos",
            "contentType": "mythos_memory",
            "agentId": _agent_id(),
            "agentName": "Mythos",
            "origin": "mythos-congchain-client",
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
    if args.json:
        _out(result, as_json=True)
        return
    print(f"memory_id:    {result.get('memory_id', result.get('id', '?'))}")
    print(f"content_hash: {result.get('content_hash', result.get('contentHash', '?'))}")
    print(f"tx_signature: {result.get('tx_signature', result.get('txSignature', '?'))}")


def cmd_read(args: argparse.Namespace) -> None:
    result = _get(f"/api/memory/{args.hash}")
    if args.json:
        _out(result, as_json=True)
        return
    print(f"hash:         {result.get('content_hash', args.hash)}")
    print(f"model:        {result.get('model', '?')}")
    print(f"created_at:   {result.get('created_at', '?')}")
    print(f"confidence:   {result.get('confidence_bps', 0) // 100}%")
    print(f"on_chain:     {result.get('on_chain', '?')}")
    print(f"zk_status:    {result.get('zk_status', result.get('zkStatus', '?'))}")
    content = result.get("content", result.get("summary", ""))
    print(f"\nconteúdo:\n{str(content)[:800]}")


def cmd_list(args: argparse.Namespace) -> None:
    _require_api_key()
    result = _get(f"/api/memory/list?source=mythos&agentId={_agent_id()}&limit={args.limit}")
    memories = result.get("memories", result if isinstance(result, list) else [])
    if args.json:
        _out(memories, as_json=True)
        return
    if not memories:
        print("(nenhuma memória encontrada)")
        return
    print(f"{'ID':<8}  {'HASH':<14}  {'CONF':>5}  {'IMP':>5}  {'CRIADO':<20}  {'MODELO'}")
    print("-" * 75)
    for m in memories:
        h = str(m.get("content_hash", m.get("hash", "")))[:12]
        mid = str(m.get("id", m.get("memory_id", "")))[:8]
        conf = f"{m.get('confidence_bps', 0) // 100}%"
        imp = f"{m.get('importance_bps', 0) // 100}%"
        created = str(m.get("created_at", ""))[:20]
        model = str(m.get("model", "?"))[:16]
        print(f"{mid:<8}  {h:<14}  {conf:>5}  {imp:>5}  {created:<20}  {model}")


def cmd_verify(args: argparse.Namespace) -> None:
    result = _get(f"/api/memory/verify/{args.hash}")
    if args.json:
        _out(result, as_json=True)
        return
    on_chain = result.get("on_chain", result.get("onChain", False))
    trust = result.get("trust_score", result.get("trustScore", 0))
    zk = result.get("zk_proof", result.get("zkProof", {}))
    print(f"on_chain:    {'✓ sim' if on_chain else '✗ não'}")
    print(f"trust_score: {trust}")
    print(f"zk_status:   {zk.get('status', '?') if isinstance(zk, dict) else zk}")


def cmd_chain(args: argparse.Namespace) -> None:
    SEP = "━" * 48
    for h in args.hashes:
        try:
            result = _get(f"/api/memory/{h}")
            if args.json:
                _out(result, as_json=True)
                continue
            on_chain = result.get("on_chain", False)
            model = result.get("model", "desconhecido")
            created = result.get("created_at", "?")
            conf = result.get("confidence_bps", 0) // 100
            content = str(result.get("content", result.get("summary", "")))[:200]
            print(f"\n⚡ Memória Verificada · CongChain Bridge")
            print(SEP)
            print(f"Hash:   {h[:32]}...")
            print(f"Origem: {model} · {created}")
            print(f"Status: {'✓ On-chain' if on_chain else '⏳ Pendente'} · Score: {conf}%")
            print(SEP)
            print(content)
        except SystemExit:
            print(f"\n[erro] hash não encontrado: {h}", file=sys.stderr)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        prog="congchain_client.py",
        description="Cliente CLI para a API CognChain (stdlib only)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # health
    p_health = sub.add_parser("health", help="Verificar conectividade com a CognChain")
    p_health.add_argument("--json", action="store_true")

    # vault-info
    p_vault = sub.add_parser("vault-info", help="Informações do vault lógico autenticado pela API key")
    p_vault.add_argument("address", nargs="?", default=None, help="Ignorado; mantido por compatibilidade")
    p_vault.add_argument("--json", action="store_true")

    # write
    p_write = sub.add_parser("write", help="Ancorar uma memória")
    p_write.add_argument("content", help="Conteúdo da memória")
    p_write.add_argument("--confidence", type=int, default=8000,
                         help="Confiança em bps (0-10000, padrão: 8000)")
    p_write.add_argument("--importance", type=int, default=7500,
                         help="Importância em bps (0-10000, padrão: 7500)")
    p_write.add_argument("--json", action="store_true")

    # read
    p_read = sub.add_parser("read", help="Ler uma memória pelo hash")
    p_read.add_argument("hash")
    p_read.add_argument("--json", action="store_true")

    # list
    p_list = sub.add_parser("list", help="Listar memórias do vault")
    p_list.add_argument("--limit", type=int, default=10)
    p_list.add_argument("--json", action="store_true")

    # verify
    p_verify = sub.add_parser("verify", help="Verificar prova/status de uma memória")
    p_verify.add_argument("hash")
    p_verify.add_argument("--json", action="store_true")

    # chain
    p_chain = sub.add_parser("chain", help="Exibir cabeçalhos verificados de múltiplos hashes")
    p_chain.add_argument("hashes", nargs="+")
    p_chain.add_argument("--json", action="store_true")

    args = parser.parse_args()

    dispatch = {
        "health": cmd_health,
        "vault-info": cmd_vault_info,
        "write": cmd_write,
        "read": cmd_read,
        "list": cmd_list,
        "verify": cmd_verify,
        "chain": cmd_chain,
    }
    dispatch[args.command](args)


if __name__ == "__main__":
    main()
