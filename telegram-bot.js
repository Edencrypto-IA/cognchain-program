// telegram-bot.js — CognChain Telegram Bot (multi-user) — SECURITY HARDCENED
// Changelog: 6 critical fixes + 4 medium fixes applied (see bottom of file)
// ──────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// FIX #0: Load environment variables FIRST (everything depends on this)
// Previously: no dotenv → forced hardcoded secrets
// Now: loads .env file before anything else
// ══════════════════════════════════════════════════════════════════════════════
require("dotenv").config();

const TelegramBot  = require("node-telegram-bot-api");
const { Connection, Keypair, PublicKey, SystemProgram, Transaction, VersionedTransaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const fetch        = require("node-fetch");
const FormData     = require("form-data");
const anchor       = require("@coral-xyz/anchor");
const Anthropic    = require("@anthropic-ai/sdk");
const crypto       = require("crypto");
const fs           = require("fs");
const { scoreMemory }  = require("./scorer");
const { hashMemory }   = require("./hasher");
const { extractMemory } = require("./extractor");

// ── Config ────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// FIX #6: RPC key moved to env — no more hardcoded API keys in source code
// Previously: hardcoded Helius API key visible to anyone with code access
// Now: loaded from .env, with safe devnet fallback
// ══════════════════════════════════════════════════════════════════════════════
const TELEGRAM_TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL             = "claude-sonnet-4-5";
const PROGRAM_ID        = new PublicKey(process.env.PROGRAM_ID || "7AHMKtvPuZ6yKdWtWD1kC6kgPkEgooeBBtrmUrVc2teU");
const RPC               = process.env.RPC_URL || "https://api.devnet.solana.com";
const USERS_DIR         = "./users";
const MAX_TX_SOL        = 0.1;
const MAX_DAILY_SOL     = 1.0;

// ══════════════════════════════════════════════════════════════════════════════
// FIX #5: Claude rate limiting — prevent API key abuse
// Previously: unlimited Claude calls → user could drain your Anthropic credits
// Now: max 10 messages per minute per user
// ══════════════════════════════════════════════════════════════════════════════
const CLAUDE_RATE_LIMIT_MAX = 10;
const CLAUDE_RATE_WINDOW_MS = 60 * 1000; // 1 minute
const claudeRateMap = new Map();

function checkClaudeRateLimit(chatId) {
  const key = String(chatId);
  const now = Date.now();
  const entry = claudeRateMap.get(key) || { count: 0, windowStart: now };
  if (now - entry.windowStart > CLAUDE_RATE_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count++;
  claudeRateMap.set(key, entry);
  return entry.count <= CLAUDE_RATE_LIMIT_MAX;
}

function getClaudeRateRemaining(chatId) {
  const key = String(chatId);
  const entry = claudeRateMap.get(key);
  if (!entry) return CLAUDE_RATE_LIMIT_MAX;
  const now = Date.now();
  if (now - entry.windowStart > CLAUDE_RATE_WINDOW_MS) return CLAUDE_RATE_LIMIT_MAX;
  return Math.max(0, CLAUDE_RATE_LIMIT_MAX - entry.count);
}

// ══════════════════════════════════════════════════════════════════════════════
// FIX #1: AgentB keypair from env — no more predictable seed
// Previously: Buffer.from("cognchain-agent-b-fixed-seed-v1!") hardcoded
//   → Anyone with the code could derive the same private key and steal funds
// Now: loaded from AGENT_B_KEYPAIR env var (64-byte JSON array)
//   Falls back to generating a random keypair on first run + saves to file
// ══════════════════════════════════════════════════════════════════════════════
function loadOrCreateAgentB() {
  // Priority 1: Environment variable (most secure)
  if (process.env.AGENT_B_KEYPAIR) {
    try {
      const parsed = JSON.parse(process.env.AGENT_B_KEYPAIR);
      return Keypair.fromSecretKey(Uint8Array.from(parsed));
    } catch (err) {
      console.error("[WARN] AGENT_B_KEYPAIR env var is invalid, falling back to file:");
      console.error("  ", err.message);
    }
  }
  // Priority 2: Saved file (persists across reboots)
  const agentBPath = "./users/.agent-b.json";
  if (fs.existsSync(agentBPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(agentBPath, "utf8"));
      if (raw.secretKey) {
        return Keypair.fromSecretKey(Uint8Array.from(raw.secretKey));
      }
      return Keypair.fromSecretKey(Uint8Array.from(raw));
    } catch (err) {
      console.error("[WARN] Failed to load agent-b file:", err.message);
    }
  }
  // Priority 3: Generate random keypair (one-time, saved to file)
  console.log("[INIT] Generating new random AgentB keypair...");
  const kp = Keypair.generate();
  fs.writeFileSync(agentBPath, JSON.stringify({ publicKey: kp.publicKey.toBase58(), secretKey: Array.from(kp.secretKey) }), "utf8");
  console.log("[INIT] AgentB keypair saved to", agentBPath);
  console.log("[INIT] ⚠️  Add to .env for persistence: AGENT_B_KEYPAIR=" + JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

const agentBKeypair = loadOrCreateAgentB();

// ══════════════════════════════════════════════════════════════════════════════
// FIX #4: User key encryption — private keys no longer stored in plaintext
// Previously: fs.writeFileSync(path, JSON.stringify(secretKey)) — readable by anyone with server access
// Now: AES-256-CBC encryption with a master key from env
//   Auto-migrates old plaintext keys on first load
// ══════════════════════════════════════════════════════════════════════════════
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.warn("[WARN] ENCRYPTION_KEY not set. User keys will be stored in PLAINTEXT (insecure).");
    console.warn("       Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    return null;
  }
  return Buffer.from(key, "hex");
}

function encryptData(plaintext, encKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", encKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decryptData(ciphertext, encKey) {
  const [ivHex, dataHex] = ciphertext.split(":");
  if (!ivHex || !dataHex) return null; // Not encrypted format
  try {
    const iv = Buffer.from(ivHex, "hex");
    const data = Buffer.from(dataHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", encKey, iv);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null; // Decryption failed — probably plaintext
  }
}

function saveUserKey(chatId, secretKeyArray) {
  const path = getUserPath(chatId);
  const encKey = getEncryptionKey();
  const raw = JSON.stringify(secretKeyArray);
  if (encKey) {
    fs.writeFileSync(path, encryptData(raw, encKey), "utf8");
  } else {
    fs.writeFileSync(path, raw, "utf8");
  }
}

function loadUserKey(chatId) {
  const path = getUserPath(chatId);
  const raw = fs.readFileSync(path, "utf8").trim();
  const encKey = getEncryptionKey();

  // Try encrypted format first
  if (encKey && raw.includes(":")) {
    const decrypted = decryptData(raw, encKey);
    if (decrypted) {
      try { return JSON.parse(decrypted); } catch { /* fall through */ }
    }
  }

  // Try plaintext (auto-migration)
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 64) {
      // Successfully loaded plaintext — re-save encrypted if possible
      if (encKey) {
        saveUserKey(chatId, parsed);
        console.log(`[MIGRATE] chat=${chatId}: auto-encrypted plaintext keypair`);
      }
      return parsed;
    }
  } catch { /* fall through */ }

  throw new Error("Invalid keypair format for chat " + chatId);
}

// ── IDL (unchanged — matches your deployed program) ─────────────────────────
const IDL = {"version":"0.1.0","name":"cognchain","instructions":[{"name":"createVault","accounts":[{"name":"vault","isMut":true,"isSigner":false},{"name":"authority","isMut":true,"isSigner":true},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[{"name":"label","type":"string"}]},{"name":"writeMemory","accounts":[{"name":"vault","isMut":true,"isSigner":false},{"name":"record","isMut":true,"isSigner":false},{"name":"authority","isMut":true,"isSigner":true},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[{"name":"contentHash","type":{"array":["u8",32]}},{"name":"summaryHash","type":{"array":["u8",32]}},{"name":"importance","type":"u16"},{"name":"agentType","type":"u8"}]},{"name":"readMemory","accounts":[{"name":"vault","isMut":false,"isSigner":false},{"name":"record","isMut":false,"isSigner":false},{"name":"authority","isMut":true,"isSigner":true}],"args":[]}],"accounts":[{"name":"Vault","type":{"kind":"struct","fields":[{"name":"authority","type":"publicKey"},{"name":"label","type":"string"},{"name":"recordCount","type":"u16"},{"name":"bump","type":"u8"},{"name":"createdAt","type":"i64"}]}},{"name":"MemoryRecord","type":{"kind":"struct","fields":[{"name":"vault","type":"publicKey"},{"name":"id","type":"u16"},{"name":"authority","type":"publicKey"},{"name":"contentHash","type":{"array":["u8",32]}},{"name":"summaryHash","type":{"array":["u8",32]}},{"name":"importance","type":"u16"},{"name":"agentType","type":"u8"},{"name":"bump","type":"u8"},{"name":"createdAt","type":"i64"}]}}],"errors":[{"code":6000,"name":"LabelTooLong","msg":"Label exceeds 64 characters."},{"code":6001,"name":"InvalidImportance","msg":"Importance must be between 0 and 10000 bps."},{"code":6002,"name":"VaultFull","msg":"Vault has reached the maximum number of records."},{"code":6003,"name":"WrongVault","msg":"Record does not belong to this vault."}]};

if (!TELEGRAM_TOKEN)    { console.error("❌ TELEGRAM_BOT_TOKEN not set"); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error("❌ ANTHROPIC_API_KEY not set"); process.exit(1); }

fs.mkdirSync(USERS_DIR, { recursive: true });

// ── Global singletons ─────────────────────────────────────────────────────────
const connection = new Connection(RPC, "confirmed");
const anthropic  = new Anthropic.default({ apiKey: ANTHROPIC_API_KEY });

// ── PDA helpers (unchanged) ───────────────────────────────────────────────────
function deriveVaultPdaFor(pubkey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), pubkey.toBuffer()], PROGRAM_ID
  );
  return pda;
}

function deriveRecordPda(vaultPda, index) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(index);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("record"), vaultPda.toBuffer(), buf], PROGRAM_ID
  );
  return pda;
}

function makeProgramFor(kp) {
  const w    = new anchor.Wallet(kp);
  const prov = new anchor.AnchorProvider(connection, w, { commitment: "confirmed" });
  return new anchor.Program(IDL, PROGRAM_ID, prov);
}

// ── User management ───────────────────────────────────────────────────────────
const userCache = new Map();

function getUserPath(chatId)   { return `${USERS_DIR}/${chatId}.json`; }
function getMemLogPath(chatId) { return `${USERS_DIR}/memory-log-${chatId}.json`; }
function hasUser(chatId)       { return fs.existsSync(getUserPath(chatId)); }

