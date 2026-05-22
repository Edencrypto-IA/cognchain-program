---
name: solana-anchor-schema-validator
description: "Review Anchor IDL/schema compatibility for CongChain Solana programs without deploying or migrating."
version: 1.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [solana, anchor, idl, schema, validation]
    category: congchain
    related_skills: [congchain-forge-lsp]
---

# Solana Anchor Schema Validator

Use this skill when Mythos reviews an Anchor IDL, account layout, or program
interface.

## What It Does

- Reads IDL/schema files.
- Checks obvious account, instruction, type, and naming mismatches.
- Produces a migration-safe review note.

## Safety Contract

- Do not deploy programs.
- Do not run migrations against production networks.
- Do not expose private keys or validator secrets.
- Treat generated findings as review input, not final security audit.
