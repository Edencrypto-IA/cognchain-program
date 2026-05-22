---
name: congchain-confidence-calibration
description: "Calibrate Mythos confidence labels using evidence quality, tool results, memory provenance, and uncertainty."
version: 1.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [congchain, confidence, calibration, evidence, safety]
    category: congchain
    related_skills: [congchain-session-audit]
---

# CongChain Confidence Calibration

Use this skill when Mythos must explain how confident it is and why.

## What It Does

- Scores evidence as direct, tool-derived, memory-derived, inferred, or
  uncertain.
- Produces a confidence label and a short rationale.
- Records calibration metadata when a memory is saved.

## Safety Contract

- Confidence is not a guarantee.
- Lower confidence for outdated, unsourced, or memory-only claims.
- Require external verification for legal, medical, financial, deployment, or
  wallet decisions.
- Do not hide uncertainty to make the agent look stronger.
