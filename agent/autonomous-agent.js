// autonomous-agent.js — CognChain Autonomous AI Agent
// Reads memories from Solana vault, calls Claude API, writes new memories on-chain

const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const anchor = require("@coral-xyz/anchor");
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const { scoreMemory } = require("./scorer");
const { hashMemory } = require("./hasher");
const { extractMemory } = require("./extractor");

// ── Config ───────────────────────────────────────────────────────────────────
const PROGRAM_ID = new PublicKey("7AHMKtvPuZ6yKdWtWD1kC6kgPkEgooeBBtrmUrVc2teU");
const RPC = "https://devnet.helius-rpc.com/?api-key=86b9952e-7447-409f-81f8-92d8603e1a07";
const MODEL = "claude-sonnet-4-20250514";
const LOOPS = 3;

const IDL = {"version":"0.1.0","name":"cognchain","instructions":[{"name":"createVault","accounts":[{"name":"vault","isMut":true,"isSigner":false},{"name":"authority","isMut":true,"isSigner":true},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[{"name":"label","type":"string"}]},{"name":"writeMemory","accounts":[{"name":"vault","isMut":true,"isSigner":false},{"name":"record","isMut":true,"isSigner":false},{"name":"authority","isMut":true,"isSigner":true},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[{"name":"contentHash","type":{"array":["u8",32]}},{"name":"summaryHash","type":{"array":["u8",32]}},{"name":"importance","type":"u16"},{"name":"agentType","type":"u8"}]},{"name":"readMemory","accounts":[{"name":"vault","isMut":false,"isSigner":false},{"name":"record","isMut":false,"isSigner":false},{"name":"authority","isMut":true,"isSigner":true}],"args":[]}],"accounts":[{"name":"Vault","type":{"kind":"struct","fields":[{"name":"authority","type":"publicKey"},{"name":"label","type":"string"},{"name":"recordCount","type":"u16"},{"name":"bump","type":"u8"},{"name":"createdAt","type":"i64"}]}},{"name":"MemoryRecord","type":{"kind":"struct","fields":[{"name":"vault","type":"publicKey"},{"name":"id","type":"u16"},{"name":"authority","type":"publicKey"},{"name":"contentHash","type":{"array":["u8",32]}},{"name":"summaryHash","type":{"array":["u8",32]}},{"name":"importance","type":"u16"},{"name":"agentType","type":"u8"},{"name":"bump","type":"u8"},{"name":"createdAt","type":"i64"}]}}],"errors":[{"code":6000,"name":"LabelTooLong","msg":"Label exceeds 64 characters."},{"code":6001,"name":"InvalidImportance","msg":"Importance must be between 0 and 10000 bps."},{"code":6002,"name":"VaultFull","msg":"Vault has reached the maximum number of records."},{"code":6003,"name":"WrongVault","msg":"Record does not belong to this vault."}]};

// ── Helpers ──────────────────────────────────────────────────────────────────

function deriveVaultPda(walletPubkey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), walletPubkey.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

function deriveRecordPda(vaultPda, index) {
  const countBuf = Buffer.alloc(2);
  countBuf.writeUInt16LE(index);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("record"), vaultPda.toBuffer(), countBuf],
    PROGRAM_ID
  );
  return pda;
}

// Read all on-chain memory records for the vault and return their metadata
async function readVaultMemories(program, vaultPda, recordCount) {
  const records = [];
  for (let i = 0; i < recordCount; i++) {
    try {
      const recordPda = deriveRecordPda(vaultPda, i);
      const record = await program.account.memoryRecord.fetch(recordPda);
      records.push({
        id: record.id,
        importance: record.importance,
        agentType: record.agentType,
        contentHash: Buffer.from(record.contentHash).toString("hex").slice(0, 16),
        summaryHash: Buffer.from(record.summaryHash).toString("hex").slice(0, 16),
        createdAt: new Date(record.createdAt.toNumber() * 1000).toISOString(),
      });
    } catch {
      // record may not exist yet, skip
    }
  }
  return records;
}

