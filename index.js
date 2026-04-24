// index.js — CognChain Memory Engine
// Extrai memória de uma conversa e grava na Solana devnet

// FIX #0: Carrega variáveis de ambiente ANTES de tudo
require("dotenv").config();

const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const anchor = require("@coral-xyz/anchor");
const fs = require("fs");
const { extractMemory } = require("./extractor");
const { scoreMemory } = require("./scorer");
const { hashMemory } = require("./hasher");

// ── Config ──────────────────────────────────────────────

// FIX #6: RPC key movida para .env
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID || "7AHMKtvPuZ6yKdWtWD1kC6kgPkEgooeBBtrmUrVc2teU");
const RPC = process.env.RPC_URL || "https://api.devnet.solana.com";

// FIX #11: IDL importada do arquivo (elimina ~50 linhas duplicadas)
let IDL;
try {
  IDL = require("./idl.json");
} catch {
  console.error("❌ idl.json not found. Make sure it exists in the project root.");
  process.exit(1);
}

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
  // FIX #12: Validação do wallet.json antes de usar
  if (!fs.existsSync("./wallet.json")) {
    throw new Error("wallet.json not found. Create one with 'solana-keygen new' or place your keypair JSON.");
  }
  const walletData = JSON.parse(fs.readFileSync("./wallet.json"));
  if (!Array.isArray(walletData) || walletData.length !== 64) {
    throw new Error("Invalid wallet.json format. Expected a 64-byte JSON array.");
  }

  // 1. Carregar wallet
  const keypair = Keypair.fromSecretKey(Uint8Array.from(walletData));
  console.log("🔑 Wallet:", keypair.publicKey.toBase58());

  // 2. Conectar à Solana
  const connection = new Connection(RPC, "confirmed");
  const balance = await connection.getBalance(keypair.publicKey);
  console.log("💰 Balance:", balance / 1e9, "SOL");
  console.log("🌐 RPC:", RPC);

  if (balance < 0.01 * 1e9) {
    throw new Error("Saldo insuficiente. Faca airdrop em faucet.solana.com");
  }

  // 3. Configurar provider e programa
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new anchor.Program(IDL, PROGRAM_ID, provider);

  // 4. Extrair memória da conversa
  // FIX #13: extractMemory não é async — removido await desnecessário
  console.log("\n🧠 Extraindo memoria...");
  const extracted = extractMemory(TEST_CONVERSATION);
  console.log("  tipo:", extracted.type);
  console.log("  insight:", extracted.insight);
  console.log("  keywords:", extracted.keywords.join(", "));

  // 5. Pontuar importância
  const scored = scoreMemory(extracted);
  console.log("\n📊 Score:", scored.score, "bps | Aprovado:", scored.approved);
  if (!scored.approved) {
    console.log("⚠️  Memoria abaixo do threshold. Nao sera gravada.");
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
  // FIX #14: try/catch com erro mais descritivo
  let vaultAccount = null;
  try {
    vaultAccount = await program.account.vault.fetch(vaultPda);
    console.log("✅ Vault ja existe | records:", vaultAccount.recordCount);
  } catch (err) {
    console.log("🔨 Criando vault...");
    try {
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
    } catch (createErr) {
      console.error("❌ Falha ao criar vault:", createErr.message);
      throw createErr;
    }
  }

  // 9. Derivar record PDA
  const countBuf = Buffer.alloc(2);
  countBuf.writeUInt16LE(vaultAccount.recordCount);
  const [recordPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("record"), vaultPda.toBuffer(), countBuf],
    PROGRAM_ID
  );

  // 10. Gravar memória na Solana
  console.log("\n⛓️  Gravando memoria na Solana...");
  const importance = Math.min(scored.score, 10000);

  // FIX #15: try/catch na gravação
  try {
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

    console.log("\n🎉 MEMORIA GRAVADA NA SOLANA!");
    console.log("📝 Transacao:", tx);
    console.log("🔍 Explorer:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    console.log("💾 Record PDA:", recordPda.toBase58());
    console.log("📊 Importance:", importance, "bps");
  } catch (writeErr) {
    console.error("❌ Falha ao gravar memoria:", writeErr.message);
    throw writeErr;
  }
}

main().catch(err => {
  console.error("\n❌ Erro:", err.message);
  process.exit(1);
});