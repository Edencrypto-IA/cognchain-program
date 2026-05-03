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
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                           │
│   AI Agents · Copilots · Research Tools · Enterprise Apps       │
│   8 Models: GPT-4o · Claude · Llama · Gemini · DeepSeek         │
│             GLM-4.7 · MiniMax M2.7 · Qwen3 80B                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │  SDK + Wallet Auth
┌──────────────────────────▼──────────────────────────────────────┐
│                   PROOF OF INSIGHT (PoI)                        │
│   Human voting (3 votes avg ≥ 7) → Auto-anchor on Solana        │
│   SHA-256 hash · ZK Proof (Groth16) · Trust Score               │
└──────────────────────────┬──────────────────────────────────────┘
                           │  Verified Memory Candidates
┌──────────────────────────▼──────────────────────────────────────┐
│                  COGNCHAIN ANCHOR PROGRAM                       │
│              BgrtrSJ53Uhp69sS8JfD414M1kujdR5ruhHc9wRbhiEL       │
│                                                                  │
│  create_vault  │  write_memory  │  read_memory                  │
│  PDA Vaults    │  152-byte records │  Permission grants          │
└──────────────────────────┬──────────────────────────────────────┘
                           │  On-chain: hashes + scores + proofs
┌──────────────────────────▼──────────────────────────────────────┐
│                    HYBRID STORAGE                               │
│   Solana: ContentHash · SummaryHash · ConfidenceBps · PolicyId  │
│   Off-chain: Encrypted content · Vectors · Session traces       │
└─────────────────────────────────────────────────────────────────┘
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

## ✅ What's Live

| Feature | Status | Details |
|---|---|---|
| Anchor Program | ✅ Devnet | `create_vault`, `write_memory`, `read_memory` |
| Multi-Provider AI Router | ✅ Live | **8 models** — GPT-4o, Claude Opus 4.7, NVIDIA Llama 3.3, Gemini 2.0 Flash, DeepSeek V3, GLM-4.7, MiniMax M2.7, Qwen3 80B |
| Free / Pro Tier | ✅ Live | 4 free models (NVIDIA · GLM · MiniMax · Qwen) + 4 Pro models ($5/month) |
| Memory Brain | ✅ Live | Force-directed neural graph of all memories · color by model · ZK rings · on-chain glow |
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
| Wallet Connection | ✅ Live | Phantom · Solflare · Coinbase via standard adapter |
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
✅ Phase 1   Devnet deployment · Memory Engine · 5-model AI router
             PoI voting · ZK proofs · Agent Builder · Marketplace
             Autonomous loop · Intelligence Score · Wallet Connection
             Solana Sage · Intent Queue · Helius RPC · MCP Server
🔜 Phase 2   SDK release · Indexer · API gateway · First integrations
             Agent reputation · Policy presets · Observability
🔜 Phase 3   Groth16 in production · Enterprise tooling · Cross-app portability
🔜 Phase 4   TEE + FHE research · Cognitive standard
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
├── docs/
│   ├── architecture.md         System design
│   ├── zk-spec.md              ZK circuit specification
│   └── security.md             Security model
├── scripts/
│   ├── create-vault.ts         CLI: create memory vault
│   └── write-memory.ts         CLI: anchor a memory record
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

Shipped the entire CognChain stack from zero: Anchor program on Solana devnet, multi-provider AI router across 5 models, ZK proof pipeline, autonomous agent loop with on-chain memory synthesis, and wallet-native memory vaults with 7-layer transaction security. Previously built RadarPolítico BR, Lumina AI and Moreno Smart City. Building in public, full-time, since Q1 2026.

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

## ✅ O que está no ar

| Feature | Status | Detalhes |
|---|---|---|
| Programa Anchor | ✅ Devnet | `create_vault`, `write_memory`, `read_memory` |
| AI Router Multi-Provedor | ✅ Ativo | **8 modelos** — GPT-4o, Claude Opus 4.7, NVIDIA Llama 3.3, Gemini 2.0 Flash, DeepSeek V3, GLM-4.7, MiniMax M2.7, Qwen3 80B |
| Tier Free / Pro | ✅ Ativo | 4 modelos gratuitos (NVIDIA · GLM · MiniMax · Qwen) + 4 modelos Pro ($5/mês) |
| Memory Brain | ✅ Ativo | Grafo neural das memórias · cores por modelo · anel ZK · brilho on-chain |
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
| Conexão de Carteira | ✅ Ativo | Phantom · Solflare · Coinbase via adapter padrão |
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
✅ Fase 1   Deploy no devnet · AI Router 5 modelos · PoI
             Provas ZK · Agent Builder · Marketplace · Loop Autônomo
             Intelligence Score · Wallet Connect · Solana Sage · MCP Server
🔜 Fase 2   SDK · Indexer · API gateway · Primeiras integrações
🔜 Fase 3   Groth16 em produção · Ferramentas enterprise
🔜 Fase 4   TEE + FHE · Padrão cognitivo
```

---

## 👤 Autor

**Eden Lucas Cavalcanti de Oliveira** — Fundador solo e desenvolvedor full-stack.

Construiu toda a stack do CognChain do zero: programa Anchor na devnet da Solana, AI router multi-provedor com 5 modelos, pipeline de ZK proof, loop autônomo de agentes com síntese de memória on-chain e vaults de memória nativos de carteira com segurança em 7 camadas. Anteriormente construiu RadarPolítico BR, Lumina AI e Moreno Smart City. Construindo em público, tempo integral, desde o 1º trimestre de 2026.

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

## ✅ 已上线功能

| 功能 | 状态 | 详情 |
|---|---|---|
| Anchor 程序 | ✅ 开发网 | `create_vault`、`write_memory`、`read_memory` |
| 多供应商 AI 路由器 | ✅ 上线 | **8 个模型** — GPT-4o、Claude Opus 4.7、NVIDIA Llama 3.3、Gemini 2.0 Flash、DeepSeek V3、GLM-4.7、MiniMax M2.7、Qwen3 80B |
| 免费/专业版分层 | ✅ 上线 | 4 个免费模型（NVIDIA · GLM · MiniMax · Qwen）+ 4 个专业版模型（$5/月）|
| Memory Brain | ✅ 上线 | 记忆神经图谱 · 按模型着色 · ZK 环 · 链上光晕 |
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
| 钱包连接 | ✅ 上线 | Phantom · Solflare · Coinbase（标准适配器）|
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
✅ 阶段 1   开发网部署 · 5 模型 AI 路由器 · PoI 投票
             ZK 证明 · 代理构建器 · 市场 · 自主循环
             智能分数 · 钱包连接 · Solana 智者 · MCP 服务器
🔜 阶段 2   SDK 发布 · 索引器 · API 网关 · 首次集成
🔜 阶段 3   Groth16 投入生产 · 企业工具
🔜 阶段 4   TEE + FHE 研究 · 认知标准
```

---

## 👤 作者

**Eden Lucas Cavalcanti de Oliveira** — 独立创始人与全栈构建者。

从零开始构建了整个 CognChain 技术栈：Solana 开发网上的 Anchor 程序、跨 5 个模型的多供应商 AI 路由器、ZK 证明管道、具有链上记忆合成的自主代理循环，以及具有 7 层交易安全性的原生钱包记忆金库。此前还构建了 RadarPolítico BR、Lumina AI 和 Moreno Smart City。自 2026 年第一季度起全职公开构建。

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
