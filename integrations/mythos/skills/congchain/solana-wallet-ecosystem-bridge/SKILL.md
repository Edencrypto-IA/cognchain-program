---
name: solana-wallet-ecosystem-bridge
description: "Plan safe, future wallet ecosystem integrations while preserving CongChain's no-autonomous-funds boundary."
version: 0.1.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [solana, wallet, phantom, solflare, jupiter, safety]
    category: congchain
    related_skills: [solana-tx-inspector, solana-vault-health]
---

# Solana Wallet Ecosystem Bridge

Use this skill only as a planning and review layer for future integrations with
wallets, explorers, RPC providers, and Solana ecosystem APIs.

## What It Can Do Now

- Map requested integrations such as Phantom, Solflare, Helius, Jupiter, or
  Solana RPC into safe phases.
- Explain which parts are read-only and which require explicit wallet approval.
- Produce a checklist before any real signing or transaction flow is built.

## Safety Contract

- Do not request wallet signatures from this skill.
- Do not prepare, sign, submit, swap, buy, sell, schedule, or move funds.
- Any future value-moving action must go through the Wallet Agent review,
  in-app confirmation, explicit wallet signature, and separate submission flow.
- Treat this as future architecture until audited execution phases exist.
