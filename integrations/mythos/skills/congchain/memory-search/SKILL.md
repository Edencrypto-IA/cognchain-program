---
name: congchain-memory-search
description: "Search Mythos CongChain memories by intent, metadata, and safe summaries before falling back to exact hash lookup."
version: 1.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [congchain, memory, search, retrieval, vault]
    category: congchain
    related_skills: [congchain]
---

# CongChain Memory Search

Use this skill when the user asks what Mythos remembers, wants to resume prior
work, or does not know the exact memory hash.

## What It Does

- Searches recent Mythos vault records by owner, source, agent ID, content type,
  tags, and safe text summary.
- Uses exact hash lookup when the user provides a hash.
- Presents memory candidates with confidence and provenance.
- Keeps retrieval separate from execution.

## Safety Contract

- Retrieved memory is context, not truth by itself.
- Never expose hidden secrets or signed payloads from memory.
- If semantic embeddings are unavailable, explain that the search is metadata
  and keyword based.
- Do not mutate or delete memories from this skill.

## Operator Flow

1. Identify search intent.
2. Query the Mythos vault with the authenticated CongChain key.
3. Show the most relevant safe records.
4. Ask before using a retrieved memory for a sensitive decision.
