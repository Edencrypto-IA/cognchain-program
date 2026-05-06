import {
  Connection, Keypair, SystemProgram, Transaction,
  sendAndConfirmTransaction, LAMPORTS_PER_SOL, PublicKey,
} from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.solana.com';

// ─── Singleton connection ─────────────────────────────────────────────────────
let _conn: Connection | null = null;
function getConnection(): Connection {
  if (!_conn) _conn = new Connection(DEVNET_RPC, 'confirmed');
  return _conn;
}

// ─── Agent keypair ────────────────────────────────────────────────────────────
let _keypair: Keypair | null = null;
export function getAgentKeypair(): Keypair {
  if (_keypair) return _keypair;
  const raw = process.env.CONGCHAIN_AGENT_KEYPAIR;
  if (raw) {
    try { _keypair = Keypair.fromSecretKey(Buffer.from(raw, 'base64')); return _keypair; } catch { /* fall through */ }
  }
  // Deterministic demo keypair derived from a fixed seed
  const seed = Buffer.alloc(32);
  seed.write('congchain-demo-agent-v1', 0, 'utf8');
  _keypair = Keypair.fromSeed(seed);
  return _keypair;
}

export function getAgentPublicKey(): string {
  return getAgentKeypair().publicKey.toBase58();
}

// ─── Wallet balance ───────────────────────────────────────────────────────────
export async function getAgentBalance(): Promise<number> {
  try {
    const conn = getConnection();
    const lamports = await conn.getBalance(getAgentKeypair().publicKey);
    return lamports / LAMPORTS_PER_SOL;
  } catch { return 0; }
}

// ─── Request devnet airdrop if balance is low ─────────────────────────────────
export async function ensureDevnetBalance(minSol = 0.1): Promise<boolean> {
  try {
    const balance = await getAgentBalance();
    if (balance >= minSol) return true;
    const conn = getConnection();
    const sig = await conn.requestAirdrop(getAgentKeypair().publicKey, 1 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, 'confirmed');
    return true;
  } catch { return false; }
}

// ─── Pay: transfer SOL and record proof ──────────────────────────────────────

export interface PayResult {
  success: boolean;
  txHash?: string;
  simulated: boolean;
  fromWallet: string;
  toWallet: string;
  amountSol: number;
  explorerUrl?: string;
  error?: string;
}

const CONGCHAIN_TREASURY = '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs';

export async function payForApi(amountSol: number): Promise<PayResult> {
  const keypair = getAgentKeypair();
  const fromWallet = keypair.publicKey.toBase58();
  const toWallet = CONGCHAIN_TREASURY;

  // If no real keypair configured, run in simulation mode
  if (!process.env.CONGCHAIN_AGENT_KEYPAIR) {
    return {
      success: true, simulated: true,
      fromWallet, toWallet, amountSol,
      txHash: 'sim_' + Math.random().toString(16).slice(2, 18),
    };
  }

  try {
    await ensureDevnetBalance(amountSol + 0.005);
    const conn = getConnection();
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(toWallet),
        lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
      })
    );
    const txHash = await sendAndConfirmTransaction(conn, transaction, [keypair]);
    return {
      success: true, simulated: false,
      fromWallet, toWallet, amountSol, txHash,
      explorerUrl: `https://explorer.solana.com/tx/${txHash}?cluster=devnet`,
    };
  } catch (err) {
    return {
      success: false, simulated: true,
      fromWallet, toWallet, amountSol,
      error: String(err),
      txHash: 'sim_' + Math.random().toString(16).slice(2, 18),
    };
  }
}
