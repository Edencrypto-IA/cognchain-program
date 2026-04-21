// telegram-bot.js — CognChain Telegram Bot
// Reads Solana vault memories → calls Claude → scores → writes on-chain → replies

const TelegramBot = require("node-telegram-bot-api");
const { Connection, Keypair, PublicKey, SystemProgram, Transaction, VersionedTransaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const fetch    = require("node-fetch");
const FormData = require("form-data");
const anchor = require("@coral-xyz/anchor");
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const { scoreMemory } = require("./scorer");
const { hashMemory } = require("./hasher");
const { extractMemory } = require("./extractor");

// ── Config ───────────────────────────────────────────────────────────────────
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-5";
const PROGRAM_ID = new PublicKey("7AHMKtvPuZ6yKdWtWD1kC6kgPkEgooeBBtrmUrVc2teU");
const RPC = "https://devnet.helius-rpc.com/?api-key=86b9952e-7447-409f-81f8-92d8603e1a07";

const IDL = {"version":"0.1.0","name":"cognchain","instructions":[{"name":"createVault","accounts":[{"name":"vault","isMut":true,"isSigner":false},{"name":"authority","isMut":true,"isSigner":true},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[{"name":"label","type":"string"}]},{"name":"writeMemory","accounts":[{"name":"vault","isMut":true,"isSigner":false},{"name":"record","isMut":true,"isSigner":false},{"name":"authority","isMut":true,"isSigner":true},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[{"name":"contentHash","type":{"array":["u8",32]}},{"name":"summaryHash","type":{"array":["u8",32]}},{"name":"importance","type":"u16"},{"name":"agentType","type":"u8"}]},{"name":"readMemory","accounts":[{"name":"vault","isMut":false,"isSigner":false},{"name":"record","isMut":false,"isSigner":false},{"name":"authority","isMut":true,"isSigner":true}],"args":[]}],"accounts":[{"name":"Vault","type":{"kind":"struct","fields":[{"name":"authority","type":"publicKey"},{"name":"label","type":"string"},{"name":"recordCount","type":"u16"},{"name":"bump","type":"u8"},{"name":"createdAt","type":"i64"}]}},{"name":"MemoryRecord","type":{"kind":"struct","fields":[{"name":"vault","type":"publicKey"},{"name":"id","type":"u16"},{"name":"authority","type":"publicKey"},{"name":"contentHash","type":{"array":["u8",32]}},{"name":"summaryHash","type":{"array":["u8",32]}},{"name":"importance","type":"u16"},{"name":"agentType","type":"u8"},{"name":"bump","type":"u8"},{"name":"createdAt","type":"i64"}]}}],"errors":[{"code":6000,"name":"LabelTooLong","msg":"Label exceeds 64 characters."},{"code":6001,"name":"InvalidImportance","msg":"Importance must be between 0 and 10000 bps."},{"code":6002,"name":"VaultFull","msg":"Vault has reached the maximum number of records."},{"code":6003,"name":"WrongVault","msg":"Record does not belong to this vault."}]};

// ── Validate env ─────────────────────────────────────────────────────────────
if (!TELEGRAM_TOKEN) { console.error("❌ TELEGRAM_BOT_TOKEN not set"); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error("❌ ANTHROPIC_API_KEY not set"); process.exit(1); }

// ── Solana setup ─────────────────────────────────────────────────────────────
const walletData = JSON.parse(fs.readFileSync("./wallet.json"));
const keypair = Keypair.fromSecretKey(Uint8Array.from(walletData));
const connection = new Connection(RPC, "confirmed");
const wallet = new anchor.Wallet(keypair);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
anchor.setProvider(provider);
const program = new anchor.Program(IDL, PROGRAM_ID, provider);

// ── Anthropic setup ──────────────────────────────────────────────────────────
const anthropic = new Anthropic.default({ apiKey: ANTHROPIC_API_KEY });

// ── AgentB — fixed-seed derived keypair ──────────────────────────────────────
const AGENT_B_SEED = Buffer.from("cognchain-agent-b-fixed-seed-v1!"); // exactly 32 bytes
const agentBKeypair = Keypair.fromSeed(AGENT_B_SEED);

// ── PDA helpers ──────────────────────────────────────────────────────────────
function deriveVaultPdaFor(pubkey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), pubkey.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

function deriveVaultPda() { return deriveVaultPdaFor(keypair.publicKey); }

function deriveRecordPda(vaultPda, index) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(index);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("record"), vaultPda.toBuffer(), buf],
    PROGRAM_ID
  );
  return pda;
}

// Build an Anchor program instance signed by any keypair
function makeProgramFor(kp) {
  const w = new anchor.Wallet(kp);
  const prov = new anchor.AnchorProvider(connection, w, { commitment: "confirmed" });
  return new anchor.Program(IDL, PROGRAM_ID, prov);
}