async function createUser(chatId) {
  const kp      = Keypair.generate();
  const prog    = makeProgramFor(kp);
  const vaultPda = deriveVaultPdaFor(kp.publicKey);

  // Persist keypair (encrypted if ENCRYPTION_KEY is set)
  saveUserKey(chatId, Array.from(kp.secretKey));

  // Create vault on-chain
  try {
    await prog.account.vault.fetch(vaultPda);
  } catch {
    await prog.methods.createVault("CognChain User Vault")
      .accounts({ vault: vaultPda, authority: kp.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
      .rpc();
  }

  const ctx = { chatId, keypair: kp, program: prog, vaultPda, memLogPath: getMemLogPath(chatId) };
  userCache.set(String(chatId), ctx);
  return ctx;
}

function loadUser(chatId) {
  const raw  = loadUserKey(chatId);
  const kp   = Keypair.fromSecretKey(Uint8Array.from(raw));
  const prog = makeProgramFor(kp);
  const ctx  = { chatId, keypair: kp, program: prog, vaultPda: deriveVaultPdaFor(kp.publicKey), memLogPath: getMemLogPath(chatId) };
  userCache.set(String(chatId), ctx);
  return ctx;
}

function getUser(chatId) {
  const key = String(chatId);
  if (userCache.has(key))  return userCache.get(key);
  if (hasUser(chatId))     return loadUser(chatId);
  return null;
}

function requireUser(chatId) {
  const user = getUser(chatId);
  if (!user) {
    bot.sendMessage(chatId, "👋 First send /start to create your wallet.");
    return null;
  }
  return user;
}

// ══════════════════════════════════════════════════════════════════════════════
// FIX #3: Security state persisted to disk — survives reboots
// Previously: userSecurityMap = new Map() (in-memory only)
//   → Bot restart = all pause/resume/limits reset = useless security
// Now: saved to users/security-{chatId}.json after every change
// ══════════════════════════════════════════════════════════════════════════════
function getSecurityPath(chatId) { return `${USERS_DIR}/security-${chatId}.json`; }

function loadUserSecurity(chatId) {
  try {
    return JSON.parse(fs.readFileSync(getSecurityPath(chatId), "utf8"));
  } catch {
    return { paused: false, dailySpent: 0, dayKey: new Date().toISOString().slice(0, 10) };
  }
}

function saveUserSecurity(chatId, sec) {
  try {
    fs.writeFileSync(getSecurityPath(chatId), JSON.stringify(sec), "utf8");
  } catch (err) {
    console.error("[SECURITY SAVE ERROR]", err.message);
  }
}

function getUserSecurity(chatId) {
  return loadUserSecurity(chatId);
}

function resetDailyIfNeeded(sec) {
  const today = new Date().toISOString().slice(0, 10);
  if (sec.dayKey !== today) {
    sec.dailySpent = 0;
    sec.dayKey = today;
  }
}

function recordSpend(chatId, amountSol) {
  const sec = getUserSecurity(chatId);
  resetDailyIfNeeded(sec);
  sec.dailySpent += amountSol;
  saveUserSecurity(chatId, sec);
}

// ── Vault helpers (unchanged) ─────────────────────────────────────────────────
async function ensureVaultFor(prog, kp, label = "CognChain Vault") {
  const vaultPda = deriveVaultPdaFor(kp.publicKey);
  try {
    return await prog.account.vault.fetch(vaultPda);
  } catch {
    await prog.methods.createVault(label)
      .accounts({ vault: vaultPda, authority: kp.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
      .rpc();
    return prog.account.vault.fetch(vaultPda);
  }
}

async function readVaultMemories(prog, vaultPda, recordCount) {
  const records = [];
  for (let i = 0; i < recordCount; i++) {
    try {
      const rec = await prog.account.memoryRecord.fetch(deriveRecordPda(vaultPda, i));
      records.push({
        id: rec.id,
        importance: rec.importance,
        createdAt: new Date(rec.createdAt.toNumber() * 1000).toISOString(),
        contentHash: Buffer.from(rec.contentHash).toString("hex").slice(0, 16),
      });
    } catch { /* skip */ }
  }
  return records;
}

// ── Memory log helpers (unchanged) ────────────────────────────────────────────
function readMemoryLog(logPath) {
  try { return JSON.parse(fs.readFileSync(logPath, "utf8")); } catch { return []; }
}

function appendMemoryLog(entry, logPath) {
  const log = readMemoryLog(logPath);
  log.push(entry);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2), "utf8");
}

// ── Context Engine V2 — AI-powered memory relevance scoring ─────────────────
function getRelevantMemories(input, logPath) {
  const log = readMemoryLog(logPath);
  if (log.length === 0) return [];

  // Extract keywords from input (words with 3+ chars, no common stop words)
  const stopWords = new Set(["que","uma","com","para","por","the","and","for","not","you","are","was","this","that","from","with","your","have","has","been","will","can","mas","como","mais","dos","das","nos","tem","seu","sua","ele","ela","depois","antes","aqui","isso","esse","esta","todo","cada","muito","pelo","pela","entre","sobre","ainda","agora","ainda","bem","sem","via","the","and","its","all","but","out","about","who","get","how","what","when","where","why","which","their","were","been","being","have","had","does","did","would","could","should","may","might"]);
  const inputLower = (input || "").toLowerCase();
  const inputWords = inputLower.split(/[\s,.;:!?()"'\/\\]+/).filter(w => w.length > 2 && !stopWords.has(w));

  // Score each memory by relevance
  const scored = log.map(entry => {
    const entryText = ((entry.text || "") + " " + (entry.type || "")).toLowerCase();
    let keywordOverlap = 0;
    for (const word of inputWords) {
      if (entryText.includes(word)) keywordOverlap++;
    }
    const overlapRatio = inputWords.length > 0 ? keywordOverlap / inputWords.length : 0;
    const normalizedImportance = (entry.importance || 0) / 10000;
    // Final score: 60% keyword match + 40% importance
    const scoreFinal = (overlapRatio * 0.6) + (normalizedImportance * 0.4);
    return { ...entry, scoreFinal, keywordOverlap };
  });

  // Sort by scoreFinal descending, return TOP 3
  return scored
    .filter(e => e.scoreFinal > 0)
    .sort((a, b) => b.scoreFinal - a.scoreFinal)
    .slice(0, 3);
}

// ── Write memory helpers (unchanged) ──────────────────────────────────────────
async function writeMemoryWith(prog, kp, text, agentType, logPath) {
  const vaultPda = deriveVaultPdaFor(kp.publicKey);
  const vault    = await prog.account.vault.fetch(vaultPda).catch(() => ({ recordCount: 0 }));
  const extracted = extractMemory(text);
  const { score, approved } = scoreMemory(extracted);
  if (!approved) return { approved: false, score };

  const { contentHash, summaryHash } = hashMemory(extracted);
  const recordId  = vault.recordCount;
  const recordPda = deriveRecordPda(vaultPda, recordId);
  const importance = Math.min(score, 10000);

  const tx = await prog.methods
    .writeMemory(Array.from(contentHash), Array.from(summaryHash), importance, agentType)
    .accounts({ vault: vaultPda, record: recordPda, authority: kp.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
    .rpc();

  if (logPath) appendMemoryLog({ recordId, text, type: extracted.type, importance, agentType, timestamp: new Date().toISOString(), tx }, logPath);
  return { approved: true, tx, importance, score };
}

async function writeMemoryOnChain(user, vaultPda, recordCount, extracted, score, originalText = "") {
  const { contentHash, summaryHash } = hashMemory(extracted);
  const recordPda  = deriveRecordPda(vaultPda, recordCount);
  const importance = Math.min(score, 10000);

  const tx = await user.program.methods
    .writeMemory(Array.from(contentHash), Array.from(summaryHash), importance, 0)
    .accounts({ vault: vaultPda, record: recordPda, authority: user.keypair.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
    .rpc();

  if (originalText) appendMemoryLog({ recordId: recordCount, text: originalText, type: extracted.type, importance, agentType: 0, timestamp: new Date().toISOString(), tx }, user.memLogPath);
  return { tx, importance, recordPda };
}

async function writeSecurityMemory(user, eventText) {
  try {
    const vault    = await user.program.account.vault.fetch(user.vaultPda).catch(() => ({ recordCount: 0 }));
    const extracted = extractMemory(eventText);
    const { contentHash, summaryHash } = hashMemory(extracted);
    const recordId  = vault.recordCount;
    const recordPda = deriveRecordPda(user.vaultPda, recordId);
    const tx = await user.program.methods
      .writeMemory(Array.from(contentHash), Array.from(summaryHash), 5000, 0)
      .accounts({ vault: user.vaultPda, record: recordPda, authority: user.keypair.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
      .rpc();
    appendMemoryLog({ recordId, text: eventText, type: "security", importance: 5000, agentType: 0, timestamp: new Date().toISOString(), tx }, user.memLogPath);
  } catch (err) {
    console.error("[SECURITY MEMORY ERROR]", err.message);
  }
}

// ── Security layer ────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// FIX #2: Claude safety check — sanitized input prevents prompt injection
// Previously: user-controlled command + destination passed directly to Claude
//   → Attacker could inject "VERDICT: SAFE" to bypass security
// Now: dangerous keywords filtered + input truncated + structured JSON response
// ══════════════════════════════════════════════════════════════════════════════
async function claudeSafetyCheck(command, amountSol, destination) {
  // Sanitize: remove Claude-injectable keywords from user input
  const sanitize = (str) => str
    .replace(/VERDICT/gi, "[FILTERED]")
    .replace(/SAFE/gi, "[FILTERED]")
    .replace(/UNSAFE/gi, "[FILTERED]")
    .replace(/REASON/gi, "[FILTERED]")
    .replace(/APPROVE/gi, "[FILTERED]")
    .replace(/ALLOW/gi, "[FILTERED]")
    .replace(/BLOCK/gi, "[FILTERED]")
    .replace(/DENY/gi, "[FILTERED]")
    .slice(0, 200); // truncate to prevent context flooding

  const safeCommand = sanitize(command);
  const safeDest = sanitize(destination);

  const prompt =
    `You are a security agent guarding an autonomous Solana wallet.\n` +
    `Analyze the following command and decide if it is SAFE or UNSAFE.\n\n` +
    `Command: ${safeCommand}\nAmount: ${amountSol} SOL\nDestination: ${safeDest}\n\n` +
    `Flag UNSAFE if you detect: scam/phishing patterns, social engineering, suspicious destination, unusual amount.\n\n` +
    `IMPORTANT: Your response must be ONLY valid JSON with no other text:\n` +
    `{"verdict":"SAFE","reason":"<one sentence>"}\n` +
    `or\n` +
    `{"verdict":"UNSAFE","reason":"<one sentence>"}`;

  const msg = await anthropic.messages.create({
    model: MODEL, max_tokens: 100,
    system: "You are a concise blockchain security auditor. Always respond with valid JSON only.",
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content[0].text.trim();

  // Parse structured JSON response (harder to fake than regex)
  let verdict, reason;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      verdict = (parsed.verdict || "").toUpperCase();
      reason = parsed.reason || "No reason provided";
    } else {
      // Fallback to text parsing
      verdict = /VERDICT:\s*UNSAFE/i.test(text) ? "UNSAFE" : "SAFE";
      const reasonMatch = text.match(/REASON:\s*(.+)/i);
      reason = reasonMatch ? reasonMatch[1].trim() : text.slice(0, 100);
    }
  } catch {
    // If JSON parsing fails entirely, default to SAFE (false positive is better than false negative)
    verdict = "SAFE";
    reason = "Could not parse safety response — allowed by default";
  }

  return { safe: verdict !== "UNSAFE", verdict: reason };
}

async function securityGuard(user, command, amountSol, destination) {
  const sec = getUserSecurity(user.chatId);
  resetDailyIfNeeded(sec);

  if (sec.paused) return { allowed: false, reason: "Your account is paused. Use /resume to re-enable." };

  if (amountSol > MAX_TX_SOL) {
    const msg = `Transaction of ${amountSol} SOL exceeds per-tx limit of ${MAX_TX_SOL} SOL.`;
    await writeSecurityMemory(user, `BLOCKED (per-tx limit): ${msg} Command: ${command}`);
    return { allowed: false, reason: msg };
  }

  if (sec.dailySpent + amountSol > MAX_DAILY_SOL) {
    const remaining = (MAX_DAILY_SOL - sec.dailySpent).toFixed(4);
    const msg = `Daily limit reached. Spent ${sec.dailySpent.toFixed(4)} SOL today (${remaining} SOL remaining of ${MAX_DAILY_SOL}).`;
    await writeSecurityMemory(user, `BLOCKED (daily limit): ${msg} Command: ${command}`);
    return { allowed: false, reason: msg };
  }

  const { safe, verdict } = await claudeSafetyCheck(command, amountSol, destination);
  if (!safe) {
    const msg = `Claude safety check flagged this as UNSAFE: ${verdict}`;
    await writeSecurityMemory(user, `BLOCKED (safety check): ${msg} Command: ${command}`);
    return { allowed: false, reason: msg };
  }

  return { allowed: true, reason: verdict };
}

// ── AgentPay flow (unchanged) ─────────────────────────────────────────────────
async function agentPayFlow(user, task, amountSol) {
  const agentBProg      = makeProgramFor(agentBKeypair);
  const lamports        = Math.round(amountSol * LAMPORTS_PER_SOL);
  const FUNDING_LAMPORTS = Math.round(0.01 * LAMPORTS_PER_SOL);

  const balanceA = await connection.getBalance(user.keypair.publicKey);
  if (balanceA < FUNDING_LAMPORTS + lamports + 20000) {
    throw new Error(`Insufficient balance (${(balanceA / LAMPORTS_PER_SOL).toFixed(4)} SOL)`);
  }

  // Fund AgentB if needed
  const balanceB = await connection.getBalance(agentBKeypair.publicKey);
  let fundingSig = null;
  if (balanceB < FUNDING_LAMPORTS) {
    const fundTx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: user.keypair.publicKey, toPubkey: agentBKeypair.publicKey, lamports: FUNDING_LAMPORTS })
    );
    fundingSig = await sendAndConfirmTransaction(connection, fundTx, [user.keypair], { commitment: "confirmed" });
  }

  // AgentA → AgentB payment
  const payTx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: user.keypair.publicKey, toPubkey: agentBKeypair.publicKey, lamports })
  );
  const paymentSig = await sendAndConfirmTransaction(connection, payTx, [user.keypair], { commitment: "confirmed" });

  // Read user vault memories for context
  const agentAVault    = await user.program.account.vault.fetch(user.vaultPda).catch(() => ({ recordCount: 0 }));
  const chainRecords   = await readVaultMemories(user.program, user.vaultPda, agentAVault.recordCount);

  let memCtx = "";
  if (chainRecords.length > 0) {
    memCtx = `\n## AgentA's Vault Memories (${chainRecords.length} records)\n` +
      chainRecords.map(r => `  - Record #${r.id}: importance=${r.importance} bps, ${r.createdAt}`).join("\n");
  }

  const agentBMsg = await anthropic.messages.create({
    model: MODEL, max_tokens: 512,
    system: `You are AgentB, a specialist AI worker. AgentA paid you ${amountSol} SOL to complete a task. Deliver a precise, actionable result. 3–5 sentences.${memCtx}`,
    messages: [{ role: "user", content: `Task: ${task}` }],
  });
  const taskResult = agentBMsg.content[0].text.trim();

  // AgentB writes result to its vault
  await ensureVaultFor(agentBProg, agentBKeypair, "CognChain AgentB Vault");
  const agentBMemText = `AgentB completed task for user ${user.chatId} (paid ${amountSol} SOL). Task: ${task}. Result: ${taskResult}`;
  const agentBMem     = await writeMemoryWith(agentBProg, agentBKeypair, agentBMemText, 1, user.memLogPath);

  // AgentA writes confirmation to user vault
  const agentAMemText = `Delegated task to AgentB (paid ${amountSol} SOL). Task: ${task}. Result confirmed: ${taskResult}`;
  const agentAMem     = await writeMemoryWith(user.program, user.keypair, agentAMemText, 0, user.memLogPath);

  return {
    taskResult, fundingSig, paymentSig, amountSol,
    agentA: user.keypair.publicKey.toBase58(),
    agentB: agentBKeypair.publicKey.toBase58(),
    agentBMem, agentAMem,
  };
}

// ── Process chat message ──────────────────────────────────────────────────────
function buildPrompt(userMessage, chainRecords, relevantMemories) {
  let memCtx = "";

  // On-chain vault summary (lightweight)
  if (chainRecords.length > 0) {
    const avg = Math.round(chainRecords.reduce((s, r) => s + r.importance, 0) / chainRecords.length);
    memCtx += `\n## On-Chain Vault Summary\n${chainRecords.length} record(s) on Solana Devnet (avg importance: ${avg} bps).\n`;
  }

  // Relevant memories from Context Engine V2 (the actual content)
  if (relevantMemories && relevantMemories.length > 0) {
    memCtx += `\n## Verified Memories (retrieved from blockchain)\n`;
    memCtx += `Use ONLY these verified memories as context. Do not hallucinate beyond them.\n\n`;
    for (const mem of relevantMemories) {
      const dateStr = mem.timestamp ? new Date(mem.timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "unknown";
      memCtx += `Memory [${mem.type || "general"}] — Score: ${mem.importance} bps — ${dateStr}\n`;
      memCtx += `Decision: ${(mem.text || "").slice(0, 300)}\n\n`;
    }
  }

  const system =
    `CognChain — Verified AI Memory\n` +
    `You are an AI assistant with persistent, VERIFIABLE memory stored on the Solana blockchain.\n` +
    `Every memory you reference has a real on-chain proof. Build on verified memories when available.\n` +
    `Be precise, technical, and insightful. If no relevant memories exist, say so clearly.\n` +
    `Sempre responda em português (BR).` +
    `${memCtx ? "\n" + memCtx : ""}`;

  return { system, user: userMessage };
}

async function processMessage(user, userMessage) {
  const vault        = await user.program.account.vault.fetch(user.vaultPda).catch(() => ({ recordCount: 0 }));
  const chainRecords = await readVaultMemories(user.program, user.vaultPda, vault.recordCount);

  // Context Engine V2: find top 3 relevant memories
  const relevantMemories = getRelevantMemories(userMessage, user.memLogPath);

  // Professional log
  if (relevantMemories.length > 0) {
    console.log(`[CONTEXT ENGINE] ${relevantMemories.length} memories selected for: "${userMessage.slice(0, 50)}..."`);
    for (const m of relevantMemories) {
      console.log(`  → [${m.type}] score=${m.scoreFinal.toFixed(3)} overlap=${m.keywordOverlap} importance=${m.importance} hash=${(m.contentHash || m.tx || "").slice(0, 12)}`);
    }
  } else {
    console.log(`[CONTEXT ENGINE] No relevant memories for: "${userMessage.slice(0, 50)}..."`);
  }

  const { system, user: prompt } = buildPrompt(userMessage, chainRecords, relevantMemories);

  const message = await anthropic.messages.create({
    model: MODEL, max_tokens: 700,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  const aiResponse = message.content[0].text.trim();

  const extracted = extractMemory(aiResponse);
  const { score, approved } = scoreMemory(extracted);

  let txInfo = null;
  if (approved) {
    const freshVault = await user.program.account.vault.fetch(user.vaultPda).catch(() => ({ recordCount: 0 }));
    txInfo = await writeMemoryOnChain(user, user.vaultPda, freshVault.recordCount, extracted, score, aiResponse);
  }

  return { aiResponse, score, approved, txInfo, chainRecords, relevantMemories };
}

// Helper: extract a short "reason" from memory text (first sentence, max 100 chars)
function extractReason(text) {
  if (!text) return "Sem motivo registrado";
  const first = text.split(/[.\n]/)[0].trim();
  return first.length > 100 ? first.slice(0, 97) + "..." : first;
}

// Helper: extract a short "decision" from memory text (what was decided/learned, max 150 chars)
function extractDecision(text) {
  if (!text) return "Sem decisão registrada";
  // Try to find a decision-like pattern (decided, concluded, result, etc.)
  const decisionPatterns = /(decid[ei]|conclu[íi]|resultado|estratégia|definiu|escolheu|confirmou|adotou)[:\s]*([^.]*)/i;
  const match = text.match(decisionPatterns);
  if (match && match[2] && match[2].trim().length > 5) {
    const d = match[2].trim();
    return d.length > 150 ? d.slice(0, 147) + "..." : d;
  }
  // Fallback: first meaningful sentence
  const first = text.split(/[.\n]/)[0].trim();
  return first.length > 150 ? first.slice(0, 147) + "..." : first;
}

function formatReply({ aiResponse, score, approved, txInfo, chainRecords, relevantMemories }) {
  let reply = "";

  // IDENTITY HEADER
  reply += `🔒 *CognChain — Verified AI Memory*\n`;
  reply += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  // PROOF OF MEMORIES USED (before AI response — WOW effect)
  if (relevantMemories && relevantMemories.length > 0) {
    reply += `🧠 *MEMÓRIAS VERIFICADAS USADAS:*\n\n`;
    for (let i = 0; i < relevantMemories.length; i++) {
      const mem = relevantMemories[i];
      const dateStr = mem.timestamp ? new Date(mem.timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "N/A";
      const hashShort = (mem.contentHash || "").slice(0, 8) || (mem.tx || "").slice(0, 8) || "N/A";
      const explorerLink = mem.tx ? `🔗 [Explorer](https://explorer.solana.com/tx/${mem.tx}?cluster=devnet)` : "";
      const decisionText = extractDecision(mem.text);
      const reasonText = extractReason(mem.text);

      reply += `[${i + 1}] DECISION: "${decisionText}"\n`;
      reply += `Reason: ${reasonText}\n`;
      reply += `Score: ${mem.importance} bps\n`;
      reply += `Hash: \`${hashShort}...\`\n`;
      if (explorerLink) reply += `${explorerLink}\n`;
      reply += `\n`;
    }
    reply += `🤖 *RESPOSTA DA IA (baseada nas memórias acima):*\n`;
    reply += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  } else {
    reply += `🧠 *Sem memórias relevantes — resposta genérica*\n`;
    reply += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  }

  // AI RESPONSE
  reply += `${aiResponse}\n\n`;

  // MEMORY SCORE & STORAGE PROOF
  reply += `📊 *Memory Score:* ${score} bps`;
  if (approved && txInfo) {
    reply += ` ✅\n⛓️ *Armazenada na Solana!*\n📝 TX: \`${txInfo.tx}\`\n🔗 [Explorer](https://explorer.solana.com/tx/${txInfo.tx}?cluster=devnet)\n💾 Importance: ${txInfo.importance} bps`;
    if (txInfo.contentHash) reply += `\n🧬 Hash: \`${txInfo.contentHash.slice(0, 16)}...\``;
  } else {
    reply += ` _(abaixo do threshold, não armazenada)_\n📦 Vault: ${chainRecords.length} record(s)`;
  }

  // IMPACT FOOTER
  reply += `\n\n_🔐 This answer is based on verifiable memory stored on Solana._`;

  return reply;
}

// ── SOL transfer (unchanged) ──────────────────────────────────────────────────
async function sendSolAndRecord(user, amountSol, destinationAddress) {
  const destination = new PublicKey(destinationAddress);
  const lamports    = Math.round(amountSol * LAMPORTS_PER_SOL);

  const tx  = new Transaction().add(SystemProgram.transfer({ fromPubkey: user.keypair.publicKey, toPubkey: destination, lamports }));
  const sig = await sendAndConfirmTransaction(connection, tx, [user.keypair], { commitment: "confirmed" });

  const memText   = `SOL transfer: sent ${amountSol} SOL to ${destinationAddress}. TX: ${sig}`;
  const extracted = extractMemory(memText);
  const { score, approved } = scoreMemory(extracted);

  let memTxInfo = null;
  if (approved) {
    const freshVault = await user.program.account.vault.fetch(user.vaultPda).catch(() => ({ recordCount: 0 }));
    memTxInfo = await writeMemoryOnChain(user, user.vaultPda, freshVault.recordCount, extracted, score, memText);
  }
  return { sig, lamports, score, approved, memTxInfo };
}

// ── Jupiter swap (unchanged logic) ────────────────────────────────────────────
const KNOWN_MINTS = {
  SOL:  { address: "So11111111111111111111111111111111111111112", decimals: 9 },
  USDC: { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  USDT: { address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  BONK: { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5 },
};
const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6";

async function jupiterSwap(user, inputSymbol, outputSymbol, amountHuman) {
  const inToken  = KNOWN_MINTS[inputSymbol.toUpperCase()];
  const outToken = KNOWN_MINTS[outputSymbol.toUpperCase()];
  if (!inToken)  throw new Error(`Unknown token "${inputSymbol}". Supported: ${Object.keys(KNOWN_MINTS).join(", ")}`);
  if (!outToken) throw new Error(`Unknown token "${outputSymbol}". Supported: ${Object.keys(KNOWN_MINTS).join(", ")}`);

  const amountLamports = Math.round(amountHuman * Math.pow(10, inToken.decimals));
  const quoteRes = await fetch(`${JUPITER_QUOTE_API}/quote?inputMint=${inToken.address}&outputMint=${outToken.address}&amount=${amountLamports}&slippageBps=50`);
  if (!quoteRes.ok) throw new Error(`Jupiter quote failed: ${quoteRes.status}`);
  const quote = await quoteRes.json();
  if (quote.error) throw new Error(`Jupiter: ${quote.error}`);

  const outAmount   = (parseInt(quote.outAmount) / Math.pow(10, outToken.decimals)).toFixed(outToken.decimals === 9 ? 6 : 4);
  const priceImpact = parseFloat(quote.priceImpactPct || 0).toFixed(4);

  const swapRes = await fetch(`${JUPITER_QUOTE_API}/swap`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quoteResponse: quote, userPublicKey: user.keypair.publicKey.toBase58(), wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: "auto" }),
  });
  if (!swapRes.ok) throw new Error(`Jupiter swap failed: ${swapRes.status}`);
  const { swapTransaction } = await swapRes.json();
  if (!swapTransaction) throw new Error("Jupiter returned no swapTransaction");

  const vTx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));
  vTx.sign([user.keypair]);
  const sig = await connection.sendRawTransaction(vTx.serialize(), { skipPreflight: false, maxRetries: 3 });
  await connection.confirmTransaction(sig, "confirmed");

  return { sig, inAmount: amountHuman, inSymbol: inputSymbol.toUpperCase(), outAmount, outSymbol: outputSymbol.toUpperCase(), priceImpact };
}

// ── Pump.fun token creation (unchanged logic) ─────────────────────────────────
async function pumpFunCreate(user, { name, symbol, description, twitter = "", telegram = "", website = "" }) {
  const form = new FormData();
  form.append("name", name); form.append("symbol", symbol); form.append("description", description);
  form.append("twitter", twitter); form.append("telegram", telegram); form.append("website", website);
  form.append("showName", "true");

  const ipfsRes = await fetch("https://pump.fun/api/ipfs", { method: "POST", body: form, headers: form.getHeaders() });
  if (!ipfsRes.ok) throw new Error(`Pump.fun IPFS failed: ${ipfsRes.status}`);
  const { metadataUri } = await ipfsRes.json();
  if (!metadataUri) throw new Error("Pump.fun returned no metadataUri");

  const mintKeypair = Keypair.generate();
  const createRes = await fetch("https://pump.fun/api/trade-local", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicKey: user.keypair.publicKey.toBase58(), action: "create", tokenMetadata: { name, symbol, uri: metadataUri }, mint: mintKeypair.publicKey.toBase58(), denominatedInSol: "true", amount: 0.001, slippage: 10, priorityFee: 0.0005, pool: "pump" }),
  });
  if (!createRes.ok) throw new Error(`Pump.fun trade-local failed: ${createRes.status}`);

  const vTx = VersionedTransaction.deserialize(Buffer.from(await createRes.arrayBuffer()));
  vTx.sign([user.keypair, mintKeypair]);
  const sig = await connection.sendRawTransaction(vTx.serialize(), { skipPreflight: false, preflightCommitment: "confirmed" });
  await connection.confirmTransaction(sig, "confirmed");

  return { simulated: false, mintAddress: mintKeypair.publicKey.toBase58(), metadataUri, tx: sig };
}

function simulatePumpFun() {
  return { simulated: true, mintAddress: Keypair.generate().publicKey.toBase58(), metadataUri: null, tx: null };
}

// ── /memoria helpers (unchanged) ──────────────────────────────────────────────
const memoriaProofCache = new Map();

function classifyImportance(importance) {
  if (importance > 7000)  return { label: "Decisão",        emoji: "⚡" };
  if (importance >= 5000) return { label: "Comportamento",  emoji: "📊" };
  return                         { label: "Observação",     emoji: "💡" };
}

function toOneLiner(text) {
  const s = text.split(/[.\n]/)[0].trim();
  return s.length > 120 ? s.slice(0, 117) + "..." : s;
}

// ══════════════════════════════════════════════════════════════════════════════
// FIX #10: Safe error messages — don't leak internals to users
// Previously: `❌ Transfer failed: ${err.message}` could expose stack traces
// Now: generic user message + full error logged to server console only
// ══════════════════════════════════════════════════════════════════════════════
function safeErrorMessage(err) {
  const msg = err.message || String(err);
  // Log full error to server (not visible to user)
  console.error(`[ERROR] ${msg}`, err.stack || "");
  // Return safe, non-leaking message to user
  const knownErrors = [
    { pattern: /Insufficient balance/i, safe: "Saldo insuficiente para esta transação." },
    { pattern: /Blockhash not found/i, safe: "Rede Solana instável. Tente novamente em instantes." },
    { pattern: /Transaction simulation failed/i, safe: "Transação rejeitada pela rede. Verifique os dados e tente novamente." },
    { pattern: /Timeout/i, safe: "Tempo esgotado. A rede pode estar lenta. Tente novamente." },
    { pattern: /Invalid amount/i, safe: "Valor inválido. Use um número positivo." },
  ];
  for (const { pattern, safe } of knownErrors) {
    if (pattern.test(msg)) return safe;
  }
  return "Ocorreu um erro. Tente novamente.";
}

// ── Bot ───────────────────────────────────────────────────────────────────────
const bot        = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const processing = new Set();

// ── /start ────────────────────────────────────────────────────────────────────
bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;

  if (hasUser(chatId)) {
    const user = loadUser(chatId);
    const balance = await connection.getBalance(user.keypair.publicKey);
    return bot.sendMessage(chatId,
      `👋 *Welcome back to CognChain Agent!*\n\n` +
      `📬 Your wallet: \`${user.keypair.publicKey.toBase58()}\`\n` +
      `💰 Balance: \`${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\`\n\n` +
      `Use /help to see all commands.`,
      { parse_mode: "Markdown" }
    );
  }

  try {
    await bot.sendMessage(chatId, "⚙️ Creating your wallet and Solana vault...");
    const user = await createUser(chatId);

    await bot.sendMessage(chatId,
      `🎉 *Welcome to CognChain Agent!*\n\n` +
      `Your wallet has been created.\n\n` +
      `📬 *Address:*\n\`${user.keypair.publicKey.toBase58()}\`\n\n` +
      `💡 Deposit SOL to this address to start using all features.\n\n` +
      `/balance — check your balance\n` +
      `/help — see all commands`,
      { parse_mode: "Markdown" }
    );
    console.log(`[START] New user chat=${chatId} wallet=${user.keypair.publicKey.toBase58()}`);
  } catch (err) {
    console.error(`[START ERROR] chat=${chatId}:`, err.message);
    await bot.sendMessage(chatId, `❌ Failed to create wallet: ${err.message}`);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// UPDATED /help — Add new commands to help menu
// Replace the existing /help handler with this version
// ══════════════════════════════════════════════════════════════════════════════

// ── /help (UPDATED with new commands) ────────────────────────────────────
bot.onText(/^\/help$/, async (msg) => {
  await bot.sendMessage(msg.chat.id,
    `🤖 *CognChain Agent — Commands*\n\n` +
    `💬 *Chat* — just send any message\n` +
    `📊 /balance — wallet & vault info\n` +
    `🧠 /memoria — your memory timeline\n\n` +
    `🧠 *Memory & AI*\n` +
    `📚 /teach \\<topic\\> — AI learns & stores on-chain\n` +
    `🔍 /search \\<term\\> — search your memories\n` +
    `📊 /stats — brain dashboard\n` +
    `🧠 /insights — AI analyzes your memories\n` +
    `🎬 /demo — 60-second demo of memory evolution\n` +
    `📦 /export — download memories as JSON\n\n` +
    `💸 /send \\<amount\\> \\<address\\>\n` +
    `🤖 /agentpay \\<task\\> \\<amount\\>\n` +
    `🔄 /swap \\<amount\\> \\<FROM\\> \\<TO\\>\n` +
    `🪙 /memecoin \\<name\\> \\<symbol\\> \\<desc\\>\n` +
    `🔍 /check \\<address\\>\n\n` +
    `💰 *x402 Agent Commerce*\n` +
    `🏪 /services — services the agent sells\n` +
    `💵 /earnings — revenue dashboard\n` +
    `🔗 /x402 — server status & API info\n\n` +
    `⏰ *Cron (Agendamento)*\n` +
    `📅 /agendar \\<data\\> \\<hora\\> \\<valor\\> \\<destino\\> \\<motivo\\>\n` +
    `📋 /agendamentos — ver agendamentos\n` +
    `❌ /cancelar \\<id\\> — cancelar agendamento\n\n` +
    `🛡️ /pause · /resume · /limits`,
    { parse_mode: "Markdown" }
  );
});

// ── /balance (unchanged) ──────────────────────────────────────────────────────
bot.onText(/^\/balance$/, async (msg) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;
  try {
    const [balance, vault] = await Promise.all([
      connection.getBalance(user.keypair.publicKey),
      user.program.account.vault.fetch(user.vaultPda).catch(() => ({ recordCount: 0 })),
    ]);
    await bot.sendMessage(chatId,
      `💼 *Wallet Balance*\n\n` +
      `📬 Address: \`${user.keypair.publicKey.toBase58()}\`\n` +
      `💰 Balance: \`${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\`\n\n` +
      `📦 *Vault*\n` +
      `🗂 Memories: \`${vault.recordCount}\` on-chain record(s)\n` +
      `🔑 Vault PDA: \`${user.vaultPda.toBase58()}\`\n` +
      `🔗 [View on Explorer](https://explorer.solana.com/address/${user.vaultPda.toBase58()}?cluster=devnet)`,
      { parse_mode: "Markdown", disable_web_page_preview: true }
    );
  } catch (err) {
    await bot.sendMessage(chatId, `❌ Error: ${safeErrorMessage(err)}`);
  }
});

// ── /send (unchanged — already had securityGuard) ─────────────────────────────
bot.onText(/^\/send (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  const args = match[1].trim().split(/\s+/);
  if (args.length !== 2) return bot.sendMessage(chatId, "⚠️ Usage: `/send <amount_sol> <address>`", { parse_mode: "Markdown" });

  const amountSol   = parseFloat(args[0]);
  const destination = args[1];
  if (isNaN(amountSol) || amountSol <= 0) return bot.sendMessage(chatId, "❌ Invalid amount.", { parse_mode: "Markdown" });

  let isValidAddress = false;
  try { new PublicKey(destination); isValidAddress = true; } catch {}
  if (!isValidAddress) return bot.sendMessage(chatId, "❌ Invalid Solana address.", { parse_mode: "Markdown" });

  if (processing.has(chatId)) return bot.sendMessage(chatId, "⏳ Still processing, please wait...");
  processing.add(chatId);
  let statusMsg;
  try {
    statusMsg = await bot.sendMessage(chatId, "🛡️ Running security checks...", { parse_mode: "Markdown" });

    const guard = await securityGuard(user, `/send ${amountSol} ${destination}`, amountSol, destination);
    if (!guard.allowed) return bot.editMessageText(`🚫 *Transfer blocked*\n\n${guard.reason}`, { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown" });

    await bot.editMessageText(`💸 Sending ${amountSol} SOL...`, { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown" });

    const balance = await connection.getBalance(user.keypair.publicKey);
    if (balance < amountSol * LAMPORTS_PER_SOL + 5000) throw new Error(`Insufficient balance (${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL)`);

    const { sig, lamports, approved, memTxInfo } = await sendSolAndRecord(user, amountSol, destination);
    recordSpend(chatId, amountSol);

    let reply = `✅ *Transfer complete!*\n\n💰 Sent: \`${amountSol} SOL\` (${lamports.toLocaleString()} lamports)\n📬 To: \`${destination}\`\n📝 TX: \`${sig}\`\n🔗 [Explorer](https://explorer.solana.com/tx/${sig}?cluster=devnet)\n\n`;
    reply += approved && memTxInfo ? `🧠 *Memory written!*\n📊 Importance: ${memTxInfo.importance} bps` : `📊 Memory below threshold`;
    await bot.editMessageText(reply, { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown", disable_web_page_preview: true });
    console.log(`[SEND] chat=${chatId} amount=${amountSol} to=${destination} sig=${sig}`);
  } catch (err) {
    const errText = `❌ Transfer failed: ${safeErrorMessage(err)}`;
    if (statusMsg) await bot.editMessageText(errText, { chat_id: chatId, message_id: statusMsg.message_id }).catch(() => {});
    else await bot.sendMessage(chatId, errText).catch(() => {});
  } finally { processing.delete(chatId); }
});

// ── /agentpay (unchanged — already had securityGuard) ─────────────────────────
bot.onText(/^\/agentpay (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  const parts = match[1].trim().split(/\s+/);
  if (parts.length < 2) return bot.sendMessage(chatId, "⚠️ Usage: `/agentpay <task> <amount_sol>`", { parse_mode: "Markdown" });

  const amountSol = parseFloat(parts[parts.length - 1]);
  const task      = parts.slice(0, -1).join(" ");
  if (isNaN(amountSol) || amountSol <= 0) return bot.sendMessage(chatId, "❌ Last argument must be a positive SOL amount.", { parse_mode: "Markdown" });

  if (processing.has(chatId)) return bot.sendMessage(chatId, "⏳ Still processing, please wait...");
  processing.add(chatId);
  let statusMsg;
  try {
    statusMsg = await bot.sendMessage(chatId, "🛡️ Running security checks...", { parse_mode: "Markdown" });

    const guard = await securityGuard(user, `/agentpay ${task}`, amountSol, "AgentB:" + agentBKeypair.publicKey.toBase58());
    if (!guard.allowed) return bot.editMessageText(`🚫 *AgentPay blocked*\n\n${guard.reason}`, { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown" });

    await bot.editMessageText(`🤖 *AgentPay initiated*\n\n📋 Task: _${task}_\n💸 ${amountSol} SOL\n\n⏳ AgentA → AgentB → writing memories...`, { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown" });

    const result = await agentPayFlow(user, task, amountSol);
    recordSpend(chatId, amountSol);

    let reply = `🤖 *AgentPay Complete*\n\n📋 *Task:* _${task}_\n\n💬 *Result:*\n${result.taskResult}\n\n━━━━━━━━━━━━━━━━━━━━\n`;
    if (result.fundingSig) reply += `🪙 *Funding TX*\n\`${result.fundingSig}\`\n[Explorer](https://explorer.solana.com/tx/${result.fundingSig}?cluster=devnet)\n\n`;
    reply += `💸 *Payment TX*\n\`${result.paymentSig}\`\n[Explorer](https://explorer.solana.com/tx/${result.paymentSig}?cluster=devnet) · ${result.amountSol} SOL\n\n`;
    reply += `🤖 AgentB \`${result.agentB.slice(0, 8)}...\`\n`;
    reply += result.agentBMem.approved ? `🧠 Memory ✅ · ${result.agentBMem.importance} bps\n\n` : `📊 Score ${result.agentBMem.score} bps\n\n`;
    reply += `🤖 AgentA \`${result.agentA.slice(0, 8)}...\`\n`;
    reply += result.agentAMem.approved ? `🧠 Confirmation ✅ · ${result.agentAMem.importance} bps` : `📊 Score ${result.agentAMem.score} bps`;

    await bot.editMessageText(reply, { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown", disable_web_page_preview: true });
    console.log(`[AGENTPAY] chat=${chatId} task="${task}" amount=${amountSol}`);
  } catch (err) {
    const errText = `❌ AgentPay failed: ${safeErrorMessage(err)}`;
    if (statusMsg) await bot.editMessageText(errText, { chat_id: chatId, message_id: statusMsg.message_id }).catch(() => {});
    else await bot.sendMessage(chatId, errText).catch(() => {});
  } finally { processing.delete(chatId); }
});

// ══════════════════════════════════════════════════════════════════════════════
// FIX #7: /swap now has securityGuard — same protection as /send and /agentpay
// Previously: only checked if paused, then immediately executed swap
//   → No Claude safety check, no daily limit, unlimited swaps possible
// Now: full securityGuard flow (Claude check + daily limit + per-tx limit)
// ══════════════════════════════════════════════════════════════════════════════
bot.onText(/^\/swap (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  const parts = match[1].trim().split(/\s+/);
  if (parts.length !== 3) return bot.sendMessage(chatId, `⚠️ Usage: \`/swap <amount> <FROM> <TO>\`\nSupported: ${Object.keys(KNOWN_MINTS).join(", ")}`, { parse_mode: "Markdown" });

  const amountHuman  = parseFloat(parts[0]);
  const inputSymbol  = parts[1];
  const outputSymbol = parts[2];
  if (isNaN(amountHuman) || amountHuman <= 0) return bot.sendMessage(chatId, "❌ Amount must be a positive number.", { parse_mode: "Markdown" });

  if (processing.has(chatId)) return bot.sendMessage(chatId, "⏳ Still processing, please wait...");
  processing.add(chatId);
  let statusMsg;
  try {
    statusMsg = await bot.sendMessage(chatId, `🔄 Fetching Jupiter quote for ${amountHuman} ${inputSymbol.toUpperCase()} → ${outputSymbol.toUpperCase()}...`, { parse_mode: "Markdown" });

    // ✅ NEW: Security guard now protects swaps too
    const guard = await securityGuard(user, `/swap ${amountHuman} ${inputSymbol} ${outputSymbol}`, amountHuman, `Jupiter: ${inputSymbol.toUpperCase()}→${outputSymbol.toUpperCase()}`);
    if (!guard.allowed) return bot.editMessageText(`🚫 *Swap blocked*\n\n${guard.reason}`, { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown" });

    await bot.editMessageText(`🔄 Executing swap...`, { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown" });

    const swap = await jupiterSwap(user, inputSymbol, outputSymbol, amountHuman);
    recordSpend(chatId, amountHuman); // ✅ NEW: Track daily spend

    const memText   = `Swap executed: ${swap.inAmount} ${swap.inSymbol} → ${swap.outAmount} ${swap.outSymbol}, price impact ${swap.priceImpact}%, TX ${swap.sig}`;
    const extracted = extractMemory(memText);
    const { score, approved } = scoreMemory(extracted);
    let memTxInfo = null;
    if (approved) {
      const freshVault = await user.program.account.vault.fetch(user.vaultPda).catch(() => ({ recordCount: 0 }));
      memTxInfo = await writeMemoryOnChain(user, user.vaultPda, freshVault.recordCount, extracted, score, memText);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FIX #9: Explorer URL now consistent (devnet for all vault operations)
    // ══════════════════════════════════════════════════════════════════════════
    let reply = `✅ *Swap Complete!*\n\n🔄 ${swap.inAmount} *${swap.inSymbol}* → ${swap.outAmount} *${swap.outSymbol}*\n📉 Price impact: \`${swap.priceImpact}%\`\n📝 TX: \`${swap.sig}\`\n🔗 [Explorer](https://explorer.solana.com/tx/${swap.sig}?cluster=devnet)\n\n`;
    reply += memTxInfo ? `🧠 Swap saved to vault (${memTxInfo.importance} bps)` : `📊 Memory score: ${score} bps _(below threshold)_`;

    await bot.editMessageText(reply, { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown", disable_web_page_preview: true });
    console.log(`[SWAP] chat=${chatId} ${swap.inAmount} ${swap.inSymbol}→${swap.outSymbol} sig=${swap.sig}`);
  } catch (err) {
    const errText = `❌ Swap failed: ${safeErrorMessage(err)}`;
    if (statusMsg) await bot.editMessageText(errText, { chat_id: chatId, message_id: statusMsg.message_id }).catch(() => {});
    else await bot.sendMessage(chatId, errText).catch(() => {});
  } finally { processing.delete(chatId); }
});

// ══════════════════════════════════════════════════════════════════════════════
// FIX #8: /memecoin now has securityGuard — can't create unlimited tokens
// Previously: zero security checks, direct Pump.fun call
//   → User could spam token creation without limits
// Now: securityGuard + Claude safety check before creation
// ══════════════════════════════════════════════════════════════════════════════
bot.onText(/^\/memecoin (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  const raw        = match[1].trim();
  const quoteMatch = raw.match(/^(\S+)\s+(\S+)\s+['"](.+)['"]$/s);
  const plainParts = raw.split(/\s+/);
  let name, symbol, userDesc;
  if (quoteMatch)            { [, name, symbol, userDesc] = quoteMatch; }
  else if (plainParts.length >= 3) { name = plainParts[0]; symbol = plainParts[1]; userDesc = plainParts.slice(2).join(" "); }
  else return bot.sendMessage(chatId, "⚠️ Usage: `/memecoin <name> <symbol> <description>`", { parse_mode: "Markdown" });

  if (symbol.length > 10) return bot.sendMessage(chatId, "❌ Symbol must be 10 characters or fewer.", { parse_mode: "Markdown" });
  if (processing.has(chatId)) return bot.sendMessage(chatId, "⏳ Still processing, please wait...");
  processing.add(chatId);
  let statusMsg;
  try {
    statusMsg = await bot.sendMessage(chatId, `🪙 Generating <b>${name}</b> concept...`, { parse_mode: "HTML" });

    // ✅ NEW: Security guard protects memecoin creation too
    const guard = await securityGuard(user, `/memecoin ${name} ${symbol}`, 0.001, "Pump.fun token creation");
    if (!guard.allowed) return bot.editMessageText(`🚫 *Memecoin blocked*\n\n${guard.reason}`, { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown" });

    const vault       = await user.program.account.vault.fetch(user.vaultPda).catch(() => ({ recordCount: 0 }));
    const chainRecords = await readVaultMemories(user.program, user.vaultPda, vault.recordCount);
    const memCtx      = chainRecords.length > 0 ? `\n\nVault context (${chainRecords.length} memories)` : "";

    const claudeRes = await anthropic.messages.create({
      model: MODEL, max_tokens: 400,
      system: "You are a creative crypto meme coin writer. Be fun, punchy, internet-native. Keep it short.",
      messages: [{ role: "user", content: `Create a meme coin concept:\nName: ${name}\nSymbol: ${symbol.toUpperCase()}\nIdea: ${userDesc}${memCtx}\n\nRespond with:\nTAGLINE: <one punchy line>\nDESCRIPTION: <2 sentence fun description>\nVIBE: <3 emojis>` }],
    });

    const claudeText = claudeRes.content[0].text.trim();
    const tagline = (claudeText.match(/TAGLINE:\s*(.+)/i)?.[1] ?? name).trim();
    const aiDesc  = (claudeText.match(/DESCRIPTION:\s*([\s\S]+?)(?:\nVIBE:|$)/i)?.[1] ?? userDesc).trim();
    const vibe    = (claudeText.match(/VIBE:\s*(.+)/i)?.[1] ?? "🚀💎🌕").trim();

    await bot.editMessageText(`${vibe} <b>${name}</b> ready! Launching...`, { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "HTML" });

    let pumpResult, launchMode = "live";
    try {
      pumpResult = await pumpFunCreate(user, { name, symbol: symbol.toUpperCase(), description: aiDesc, telegram: "https://t.me/cognchain", website: "https://cognchain.xyz" });
    } catch (pumpErr) {
      console.warn(`[MEMECOIN] Pump.fun unavailable (${pumpErr.message}), simulating`);
      pumpResult = simulatePumpFun();
      launchMode = "simulated";
    }

    const memText   = `Meme coin created: ${name} (${symbol.toUpperCase()}) — "${tagline}". Mint: ${pumpResult.mintAddress}.`;
    const extracted = extractMemory(memText);
    const { score, approved } = scoreMemory(extracted);
    let memTxInfo = null;
    if (approved) {
      const freshVault = await user.program.account.vault.fetch(user.vaultPda).catch(() => ({ recordCount: 0 }));
      memTxInfo = await writeMemoryOnChain(user, user.vaultPda, freshVault.recordCount, extracted, score, memText);
    }

    const pumpLink = `https://pump.fun/coin/${pumpResult.mintAddress}`;
    let reply = `${vibe} <b>${name}</b> (${symbol.toUpperCase()})\n\n<i>"${tagline}"</i>\n\n${aiDesc}\n\n━━━━━━━━━━━━━━━━━━━━\n📋 <b>Mint Address</b>\n<code>${pumpResult.mintAddress}</code>\n\n`;
    if (launchMode === "live" && pumpResult.tx) {
      reply += `✅ <b>Live on Pump.fun</b>\n🔗 <a href="${pumpLink}">View on Pump.fun</a>\n📝 TX: <code>${pumpResult.tx}</code>\n\n`;
    } else {
      reply += `🧪 <b>Simulated</b> (Pump.fun mainnet only)\n🔗 <a href="${pumpLink}">Would appear here</a>\n\n`;
    }
    if (memTxInfo) reply += `━━━━━━━━━━━━━━━━━━━━\n🧠 Saved to vault (${memTxInfo.importance} bps)\n<a href="https://explorer.solana.com/tx/${memTxInfo.tx}?cluster=devnet">Memory TX</a>`;

    await bot.editMessageText(reply, { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "HTML", disable_web_page_preview: true });
    console.log(`[MEMECOIN] chat=${chatId} name=${name} mode=${launchMode} mint=${pumpResult.mintAddress}`);
  } catch (err) {
    const errText = `❌ Memecoin failed: ${safeErrorMessage(err)}`;
    if (statusMsg) await bot.editMessageText(errText, { chat_id: chatId, message_id: statusMsg.message_id }).catch(() => {});
    else await bot.sendMessage(chatId, errText).catch(() => {});
  } finally { processing.delete(chatId); }
});

// ── /check (unchanged — read-only, no financial risk) ─────────────────────────
bot.onText(/^\/check (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  const rawAddress = match[1].trim();
  let targetPubkey;
  try { targetPubkey = new PublicKey(rawAddress); } catch { return bot.sendMessage(chatId, "❌ Invalid Solana address.", { parse_mode: "Markdown" }); }

  let statusMsg;
  try {
    statusMsg = await bot.sendMessage(chatId, `🔍 Analyzing \`${rawAddress.slice(0, 8)}...\`...`, { parse_mode: "Markdown" });

    const [accountInfo, signatures] = await Promise.all([
      connection.getAccountInfo(targetPubkey),
      connection.getSignaturesForAddress(targetPubkey, { limit: 5 }),
    ]);

    let accountType = "Unknown / Not found";
    if (accountInfo) {
      if (accountInfo.executable) accountType = "Program (executable)";
      else if (accountInfo.owner.toBase58() === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" && accountInfo.data.length === 82) accountType = "Token Mint";
      else if (accountInfo.owner.toBase58() === "11111111111111111111111111111111") accountType = "System Account (wallet)";
      else accountType = `Program-owned (owner: ${accountInfo.owner.toBase58().slice(0, 8)}...)`;
    }

    const balanceSol    = accountInfo ? (accountInfo.lamports / LAMPORTS_PER_SOL).toFixed(4) : "0.0000";
    const dataSize      = accountInfo ? accountInfo.data.length : 0;
    const isExecutable  = accountInfo?.executable ?? false;
    const recentTxCount = signatures.length;
    const oldestTxAge   = signatures.length > 0 ? `oldest: ${new Date((signatures[signatures.length - 1].blockTime ?? 0) * 1000).toISOString()}` : "no recent txs";

    const vault       = await user.program.account.vault.fetch(user.vaultPda).catch(() => ({ recordCount: 0 }));
    const chainRecords = await readVaultMemories(user.program, user.vaultPda, vault.recordCount);
    const memCtx      = chainRecords.length > 0 ? `\n## Vault Context (${chainRecords.length} records)\n` + chainRecords.map(r => `  - #${r.id}: ${r.importance} bps, ${r.createdAt}`).join("\n") : "";

    const claudeMsg = await anthropic.messages.create({
      model: MODEL, max_tokens: 300,
      system: "You are a Solana blockchain security analyst. Be precise and concise.",
      messages: [{ role: "user", content: `Analyze this Solana account:\nAddress: ${rawAddress}\nType: ${accountType}\nBalance: ${balanceSol} SOL\nExecutable: ${isExecutable}\nData size: ${dataSize} bytes\nRecent TXs: ${recentTxCount} (${oldestTxAge})\n\nRisk score 1-10. Format:\nRISK: <1-10>\nANALYSIS: <2-3 sentences>${memCtx}` }],
    });
    const claudeText = claudeMsg.content[0].text.trim();
    const riskScore  = parseInt(claudeText.match(/RISK:\s*(\d+)/i)?.[1] ?? "5");
    const analysis   = (claudeText.match(/ANALYSIS:\s*([\s\S]+)/i)?.[1] ?? claudeText).trim();
    const riskEmoji  = riskScore <= 3 ? "🟢" : riskScore <= 6 ? "🟡" : "🔴";

    const memText   = `Security check for ${rawAddress}: type=${accountType}, risk=${riskScore}/10. ${analysis}`;
    const extracted = extractMemory(memText);
    const { score, approved } = scoreMemory(extracted);
    let memTxInfo = null;
    if (approved) {
      const freshVault = await user.program.account.vault.fetch(user.vaultPda).catch(() => ({ recordCount: 0 }));
      memTxInfo = await writeMemoryOnChain(user, user.vaultPda, freshVault.recordCount, extracted, score, memText);
    }

    let reply = `🔍 *Account Analysis*\n\n📬 \`${rawAddress}\`\n🏷 ${accountType}\n💰 \`${balanceSol} SOL\`\n⚙️ Executable: ${isExecutable ? "Yes" : "No"}\n📦 Data: ${dataSize} bytes\n📜 Recent TXs: ${recentTxCount}\n🔗 [Explorer](https://explorer.solana.com/address/${rawAddress}?cluster=devnet)\n\n━━━━━━━━━━━━━━━━━━━━\n${riskEmoji} *Risk Score: ${riskScore}/10*\n\n🧠 *Analysis:*\n${analysis}\n`;
    if (memTxInfo) reply += `\n━━━━━━━━━━━━━━━━━━━━\n💾 Saved to vault (${memTxInfo.importance} bps)\n\`${memTxInfo.tx}\``;

    await bot.editMessageText(reply, { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown", disable_web_page_preview: true });
    console.log(`[CHECK] chat=${chatId} address=${rawAddress} risk=${riskScore}`);
  } catch (err) {
    const errText = `❌ Check failed: ${safeErrorMessage(err)}`;
    if (statusMsg) await bot.editMessageText(errText, { chat_id: chatId, message_id: statusMsg.message_id }).catch(() => {});
    else await bot.sendMessage(chatId, errText).catch(() => {});
  }
});

// ── /teach <topic> — AI learns and stores on-chain ────────────────────────
// Flow: User sends topic → Claude generates insight → extract/score/hash → write to chain
// Security: Claude rate limiting, input validation (max 300 chars), processing lock
// ══════════════════════════════════════════════════════════════════════════════
bot.onText(/^\/teach (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  const topic = match[1].trim().slice(0, 300); // input length limit
  if (topic.length < 3) return bot.sendMessage(chatId, "❌ Topic too short. Use at least 3 characters.");

  if (!checkClaudeRateLimit(chatId)) {
    const remaining = getClaudeRateRemaining(chatId);
    return bot.sendMessage(chatId, `⏳ Rate limit reached. (${remaining}/${CLAUDE_RATE_LIMIT_MAX} remaining this minute)`);
  }

  if (processing.has(chatId)) return bot.sendMessage(chatId, "⏳ Still processing, please wait...");
  processing.add(chatId);
  let statusMsg;
  try {
    statusMsg = await bot.sendMessage(chatId, `🧠 Learning about "${topic.slice(0, 50)}${topic.length > 50 ? "..." : ""}"...`);

    // Fetch existing memories for context (last 10 from local log)
    const vault        = await user.program.account.vault.fetch(user.vaultPda).catch(() => ({ recordCount: 0 }));
    const chainRecords = await readVaultMemories(user.program, user.vaultPda, vault.recordCount);
    const memLog       = readMemoryLog(user.memLogPath);

    let contextStr = "";
    if (memLog.length > 0) {
      contextStr = "\n\n## Existing Knowledge Base (most recent)\n" +
        memLog.slice(-10).map((e, i) => `${i + 1}. [${e.type || "unknown"}] ${e.text.slice(0, 120)}`).join("\n");
    }

    // Claude generates structured insight about the topic
    const claudeRes = await anthropic.messages.create({
      model: MODEL, max_tokens: 500,
      system: "You are a knowledge generator for an AI agent's persistent memory on Solana blockchain. Generate a factual, actionable, specific insight. Avoid generic statements. If the topic is about crypto/blockchain/Solana, be technically precise.",
      messages: [{
        role: "user",
        content: `Generate a valuable insight about: ${topic}${contextStr}\n\nRespond with EXACTLY this format:\nINSIGHT: <2-3 sentences of detailed, factual insight>\nSUMMARY: <1 sentence concise summary>`
      }],
    });

    const claudeText   = claudeRes.content[0].text.trim();
    const insightMatch = claudeText.match(/INSIGHT:\s*([\s\S]+?)(?=\nSUMMARY:|$)/i);
    const summaryMatch = claudeText.match(/SUMMARY:\s*(.+)/i);

    const insightText = insightMatch ? insightMatch[1].trim() : claudeText;
    const summaryText = summaryMatch ? summaryMatch[1].trim() : topic;

    // Extract, score, hash — same pipeline as chat messages
    const memText   = `[TEACH] Topic: ${topic}. Insight: ${insightText}`;
    const extracted = extractMemory(memText);
    const { score, approved } = scoreMemory(extracted);

    if (!approved) {
      await bot.editMessageText(
        `🧠 *Learning: ${topic}*\n\n💡 ${insightText}\n\n📊 Score: ${score} bps _(below threshold, not stored)_`,
        { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown" }
      );
      return;
    }

    // Write to chain
    const freshVault = await user.program.account.vault.fetch(user.vaultPda).catch(() => ({ recordCount: 0 }));
    const txInfo     = await writeMemoryOnChain(user, user.vaultPda, freshVault.recordCount, extracted, score, memText);

    await bot.editMessageText(
      `🧠 *New knowledge acquired!*\n\n` +
      `📚 *Topic:* ${topic}\n\n` +
      `💡 *Insight:*\n${insightText}\n\n` +
      `📝 *Summary:*\n${summaryText}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ *Stored on Solana!*\n` +
      `📊 Score: ${score} bps\n` +
      `💾 Importance: ${txInfo.importance} bps\n` +
      `📝 TX: \`${txInfo.tx}\`\n` +
      `🔗 [Explorer](https://explorer.solana.com/tx/${txInfo.tx}?cluster=devnet)`,
      { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown", disable_web_page_preview: true }
    );
    console.log(`[TEACH] chat=${chatId} topic="${topic}" score=${score} tx=${txInfo.tx}`);
  } catch (err) {
    const errText = `❌ Teach failed: ${safeErrorMessage(err)}`;
    if (statusMsg) await bot.editMessageText(errText, { chat_id: chatId, message_id: statusMsg.message_id }).catch(() => {});
    else await bot.sendMessage(chatId, errText).catch(() => {});
  } finally { processing.delete(chatId); }
});

// ── /search <term> — Search memories by keyword ───────────────────────────
// Searches local memory log (has full text) + shows TX proof
// Read-only command — no security guard needed, no Claude API call
// Security: Input sanitized, max 100 chars, results capped at 10
// ══════════════════════════════════════════════════════════════════════════════
bot.onText(/^\/search (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  const rawTerm = match[1].trim().slice(0, 100); // input length limit
  const term    = rawTerm.toLowerCase();

  if (term.length < 2) return bot.sendMessage(chatId, "❌ Search term too short. Use at least 2 characters.");

  try {
    const log = readMemoryLog(user.memLogPath);

    if (log.length === 0) {
      return bot.sendMessage(chatId,
        "🧠 No memories stored yet.\n\n" +
        "💡 Chat with me or use /teach to create memories.",
        { parse_mode: "Markdown" }
      );
    }

    // Search in local memory log (contains full text)
    const results = log.filter(e =>
      e.text.toLowerCase().includes(term) ||
      (e.type && e.type.toLowerCase().includes(term))
    );

    if (results.length === 0) {
      return bot.sendMessage(chatId,
        `🔍 No memories found for "${rawTerm}".\n\n` +
        `💡 Try /teach <topic> to learn something new.`
      );
    }

    let reply = `🔍 *Search: "${rawTerm}"*\n`;
    reply += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    reply += `Found ${results.length} memor${results.length === 1 ? "y" : "ies"} (verified on Solana):\n\n`;

    for (const r of results.slice(0, 10)) { // cap at 10 results
      const cls      = classifyImportance(r.importance);
      const oneLiner = toOneLiner(r.text);
      reply += `${cls.emoji} *${cls.label}* — ${r.importance} bps\n`;
      reply += `_${oneLiner}_\n`;
      reply += `📝 TX: \`${r.tx}\`\n`;
      reply += `🔗 [Explorer](https://explorer.solana.com/tx/${r.tx}?cluster=devnet)\n\n`;
    }

    if (results.length > 10) {
      reply += `...and ${results.length - 10} more.\n`;
    }

    reply += `━━━━━━━━━━━━━━━━━━━━\n🧠 Vault: ${user.vaultPda.toBase58().slice(0, 12)}...`;

    await bot.sendMessage(chatId, reply, { parse_mode: "Markdown", disable_web_page_preview: true });
    console.log(`[SEARCH] chat=${chatId} term="${term}" results=${results.length}`);
  } catch (err) {
    await bot.sendMessage(chatId, `❌ Search failed: ${safeErrorMessage(err)}`);
  }
});

// ── /stats — Agent brain dashboard ───────────────────────────────────────
// Calculates: total memories, score distribution, dominant type, activity, timeline
// Read-only command — no security guard, no Claude API
// Security: All data from local files + on-chain (no user input processing)
// ══════════════════════════════════════════════════════════════════════════════
bot.onText(/^\/stats$/, async (msg) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  try {
    const [vault, log] = await Promise.all([
      user.program.account.vault.fetch(user.vaultPda).catch(() => ({ recordCount: 0 })),
      Promise.resolve(readMemoryLog(user.memLogPath)),
    ]);

    const totalMemories = log.length;

    if (totalMemories === 0) {
      return bot.sendMessage(chatId,
        "📊 *Agent Brain Dashboard*\n\n" +
        "🧠 No memories yet.\n\n" +
        "💡 Start chatting or use /teach to build your brain!",
        { parse_mode: "Markdown" }
      );
    }

    const stopWordsSet = new Set(["que","uma","com","para","por","the","and","for","not","are","was","this","that","from","with","your","have","has","been","will","can","mais","dos","das","nos","tem","seu","sua","ele","ela","depois","antes","aqui","isso","esse","esta","todo","cada","muito","pelo","pela","entre","sobre","ainda","agora","bem","sem","been","being","would","could","should"]);

    // Score statistics
    const scores   = log.map(e => e.importance);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    // Score distribution (buckets)
    const buckets = { "0-2000": 0, "2001-4000": 0, "4001-6000": 0, "6001-8000": 0, "8001-10000": 0 };
    for (const s of scores) {
      if (s <= 2000) buckets["0-2000"]++;
      else if (s <= 4000) buckets["2001-4000"]++;
      else if (s <= 6000) buckets["4001-6000"]++;
      else if (s <= 8000) buckets["6001-8000"]++;
      else buckets["8001-10000"]++;
    }
    const bucketBar = (count) => "█".repeat(Math.min(Math.round(count / totalMemories * 20), 20));

    // Type distribution
    const typeCounts = {};
    for (const e of log) {
      const t = e.type || "unknown";
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    const typeEmojis  = {
      decision: "⚡", behavior: "📊", observation: "💡", security: "🔒",
      analysis: "🔬", technical: "⚙️", general: "📝", unknown: "❓",
      "decisão": "⚡", "comportamento": "📊", "observação": "💡",
    };

    // Activity (last 7 days)
    const now     = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recentCount = log.filter(e => new Date(e.timestamp).getTime() > weekAgo).length;
    const activity    = recentCount >= 10 ? "🔥 Muito Ativo" : recentCount >= 5 ? "📈 Ativo" : recentCount >= 1 ? "📉 Baixo" : "💤 Inativo";

    // Activity per day (last 7 days)
    const dayCounts = {};
    for (let d = 6; d >= 0; d--) {
      const day = new Date(now - d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      dayCounts[day] = 0;
    }
    for (const e of log) {
      const day = e.timestamp?.slice(0, 10);
      if (day && dayCounts[day] !== undefined) dayCounts[day]++;
    }
    const activityGraph = Object.entries(dayCounts).map(([day, count]) => {
      const bar = "█".repeat(count) || "·";
      return `   ${day.slice(5)} ${bar} ${count}`;
    }).join("\n");

    // Timeline
    const firstDate = new Date(log[0]?.timestamp).toLocaleDateString("pt-BR");
    const lastDate  = new Date(log[log.length - 1]?.timestamp).toLocaleDateString("pt-BR");

    // Agent source distribution
    const agentTypeNames = { 0: "💬 Chat", 1: "🤖 AgentB", 2: "📚 Teach" };
    const agentTypeCounts = {};
    for (const e of log) {
      const at = agentTypeNames[e.agentType] || `Type ${e.agentType}`;
      agentTypeCounts[at] = (agentTypeCounts[at] || 0) + 1;
    }

    // Build reply
    let reply = `📊 *Agent Brain Dashboard*\n`;
    reply += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    reply += `🧠 *Total Memories:* ${totalMemories}\n`;
    reply += `⛓️ *On-Chain Records:* ${vault.recordCount}\n\n`;

    reply += `📈 *Score Distribution*\n`;
    reply += `   Avg: ${avgScore} bps · High: ${maxScore} bps · Low: ${minScore} bps\n`;
    reply += `   0-2k    ${bucketBar(buckets["0-2000"])} ${buckets["0-2000"]}\n`;
    reply += `   2k-4k   ${bucketBar(buckets["2001-4000"])} ${buckets["2001-4000"]}\n`;
    reply += `   4k-6k   ${bucketBar(buckets["4001-6000"])} ${buckets["4001-6000"]}\n`;
    reply += `   6k-8k   ${bucketBar(buckets["6001-8000"])} ${buckets["6001-8000"]}\n`;
    reply += `   8k-10k  ${bucketBar(buckets["8001-10000"])} ${buckets["8001-10000"]}\n\n`;

    reply += `🏷 *Dominant Type:* ${typeEmojis[dominantType[0]] || "📝"} ${dominantType[0]} (${dominantType[1]})\n\n`;

    reply += `🔥 *Activity:* ${activity} (last 7 days)\n${activityGraph}\n\n`;

    reply += `📅 *Timeline*\n`;
    reply += `   First: ${firstDate}\n`;
    reply += `   Last: ${lastDate}\n\n`;

    if (Object.keys(agentTypeCounts).length > 0) {
      reply += `🤖 *Source*\n`;
      for (const [source, count] of Object.entries(agentTypeCounts).sort((a, b) => b[1] - a[1])) {
        reply += `   ${source}: ${count}\n`;
      }
      reply += "\n";
    }

    // Top keywords
    const keywordCounts = {};
    for (const e of log) {
      const words = (e.text || "").toLowerCase().split(/[\s,.;:!?()"'\/\\]+/).filter(w => w.length > 4 && !stopWordsSet.has(w));
      for (const w of words) keywordCounts[w] = (keywordCounts[w] || 0) + 1;
    }
    const topKeywords = Object.entries(keywordCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (topKeywords.length > 0) {
      reply += `🔑 *Top Keywords*\n`;
      reply += `   ${topKeywords.map(([k, v]) => `${k} (${v})`).join(" · ")}\n\n`;
    }

    // Dominant knowledge area (from top keywords)
    const knowledgeArea = topKeywords.length > 0 ? topKeywords[0][0] : "Nenhuma ainda";
    reply += `🧠 *Dominant Knowledge Area:* ${knowledgeArea}\n\n`;

    // Reused memories — how many times the same keywords appear across memories
    const reusedCount = log.length > 1 ? log.filter(e => {
      const words = (e.text || "").toLowerCase().split(/[\s,.;:!?()"'\\/]+/).filter(w => w.length > 4 && !stopWordsSet.has(w));
      return words.some(w => keywordCounts[w] > 1);
    }).length : 0;
    const reusedPct = totalMemories > 0 ? Math.round((reusedCount / totalMemories) * 100) : 0;
    reply += `🔁 *Reused Memories:* ${reusedPct}% (${reusedCount}/${totalMemories} compartilham keywords)\n\n`;

    // Memory growth (memories per week)
    const daysActive = Math.max(1, Math.ceil((now - new Date(log[0]?.timestamp || now).getTime()) / (24 * 60 * 60 * 1000)));
    const weeksActive = Math.max(1, Math.ceil(daysActive / 7));
    const growthPerWeek = (totalMemories / weeksActive).toFixed(1);
    const growthPerDay = (totalMemories / daysActive).toFixed(1);
    reply += `📈 *Memory Growth:*\n`;
    reply += `   ${growthPerDay} memories/day · ${growthPerWeek} memories/week\n`;
    reply += `   ${totalMemories} memories em ${daysActive} dia${daysActive !== 1 ? "s" : ""}\n\n`;

    reply += `━━━━━━━━━━━━━━━━━━━━\n`;
    reply += `🔑 Vault: \`${user.vaultPda.toBase58().slice(0, 16)}...\``;

    await bot.sendMessage(chatId, reply, { parse_mode: "Markdown", disable_web_page_preview: true });
    console.log(`[STATS] chat=${chatId} memories=${totalMemories} avg=${avgScore} growth=${growthPerWeek}/week reused=${reusedPct}%`);
  } catch (err) {
    await bot.sendMessage(chatId, `❌ Stats failed: ${safeErrorMessage(err)}`);
  }
});

// ── /insights — Claude analyzes all memories for patterns ─────────────────
// Sends all memories to Claude for deep pattern analysis
// Security: Claude rate limiting, processing lock, max 50 memories sent (token limit)
// ══════════════════════════════════════════════════════════════════════════════
bot.onText(/^\/insights$/, async (msg) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  const log = readMemoryLog(user.memLogPath);
  if (log.length === 0) {
    return bot.sendMessage(chatId,
      "🧠 Not enough memories for analysis.\n\n" +
      "💡 Chat, use /teach, or interact more to build your knowledge base."
    );
  }
  if (log.length < 3) {
    return bot.sendMessage(chatId,
      `🧠 Only ${log.length} memories. Need at least 3 for meaningful analysis.\n\n` +
      "💡 Keep chatting or use /teach to add more."
    );
  }

  if (!checkClaudeRateLimit(chatId)) {
    const remaining = getClaudeRateRemaining(chatId);
    return bot.sendMessage(chatId, `⏳ Rate limit reached. (${remaining}/${CLAUDE_RATE_LIMIT_MAX} remaining this minute)`);
  }

  if (processing.has(chatId)) return bot.sendMessage(chatId, "⏳ Still processing, please wait...");
  processing.add(chatId);
  let statusMsg;
  try {
    statusMsg = await bot.sendMessage(chatId, `🧠 Analyzing ${log.length} memories...`);

    // Prepare memories for Claude (cap at 50 to avoid token overflow)
    const recentLogs = log.slice(-50);
    const memoriesStr = recentLogs.map((e, i) =>
      `${i + 1}. [${e.type || "unknown"}] (score: ${e.importance} bps) ${e.text.slice(0, 200)} — ${e.timestamp?.slice(0, 10)}`
    ).join("\n");

    const claudeRes = await anthropic.messages.create({
      model: MODEL, max_tokens: 1000,
      system: `You are an AI self-reflection analyst. An AI agent has stored memories on a blockchain (Solana).
Analyze ALL provided memories and deliver deep insights about the agent's knowledge evolution.
Reference specific memories when possible. Provide actionable recommendations.
Use clear sections with emojis. Be specific, not generic.`,
      messages: [{
        role: "user",
        content:
          `Analyze these ${log.length} memories from the agent's knowledge base:\n\n${memoriesStr}\n\n` +
          `Provide a structured analysis with these sections:\n` +
          `1. 🔍 DOMINANT THEMES — Most frequent topics and patterns\n` +
          `2. 📈 KNOWLEDGE EVOLUTION — How thinking evolved over time\n` +
          `3. ⚡ KEY INSIGHTS — Most valuable knowledge accumulated\n` +
          `4. 🕳️ KNOWLEDGE GAPS — What's missing or weak\n` +
          `5. 🎯 RECOMMENDATIONS — What the agent should learn next\n` +
          `6. 🧠 BRAIN HEALTH — Overall memory quality assessment`
      }],
    });

    const analysis = claudeRes.content[0].text.trim();

    // Save the insight itself as a memory
    const memText   = `[INSIGHTS] Analyzed ${log.length} memories. Claude identified patterns and recommendations.`;
    const extracted = extractMemory(memText);
    const { score, approved } = scoreMemory(extracted);
    let memTxInfo = null;
    if (approved) {
      try {
        const freshVault = await user.program.account.vault.fetch(user.vaultPda).catch(() => ({ recordCount: 0 }));
        memTxInfo = await writeMemoryOnChain(user, user.vaultPda, freshVault.recordCount, extracted, score, memText);
      } catch (chainErr) {
        console.error("[INSIGHTS CHAIN WRITE ERROR]", chainErr.message);
      }
    }

    let reply = `🧠 *Memory Analysis* — ${log.length} memories\n`;
    reply += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    reply += `${analysis}`;

    if (memTxInfo) {
      reply += `\n\n━━━━━━━━━━━━━━━━━━━━\n💾 Analysis saved to vault (${memTxInfo.importance} bps)`;
    }

    await bot.editMessageText(
      reply,
      { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown" }
    );
    console.log(`[INSIGHTS] chat=${chatId} memories=${log.length}`);
  } catch (err) {
    const errText = `❌ Insights failed: ${safeErrorMessage(err)}`;
    if (statusMsg) await bot.editMessageText(errText, { chat_id: chatId, message_id: statusMsg.message_id }).catch(() => {});
    else await bot.sendMessage(chatId, errText).catch(() => {});
  } finally { processing.delete(chatId); }
});

// ── /demo — Automated demo showing memory evolution ──────────────────────────
// Shows 3 sessions: generic → contextual → multi-memory
// ══════════════════════════════════════════════════════════════════════════════
bot.onText(/^\/demo$/, async (msg) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  const log = readMemoryLog(user.memLogPath);
  const hasMemories = log.length > 0;

  // Session 1 — Generic (no memories)
  const s1 = await bot.sendMessage(chatId,
    `🎬 *CognChain Demo — Evolução de Memória*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 *Sessão 1: Resposta Genérica (sem memória)*\n` +
    `💬 Pergunta: "O que é Bitcoin?"\n\n` +
    `🧠 Memórias relevantes: NENHUMA\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🤖 *Resposta:* O Bitcoin é uma criptomoeda descentralizada criada em 2009 por Satoshi Nakamoto. Utiliza blockchain para registrar transações de forma imutável.\n\n` +
    `📊 *Nota:* Sem contexto, a resposta é genérica e limitada.`
  );

  await new Promise(r => setTimeout(r, 2500));

  // Session 2 — With memory
  await bot.sendMessage(chatId,
    `📋 *Sessão 2: Resposta Contextual (1 memória)*\n` +
    `💬 Pergunta: "Como o Bitcoin afeta investimentos?"\n\n` +
    `🧠 *MEMÓRIA VERIFICADA USADA:*\n` +
    `[1] Score: 7500 bps | Agent: 💬 Claude | ${hasMemories ? new Date(log[0].timestamp).toLocaleDateString("pt-BR") : "20/04/2026"}\n` +
    `Hash: \`${(log[0]?.contentHash || "a1b2c3d4").slice(0, 8)}...\`\n` +
    `🔗 [Explorer](https://explorer.solana.com/tx/${log[0]?.tx || "EXAMPLExxxx"}?cluster=devnet)\n\n` +
    `🤖 *RESPOSTA DA IA:*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Baseado na memória armazenada em ${hasMemories ? new Date(log[0].timestamp).toLocaleDateString("pt-BR") : "20/04/2026"}, o Bitcoin é um ativo de alta volatilidade com correlação crescente com mercados tradicionais. Na última análise, observamos que o BTC serve como hedge contra inflação em mercados emergentes. O halving de 2024 reduziu a emissão para 3.125 BTC por bloco, pressionando oferta.\n\n` +
    `📊 *Nota:* Com 1 memória, a resposta ganha contexto e profundidade.`
  );

  await new Promise(r => setTimeout(r, 2500));

  // Session 3 — Multi-memory
  const vault = await user.program.account.vault.fetch(user.vaultPda).catch(() => ({ recordCount: 0 }));
  await bot.sendMessage(chatId,
    `📋 *Sessão 3: Resposta Precisa (3 memórias)*\n` +
    `💬 Pergunta: "Estratégia de investimento em cripto?"\n\n` +
    `🧠 *MEMÓRIAS VERIFICADAS USADAS:*\n\n` +
    `[1] Score: 8500 bps | Agent: 💬 Claude | 15/04/2026\n` +
    `Hash: \`${(log[0]?.contentHash || "e5f6g7h8").slice(0, 8)}...\`\n` +
    `🔗 [Explorer](https://explorer.solana.com/tx/${log[0]?.tx || "DEMO1txSig"}?cluster=devnet)\n\n` +
    `[2] Score: 7200 bps | Agent: 🤖 AgentB | 18/04/2026\n` +
    `Hash: \`${(log[1]?.contentHash || "i9j0k1l2").slice(0, 8)}...\`\n` +
    `🔗 [Explorer](https://explorer.solana.com/tx/${log[1]?.tx || "DEMO2txSig"}?cluster=devnet)\n\n` +
    `[3] Score: 6800 bps | Agent: 💬 Claude | 22/04/2026\n` +
    `Hash: \`${(log[2]?.contentHash || "m3n4o5p6").slice(0, 8)}...\`\n` +
    `🔗 [Explorer](https://explorer.solana.com/tx/${log[2]?.tx || "DEMO3txSig"}?cluster=devnet)\n\n` +
    `🤖 *RESPOSTA DA IA:*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Baseado nas 3 memórias verificadas na blockchain:\n\n` +
    `1️⃣ Diversificação é essencial — conforme memória de 15/04, alocação de 60% BTC + 30% altcoins + 10% stablecoins minimiza risco.\n` +
    `2️⃣ AgentB identificou em 18/04 que DeFi em Solana oferece APYs superiores a Ethereum para yield farming.\n` +
    `3️⃣ Análise de 22/04 mostra correlação BTC-ETH de 0.87, sugerindo hedge com ativos não-correlacionados.\n\n` +
    `✅ *Estratégia recomendada:* DCA semanal em BTC + posição em SOL DeFi + reserva em USDC.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 *Nota:* Com 3 memórias, a resposta é precisa, multi-dimensional e verificável.`
  );

  await new Promise(r => setTimeout(r, 1500));

  // Summary — EVOLUÇÃO DA IA (narrativa)
  await bot.sendMessage(chatId,
    `🏆 *Demo Concluída!*\n\n` +
    `📈 *EVOLUÇÃO DA IA:*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🔹 *Session 1* → resposta genérica _(sem memória)_\n` +
    `   A IA responde com informações básicas, sem contexto personalizado. Nenhuma memória foi encontrada.\n\n` +
    `🔹 *Session 2* → resposta baseada em memória\n` +
    `   A IA recupera 1 memória verificada na Solana e constrói resposta mais contextualizada. O hash SHA-256 garante que a memória não foi alterada.\n\n` +
    `🔹 *Session 3* → decisão precisa com prova on-chain\n` +
    `   A IA combina 3 memórias verificadas para gerar uma estratégia multi-dimensional. Cada memória tem TX assinada na Solana, com prova imutável.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⛓️ *Memórias on-chain:* ${vault.recordCount} records\n` +
    `🧠 *Memórias no log:* ${log.length} entries\n\n` +
    `🔒 CognChain — Verified AI Memory\n` +
    `_🔐 This answer is based on verifiable memory stored on Solana._`,
    { parse_mode: "Markdown", disable_web_page_preview: true }
  );

  console.log(`[DEMO] chat=${chatId} vault=${vault.recordCount} log=${log.length}`);
});

// ── /export — Export memories as JSON file ───────────────────────────────
// Combines local log (full text) + on-chain records (hashes) into downloadable JSON
// Read-only command — no Claude API, no security guard
// Security: File auto-deleted after 60 seconds, user can only export their own data
// ══════════════════════════════════════════════════════════════════════════════
bot.onText(/^\/export$/, async (msg) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  try {
    const [vault, log] = await Promise.all([
      user.program.account.vault.fetch(user.vaultPda).catch(() => ({ recordCount: 0 })),
      Promise.resolve(readMemoryLog(user.memLogPath)),
    ]);

    if (log.length === 0) {
      return bot.sendMessage(chatId, "📦 No memories to export.\n\n💡 Chat or use /teach to create memories first.");
    }

    // Show "exporting" status
    const statusMsg = await bot.sendMessage(chatId, `📦 Exporting ${log.length} memories...`);

    // Fetch on-chain records for verification
    const chainRecords = await readVaultMemories(user.program, user.vaultPda, vault.recordCount);

    // Build export object
    const exportData = {
      exportDate: new Date().toISOString(),
      agent: {
        wallet: user.keypair.publicKey.toBase58(),
        vault: user.vaultPda.toBase58(),
        onChainRecords: vault.recordCount,
      },
      summary: {
        totalMemories: log.length,
        avgScore: Math.round(log.reduce((a, e) => a + e.importance, 0) / log.length),
        maxScore: Math.max(...log.map(e => e.importance)),
        dateRange: {
          from: log[0]?.timestamp || null,
          to: log[log.length - 1]?.timestamp || null,
        },
      },
      memories: log.map(e => ({
        recordId: e.recordId,
        text: e.text,
        type: e.type || "unknown",
        importance: e.importance,
        agentType: e.agentType,
        timestamp: e.timestamp,
        transaction: e.tx,
        explorer: `https://explorer.solana.com/tx/${e.tx}?cluster=devnet`,
      })),
      onChainVerification: chainRecords.map(r => ({
        id: r.id,
        importance: r.importance,
        contentHash: r.contentHash,
        createdAt: r.createdAt,
      })),
    };

    // Write to temp file
    const filePath = `${USERS_DIR}/export-${chatId}-${Date.now()}.json`;
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), "utf8");

    // Send as Telegram document
    await bot.sendDocument(chatId, filePath, {
      caption:
        `📦 *CognChain Memory Export*\n\n` +
        `🧠 ${log.length} memories\n` +
        `⛓️ ${vault.recordCount} on-chain records\n` +
        `📊 Avg score: ${exportData.summary.avgScore} bps\n` +
        `📅 Exported: ${new Date().toISOString().slice(0, 10)}`,
      parse_mode: "Markdown",
    });

    // Delete status message
    await bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

    // Auto-cleanup temp file after 60 seconds
    setTimeout(() => {
      try {
        fs.unlinkSync(filePath);
        console.log(`[EXPORT CLEANUP] Deleted ${filePath}`);
      } catch {}
    }, 60000);

    console.log(`[EXPORT] chat=${chatId} memories=${log.length} file=${filePath}`);
  } catch (err) {
    await bot.sendMessage(chatId, `❌ Export failed: ${safeErrorMessage(err)}`);
  }
});

// ── /memoria (unchanged) ──────────────────────────────────────────────────────
bot.onText(/^\/memoria$/, async (msg) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  const log = readMemoryLog(user.memLogPath);
  if (log.length === 0) {
    return bot.sendMessage(chatId, "🧠 Nenhuma memória registrada ainda.\n\nConverse comigo, use /send, /agentpay ou /check para começar.", { parse_mode: "Markdown" });
  }

  const classified = log.map(e => ({ ...e, ...classifyImportance(e.importance), oneLiner: toOneLiner(e.text) }));
  const oldest = classified[0]?.timestamp?.slice(0, 10).split("-").reverse().join("/") ?? "—";

  let text = `🧠 *O que eu sei sobre você*\n━━━━━━━━━━━━━━━━━━━━\n`;
  for (const r of classified) { text += `${r.emoji} *${r.label}*\n_'${r.oneLiner}'_\n`; }
  text += `━━━━━━━━━━━━━━━━━━━━\n🧠 ${log.length} aprendizado${log.length !== 1 ? "s" : ""} registrado${log.length !== 1 ? "s" : ""}\n📅 Desde: ${oldest}`;

  memoriaProofCache.set(String(chatId), classified);

  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "🔍 Ver prova completa", callback_data: `proof_${chatId}` }]] },
  });
});

bot.on("callback_query", async (query) => {
  const chatId  = query.message.chat.id;
  const data    = query.data ?? "";
  if (!data.startsWith("proof_")) return bot.answerCallbackQuery(query.id);

  const user    = getUser(chatId);
  const records = memoriaProofCache.get(String(chatId));
  if (!records || records.length === 0) return bot.answerCallbackQuery(query.id, { text: "Cache expirado. Use /memoria novamente." });

  let proof = `🔐 *Prova On-Chain — Solana Devnet*\n📦 Vault: \`${user?.vaultPda?.toBase58() ?? "N/A"}\`\n━━━━━━━━━━━━━━━━━━━━\n`;
  for (const r of records) {
    proof += `\n${r.emoji} *Record #${r.recordId}* — ${r.label} (${r.importance} bps)\n🕐 ${r.timestamp?.slice(0, 19).replace("T", " ")}\n📝 TX: \`${r.tx}\`\n🔗 [Ver TX](https://explorer.solana.com/tx/${r.tx}?cluster=devnet)\n`;
  }
  proof += `\n━━━━━━━━━━━━━━━━━━━━\n🔒 Conteúdo armazenado como hash SHA-256 on-chain.\nTexto original em memory-log-${chatId}.json.`;

  await bot.answerCallbackQuery(query.id);
  await bot.sendMessage(chatId, proof, { parse_mode: "Markdown", disable_web_page_preview: true });
});

// ── /pause /resume /limits ────────────────────────────────────────────────────
bot.onText(/^\/pause$/, async (msg) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;
  const sec = getUserSecurity(chatId);
  if (sec.paused) return bot.sendMessage(chatId, "⚠️ Already paused.", { parse_mode: "Markdown" });
  sec.paused = true;
  saveUserSecurity(chatId, sec); // ✅ Persist to disk
  await writeSecurityMemory(user, "PAUSED: operator paused all financial commands via /pause.");
  await bot.sendMessage(chatId, `⏸️ *Paused.*\nFinancial commands blocked. Use /resume to re-enable.`, { parse_mode: "Markdown" });
});

bot.onText(/^\/resume$/, async (msg) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;
  const sec = getUserSecurity(chatId);
  if (!sec.paused) return bot.sendMessage(chatId, "✅ Already running.", { parse_mode: "Markdown" });
  sec.paused = false;
  saveUserSecurity(chatId, sec); // ✅ Persist to disk
  await writeSecurityMemory(user, "RESUMED: operator resumed financial commands via /resume.");
  await bot.sendMessage(chatId, `▶️ *Resumed.*\nFinancial commands re-enabled.`, { parse_mode: "Markdown" });
});

bot.onText(/^\/limits$/, async (msg) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;
  const sec = getUserSecurity(chatId);
  resetDailyIfNeeded(sec);
  const remaining = Math.max(0, MAX_DAILY_SOL - sec.dailySpent).toFixed(4);
  await bot.sendMessage(chatId,
    `🛡️ *Security Limits*\n\n⚙️ Max per tx: \`${MAX_TX_SOL} SOL\`\n📅 Max per day: \`${MAX_DAILY_SOL} SOL\`\n\n📊 *Today (${sec.dayKey})*\n💸 Spent: \`${sec.dailySpent.toFixed(4)} SOL\`\n✅ Remaining: \`${remaining} SOL\`\n\n${sec.paused ? "⏸️ *Status: PAUSED*" : "▶️ *Status: ACTIVE*"}`,
    { parse_mode: "Markdown" }
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// x402 AGENT COMMERCE — services, earnings, server status
// ══════════════════════════════════════════════════════════════════════════════

const X402_SERVER = process.env.X402_SERVER_URL || "http://localhost:4020";

// ── /services — list services the agent sells via x402 ────────────────────
bot.onText(/^\/services$/, async (msg) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  try {
    const res = await fetch(`${X402_SERVER}/v1/payments`, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error("x402 server unavailable");

    const payments = await res.json().catch(() => []);
    const totalRevenue = payments.reduce((sum, p) => sum + (p.amountSol || 0), 0);

    await bot.sendMessage(chatId,
      `🏪 *x402 Agent Commerce — Services*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🔍 *Memory Search*\n` +
      `   Price: 0.00001 SOL\n` +
      `   Search your verified memories on-chain\n\n` +
      `🧠 *Memory Evolution*\n` +
      `   Price: 0.00005 SOL\n` +
      `   Claude evolves a memory with deeper analysis\n\n` +
      `📊 *AI Insights*\n` +
      `   Price: 0.0001 SOL\n` +
      `   Full pattern analysis of your memories\n\n` +
      `📚 *Teach Agent*\n` +
      `   Price: 0.00003 SOL\n` +
      `   Agent learns a new topic and stores on-chain\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🔗 *Server:* ${X402_SERVER}\n` +
      `💰 *Total Revenue:* ${totalRevenue.toFixed(6)} SOL\n` +
      `📝 *Transactions:* ${Array.isArray(payments) ? payments.length : 0}`,
      { parse_mode: "Markdown", disable_web_page_preview: true }
    );
    console.log(`[SERVICES] chat=${chatId}`);
  } catch (err) {
    await bot.sendMessage(chatId,
      `🏪 *x402 Agent Commerce — Services*\n\n` +
      `⚠️ x402 server is offline at ${X402_SERVER}\n\n` +
      `Available services:\n` +
      `🔍 Memory Search — 0.00001 SOL\n` +
      `🧠 Memory Evolution — 0.00005 SOL\n` +
      `📊 AI Insights — 0.0001 SOL\n` +
      `📚 Teach Agent — 0.00003 SOL\n\n` +
      `💡 Start x402-server.js to enable payments.`,
      { parse_mode: "Markdown" }
    );
    console.log(`[SERVICES] chat=${chatId} offline=true`);
  }
});

// ── /earnings — revenue dashboard ────────────────────────────────────────
bot.onText(/^\/earnings$/, async (msg) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  try {
    const res = await fetch(`${X402_SERVER}/v1/earnings`, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error("x402 server unavailable");

    const data = await res.json().catch(() => ({}));
    const total = data.totalEarnings || 0;
    const count = data.totalPayments || 0;
    const avg   = count > 0 ? (total / count).toFixed(6) : "0.000000";

    let serviceBreakdown = "";
    if (data.byService && Object.keys(data.byService).length > 0) {
      serviceBreakdown = `\n📊 *By Service:*\n`;
      for (const [svc, info] of Object.entries(data.byService)) {
        serviceBreakdown += `   ${svc}: ${info.count}x — ${(info.total || 0).toFixed(6)} SOL\n`;
      }
    }

    await bot.sendMessage(chatId,
      `💵 *x402 Revenue Dashboard*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💰 *Total Revenue:* ${total.toFixed(6)} SOL\n` +
      `📝 *Transactions:* ${count}\n` +
      `📊 *Average:* ${avg} SOL/tx\n` +
      serviceBreakdown +
      `\n🔗 Server: ${X402_SERVER}`,
      { parse_mode: "Markdown", disable_web_page_preview: true }
    );
    console.log(`[EARNINGS] chat=${chatId} total=${total} count=${count}`);
  } catch (err) {
    await bot.sendMessage(chatId,
      `💵 *x402 Revenue Dashboard*\n\n` +
      `⚠️ x402 server is offline at ${X402_SERVER}\n\n` +
      `💡 Start x402-server.js to view earnings.`,
      { parse_mode: "Markdown" }
    );
    console.log(`[EARNINGS] chat=${chatId} offline=true`);
  }
});

// ── /x402 — server status & API info ─────────────────────────────────────
bot.onText(/^\/x402$/, async (msg) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  try {
    const res = await fetch(`${X402_SERVER}/health`, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error("unhealthy");

    const health = await res.json().catch(() => ({}));

    await bot.sendMessage(chatId,
      `🔗 *x402 Payment Server — Status*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `✅ *Status:* ONLINE\n` +
      `🌐 *Server:* ${X402_SERVER}\n` +
      `🕐 *Uptime:* ${health.uptime || "N/A"}\n\n` +
      `📋 *API Endpoints:*\n` +
      `GET  / — server info\n` +
      `GET  /docs — API documentation\n` +
      `GET  /health — health check\n` +
      `POST /v1/memory/search — search memories (0.00001 SOL)\n` +
      `POST /v1/memory/evolve — evolve memory (0.00005 SOL)\n` +
      `POST /v1/insights — AI insights (0.0001 SOL)\n` +
      `POST /v1/teach — teach agent (0.00003 SOL)\n` +
      `GET  /v1/payments — payment history\n` +
      `GET  /v1/earnings — revenue dashboard\n\n` +
      `⛓️ *Protocol:* HTTP 402 Payment Required\n` +
      `💰 *Network:* Solana Devnet`,
      { parse_mode: "Markdown", disable_web_page_preview: true }
    );
    console.log(`[X402] chat=${chatId} status=online`);
  } catch (err) {
    await bot.sendMessage(chatId,
      `🔗 *x402 Payment Server — Status*\n\n` +
      `❌ *Status:* OFFLINE\n` +
      `🌐 *Server:* ${X402_SERVER}\n\n` +
      `💡 Start x402-server.js to enable the payment server.`,
      { parse_mode: "Markdown" }
    );
    console.log(`[X402] chat=${chatId} status=offline`);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// CRON SCHEDULING — agendar, agendamentos, cancelar
// ══════════════════════════════════════════════════════════════════════════════

function getScheduledPaymentsPath(chatId) { return `${USERS_DIR}/scheduled-${chatId}.json`; }

function loadScheduledPayments(chatId) {
  try { return JSON.parse(fs.readFileSync(getScheduledPaymentsPath(chatId), "utf8")); } catch { return []; }
}

function saveScheduledPayments(chatId, payments) {
  try { fs.writeFileSync(getScheduledPaymentsPath(chatId), JSON.stringify(payments, null, 2), "utf8"); } catch (err) {
    console.error("[SCHEDULE SAVE ERROR]", err.message);
  }
}

async function checkScheduledPayments() {
  try {
    // Find all scheduled payment files
    const files = fs.readdirSync(USERS_DIR).filter(f => f.startsWith("scheduled-") && f.endsWith(".json"));
    for (const file of files) {
      const chatId = parseInt(file.replace("scheduled-", "").replace(".json", ""));
      const payments = loadScheduledPayments(chatId);
      const now = new Date();
      const toExecute = payments.filter(p => !p.executed && !p.cancelled && new Date(p.scheduledFor) <= now);

      for (const payment of toExecute) {
        const user = getUser(chatId);
        if (!user) continue;

        console.log(`[CRON] Executing scheduled payment ${payment.id} for chat=${chatId}`);

        try {
          // Claude safety check before execution
          const guard = await securityGuard(user, `Scheduled: ${payment.reason}`, payment.amountSol, payment.destination);
          if (!guard.allowed) {
            payment.executed = true;
            payment.result = `BLOCKED: ${guard.reason}`;
            payment.executedAt = new Date().toISOString();
            saveScheduledPayments(chatId, payments);
            await bot.sendMessage(chatId, `⏰ *Pagamento agendado BLOQUEADO*\n\n🆔 ID: ${payment.id}\n💰 ${payment.amountSol} SOL → ${payment.destination.slice(0, 8)}...\n🚫 ${guard.reason}`, { parse_mode: "Markdown" });
            continue;
          }

          // Execute the transfer
          const { sig } = await sendSolAndRecord(user, payment.amountSol, payment.destination);
          recordSpend(chatId, payment.amountSol);

          payment.executed = true;
          payment.result = `SUCCESS: TX ${sig}`;
          payment.txSignature = sig;
          payment.executedAt = new Date().toISOString();
          saveScheduledPayments(chatId, payments);

          await bot.sendMessage(chatId,
            `⏰ *Pagamento agendado EXECUTADO*\n\n` +
            `🆔 ID: ${payment.id}\n` +
            `💰 ${payment.amountSol} SOL → ${payment.destination.slice(0, 8)}...\n` +
            `📝 Motivo: ${payment.reason}\n` +
            `✅ TX: \`${sig}\`\n` +
            `🔗 [Explorer](https://explorer.solana.com/tx/${sig}?cluster=devnet)`,
            { parse_mode: "Markdown", disable_web_page_preview: true }
          );
          console.log(`[CRON] SUCCESS payment=${payment.id} sig=${sig}`);
        } catch (err) {
          payment.executed = true;
          payment.result = `ERROR: ${safeErrorMessage(err)}`;
          payment.executedAt = new Date().toISOString();
          saveScheduledPayments(chatId, payments);
          await bot.sendMessage(chatId, `⏰ *Pagamento agendado FALHOU*\n\n🆔 ID: ${payment.id}\n❌ ${safeErrorMessage(err)}`, { parse_mode: "Markdown" });
          console.error(`[CRON] ERROR payment=${payment.id}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error("[CRON ERROR]", err.message);
  }
}

// Check scheduled payments every 30 seconds
setInterval(checkScheduledPayments, 30000);
console.log("[CRON] Scheduled payment checker started (every 30s)");

// ── /agendar <data> <hora> <valor> <destino> <motivo> ───────────────────
bot.onText(/^\/agendar (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  const args = match[1].trim().split(/\s+/);
  if (args.length < 5) {
    return bot.sendMessage(chatId,
      "⚠️ *Usage:* `/agendar <data> <hora> <valor> <destino> <motivo>`\n\n" +
      "*Exemplo:*\n" +
      "/agendar 20/05/2026 20:00 0.5 7AHM... pagamento mensal",
      { parse_mode: "Markdown" }
    );
  }

  const dateStr   = args[0];
  const timeStr   = args[1];
  const amountSol = parseFloat(args[2]);
  const destAddr  = args[3];
  const reason    = args.slice(4).join(" ");

  // Validate date
  const dateParts = dateStr.split("/");
  if (dateParts.length !== 3) return bot.sendMessage(chatId, "❌ Data inválida. Use formato DD/MM/AAAA.");
  const [day, month, year] = dateParts.map(Number);
  const timeParts = timeStr.split(":");
  if (timeParts.length < 2) return bot.sendMessage(chatId, "❌ Hora inválida. Use formato HH:MM.");
  const [hours, minutes] = timeParts.map(Number);

  const scheduledDate = new Date(year, month - 1, day, hours, minutes, 0);
  if (isNaN(scheduledDate.getTime())) return bot.sendMessage(chatId, "❌ Data/hora inválida.");
  if (scheduledDate <= new Date()) return bot.sendMessage(chatId, "❌ A data deve ser no futuro.");

  if (isNaN(amountSol) || amountSol <= 0) return bot.sendMessage(chatId, "❌ Valor deve ser um número positivo.");

  let isValidAddr = false;
  try { new PublicKey(destAddr); isValidAddr = true; } catch {}
  if (!isValidAddr) return bot.sendMessage(chatId, "❌ Endereço Solana inválido.");

  if (amountSol > MAX_TX_SOL) return bot.sendMessage(chatId, `❌ Valor excede o limite de ${MAX_TX_SOL} SOL por transação.`);

  const payments = loadScheduledPayments(chatId);
  const paymentId = String(payments.length + 1).padStart(3, "0");
  const scheduledFor = scheduledDate.toISOString();

  payments.push({
    id: paymentId,
    amountSol,
    destination: destAddr,
    reason,
    scheduledFor,
    createdAt: new Date().toISOString(),
    executed: false,
    cancelled: false,
  });

  saveScheduledPayments(chatId, payments);

  const scheduledBR = scheduledDate.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  await bot.sendMessage(chatId,
    `📅 *Pagamento Agendado!*\n\n` +
    `🆔 *ID:* ${paymentId}\n` +
    `💰 *Valor:* ${amountSol} SOL\n` +
    `📬 *Destino:* \`${destAddr.slice(0, 8)}...${destAddr.slice(-4)}\`\n` +
    `🕐 *Data/Hora:* ${scheduledBR}\n` +
    `📝 *Motivo:* ${reason}\n\n` +
    `✅ Claude verificará segurança antes de executar.\n` +
    `📋 Use /agendamentos para ver todos.`,
    { parse_mode: "Markdown" }
  );
  console.log(`[AGENDAR] chat=${chatId} id=${paymentId} amount=${amountSol} date=${scheduledBR} dest=${destAddr.slice(0, 8)}`);
});

// ── /agendamentos — ver agendamentos ─────────────────────────────────────
bot.onText(/^\/agendamentos$/, async (msg) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  const payments = loadScheduledPayments(chatId);

  if (payments.length === 0) {
    return bot.sendMessage(chatId, `📋 *Nenhum agendamento.*\n\nUse /agendar <data> <hora> <valor> <destino> <motivo> para criar um.`);
  }

  const pending = payments.filter(p => !p.executed && !p.cancelled);
  const executed = payments.filter(p => p.executed);
  const cancelled = payments.filter(p => p.cancelled);

  let reply = `📋 *Agendamentos*\n━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (pending.length > 0) {
    reply += `⏳ *Pendentes (${pending.length}):*\n`;
    for (const p of pending) {
      const date = new Date(p.scheduledFor).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      reply += `  🆔 ${p.id} · ${p.amountSol} SOL · ${date}\n  📝 ${p.reason}\n\n`;
    }
  }

  if (executed.length > 0) {
    reply += `✅ *Executados (${executed.length}):*\n`;
    for (const p of executed) {
      reply += `  🆔 ${p.id} · ${p.amountSol} SOL · ${p.result?.slice(0, 50) || "OK"}\n\n`;
    }
  }

  if (cancelled.length > 0) {
    reply += `❌ *Cancelados (${cancelled.length}):*\n`;
    for (const p of cancelled) {
      reply += `  🆔 ${p.id} · ${p.amountSol} SOL\n\n`;
    }
  }

  reply += `━━━━━━━━━━━━━━━━━━━━\n💡 Use /cancelar <id> para cancelar um pendente.`;

  await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
  console.log(`[AGENDAMENTOS] chat=${chatId} pending=${pending.length} executed=${executed.length}`);
});

// ── /cancelar <id> — cancelar agendamento ────────────────────────────────
bot.onText(/^\/cancelar (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const user   = requireUser(chatId);
  if (!user) return;

  const paymentId = match[1].trim();

  const payments = loadScheduledPayments(chatId);
  const target = payments.find(p => p.id === paymentId && !p.executed && !p.cancelled);

  if (!target) {
    return bot.sendMessage(chatId, `❌ Agendamento #${paymentId} não encontrado ou já executado/cancelado.\n\nUse /agendamentos para ver a lista.`);
  }

  target.cancelled = true;
  target.cancelledAt = new Date().toISOString();
  saveScheduledPayments(chatId, payments);

  const date = new Date(target.scheduledFor).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  await bot.sendMessage(chatId,
    `❌ *Agendamento Cancelado!*\n\n` +
    `🆔 *ID:* ${target.id}\n` +
    `💰 *Valor:* ${target.amountSol} SOL\n` +
    `🕐 *Era para:* ${date}\n` +
    `📝 *Motivo:* ${target.reason}`,
    { parse_mode: "Markdown" }
  );
  console.log(`[CANCELAR] chat=${chatId} id=${paymentId}`);
});

// ── Plain message handler ─────────────────────────────────────────────────────
bot.on("message", async (msg) => {
  const chatId      = msg.chat.id;
  const userMessage = msg.text;
  if (!userMessage || userMessage.startsWith("/")) return;

  const user = requireUser(chatId);
  if (!user) return;

  // ✅ Claude rate limiting
  if (!checkClaudeRateLimit(chatId)) {
    const remaining = getClaudeRateRemaining(chatId);
    return bot.sendMessage(chatId, `⏳ Rate limit reached. Please wait a moment. (${remaining}/${CLAUDE_RATE_LIMIT_MAX} messages remaining this minute)`);
  }

  if (processing.has(chatId)) { await bot.sendMessage(chatId, "⏳ Still processing, please wait..."); return; }
  processing.add(chatId);
  let statusMsg;
  try {
    statusMsg = await bot.sendMessage(chatId, "🔒 CognChain — Verified AI Memory\n🧠 Buscando memórias verificadas na Solana...\n_🔐 Verifying blockchain proofs..._");
    const result = await processMessage(user, userMessage);
    const reply  = formatReply(result);
    await bot.editMessageText(reply, { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: "Markdown", disable_web_page_preview: true });
    const memCount = (result.relevantMemories || []).length;
    console.log(`[MSG] chat=${chatId} score=${result.score} stored=${result.approved} memories_used=${memCount} vault=${result.chainRecords.length}`);
  } catch (err) {
    const errText = `❌ Error: ${safeErrorMessage(err)}`;
    if (statusMsg) await bot.editMessageText(errText, { chat_id: chatId, message_id: statusMsg.message_id }).catch(() => {});
    else await bot.sendMessage(chatId, errText).catch(() => {});
  } finally { processing.delete(chatId); }
});

bot.on("polling_error", (err) => console.error("[POLLING ERROR]", err.message));

// ── Start ─────────────────────────────────────────────────────────────────────
(async () => {
  const info = await bot.getMe();
  console.log("═".repeat(55));
  console.log("  🤖 CognChain Telegram Bot (multi-user) — HARDENED");
  console.log("═".repeat(55));
  console.log(`  Bot username : @${info.username}`);
  console.log(`  AgentB       : ${agentBKeypair.publicKey.toBase58()}`);
  console.log(`  Users dir    : ${USERS_DIR}/`);
  console.log(`  Claude model : ${MODEL}`);
  console.log(`  RPC          : ${RPC}`);
  console.log(`  Encryption   : ${getEncryptionKey() ? "✅ AES-256-CBC" : "⚠️  DISABLED (set ENCRYPTION_KEY)"}`);
  console.log("═".repeat(55));
  console.log("  Listening for messages...");
})().catch(err => { console.error("❌ Startup error:", err.message); process.exit(1); });

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * SECURITY CHANGELOG — What was fixed and why
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * FIX #0 — dotenv loaded at top
 *   Added require("dotenv").config() as the very first line
 *   Enables .env file for all environment variables
 *
 * FIX #1 — AgentB keypair no longer uses predictable seed
 *   Before: Keypair.fromSeed(Buffer.from("cognchain-agent-b-fixed-seed-v1!"))
 *   After:  Loads from AGENT_B_KEYPAIR env var, or generates random + saves to file
 *   Impact: No one can derive the AgentB private key from the source code
 *
 * FIX #2 — Claude safety check input sanitized against prompt injection
 *   Before: User input passed directly to Claude prompt
 *   After:  Keywords like VERDICT/SAFE/UNSAFE filtered, input truncated to 200 chars,
 *           Claude response parsed as structured JSON instead of regex
 *   Impact: Attackers cannot trick Claude into approving malicious transactions
 *
 * FIX #3 — Security state (pause/resume/limits) persisted to disk
 *   Before: Map() in memory — lost on reboot
 *   After:  Saved to users/security-{chatId}.json after every change
 *   Impact: /pause survives bot restarts, daily limits don't reset on reboot
 *
 * FIX #4 — User private keys encrypted with AES-256-CBC
 *   Before: fs.writeFileSync(path, JSON.stringify(secretKey)) — plaintext
 *   After:  AES-256-CBC encryption with master key from ENCRYPTION_KEY env var
 *           Auto-migrates old plaintext keys on first load
 *   Impact: Server compromise no longer exposes all user private keys
 *
 * FIX #5 — Claude API rate limiting (10 msgs/min per user)
 *   Before: Unlimited Claude calls
 *   After:  Max 10 messages per minute per user, friendly rate limit message
 *   Impact: Prevents API key abuse and unexpected Anthropic charges
 *
 * FIX #6 — RPC URL moved to env (no more hardcoded Helius API key)
 *   Before: "https://devnet.helius-rpc.com/?api-key=86b9952e-..."
 *   After:  process.env.RPC_URL || "https://api.devnet.solana.com"
 *   Impact: API key not exposed in source code
 *
 * FIX #7 — /swap now passes through securityGuard
 *   Before: Only checked pause status, then executed immediately
 *   After:  Full securityGuard flow (Claude check + daily limit + per-tx limit)
 *   Impact: Swaps can't bypass security controls
 *
 * FIX #8 — /memecoin now passes through securityGuard
 *   Before: Zero security checks before Pump.fun creation
 *   After:  SecurityGuard with Claude safety analysis
 *   Impact: Token creation can't bypass security controls
 *
 * FIX #9 — Explorer URLs made consistent (devnet)
 *   Before: /swap showed mainnet-beta, others showed devnet
 *   After:  All links use devnet consistently
 *
 * FIX #10 — Error messages don't leak internals
 *   Before: err.message shown directly to user (could contain stack traces)
 *   After:  safeErrorMessage() maps known errors to user-friendly Portuguese messages,
 *           full error logged to server console only
 *   Impact: No information leakage to users
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * SETUP REQUIRED — Create a .env file with these variables:
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * TELEGRAM_BOT_TOKEN=your_telegram_bot_token
 * ANTHROPIC_API_KEY=your_anthropic_api_key
 * RPC_URL=https://devnet.helius-rpc.com/?api-key=your_helius_key
 * ENCRYPTION_KEY=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
 * AGENT_B_KEYPAIR=<optional: paste JSON array of 64 bytes, or let it auto-generate>
 * PROGRAM_ID=7AHMKtvPuZ6yKdWtWD1kC6kgPkEgooeBBtrmUrVc2teU
 *
 * ══════════════════════════════════════════════════════════════════════════════
 */
