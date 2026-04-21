# CognChain Agent

Autonomous AI agent + Telegram bot with persistent memory on Solana devnet.

Each valuable AI response is scored, hashed, and written on-chain as a `MemoryRecord` PDA.
Memory grows across sessions — the agent genuinely gets smarter with every interaction.

---

## Stack

- **Runtime**: Node.js 18 (CommonJS)
- **Solana**: `@coral-xyz/anchor@0.29.0` · `@solana/web3.js@1.98`
- **AI**: `@anthropic-ai/sdk` · model `claude-sonnet-4-5`
- **Telegram**: `node-telegram-bot-api`
- **Network**: Solana **devnet** via Helius RPC
- **Program ID**: `7AHMKtvPuZ6yKdWtWD1kC6kgPkEgooeBBtrmUrVc2teU`

---

## Files

| File | Purpose |
|------|---------|
| `index.js` | Core memory engine: extract → score → hash → write on-chain |
| `extractor.js` | Parses conversation text into `{summary, insight, type, keywords}` |
| `scorer.js` | Scores memory importance 0–10 000 bps; threshold 4 000 bps to store |
| `hasher.js` | SHA-256 hashes of `insight` (contentHash) and `summary` (summaryHash) |
| `autonomous-agent.js` | 3-loop autonomous agent that reads vault → calls Claude → writes memory |
| `telegram-bot.js` | Full-featured Telegram bot (see commands below) |
| `idl.json` | Anchor IDL for the CognChain on-chain program |

---

## Telegram Bot Commands

### 💬 Conversation
Any plain message triggers the full memory cycle:
read vault → inject memories into Claude prompt → score response → write on-chain if score ≥ 4 000 bps.

### 💸 Payments
| Command | Description |
|---------|-------------|
| `/send <amount> <address>` | Transfer SOL from bot wallet to any address. Security-checked by Claude before execution. |
| `/agentpay <task> <amount>` | Agent-to-agent economy: AgentA funds and pays AgentB, AgentB calls Claude to complete the task, both agents write memories on-chain. |

### 🔄 Swap
| Command | Description |
|---------|-------------|
| `/swap <amount> <FROM> <TO>` | Swap tokens via Jupiter API v6. Supported: SOL, USDC, USDT, BONK. Example: `/swap 0.01 SOL USDC` |

### 🧠 Memory
| Command | Description |
|---------|-------------|
| `/memoria` | Beautiful human-readable timeline of all vault memories. Classified by importance: ⚡ Decisão (>7 000 bps), 📊 Comportamento (5 000–7 000 bps), 💡 Observação (<5 000 bps). Tap "Ver prova completa" to see on-chain TX hashes. |

### 🔍 Analysis
| Command | Description |
|---------|-------------|
| `/check <address>` | Fetch Solana account info + 5 recent transactions. Claude analyzes and returns risk score 1–10 with safety verdict. Analysis written to vault. |
| `/balance` | Show wallet address, SOL balance, vault record count, vault PDA, and Explorer link. |

### 🪙 Token Launch
| Command | Description |
|---------|-------------|
| `/memecoin <name> <symbol> <description>` | Claude generates a meme coin concept using vault memories as context. Attempts Pump.fun launch; simulates with a real mint keypair if Pump.fun is unavailable (devnet). |

### 🛡️ Security
| Command | Description |
|---------|-------------|
| `/pause` | Block all financial commands (/send, /agentpay, /swap). Event written to vault. |
| `/resume` | Re-enable financial commands. Event written to vault. |
| `/limits` | Show MAX_TX_SOL (0.1), MAX_DAILY_SOL (1.0), daily spend so far, remaining budget, paused status. |

---

## Security Layers

1. **Per-transaction limit** — max 0.1 SOL per transaction
2. **Daily limit** — max 1.0 SOL per day, resets at midnight
3. **Claude safety check** — every SOL transfer is analyzed for scam/phishing patterns before execution; UNSAFE verdict blocks and logs the incident to vault
4. **Pause/resume** — operator can halt all financial commands instantly; events recorded on-chain

---

## On-Chain Memory Schema

```
Vault PDA:  ["vault", walletPubkey]
Record PDA: ["record", vaultPda, recordIndex (u16 LE)]
```

**Vault** fields: `authority · label · recordCount · bump · createdAt`

**MemoryRecord** fields: `vault · id · authority · contentHash[32] · summaryHash[32] · importance (u16, 0–10 000 bps) · agentType (u8) · bump · createdAt`

Content is stored as SHA-256 hashes only — no raw text on-chain. Human-readable text is cached locally in `memory-log.json`.

---

## Running

### Autonomous Agent
```bash
ANTHROPIC_API_KEY=sk-ant-... node autonomous-agent.js
```

### Telegram Bot
```bash
TELEGRAM_BOT_TOKEN=<token> ANTHROPIC_API_KEY=sk-ant-... node telegram-bot.js
```

Get a bot token from [@BotFather](https://t.me/BotFather) on Telegram.

---

## Wallet Setup

Create `wallet.json` in the working directory with a Solana keypair as a JSON byte array:
```bash
solana-keygen new --outfile wallet.json
```
Fund on devnet:
```bash
solana airdrop 2 --url devnet
```

> ⚠️ Never commit `wallet.json` to version control.
