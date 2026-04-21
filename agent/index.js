// index.js — CognChain Memory Engine
// Extrai memória de uma conversa e grava na Solana devnet

const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const anchor = require("@coral-xyz/anchor");
const fs = require("fs");
const { extractMemory } = require("./extractor");
const { scoreMemory } = require("./scorer");
const { hashMemory } = require("./hasher");

// ── Config ──────────────────────────────────────────────
const PROGRAM_ID = new PublicKey("7AHMKtvPuZ6yKdWtWD1kC6kgPkEgooeBBtrmUrVc2teU");
const RPC = "https://devnet.helius-rpc.com/?api-key=86b9952e-7447-409f-81f8-92d8603e1a07";

const IDL = {"version":"0.1.0","name":"cognchain","instructions":[{"name":"createVault","accounts":[{"name":"vault","isMut":true,"isSigner":false},{"name":"authority","isMut":true,"isSigner":true},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[{"name":"label","type":"string"}]},{"name":"writeMemory","accounts":[{"name":"vault","isMut":true,"isSigner":false},{"name":"record","isMut":true,"isSigner":false},{"name":"authority","isMut":true,"isSigner":true},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[{"name":"contentHash","type":{"array":["u8",32]}},{"name":"summaryHash","type":{"array":["u8",32]}},{"name":"importance","type":"u16"},{"name":"agentType","type":"u8"}]},{"name":"readMemory","accounts":[{"name":"vault","isMut":false,"isSigner":false},{"name":"record","isMut":false,"isSigner":false},{"name":"authority","isMut":false,"isSigner":true}],"args":[]}],"accounts":[{"name":"Vault","type":{"kind":"struct","fields":[{"name":"authority","type":"publicKey"},{"name":"label","type":"string"},{"name":"recordCount","type":"u16"},{"name":"bump","type":"u8"},{"name":"createdAt","type":"i64"}]}},{"name":"MemoryRecord","type":{"kind":"struct","fields":[{"name":"vault","type":"publicKey"},{"name":"id","type":"u16"},{"name":"authority","type":"publicKey"},{"name":"contentHash","type":{"array":["u8",32]}},{"name":"summaryHash","type":{"array":["u8",32]}},{"name":"importance","type":"u16"},{"name":"agentType","type":"u8"},{"name":"bump","type":"u8"},{"name":"createdAt","type":"i64"}]}}],"errors":[{"code":6000,"name":"LabelTooLong","msg":"Label exceeds 64 characters."},{"code":6001,"name":"InvalidImportance","msg":"Importance must be between 0 and 10000 bps."},{"code":6002,"name":"VaultFull","msg":"Vault has reached the maximum number of records."},{"code":6003,"name":"WrongVault","msg":"Record does not belong to this vault."}]};

// ── Conversa de teste ────────────────────────────────────
const TEST_CONVERSATION = `
User: We need to decide on the storage architecture for CognChain.
Agent: After analyzing options including Arweave, IPFS, and centralized databases,
I recommend using Solana PDAs for on-chain hashes with encrypted off-chain blobs.
This gives us verifiability without exposing raw content on-chain.
User: Agreed. Let's commit to this architecture for Phase 1.
Agent: Confirmed. The strategy is: hash on Solana, encrypted content off-chain, 
user holds decryption key in their wallet.
`;

async function main() {
  // 1. Carregar wallet
  const walletData = JSON.parse(fs.readFileSync("./wallet.json"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(walletData));
  console.log("🔑 Wallet:", keypair.publicKey.toBase58());

  // 2. Conectar à Solana via Helius
  const connection = new Connection(RPC, "confirmed");
  const balance = await connection.getBalance(keypair.publicKey);
  console.log("💰 Balance:", balance / 1e9, "SOL");

  if (balance < 0.01 * 1e9) {
    throw new Error("Saldo insuficiente. Faça airdrop em faucet.solana.com");
  }

  // 3. Configurar provider e programa
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new anchor.Program(IDL, PROGRAM_ID, provider);

  // 4. Extrair memória da conversa
  console.log("\n🧠 Extraindo memória...");
  const extracted = await extractMemory(TEST_CONVERSATION);
  console.log("  tipo:", extracted.type);
  console.log("  insight:", extracted.insight);
  console.log("  keywords:", extracted.keywords.join(", "));

  // 5. Pontuar importância
  const scored = scoreMemory(extracted);
  console.log("\n📊 Score:", scored.score, "bps | Aprovado:", scored.approved);
  if (!scored.approved) {
    console.log("⚠️  Memória abaixo do threshold. Não será gravada.");
    return;
  }

  // 6. Gerar hashes
  const { contentHash, summaryHash } = hashMemory(extracted);
  console.log("\n#️⃣  contentHash:", Buffer.from(contentHash).toString("hex").substring(0, 16) + "...");
  console.log("#️⃣  summaryHash:", Buffer.from(summaryHash).toString("hex").substring(0, 16) + "...");

  // 7. Derivar PDAs
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), keypair.publicKey.toBuffer()],
    PROGRAM_ID
  );
  console.log("\n📦 Vault PDA:", vaultPda.toBase58());

  // 8. Verificar se vault existe, se não criar
  let vaultAccount = null;
  try {
    vaultAccount = await program.account.vault.fetch(vaultPda);
    console.log("✅ Vault já existe | records:", vaultAccount.recordCount);
  } catch {
    console.log("🔨 Criando vault...");
    const tx = await program.methods
      .createVault("CognChain Memory Vault")
      .accounts({
        vault: vaultPda,
        authority: keypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("✅ Vault criado:", tx);
    vaultAccount = await program.account.vault.fetch(vaultPda);
  }

  // 9. Derivar record PDA
  const countBuf = Buffer.alloc(2);
  countBuf.writeUInt16LE(vaultAccount.recordCount);
  const [recordPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("record"), vaultPda.toBuffer(), countBuf],
    PROGRAM_ID
  );

  // 10. Gravar memória na Solana
  console.log("\n⛓️  Gravando memória na Solana...");
  const importance = Math.min(scored.score, 10000);
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

  console.log("\n🎉 MEMÓRIA GRAVADA NA SOLANA!");
  console.log("📝 Transação:", tx);
  console.log("🔍 Explorer:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  console.log("💾 Record PDA:", recordPda.toBase58());
  console.log("📊 Importance:", importance, "bps");
}

main().catch(err => {
  console.error("\n❌ Erro:", err.message);
  process.exit(1);
});