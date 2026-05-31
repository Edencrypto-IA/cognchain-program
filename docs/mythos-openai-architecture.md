# Mythos OpenAI Architecture Addendum

This document distills the external `mythos_master_architecture` package into additions that fit the current CONGCHAIN/Mythos codebase without replacing working systems.

## Senior Engineering Decision

The package is useful as product direction, not as drop-in implementation. The safe path is incremental:

- Keep the current Next.js app, Mythos Lab, wallet connection, Solana intelligence, and Pump.fun safety gates.
- Add OpenAI as an orchestration and multimodal reasoning layer.
- Keep all wallet signing in Phantom/Solflare.
- Keep all value-moving execution behind explicit preview, simulation, wallet signature, and separate submit.
- Store architecture, tool contracts, and safety boundaries before adding more runtime automation.

## What Is Good For Mythos Now

| Area | Adopt now | Why |
|---|---|---|
| Responses API orchestration | Yes | Gives Mythos one structured brain for command routing, reasoning summaries, and tool selection. |
| Structured Outputs | Yes | Keeps risk reports, transaction previews, and wallet intelligence machine-checkable. |
| Vision and file input | Yes | Fits the existing attachment analysis path for screenshots, PDFs, token docs, and charts. |
| Tool calling contracts | Yes | Lets Mythos call internal APIs only through allowlisted tools. |
| Embeddings and retrieval | Yes, later behind memory boundaries | Useful for long-term Mythos memory, but must avoid secrets and signed payloads. |
| Image generation | Yes, limited | Useful for memecoin logo concepts and branding drafts, not for claiming uploaded production metadata. |
| Social intelligence | Later | Valuable, but needs verified social data sources, rate limits, and anti-manipulation labeling. |
| Realtime voice | Later | Product polish, not required for safe execution. |
| Queue workers | Later | Needed for alerts, social scans, and long-running reports, not for the current launch path. |

## What Must Not Be Adopted Blindly

- No autonomous trading.
- No custodial wallet design.
- No server-side private keys.
- No hidden swaps, buys, sells, payments, or submissions.
- No claim that OpenAI produced market facts unless the facts came from a cited market, RPC, or indexer source.
- No social scraping pipeline without source controls, API terms review, and abuse protections.

## Target Architecture

```txt
User
  |
  v
Next.js UI: Mythos Lab, wallet UI, file attachments, Pump.fun studio
  |
  v
Next.js API routes
  |
  +--> OpenAI Responses API
  |      - reasoning summaries
  |      - structured JSON
  |      - vision/file analysis
  |      - tool selection
  |
  +--> Internal Mythos tools
  |      - wallet intelligence
  |      - token risk scan
  |      - transaction analysis
  |      - Pump.fun unsigned builders
  |      - metadata preview
  |
  +--> Solana data providers
  |      - RPC
  |      - Helius/Solscan where configured
  |      - market data providers
  |
  +--> Storage and memory
         - CognChain memory
         - database records
         - audit logs
         - optional vector store
```

## Tool Permission Model

| Tool | Permission | Can move funds | Notes |
|---|---:|---:|---|
| `get_wallet_balances` | read public wallet | No | Uses public wallet address only. |
| `get_token_price` | read market data | No | Must return source and timestamp. |
| `analyze_transaction` | read public transaction | No | Uses signature and RPC/indexer evidence. |
| `scan_token_risk` | read token mint | No | Must label missing data clearly. |
| `read_uploaded_file` | user-provided file | No | Must redact secrets and avoid storing raw sensitive content. |
| `generate_memecoin_metadata` | draft metadata | No | Creates draft JSON/prompt; does not upload by default. |
| `build_unsigned_pumpfun_create_tx` | unsigned tx builder | No | Server builds unsigned bytes only after gates pass. |
| `simulate_transaction` | simulation only | No | Required before any production submit flow. |
| `prepare_wallet_signature_request` | browser wallet request | No server movement | User must approve in Phantom/Solflare. |
| `submit_signed_transaction` | signed payload submit | Yes, only after explicit user submit | Must never sign server-side. |
| `create_user_alert` | scheduled read-only check | No | Requires user opt-in and clear alert scope. |
| `store_memory` | approved memory write | No | Must block secrets, keys, signed payloads, and fund-moving data. |
| `retrieve_memory` | memory read | No | Must respect source, owner, and vault boundaries. |

