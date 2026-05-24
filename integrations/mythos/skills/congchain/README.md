# Mythos Verifiable Brain Skill Pack

This directory contains CongChain-native Mythos skills that turn the agent into
auditable infrastructure instead of a generic chatbot.

The pack is intentionally split by maturity:

- Ready for guided use: session audit, memory search, export, chain graph,
  vault bootstrap, confidence calibration, rollback, multimodel sync.
- Ready as review helpers: Forge LSP, context diff, Anchor schema validation.
- Solana read-only helpers: transaction inspector, vault health, memory finality
  tracker, Devnet airdrop troubleshooting.
- Runtime and ecosystem helpers: Solana developer, Web3 researcher, CongChain
  analyst, Mythos deployer, agent architect, PT-BR operator.
- Future architecture: wallet ecosystem bridge.

## Safety Rules

- Do not store secrets, API keys, private keys, seed phrases, signed payloads,
  or raw wallet transaction payloads.
- Say `registered in CongChain` only after the memory API succeeds.
- Say `on-chain` only after an explicit blockchain anchor endpoint confirms it.
- Solana skills are read-only or Devnet-only unless a future audited Wallet
  Agent flow requires explicit wallet approval.
- These skills can guide, inspect, summarize, and register metadata. They do
  not buy, sell, swap, pay, sign, submit, schedule, or move funds.

## Recommended Rollout

1. Install the core governance skills first: session audit, memory search,
   export, chain graph.
2. Add developer reliability: Forge LSP, rollback, context diff, confidence
   calibration.
3. Add multimodel continuity and the NVIDIA Router recommendation layer.
4. Add Solana read-only review skills.
5. Add runtime/operator skills after the bridge is validated locally.
6. Keep wallet ecosystem bridge as planning-only until audited execution phases
   exist.

## Official Skills in This Pack

- `agent-architect`
- `chain-graph`
- `confidence-calibration`
- `congchain-analyst`
- `context-diff`
- `export`
- `forge-lsp`
- `memory-search`
- `multimodel-sync`
- `mythos-deployer`
- `pt-br-operator`
- `rollback`
- `session-audit`
- `solana-airdrop-manager`
- `solana-anchor-schema-validator`
- `solana-developer`
- `solana-memory-finality-tracker`
- `solana-tx-inspector`
- `solana-vault-health`
- `solana-wallet-ecosystem-bridge`
- `vault-bootstrap`
- `web3-researcher`
