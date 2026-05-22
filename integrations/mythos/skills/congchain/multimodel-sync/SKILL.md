---
name: congchain-multimodel-sync
description: "Keep Mythos decisions portable across providers by recording model, provider, skill, and memory context."
version: 1.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [congchain, multimodel, continuity, providers, routing]
    category: congchain
    related_skills: [nvidia-router, congchain-memory-search]
---

# CongChain Multimodel Sync

Use this skill when Mythos changes model/provider or compares outputs across
providers.

## What It Does

- Records model/provider labels, selected skill, task class, and memory context.
- Helps an operator understand why one model was used instead of another.
- Works with the NVIDIA Router recommendation layer without pretending to
  switch models automatically.

## Safety Contract

- Do not expose provider API keys.
- Do not claim deterministic equivalence between models.
- Do not call a model switch successful unless the runtime config actually
  changed.
- Save only metadata needed for continuity and audit.
