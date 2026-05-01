ZK MVP Build Guide

This folder contains the minimal circuit used by CONGCHAIN real ZK mode.

## Prerequisites

- `circom` installed and available in PATH
- Node dependencies installed (`npm install`)

## Build artifacts

Run:

1. `npm run zk:setup`
2. `npm run zk:compile`
3. `npm run zk:ptau`
4. `npm run zk:zkey`
5. `npm run zk:export-wasm`

Or all at once:

- `npm run zk:build`

Generated files:

- `zk-artifacts/memory_hash.wasm`
- `zk-artifacts/memory_hash.zkey`
- `zk-artifacts/memory_hash.vkey.json`

## Runtime flags

- `ZK_MVP_ENABLED=true`
- `ZK_MVP_MODE=real` (or `simulated`)

Optional path overrides:

- `ZK_ARTIFACTS_DIR`
- `ZK_CIRCUIT_WASM`
- `ZK_PROVING_KEY`
- `ZK_VERIFYING_KEY`

Hardening flags:

- `ZK_MAX_CONTENT_LENGTH` (default `8000`)
- `ZK_PROVE_TIMEOUT_MS` (default `30000`)
- `ZK_VERIFY_TIMEOUT_MS` (default `10000`)

Persistence notes:

- Generated bundles are stored in `Memory` (`zkProof`, `zkPublicSignals`, etc).
- `GET /api/memory/:hash/proof` now returns stored proof when available.
- `POST /api/zk/prove` accepts `{ "hash": "...", "forceRegenerate": true }` to bypass stored proof.

## E2E validation

With app running on localhost:

- `npm run zk:e2e`

Optional overrides:

- `ZK_E2E_BASE_URL` (default `http://localhost:3000`)
- `ZK_E2E_MODEL` (default `gpt`)

The script validates this sequence:

1. `POST /api/save-memory` with `generateZkProof: true`
2. `POST /api/zk/verify` for returned bundle
3. `GET /api/memory/:hash/proof`
4. `POST /api/zk/verify` for proof endpoint bundle