// ── Vault init ───────────────────────────────────────────────────────────────
async function ensureVaultFor(prog, kp, label = "CognChain Vault") {
  const vaultPda = deriveVaultPdaFor(kp.publicKey);
  try {
    return await prog.account.vault.fetch(vaultPda);
  } catch {
    await prog.methods
      .createVault(label)
      .accounts({
        vault: vaultPda,
        authority: kp.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    return prog.account.vault.fetch(vaultPda);
  }
}

async function ensureVault(vaultPda) {
  try {
    return await program.account.vault.fetch(vaultPda);
  } catch {
    console.log("🔨 Creating vault...");
    await program.methods
      .createVault("CognChain Telegram Bot")
      .accounts({
        vault: vaultPda,
        authority: keypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    return program.account.vault.fetch(vaultPda);
  }
}

// ── Read all on-chain records ─────────────────────────────────────────────────
async function readVaultMemories(vaultPda, recordCount) {
  const records = [];
  for (let i = 0; i < recordCount; i++) {
    try {
      const rec = await program.account.memoryRecord.fetch(deriveRecordPda(vaultPda, i));
      records.push({
        id: rec.id,
        importance: rec.importance,
        createdAt: new Date(rec.createdAt.toNumber() * 1000).toISOString(),
        contentHash: Buffer.from(rec.contentHash).toString("hex").slice(0, 16),
      });
    } catch { /* skip missing */ }
  }
  return records;
}

// ── Write memory on-chain (generic — any keypair/program) ────────────────────
// ── memory-log.json helpers ───────────────────────────────────────────────────
const MEMORY_LOG_PATH = "./memory-log.json";

function readMemoryLog() {
  try {
    return JSON.parse(fs.readFileSync(MEMORY_LOG_PATH, "utf8"));
  } catch {
    return [];
  }
}

function appendMemoryLog(entry) {
  const log = readMemoryLog();
  log.push(entry);
  fs.writeFileSync(MEMORY_LOG_PATH, JSON.stringify(log, null, 2), "utf8");
}

async function writeMemoryWith(prog, kp, text, agentType = 0) {
  const vaultPda = deriveVaultPdaFor(kp.publicKey);
  const vault = await prog.account.vault.fetch(vaultPda);
  const extracted = extractMemory(text);
  const { score, approved } = scoreMemory(extracted);
  if (!approved) return { approved: false, score };

  const { contentHash, summaryHash } = hashMemory(extracted);
  const recordId = vault.recordCount;
  const recordPda = deriveRecordPda(vaultPda, recordId);
  const importance = Math.min(score, 10000);

  const tx = await prog.methods
    .writeMemory(
      Array.from(contentHash),
      Array.from(summaryHash),
      importance,
      agentType
    )
    .accounts({
      vault: vaultPda,
      record: recordPda,
      authority: kp.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  appendMemoryLog({
    recordId,
    text,
    type: extracted.type,
    importance,
    agentType,
    timestamp: new Date().toISOString(),
    tx,
  });

  return { approved: true, tx, importance, score };
}

// ── Write memory on-chain ─────────────────────────────────────────────────────
async function writeMemoryOnChain(vaultPda, recordCount, extracted, score, originalText = "") {
  const { contentHash, summaryHash } = hashMemory(extracted);
  const recordPda = deriveRecordPda(vaultPda, recordCount);
  const importance = Math.min(score, 10000);

  const tx = await program.methods
    .writeMemory(
      Array.from(contentHash),
      Array.from(summaryHash),
      importance,
      0
    )
    .accounts({
      vault: vaultPda,
      record: recordPda,
      authority: keypair.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  if (originalText) {
    appendMemoryLog({
      recordId: recordCount,
      text: originalText,
      type: extracted.type,
      importance,
      agentType: 0,
      timestamp: new Date().toISOString(),
      tx,
    });
  }

  return { tx, importance, recordPda };
}

// ── AgentPay flow ─────────────────────────────────────────────────────────────
async function agentPayFlow(task, amountSol) {
  const agentAProg = program; // AgentA = wallet.json keypair
  const agentBProg = makeProgramFor(agentBKeypair);
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
  const FUNDING_LAMPORTS = Math.round(0.01 * LAMPORTS_PER_SOL); // covers AgentB rent + fees

  // 1. AgentA balance check (funding + payment + memory txs + fees)
  const balanceA = await connection.getBalance(keypair.publicKey);
  if (balanceA < FUNDING_LAMPORTS + lamports + 20000) {
    throw new Error(`AgentA insufficient balance (${(balanceA / LAMPORTS_PER_SOL).toFixed(4)} SOL)`);
  }

  // 2. Fund AgentB with 0.01 SOL so it can pay rent and fees (skip if already funded)
  const balanceB = await connection.getBalance(agentBKeypair.publicKey);
  let fundingSig = null;
  if (balanceB < FUNDING_LAMPORTS) {
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: agentBKeypair.publicKey,
        lamports: FUNDING_LAMPORTS,
      })
    );
    fundingSig = await sendAndConfirmTransaction(connection, fundTx, [keypair], { commitment: "confirmed" });
  }

  // 3. AgentA → AgentB task payment
  const payTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: agentBKeypair.publicKey,
      lamports,
    })
  );
  const paymentSig = await sendAndConfirmTransaction(connection, payTx, [keypair], { commitment: "confirmed" });

  // 3. Read AgentA vault memories for task context
  const agentAVaultPda = deriveVaultPdaFor(keypair.publicKey);
  const agentAVault = await ensureVault(agentAVaultPda);
  const chainRecords = await readVaultMemories(agentAVaultPda, agentAVault.recordCount);

  // 4. AgentB calls Claude with task + memory context
  let memCtx = "";
  if (chainRecords.length > 0) {
    memCtx = `\n## AgentA's Vault Memories (${chainRecords.length} records)\n` +
      chainRecords.map(r => `  - Record #${r.id}: importance=${r.importance} bps, ${r.createdAt}`).join("\n");
  }
  const agentBSystem = `You are AgentB, a specialist AI worker in a multi-agent economy on Solana.
AgentA has paid you ${amountSol} SOL to complete the following task.
You have access to AgentA's on-chain memory vault for context.
Deliver a precise, actionable result. 3–5 sentences.${memCtx}`;

  const agentBMsg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: agentBSystem,
    messages: [{ role: "user", content: `Task: ${task}` }],
  });
  const taskResult = agentBMsg.content[0].text.trim();

  // 5. Ensure AgentB vault exists, then write result memory
  await ensureVaultFor(agentBProg, agentBKeypair, "CognChain AgentB Vault");
  const agentBMemText = `AgentB completed task for AgentA (paid ${amountSol} SOL). Task: ${task}. Result: ${taskResult}`;
  const agentBMem = await writeMemoryWith(agentBProg, agentBKeypair, agentBMemText, 1);

  // 6. AgentA writes confirmation memory
  await ensureVault(agentAVaultPda);
  const agentAMemText = `AgentA delegated task to AgentB (paid ${amountSol} SOL). Task: ${task}. Result confirmed: ${taskResult}`;
  const agentAMem = await writeMemoryWith(agentAProg, keypair, agentAMemText, 0);

  return {
    taskResult,
    fundingSig,
    paymentSig,
    amountSol,
    agentA: keypair.publicKey.toBase58(),
    agentB: agentBKeypair.publicKey.toBase58(),
    agentBMem,
    agentAMem,
  };
}

// ── Build Claude prompt ───────────────────────────────────────────────────────
function buildPrompt(userMessage, chainRecords) {
  let memCtx = "";
  if (chainRecords.length > 0) {
    const avgImportance = Math.round(
      chainRecords.reduce((s, r) => s + r.importance, 0) / chainRecords.length
    );
    memCtx = `\n## Persistent Memory (Solana Devnet Vault)\n` +
      `You have ${chainRecords.length} memory record(s) on-chain ` +
      `(avg importance: ${avgImportance} bps):\n` +
      chainRecords.map(r =>
        `  - Record #${r.id}: importance=${r.importance} bps, stored ${r.createdAt}`
      ).join("\n") + "\n";
  }

  const system = `You are CognChain, an AI assistant with persistent memory stored on the Solana blockchain.
Each of your valuable responses is scored and written on-chain as a memory record.
Provide clear, insightful, and concrete responses. Build on prior context when available.${memCtx ? "\n" + memCtx : ""}`;

  return { system, user: userMessage };
}

// ── Process a user message end-to-end ────────────────────────────────────────
async function processMessage(userMessage) {
  const vaultPda = deriveVaultPda();

  // 1. Read Solana vault memories
  const vault = await ensureVault(vaultPda);
  const chainRecords = await readVaultMemories(vaultPda, vault.recordCount);

  // 2. Call Claude
  const { system, user } = buildPrompt(userMessage, chainRecords);
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system,
    messages: [{ role: "user", content: user }],
  });
  const aiResponse = message.content[0].text.trim();

  // 3. Score the response
  const extracted = extractMemory(aiResponse);
  const { score, approved } = scoreMemory(extracted);

  // 4. Write to Solana if score >= 4000
  let txInfo = null;
  if (approved) {
    const freshVault = await program.account.vault.fetch(vaultPda);
    txInfo = await writeMemoryOnChain(vaultPda, freshVault.recordCount, extracted, score, aiResponse);
  }

  return { aiResponse, score, approved, txInfo, chainRecords };
}

