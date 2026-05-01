import { NextRequest, NextResponse } from 'next/server';

/**
 * RPC Proxy — forwards Solana JSON-RPC calls to Helius server-side.
 * The Helius API key never reaches the browser.
 *
 * Security:
 *  - API key lives in SOLANA_RPC_URL (server-only, no NEXT_PUBLIC_ prefix)
 *  - Method whitelist: only safe read + standard write methods allowed
 *  - Rate limit: 60 requests / minute per IP
 *  - Max body: 64 KB
 */

const HELIUS_RPC = process.env.SOLANA_RPC_URL ||
  'https://api.devnet.solana.com';

// Allowed JSON-RPC methods — blocks anything dangerous or irrelevant
const ALLOWED_METHODS = new Set([
  // Read — account / balance
  'getAccountInfo', 'getBalance', 'getMultipleAccounts', 'getProgramAccounts',
  'getTokenAccountBalance', 'getTokenAccountsByOwner', 'getTokenSupply',
  // Read — blocks / transactions
  'getBlock', 'getBlockHeight', 'getBlockTime', 'getBlocks',
  'getConfirmedBlock', 'getConfirmedTransaction',
  'getTransaction', 'getTransactionCount',
  'getSignaturesForAddress', 'getSignatureStatuses',
  // Read — cluster / fees
  'getClusterNodes', 'getEpochInfo', 'getEpochSchedule',
  'getFeeForMessage', 'getFirstAvailableBlock', 'getGenesisHash',
  'getHealth', 'getHighestSnapshotSlot', 'getIdentity',
  'getInflationGovernor', 'getInflationRate', 'getInflationReward',
  'getLargestAccounts', 'getLatestBlockhash', 'getLeaderSchedule',
  'getMinimumBalanceForRentExemption', 'getRecentBlockhash',
  'getRecentPerformanceSamples', 'getSlot', 'getSlotLeader',
  'getSupply', 'getVersion', 'getVoteAccounts',
  'isBlockhashValid', 'minimumLedgerSlot', 'simulateTransaction',
  // Write — send transactions (user-signed, wallet extension handles signing)
  'sendTransaction',
]);

// Simple in-memory rate limiter: 60 req/min per IP
const rateMap = new Map<string, { count: number; reset: number }>();

function checkRate(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (entry.count >= 60) return false;
  entry.count++;
  return true;
}

// Clean rate map periodically to avoid memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of rateMap) {
    if (now > e.reset) rateMap.delete(ip);
  }
}, 120_000);

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  if (!checkRate(ip)) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32005, message: 'Rate limit exceeded' }, id: null },
      { status: 429 }
    );
  }

  // Size guard
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > 65_536) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32600, message: 'Request too large' }, id: null },
      { status: 413 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null },
      { status: 400 }
    );
  }

  // Validate method whitelist (supports single and batch requests)
  const requests = Array.isArray(body) ? body : [body];
  for (const rpc of requests) {
    const method = (rpc as Record<string, unknown>)?.method as string;
    if (!method || !ALLOWED_METHODS.has(method)) {
      return NextResponse.json(
        { jsonrpc: '2.0', error: { code: -32601, message: `Method not allowed: ${method ?? 'unknown'}` }, id: null },
        { status: 403 }
      );
    }
  }

  // Forward to Helius
  try {
    const upstream = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upstream error';
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message }, id: null },
      { status: 502 }
    );
  }
}
