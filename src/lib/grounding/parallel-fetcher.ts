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

// ─── Jupiter Price API (Solana-native, no rate limit) ────────────────────────

const JUPITER_IDS: Record<string, string> = {
  solana: 'SOL',
  bonk:   'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  jup:    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  ray:    '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  pengu:  '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv',
};

type JupiterResponse = { data: Record<string, { price: number; mintSymbol?: string }> };

/** Jupiter Price API — Solana-native, no key, no rate limit */
async function fetchJupiter(symbol: string): Promise<RawSource[]> {
  const id = JUPITER_IDS[symbol.toLowerCase()];
  if (!id) return [];
  const url = `https://price.jup.ag/v6/price?ids=${id}`;
  const data = await safeFetch(url) as JupiterResponse;
  const entry = data?.data?.[id];
  if (!entry?.price) return [];
  return [{
    name: `Jupiter Price (${symbol.toUpperCase()})`,
    url: `https://jup.ag/swap/SOL-${id}`,
    value: entry.price,
    fromApi: true,
  }];
}

// ─── CoinGecko (fallback) ────────────────────────────────────────────────────

/** CoinGecko full market data — price, 24h high/low, volume, market cap, rank */
async function fetchCoinGecko(coinId: string): Promise<RawSource[]> {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`;
  type CoinData = {
    market_data?: {
      current_price?: { usd?: number };
      high_24h?: { usd?: number };
      low_24h?: { usd?: number };
      total_volume?: { usd?: number };
      market_cap?: { usd?: number };
      price_change_percentage_24h?: number;
      price_change_percentage_7d?: number;
      market_cap_rank?: number;
    };
    symbol?: string;
  };
  const data = await safeFetch(url) as CoinData;
  const m = data?.market_data;
  if (!m?.current_price?.usd) return [];
  const pageUrl = `https://www.coingecko.com/en/coins/${coinId}`;
  const sym = (data.symbol ?? coinId).toUpperCase();
  const results: RawSource[] = [
    { name: `Preço ${sym}`,         url: pageUrl, value: m.current_price.usd,           fromApi: true },
    { name: `Máxima 24h ${sym}`,    url: pageUrl, value: m.high_24h?.usd ?? null,        fromApi: true },
    { name: `Mínima 24h ${sym}`,    url: pageUrl, value: m.low_24h?.usd ?? null,         fromApi: true },
    { name: `Volume 24h ${sym}`,    url: pageUrl, value: m.total_volume?.usd ?? null,    fromApi: true },
    { name: `Market Cap ${sym}`,    url: pageUrl, value: m.market_cap?.usd ?? null,      fromApi: true },
    { name: `Variação 24h ${sym}`,  url: pageUrl, value: m.price_change_percentage_24h ?? null, fromApi: true },
    { name: `Variação 7d ${sym}`,   url: pageUrl, value: m.price_change_percentage_7d ?? null,  fromApi: true },
  ];
  return results.filter(r => r.value !== null && r.value !== undefined);
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

// ─── Exchange APIs (free, no key) ────────────────────────────────────────────

const EXCHANGE_SYMBOLS: Record<string, Record<string, string>> = {
  binance: { solana: 'SOLUSDT', bonk: 'BONKUSDT', jup: 'JUPUSDT', ray: 'RAYUSDT', pengu: 'PENGUUSDT' },
  bybit:   { solana: 'SOLUSDT', bonk: 'BONKUSDT', jup: 'JUPUSDT', ray: 'RAYUSDT', pengu: 'PENGUUSDT' },
  kraken:  { solana: 'SOLUSD',  bonk: 'BONKUSD' },
  okx:     { solana: 'SOL-USDT', bonk: 'BONK-USDT', jup: 'JUP-USDT', ray: 'RAY-USDT', pengu: 'PENGU-USDT' },
};

type BinanceTicker  = { price: string };
type BybitTicker    = { result: { list: Array<{ lastPrice: string; highPrice24h: string; lowPrice24h: string; volume24h: string }> } };
type KrakenTicker   = { result: Record<string, { c: [string] }> };
type OkxTicker      = { data: Array<{ last: string; high24h: string; low24h: string; vol24h: string }> };

async function fetchBinance(coin: string): Promise<RawSource[]> {
  const sym = EXCHANGE_SYMBOLS.binance[coin]; if (!sym) return [];
  const d = await safeFetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`) as BinanceTicker;
  if (!d?.price) return [];
  return [{ name: `Binance (${coin.toUpperCase()})`, url: 'https://www.binance.com', value: parseFloat(d.price), fromApi: true }];
}

async function fetchBybit(coin: string): Promise<RawSource[]> {
  const sym = EXCHANGE_SYMBOLS.bybit[coin]; if (!sym) return [];
  const d = await safeFetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${sym}`) as BybitTicker;
  const item = d?.result?.list?.[0]; if (!item) return [];
  return [
    { name: `Bybit (${coin.toUpperCase()})`,          url: 'https://www.bybit.com', value: parseFloat(item.lastPrice),    fromApi: true },
    { name: `Máxima 24h Bybit (${coin.toUpperCase()})`, url: 'https://www.bybit.com', value: parseFloat(item.highPrice24h), fromApi: true },
    { name: `Mínima 24h Bybit (${coin.toUpperCase()})`, url: 'https://www.bybit.com', value: parseFloat(item.lowPrice24h),  fromApi: true },
  ];
}

