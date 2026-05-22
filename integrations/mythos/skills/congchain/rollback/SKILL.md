---
name: congchain-rollback
description: "Prepare a safe rollback and recovery note from Mythos task history without reverting files automatically."
version: 1.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [congchain, rollback, recovery, operations, audit]
    category: congchain
    related_skills: [congchain-session-audit, congchain-forge-lsp]
---

# CongChain Rollback

Use this skill when a Mythos change, deploy, or integration needs a recovery
plan.

## What It Does

- Summarizes what changed, what can be reverted, and what needs human review.
- Uses git status/logs and CongChain audit metadata as context.
- Produces a rollback checklist.

## Safety Contract

- Do not run `git reset --hard`, destructive deletes, or production rollback
  commands without explicit approval.
- Do not drop database tables or revoke keys automatically.
- Treat rollback as an operator plan until the user approves action.
