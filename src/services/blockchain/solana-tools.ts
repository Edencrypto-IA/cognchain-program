/**
 * Solana Tools — read-only data fetchers + human-gated transaction execution
 *
 * Security model:
 *  - All read operations are fire-and-forget, zero signing
 *  - Write operations go through SolanaIntent queue (human approval required)
 *  - Caps: MAX 0.5 SOL per swap, 0.1 SOL per transfer, 5 intents/hour
 *  - Whitelist: Jupiter V6 only for swaps; native SystemProgram for transfers
 *  - Every intent is simulated before shown to the user
 *  - Intents expire after 10 minutes if not approved
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
} from '@solana/web3.js';
import { db } from '@/lib/db';

// ── Constants ─────────────────────────────────────────────────────────────────

const SOLANA_RPC   = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const WALLET_PUBKEY = process.env.SOLANA_PUBLIC_KEY || '';

const MAX_SWAP_SOL     = 0.5;
const MAX_TRANSFER_SOL = 0.1;
const MAX_INTENTS_PER_HOUR = 5;
const INTENT_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// Well-known token mints (devnet mirrors use same addresses for simulation)
export const TOKEN_MINTS: Record<string, string> = {
  SOL:   'So11111111111111111111111111111111111111112',
  USDC:  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT:  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK:  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP:   'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
};

// CoinGecko IDs for price lookup (free tier, no API key)
const COINGECKO_IDS: Record<string, string> = {
  SOL:  'solana',
  USDC: 'usd-coin',
  USDT: 'tether',
  BONK: 'bonk',
  JUP:  'jupiter-exchange-solana',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadKeypair(): Keypair {
  const key = process.env.SOLANA_PRIVATE_KEY;
  if (!key) throw new Error('SOLANA_PRIVATE_KEY not configured');
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(key)));
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(tid);
  }
}

// ── Read-only tools ───────────────────────────────────────────────────────────

export interface WalletBalance {
  sol: number;
  solUsd: number | null;
  address: string;
  network: string;
}

export async function getWalletBalance(): Promise<WalletBalance> {
  const conn = new Connection(SOLANA_RPC, 'confirmed');
  const pubkey = new PublicKey(WALLET_PUBKEY);
  const lamports = await conn.getBalance(pubkey);
  const sol = lamports / LAMPORTS_PER_SOL;

  let solUsd: number | null = null;
  try {
    const priceData = await fetchJson<{ solana?: { usd: number } }>(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
    );
    solUsd = priceData?.solana?.usd ? sol * priceData.solana.usd : null;
  } catch { /* price feed unavailable */ }

  return { sol, solUsd, address: WALLET_PUBKEY, network: 'devnet' };
}

export interface TokenPrice {
  symbol: string;
  mint: string;
  price: number;
  change24h?: number;
}