// ── Format Telegram reply ─────────────────────────────────────────────────────
function formatReply({ aiResponse, score, approved, txInfo, chainRecords }) {
  let reply = `${aiResponse}\n\n`;
  reply += `📊 *Memory Score:* ${score} bps`;

  if (approved && txInfo) {
    reply += ` ✅\n`;
    reply += `⛓️ *Stored on Solana!*\n`;
    reply += `📝 TX: \`${txInfo.tx}\`\n`;
    reply += `🔗 [View on Explorer](https://explorer.solana.com/tx/${txInfo.tx}?cluster=devnet)\n`;
    reply += `💾 Importance: ${txInfo.importance} bps`;
  } else {
    reply += ` _(below threshold, not stored)_\n`;
    reply += `📦 Vault has ${chainRecords.length} existing record(s)`;
  }

  return reply;
}

// ── SOL transfer + vault memory ───────────────────────────────────────────────
async function sendSolAndRecord(amountSol, destinationAddress) {
  const destination = new PublicKey(destinationAddress);
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: destination,
      lamports,
    })
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [keypair], { commitment: "confirmed" });

  // Write the transfer as a memory record
  const vaultPda = deriveVaultPda();
  const vault = await ensureVault(vaultPda);
  const memText = `SOL transfer: sent ${amountSol} SOL to ${destinationAddress}. TX: ${sig}`;
  const extracted = extractMemory(memText);
  const { score, approved } = scoreMemory(extracted);

  let memTxInfo = null;
  if (approved) {
    const freshVault = await program.account.vault.fetch(vaultPda);
    memTxInfo = await writeMemoryOnChain(vaultPda, freshVault.recordCount, extracted, score, memText);
  }

  return { sig, lamports, score, approved, memTxInfo };
}

// ── Bot setup ─────────────────────────────────────────────────────────────────
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Track in-flight requests per chat to avoid overlaps
const processing = new Set();

// ── Security layer ────────────────────────────────────────────────────────────
const MAX_TX_SOL   = 0.1;
const MAX_DAILY_SOL = 1.0;

const security = {
  paused: false,
  dailySpent: 0,
  dayKey: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
};

function resetDailyIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (security.dayKey !== today) {
    security.dailySpent = 0;
    security.dayKey = today;
  }
}

