---
name: solana-vault-health
description: "Check public Solana/CongChain vault health signals in read-only mode."
version: 1.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [solana, vault, health, read-only, congchain]
    category: congchain
    related_skills: [congchain-vault-bootstrap]
---

# Solana Vault Health

Use this skill when an operator wants to understand whether a CongChain vault or
public Solana address appears reachable.

## What It Does

- Checks public network, address, balance/status, and recent activity when RPC
  access exists.
- Labels whether evidence came from local config, CongChain API, or Solana RPC.

## Safety Contract

- Read-only checks only.
- Do not infer ownership from public address data alone.
- Do not move funds, request signatures, or expose private wallet material.
- Devnet status must never be described as mainnet settlement.
