---
name: congchain-forge-lsp
description: "Add language-server and test checks to CongChain Forge planning before a code proposal is trusted."
version: 1.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [congchain, forge, lsp, code, tests]
    category: congchain
    related_skills: [congchain-forge]
---

# CongChain Forge LSP

Use this skill when Mythos is preparing code changes and should inspect the
repo with language-aware checks before proposing or saving a decision.

## What It Does

- Detects relevant languages and available checks.
- Runs safe read-only diagnostics such as `tsc --noEmit`, `pyright`, `cargo
  check`, or repo-specific tests when available.
- Adds findings to the Forge plan.
- Saves only clean technical handoff metadata to CongChain when requested.

## Safety Contract

- Do not run destructive commands.
- Do not auto-commit or push without explicit user approval.
- Do not claim a full build passed unless the command actually ran and passed.
- If no LSP/test command exists, state the gap plainly.
