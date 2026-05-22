---
name: congchain-session-audit
description: "Create a safe, user-facing audit summary for a Mythos session and optionally register it as CongChain metadata."
version: 1.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [congchain, mythos, audit, observability, session]
    category: congchain
    related_skills: [congchain, nvidia-router]
---

# CongChain Session Audit

Use this skill when a user asks for a session report, technical handoff, or
operator audit of what Mythos did.

## What It Does

- Summarizes session objective, selected skill, model/provider, tools used, and
  important outputs.
- Marks whether CongChain memory writes were attempted or completed.
- Produces a clean operator receipt that can be copied into support,
  deployment, or review notes.
- Optionally writes the summary to CongChain through the authenticated memory
  bridge.

## Safety Contract

- Do not include API keys, bot tokens, seed phrases, private keys, signed
  payloads, or raw secrets.
- Say "registered in CongChain" only when the write endpoint succeeds.
- Say "on-chain" only when a blockchain anchor endpoint returns a real anchor.
- This skill audits work; it does not approve deployments or execute financial
  actions.

## Output Shape

```text
Mythos session audit
Session: <id or local label>
Skill: <selected skill>
Provider/model: <provider/model>
Tools observed: <short list>
Memory status: <not written | registered | failed>
Safety: no secrets, no private keys, no signed payloads, no funds movement
Next operator step: <one clear action>
```
