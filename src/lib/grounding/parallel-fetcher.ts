import type { RawSource } from './types';

const TIMEOUT_MS = 5000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);
}

async function safeFetch(url: string, opts?: RequestInit): Promise<unknown> {
  const res = await withTimeout(fetch(url, opts), TIMEOUT_MS);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** CoinGecko free API — no key needed */
async function fetchCoinGecko(coinId: string): Promise<RawSource[]> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_market_cap=true&include_24hr_change=true`;
  const data = await safeFetch(url) as Record<string, Record<string, number>>;
  const coin = data[coinId];
  if (!coin) return [];
  return [
    { name: 'CoinGecko', url: `https://www.coingecko.com/en/coins/${coinId}`, value: coin.usd, fromApi: true },
    { name: 'CoinGecko Market Cap', url: `https://www.coingecko.com/en/coins/${coinId}`, value: coin.usd_market_cap, fromApi: true },
  ];
}

/** DefiLlama — open API, no key */
async function fetchDefiLlama(protocol: string): Promise<RawSource[]> {
  const url = `https://api.llama.fi/protocol/${protocol}`;
  const data = await safeFetch(url) as { tvl?: number; name?: string };
  if (!data.tvl) return [];
  return [
    { name: 'DefiLlama', url: `https://defillama.com/protocol/${protocol}`, value: data.tvl, fromApi: true },
  ];
}

/** Helius mainnet token price */
async function fetchHelius(mint: string): Promise<RawSource[]> {
  const key = process.env.HELIUS_API_KEY ?? '';
  if (!key) return [];
  const url = `https://mainnet.helius-rpc.com/?api-key=${key}`;
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenSupply', params: [mint] });
  const data = await safeFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }) as { result?: { value?: { uiAmount?: number } } };
  const amount = data?.result?.value?.uiAmount;
  if (!amount) return [];
  return [{ name: 'Helius RPC', url: 'https://helius.xyz', value: amount, fromApi: true }];
}

/** Main fetcher — runs all sources in parallel for a query */
export async function fetchSourcesForQuery(query: string): Promise<RawSource[]> {
  const q = query.toLowerCase();
  const tasks: Promise<RawSource[]>[] = [];

  // Detect relevant coins
  if (q.includes('sol') || q.includes('solana')) tasks.push(fetchCoinGecko('solana').catch(() => []));
  if (q.includes('bonk')) tasks.push(fetchCoinGecko('bonk').catch(() => []));
  if (q.includes('jup') || q.includes('jupiter')) tasks.push(fetchCoinGecko('jupiter-exchange-solana').catch(() => []));
  if (q.includes('ray') || q.includes('raydium')) tasks.push(fetchCoinGecko('raydium').catch(() => []));
  if (q.includes('tvl') || q.includes('defi')) tasks.push(fetchDefiLlama('raydium').catch(() => []));
  if (q.includes('supply') || q.includes('mint')) {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    tasks.push(fetchHelius(SOL_MINT).catch(() => []));
  }

  if (tasks.length === 0) return [];

  const results = await Promise.allSettled(tasks);
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}
