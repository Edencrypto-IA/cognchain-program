# CongChain Agent Memory Bridge

This module defines the contract for external agents that want to save
verifiable memories into CongChain.

The first target integrations are Mythos, Hermes, OpenClaw, and Eliza, but the
bridge is intentionally agent-neutral so future agents can use the same safety
boundary.

## Mythos identity split

Mythos is treated as the first official external agent for CongChain.

It may remain compatible with Hermes-shaped plugins and task contracts, but the
CongChain production identity is separate:

- default source: `mythos`;
- default content types: `mythos_skill`, `mythos_memory`, and
  `mythos_task_result`;
- default namespace: `mythos`;
- default vault shape: key owner + Mythos source + Mythos agent ID;
- Hermes references are compatibility adapters, not the Mythos brand,
  namespace, or default storage route.

This lets the project evolve Mythos into its own runtime, docs, skills, and
distribution without breaking the bridge contract or older Hermes-compatible
payloads.

## Mythos six-pillar identity

The next Mythos identity layer is designed around six enterprise-facing
signals:

1. Provable Memory Passport: important memories carry source, agent ID, skill
   context, hash routes, and safety metadata.
2. Skill-Governed Execution: work starts from a declared skill category instead
   of an invisible generic prompt.
3. Memory Constitution: anti-secret, no-funds, no-signed-payload, and
   human-review rules travel with each write.
4. Cross-Model Continuity: model, provider, skill, and task context can survive
   movement between model backends.
5. External Agent Vault: each API key, source, and agent ID writes into an
   isolated logical vault.
6. Boardroom Audit Packet: setup, payload, bridge health, capabilities, and
   safety posture are visible in one review surface.

These are product identity signals first. They do not claim production
monitoring, autonomous execution, wallet control, or provider uptime unless a
future audited phase implements those powers.

## Mythos verifiable brain v1

The first cognitive layer gives Mythos a reviewable operational brain model:

1. Perception Layer: records what request, skill, model route, and state were
   visible before the response.
2. Memory Layer: separates live prompt context, CongChain memory, Obsidian
   notes, and external memory providers.
3. Reasoning Layer: explains why a skill or path was chosen without exposing
   hidden chain-of-thought or sensitive prompts.
4. Prediction Layer: summarizes likely next states, risks, and uncertainty.
5. Operational Conscience: applies no-secrets, no-funds, no-signed-payload, and
   human-review boundaries.
6. Auditable Learning Layer: turns important decisions into memory candidates
   only when an explicit authenticated write happens.

The terminal test endpoint can return a `mythos_decision_trace_v1` object with
perception, memory context, selected skill, reasoning path, prediction, decision,
confidence, safety boundary, and next human step. This trace is an audit
explanation, not hidden model chain-of-thought.

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
- identify Mythos, Hermes, OpenClaw, and Eliza as supported sources;
- define content types for skills, memories, and task results;
- point integrations to the existing CongChain memory, proof, and anchor
  endpoints;
- keep the bridge separate from Wallet Agent execution flows;
- expose the bridge story inside `/dashboard/keys`.

It still cannot:

- ship external agent plugins automatically;
- edit Mythos, Hermes, OpenClaw, or Eliza files automatically;
- generate proofs or anchors without the caller asking for them;
- move funds, sign transactions, schedule jobs, or bypass user consent.

## Phase 2 authenticated bridge endpoints

The Agent Memory Bridge now has a dedicated authenticated write path for
external agents.

It can:

- expose `GET /api/memory/health` as a public compatibility/status contract;
- expose `POST /api/memory/write` for API-key-authenticated agent memory writes;
- expose `GET /api/memory/list` for a key-scoped list of memories written by
  that external agent key;
- expose `GET /api/memory/verify/{hash}` for a compact verification response;
- place each write into a logical vault using the API key, source, and agent ID;
- block safety flags that indicate secrets, private keys, signed payloads, or
  fund movement capability;
- keep compatibility with the existing memory table without requiring a database
  migration.

It still cannot:

- install or configure Mythos, Hermes, OpenClaw, or Eliza by itself;
- prove provider-side delivery or uptime;
- create durable per-agent metadata tables;
- anchor hashes on-chain unless a separate explicit anchor flow is called;
- sign, submit, buy, sell, pay, schedule, or move funds.

## Supported sources

- `hermes`
- `mythos`
- `openclaw`
- `eliza`
- `external_agent`
- `congchain`

## Supported content types

- `hermes_skill`
- `hermes_memory`
- `hermes_task_result`
- `mythos_skill`
- `mythos_memory`
- `mythos_task_result`
- `openclaw_skill`
- `openclaw_memory`
- `openclaw_task_result`
- `eliza_skill`
- `eliza_memory`
- `eliza_task_result`
- `agent_skill`
- `agent_memory`
- `agent_task_result`

## Current endpoint map

- Health/status: `GET /api/memory/health`
- Save agent memory: `POST /api/memory/write`
- List key-owned agent memories: `GET /api/memory/list`
- Verify memory: `GET /api/memory/verify/{hash}`
- Legacy save memory: `POST /api/save-memory`
- Read memory: `GET /api/memory/{hash}`
- Read proof: `GET /api/memory/{hash}/proof`
- Generate proof: `POST /api/zk/prove`
- Anchor hash: `POST /api/blockchain/store`
- Verify anchor: `POST /api/blockchain/verify`

## Minimal save request

Endpoint: `POST /api/memory/write`

```json
{
  "content": "Mythos skill summary or task result",
  "model": "mythos",
  "generateZkProof": true,
  "metadata": {
    "source": "mythos",
    "contentType": "mythos_skill",
    "agentId": "mythos-local",
    "agentName": "Mythos",
    "namespace": "mythos",
    "compatibilityMode": "hermes_compatible_mythos_primary",
    "identityProgram": "mythos_six_pillar_agent_identity",
    "cognitiveArchitecture": "mythos_verifiable_brain_v1",
    "decisionTraceSchema": "mythos_decision_trace_v1",
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

## External agent handoff

The first Mythos implementation should be a safe-mode plugin or provider.

It should:

- default to dry-run until configured with a CongChain API key;
- save only explicit skill summaries, memory notes, or task results;
- never save `.env` values, private credentials, private prompts, seed phrases,
  wallet keys, signatures, or signed payloads;
- return the CongChain hash to Mythos after a successful write;
- make ZK proof and on-chain anchoring opt-in settings.

It should not:

- mutate Mythos or Hermes-compatible skill files automatically;
- call unverified CongChain endpoints;
- treat memory anchoring as execution approval;
- sign, submit, buy, sell, pay, schedule, or move funds.

## Mythos wallet command safety ladder

The Mythos Solana surface can now preview future wallet commands without giving
the agent custody.

The six phases are:

1. Command intent: classify a user request such as buy, sell, pay, swap,
   schedule, payroll, privacy transfer, price alert, or risk review.
2. Secure preview: explain network, wallet, token, amount, route, risk, and
   missing fields before a wallet request exists.
3. Route/proposal: create an auditable route contract. Jupiter and mainnet
   routes remain preview-only until future audited phases.
4. Wallet signature: require explicit Phantom/Solflare approval for any
   value-moving action.
5. Controlled submit: submit only after the signed payload and network are
   visible to the user.
6. CongChain memory: save metadata-only reviewed context, hash, proof routes,
   and safety notes for future agents.

The ladder cannot:

- open a wallet by itself;
- sign or submit mainnet transactions automatically;
- store signed payloads, private keys, seed phrases, or wallet secrets;
- turn memory writes into execution approval;
- buy, sell, pay, schedule, retry, submit, or move funds without visible wallet
  approval.