export async function getTokenPrices(symbols: string[] = ['SOL', 'USDC', 'BONK', 'JUP']): Promise<TokenPrice[]> {
  const upper   = symbols.map(s => s.toUpperCase()).filter(s => COINGECKO_IDS[s]);
  const cgIds   = upper.map(s => COINGECKO_IDS[s]).join(',');
  if (!cgIds) return [];

  try {
    const data = await fetchJson<Record<string, { usd: number }>>(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds}&vs_currencies=usd`
    );

    return upper.map(s => ({
      symbol: s,
      mint:  TOKEN_MINTS[s] ?? '',
      price: data[COINGECKO_IDS[s]]?.usd ?? 0,
    })).filter(t => t.price > 0);
  } catch {
    return [];
  }
}

export interface RecentTx {
  signature: string;
  slot: number;
  blockTime: number | null | undefined;
  err: boolean;
}

export async function getRecentTransactions(limit = 5): Promise<RecentTx[]> {
  try {
    const conn = new Connection(SOLANA_RPC, 'confirmed');
    const pubkey = new PublicKey(WALLET_PUBKEY);
    const sigs = await conn.getSignaturesForAddress(pubkey, { limit });
    return sigs.map(s => ({
      signature: s.signature,
      slot: s.slot,
      blockTime: s.blockTime,
      err: !!s.err,
    }));
  } catch {
    return [];
  }
}

export interface SolanaSnapshot {
  wallet: WalletBalance;
  prices: TokenPrice[];
  recentTxs: RecentTx[];
  timestamp: number;
}

export async function getSolanaSnapshot(): Promise<SolanaSnapshot> {
  const [wallet, prices, recentTxs] = await Promise.allSettled([
    getWalletBalance(),
    getTokenPrices(),
    getRecentTransactions(3),
  ]);

  return {
    wallet: wallet.status === 'fulfilled' ? wallet.value : { sol: 0, solUsd: null, address: WALLET_PUBKEY, network: 'devnet' },
    prices: prices.status === 'fulfilled' ? prices.value : [],
    recentTxs: recentTxs.status === 'fulfilled' ? recentTxs.value : [],
    timestamp: Date.now(),
  };
}

// ── Intent queue (human-gated) ────────────────────────────────────────────────

export interface IntentValidationResult {
  valid: boolean;
  reason?: string;
  simulation?: { success: boolean; fee: number; logs?: string[]; error?: string };
}

async function checkIntentRateLimit(agentId: string): Promise<boolean> {
  const since = new Date(Date.now() - 3600_000);
  const count = await db.solanaIntent.count({
    where: { agentId, createdAt: { gte: since } },
  });
  return count < MAX_INTENTS_PER_HOUR;
}

async function checkDuplicateIntent(agentId: string, type: string, fromToken: string, toToken: string | null, amount: number): Promise<boolean> {
  const since = new Date(Date.now() - 60_000); // last 60s
  const existing = await db.solanaIntent.findFirst({
    where: { agentId, type, fromToken, toToken: toToken ?? undefined, status: 'pending', createdAt: { gte: since } },
  });
  return !existing;
}

async function simulateSwap(fromMint: string, toMint: string, _amountLamports: number): Promise<{ success: boolean; fee: number; logs?: string[]; error?: string }> {
  try {
    // Verify route exists via Jupiter quote API
    const quote = await fetchJson<{ routePlan?: unknown; error?: string }>(
      `https://quote-api.jup.ag/v6/quote?inputMint=${fromMint}&outputMint=${toMint}&amount=${_amountLamports}&slippageBps=100&onlyDirectRoutes=false`
    );
    if (quote.error) return { success: false, fee: 0, error: quote.error };
    return { success: true, fee: 5000, logs: ['Route verified via Jupiter V6'] };
  } catch (e) {
    return { success: false, fee: 0, error: String(e) };
  }
}

async function simulateTransfer(toAddress: string, lamports: number): Promise<{ success: boolean; fee: number; error?: string }> {
  try {
    const conn = new Connection(SOLANA_RPC, 'confirmed');
    const payer = loadKeypair();
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: new PublicKey(toAddress), lamports })
    );
    tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
    tx.feePayer = payer.publicKey;
    tx.sign(payer);
    const sim = await conn.simulateTransaction(tx);
    return { success: !sim.value.err, fee: 5000, error: sim.value.err ? JSON.stringify(sim.value.err) : undefined };
  } catch (e) {
    return { success: false, fee: 0, error: String(e) };
  }
}

export async function createSwapIntent(
  agentId: string,
  fromToken: string,
  toToken: string,
  amountSol: number,
  description: string,
): Promise<{ ok: boolean; intentId?: string; reason?: string }> {
  // Security checks
  if (amountSol > MAX_SWAP_SOL)
    return { ok: false, reason: `Amount exceeds max swap cap (${MAX_SWAP_SOL} SOL)` };
  if (!TOKEN_MINTS[fromToken.toUpperCase()] || !TOKEN_MINTS[toToken.toUpperCase()])
    return { ok: false, reason: 'Unknown token — only SOL, USDC, USDT, BONK, JUP allowed' };
  if (!(await checkIntentRateLimit(agentId)))
    return { ok: false, reason: 'Rate limit: max 5 intents per hour reached' };
  if (!(await checkDuplicateIntent(agentId, 'swap', fromToken, toToken, amountSol)))
    return { ok: false, reason: 'Duplicate intent already pending' };

  const fromMint = TOKEN_MINTS[fromToken.toUpperCase()];
  const toMint   = TOKEN_MINTS[toToken.toUpperCase()];
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  const simulation = await simulateSwap(fromMint, toMint, lamports);

  // Estimate USD value
  let amountUsd: number | null = null;
  try {
    const prices = await getTokenPrices([fromToken]);
    amountUsd = prices[0] ? amountSol * prices[0].price : null;
  } catch { /* not critical */ }

  const intent = await db.solanaIntent.create({
    data: {
      agentId,
      type: 'swap',
      description,
      fromToken: fromToken.toUpperCase(),
      toToken: toToken.toUpperCase(),
      amount: amountSol,
      amountUsd,
      simulation: JSON.stringify(simulation),
      status: 'pending',
      expiresAt: new Date(Date.now() + INTENT_EXPIRY_MS),
    },
  });

  return { ok: true, intentId: intent.id };
}

