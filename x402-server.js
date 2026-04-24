// ══════════════════════════════════════════════════════════════════════════════
// CognChain x402 Payment Server
// HTTP 402 Protocol for AI Agent-to-Agent Commerce on Solana
//
// "Other AI agents pay CognChain for its memory & intelligence services"
//
// Flow:
//   1. Client calls service endpoint
//   2. Server responds 402 Payment Required + challenge
//   3. Client pays SOL to agent wallet
//   4. Client retries with X-Payment-Id + X-Payment-Tx headers
//   5. Server verifies on-chain → executes service → returns result
// ══════════════════════════════════════════════════════════════════════════════

require("dotenv").config();

const express        = require("express");
const cors           = require("cors");
const { Connection, PublicKey } = require("@solana/web3.js");
const Anthropic       = require("@anthropic-ai/sdk");
const crypto          = require("crypto");
const fs              = require("fs");
const path            = require("path");

// ── Config ────────────────────────────────────────────────────────────────────
const PORT             = process.env.X402_PORT || 4020;
const RPC              = process.env.RPC_URL || "https://api.devnet.solana.com";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL            = "claude-sonnet-4-5";
const TELEGRAM_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.X402_NOTIFY_CHAT || "";
const USERS_DIR        = path.join(__dirname, "users");
const EARNINGS_FILE    = path.join(__dirname, "x402-earnings.json");
const AGENT_B_FILE     = path.join(__dirname, "users", ".agent-b.json");

if (!ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY not set");
  process.exit(1);
}

// ── Globals ───────────────────────────────────────────────────────────────────
const connection = new Connection(RPC, "confirmed");
const anthropic  = new Anthropic.default({ apiKey: ANTHROPIC_API_KEY });

// Load agent wallet (same as telegram-bot.js)
function getAgentWallet() {
  if (process.env.AGENT_WALLET) return process.env.AGENT_WALLET;
  try {
    const raw = JSON.parse(fs.readFileSync(AGENT_B_FILE, "utf8"));
    return raw.publicKey;
  } catch {
    return null;
  }
}
const AGENT_WALLET = getAgentWallet();

// ── Express Setup ─────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} from ${req.ip}`);
  next();
});

