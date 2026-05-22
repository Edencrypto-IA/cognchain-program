---
name: congchain-vault-bootstrap
description: "Guide a Mythos operator through creating and validating a safe CongChain API-key vault connection."
version: 1.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [congchain, setup, vault, api-key, onboarding]
    category: congchain
    related_skills: [congchain]
---

# CongChain Vault Bootstrap

Use this skill when Mythos is being connected to CongChain for the first time
or a key/vault appears misconfigured.

## What It Does

- Explains the required environment variables.
- Validates `CONGCHAIN_API_URL`, `CONGCHAIN_API_KEY`, and `CONGCHAIN_AGENT_ID`.
- Runs a safe health check.
- Performs a small test write only after the operator confirms.

## Safety Contract

- The full API key must not be printed in chat, logs, screenshots, or memory.
- Use masked key labels such as `cog_live_abc...`.
- This skill creates a connection context; it does not create wallets or move
  funds.
- If Solana anchoring is unavailable, keep the vault described as logical
  CongChain memory, not on-chain storage.