// Write a security event to vault (best-effort, never throws)
async function writeSecurityMemory(eventText) {
  try {
    const vaultPda = deriveVaultPda();
    await ensureVault(vaultPda);
    const extracted = extractMemory(eventText);
    // Force approve by overriding score — security events always get stored
    const { contentHash, summaryHash } = hashMemory(extracted);
    const vault = await program.account.vault.fetch(vaultPda);
    const recordId = vault.recordCount;
    const recordPda = deriveRecordPda(vaultPda, recordId);
    const tx = await program.methods
      .writeMemory(Array.from(contentHash), Array.from(summaryHash), 5000, 0)
      .accounts({ vault: vaultPda, record: recordPda, authority: keypair.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
      .rpc();
    appendMemoryLog({
      recordId,
      text: eventText,
      type: "security",
      importance: 5000,
      agentType: 0,
      timestamp: new Date().toISOString(),
      tx,
    });
  } catch (err) {
    console.error("[SECURITY MEMORY ERROR]", err.message);
  }
}

// Returns { safe: bool, verdict: string }
async function claudeSafetyCheck(command, amountSol, destination) {
  const prompt =
    `You are a security agent guarding an autonomous Solana wallet.\n` +
    `Analyze the following command and decide if it is SAFE or UNSAFE.\n\n` +
    `Command: ${command}\n` +
    `Amount: ${amountSol} SOL\n` +
    `Destination: ${destination}\n\n` +
    `Flag UNSAFE if you detect any of:\n` +
    `- Known scam/phishing patterns\n` +
    `- Social engineering (urgency, impersonation, too-good-to-be-true)\n` +
    `- Destination looks like a drainer or mixer\n` +
    `- Unusual amount combined with suspicious destination\n\n` +
    `Respond exactly as:\nVERDICT: SAFE\nREASON: <one sentence>\n` +
    `or\nVERDICT: UNSAFE\nREASON: <one sentence>`;

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 100,
    system: "You are a concise blockchain security auditor.",
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content[0].text.trim();
  const unsafe = /VERDICT:\s*UNSAFE/i.test(text);
  const reasonMatch = text.match(/REASON:\s*(.+)/i);
  return { safe: !unsafe, verdict: reasonMatch ? reasonMatch[1].trim() : text };
}

// Central guard — call before any SOL-spending command.
// Returns { allowed: bool, reason: string }
async function securityGuard(command, amountSol, destination) {
  resetDailyIfNeeded();

  if (security.paused) {
    return { allowed: false, reason: "Bot is paused by operator. Use /resume to re-enable." };
  }

  if (amountSol > MAX_TX_SOL) {
    const msg = `Transaction of ${amountSol} SOL exceeds per-tx limit of ${MAX_TX_SOL} SOL.`;
    await writeSecurityMemory(`BLOCKED (per-tx limit): ${msg} Command: ${command}`);
    return { allowed: false, reason: msg };
  }

  if (security.dailySpent + amountSol > MAX_DAILY_SOL) {
    const remaining = (MAX_DAILY_SOL - security.dailySpent).toFixed(4);
    const msg = `Daily limit reached. Spent ${security.dailySpent.toFixed(4)} SOL today, limit is ${MAX_DAILY_SOL} SOL (${remaining} SOL remaining).`;
    await writeSecurityMemory(`BLOCKED (daily limit): ${msg} Command: ${command}`);
    return { allowed: false, reason: msg };
  }

  const { safe, verdict } = await claudeSafetyCheck(command, amountSol, destination);
  if (!safe) {
    const msg = `Claude safety check flagged this as UNSAFE: ${verdict}`;
    await writeSecurityMemory(`BLOCKED (safety check): ${msg} Command: ${command}`);
    return { allowed: false, reason: msg };
  }

  return { allowed: true, reason: verdict };
}

function recordSpend(amountSol) {
  resetDailyIfNeeded();
  security.dailySpent += amountSol;
}

bot.onText(/^\/agentpay (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const raw = match[1].trim();

  // Last token is the amount, everything before it is the task
  const parts = raw.split(/\s+/);
  if (parts.length < 2) {
    return bot.sendMessage(chatId, "⚠️ Usage: `/agentpay <task description> <amount_sol>`\nExample: `/agentpay explain Solana PDAs 0.001`", { parse_mode: "Markdown" });
  }
  const amountSol = parseFloat(parts[parts.length - 1]);
  const task = parts.slice(0, -1).join(" ");

  if (isNaN(amountSol) || amountSol <= 0) {
    return bot.sendMessage(chatId, "❌ Last argument must be a positive SOL amount.", { parse_mode: "Markdown" });
  }

  if (processing.has(chatId)) {
    return bot.sendMessage(chatId, "⏳ Still processing a previous request, please wait...");
  }

  processing.add(chatId);
  let statusMsg;

  try {
    statusMsg = await bot.sendMessage(chatId, `🛡️ Running security checks...`, { parse_mode: "Markdown" });

    const guard = await securityGuard(`/agentpay ${task}`, amountSol, "AgentB:" + agentBKeypair.publicKey.toBase58());
    if (!guard.allowed) {
      return bot.editMessageText(`🚫 *AgentPay blocked*\n\n${guard.reason}`, {
        chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown",
      });
    }

    await bot.editMessageText(
      `🤖 *AgentPay initiated*\n\n` +
      `📋 Task: _${task}_\n` +
      `💸 Payment: ${amountSol} SOL\n\n` +
      `⏳ AgentA paying AgentB → AgentB working → writing memories...`,
      { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown" }
    );

    const result = await agentPayFlow(task, amountSol);
    recordSpend(amountSol);

    let reply = `🤖 *AgentPay Complete — Agent-to-Agent Economy*\n\n`;
    reply += `📋 *Task:* _${task}_\n\n`;
    reply += `💬 *AgentB's Result:*\n${result.taskResult}\n\n`;
    reply += `━━━━━━━━━━━━━━━━━━━━\n`;
    if (result.fundingSig) {
      reply += `🪙 *Funding TX* (0.01 SOL rent cover)\n`;
      reply += `\`${result.fundingSig}\`\n`;
      reply += `[Explorer](https://explorer.solana.com/tx/${result.fundingSig}?cluster=devnet)\n\n`;
    }
    reply += `💸 *Payment TX* (AgentA → AgentB)\n`;
    reply += `\`${result.paymentSig}\`\n`;
    reply += `[Explorer](https://explorer.solana.com/tx/${result.paymentSig}?cluster=devnet) · ${result.amountSol} SOL\n\n`;
    reply += `🤖 *AgentB* \`${result.agentB.slice(0, 8)}...\`\n`;

    if (result.agentBMem.approved) {
      reply += `🧠 Memory written ✅\n`;
      reply += `\`${result.agentBMem.tx}\`\n`;
      reply += `[Explorer](https://explorer.solana.com/tx/${result.agentBMem.tx}?cluster=devnet) · ${result.agentBMem.importance} bps\n\n`;
    } else {
      reply += `📊 Memory score ${result.agentBMem.score} bps _(not stored)_\n\n`;
    }

    reply += `🤖 *AgentA* \`${result.agentA.slice(0, 8)}...\`\n`;
    if (result.agentAMem.approved) {
      reply += `🧠 Confirmation memory ✅\n`;
      reply += `\`${result.agentAMem.tx}\`\n`;
      reply += `[Explorer](https://explorer.solana.com/tx/${result.agentAMem.tx}?cluster=devnet) · ${result.agentAMem.importance} bps`;
    } else {
      reply += `📊 Confirmation score ${result.agentAMem.score} bps _(not stored)_`;
    }

    await bot.editMessageText(reply, {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });

    console.log(`[AGENTPAY] chat=${chatId} task="${task}" amount=${amountSol} payTx=${result.paymentSig}`);
  } catch (err) {
    console.error(`[AGENTPAY ERROR] chat=${chatId}:`, err.message);
    const errText = `❌ AgentPay failed: ${err.message}`;
    if (statusMsg) {
      await bot.editMessageText(errText, { chat_id: chatId, message_id: statusMsg.message_id }).catch(() => {});
    } else {
      await bot.sendMessage(chatId, errText).catch(() => {});
    }
  } finally {
    processing.delete(chatId);
  }
});

// ── Token mint registry ───────────────────────────────────────────────────────
const KNOWN_MINTS = {
  SOL:  { address: "So11111111111111111111111111111111111111112", decimals: 9 },
  USDC: { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  USDT: { address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  BONK: { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5 },
};

const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6";

async function jupiterSwap(inputSymbol, outputSymbol, amountHuman) {
  const inToken  = KNOWN_MINTS[inputSymbol.toUpperCase()];
  const outToken = KNOWN_MINTS[outputSymbol.toUpperCase()];
  if (!inToken)  throw new Error(`Unknown input token "${inputSymbol}". Supported: ${Object.keys(KNOWN_MINTS).join(", ")}`);
  if (!outToken) throw new Error(`Unknown output token "${outputSymbol}". Supported: ${Object.keys(KNOWN_MINTS).join(", ")}`);

  const amountLamports = Math.round(amountHuman * Math.pow(10, inToken.decimals));

  // 1. Get quote
  const quoteUrl = `${JUPITER_QUOTE_API}/quote?inputMint=${inToken.address}&outputMint=${outToken.address}&amount=${amountLamports}&slippageBps=50`;
  const quoteRes = await fetch(quoteUrl);
  if (!quoteRes.ok) throw new Error(`Jupiter quote failed: ${quoteRes.status} ${await quoteRes.text()}`);
  const quote = await quoteRes.json();
  if (quote.error) throw new Error(`Jupiter quote error: ${quote.error}`);

  const outAmount     = (parseInt(quote.outAmount) / Math.pow(10, outToken.decimals)).toFixed(outToken.decimals === 9 ? 6 : 4);
  const priceImpact   = parseFloat(quote.priceImpactPct || 0).toFixed(4);

  // 2. Get swap transaction
  const swapRes = await fetch(`${JUPITER_QUOTE_API}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: keypair.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });
  if (!swapRes.ok) throw new Error(`Jupiter swap TX failed: ${swapRes.status} ${await swapRes.text()}`);
  const { swapTransaction } = await swapRes.json();
  if (!swapTransaction) throw new Error("Jupiter returned no swapTransaction");

  // 3. Deserialize, sign, and send
  const txBuf = Buffer.from(swapTransaction, "base64");
  const vTx   = VersionedTransaction.deserialize(txBuf);
  vTx.sign([keypair]);

  const sig = await connection.sendRawTransaction(vTx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  await connection.confirmTransaction(sig, "confirmed");

  return { sig, inAmount: amountHuman, inSymbol: inputSymbol.toUpperCase(), outAmount, outSymbol: outputSymbol.toUpperCase(), priceImpact };
}

bot.onText(/^\/swap (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const parts  = match[1].trim().split(/\s+/);

  if (parts.length !== 3) {
    return bot.sendMessage(chatId,
      "⚠️ Usage: `/swap <amount> <FROM> <TO>`\nExample: `/swap 0.01 SOL USDC`\nSupported tokens: " + Object.keys(KNOWN_MINTS).join(", "),
      { parse_mode: "Markdown" }
    );
  }

  const amountHuman  = parseFloat(parts[0]);
  const inputSymbol  = parts[1];
  const outputSymbol = parts[2];

  if (isNaN(amountHuman) || amountHuman <= 0) {
    return bot.sendMessage(chatId, "❌ Amount must be a positive number.", { parse_mode: "Markdown" });
  }

  if (processing.has(chatId)) {
    return bot.sendMessage(chatId, "⏳ Still processing a previous request, please wait...");
  }

  processing.add(chatId);
  let statusMsg;

  try {
    if (security.paused) {
      return bot.sendMessage(chatId, "🚫 *Swap blocked* — bot is paused. Use /resume to re-enable.", { parse_mode: "Markdown" });
    }

    statusMsg = await bot.sendMessage(
      chatId,
      `🔄 Fetching Jupiter quote for ${amountHuman} ${inputSymbol.toUpperCase()} → ${outputSymbol.toUpperCase()}...`,
      { parse_mode: "Markdown" }
    );

    const swap = await jupiterSwap(inputSymbol, outputSymbol, amountHuman);

    // Write swap as memory to vault
    const vaultPda  = deriveVaultPda();
    const memText   = `Swap executed: ${swap.inAmount} ${swap.inSymbol} → ${swap.outAmount} ${swap.outSymbol}, price impact ${swap.priceImpact}%, TX ${swap.sig}`;
    const extracted = extractMemory(memText);
    const { score, approved } = scoreMemory(extracted);
    let memTxInfo = null;
    if (approved) {
      const freshVault = await program.account.vault.fetch(vaultPda);
      memTxInfo = await writeMemoryOnChain(vaultPda, freshVault.recordCount, extracted, score, memText);
    }

    let reply = `✅ *Swap Complete!*\n\n`;
    reply += `🔄 ${swap.inAmount} *${swap.inSymbol}* → ${swap.outAmount} *${swap.outSymbol}*\n`;
    reply += `📉 Price impact: \`${swap.priceImpact}%\`\n`;
    reply += `📝 TX: \`${swap.sig}\`\n`;
    reply += `🔗 [View on Explorer](https://explorer.solana.com/tx/${swap.sig}?cluster=mainnet-beta)\n\n`;

    if (memTxInfo) {
      reply += `🧠 Swap saved to vault (${memTxInfo.importance} bps)\n`;
      reply += `\`${memTxInfo.tx}\`\n`;
      reply += `[Memory TX](https://explorer.solana.com/tx/${memTxInfo.tx}?cluster=devnet)`;
    } else {
      reply += `📊 Memory score: ${score} bps _(below threshold)_`;
    }

    await bot.editMessageText(reply, {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });

    console.log(`[SWAP] chat=${chatId} ${swap.inAmount} ${swap.inSymbol}→${swap.outSymbol} sig=${swap.sig}`);
  } catch (err) {
    console.error(`[SWAP ERROR] chat=${chatId}:`, err.message);
    const errText = `❌ Swap failed: ${err.message}`;
    if (statusMsg) {
      await bot.editMessageText(errText, { chat_id: chatId, message_id: statusMsg.message_id }).catch(() => {});
    } else {
      await bot.sendMessage(chatId, errText).catch(() => {});
    }
  } finally {
    processing.delete(chatId);
  }
});

// ── Pump.fun token creation ───────────────────────────────────────────────────
async function pumpFunCreate({ name, symbol, description, twitter = "", telegram = "", website = "" }) {
  // Step 1: Upload metadata to Pump.fun IPFS
  const form = new FormData();
  form.append("name",        name);
  form.append("symbol",      symbol);
  form.append("description", description);
  form.append("twitter",     twitter);
  form.append("telegram",    telegram);
  form.append("website",     website);
  form.append("showName",    "true");

  const ipfsRes = await fetch("https://pump.fun/api/ipfs", {
    method: "POST",
    body:   form,
    headers: form.getHeaders(),
  });

  if (!ipfsRes.ok) {
    throw new Error(`Pump.fun IPFS upload failed: ${ipfsRes.status}`);
  }

  const { metadataUri } = await ipfsRes.json();
  if (!metadataUri) throw new Error("Pump.fun returned no metadataUri");

  // Step 2: Generate mint keypair and build create transaction via Pump.fun API
  const mintKeypair = Keypair.generate();

  const createRes = await fetch("https://pump.fun/api/trade-local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey:   keypair.publicKey.toBase58(),
      action:      "create",
      tokenMetadata: { name, symbol, uri: metadataUri },
      mint:        mintKeypair.publicKey.toBase58(),
      denominatedInSol: "true",
      amount:      0.001,          // initial buy in SOL
      slippage:    10,
      priorityFee: 0.0005,
      pool:        "pump",
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Pump.fun trade-local failed: ${createRes.status}`);
  }

  const txBuf = Buffer.from(await createRes.arrayBuffer());
  const vTx   = VersionedTransaction.deserialize(txBuf);
  vTx.sign([keypair, mintKeypair]);

  const sig = await connection.sendRawTransaction(vTx.serialize(), {
    skipPreflight:        false,
    preflightCommitment:  "confirmed",
  });
  await connection.confirmTransaction(sig, "confirmed");

  return {
    simulated:   false,
    mintAddress: mintKeypair.publicKey.toBase58(),
    metadataUri,
    tx:          sig,
  };
}

function simulatePumpFun(name, symbol) {
  const mintKeypair = Keypair.generate();
  return {
    simulated:   true,
    mintAddress: mintKeypair.publicKey.toBase58(),
    metadataUri: null,
    tx:          null,
  };
}

bot.onText(/^\/memecoin (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const raw    = match[1].trim();

  // Parse: first token = name, second = symbol, rest = description
  // Also accept quoted description: /memecoin Name SYM 'desc here'
  const quoteMatch = raw.match(/^(\S+)\s+(\S+)\s+['"](.+)['"]$/s);
  const plainParts = raw.split(/\s+/);

  let name, symbol, userDesc;
  if (quoteMatch) {
    [, name, symbol, userDesc] = quoteMatch;
  } else if (plainParts.length >= 3) {
    name     = plainParts[0];
    symbol   = plainParts[1];
    userDesc = plainParts.slice(2).join(" ");
  } else {
    return bot.sendMessage(chatId,
      "⚠️ Usage: `/memecoin <name> <symbol> <description>`\nExample: `/memecoin PenguMemory PMEM A memecoin for AI agents`",
      { parse_mode: "Markdown" }
    );
  }

  if (symbol.length > 10) {
    return bot.sendMessage(chatId, "❌ Symbol must be 10 characters or fewer.", { parse_mode: "Markdown" });
  }

  if (processing.has(chatId)) {
    return bot.sendMessage(chatId, "⏳ Still processing a previous request, please wait...");
  }

  processing.add(chatId);
  let statusMsg;

  try {
    statusMsg = await bot.sendMessage(chatId,
      `🪙 Generating *${name}* (${symbol.toUpperCase()}) concept with Claude...`,
      { parse_mode: "Markdown" }
    );

    // 1. Read vault memories for context
    const vaultPda   = deriveVaultPda();
    const vault       = await ensureVault(vaultPda);
    const chainRecords = await readVaultMemories(vaultPda, vault.recordCount);

    let memCtx = "";
    if (chainRecords.length > 0) {
      memCtx = `\n\nVault context (${chainRecords.length} memories, avg importance: ` +
        `${Math.round(chainRecords.reduce((s,r) => s + r.importance, 0) / chainRecords.length)} bps)`;
    }

    // 2. Claude generates the meme coin concept
    const claudeRes = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 400,
      system:     "You are a creative crypto meme coin writer. Be fun, punchy, and internet-native. Keep it short.",
      messages:   [{
        role:    "user",
        content: `Create a meme coin concept for:\nName: ${name}\nSymbol: ${symbol.toUpperCase()}\nIdea: ${userDesc}${memCtx}\n\n` +
                 `Respond with:\nTAGLINE: <one punchy line>\nDESCRIPTION: <2 sentence fun description>\nVIBE: <3 emojis that represent this coin>`,
      }],
    });

    const claudeText  = claudeRes.content[0].text.trim();
    const taglineM    = claudeText.match(/TAGLINE:\s*(.+)/i);
    const descM       = claudeText.match(/DESCRIPTION:\s*([\s\S]+?)(?:\nVIBE:|$)/i);
    const vibeM       = claudeText.match(/VIBE:\s*(.+)/i);

    const tagline     = taglineM  ? taglineM[1].trim()  : name;
    const aiDesc      = descM     ? descM[1].trim()     : userDesc;
    const vibe        = vibeM     ? vibeM[1].trim()     : "🚀💎🌕";

    // 3. Try Pump.fun; fall back to simulation
    await bot.editMessageText(
      `${vibe} <b>${name}</b> concept ready! Launching on Pump.fun...`,
      { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "HTML" }
    );

    let pumpResult;
    let launchMode = "live";
    try {
      pumpResult = await pumpFunCreate({
        name,
        symbol:      symbol.toUpperCase(),
        description: aiDesc,
        telegram:    "https://t.me/cognchain",
        website:     "https://cognchain.xyz",
      });
    } catch (pumpErr) {
      console.warn(`[MEMECOIN] Pump.fun unavailable (${pumpErr.message}), simulating`);
      pumpResult = simulatePumpFun(name, symbol);
      launchMode = "simulated";
    }

    // 4. Write creation as memory to vault
    const memText   = `Meme coin created: ${name} (${symbol.toUpperCase()}) — "${tagline}". Mint: ${pumpResult.mintAddress}. ${launchMode === "live" ? "TX: " + pumpResult.tx : "Simulated launch."}`;
    const extracted = extractMemory(memText);
    const { score, approved } = scoreMemory(extracted);
    let memTxInfo = null;
    if (approved) {
      const freshVault = await program.account.vault.fetch(vaultPda);
      memTxInfo = await writeMemoryOnChain(vaultPda, freshVault.recordCount, extracted, score, memText);
    }

    // 5. Build reply (HTML to avoid MarkdownV2 escaping issues)
    const pumpLink    = `https://pump.fun/coin/${pumpResult.mintAddress}`;
    const solscanLink = `https://solscan.io/token/${pumpResult.mintAddress}`;

    let reply = `${vibe} <b>${name}</b> (${symbol.toUpperCase()})\n\n`;
    reply += `<i>"${tagline}"</i>\n\n`;
    reply += `${aiDesc}\n\n`;
    reply += `━━━━━━━━━━━━━━━━━━━━\n`;
    reply += `📋 <b>Mint Address</b>\n<code>${pumpResult.mintAddress}</code>\n\n`;

    if (launchMode === "live" && pumpResult.tx) {
      reply += `✅ <b>Live on Pump.fun (mainnet)</b>\n`;
      reply += `🔗 <a href="${pumpLink}">View on Pump.fun</a>\n`;
      reply += `📝 TX: <code>${pumpResult.tx}</code>\n`;
      reply += `🔗 <a href="https://explorer.solana.com/tx/${pumpResult.tx}">Explorer</a>\n\n`;
    } else {
      reply += `🧪 <b>Simulated</b> (Pump.fun mainnet only)\n`;
      reply += `🔗 <a href="${pumpLink}">Would appear here</a>\n`;
      reply += `🔍 <a href="${solscanLink}">Solscan preview</a>\n\n`;
    }

    if (memTxInfo) {
      reply += `━━━━━━━━━━━━━━━━━━━━\n`;
      reply += `🧠 Creation saved to vault (${memTxInfo.importance} bps)\n`;
      reply += `<a href="https://explorer.solana.com/tx/${memTxInfo.tx}?cluster=devnet">Memory TX</a>`;
    }

    await bot.editMessageText(reply, {
      chat_id:                  chatId,
      message_id:               statusMsg.message_id,
      parse_mode:               "HTML",
      disable_web_page_preview: true,
    });

    console.log(`[MEMECOIN] chat=${chatId} name=${name} symbol=${symbol} mode=${launchMode} mint=${pumpResult.mintAddress}`);
  } catch (err) {
    console.error(`[MEMECOIN ERROR] chat=${chatId}:`, err.message);
    const errText = `❌ Memecoin failed: ${err.message}`;
    if (statusMsg) {
      await bot.editMessageText(errText, { chat_id: chatId, message_id: statusMsg.message_id }).catch(() => {});
    } else {
      await bot.sendMessage(chatId, errText).catch(() => {});
    }
  } finally {
    processing.delete(chatId);
  }
});

bot.onText(/^\/check (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const rawAddress = match[1].trim();

  let targetPubkey;
  try {
    targetPubkey = new PublicKey(rawAddress);
  } catch {
    return bot.sendMessage(chatId, "❌ Invalid Solana address.", { parse_mode: "Markdown" });
  }

  let statusMsg;
  try {
    statusMsg = await bot.sendMessage(chatId, `🔍 Analyzing \`${rawAddress.slice(0, 8)}...\` on Solana devnet...`, { parse_mode: "Markdown" });

    // 1. Fetch account info + recent signatures in parallel
    const [accountInfo, signatures] = await Promise.all([
      connection.getAccountInfo(targetPubkey),
      connection.getSignaturesForAddress(targetPubkey, { limit: 5 }),
    ]);

    // 2. Classify account type
    let accountType = "Unknown / Not found";
    if (accountInfo) {
      if (accountInfo.executable) {
        accountType = "Program (executable)";
      } else if (
        accountInfo.owner.toBase58() === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" &&
        accountInfo.data.length === 82
      ) {
        accountType = "Token Mint";
      } else if (
        accountInfo.owner.toBase58() === "11111111111111111111111111111111"
      ) {
        accountType = "System Account (wallet)";
      } else {
        accountType = `Program-owned account (owner: ${accountInfo.owner.toBase58().slice(0, 8)}...)`;
      }
    }

    const balanceSol = accountInfo ? (accountInfo.lamports / LAMPORTS_PER_SOL).toFixed(4) : "0.0000";
    const dataSize = accountInfo ? accountInfo.data.length : 0;
    const isExecutable = accountInfo?.executable ?? false;
    const recentTxCount = signatures.length;
    const oldestTxAge = signatures.length > 0
      ? `oldest of last ${recentTxCount}: ${new Date((signatures[signatures.length - 1].blockTime ?? 0) * 1000).toISOString()}`
      : "no recent transactions";

    // 3. Read vault memories for Claude context
    const vaultPda = deriveVaultPda();
    const vault = await ensureVault(vaultPda);
    const chainRecords = await readVaultMemories(vaultPda, vault.recordCount);

    let memCtx = "";
    if (chainRecords.length > 0) {
      memCtx = `\n## Vault Memory Context (${chainRecords.length} records)\n` +
        chainRecords.map(r => `  - Record #${r.id}: importance=${r.importance} bps, ${r.createdAt}`).join("\n");
    }

    // 4. Call Claude to analyze
    const analysisPrompt = `Analyze this Solana account and assess if it looks safe or suspicious.

## Account Data
- Address: ${rawAddress}
- Type: ${accountType}
- Balance: ${balanceSol} SOL
- Executable: ${isExecutable}
- Data size: ${dataSize} bytes
- Recent transactions (last 5): ${recentTxCount} found
- ${oldestTxAge}
- Recent TX signatures: ${signatures.map(s => s.signature.slice(0, 16) + "...").join(", ") || "none"}

## Task
1. Assess whether this account looks safe, suspicious, or neutral.
2. Give a risk score from 1 (very safe) to 10 (very suspicious).
3. Explain your reasoning briefly (2–3 sentences).
4. Format your response exactly as:
RISK: <number 1-10>
ANALYSIS: <your analysis>
${memCtx}`;

    const claudeMsg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: "You are a Solana blockchain security analyst. Be precise and concise.",
      messages: [{ role: "user", content: analysisPrompt }],
    });
    const claudeText = claudeMsg.content[0].text.trim();

    // Parse risk score and analysis from Claude's response
    const riskMatch = claudeText.match(/RISK:\s*(\d+)/i);
    const analysisMatch = claudeText.match(/ANALYSIS:\s*([\s\S]+)/i);
    const riskScore = riskMatch ? parseInt(riskMatch[1], 10) : "?";
    const analysis = analysisMatch ? analysisMatch[1].trim() : claudeText;

    const riskEmoji = typeof riskScore === "number"
      ? riskScore <= 3 ? "🟢" : riskScore <= 6 ? "🟡" : "🔴"
      : "⚪";

    // 5. Write analysis as memory to vault
    const memText = `Security check for ${rawAddress}: type=${accountType}, risk=${riskScore}/10. ${analysis}`;
    const extracted = extractMemory(memText);
    const { score, approved } = scoreMemory(extracted);
    let memTxInfo = null;
    if (approved) {
      const freshVault = await program.account.vault.fetch(vaultPda);
      memTxInfo = await writeMemoryOnChain(vaultPda, freshVault.recordCount, extracted, score, memText);
    }

    // 6. Build reply
    let reply = `🔍 *Account Analysis*\n\n`;
    reply += `📬 Address: \`${rawAddress}\`\n`;
    reply += `🏷 Type: ${accountType}\n`;
    reply += `💰 Balance: \`${balanceSol} SOL\`\n`;
    reply += `⚙️ Executable: ${isExecutable ? "Yes" : "No"}\n`;
    reply += `📦 Data size: ${dataSize} bytes\n`;
    reply += `📜 Recent TXs: ${recentTxCount} (last 5 checked)\n`;
    reply += `🔗 [View on Explorer](https://explorer.solana.com/address/${rawAddress}?cluster=devnet)\n\n`;
    reply += `━━━━━━━━━━━━━━━━━━━━\n`;
    reply += `${riskEmoji} *Risk Score: ${riskScore}/10*\n\n`;
    reply += `🧠 *Claude's Analysis:*\n${analysis}\n\n`;

    if (memTxInfo) {
      reply += `━━━━━━━━━━━━━━━━━━━━\n`;
      reply += `💾 Analysis saved to vault (${memTxInfo.importance} bps)\n`;
      reply += `\`${memTxInfo.tx}\`\n`;
      reply += `[Memory TX on Explorer](https://explorer.solana.com/tx/${memTxInfo.tx}?cluster=devnet)`;
    }

    await bot.editMessageText(reply, {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });

    console.log(`[CHECK] chat=${chatId} address=${rawAddress} risk=${riskScore} stored=${!!memTxInfo}`);
  } catch (err) {
    console.error(`[CHECK ERROR] chat=${chatId}:`, err.message);
    const errText = `❌ Check failed: ${err.message}`;
    if (statusMsg) {
      await bot.editMessageText(errText, { chat_id: chatId, message_id: statusMsg.message_id }).catch(() => {});
    } else {
      await bot.sendMessage(chatId, errText).catch(() => {});
    }
  }
});

// ── /memoria ──────────────────────────────────────────────────────────────────
const memoriaProofCache = new Map();

function classifyImportance(importance) {
  if (importance > 7000) return { label: "Decisão",        emoji: "⚡" };
  if (importance >= 5000) return { label: "Comportamento", emoji: "📊" };
  return                         { label: "Observação",    emoji: "💡" };
}

// Truncate long text to a single readable sentence for the timeline
function toOneLiner(text) {
  const sentence = text.split(/[.\n]/)[0].trim();
  return sentence.length > 120 ? sentence.slice(0, 117) + "..." : sentence;
}

bot.onText(/^\/memoria$/, async (msg) => {
  const chatId = msg.chat.id;

  const log = readMemoryLog();

  if (log.length === 0) {
    return bot.sendMessage(
      chatId,
      "🧠 Nenhuma memória registrada ainda.\n\nConverse comigo, use /send, /agentpay ou /check para começar a construir seu histórico.",
      { parse_mode: "Markdown" }
    );
  }

  const classified = log.map(entry => ({
    ...entry,
    ...classifyImportance(entry.importance),
    oneLiner: toOneLiner(entry.text),
  }));

  const oldest = classified[0]?.timestamp?.slice(0, 10).split("-").reverse().join("/") ?? "—";

  let text = `🧠 *O que eu sei sobre você*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;

  for (const r of classified) {
    text += `${r.emoji} *${r.label}*\n`;
    text += `_'${r.oneLiner}'_\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `🧠 ${log.length} aprendizado${log.length !== 1 ? "s" : ""} registrado${log.length !== 1 ? "s" : ""}\n`;
  text += `📅 Desde: ${oldest}`;

  // Cache for proof callback
  memoriaProofCache.set(String(chatId), classified);

  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[
        { text: "🔍 Ver prova completa", callback_data: `proof_${chatId}` }
      ]]
    },
  });
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data   = query.data ?? "";

  if (!data.startsWith("proof_")) return bot.answerCallbackQuery(query.id);

  const records = memoriaProofCache.get(String(chatId));
  if (!records || records.length === 0) {
    return bot.answerCallbackQuery(query.id, { text: "Cache expirado. Use /memoria novamente." });
  }

  const vaultPda = deriveVaultPda();

  let proof = `🔐 *Prova On-Chain — Solana Devnet*\n`;
  proof += `📦 Vault: \`${vaultPda.toBase58()}\`\n`;
  proof += `━━━━━━━━━━━━━━━━━━━━\n`;

  for (const r of records) {
    proof += `\n${r.emoji} *Record #${r.recordId}* — ${r.label} (${r.importance} bps)\n`;
    proof += `🕐 ${r.timestamp?.slice(0, 19).replace("T", " ")}\n`;
    proof += `📝 TX: \`${r.tx}\`\n`;
    proof += `🔗 [Ver TX](https://explorer.solana.com/tx/${r.tx}?cluster=devnet)\n`;
  }

  proof += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  proof += `🔒 Conteúdo armazenado apenas como hash SHA-256 on-chain.\nTexto original salvo localmente em memory-log.json.`;

  await bot.answerCallbackQuery(query.id);
  await bot.sendMessage(chatId, proof, {
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  });
});

