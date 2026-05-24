<div align="center">

```
 ██████╗ ██████╗  ██████╗ ███╗   ██╗ ██████╗██╗  ██╗ █████╗ ██╗███╗   ██╗
██╔════╝██╔═══██╗██╔════╝ ████╗  ██║██╔════╝██║  ██║██╔══██╗██║████╗  ██║
██║     ██║   ██║██║  ███╗██╔██╗ ██║██║     ███████║███████║██║██╔██╗ ██║
██║     ██║   ██║██║   ██║██║╚██╗██║██║     ██╔══██║██╔══██║██║██║╚██╗██║
╚██████╗╚██████╔╝╚██████╔╝██║ ╚████║╚██████╗██║  ██║██║  ██║██║██║ ╚████║
 ╚═════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝
```

**The Verifiable Memory Layer for AI · Built on Solana**

[![Solana Devnet](https://img.shields.io/badge/Solana-Devnet%20Live-9945FF?style=for-the-badge&logo=solana&logoColor=white)](https://explorer.solana.com/address/BgrtrSJ53Uhp69sS8JfD414M1kujdR5ruhHc9wRbhiEL?cluster=devnet)
[![Anchor](https://img.shields.io/badge/Anchor-Framework-00D1FF?style=for-the-badge)](https://anchor-lang.com)
[![Rust](https://img.shields.io/badge/Rust-100%25-f74c00?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![ZK Ready](https://img.shields.io/badge/ZK-Groth16%20Ready-14F195?style=for-the-badge)](https://docs.circom.io)
[![License MIT](https://img.shields.io/badge/License-MIT-white?style=for-the-badge)](LICENSE)
[![Built in Public](https://img.shields.io/badge/Building-In%20Public-FF6B35?style=for-the-badge)](https://x.com/PenguPudgyPump)

<br/>

*AI sessions end. Memory shouldn't.*

<br/>

[🔭 Explorer](https://explorer.solana.com/address/BgrtrSJ53Uhp69sS8JfD414M1kujdR5ruhHc9wRbhiEL?cluster=devnet) · [📄 Whitepaper](https://htmlpreview.github.io/?https://github.com/Edencrypto-IA/cognchain-program/blob/main/CognChain_Solana_V11.html) · [🌐 Website](https://cognchain-program-production.up.railway.app) · [✉️ Contact](mailto:hello@cognchain.xyz)

</div>

---

## Demo path for judges

Start with the main chat to understand the core product: CognChain lets users talk to multiple AI models while preserving portable memory across sessions and providers.

1. Open the live app and click **Run Hackathon Demo**.
2. Watch one model create a memory, save it with a hash, and hand it off to another model.
3. Copy the generated memory hash and paste it back into the chat.
4. Switch models, for example GPT-4o to Claude, Gemini, DeepSeek, or NVIDIA.
5. The next model should continue from the verified memory context instead of starting from zero.

The goal of the demo is simple: show that AI memory can survive model changes, session changes, and provider lock-in.

## Caminho rapido da demo

Comece pelo chat principal para entender o produto: o CognChain permite conversar com varias IAs mantendo uma memoria portavel entre sessoes e provedores.

1. Abra o app ao vivo e clique em **Run Hackathon Demo**.
2. Veja uma IA criar uma memoria, salvar com hash e passar o contexto para outra IA.
3. Copie o hash gerado e cole novamente no chat.
4. Troque de modelo, por exemplo GPT-4o para Claude, Gemini, DeepSeek ou NVIDIA.
5. A proxima IA deve continuar a partir da memoria verificada, sem recomecar do zero.

Esse e o ponto central: a memoria da IA continua mesmo quando o usuario troca de modelo, sessao ou provedor.

## Latest update - Mythos Agent Bridge

Mythos is now the first official external agent integration for CognChain.

The goal is simple: any serious autonomous agent should be able to create memory that is portable, authenticated, auditable, and safe to verify later. Mythos brings that idea into a real agent runtime instead of keeping it as a chat-only demo.

### What is live now

- **Agent Memory Bridge APIs** for external agents:
  - `GET /api/memory/health`
  - `POST /api/memory/write`
  - `GET /api/memory/list`
  - `GET /api/memory/{hash}`
  - `GET /api/memory/{hash}/proof`
  - `GET /api/memory/verify/{hash}`
- **Authenticated agent keys** through `/dashboard/keys`.
- **Source isolation** for `mythos`, `hermes`, `openclaw`, `eliza`, and other external agents.
- **Mythos vault metadata** with `source=mythos`, `agentId`, `contentType`, owner, hash, read URL, proof URL, and verify URL.
- **Memory Brain agent routes** so Mythos memories can be reviewed separately from NVIDIA, GPT, Claude, MiniMax, Qwen, and other model memories.
- **Mythos page** at `/mythos` with:
  - capability map;
  - readiness panel;
  - market differentiator panel;
  - cognitive flight recorder;
  - memory replay model;
  - agent-to-agent memory standard;
  - safe execution ladder;
  - Solana builder copilot overview;
  - productization path;
  - runtime proof;
  - skill library;
  - safety boundaries;
  - English/PT toggle.
- **Mythos Lab** at `/mythos/lab` for safe browser-based testing.
- **Mythos Solana Developer Console** at `/mythos/solana` with a real server-side engine for:
  - transaction signature analysis through read-only Solana RPC or Helius;
  - wallet intelligence for public Phantom/Solflare addresses, including SOL balance, recent activity, failed transactions, token exposure, and sampled program families;
  - token mint risk scanning, including supply, decimals, mint authority, freeze authority, holder concentration, and recent mint activity;
  - Anchor/program debugging from logs, program IDs, and account evidence;
  - wallet/RPC issue explanation using live health, version, epoch, and blockhash checks;
  - threat level, AI confidence, memory match, live chain monitor, and memory replay cards;
  - cognitive trace output covering perception, evidence, skill, decision, prediction, boundary, and next step;
  - explicit "Save to CongChain" flow that writes only an approved summary through `POST /api/memory/write`.

New Solana copilot endpoints:

- `POST /api/mythos/solana/analyze-transaction`
- `POST /api/mythos/solana/analyze-wallet`
- `POST /api/mythos/solana/analyze-token`
- `POST /api/mythos/solana/debug-anchor`
- `POST /api/mythos/solana/explain-rpc`

Wallet and token scans are public on-chain risk intelligence only. They do not provide financial advice, trading instructions, wallet signatures, transaction submission, or fund movement.
- **CongChain skill pack for Mythos** under `integrations/mythos/skills/congchain`.
- **Runtime adapter skeleton** under `integrations/mythos/plugins/congchain-adapter`.
- **NVIDIA router skill/plugin draft** for model-routing recommendations without pretending to override unsupported runtime internals.

### Mythos Solana engine configuration

The Solana console keeps provider credentials server-side. Configure one of these in Railway:

```text
HELIUS_API_KEY=...
```

or:

```text
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
SOLANA_DEVNET_RPC_URL=https://api.devnet.solana.com
```

The browser never receives the Helius key. The engine only performs read-only RPC calls such as `getTransaction`, `getAccountInfo`, `getHealth`, `getVersion`, `getEpochInfo`, and `getLatestBlockhash`. It does not sign, submit, simulate fund movement, request wallet approval, or store provider secrets.

### Mythos capability snapshot

Current audited inventory for the Mythos integration:

| Area | Count | Meaning |
|---|---:|---|
| Skills | 168 | Core and optional skills available to the Mythos runtime |
| CongChain skills | 22 | Official skills for bridge, audit, memory search, Solana review, Web3 research, deployment, orchestration, export, rollback, and governance |
| Memory providers | 9 | 8 original memory providers plus CognChain as the verifiable memory layer |
| LLM providers | 28 | Multi-provider model access for reasoning, coding, research, and long-context work |
| Messaging platforms | 19 | External channels supported by the Mythos ecosystem when configured |
| LSPs | 26 | Language-aware development support for code understanding |
| Tool files | 76 | Tooling surface across terminal, browser, files, web, media, planning, delegation, and more |

### Runtime proof completed

A local Mythos runtime was connected to CognChain and validated with a real memory write/read/verify flow.

Proof summary:

- Mythos wrote a safe memory through the authenticated bridge.
- CognChain returned a stable hash.
- The memory was readable by hash.
- Verification endpoint confirmed the record exists.
- The memory appeared under a Mythos vault namespace.
- No private keys, seed phrases, signed payloads, wallet secrets, or fund-moving data were stored.

Current proof hash:

```text
b727b1e1715680f4ef234f4d46cc76e7625ff36c1594a4165baf71c8cc1b570c
```

Important boundary: this proves the authenticated Agent Memory Bridge path. It does **not** claim that every Mythos runtime event is already finalized on-chain. On-chain anchoring and ZK persistence are explicit states and are only shown as active when the corresponding flow actually persists them.

### How an external agent writes memory

External agents use a CognChain API key and send memory with agent metadata:

```bash
curl -X POST https://cognchain-program-production.up.railway.app/api/memory/write \
  -H "Authorization: Bearer cog_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Mythos completed a safe runtime test and summarized the result.",
    "model": "mythos",
    "metadata": {
      "source": "mythos",
      "contentType": "mythos_memory",
      "agentId": "mythos-local",
      "agentName": "Mythos",
      "namespace": "mythos"
    }
  }'
```

The response includes:

- `hash`
- `timestamp`
- `owner`
- `vault`
- `readUrl`
- `proofUrl`
- `verifyUrl`
- safety flags

### Safety contract

CognChain memory is not a wallet executor.

The Mythos bridge must not:

- store API keys, bot tokens, private keys, seed phrases, or signed payloads;
- buy, sell, pay, schedule, sign, submit, or move funds;
- claim on-chain finality unless a real anchor transaction exists;
- mix Mythos vaults with Hermes, OpenClaw, Eliza, or model-provider memory;
- expose user provider credentials in public UI, logs, memory, screenshots, or runtime proof.

Every value-moving action remains outside the memory bridge and must require explicit user approval plus wallet-side signature.

### Productization path

The local Mythos lab is now being turned into a public, user-safe product flow:

1. Secure configuration surface for user-owned provider keys.
2. Optional server-managed providers for safe demo mode.
3. Per-user sandbox/runtime isolation before real autonomous execution.
4. Backend execution receipts with model, provider, skill, tool, duration, hash, and safety result.
5. Explicit memory consent before saving user task output.
6. Public Mythos flow: choose skill, choose provider mode, run safely, inspect trace, save memory, verify hash.

This is the bridge from "developer runtime works locally" to "every CognChain user can safely connect an external agent."

## CongChain Forge - AI IDE Sandbox

CongChain Forge (`/forge`) is the new AI-native build workspace inside CognChain. It presents a Cursor-style terminal and preview environment where agents can stream plans, generate structured file proposals, show diffs, and apply proposals into a local sandbox session.

Forge is intentionally safe in this phase:

- Real SSE streaming through `POST /api/forge/chat`
- Structured file proposals with code, diff, preview, and explorer views
- Local sandbox sessions with explicit **Apply Proposal**
- No automatic production writes
- No automatic deployment
- No changes to Memory Brain, Solana flows, wallet auth, or the main chat contract

Forge is designed to become the place where users ask AI agents to build apps, APIs, components, agents, and Solana-native systems while seeing the work happen live.

---

<div align="center">

**Language / Idioma / 语言**

[🇺🇸 English](#-english) · [🇧🇷 Português](#-português) · [🇨🇳 中文](#-中文)

</div>

---

<br/>

# 🇺🇸 English

## What is CognChain?

CognChain is the missing memory layer for AI systems. Today, every AI session ends and its insights vanish into vendor databases — inaccessible, non-portable, and unprovable. CognChain inverts that: **high-value AI outputs are crystallized into compact, hash-committed records anchored permanently on Solana**, where users own the vault and agents earn reputation through verifiable history.

> *Not model weights. Not raw logs. Portable, verifiable cognitive checkpoints — owned by the user, trusted by any agent.*

---

## ⚡ Program ID (Devnet)

```
BgrtrSJ53Uhp69sS8JfD414M1kujdR5ruhHc9wRbhiEL
```

[![View on Explorer](https://img.shields.io/badge/View%20on-Solana%20Explorer-9945FF?style=flat-square&logo=solana)](https://explorer.solana.com/address/BgrtrSJ53Uhp69sS8JfD414M1kujdR5ruhHc9wRbhiEL?cluster=devnet)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       APPLICATION LAYER                             │
│   AI Agents · Copilots · Research Tools · Enterprise Apps           │
│   8 Models: GPT-4o · Claude · Llama · Gemini · DeepSeek             │
│             GLM-4.7 · MiniMax M2.7 · Qwen3 80B                      │
└──────────────────┬──────────────────────┬───────────────────────────┘
                   │  Chat + Memory       │  Intelligence Services
┌──────────────────▼──────────┐  ┌────────▼──────────────────────────┐
│     MEMORY BRAIN            │  │    AGENT OFFICE + PAY             │
│  Force-directed graph        │  │  Live AI economy dashboard        │
│  Neural memory visualization │  │  6 real services · SOL payments   │
│  Chat memories + Agent cards │  │  Market signals · DeFi yields     │
│  ZK rings · on-chain glow    │  │  Wallet intel · Research          │
└──────────────────┬──────────┘  └────────┬──────────────────────────┘
                   │                       │
┌──────────────────▼───────────────────────▼──────────────────────────┐
│                   PROOF OF INSIGHT (PoI)                            │
│   Human voting (3 votes avg ≥ 7) → Auto-anchor on Solana           │
│   SHA-256 hash · ZK Proof (Groth16) · Trust Score                  │
│   Grounding Engine: Binance · CoinGecko · DeFiLlama · Helius        │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  Verified Memory Candidates
┌──────────────────────────▼──────────────────────────────────────────┐
│                  COGNCHAIN ANCHOR PROGRAM                           │
│              BgrtrSJ53Uhp69sS8JfD414M1kujdR5ruhHc9wRbhiEL          │
│                                                                      │
│  create_vault  │  write_memory  │  read_memory                      │
│  PDA Vaults    │  152-byte records │  Permission grants              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  On-chain: hashes + scores + proofs
┌──────────────────────────▼──────────────────────────────────────────┐
│                    HYBRID STORAGE                                   │
│   Solana: ContentHash · SummaryHash · ConfidenceBps · PolicyId      │
│   Off-chain: Encrypted content · Vectors · Session traces           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔬 The Memory Record

```rust
// 152-byte fixed-size account — zero heap allocation, predictable rent
pub struct SolanaMemoryRecord {
    pub vault:              Pubkey,    // User memory vault PDA
    pub memory_id:          u64,       // Monotonic ID inside vault
    pub writer_agent:       Pubkey,    // Delegated agent or user authority

    // Content fingerprints — never raw text on-chain
    pub content_hash:       [u8; 32],  // SHA-256 of normalized payload
    pub summary_hash:       [u8; 32],  // SHA-256 of approved summary
    pub source_hash:        [u8; 32],  // SHA-256 of source bundle

    // Quality signals
    pub policy_id:          u16,       // Permission / retention policy
    pub confidence_bps:     u16,       // Confidence score (basis points)
    pub importance_bps:     u16,       // Importance score (basis points)

    // Provenance
    pub extraction_version: [u8; 8],   // Crystallizer version
    pub source_agent_type:  AgentType, // Claude=0, GPT=1, Gemini=2, ...
    pub created_at:         i64,       // Unix timestamp
}

// 100 records ≈ 0.11 SOL rent-exempt deposit · no recurring fees
```

---

## 🔗 Cross-Model Memory Chain — Live Demo

This is CognChain's core proof-of-concept: **one AI starts, saves memory, another AI picks up the hash and goes deeper — verified on-chain, no data loss, no vendor lock-in.**

```
GPT-4o  ──saves──▶  Hash 202fe03d...  ──▶  Claude Opus reads hash ──▶  DeepSeek reads both hashes
   │                    │ (Solana)              │                              │
   │                    │                       │                              │
Macro market         On-chain             Technical arch            90-day execution plan
analysis           forever                deep-dive                with Rust SDK + sprints
```

### How it works when a model retrieves a hash:

When any AI model receives a message referencing a CognChain hash, it **opens with a verified memory header**:

```
⚡ Memória Verificada · CognChain on Solana
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hash: 202fe03d9c1b7af0...e1d43b9
Origem: GPT-4o · 01 Mai 2026 · 14:32 UTC
Status: ✓ On-chain · Solana Devnet · Score: —
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Continuando e aprofundando a partir desta base verificada:
[deeper analysis starts here]
```

### Live chain executed on 01 May 2026:

| Step | Model | Prompt | Hash saved | What it did |
|---|---|---|---|---|
| 1 | **GPT-4o** | Analise o potencial de IA na Solana 2026 | `202fe03d...` | Oportunidades macro, TAM, riscos de mercado |
| 2 | **Claude Opus** | Recebe hash `202fe03d` → aprofunde tecnicamente | `2d4a1330...` | Tabela de arquiteturas on-chain viáveis, posicionamento CONGCHAIN, modelo de crescimento |
| 3 | **DeepSeek V3** | Recebe hashes `202fe03d` + `2d4a1330` → plano de ação | `4273a923...` | Plano 90 dias: SDK Rust, CLI, sprints, métricas, canais, 100 primeiros devs |

> Each hash is a permanent, immutable record on Solana devnet. Any model, any time, can retrieve and build on top of them.

---

## 🤖 Agent Office — Live AI Economy Dashboard

The Agent Office (`/office`) is a real-time dashboard where autonomous AI agents run live tasks and their outputs are stored as verifiable memories on-chain.

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENT OFFICE                             │
│  ▶ Play / ⏸ Pause scheduler — user-controlled              │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  VEGA    │  │  NEXUS   │  │  NOVA    │  │  ECHO    │   │
│  │ Market   │  │  DeFi    │  │Sentiment │  │ Research │   │
│  │ Signal   │  │  Yield   │  │  Scan    │  │  Agent   │   │
│  │ Llama3.3 │  │  GLM-4.7 │  │  Qwen3   │  │ MiniMax  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  Live data sources:  Binance · CoinGecko · DeFiLlama        │
│  Outputs → [AGENT_INSIGHT] memories → anchored on Solana    │
│  Chat integration → amber banner shows agent findings       │
└─────────────────────────────────────────────────────────────┘
```

**Agent skills — each fetches live data before calling AI:**

| Agent | Data Source | AI Model | Output |
|---|---|---|---|
| VEGA | Binance live prices | Llama 3.3 70B | Trade signals with entry/exit levels |
| NEXUS | DeFiLlama TVL | GLM-4.7 | Top yield opportunities across protocols |
| NOVA | CoinGecko multi-asset | Qwen3 80B | Sentiment positioning + market outlook |
| ECHO | On-chain Helius data | MiniMax M2.7 | Wallet behavior analysis |
| APEX | Combined feeds | GPT-4o | Deep cross-asset research |
| ARES | Protocol metrics | Claude | Security and risk audit |
| FLUX | Macro indicators | DeepSeek V3 | Macro thesis + narrative |
| ZION | All sources | Llama 3.3 | Synthesis and executive brief |

Agent outputs flow into the Memory Brain **Agentes tab** as holographic cards — fully separate from chat memories.

---

## 💎 CONGCHAIN Pay — Intelligence Services

Pay with SOL to receive real AI-powered intelligence grounded in live on-chain and market data.

```
User pays SOL → Live data fetched → AI generates insight → Result saved to Memory Brain
```

| Service | Price | Data Source | Model | Output |
|---|---|---|---|---|
| Market Signal | 0.005 SOL | Binance live OHLCV | Llama 3.3 | Trade signal with levels |
| DeFi Yield Scan | 0.008 SOL | DeFiLlama TVL | GLM-4.7 | Best yield opportunities |
| Wallet Intelligence | 0.010 SOL | Helius on-chain | Qwen3 80B | Complete wallet profile |
| AI Research Report | 0.020 SOL | All sources | GPT-4o | Deep research document |
| Sentiment Scan | 0.005 SOL | CoinGecko 10 assets | MiniMax M2.7 | Market positioning |
| Protocol Audit | 0.015 SOL | Protocol metrics | Claude | Security risk assessment |

Every paid intelligence report is saved as a `[INTELLIGENCE_SERVICE]` memory — verifiable, on-chain, permanent.

---

## 🧠 Memory Brain — Neural Visualization

The Memory Brain (`/brain`) is a force-directed neural graph of all AI conversation memories, with a separate holographic view for autonomous agent decisions.

**Two views:**

| View | What it shows |
|---|---|
| Memórias (graph) | Force-directed graph of all chat memories — colored by AI model, ZK rings for verified records, on-chain glow for anchored memories |
| Agentes (cards) | Holographic cards for agent-generated memories — each card shows the agent avatar (HologramFace), service name, SOL paid, and a 160-char insight snippet |

**Graph features:**
- Click any node → see full memory content + SHA-256 hash + ZK proof status
- Delete individual nodes
- Command input to query memories
- Optimized for 100+ nodes: link capping prevents O(n²) explosion
- Mobile-friendly touch navigation

**Agent card features:**
- Click any card → full analysis modal with proof bundle
- SOL paid badge (for paid intelligence services)
- Model identity with holographic face avatar
- Hash + blockchain verification status

---

## ✅ What's Live

| Feature | Status | Details |
|---|---|---|
| Anchor Program | ✅ Devnet | `create_vault`, `write_memory`, `read_memory` |
| Multi-Provider AI Router | ✅ Live | **8 models** — GPT-4o, Claude Opus 4.7, NVIDIA Llama 3.3, Gemini 2.0 Flash, DeepSeek V3, GLM-4.7, MiniMax M2.7, Qwen3 80B |
| Free / Pro Tier | ✅ Live | 4 free models (NVIDIA · GLM · MiniMax · Qwen) + 4 Pro models ($5/month) |
| Memory Brain — Graph | ✅ Live | Force-directed neural graph · color by model · ZK rings · on-chain glow · delete nodes |
| Memory Brain — Agentes | ✅ Live | Holographic card grid for autonomous agent memories · full analysis modal |
| Agent Office | ✅ Live | Live AI economy dashboard · 8 agents · Play/Pause scheduler · SSE streaming |
| Real Agent Skills | ✅ Live | Binance live data · DeFiLlama TVL · CoinGecko sentiment → AI analysis |
| Agent→Chat Integration | ✅ Live | Agent insights surface as amber banner in chat interface |
| CONGCHAIN Pay | ✅ Live | 6 intelligence services · SOL micropayments · results saved as verified memories |
| Grounding Engine | ✅ Live | 8-layer pipeline: Binance · CoinGecko · DeFiLlama · Helius · multi-token support |
| Admin Login | ✅ Live | Cookie-based admin session · unlocks all Pro models instantly |
| Proof of Insight (PoI) | ✅ Live | Human voting → threshold → auto-anchor on Solana |
| Memory Audit Trail | ✅ Live | Memory Chain · Evidence Record · ZK Proof Stack |
| ZK Proof Pipeline | ✅ Live | Circom + snarkjs Groth16 · simulated mode active |
| Agent Builder | ✅ Live | Create, configure, deploy AI agents with verifiable memory |
| Agent-to-Agent Economy | ✅ Live | Task marketplace · bot loop demo · on-chain proof of completion |
| Autonomous Loop | ✅ Live | Fetch memories → AI synthesis → anchor proof on Solana |
| Intelligence Score | ✅ Live | 0–100 composite · 5 levels: Nascente → Mestre |
| Memory Inheritance | ✅ Live | Seed agents with verified on-chain memories |
| Solana Sage Agent | ✅ Live | Autonomous Solana monitor with 7-layer security |
| Solana Intent Queue | ✅ Live | Human-confirmed transactions · simulation before approval |
| Wallet Connection | ✅ Live | Phantom · Solflare · Backpack via Wallet Standard · dark modal |
| Helius RPC + Proxy | ✅ Live | Premium devnet RPC · API key secured server-side |
| MCP Server | ✅ Live | 7 tools via Memory Internet Protocol |

---

## 🛡️ Solana Intent Queue — 7-Layer Security

CognChain's transaction security model ensures no agent can execute blockchain operations without explicit human approval:

```
Layer 1 — Read-only by default    Agent can read any data, never write autonomously
Layer 2 — Intent Queue            All transactions queued as "pending intents"
Layer 3 — Human approval required User sees intent + description → Approve or Reject
Layer 4 — Simulation first        Every tx simulated on devnet before showing to user
Layer 5 — Program whitelist       Only Jupiter V6 swaps + native SOL transfers allowed
Layer 6 — Amount caps             Max 0.5 SOL per swap · max 0.1 SOL per transfer
Layer 7 — Expiry + rate limit     Intents expire in 10 min · max 5 per hour · no duplicates
```

---

## 🔐 Privacy Architecture

```
Tier 1 — Public      Hash commitments on Solana · fully auditable
Tier 2 — ZK-Private  Groth16 proofs · proves quality without revealing content
                     Ideal for: finance · legal · medical · enterprise
Tier 3 — TEE + FHE   Long-term research · Phase 4 (2028+) · tracking Zama.ai
```

**What the ZK circuit proves (Tier 2):**
1. **Authorship** — ContentHash was produced by the agent holding vault authority
2. **Quality threshold** — ConfidenceBps and ImportanceBps exceed policy minimums
3. **Policy compliance** — PolicyId was satisfied by the private reasoning trace

---

## 🚀 Quick Start

### Prerequisites

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor
npm install -g @coral-xyz/anchor-cli

# Configure devnet
solana config set --url devnet
```

### Clone & Build

```bash
git clone https://github.com/Edencrypto-IA/cognchain-program
cd cognchain-program

# Install dependencies
bun install   # or: npm install

# Build Anchor program
anchor build

# Run tests
anchor test --provider.cluster devnet
```

### Create Your First Memory Vault

```typescript
import * as anchor from "@coral-xyz/anchor";
import { CognchainProgram } from "./target/types/cognchain";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = anchor.workspace.CognchainProgram as Program<CognchainProgram>;

// Derive vault PDA
const [vaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), provider.wallet.publicKey.toBuffer()],
  program.programId
);

// Create vault
await program.methods
  .createVault()
  .accounts({ vault: vaultPda, user: provider.wallet.publicKey })
  .rpc();

// Anchor a memory record
const contentHash = sha256("Your AI session insight here");
await program.methods
  .writeMemory(Array.from(contentHash), 8500, 9200) // confidence + importance bps
  .accounts({ vault: vaultPda, memory: memoryPda, user: provider.wallet.publicKey })
  .rpc();

console.log("Memory anchored on Solana ✅");
```

---

## 💰 Cost Model

```
1 memory record   ≈ 0.0011 SOL  (~$0.09)   one-time rent-exempt deposit
100 records       ≈ 0.11 SOL   (~$9.00)   no recurring fees
1,000 records     ≈ 1.10 SOL   (~$90.00)  indefinite persistence
```

> Accounts are rent-exempt by design. Pay once, persist forever. ~5,000–8,000 CUs per write instruction.

---

## 🗺️ Roadmap

```
✅ Phase 0   Specification · Schema · Anchor account map
✅ Phase 1   Devnet deployment · Memory Engine · 8-model AI router
             PoI voting · ZK proofs · Agent Builder · Marketplace
             Autonomous loop · Intelligence Score · Wallet Connection
             Solana Sage · Intent Queue · Helius RPC · MCP Server
✅ Phase 2   Agent Office (live AI economy) · CONGCHAIN Pay (SOL micropayments)
             Intelligence Services (6 real services with live market data)
             Memory Brain Agentes tab (holographic cards)
             Grounding engine (Binance · CoinGecko · DeFiLlama · Helius)
             Agent→Chat integration · Wallet Standard support
🔜 Phase 3   SDK release · Indexer · API gateway · First integrations
             Agent reputation · Policy presets · Observability
🔜 Phase 4   Groth16 in production · Enterprise tooling · Cross-app portability
🔜 Phase 5   TEE + FHE research · Cognitive standard
```

---

## 📁 Repository Structure

```
cognchain-program/
├── programs/
│   └── cognchain/src/
│       └── lib.rs              Core Anchor program (Rust)
├── tests/
│   └── cognchain.ts            Integration tests
├── client/
│   └── client.ts               TypeScript SDK examples
├── src/
│   ├── app/
│   │   ├── brain/              Memory Brain — neural graph + agent cards
│   │   ├── office/             Agent Office — live AI economy dashboard
│   │   ├── pay/                CONGCHAIN Pay — intelligence services
│   │   ├── chat/               Multi-model AI chat
│   │   └── api/
│   │       ├── memory/         Memory CRUD + graph + agent cards
│   │       ├── office/         SSE stream + agent snapshots
│   │       └── pay/            Intelligence services + SOL payment
│   ├── lib/
│   │   ├── grounding/          8-layer data pipeline (Binance, CoinGecko, etc.)
│   │   └── db.ts               Prisma database client
│   └── components/
│       └── providers/          Wallet provider (Wallet Standard)
├── docs/
│   ├── architecture.md
│   ├── zk-spec.md
│   └── security.md
├── Anchor.toml
├── Cargo.toml
└── README.md
```

---

## 🤝 Contributing

CognChain is building in public. We are actively seeking collaborators with experience in:

- **Anchor / Solana program development** — PDA design, account security, CPI
- **ZK cryptography** — Groth16 / PLONK circuits, snarkjs, Circom
- **AI infrastructure** — LLM orchestration, memory systems, RAG

Open an issue, fork the repo, or reach out directly.

---

## 👤 Author

**Eden Lucas Cavalcanti de Oliveira** — Solo founder and full-stack builder.

Shipped the entire CognChain stack from zero: Anchor program on Solana devnet, multi-provider AI router across 8 models, ZK proof pipeline, autonomous agent loop with on-chain memory synthesis, wallet-native memory vaults with 7-layer transaction security, Agent Office with live market data skills, CONGCHAIN Pay intelligence services with SOL micropayments, and Memory Brain with holographic agent memory cards. Previously built RadarPolítico BR, Lumina AI and Moreno Smart City. Building in public, full-time, since Q1 2026.

[![GitHub](https://img.shields.io/badge/GitHub-edencrypto--ia-181717?style=flat-square&logo=github)](https://github.com/edencrypto-ia)
[![X / Twitter](https://img.shields.io/badge/X-PenguPudgyPump-000000?style=flat-square&logo=x)](https://x.com/PenguPudgyPump)
[![Email](https://img.shields.io/badge/Email-hello@cognchain.xyz-00D1FF?style=flat-square&logo=gmail)](mailto:hello@cognchain.xyz)

---

## 📄 License

MIT © 2026 CognChain · [hello@cognchain.xyz](mailto:hello@cognchain.xyz)

---

<br/>
<br/>

---

# 🇧🇷 Português

## O que é o CognChain?

CognChain é a camada de memória que falta para sistemas de IA. Hoje, cada sessão de IA termina e seus insights desaparecem em bancos de dados de fornecedores — inacessíveis, não portáteis e impossíveis de provar. CognChain inverte isso: **outputs de alto valor são cristalizados em registros compactos, comprometidos por hash e ancorados permanentemente na Solana**, onde os usuários possuem o vault e os agentes ganham reputação por meio de histórico verificável.

> *Não são pesos de modelo. Não são logs brutos. Checkpoints cognitivos portáteis e verificáveis — de propriedade do usuário, confiáveis por qualquer agente.*

---

## ⚡ Program ID (Devnet)

```
BgrtrSJ53Uhp69sS8JfD414M1kujdR5ruhHc9wRbhiEL
```

[![Ver no Explorer](https://img.shields.io/badge/Ver%20no-Solana%20Explorer-9945FF?style=flat-square&logo=solana)](https://explorer.solana.com/address/BgrtrSJ53Uhp69sS8JfD414M1kujdR5ruhHc9wRbhiEL?cluster=devnet)

---

## 🔗 Cadeia de Memória Cross-Model — Demo Real

```
GPT-4o  ──salva──▶  Hash 202fe03d...  ──▶  Claude lê hash  ──▶  DeepSeek lê os 2 hashes
   │                   │ (Solana)               │                        │
Análise macro       On-chain             Arquiteturas            Plano 90 dias
de mercado          para sempre          técnicas viáveis        + SDK Rust
```

**Quando um modelo recupera um hash, abre com:**

```
⚡ Memória Verificada · CognChain on Solana
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hash: 202fe03d9c1b7af0...e1d43b9
Origem: GPT-4o · 01 Mai 2026 · 14:32 UTC
Status: ✓ On-chain · Solana Devnet · Score: —
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Continuando e aprofundando a partir desta base verificada:
```

| Passo | Modelo | Hash | O que fez |
|---|---|---|---|
| 1 | **GPT-4o** | `202fe03d...` | Análise macro de mercado IA+Solana 2026 |
| 2 | **Claude Opus** | `2d4a1330...` | Tabela técnica de arquiteturas on-chain viáveis |
| 3 | **DeepSeek V3** | `4273a923...` | Plano 90 dias com SDK Rust, sprints e métricas |

---

## 🤖 Agent Office — Dashboard da Economia de IA

O Agent Office (`/office`) é um painel em tempo real onde agentes de IA autônomos executam tarefas reais e seus outputs são armazenados como memórias verificáveis na blockchain.

**Habilidades reais dos agentes — cada um busca dados ao vivo antes de chamar a IA:**

| Agente | Fonte de dados | Modelo de IA | Output |
|---|---|---|---|
| VEGA | Binance preços ao vivo | Llama 3.3 70B | Sinais de trade com níveis de entrada/saída |
| NEXUS | DeFiLlama TVL | GLM-4.7 | Melhores oportunidades de yield |
| NOVA | CoinGecko multi-ativo | Qwen3 80B | Posicionamento de sentimento + outlook |
| ECHO | Dados on-chain Helius | MiniMax M2.7 | Análise de comportamento de carteiras |
| APEX | Feeds combinados | GPT-4o | Pesquisa profunda cross-asset |
| ARES | Métricas de protocolo | Claude | Auditoria de segurança e risco |
| FLUX | Indicadores macro | DeepSeek V3 | Tese macro + narrativa |
| ZION | Todas as fontes | Llama 3.3 | Síntese e briefing executivo |

Os outputs dos agentes vão para a aba **Agentes** no Memory Brain como cards holográficos — totalmente separados das memórias do chat.

---

## 💎 CONGCHAIN Pay — Serviços de Inteligência

Pague com SOL para receber inteligência real alimentada por IA, fundamentada em dados ao vivo de mercado e on-chain.

| Serviço | Preço | Fonte | Modelo | Output |
|---|---|---|---|---|
| Sinal de Mercado | 0.005 SOL | Binance OHLCV ao vivo | Llama 3.3 | Sinal de trade com níveis |
| Scan DeFi Yield | 0.008 SOL | DeFiLlama TVL | GLM-4.7 | Melhores oportunidades de yield |
| Inteligência de Carteira | 0.010 SOL | Helius on-chain | Qwen3 80B | Perfil completo da carteira |
| Relatório de Pesquisa IA | 0.020 SOL | Todas as fontes | GPT-4o | Documento de pesquisa profunda |
| Scan de Sentimento | 0.005 SOL | CoinGecko 10 ativos | MiniMax M2.7 | Posicionamento de mercado |
| Auditoria de Protocolo | 0.015 SOL | Métricas do protocolo | Claude | Avaliação de risco de segurança |

Cada relatório de inteligência pago é salvo como memória `[INTELLIGENCE_SERVICE]` — verificável, on-chain, permanente.

---

## 🧠 Memory Brain — Visualização Neural

O Memory Brain (`/brain`) tem duas visões:

| Visão | O que mostra |
|---|---|
| Memórias (grafo) | Grafo neural das memórias do chat — colorido por modelo de IA, anéis ZK para registros verificados, brilho on-chain para memórias ancoradas |
| Agentes (cards) | Cards holográficos das memórias geradas por agentes autônomos — cada card mostra o avatar do agente, nome do serviço, SOL pago e trecho do insight |

---

## ✅ O que está no ar

| Feature | Status | Detalhes |
|---|---|---|
| Programa Anchor | ✅ Devnet | `create_vault`, `write_memory`, `read_memory` |
| AI Router Multi-Provedor | ✅ Ativo | **8 modelos** — GPT-4o, Claude Opus 4.7, NVIDIA Llama 3.3, Gemini 2.0 Flash, DeepSeek V3, GLM-4.7, MiniMax M2.7, Qwen3 80B |
| Tier Free / Pro | ✅ Ativo | 4 modelos gratuitos (NVIDIA · GLM · MiniMax · Qwen) + 4 modelos Pro ($5/mês) |
| Memory Brain — Grafo | ✅ Ativo | Grafo neural force-directed · cores por modelo · anel ZK · brilho on-chain · deletar nós |
| Memory Brain — Agentes | ✅ Ativo | Grid de cards holográficos para memórias de agentes autônomos · modal de análise completa |
| Agent Office | ✅ Ativo | Dashboard da economia de IA ao vivo · 8 agentes · scheduler Play/Pause · streaming SSE |
| Habilidades Reais dos Agentes | ✅ Ativo | Dados ao vivo do Binance · TVL DeFiLlama · sentimento CoinGecko → análise de IA |
| Integração Agente→Chat | ✅ Ativo | Insights dos agentes aparecem como banner âmbar na interface do chat |
| CONGCHAIN Pay | ✅ Ativo | 6 serviços de inteligência · micropagamentos em SOL · resultados salvos como memórias verificadas |
| Motor de Grounding | ✅ Ativo | Pipeline de 8 camadas: Binance · CoinGecko · DeFiLlama · Helius · suporte multi-token |
| Login Admin | ✅ Ativo | Sessão admin por cookie · desbloqueia todos os modelos Pro instantaneamente |
| Proof of Insight (PoI) | ✅ Ativo | Votação humana → threshold → âncora automática na Solana |
| Memory Audit Trail | ✅ Ativo | Memory Chain · Evidence Record · Proof Stack ZK |
| ZK Proof Pipeline | ✅ Ativo | Circom + snarkjs Groth16 · modo simulado ativo |
| Agent Builder | ✅ Ativo | Criar, configurar e implantar agentes de IA com memória verificável |
| Economia Agente-a-Agente | ✅ Ativo | Marketplace de tarefas · bot loop demo · prova on-chain de conclusão |
| Loop Autônomo | ✅ Ativo | Busca memórias → síntese IA → ancora prova na Solana |
| Intelligence Score | ✅ Ativo | 0–100 composto · 5 níveis: Nascente → Mestre |
| Herança de Memória | ✅ Ativo | Inicialize agentes com memórias verificadas on-chain |
| Solana Sage | ✅ Ativo | Agente autônomo de monitoramento Solana com 7 camadas de segurança |
| Fila de Intents Solana | ✅ Ativo | Transações com confirmação humana obrigatória |
| Conexão de Carteira | ✅ Ativo | Phantom · Solflare · Backpack via Wallet Standard · modal dark |
| Helius RPC + Proxy | ✅ Ativo | RPC premium devnet · chave API protegida no servidor |
| Servidor MCP | ✅ Ativo | 7 ferramentas via Memory Internet Protocol |

---

## 🛡️ Segurança em 7 Camadas

```
Camada 1 — Somente leitura por padrão    Agente lê dados, nunca escreve autonomamente
Camada 2 — Fila de Intents              Transações enfileiradas como "intents pendentes"
Camada 3 — Aprovação humana obrigatória  Usuário vê a intent e clica Aprovar ou Rejeitar
Camada 4 — Simulação primeiro            Tx simulada no devnet antes de ser mostrada
Camada 5 — Whitelist de programas        Apenas Jupiter V6 e SystemProgram nativo
Camada 6 — Caps de valor                 Máx 0,5 SOL por swap · máx 0,1 SOL por transfer
Camada 7 — Expiração + rate limit        Intents expiram em 10 min · máx 5/hora
```

---

## 💰 Modelo de Custo

```
1 registro de memória   ≈ 0,0011 SOL   depósito único isento de rent
100 registros           ≈ 0,11 SOL    sem taxas recorrentes
1.000 registros         ≈ 1,10 SOL    persistência indefinida
```

---

## 🗺️ Roadmap

```
✅ Fase 0   Especificação · Schema · Mapa de contas Anchor
✅ Fase 1   Deploy no devnet · AI Router 8 modelos · PoI
             Provas ZK · Agent Builder · Marketplace · Loop Autônomo
             Intelligence Score · Wallet Connect · Solana Sage · MCP Server
✅ Fase 2   Agent Office (economia de IA ao vivo) · CONGCHAIN Pay (micropagamentos SOL)
             6 serviços de inteligência com dados de mercado ao vivo
             Memory Brain — aba Agentes com cards holográficos
             Motor de grounding (Binance · CoinGecko · DeFiLlama · Helius)
             Integração Agente→Chat · Suporte Wallet Standard
🔜 Fase 3   SDK · Indexer · API gateway · Primeiras integrações
             Reputação de agentes · Presets de política · Observabilidade
🔜 Fase 4   Groth16 em produção · Ferramentas enterprise · Portabilidade cross-app
🔜 Fase 5   TEE + FHE · Padrão cognitivo
```

---

## 👤 Autor

**Eden Lucas Cavalcanti de Oliveira** — Fundador solo e desenvolvedor full-stack.

Construiu toda a stack do CognChain do zero: programa Anchor na devnet da Solana, AI router multi-provedor com 8 modelos, pipeline de ZK proof, loop autônomo de agentes com síntese de memória on-chain, vaults de memória nativos de carteira com segurança em 7 camadas, Agent Office com habilidades de dados de mercado ao vivo, serviços de inteligência CONGCHAIN Pay com micropagamentos em SOL, e Memory Brain com cards holográficos de memória de agentes. Anteriormente construiu RadarPolítico BR, Lumina AI e Moreno Smart City. Construindo em público, tempo integral, desde o 1º trimestre de 2026.

[![GitHub](https://img.shields.io/badge/GitHub-edencrypto--ia-181717?style=flat-square&logo=github)](https://github.com/edencrypto-ia)
[![X / Twitter](https://img.shields.io/badge/X-PenguPudgyPump-000000?style=flat-square&logo=x)](https://x.com/PenguPudgyPump)
[![Email](https://img.shields.io/badge/Email-hello@cognchain.xyz-00D1FF?style=flat-square&logo=gmail)](mailto:hello@cognchain.xyz)

---

<br/>
<br/>

---

# 🇨🇳 中文

## 什么是 CognChain？

CognChain 是 AI 系统缺失的记忆层。如今，每次 AI 会话结束后，其洞察都消失在供应商数据库中——无法访问、不可移植、无法证明。CognChain 颠覆了这一现状：**高价值的 AI 输出被提炼为紧凑的、哈希承诺的记录，永久锚定在 Solana 上**，用户拥有金库，AI 代理通过可验证的历史记录积累声誉。

> *不是模型权重。不是原始日志。可移植、可验证的认知检查点——由用户拥有，受任何代理信任。*

---

## ⚡ 程序 ID（开发网）

```
BgrtrSJ53Uhp69sS8JfD414M1kujdR5ruhHc9wRbhiEL
```

[![在浏览器中查看](https://img.shields.io/badge/查看-Solana%20浏览器-9945FF?style=flat-square&logo=solana)](https://explorer.solana.com/address/BgrtrSJ53Uhp69sS8JfD414M1kujdR5ruhHc9wRbhiEL?cluster=devnet)

---

## 🤖 Agent Office — 实时 AI 经济仪表板

Agent Office（`/office`）是一个实时仪表板，自主 AI 代理在此执行真实任务，其输出作为可验证记忆存储在链上。

**代理技能——每个代理在调用 AI 之前都会获取实时数据：**

| 代理 | 数据来源 | AI 模型 | 输出 |
|---|---|---|---|
| VEGA | Binance 实时价格 | Llama 3.3 70B | 带入/出场位的交易信号 |
| NEXUS | DeFiLlama TVL | GLM-4.7 | 最佳收益机会 |
| NOVA | CoinGecko 多资产 | Qwen3 80B | 情绪定位 + 市场展望 |
| ECHO | Helius 链上数据 | MiniMax M2.7 | 钱包行为分析 |

---

## 💎 CONGCHAIN Pay — 智能服务

用 SOL 支付，获取由 AI 驱动的实时市场和链上数据支持的真实情报。

| 服务 | 价格 | 数据来源 | 模型 | 输出 |
|---|---|---|---|---|
| 市场信号 | 0.005 SOL | Binance 实时 OHLCV | Llama 3.3 | 带价位的交易信号 |
| DeFi 收益扫描 | 0.008 SOL | DeFiLlama TVL | GLM-4.7 | 最佳收益机会 |
| 钱包情报 | 0.010 SOL | Helius 链上 | Qwen3 80B | 完整钱包画像 |
| AI 研究报告 | 0.020 SOL | 所有来源 | GPT-4o | 深度研究文档 |
| 情绪扫描 | 0.005 SOL | CoinGecko 10 资产 | MiniMax M2.7 | 市场定位 |
| 协议审计 | 0.015 SOL | 协议指标 | Claude | 安全风险评估 |

每份付费情报报告都以 `[INTELLIGENCE_SERVICE]` 记忆形式保存——可验证、链上、永久。

---

## ✅ 已上线功能

| 功能 | 状态 | 详情 |
|---|---|---|
| Anchor 程序 | ✅ 开发网 | `create_vault`、`write_memory`、`read_memory` |
| 多供应商 AI 路由器 | ✅ 上线 | **8 个模型** — GPT-4o、Claude Opus 4.7、NVIDIA Llama 3.3、Gemini 2.0 Flash、DeepSeek V3、GLM-4.7、MiniMax M2.7、Qwen3 80B |
| 免费/专业版分层 | ✅ 上线 | 4 个免费模型（NVIDIA · GLM · MiniMax · Qwen）+ 4 个专业版模型（$5/月）|
| Memory Brain — 图谱 | ✅ 上线 | 力导向神经图谱 · 按模型着色 · ZK 环 · 链上光晕 · 删除节点 |
| Memory Brain — 代理卡片 | ✅ 上线 | 自主代理记忆的全息卡片网格 · 完整分析弹窗 |
| Agent Office | ✅ 上线 | 实时 AI 经济仪表板 · 8 个代理 · 播放/暂停调度器 · SSE 流式传输 |
| 真实代理技能 | ✅ 上线 | Binance 实时数据 · DeFiLlama TVL · CoinGecko 情绪 → AI 分析 |
| 代理→聊天集成 | ✅ 上线 | 代理洞察以琥珀色横幅显示在聊天界面 |
| CONGCHAIN Pay | ✅ 上线 | 6 项智能服务 · SOL 微支付 · 结果保存为已验证记忆 |
| 接地引擎 | ✅ 上线 | 8 层管道：Binance · CoinGecko · DeFiLlama · Helius · 多代币支持 |
| 管理员登录 | ✅ 上线 | Cookie 会话 · 即时解锁所有专业版模型 |
| 洞察证明（PoI）| ✅ 上线 | 人工投票 → 阈值 → 自动锚定到 Solana |
| 记忆审计追踪 | ✅ 上线 | 记忆链 · 证据记录 · ZK 证明堆栈 |
| ZK 证明管道 | ✅ 上线 | Circom + snarkjs Groth16 · 模拟模式激活 |
| 代理构建器 | ✅ 上线 | 创建、配置、部署具有可验证记忆的 AI 代理 |
| 代理间经济 | ✅ 上线 | 任务市场 · 机器人循环演示 · 链上完成证明 |
| 自主循环 | ✅ 上线 | 获取记忆 → AI 综合 → 在 Solana 上锚定证明 |
| 智能分数 | ✅ 上线 | 0–100 综合评分 · 5 个等级：初生 → 大师 |
| 记忆继承 | ✅ 上线 | 用已验证的链上记忆初始化新代理 |
| Solana 智者代理 | ✅ 上线 | 具有 7 层安全性的自主 Solana 监控代理 |
| Solana 意图队列 | ✅ 上线 | 人工确认的交易 · 批准前先模拟 |
| 钱包连接 | ✅ 上线 | Phantom · Solflare · Backpack（Wallet Standard）· 深色模态框 |
| Helius RPC + 代理 | ✅ 上线 | 高级开发网 RPC · API 密钥在服务器端保护 |
| MCP 服务器 | ✅ 上线 | 通过记忆互联网协议提供 7 个工具 |

---

## 🛡️ 7 层安全模型

```
第 1 层 — 默认只读          代理可以读取任何数据，但不能自主写入
第 2 层 — 意图队列          所有交易以"待处理意图"排队
第 3 层 — 必须人工批准      用户查看意图 + 描述 → 批准或拒绝
第 4 层 — 先模拟            每笔交易在展示给用户前先在开发网模拟
第 5 层 — 程序白名单        仅允许 Jupiter V6 和原生 SOL 转账
第 6 层 — 金额上限          每次兑换最多 0.5 SOL · 每次转账最多 0.1 SOL
第 7 层 — 到期 + 速率限制   意图 10 分钟后过期 · 每小时最多 5 次
```

---

## 💰 成本模型

```
1 条记忆记录     ≈ 0.0011 SOL   一次性免租金押金
100 条记录       ≈ 0.11 SOL    无周期性费用
1,000 条记录     ≈ 1.10 SOL    无限期持久化
```

---

## 🗺️ 路线图

```
✅ 阶段 0   规范 · 模式 · Anchor 账户映射
✅ 阶段 1   开发网部署 · 8 模型 AI 路由器 · PoI 投票
             ZK 证明 · 代理构建器 · 市场 · 自主循环
             智能分数 · 钱包连接 · Solana 智者 · MCP 服务器
✅ 阶段 2   Agent Office（实时 AI 经济）· CONGCHAIN Pay（SOL 微支付）
             6 项实时市场数据智能服务
             Memory Brain 代理选项卡（全息卡片）
             接地引擎（Binance · CoinGecko · DeFiLlama · Helius）
🔜 阶段 3   SDK 发布 · 索引器 · API 网关 · 首次集成
🔜 阶段 4   Groth16 投入生产 · 企业工具 · 跨应用可移植性
🔜 阶段 5   TEE + FHE 研究 · 认知标准
```

---

## 👤 作者

**Eden Lucas Cavalcanti de Oliveira** — 独立创始人与全栈构建者。

从零开始构建了整个 CognChain 技术栈：Solana 开发网上的 Anchor 程序、跨 8 个模型的多供应商 AI 路由器、ZK 证明管道、具有链上记忆合成的自主代理循环、具有 7 层交易安全性的原生钱包记忆金库、带实时市场数据技能的 Agent Office、SOL 微支付的 CONGCHAIN Pay 智能服务，以及带全息代理记忆卡片的 Memory Brain。此前还构建了 RadarPolítico BR、Lumina AI 和 Moreno Smart City。自 2026 年第一季度起全职公开构建。

[![GitHub](https://img.shields.io/badge/GitHub-edencrypto--ia-181717?style=flat-square&logo=github)](https://github.com/edencrypto-ia)
[![X / Twitter](https://img.shields.io/badge/X-PenguPudgyPump-000000?style=flat-square&logo=x)](https://x.com/PenguPudgyPump)
[![Email](https://img.shields.io/badge/Email-hello@cognchain.xyz-00D1FF?style=flat-square&logo=gmail)](mailto:hello@cognchain.xyz)

---

<div align="center">

**MIT © 2026 CognChain**

*The Solana-native memory layer for AI ownership, trust and portability.*

*A camada de memória nativa da Solana para propriedade, confiança e portabilidade de IA.*

*面向 AI 所有权、信任和可移植性的 Solana 原生记忆层。*

</div>