// ══════════════════════════════════════════════════════════════════════════════
// SERVICE REGISTRY — What the CognChain agent sells
// ══════════════════════════════════════════════════════════════════════════════
const SERVICES = {
  "memory-search": {
    name: "Memory Search",
    description: "Search CognChain agent memories by keyword, hash, or topic. Returns matching memories with context.",
    price: 10000,          // in lamports
    priceDisplay: "0.00001 SOL",
    endpoint: "/v1/memory/search",
    method: "POST",
    inputSpec: { query: "Bitcoin analysis" },
  },
  "memory-evolve": {
    name: "Memory Evolution",
    description: "AI-evolve a stored memory with deeper analysis, related context, and new insights using Claude AI.",
    price: 50000,
    priceDisplay: "0.00005 SOL",
    endpoint: "/v1/memory/evolve",
    method: "POST",
    inputSpec: { hash: "first 8+ chars of content hash" },
  },
  "insights": {
    name: "AI Insights",
    description: "Full Claude AI analysis of agent memory patterns, knowledge gaps, and trend identification.",
    price: 100000,
    priceDisplay: "0.0001 SOL",
    endpoint: "/v1/insights",
    method: "POST",
    inputSpec: {},
  },
  "teach": {
    name: "Teach Agent",
    description: "Store new knowledge in the agent's on-chain memory with AI scoring and importance ranking.",
    price: 30000,
    priceDisplay: "0.00003 SOL",
    endpoint: "/v1/teach",
    method: "POST",
    inputSpec: { topic: "Ethereum merge", content: "detailed content..." },
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENT SYSTEM — x402 Protocol Implementation
// ══════════════════════════════════════════════════════════════════════════════
const pendingPayments = new Map();

function loadEarnings() {
  try { return JSON.parse(fs.readFileSync(EARNINGS_FILE, "utf8")); }
  catch { return { totalEarned: 0, totalPayments: 0, payments: [], serviceCount: {} }; }
}

function saveEarnings(data) {
  fs.writeFileSync(EARNINGS_FILE, JSON.stringify(data, null, 2), "utf8");
}

function recordPayment(payment) {
  const earnings = loadEarnings();
  earnings.totalEarned += payment.amount;
  earnings.totalPayments += 1;
  earnings.payments.unshift(payment); // newest first
  if (earnings.payments.length > 1000) earnings.payments = earnings.payments.slice(0, 1000);
  earnings.serviceCount[payment.serviceId] = (earnings.serviceCount[payment.serviceId] || 0) + 1;
  saveEarnings(earnings);
  return earnings;
}

function createChallenge(serviceId, clientIp) {
  const service = SERVICES[serviceId];
  if (!service) return null;

  const paymentId = "x402_" + crypto.randomBytes(16).toString("hex");
  const amountSol = (service.price / 1e9).toFixed(9);

  const challenge = {
    version: "1.0",
    protocol: "x402",
    paymentId,
    serviceId,
    serviceName: service.name,
    amount: service.price,
    amountSol,
    priceDisplay: service.priceDisplay,
    currency: "SOL",
    network: "solana-devnet",
    destination: AGENT_WALLET,
    clientIp,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    status: "pending",
    payUrl: `solana:${AGENT_WALLET}?amount=${amountSol}&reference=${paymentId}`,
    explorerUrl: `https://explorer.solana.com/address/${AGENT_WALLET}?cluster=devnet`,
  };

  pendingPayments.set(paymentId, challenge);
  return challenge;
}

async function verifyPayment(paymentId, txSignature) {
  const challenge = pendingPayments.get(paymentId);
  if (!challenge) return { verified: false, reason: "Payment challenge not found. Call the service endpoint first." };
  if (challenge.status === "paid") return { verified: false, reason: "Already paid. Service already delivered.", result: challenge };
  if (Date.now() > new Date(challenge.expiresAt).getTime()) {
    challenge.status = "expired";
    return { verified: false, reason: "Payment challenge expired. Request a new one." };
  }

  try {
    const tx = await connection.getTransaction(txSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return { verified: false, reason: "Transaction not found on-chain. Verify the signature." };

    // Verify the transaction pays to our agent wallet
    const accountKeys = tx.transaction.message.staticAccountKeys
      ? tx.transaction.message.staticAccountKeys.map(k => k.toBase58())
      : tx.transaction.message.accountKeys.map(k => k.toBase58());

    const destIndex = accountKeys.indexOf(AGENT_WALLET);
    if (destIndex === -1) return { verified: false, reason: `Transaction does not transfer to agent wallet (${AGENT_WALLET}).` };

    const preBalance = tx.meta.preBalances[destIndex];
    const postBalance = tx.meta.postBalances[destIndex];
    const received = postBalance - preBalance;

    if (received < challenge.amount) {
      return { verified: false, reason: `Insufficient amount. Expected ${challenge.amount} lamports (${challenge.priceDisplay}), received ${received} lamports.` };
    }

    // ✅ PAYMENT VERIFIED!
    challenge.status = "paid";
    challenge.txSignature = txSignature;
    challenge.paidAt = new Date().toISOString();
    challenge.received = received;

    // Record in earnings
    const payment = {
      paymentId,
      serviceId: challenge.serviceId,
      serviceName: challenge.serviceName,
      amount: challenge.amount,
      amountSol: challenge.amountSol,
      currency: "SOL",
      txSignature,
      clientIp: challenge.clientIp,
      paidAt: challenge.paidAt,
      blockTime: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
    };
    const earnings = recordPayment(payment);

    // Send Telegram notification
    sendTelegramNotification(payment);

    console.log(`[x402 PAYMENT] ${payment.serviceName} | ${payment.amountSol} SOL | TX: ${txSignature.slice(0, 16)}...`);
    return { verified: true, challenge, earnings };
  } catch (err) {
    return { verified: false, reason: "Failed to verify transaction: " + err.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MEMORY ACCESS — Read/search memory logs from the agent
// ══════════════════════════════════════════════════════════════════════════════
function getAllMemoryLogs() {
  if (!fs.existsSync(USERS_DIR)) return [];
  const files = fs.readdirSync(USERS_DIR).filter(f => f.startsWith("memory-log-") && f.endsWith(".json"));
  const allMemories = [];
  for (const file of files) {
    try {
      const entries = JSON.parse(fs.readFileSync(path.join(USERS_DIR, file), "utf8"));
      allMemories.push(...entries);
    } catch { /* skip */ }
  }
  return allMemories.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
}

function searchMemories(query) {
  const all = getAllMemoryLogs();
  if (!query || query.length === 0) return all.slice(0, 50);
  const terms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const scored = all.map(m => {
    const text = ((m.text || "") + " " + (m.type || "")).toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (text.includes(term)) score += 1;
    }
    return { ...m, matchScore: score };
  }).filter(m => m.matchScore > 0).sort((a, b) => b.matchScore - a.matchScore);
  return scored.slice(0, 20);
}

function findMemoryByHash(hashPrefix) {
  const all = getAllMemoryLogs();
  const prefix = hashPrefix.toLowerCase().trim();
  if (prefix.length < 4) return [];

  const byHash = all.filter(e => e.contentHash && e.contentHash.toLowerCase().startsWith(prefix));
  const byTx = prefix.length >= 8 ? all.filter(e => e.tx && e.tx.toLowerCase().startsWith(prefix)) : [];

  const seen = new Set();
  const results = [];
  for (const r of [...byHash, ...byTx]) {
    const key = r.tx || r.contentHash || r.timestamp;
    if (!seen.has(key)) { seen.add(key); results.push(r); }
  }
  return results;
}

function findRelatedMemories(target, maxRelated = 8) {
  const all = getAllMemoryLogs();
  const targetWords = (target.text || "").toLowerCase().split(/\s+/).filter(w => w.length > 4);
  return all
    .filter(e => e.tx !== target.tx)
    .map(e => {
      const entryText = (e.text || "").toLowerCase();
      let overlap = 0;
      for (const w of targetWords) { if (entryText.includes(w)) overlap++; }
      if (e.type === target.type) overlap += 2;
      return { ...e, relevanceScore: overlap };
    })
    .filter(e => e.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxRelated);
}

// ══════════════════════════════════════════════════════════════════════════════
// AI SERVICE HANDLERS — Claude-powered services
// ══════════════════════════════════════════════════════════════════════════════

async function handleMemorySearch(query) {
  const results = searchMemories(query);
  if (results.length === 0) {
    return {
      success: true,
      query,
      count: 0,
      message: "No memories found matching this query.",
      memories: [],
    };
  }

  // Use Claude to summarize the search results
  const memTexts = results.slice(0, 10).map((r, i) =>
    `${i + 1}. [${r.type || "?"}] (${r.importance} bps, ${r.timestamp || "no date"}): ${(r.text || "").slice(0, 200)}`
  ).join("\n");

  const claudeRes = await anthropic.messages.create({
    model: MODEL, max_tokens: 500,
    system: "You are CognChain AI, an agent with on-chain memory. Summarize the search results concisely in English. Be specific and technical. 3-5 sentences.",
    messages: [{ role: "user", content: `Memory search results for "${query}":\n${memTexts}` }],
  });

  return {
    success: true,
    query,
    count: results.length,
    aiSummary: claudeRes.content[0].text.trim(),
    memories: results.map(r => ({
      hash: (r.contentHash || "").slice(0, 16),
      type: r.type,
      importance: r.importance,
      timestamp: r.timestamp,
      preview: (r.text || "").slice(0, 150),
      tx: r.tx,
    })),
  };
}

async function handleMemoryEvolve(hashPrefix) {
  const matches = findMemoryByHash(hashPrefix);
  if (matches.length === 0) {
    return { success: false, error: "No memory found for this hash prefix. Use at least 4 characters." };
  }

  const target = matches[0];
  const related = findRelatedMemories(target, 8);
  const storedDate = target.timestamp
    ? new Date(target.timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "unknown date";

  let relatedContext = "";
  if (related.length > 0) {
    relatedContext = "\n\n## Related Memories\n" +
      related.map((r, i) => `${i + 1}. [${r.type || "?"}] (${r.timestamp || "?"}): ${(r.text || "").slice(0, 200)}`).join("\n");
  }

  const claudeRes = await anthropic.messages.create({
    model: MODEL, max_tokens: 1200,
    system: `You are CognChain AI with persistent memory on Solana blockchain.
You are performing MEMORY EVOLUTION.

⚠️ OBRIGATORY: Your FIRST LINE must be EXACTLY:
"📅 FALAMOS SOBRE ISSO EM ${storedDate} — [1 impactful sentence about the topic]"

Then continue with:
📋 COMPLETE SUMMARY (3-5 detailed sentences)
🔍 ADDITIONAL CONTEXT (from related memories, 2-3 sentences)
🚀 IMPROVEMENTS & NEW INFORMATION (4-6 technical sentences with updates)
💡 SUGGESTED NEXT STEP

Be SPECIFIC and TECHNICAL. Respond in Portuguese (BR).`,
    messages: [{
      role: "user",
      content: `Evolve this blockchain memory:\n\n` +
        `## ORIGINAL MEMORY\nHash: ${target.contentHash || "N/A"}\nDate: ${storedDate}\n` +
        `Type: ${target.type || "unknown"}\nImportance: ${target.importance} bps\n` +
        `Content:\n${target.text}${relatedContext}`,
    }],
  });

  return {
    success: true,
    originalHash: (target.contentHash || "").slice(0, 16),
    originalDate: storedDate,
    originalType: target.type,
    originalImportance: target.importance,
    relatedCount: related.length,
    evolvedContent: claudeRes.content[0].text.trim(),
  };
}

async function handleInsights() {
  const allMemories = getAllMemoryLogs();
  if (allMemories.length === 0) {
    return { success: false, error: "No memories available for analysis." };
  }

  const memSummary = allMemories.slice(0, 30).map((m, i) =>
    `${i + 1}. [${m.type || "?"}] ${m.importance} bps | ${m.timestamp || "no date"} | ${(m.text || "").slice(0, 120)}`
  ).join("\n");

  const types = {};
  let totalImportance = 0;
  for (const m of allMemories) {
    const t = m.type || "unknown";
    types[t] = (types[t] || 0) + 1;
    totalImportance += m.importance || 0;
  }

  const claudeRes = await anthropic.messages.create({
    model: MODEL, max_tokens: 800,
    system: "You are CognChain AI analyzing its own memory patterns. Provide deep insights about knowledge patterns, gaps, and trends. Be specific and technical. Respond in English.",
    messages: [{
      role: "user",
      content: `Analyze these ${allMemories.length} agent memories:\n\n` +
        `## Memory Statistics\nTotal: ${allMemories.length}\nAvg importance: ${Math.round(totalImportance / allMemories.length)} bps\n` +
        `Types: ${JSON.stringify(types)}\n\n` +
        `## Recent Memories\n${memSummary}\n\n` +
        `Provide:\n1. KEY PATTERNS (what topics recur, what's the agent focused on)\n` +
        `2. KNOWLEDGE GAPS (what's missing or underexplored)\n` +
        `3. MEMORY EVOLUTION (how has the agent's knowledge grown)\n` +
        `4. RECOMMENDATIONS (what to learn next, 3 specific topics)`,
    }],
  });

  return {
    success: true,
    totalMemories: allMemories.length,
    typeDistribution: types,
    averageImportance: Math.round(totalImportance / allMemories.length),
    aiAnalysis: claudeRes.content[0].text.trim(),
  };
}

async function handleTeach(topic, content) {
  const fullText = content || topic;
  const claudeRes = await anthropic.messages.create({
    model: MODEL, max_tokens: 300,
    system: "You are CognChain AI. You just received new knowledge. Acknowledge what you learned in 1-2 sentences. Be specific. Respond in English.",
    messages: [{ role: "user", content: `New knowledge received:\nTopic: ${topic}\nContent: ${fullText}` }],
  });

  return {
    success: true,
    topic,
    acknowledged: claudeRes.content[0].text.trim(),
    storedAt: new Date().toISOString(),
    message: "Knowledge received and processed by CognChain agent.",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// TELEGRAM NOTIFICATION — Real-time alerts when agents pay
// ══════════════════════════════════════════════════════════════════════════════
async function sendTelegramNotification(payment) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    const TelegramBot = require("node-telegram-bot-api");
    const bot = new TelegramBot(TELEGRAM_TOKEN);
    const msg =
      `💰 *x402 Pagamento Recebido!*\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🧠 *Serviço:* ${payment.serviceName}\n` +
      `💵 *Valor:* ${payment.amountSol} SOL\n` +
      `📱 *Cliente:* ${payment.clientIp || "N/A"}\n` +
      `📝 *TX:* \`${payment.txSignature.slice(0, 20)}...\`\n` +
      `🔗 [Explorer](https://explorer.solana.com/tx/${payment.txSignature}?cluster=devnet)\n` +
      `📅 ${payment.paidAt}`;
    await bot.sendMessage(TELEGRAM_CHAT_ID, msg, { parse_mode: "Markdown", disable_web_page_preview: true });
  } catch (err) {
    console.error("[TELEGRAM NOTIFY ERROR]", err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// x402 MIDDLEWARE — Handles payment challenge & verification
// ══════════════════════════════════════════════════════════════════════════════

function x402Handler(serviceId, handlerFn) {
  return async (req, res) => {
    const paymentId = req.headers["x-payment-id"];
    const txSignature = req.headers["x-payment-tx"];

    // Case 1: No payment info → return 402 challenge
    if (!paymentId || !txSignature) {
      const challenge = createChallenge(serviceId, req.ip);
      if (!challenge) {
        return res.status(400).json({ error: `Unknown service: ${serviceId}` });
      }
      return res.status(402).json({
        error: "Payment Required",
        challenge,
        instructions: {
          step1: `Send ${challenge.priceDisplay} SOL to: ${challenge.destination}`,
          step2: "Include the paymentId as a reference in the transaction memo",
          step3: `Retry this request with headers: X-Payment-Id: ${challenge.paymentId} | X-Payment-Tx: <your-tx-signature>`,
          explorer: challenge.explorerUrl,
        },
      });
    }

    // Case 2: Payment info provided → verify
    const result = await verifyPayment(paymentId, txSignature);
    if (!result.verified) {
      return res.status(402).json({
        error: "Payment Required",
        reason: result.reason,
        instructions: "Verify the payment details and try again.",
      });
    }

    // Case 3: Payment verified → execute service
    try {
      const serviceResult = await handlerFn(req.body, result.challenge);
      return res.json({
        success: true,
        service: serviceId,
        payment: {
          paymentId: result.challenge.paymentId,
          amount: result.challenge.amountSol,
          tx: txSignature,
          verified: true,
        },
        ...serviceResult,
      });
    } catch (err) {
      console.error(`[x402 SERVICE ERROR] ${serviceId}:`, err.message);
      return res.status(500).json({ error: "Service execution failed", reason: err.message });
    }
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// API ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

// ── Root: Service Catalog ─────────────────────────────────────────────────────
app.get("/", (req, res) => {
  const earnings = loadEarnings();
  res.json({
    name: "CognChain x402 Server",
    version: "1.0.0",
    protocol: "HTTP 402 (x402)",
    description: "AI Agent-to-Agent Commerce on Solana. Pay for memory search, AI insights, knowledge evolution, and more.",
    network: "solana-devnet",
    agentWallet: AGENT_WALLET ? `${AGENT_WALLET.slice(0, 8)}...${AGENT_WALLET.slice(-8)}` : "not configured",
    uptime: process.uptime(),
    stats: {
      totalEarnings: `${(earnings.totalEarned / 1e9).toFixed(6)} SOL`,
      totalPayments: earnings.totalPayments,
      servicesAvailable: Object.keys(SERVICES).length,
    },
    services: Object.entries(SERVICES).map(([id, s]) => ({
      id,
      name: s.name,
      description: s.description,
      price: s.priceDisplay,
      endpoint: s.endpoint,
      method: s.method,
      example: s.inputSpec,
    })),
    howToUse: {
      step1: "Call any service endpoint (POST)",
      step2: "You'll receive a 402 Payment Required response with payment details",
      step3: "Send SOL to the agent wallet on Solana devnet",
      step4: "Retry the request with X-Payment-Id and X-Payment-Tx headers",
      step5: "Receive your AI-powered result!",
    },
    links: {
      explorer: AGENT_WALLET ? `https://explorer.solana.com/address/${AGENT_WALLET}?cluster=devnet` : null,
      docs: "/docs",
      payments: "/v1/payments",
      health: "/health",
    },
  });
});

// ── API Documentation ─────────────────────────────────────────────────────────
app.get("/docs", (req, res) => {
  res.json({
    title: "CognChain x402 API Documentation",
    protocol: "HTTP 402 — Machine-to-Machine Payment Protocol",
    baseUrl: `http://localhost:${PORT}`,
    headers: {
      "X-Payment-Id": "Payment challenge ID (returned in 402 response)",
      "X-Payment-Tx": "Solana transaction signature (after payment)",
    },
    endpoints: [
      {
        method: "GET", path: "/", description: "Service catalog and agent stats",
      },
      {
        method: "POST", path: "/v1/memory/search", description: "Search agent memories",
        body: { query: "string (search term)" },
        price: "0.00001 SOL",
      },
      {
        method: "POST", path: "/v1/memory/evolve", description: "AI-evolve a memory",
        body: { hash: "string (hash prefix, min 4 chars)" },
        price: "0.00005 SOL",
      },
      {
        method: "POST", path: "/v1/insights", description: "Full AI memory analysis",
        body: {},
        price: "0.0001 SOL",
      },
      {
        method: "POST", path: "/v1/teach", description: "Store new knowledge",
        body: { topic: "string", content: "string" },
        price: "0.00003 SOL",
      },
      {
        method: "GET", path: "/v1/payments", description: "Payment history",
      },
      {
        method: "GET", path: "/v1/earnings", description: "Earnings dashboard",
      },
      {
        method: "GET", path: "/health", description: "Health check",
      },
    ],
    exampleFlow: {
      description: "Complete x402 payment flow for memory search",
      steps: [
        { cmd: `curl -X POST http://localhost:${PORT}/v1/memory/search -H "Content-Type: application/json" -d '{"query":"Bitcoin"}'`, note: "Returns 402 with payment challenge" },
        { cmd: `# Send 0.00001 SOL to the agent wallet`, note: "Use Solana CLI, Phantom, or any wallet" },
        { cmd: `curl -X POST http://localhost:${PORT}/v1/memory/search -H "Content-Type: application/json" -H "X-Payment-Id: <paymentId>" -H "X-Payment-Tx: <txSignature>" -d '{"query":"Bitcoin"}'`, note: "Returns search results after payment verified" },
      ],
    },
  });
});

// ── Service Endpoints (with x402 middleware) ───────────────────────────────────
app.post("/v1/memory/search", x402Handler("memory-search", async (body) => {
  return handleMemorySearch(body.query || "");
}));

app.post("/v1/memory/evolve", x402Handler("memory-evolve", async (body) => {
  return handleMemoryEvolve(body.hash || "");
}));

app.post("/v1/insights", x402Handler("insights", async () => {
  return handleInsights();
}));

app.post("/v1/teach", x402Handler("teach", async (body) => {
  return handleTeach(body.topic || "", body.content || "");
}));

// ── Payment & Earnings Endpoints ──────────────────────────────────────────────
app.get("/v1/payments", (req, res) => {
  const earnings = loadEarnings();
  res.json({
    totalPayments: earnings.totalPayments,
    totalEarned: `${(earnings.totalEarned / 1e9).toFixed(6)} SOL`,
    recentPayments: earnings.payments.slice(0, 20),
  });
});

app.get("/v1/earnings", (req, res) => {
  const earnings = loadEarnings();
  res.json({
    agentWallet: AGENT_WALLET ? `${AGENT_WALLET.slice(0, 8)}...${AGENT_WALLET.slice(-8)}` : "not configured",
    totalEarned: `${(earnings.totalEarned / 1e9).toFixed(6)} SOL`,
    totalPayments: earnings.totalPayments,
    serviceBreakdown: earnings.serviceCount,
    recentPayments: earnings.payments.slice(0, 10).map(p => ({
      service: p.serviceName,
      amount: `${p.amountSol} SOL`,
      tx: p.txSignature,
      paidAt: p.paidAt,
    })),
  });
});

// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: `${Math.floor(process.uptime())}s`,
    agentWallet: AGENT_WALLET ? "configured" : "NOT CONFIGURED",
    solanaRpc: RPC,
    anthropicModel: MODEL,
    servicesAvailable: Object.keys(SERVICES).length,
    pendingPayments: pendingPayments.size,
    timestamp: new Date().toISOString(),
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SERVER START
// ══════════════════════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log("");
  console.log("  ╔═══════════════════════════════════════════════════════════╗");
  console.log("  ║           CognChain x402 Payment Server                   ║");
  console.log("  ║     AI Agent-to-Agent Commerce on Solana Devnet           ║");
  console.log("  ╠═══════════════════════════════════════════════════════════╣");
  console.log(`  ║  Port:          ${PORT}                                  ║`);
  console.log(`  ║  Agent Wallet:  ${AGENT_WALLET ? AGENT_WALLET.slice(0, 16) + "..." : "NOT CONFIGURED"}                  ║`);
  console.log(`  ║  RPC:           ${RPC.slice(0, 35).padEnd(36)}║`);
  console.log(`  ║  AI Model:      ${MODEL.padEnd(36)}║`);
  console.log(`  ║  Services:      ${Object.keys(SERVICES).length} available${" ".repeat(24)}║`);
  console.log(`  ║  Telegram:      ${TELEGRAM_CHAT_ID ? "Notifications ON" : "Notifications OFF"}${" ".repeat(22)}║`);
  console.log("  ╠═══════════════════════════════════════════════════════════╣");
  console.log("  ║  Endpoints:                                              ║");
  console.log("  ║    GET  /           → Service catalog                    ║");
  console.log("  ║    GET  /docs       → API documentation                 ║");
  console.log("  ║    POST /v1/memory/search  → Search memories (402)       ║");
  console.log("  ║    POST /v1/memory/evolve  → Evolve memory (402)         ║");
  console.log("  ║    POST /v1/insights       → AI analysis (402)           ║");
  console.log("  ║    POST /v1/teach          → Store knowledge (402)       ║");
  console.log("  ║    GET  /v1/payments  → Payment history                 ║");
  console.log("  ║    GET  /v1/earnings  → Earnings dashboard               ║");
  console.log("  ║    GET  /health       → Health check                     ║");
  console.log("  ╚═══════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`  🌐 http://localhost:${PORT}`);
  console.log(`  📖 http://localhost:${PORT}/docs`);
  console.log("");
});
