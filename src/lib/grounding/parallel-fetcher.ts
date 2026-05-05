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

// ─── EXISTING: CoinGecko ─────────────────────────────────────────────────────

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

// ─── EXISTING: DefiLlama ─────────────────────────────────────────────────────

/** DefiLlama — open API, no key */
async function fetchDefiLlama(protocol: string): Promise<RawSource[]> {
  const url = `https://api.llama.fi/protocol/${protocol}`;
  const data = await safeFetch(url) as { tvl?: number; name?: string };
  if (!data.tvl) return [];
  return [
    { name: 'DefiLlama', url: `https://defillama.com/protocol/${protocol}`, value: data.tvl, fromApi: true },
  ];
}

// ─── EXISTING: Helius ────────────────────────────────────────────────────────

/** Extract Helius API key from env (supports both HELIUS_API_KEY and embedded in SOLANA_RPC_URL) */
function getHeliusKey(): string {
  if (process.env.HELIUS_API_KEY) return process.env.HELIUS_API_KEY;
  const rpc = process.env.SOLANA_RPC_URL ?? '';
  const match = rpc.match(/api-key=([a-f0-9-]+)/i);
  return match?.[1] ?? '';
}

/** Helius mainnet token supply */
async function fetchHelius(mint: string): Promise<RawSource[]> {
  const key = getHeliusKey();
  if (!key) return [];
  const url = `https://mainnet.helius-rpc.com/?api-key=${key}`;
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenSupply', params: [mint] });
  const data = await safeFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }) as { result?: { value?: { uiAmount?: number } } };
  const amount = data?.result?.value?.uiAmount;
  if (!amount) return [];
  return [{ name: 'Helius RPC', url: 'https://helius.xyz', value: amount, fromApi: true }];
}

// ─── NEW: CoinMarketCap ───────────────────────────────────────────────────────

type CmcQuote = { price: number; market_cap: number; volume_24h: number; percent_change_24h: number };
type CmcData  = Record<string, { name: string; symbol: string; quote: { USD: CmcQuote } }>;
type CmcResponse = { data?: CmcData };

/** CoinMarketCap Pro API — requires COINMARKETCAP_API_KEY */
async function fetchCoinMarketCap(symbols: string): Promise<RawSource[]> {
  const key = process.env.COINMARKETCAP_API_KEY ?? '';
  if (!key) return [];
  const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbols}`;
  const data = await safeFetch(url, {
    headers: { 'X-CMC_PRO_API_KEY': key, Accept: 'application/json' },
  }) as CmcResponse;

  const results: RawSource[] = [];
  for (const coin of Object.values(data.data ?? {})) {
    const q = coin.quote.USD;
    const pageUrl = `https://coinmarketcap.com/currencies/${coin.name.toLowerCase().replace(/\s+/g, '-')}/`;
    results.push(
      { name: `CoinMarketCap (${coin.symbol})`,     url: pageUrl, value: q.price,           fromApi: true },
      { name: `CoinMarketCap MCap (${coin.symbol})`, url: pageUrl, value: q.market_cap,      fromApi: true },
      { name: `CoinMarketCap 24h (${coin.symbol})`,  url: pageUrl, value: q.percent_change_24h, fromApi: true },
    );
  }
  return results;
}

// ─── NEW: SolanaFM ────────────────────────────────────────────────────────────

type SolanaFmToken = { name?: string; symbol?: string; price?: number; holders?: number };
type SolanaFmResponse = { tokenList?: SolanaFmToken[] };

const SOLANAFM_MINTS: Record<string, string> = {
  sol:  'So11111111111111111111111111111111111111112',
  bonk: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  jto:  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2HsUe8y',
  jup:  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  ray:  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
};

/** SolanaFM token info */
async function fetchSolanaFM(symbol: string): Promise<RawSource[]> {
  const mint = SOLANAFM_MINTS[symbol.toLowerCase()];
  if (!mint) return [];
  const url = `https://api.solana.fm/v0/tokens/${mint}`;
  const data = await safeFetch(url, {
    headers: { Accept: 'application/json' },
  }) as SolanaFmResponse;

  const token = data.tokenList?.[0];
  if (!token) return [];
  const pageUrl = `https://solana.fm/address/${mint}`;
  const results: RawSource[] = [];
  if (token.price)   results.push({ name: `SolanaFM (${token.symbol ?? symbol})`, url: pageUrl, value: token.price,   fromApi: true });
  if (token.holders) results.push({ name: `SolanaFM Holders`,                     url: pageUrl, value: token.holders, fromApi: true });
  return results;
}