// Ensure vault exists, create if needed, return vault account
async function ensureVault(program, keypair, vaultPda) {
  try {
    const vault = await program.account.vault.fetch(vaultPda);
    console.log(`  ✅ Vault found | label: "${vault.label}" | records: ${vault.recordCount}`);
    return vault;
  } catch {
    console.log("  🔨 Creating vault...");
    const tx = await program.methods
      .createVault("CognChain Autonomous Agent")
      .accounts({
        vault: vaultPda,
        authority: keypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log(`  ✅ Vault created | tx: ${tx}`);
    return program.account.vault.fetch(vaultPda);
  }
}

// Write a memory record to Solana
async function writeMemoryOnChain(program, keypair, vaultPda, recordCount, extracted, score) {
  const { contentHash, summaryHash } = hashMemory(extracted);
  const recordPda = deriveRecordPda(vaultPda, recordCount);
  const importance = Math.min(score, 10000);

  const tx = await program.methods
    .writeMemory(
      Array.from(contentHash),
      Array.from(summaryHash),
      importance,
      0  // agentType: 0 = Claude
    )
    .accounts({
      vault: vaultPda,
      record: recordPda,
      authority: keypair.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  return { tx, recordPda, importance };
}

// Build Claude prompt injecting memory context
function buildPrompt(loop, sessionMemories, chainRecords) {
  const topics = [
    "the optimal architecture for a decentralized AI memory system on Solana",
    "how autonomous agents can improve their reasoning using on-chain memory",
    "the relationship between memory importance scoring and agent intelligence growth",
  ];
  const topic = topics[(loop - 1) % topics.length];

  let memoryContext = "";

  if (chainRecords.length > 0) {
    memoryContext += `\n## On-Chain Memory Records (Solana Vault)\n`;
    memoryContext += `You have ${chainRecords.length} memory record(s) stored on Solana devnet:\n`;
    chainRecords.forEach(r => {
      memoryContext += `  - Record #${r.id}: importance=${r.importance} bps, stored at ${r.createdAt}\n`;
    });
  }

  if (sessionMemories.length > 0) {
    memoryContext += `\n## Previous Insights (This Session)\n`;
    sessionMemories.forEach((m, i) => {
      memoryContext += `  [Loop ${i + 1}] ${m}\n`;
    });
  }

  const systemPrompt = memoryContext
    ? `You are an autonomous AI agent with persistent memory stored on the Solana blockchain.
Your previous reasoning has been recorded on-chain and is reproduced below for context.
Use this memory to build more sophisticated insights with each iteration.
${memoryContext}`
    : `You are an autonomous AI agent beginning to build persistent memory on the Solana blockchain.
This is your first reasoning cycle — your insights will be stored on-chain and recalled in future iterations.`;

  const userPrompt = `Loop ${loop}/${LOOPS}: Reason deeply about ${topic}.
Provide a concrete, technical insight that advances understanding.
Be specific, building on any prior context you have. 2–3 sentences.`;

  return { systemPrompt, userPrompt };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY environment variable not set");

  const anthropic = new Anthropic.default({ apiKey });

  // Load wallet
  const walletData = JSON.parse(fs.readFileSync("./wallet.json"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(walletData));
  console.log("\n🔑 Wallet:", keypair.publicKey.toBase58());

  // Connect to Solana
  const connection = new Connection(RPC, "confirmed");
  const balance = await connection.getBalance(keypair.publicKey);
  console.log("💰 Balance:", (balance / 1e9).toFixed(4), "SOL");
  if (balance < 0.01 * 1e9) throw new Error("Insufficient balance — airdrop at faucet.solana.com");

  // Setup Anchor
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new anchor.Program(IDL, PROGRAM_ID, provider);

  // Ensure vault
  const vaultPda = deriveVaultPda(keypair.publicKey);
  console.log("\n📦 Vault PDA:", vaultPda.toBase58());
  let vault = await ensureVault(program, keypair, vaultPda);

  // Session memory: stores actual text of insights generated this run
  const sessionMemories = [];

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  🤖 COGNCHAIN AUTONOMOUS AGENT  —  ${LOOPS} reasoning loops`);
  console.log(`${"═".repeat(60)}`);

  for (let loop = 1; loop <= LOOPS; loop++) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`  LOOP ${loop}/${LOOPS}`);
    console.log(`${"─".repeat(60)}`);

    // 1. Read memories from Solana
    vault = await program.account.vault.fetch(vaultPda);
    const chainRecords = await readVaultMemories(program, vaultPda, vault.recordCount);
    console.log(`\n🔍 [Solana] Read ${chainRecords.length} on-chain record(s) from vault`);
    if (chainRecords.length > 0) {
      const avgImportance = Math.round(chainRecords.reduce((s, r) => s + r.importance, 0) / chainRecords.length);
      console.log(`   Avg importance: ${avgImportance} bps`);
    }

    // 2. Build prompt with memory context
    const { systemPrompt, userPrompt } = buildPrompt(loop, sessionMemories, chainRecords);

    // 3. Call Claude API
    console.log(`\n🧠 [Claude] Calling ${MODEL}...`);
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const response = message.content[0].text.trim();
    console.log(`\n💬 Claude response:\n   "${response}"`);

    // 4. Extract & score
    const extracted = extractMemory(response);
    const { score, approved } = scoreMemory(extracted);
    console.log(`\n📊 Score: ${score} bps | Threshold: 4000 bps | Approved: ${approved}`);
    console.log(`   Type: ${extracted.type} | Keywords: ${extracted.keywords.slice(0, 4).join(", ")}`);

    // 5. Write to Solana if score >= 4000
    if (approved) {
      console.log("\n⛓️  Writing memory to Solana...");
      const { tx, recordPda, importance } = await writeMemoryOnChain(
        program, keypair, vaultPda, vault.recordCount, extracted, score
      );
      console.log(`   ✅ Memory written! importance=${importance} bps`);
      console.log(`   📝 Tx: ${tx}`);
      console.log(`   🔗 Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
      console.log(`   💾 Record PDA: ${recordPda.toBase58()}`);
    } else {
      console.log("   ⚠️  Score below threshold — memory not written to chain");
    }

    // 6. Add insight to session memory for next loop
    sessionMemories.push(extracted.insight);

    // Show intelligence growth indicator
    const growthBar = "█".repeat(loop) + "░".repeat(LOOPS - loop);
    console.log(`\n🧬 Intelligence growth: [${growthBar}] loop ${loop}/${LOOPS}`);
  }

  // Final summary
  vault = await program.account.vault.fetch(vaultPda);
  console.log(`\n${"═".repeat(60)}`);
  console.log("  🎉 AUTONOMOUS AGENT SESSION COMPLETE");
  console.log(`${"═".repeat(60)}`);
  console.log(`  Loops completed : ${LOOPS}`);
  console.log(`  Memories written: ${vault.recordCount} total on-chain records`);
  console.log(`  Vault PDA       : ${vaultPda.toBase58()}`);
  console.log(`  Network         : Solana Devnet`);
  console.log(`${"═".repeat(60)}\n`);
}

main().catch(err => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
