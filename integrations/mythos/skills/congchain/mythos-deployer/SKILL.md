---
name: mythos-deployer
description: "Plan and verify Mythos runtime deployment across local, Docker, VPS, Fly.io, Railway, and secured gateway environments."
version: 2.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [mythos, deploy, docker, railway, flyio, vps, gateway, ops]
    category: congchain
    related_skills: [agent-architect, rollback, session-audit]
    requires_toolsets: [terminal, file]
---

# Mythos Deployer

Use this skill when installing, configuring, deploying, or verifying a Mythos
runtime.

## Safety Contract

- Never print `.env` values or provider keys.
- Never commit `.env`, API keys, bot tokens, private keys, or credentials.
- Prefer allowlists for public messaging gateways.
- Treat open gateway access as a test-only mode unless the operator explicitly
  approves it.
- Do not run destructive deployment commands without explicit confirmation.

## Deployment Targets

- Local Windows/Linux/macOS runtime.
- Docker local sandbox.
- VPS with systemd or Docker Compose.
- Fly.io or Railway service.
- Future managed CongChain runtime.

## Required Checks

```bash
mythos doctor
mythos skills list
mythos config
```

For CongChain bridge:

```bash
curl https://cognchain-program-production.up.railway.app/api/memory/health
```

## Environment Variables

Required for CongChain memory:

```text
CONGCHAIN_API_URL=https://cognchain-program-production.up.railway.app
CONGCHAIN_API_KEY=cog_live_...
CONGCHAIN_AGENT_ID=mythos-local
```

Optional runtime capabilities:

```text
OPENROUTER_API_KEY=...
NVIDIA_API_KEY=...
TAVILY_API_KEY=...
FAL_KEY=...
TELEGRAM_BOT_TOKEN=...
DISCORD_BOT_TOKEN=...
```

## Deployment Workflow

1. Run `mythos doctor`.
2. Configure model provider keys.
3. Configure CongChain API URL/key/agent ID.
4. Enable only needed gateway platforms.
5. Run a terminal-only task first.
6. Run a web/browser task second.
7. Save one reviewed result to CongChain.
8. Verify the memory hash.
9. Document enabled tools and blocked tools.

## Production Readiness

- Gateway allowlists configured.
- Logs redact secrets.
- Runtime directory backed up.
- Health checks documented.
- Rollback plan exists.
- CongChain memory writes tested.

## Output Format

```text
Mythos Deployment Review

Target:
Configured providers:
Enabled tools:
Blocked tools:
CongChain bridge:
Gateway:
Risk items:
Next operator step:
```