// ─── NEW: Web Search (DuckDuckGo HTML fallback) ───────────────────────────────

type WebResult = { title: string; url: string; snippet: string };

/** Parse DuckDuckGo HTML response for result links and snippets */
function parseDDGResults(html: string): WebResult[] {
  const results: WebResult[] = [];
  const linkRx = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRx = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const snippets: string[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = snippetRx.exec(html)) !== null) {
    snippets.push(sm[1].replace(/<[^>]+>/g, '').trim());
  }
  let lm: RegExpExecArray | null;
  let idx = 0;
  while ((lm = linkRx.exec(html)) !== null && idx < 3) {
    results.push({
      url: lm[1],
      title: lm[2].replace(/<[^>]+>/g, '').trim(),
      snippet: snippets[idx] ?? '',
    });
    idx++;
  }
  return results;
}

/** DuckDuckGo HTML web search — no API key required */
async function fetchWebSearch(query: string): Promise<RawSource[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await withTimeout(
    fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CognChain/1.0)' } }),
    TIMEOUT_MS,
  );
  if (!res.ok) return [];
  // Wrap res.text() in timeout too — prevents hanging on large responses
  const html = await withTimeout(res.text() as Promise<string>, TIMEOUT_MS);
  const parsed = parseDDGResults(html);
  return parsed.map(r => ({
    name: r.title.slice(0, 60),
    url: r.url,
    value: r.snippet,
    fromApi: false,
  }));
}

// ─── MAIN ORCHESTRATOR ────────────────────────────────────────────────────────

/** Run all relevant sources in parallel for a query — extended version */
export async function fetchSourcesForQuery(query: string): Promise<RawSource[]> {
  const q = query.toLowerCase();
  const tasks: Promise<RawSource[]>[] = [];

  // ── Existing coin detection ─────────────────────────────────────────────────
  if (q.includes('sol') || q.includes('solana')) {
    tasks.push(fetchCoinGecko('solana').catch(() => []));
    tasks.push(fetchSolanaFM('sol').catch(() => []));
  }
  if (q.includes('bonk')) {
    tasks.push(fetchCoinGecko('bonk').catch(() => []));
    tasks.push(fetchSolanaFM('bonk').catch(() => []));
  }
  if (q.includes('jup') || q.includes('jupiter')) {
    tasks.push(fetchCoinGecko('jupiter-exchange-solana').catch(() => []));
    tasks.push(fetchSolanaFM('jup').catch(() => []));
  }
  if (q.includes('ray') || q.includes('raydium')) {
    tasks.push(fetchCoinGecko('raydium').catch(() => []));
    tasks.push(fetchSolanaFM('ray').catch(() => []));
    tasks.push(fetchDefiLlama('raydium').catch(() => []));
  }
  if (q.includes('jto') || q.includes('jito')) {
    tasks.push(fetchSolanaFM('jto').catch(() => []));
  }
  if (q.includes('tvl') || q.includes('defi')) {
    tasks.push(fetchDefiLlama('raydium').catch(() => []));
    tasks.push(fetchDefiLlama('orca').catch(() => []));
  }
  if (q.includes('supply') || q.includes('mint')) {
    tasks.push(fetchHelius('So11111111111111111111111111111111111111112').catch(() => []));
  }

  // ── NEW: CoinMarketCap (multi-coin) ─────────────────────────────────────────
  const cmcSymbols: string[] = [];
  if (q.includes('sol') || q.includes('solana')) cmcSymbols.push('SOL');
  if (q.includes('bonk'))                         cmcSymbols.push('BONK');
  if (q.includes('jup') || q.includes('jupiter')) cmcSymbols.push('JUP');
  if (q.includes('ray') || q.includes('raydium')) cmcSymbols.push('RAY');
  if (cmcSymbols.length > 0) {
    tasks.push(fetchCoinMarketCap(cmcSymbols.join(',')).catch(() => []));
  }

  // ── NEW: Web search — only for queries where APIs returned nothing ───────────
  // (avoids blocking the pipeline on DDG rate-limiting)
  if (tasks.length === 0 && q.length > 10) {
    tasks.push(fetchWebSearch(`${query} solana blockchain`).catch(() => []));
  }

  if (tasks.length === 0) return [];

  const results = await Promise.allSettled(tasks);
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}
