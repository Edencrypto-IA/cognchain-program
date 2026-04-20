# CognChain — Verifiable Memory Layer for AI Agents on Solana

<div align="center">

```
 ██████╗ ██████╗  ██████╗ ███╗   ██╗ ██████╗██╗  ██╗ █████╗ ██╗███╗   ██╗
██╔════╝██╔═══██╗██╔════╝ ████╗  ██║██╔════╝██║  ██║██╔══██╗██║████╗  ██║
██║     ██║   ██║██║  ███╗██╔██╗ ██║██║     ███████║███████║██║██╔██╗ ██║
██║     ██║   ██║██║   ██║██║╚██╗██║██║     ██╔══██║██╔══██║██║██║╚██╗██║
╚██████╗╚██████╔╝╚██████╔╝██║ ╚████║╚██████╗██║  ██║██║  ██║██║██║ ╚████║
 ╚═════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝
```

**The first verifiable, user-owned memory layer for AI agents — built natively on Solana.**

[![Solana Devnet](https://img.shields.io/badge/Solana-Devnet%20Live-9945FF?style=for-the-badge&logo=solana)](https://explorer.solana.com/address/9eBY2Tezy2z2nYqUBHzDitQRDnMbPuHYz8qj25fTWCPD?cluster=devnet)
[![Anchor](https://img.shields.io/badge/Anchor-1.0.0-blue?style=for-the-badge)](https://www.anchor-lang.com/)
[![Rust](https://img.shields.io/badge/Rust-1.95.0-orange?style=for-the-badge&logo=rust)](https://www.rust-lang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Phase%201%20MVP-brightgreen?style=for-the-badge)]()

</div>

---

## 🧠 The Problem

```
Session starts  →  AI reasons  →  Session ends  →  Memory: GONE
                                                         ↓
                                              Stored in vendor DB
                                              Owned by the platform
                                              Not portable
                                              Not verifiable
                                              Not yours
```

Every AI conversation today ends the same way: the session closes and memory disappears into a vendor's database — or into nothing. The user has no ownership, no portability, and no cryptographic proof of what was reasoned.

**This is the memory problem for the age of autonomous AI agents.**

When an AI agent completes a complex task — a legal analysis, a medical reasoning chain, a trading strategy — that cognitive work vanishes. There is no portable artifact. No verifiable proof it happened. No way for another agent, another app, or the user themselves to build on it.

CognChain fixes this at the infrastructure level.

---

## ⚡ What Is CognChain?

CognChain is an **on-chain memory primitive** built natively on Solana. It allows AI agents to:

- **Anchor cognitive outputs** as compact, verifiable records on-chain
- **Prove ownership** of memory through wallet-linked vault PDAs
- **Carry memory across apps** — no vendor lock-in, no platform dependency
- **Gate access** through scoped permission grants
- **Earn reputation** as memory records accumulate verifiable quality scores

It is not a model. It is not a database. It is the **settlement layer for machine cognition**.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        COGNCHAIN STACK                              │
├─────────────────────────────────────────────────────────────────────┤
│  AI Agent (Claude / GPT / Gemini / Custom)                          │
│         ↓  reasons, produces high-value output                      │
│  CognChain Off-chain Gateway                                        │
│         ↓  summarize → hash → policy check → ZK proof (Tier 2)     │
│  Solana Program (Anchor)                                            │
│         ↓  write MemoryRecord PDA → emit event → settle             │
│  User Memory Vault (PDA)                                            │
│         ↓  wallet-linked, portable, permissioned                    │
│  Any App / Agent  →  request scoped access  →  read memory          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Repository Structure

```
cognchain-program/
│
├── programs/
│   └── cognchain/
│       └── src/
│           └── lib.rs              ← Core Anchor program
│
├── tests/
│   └── cognchain.ts                ← Integration tests
│
├── client/
│   └── client.ts                   ← TypeScript client examples
│
├── docs/
│   ├── ARCHITECTURE.md             ← Deep-dive on account model
│   ├── ZK_PIPELINE.md              ← Groth16 circuit specification
│   ├── MEMORY_PRIMITIVE.md         ← SolanaMemoryRecord schema v0.8
│   └── SECURITY.md                 ← Threat model and audit checklist
│
├── scripts/
│   ├── create_vault.ts             ← CLI: create a memory vault
│   ├── write_memory.ts             ← CLI: write a memory record
│   └── read_memory.ts              ← CLI: read and verify a record
│
├── Anchor.toml
├── Cargo.toml
└── README.md
```

---

## 🔬 Core Primitive: The Memory Record

The `SolanaMemoryRecord` is the atomic unit of CognChain. It is a **compact, fixed-size Solana account** (152 bytes + 8 discriminator) designed for rent-exempt persistence with minimal on-chain footprint.

```rust
struct SolanaMemoryRecord {
    // Identity
    vault:        Pubkey,     // PDA of the owner's memory vault
    id:           u16,        // monotonic record ID within the vault
    authority:    Pubkey,     // agent or user who wrote this record

    // Content fingerprints — raw content NEVER touches the chain
    content_hash: [u8; 32],   // SHA-256 of the normalized reasoning payload
    summary_hash: [u8; 32],   // SHA-256 of the approved human-readable summary

    // Quality signals
    importance:   u16,        // 0–10,000 basis points (8500 = 85th percentile)
    agent_type:   u8,         // 0=Claude 1=GPT 2=Gemini 254=Custom 255=Open

    // Metadata
    bump:         u8,         // canonical PDA bump, stored to avoid re-derivation
    created_at:   i64,        // Unix timestamp at settlement
}
```

**Design decisions:**

| Choice | Rationale |
|---|---|
| Fixed-size account | Rent-exempt at deployment — no ongoing cost |
| Hashes only, no raw content | Privacy by default; content lives off-chain encrypted |
| `u16` importance (bps) | Integer math only — no floating point on-chain |
| Monotonic `id` | Deterministic PDA: `[b"record", vault, id.to_le_bytes()]` |
| `bump` stored | Avoids brute-force re-derivation on every CPI call |

---

## 🔐 Privacy Architecture: Three Tiers

```
Tier 1 — Hash Commitment (MVP · LIVE NOW)
─────────────────────────────────────────
  Content  →  SHA-256  →  stored on-chain
  Raw data →  encrypted  →  stored off-chain (user-controlled)
  Proof: content_hash matches stored hash ✓

Tier 2 — ZK-SNARK Attestation (Phase 2)
─────────────────────────────────────────
  Groth16 circuit proves THREE statements simultaneously:
  (1) Authorship   — agent holds the vault authority key
  (2) Quality      — ConfidenceBps > policy threshold
  (3) Compliance   — PolicyId satisfied by private reasoning trace

  On-chain verifier checks: proof + (vault_pda, content_hash, policy_id)
  Raw reasoning NEVER touches consensus.

Tier 3 — FHE over Ciphertext (Phase 4 · 2028+)
────────────────────────────────────────────────
  Validation over encrypted memory without decryption.
  Tracking: Zama.ai, TFHE-rs, Sunscreen.
  Target: medical, legal, defense verticals.
```

---

## 🤖 The Autonomous Agent: CognAgent

CognAgent is the reference implementation of an AI agent that uses CognChain as its memory backbone. It demonstrates the full autonomous loop:

```
┌──────────────────────────────────────────────────────────────────┐
│                        COGNAGENT LOOP                            │
│                                                                  │
│  1. PERCEIVE   →  Receive task (from user or another agent)      │
│  2. RETRIEVE   →  Fetch relevant memories from vault PDA         │
│  3. REASON     →  Call LLM with enriched context                 │
│  4. ACT        →  Execute tool calls, produce output             │
│  5. EVALUATE   →  Score output quality (importance bps)          │
│  6. ANCHOR     →  Hash + write MemoryRecord to Solana            │
│  7. LOOP       →  Next task starts with richer verified context  │
│                                                                  │
│  Each cycle compounds verifiable cognitive history on-chain.     │
└──────────────────────────────────────────────────────────────────┘
```

**What makes CognAgent different from a standard AI agent:**

- Memory persists **across sessions** — the agent remembers yesterday's reasoning
- Memory is **portable** — switch LLM providers without losing history
- Memory is **verifiable** — any auditor can confirm the hash on Solana Explorer
- Memory is **permissioned** — other agents request access via `PermissionGrant` PDA
- Agent builds **on-chain reputation** — importance scores accumulate as a trust signal

**Agent identity model:**
```
Wallet keypair  →  signs all vault writes
    ↓
Vault PDA       →  deterministic address per wallet
    ↓
MemoryRecord[]  →  growing set of verified cognitive outputs
    ↓
Reputation      →  avg(importance_bps) across records → verifiable score
```

---

## 📐 Account Architecture

```
User Wallet (signer)
    │
    ├── Vault PDA
    │   seeds: [b"vault", wallet.pubkey]
    │   Stores: label, record_count, bump, created_at
    │   Size: 119 bytes → rent-exempt ~0.0009 SOL (one-time)
    │
    ├── MemoryRecord PDA #0
    │   seeds: [b"record", vault.pubkey, 0u16.to_le_bytes()]
    │   Stores: hashes, importance, agent_type, timestamp
    │   Size: 152 bytes → rent-exempt ~0.0011 SOL (one-time)
    │
    ├── MemoryRecord PDA #1
    │   seeds: [b"record", vault.pubkey, 1u16.to_le_bytes()]
    │
    ├── MemoryRecord PDA #N  (max 1,000 per vault)
    │
    └── PermissionGrant PDA  (Phase 2)
        seeds: [b"grant", vault.pubkey, agent.pubkey, policy_id]
        Closing this account reclaims rent instantly.
```

**Total cost for 100 memory records:** ~0.11 SOL (~$0.02). No recurring fees.

---

## 🛠️ Instructions

### `create_vault`
Creates a deterministic PDA vault for the signer. One vault per wallet.

```typescript
const [vaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), wallet.publicKey.toBuffer()],
  programId
);

await program.methods
  .createVault("My Agent Vault")
  .accounts({ vault: vaultPda, authority: wallet.publicKey })
  .rpc();
```

### `write_memory`
Writes a new `MemoryRecord` PDA. Atomically increments vault counter. Emits `MemoryWritten` event.

```typescript
const contentHash = sha256(normalizedPayload);   // off-chain
const summaryHash = sha256(approvedSummary);     // off-chain

await program.methods
  .writeMemory(
    Array.from(contentHash),   // [u8; 32]
    Array.from(summaryHash),   // [u8; 32]
    8500,                       // importance: 85th percentile
    0                           // agent_type: Claude
  )
  .accounts({ vault: vaultPda, record: recordPda, authority: wallet.publicKey })
  .rpc();
```

### `read_memory`
Emits `MemoryRead` event. Used by indexers to track access patterns and build reputation graphs.

```typescript
await program.methods
  .readMemory()
  .accounts({ vault: vaultPda, record: recordPda, authority: wallet.publicKey })
  .rpc();
```

---

## 🚀 Live Deployment

| Network | Program ID | Explorer |
|---------|-----------|---------|
| **Devnet** | `9eBY2Tezy2z2nYqUBHzDitQRDnMbPuHYz8qj25fTWCPD` | [View ↗](https://explorer.solana.com/address/9eBY2Tezy2z2nYqUBHzDitQRDnMbPuHYz8qj25fTWCPD?cluster=devnet) |
| Mainnet | Pending Phase 1 audit | — |

**Verified transactions:**

| Instruction | Signature | Explorer |
|---|---|---|
| `create_vault` | `VEvCHTZ...jGMgo` | [View ↗](https://explorer.solana.com/tx/VEvCHTZNomJ7Ashss7JYfNqTor9VPykDGRX7cs4xQHju6zbHRvUSyd3QARWp8A2qhVQeYgg7qWmFCLeWBsjGMgo?cluster=devnet) |
| `write_memory` | `4jDBCLv...VXmb` | [View ↗](https://explorer.solana.com/tx/4jDBCLvkE3zvE1uEm2r38gdMWByhaKsNAKh2XVvjmWtMKCgMNrwFAMrT2MfXT9c4YpLT6QjpDbAw9SX7UXyvVXmb?cluster=devnet) |

---

## 🗺️ Roadmap

```
Phase 0 ✅  Positioning, spec, whitepaper, account model
            └── Completed April 2026

Phase 1 🔄  Solana MVP (IN PROGRESS)
            ├── ✅ Core Anchor program (create_vault, write_memory, read_memory)
            ├── ✅ Devnet deployment live
            ├── ✅ First verified on-chain transactions
            ├── 🔄 TypeScript SDK (npm package)
            ├── 🔄 PermissionGrant instruction
            ├── 🔄 Feedback / checkpoint instruction
            └── 🔄 External security audit (Ottersec / Neodyme)

Phase 2     Developer Platform
            ├── SDK + REST API gateway
            ├── Agent reputation graph
            ├── ZK Tier-2 (Groth16 + on-chain verifier)
            └── First app integrations

Phase 3     Scale & Enterprise
            ├── Light Protocol ZK compression
            ├── Metaplex MPL vault ownership proofs
            ├── Enterprise policy presets + SLAs
            └── Cross-app memory portability standard

Phase 3.5   Monetization & Grants
            ├── API usage billing
            ├── Solana Foundation Developer Ecosystem Fund
            ├── Colosseum hackathon
            └── First enterprise partners

Phase 4     The Cognitive Standard
            └── FHE Tier-3 privacy (2028+)
```

---

## 🔧 Solana Ecosystem Integrations

| Protocol | Role |
|---|---|
| **Anchor** | Account constraints, PDA derivation, instruction dispatch |
| **Light Protocol** | ZK state compression for episodic memory (Phase 2) |
| **Metaplex MPL** | Vault ownership proofs, cross-app portability (Phase 3) |
| **Squads Protocol** | Multisig upgrade authority (mainnet) |
| **Wallet Adapter** | Phantom, Backpack, Solflare — wallet-native from day one |

---

## 💰 Cost Model

| Item | Cost |
|---|---|
| Vault account (one-time rent) | ~0.0009 SOL |
| Memory record (one-time rent) | ~0.0011 SOL |
| Compute per write | ~5,000–8,000 CU |
| Transaction fee | ~0.000005 SOL |
| **100 records total** | **~0.11 SOL (~$0.02)** |

No token required. No recurring fees. All accounts are rent-exempt.

---

## 🏆 Why Solana

| Requirement | Why Solana wins |
|---|---|
| Sub-cent writes at scale | 400ms finality, ~$0.001 per tx |
| Deterministic addressing | `findProgramAddress` → canonical vault per wallet |
| Composability | Any Solana app can CPI into CognChain vaults |
| AI agent economy 2026 | Solana Foundation AI + x402 grants actively funded |
| ZK infrastructure | Light Protocol, ZK compression native to Solana |

---

## 🔒 Security Model

**Anchor constraints enforced on every instruction:**
- `has_one = authority` — unauthorized writes rejected at program level
- `seeds` validation — account substitution attacks structurally impossible
- `bump` stored in account — no re-derivation brute-force on CPI
- Agent delegation via `PermissionGrant` PDA — revoking closes account, reclaims rent

**Upgrade authority path:**
1. Team wallet (devnet) → now
2. Squads multisig (team + advisor) → before mainnet
3. DAO governance or burned → after battle-testing

---

## 📦 Getting Started

```bash
# Clone
git clone https://github.com/Edencrypto-IA/cognchain-program
cd cognchain-program

# Build
anchor build

# Deploy to devnet
solana config set --url devnet
anchor deploy --provider.cluster devnet

# Run client
anchor run client
```

---

## 🤝 Contributing

We are building in public. Actively seeking:

| Role | Contact |
|---|---|
| Anchor engineers (adversarial review) | research@cognchain.xyz |
| ZK researchers (Groth16 circuits) | research@cognchain.xyz |
| AI infrastructure (SDK integrations) | hello@cognchain.xyz |
| Enterprise pilots | hello@cognchain.xyz |

---

## 👤 Team

**Eden Lucas Cavalcanti de Oliveira** — Founder  
Civil engineer, workplace safety technician, business administration. Builder across civic tech, GovTech, AI tooling and Solana ecosystem — RadarPolítico BR, Lumina AI, Moreno Smart City. Full-time on CognChain since Q1 2026. Recife, Brazil.

- GitHub: [@Edencrypto-IA](https://github.com/Edencrypto-IA)
- X: [@PenguPudgyPump](https://x.com/PenguPudgyPump)
- Instagram: [@lucas_gcavalcanti](https://instagram.com/lucas_gcavalcanti)
- Email: hello@cognchain.xyz

---

## 📄 License

MIT — see [LICENSE](LICENSE)

---

<div align="center">

**CognChain — The Solana-native memory layer for AI ownership, trust and portability.**

*Made for machines, by humans.*

`9eBY2Tezy2z2nYqUBHzDitQRDnMbPuHYz8qj25fTWCPD`

[Solana Explorer ↗](https://explorer.solana.com/address/9eBY2Tezy2z2nYqUBHzDitQRDnMbPuHYz8qj25fTWCPD?cluster=devnet) · [Whitepaper ↗](https://cognchain.xyz) · [X ↗](https://x.com/PenguPudgyPump)

</div>