async function fetchKraken(coin: string): Promise<RawSource[]> {
  const sym = EXCHANGE_SYMBOLS.kraken[coin]; if (!sym) return [];
  const d = await safeFetch(`https://api.kraken.com/0/public/Ticker?pair=${sym}`) as KrakenTicker;
  const entry = d?.result ? Object.values(d.result)[0] : null; if (!entry) return [];
  return [{ name: `Kraken (${coin.toUpperCase()})`, url: 'https://www.kraken.com', value: parseFloat(entry.c[0]), fromApi: true }];
}

async function fetchOKX(coin: string): Promise<RawSource[]> {
  const sym = EXCHANGE_SYMBOLS.okx[coin]; if (!sym) return [];
  const d = await safeFetch(`https://www.okx.com/api/v5/market/ticker?instId=${sym}`) as OkxTicker;
  const item = d?.data?.[0]; if (!item) return [];
  return [{ name: `OKX (${coin.toUpperCase()})`, url: 'https://www.okx.com', value: parseFloat(item.last), fromApi: true }];
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

  // ── Price queries — all exchanges in parallel ──────────────────────────────
  if (q.includes('sol') || q.includes('solana')) {
    tasks.push(fetchJupiter('solana').catch(() => []));
    tasks.push(fetchCoinGecko('solana').catch(() => []));
    tasks.push(fetchBinance('solana').catch(() => []));
    tasks.push(fetchBybit('solana').catch(() => []));
    tasks.push(fetchKraken('solana').catch(() => []));
    tasks.push(fetchOKX('solana').catch(() => []));
  }
  if (q.includes('bonk')) {
    tasks.push(fetchJupiter('bonk').catch(() => []));
    tasks.push(fetchCoinGecko('bonk').catch(() => []));
    tasks.push(fetchBinance('bonk').catch(() => []));
    tasks.push(fetchBybit('bonk').catch(() => []));
    tasks.push(fetchOKX('bonk').catch(() => []));
  }
  if (q.includes('jup') || q.includes('jupiter')) {
    tasks.push(fetchJupiter('jup').catch(() => []));
    tasks.push(fetchCoinGecko('jupiter-exchange-solana').catch(() => []));
    tasks.push(fetchBinance('jup').catch(() => []));
    tasks.push(fetchOKX('jup').catch(() => []));
  }
  if (q.includes('ray') || q.includes('raydium')) {
    tasks.push(fetchJupiter('ray').catch(() => []));
    tasks.push(fetchCoinGecko('raydium').catch(() => []));
    tasks.push(fetchBinance('ray').catch(() => []));
    tasks.push(fetchOKX('ray').catch(() => []));
    tasks.push(fetchDefiLlama('raydium').catch(() => []));
  }
  if (q.includes('pengu') || q.includes('pudgy')) {
    tasks.push(fetchJupiter('pengu').catch(() => []));
    tasks.push(fetchCoinGecko('pudgy-penguins').catch(() => []));
    tasks.push(fetchBinance('pengu').catch(() => []));
    tasks.push(fetchBybit('pengu').catch(() => []));
    tasks.push(fetchOKX('pengu').catch(() => []));
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
