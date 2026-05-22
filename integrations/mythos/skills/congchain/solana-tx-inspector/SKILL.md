---
name: solana-tx-inspector
description: "Inspect Solana transaction metadata and explain status, accounts, and risk without signing or submitting anything."
version: 1.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [solana, transaction, inspector, read-only, safety]
    category: congchain
    related_skills: [congchain-session-audit]
---

# Solana Transaction Inspector

Use this skill when a user provides a Solana signature or transaction payload
for review.

## What It Does

- Reads public transaction metadata from an explorer/RPC when configured.
- Explains network, status, accounts, instructions, fees, and visible risks.
- Produces a read-only review summary.

## Safety Contract

- Do not sign, serialize, submit, retry, or modify transactions.
- Do not ask for private keys or seed phrases.
- Treat unsigned/signed payloads as sensitive and avoid saving raw payloads to
  memory.
- Mainnet reviews are informational only.
