---
name: solana-airdrop-manager
description: "Guide Devnet-only SOL airdrop troubleshooting for Mythos tests without touching real funds."
version: 1.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [solana, devnet, airdrop, testing, read-only]
    category: congchain
    related_skills: [solana-vault-health]
---

# Solana Airdrop Manager

Use this skill when a user cannot receive Devnet SOL for a Mythos/CongChain
test.

## What It Does

- Checks whether the request is explicitly Devnet/test-only.
- Explains faucet limits, RPC errors, wallet address checks, and retry timing.
- Suggests safe troubleshooting steps.

## Safety Contract

- Devnet only.
- Do not ask users to send real SOL.
- Do not automate repeated faucet abuse.
- Do not sign or submit transfers.
