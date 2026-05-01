ZK Artifacts (MVP Real Mode)

Place your compiled Groth16 files here when using `ZK_MVP_MODE=real`.

Default filenames expected by the API:

- `memory_hash.wasm`
- `memory_hash.zkey`
- `memory_hash.vkey.json`

Optional environment overrides:

- `ZK_ARTIFACTS_DIR`
- `ZK_CIRCUIT_WASM`
- `ZK_PROVING_KEY`
- `ZK_VERIFYING_KEY`

Required flags:

- `ZK_MVP_ENABLED=true`
- `ZK_MVP_MODE=real` (or `simulated`)

