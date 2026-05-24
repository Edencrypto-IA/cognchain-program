---
name: congchain-analyst
description: "Analyze CongChain memory records, hashes, proofs, vault metadata, and agent activity without overstating on-chain finality."
version: 2.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [congchain, audit, memory, hash, proof, vault, report]
    category: congchain
    related_skills: [session-audit, memory-search, chain-graph, export]
    requires_toolsets: [terminal, file]
---

# CongChain Analyst

Use this skill when a user wants to audit Mythos or another external agent
through CongChain memory records.

## Safety Contract

- Say "saved in CongChain" only after the memory API returns a hash.
- Say "proof available" only after the proof endpoint returns data.
- Say "on-chain" only after an explicit blockchain anchor endpoint confirms it.
- Do not store or expose API keys, private keys, seed phrases, signed payloads,
  wallet secrets, or raw confidential prompts.
- Do not modify, delete, or rewrite memory records unless the user explicitly
  requests a supported governance flow.

## Current Bridge Contract

Writes use:

```http
POST /api/memory/write
Authorization: Bearer cog_live_...
Content-Type: application/json
```

Reads and verification use:

```http
GET /api/memory/{hash}
GET /api/memory/{hash}/proof
GET /api/memory/verify/{hash}
GET /api/memory/list
```

## Workflow

1. Identify the scope: one hash, one vault, one agent, one session, or one date
   range.
2. Fetch or inspect only metadata needed for the question.
3. Classify each record state:
   - local-only;
   - saved in CongChain;
   - proof endpoint available;
   - anchor requested;
   - anchor submitted;
   - confirmed/finalized.
4. Summarize agent, source, content type, task, skill, timestamp, and safety
   flags.
5. Highlight missing proof, missing anchor, or unsafe claims.

## Report Format

```text
CongChain Analyst Report

Scope:
Records reviewed:
Agent/source:
Storage state:
Proof state:
Anchor state:

Key findings:
1.
2.
3.

Safety notes:
- No secrets included.
- No wallet secrets included.
- No fund movement implied.

Next operator step:
```

## Pitfalls

- A hash is not the same thing as on-chain finality.
- A local receipt is not durable proof by itself.
- A model statement is not evidence unless it points to a record, tool result,
  or verified endpoint.
