---
name: congchain-context-diff
description: "Compare two Mythos sessions or memory records and explain what changed without exposing hidden chain-of-thought."
version: 1.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [congchain, context, diff, interpretability, audit]
    category: congchain
    related_skills: [congchain-session-audit]
---

# CongChain Context Diff

Use this skill when Mythos needs to explain what changed between two sessions,
two saved memories, or two model/provider runs.

## What It Does

- Compares visible summaries, metadata, selected skills, provider/model labels,
  tool usage, and safety flags.
- Highlights added, removed, and changed operational context.
- Detects possible drift in behavior or assumptions.
- Produces an audit-friendly difference report.

## Safety Contract

- Do not reveal private chain-of-thought.
- Do not claim neuronal fingerprint comparison unless CNA data exists.
- Do not claim blockchain finality unless an anchor/finality endpoint confirms
  it.
- The diff informs review; it does not decide production readiness.
