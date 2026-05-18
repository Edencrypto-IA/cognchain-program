# CongChain Agent Memory Bridge

This module defines the contract for external agents that want to save
verifiable memories into CongChain.

The first target integration is Hermes, but the bridge is intentionally
agent-neutral so future agents can use the same safety boundary.

## Product rule

- CongChain may store agent memories, skills, task results, hashes, proofs, and
  public verification metadata.
- CongChain may not store private keys, seed phrases, API keys, hidden prompts,
  signed payloads, payroll secrets, or user funds.
- External agents must authenticate with a CongChain API key before writing.
- ZK proof generation and blockchain anchoring must be explicit options.
- The bridge cannot send transactions, request wallet signatures, or move funds.

## Phase 1 contract

The Agent Memory Bridge turns external agent output into a safe memory write
request.

It can:

- document the supported agent memory payload;
- identify Hermes as the first supported source;
- define content types for skills, memories, and task results;
- point integrations to the existing CongChain memory, proof, and anchor
  endpoints;
- keep the bridge separate from Wallet Agent execution flows;
- expose the bridge story inside `/dashboard/keys`.

It still cannot:

- provide a dedicated Hermes API route;
- ship a Hermes Python plugin;
- edit Hermes skills automatically;
- generate proofs or anchors without the caller asking for them;
- move funds, sign transactions, schedule jobs, or bypass user consent.

## Supported sources

- `hermes`
- `external_agent`
- `congchain`

## Supported content types

- `hermes_skill`
- `hermes_memory`
- `hermes_task_result`
- `agent_skill`
- `agent_memory`
- `agent_task_result`

## Current endpoint map

- Save memory: `POST /api/save-memory`
- Read memory: `GET /api/memory/{hash}`
- Read proof: `GET /api/memory/{hash}/proof`
- Generate proof: `POST /api/zk/prove`
- Anchor hash: `POST /api/blockchain/store`
- Verify anchor: `POST /api/blockchain/verify`

## Minimal save request

```json
{
  "content": "Hermes skill summary or task result",
  "model": "hermes",
  "generateZkProof": true,
  "metadata": {
    "source": "hermes",
    "contentType": "hermes_skill",
    "agentId": "hermes-local",
    "agentName": "Hermes",
    "skillName": "research-summarizer",
    "skillVersion": "1.0.0",
    "proofMode": "zk_requested",
    "anchorMode": "manual",
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

## Hermes handoff

The first Hermes implementation should be a safe-mode plugin or provider.

It should:

- default to dry-run until configured with a CongChain API key;
- save only explicit skill summaries, memory notes, or task results;
- never save `.env` values, private credentials, private prompts, seed phrases,
  wallet keys, signatures, or signed payloads;
- return the CongChain hash to Hermes after a successful write;
- make ZK proof and on-chain anchoring opt-in settings.

It should not:

- mutate Hermes skill files automatically;
- call unverified CongChain endpoints;
- treat memory anchoring as execution approval;
- sign, submit, buy, sell, pay, schedule, or move funds.
