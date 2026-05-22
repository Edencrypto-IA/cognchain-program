---
name: congchain-chain-graph
description: "Build a visible relationship graph between Mythos memories, tasks, skills, hashes, and audit receipts."
version: 1.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [congchain, graph, memory, provenance, audit]
    category: congchain
    related_skills: [congchain-memory-search]
---

# CongChain Chain Graph

Use this skill when the user needs to understand how Mythos memories and task
outputs connect over time.

## What It Does

- Links memory hashes, session IDs, agent IDs, skills, model labels, and task
  results into a readable graph summary.
- Marks missing proofs or unverified nodes.
- Separates local memory, CongChain memory, and blockchain anchors.

## Safety Contract

- A graph edge is provenance, not automatic proof of truth.
- Do not fabricate missing hashes, anchors, or proofs.
- Do not expose private data from graph nodes.
- Keep financial or wallet-related nodes read-only unless a dedicated Wallet
  Agent approval flow exists.