## OpenAI Usage Pattern

### 1. Command understanding

Use OpenAI to classify the user request into a safe intent:

- read-only analysis
- file analysis
- memecoin draft
- Pump.fun launch preparation
- wallet-risk explanation
- alert setup
- unsupported/high-risk request

The model returns structured JSON, not free-form execution.

### 2. Tool planning

OpenAI may propose tools, but the backend enforces the allowlist. The backend decides:

- which tools are callable;
- which data can be sent to OpenAI;
- whether a tool is read-only, preview-only, signature-only, or submit-capable;
- whether user confirmation is required.

### 3. Evidence-grounded response

Every answer that includes financial or market claims must separate:

- facts from providers;
- estimates from Mythos;
- suggestions from the model;
- unavailable data.

### 4. Transaction boundary

For every on-chain action:

1. Build preview.
2. Show accounts, fees, slippage, mint, metadata URI, wallet signer, and network.
3. Simulate where possible.
4. Ask wallet to sign in browser.
5. Require separate submit action for signed payload.
6. Write receipt/memory only after result exists.

## Recommended Backend Endpoints

| Endpoint | Purpose | Runtime impact |
|---|---|---|
| `POST /api/mythos/openai/route-command` | Structured intent classification | Safe to add first. |
| `POST /api/mythos/openai/analyze-file` | Vision/file analysis using OpenAI | Builds on existing attachment analysis. |
| `POST /api/mythos/openai/tool-plan` | Returns allowlisted tool plan | Requires strict schema. |
| `POST /api/mythos/risk/report` | Unified wallet/token/tx risk report | Aggregates existing Solana tools. |
| `POST /api/mythos/memecoin/metadata-draft` | Draft metadata and branding | Does not upload or launch. |
| `POST /api/mythos/alerts/create` | Read-only alert creation | Later; needs storage and scheduler. |
| `GET /api/mythos/audit/events` | User-visible audit trail | Good for trust and demos. |

## Data Model Additions

Recommended future tables or collections:

```txt
MythosToolRun
  id
  userId
  walletAddress?
  toolName
  permissionClass
  inputHash
  outputHash
  sourceSummary
  status
  createdAt

MythosRiskReport
  id
  subjectType
  subject
  sources
  factsJson
  estimatesJson
  suggestionsJson
  confidence
  createdAt

MythosUserAlert
  id
  userId
  walletAddress?
  alertType
  queryJson
  thresholdJson
  status
  lastCheckedAt?
  createdAt

MythosFileAnalysis
  id
  userId
  fileHash
  mimeType
  extractedSummary
  riskFlags
  model
  createdAt
```

## Roadmap

### Phase 1: OpenAI command brain

- Add structured intent classification.
- Add tool-plan schema.
- Keep all tools read-only or preview-only.

### Phase 2: Multimodal analysis

- Improve image/PDF analysis.
- Add source labels and confidence.
- Add secret redaction before model calls.

### Phase 3: Unified financial reports

- Merge wallet, token, transaction, market, and file evidence into one risk report.
- Add "facts / estimates / suggestions" sections.

### Phase 4: Pump.fun copilot refinement

- Keep simple launch UX.
- Add real metadata upload provider only after provider audit.
- Add simulation and clearer fee/rent previews.
- Keep wallet signing and submit explicit.

### Phase 5: Alerts and jobs

- Add opt-in read-only alerts.
- Use queue workers for scheduled checks.
- Store alert evidence and timestamps.

### Phase 6: Social intelligence

- Add verified social data sources.
- Cluster narratives.
- Label manipulation risk.
- Never treat social sentiment as investment advice.

## Production Checklist

- OpenAI schemas are versioned.
- All tool calls are allowlisted server-side.
- Secrets are redacted before model calls.
- Wallet addresses are public-only inputs.
- No private key, seed phrase, or signed payload is stored in memory.
- Every market number has source and timestamp.
- Every transaction flow has preview, simulation where possible, wallet signature, and separate submit.
- Audit logs are visible to the user.
- Rate limits exist per endpoint.
- Errors fail closed.

