---
name: congchain-export
description: "Export safe Mythos memory and audit metadata for operator review without exporting secrets or private payloads."
version: 1.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [congchain, export, audit, governance, metadata]
    category: congchain
    related_skills: [congchain-session-audit, congchain-memory-search]
---

# CongChain Export

Use this skill when an operator needs a portable record of Mythos memory,
history, or audit metadata.

## What It Does

- Exports safe metadata: hashes, timestamps, source, agent ID, skill, status,
  proof URLs, and safety flags.
- Creates a readable audit bundle for support or internal review.

## Safety Contract

- Do not export API keys, private keys, seed phrases, signed payloads, raw
  wallet data, payroll secrets, or hidden prompts.
- Do not send exports anywhere automatically.
- Exports are evidence packages, not permission to execute actions.