bot.onText(/^\/balance$/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const vaultPda = deriveVaultPda();
    const [balance, vault] = await Promise.all([
      connection.getBalance(keypair.publicKey),
      ensureVault(vaultPda),
    ]);

    const reply =
      `💼 *Wallet Balance*\n\n` +
      `📬 Address: \`${keypair.publicKey.toBase58()}\`\n` +
      `💰 Balance: \`${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\`\n\n` +
      `📦 *Vault*\n` +
      `🗂 Memories: \`${vault.recordCount}\` on-chain record(s)\n` +
      `🔑 Vault PDA: \`${vaultPda.toBase58()}\`\n` +
      `🔗 [View on Explorer](https://explorer.solana.com/address/${vaultPda.toBase58()}?cluster=devnet)`;

    await bot.sendMessage(chatId, reply, { parse_mode: "Markdown", disable_web_page_preview: true });
  } catch (err) {
    await bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

bot.onText(/^\/send (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].trim().split(/\s+/);

  if (args.length !== 2) {
    return bot.sendMessage(chatId, "⚠️ Usage: `/send <amount_sol> <destination_address>`", { parse_mode: "Markdown" });
  }

  const amountSol = parseFloat(args[0]);
  const destination = args[1];

  if (isNaN(amountSol) || amountSol <= 0) {
    return bot.sendMessage(chatId, "❌ Invalid amount. Example: `/send 0.01 <address>`", { parse_mode: "Markdown" });
  }

  let isValidAddress = false;
  try { new PublicKey(destination); isValidAddress = true; } catch {}
  if (!isValidAddress) {
    return bot.sendMessage(chatId, "❌ Invalid Solana address.", { parse_mode: "Markdown" });
  }

  if (processing.has(chatId)) {
    return bot.sendMessage(chatId, "⏳ Still processing a previous request, please wait...");
  }

  processing.add(chatId);
  let statusMsg;

  try {
    statusMsg = await bot.sendMessage(chatId, `🛡️ Running security checks...`, { parse_mode: "Markdown" });

    const guard = await securityGuard(`/send ${amountSol} ${destination}`, amountSol, destination);
    if (!guard.allowed) {
      return bot.editMessageText(`🚫 *Transfer blocked*\n\n${guard.reason}`, {
        chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown",
      });
    }

    await bot.editMessageText(`💸 Sending ${amountSol} SOL to \`${destination}\`...`, {
      chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown",
    });

    const balance = await connection.getBalance(keypair.publicKey);
    if (balance < amountSol * LAMPORTS_PER_SOL + 5000) {
      throw new Error(`Insufficient balance (${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL)`);
    }

    const { sig, lamports, score, approved, memTxInfo } = await sendSolAndRecord(amountSol, destination);
    recordSpend(amountSol);

    let reply = `✅ *Transfer complete!*\n\n`;
    reply += `💰 Sent: \`${amountSol} SOL\` (${lamports.toLocaleString()} lamports)\n`;
    reply += `📬 To: \`${destination}\`\n`;
    reply += `📝 TX: \`${sig}\`\n`;
    reply += `🔗 [View on Explorer](https://explorer.solana.com/tx/${sig}?cluster=devnet)\n\n`;

    if (approved && memTxInfo) {
      reply += `🧠 *Memory written to vault!*\n`;
      reply += `📝 Memory TX: \`${memTxInfo.tx}\`\n`;
      reply += `📊 Importance: ${memTxInfo.importance} bps`;
    } else {
      reply += `📊 Memory score: ${score} bps _(below threshold, not stored)_`;
    }

    await bot.editMessageText(reply, {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });

    console.log(`[SEND] chat=${chatId} amount=${amountSol} SOL to=${destination} sig=${sig}`);
  } catch (err) {
    console.error(`[SEND ERROR] chat=${chatId}:`, err.message);
    const errText = `❌ Transfer failed: ${err.message}`;
    if (statusMsg) {
      await bot.editMessageText(errText, { chat_id: chatId, message_id: statusMsg.message_id }).catch(() => {});
    } else {
      await bot.sendMessage(chatId, errText).catch(() => {});
    }
  } finally {
    processing.delete(chatId);
  }
});

