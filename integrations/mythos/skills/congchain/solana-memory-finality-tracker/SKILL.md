---
name: solana-memory-finality-tracker
description: "Track whether a CongChain memory has local, API, proof, or blockchain-anchor confirmation."
version: 1.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [solana, finality, memory, proof, audit]
    category: congchain
    related_skills: [congchain-chain-graph]
---

# Solana Memory Finality Tracker

Use this skill when a user asks whether a Mythos memory is merely saved,
verified by API, proof-backed, or actually anchored.

## What It Does

- Separates `local`, `api_saved`, `proof_available`, `anchor_submitted`,
  `confirmed`, and `finalized` states.
- Shows proof and explorer URLs only when present.
- Explains uncertainty clearly.

## Safety Contract

- Do not claim finality without a verified status.
- Do not poll forever.
- Do not retry anchor/submission automatically.
- This skill tracks evidence; it does not execute financial transactions.