export async function createTransferIntent(
  agentId: string,
  toAddress: string,
  amountSol: number,
  description: string,
): Promise<{ ok: boolean; intentId?: string; reason?: string }> {
  if (amountSol > MAX_TRANSFER_SOL)
    return { ok: false, reason: `Amount exceeds max transfer cap (${MAX_TRANSFER_SOL} SOL)` };
  if (!(await checkIntentRateLimit(agentId)))
    return { ok: false, reason: 'Rate limit: max 5 intents per hour reached' };

  // Validate address
  try { new PublicKey(toAddress); } catch {
    return { ok: false, reason: 'Invalid Solana address' };
  }

  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
  const simulation = await simulateTransfer(toAddress, lamports);

  const intent = await db.solanaIntent.create({
    data: {
      agentId,
      type: 'transfer',
      description,
      fromToken: 'SOL',
      toToken: toAddress,
      amount: amountSol,
      simulation: JSON.stringify(simulation),
      status: 'pending',
      expiresAt: new Date(Date.now() + INTENT_EXPIRY_MS),
    },
  });

  return { ok: true, intentId: intent.id };
}

// ── Execution (runs ONLY after human approval) ────────────────────────────────

async function executeSwap(fromToken: string, toToken: string, amountSol: number): Promise<{ txHash: string }> {
  const keypair  = loadKeypair();
  const fromMint = TOKEN_MINTS[fromToken];
  const toMint   = TOKEN_MINTS[toToken];
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  // 1. Get quote
  const quote = await fetchJson<Record<string, unknown>>(
    `https://quote-api.jup.ag/v6/quote?inputMint=${fromMint}&outputMint=${toMint}&amount=${lamports}&slippageBps=100`
  );

  // 2. Get swap transaction
  const swapResp = await fetchJson<{ swapTransaction: string }>(
    'https://quote-api.jup.ag/v6/swap',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteResponse: quote, userPublicKey: keypair.publicKey.toString() }),
    }
  );

  // 3. Deserialize, sign, send
  const txBuf = Buffer.from(swapResp.swapTransaction, 'base64');
  const tx = VersionedTransaction.deserialize(txBuf);
  tx.sign([keypair]);

  const conn = new Connection(SOLANA_RPC, 'confirmed');
  const txHash = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  await conn.confirmTransaction({ signature: txHash, blockhash, lastValidBlockHeight }, 'confirmed');
  return { txHash };
}

async function executeTransfer(toAddress: string, amountSol: number): Promise<{ txHash: string }> {
  const keypair = loadKeypair();
  const conn    = new Connection(SOLANA_RPC, 'confirmed');
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();

  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey: new PublicKey(toAddress), lamports })
  );
  tx.recentBlockhash = blockhash;
  tx.feePayer = keypair.publicKey;
  tx.sign(keypair);

  const txHash = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await conn.confirmTransaction({ signature: txHash, blockhash, lastValidBlockHeight }, 'confirmed');
  return { txHash };
}

export async function executeApprovedIntent(intentId: string): Promise<{ ok: boolean; txHash?: string; error?: string }> {
  const intent = await db.solanaIntent.findUnique({ where: { id: intentId } });
  if (!intent) return { ok: false, error: 'Intent not found' };
  if (intent.status !== 'approved') return { ok: false, error: 'Intent is not in approved state' };
  if (new Date() > intent.expiresAt) {
    await db.solanaIntent.update({ where: { id: intentId }, data: { status: 'expired' } });
    return { ok: false, error: 'Intent expired' };
  }

  // Mark as executing
  await db.solanaIntent.update({ where: { id: intentId }, data: { status: 'executed' } });

  try {
    let txHash: string;
    if (intent.type === 'swap') {
      const res = await executeSwap(intent.fromToken, intent.toToken!, intent.amount);
      txHash = res.txHash;
    } else {
      const res = await executeTransfer(intent.toToken!, intent.amount);
      txHash = res.txHash;
    }

    await db.solanaIntent.update({
      where: { id: intentId },
      data: { txHash, executedAt: new Date() },
    });

    return { ok: true, txHash };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.solanaIntent.update({ where: { id: intentId }, data: { status: 'failed', error } });
    return { ok: false, error };
  }
}

// ── Expire stale intents (call periodically) ──────────────────────────────────

export async function expireStaleIntents(): Promise<number> {
  const result = await db.solanaIntent.updateMany({
    where: { status: 'pending', expiresAt: { lt: new Date() } },
    data:  { status: 'expired' },
  });
  return result.count;
}