bot.onText(/^\/pause$/, async (msg) => {
  const chatId = msg.chat.id;
  if (security.paused) {
    return bot.sendMessage(chatId, "⚠️ Bot is already paused.", { parse_mode: "Markdown" });
  }
  security.paused = true;
  await writeSecurityMemory("PAUSED: operator paused all financial commands via /pause.");
  await bot.sendMessage(chatId,
    `⏸️ *Bot paused.*\nAll financial commands (/send, /agentpay, /swap) are now blocked.\nUse /resume to re-enable.`,
    { parse_mode: "Markdown" }
  );
  console.log("[SECURITY] Bot paused by chat", chatId);
});

bot.onText(/^\/resume$/, async (msg) => {
  const chatId = msg.chat.id;
  if (!security.paused) {
    return bot.sendMessage(chatId, "✅ Bot is already running.", { parse_mode: "Markdown" });
  }
  security.paused = false;
  await writeSecurityMemory("RESUMED: operator resumed financial commands via /resume.");
  await bot.sendMessage(chatId,
    `▶️ *Bot resumed.*\nFinancial commands are now re-enabled.`,
    { parse_mode: "Markdown" }
  );
  console.log("[SECURITY] Bot resumed by chat", chatId);
});

bot.onText(/^\/limits$/, async (msg) => {
  const chatId = msg.chat.id;
  resetDailyIfNeeded();
  const remaining = Math.max(0, MAX_DAILY_SOL - security.dailySpent).toFixed(4);
  const reply =
    `🛡️ *Security Limits*\n\n` +
    `⚙️ Max per transaction: \`${MAX_TX_SOL} SOL\`\n` +
    `📅 Max per day: \`${MAX_DAILY_SOL} SOL\`\n\n` +
    `📊 *Today (${security.dayKey})*\n` +
    `💸 Spent: \`${security.dailySpent.toFixed(4)} SOL\`\n` +
    `✅ Remaining: \`${remaining} SOL\`\n\n` +
    `${security.paused ? "⏸️ *Status: PAUSED* — use /resume to re-enable" : "▶️ *Status: ACTIVE*"}`;
  await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userMessage = msg.text;

  if (!userMessage || userMessage.startsWith("/")) return;
  if (processing.has(chatId)) {
    await bot.sendMessage(chatId, "⏳ Still processing your previous message, please wait...");
    return;
  }

  processing.add(chatId);
  let statusMsg;

  try {
    statusMsg = await bot.sendMessage(chatId, "🧠 Reading Solana memories and thinking...");

    const result = await processMessage(userMessage);
    const reply = formatReply(result);

    await bot.editMessageText(reply, {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });

    console.log(`[${new Date().toISOString()}] chat=${chatId} score=${result.score} stored=${result.approved}`);
  } catch (err) {
    console.error(`[ERROR] chat=${chatId}:`, err.message);
    const errText = `❌ Error: ${err.message}`;
    if (statusMsg) {
      await bot.editMessageText(errText, { chat_id: chatId, message_id: statusMsg.message_id }).catch(() => {});
    } else {
      await bot.sendMessage(chatId, errText).catch(() => {});
    }
  } finally {
    processing.delete(chatId);
  }
});

bot.on("polling_error", (err) => console.error("[POLLING ERROR]", err.message));

// ── Start ─────────────────────────────────────────────────────────────────────
(async () => {
  const info = await bot.getMe();
  const balance = await connection.getBalance(keypair.publicKey);
  const vaultPda = deriveVaultPda();
  await ensureVault(vaultPda);
  const vault = await program.account.vault.fetch(vaultPda);

  console.log("═".repeat(55));
  console.log("  🤖 CognChain Telegram Bot started");
  console.log("═".repeat(55));
  console.log(`  Bot username : @${info.username}`);
  console.log(`  AgentA       : ${keypair.publicKey.toBase58()}`);
  console.log(`  AgentB       : ${agentBKeypair.publicKey.toBase58()}`);
  console.log(`  Balance      : ${(balance / 1e9).toFixed(4)} SOL`);
  console.log(`  Vault PDA    : ${vaultPda.toBase58()}`);
  console.log(`  Records      : ${vault.recordCount} on-chain`);
  console.log(`  Claude model : ${MODEL}`);
  console.log("═".repeat(55));
  console.log("  Listening for messages...");
})().catch(err => { console.error("❌ Startup error:", err.message); process.exit(1); });
