---
name: solana-developer
description: "Build, review, and debug Solana applications, Anchor programs, PDAs, SPL token flows, and frontend wallet integrations with read-only safety boundaries."
version: 2.0.0
author: Eden Lucas / CongChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [solana, anchor, rust, pda, spl, wallet, devnet, debug]
    category: congchain
    related_skills: [solana-tx-inspector, solana-anchor-schema-validator, solana-wallet-ecosystem-bridge]
    requires_toolsets: [terminal, file]
---

# Solana Developer

Use this skill when Mythos is helping with Solana application development, Anchor
program review, PDAs, SPL token flows, wallet adapter issues, or Devnet testing.

## Safety Contract

- Use read-only RPC for inspection unless the user explicitly asks for local
  development commands.
- Do not request seed phrases, private keys, signed payloads, wallet secrets, or
  provider API keys.
- Do not sign, submit, retry, buy, sell, swap, pay, or move funds.
- Mainnet guidance is informational unless a future audited wallet flow requires
  explicit wallet-side approval.
- Save only reviewed summaries to CongChain memory.

## Inputs

- Program ID, transaction signature, Anchor error, IDL excerpt, account layout,
  PDA seeds, frontend wallet error, or repo path.
- Cluster: Devnet, testnet, or mainnet.
- Goal: build, debug, inspect, explain, or prepare a review note.

## Workflow

1. Identify the Solana surface: transaction, program, IDL, account, wallet, RPC,
   token, or frontend integration.
2. Collect safe evidence: logs, public account metadata, IDL, visible code,
   cluster, and exact error text.
3. Separate fact from inference.
4. Propose the smallest safe next step.
5. If the result should persist, ask the user before saving a summary through
   the CongChain bridge.

## Useful Local Checks

```bash
solana --version
anchor --version
rustc --version
node --version
solana config get
```

## Anchor Review Checklist

- Account discriminators and account sizes are correct.
- PDA seeds and bump are consistent between program and client.
- Signer and writable accounts match the instruction.
- Rent and payer expectations are explicit.
- Arithmetic uses checked operations when values can overflow.
- Upgrade authority and deployment cluster are clearly labeled.

## CongChain Memory Output

When saving a reviewed Solana result, use:

```json
{
  "model": "mythos",
  "metadata": {
    "source": "mythos",
    "contentType": "mythos_task_result",
    "agentId": "mythos-solana-dev",
    "agentName": "Mythos",
    "skillName": "solana-developer",
    "eventType": "solana_developer_review",
    "safety": {
      "containsSecrets": false,
      "containsPrivateKeys": false,
      "containsSignedPayloads": false,
      "canMoveFunds": false,
      "requiresHumanReview": true
    }
  }
}
```

## Output Format

- Perception: what Mythos saw.
- Evidence: public logs, code, account data, or user-provided context used.
- Likely cause: the most probable issue and uncertainty.
- Decision: safe recommendation.
- Next step: one concrete action.
- CongChain note: whether the summary is ready to save as memory.
