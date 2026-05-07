/**
 * Intelligent multi-source price router
 * Sources: CoinGecko · Binance · Bybit · OKX · Crypto.com
 * Strategy: fetch all in parallel → median price → highest confidence
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenPrice {
  token: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  sources: string[];      // e.g. ['CoinGecko', 'Bybit', 'OKX']
  confidence: number;     // 1–5 (how many sources agreed)
}

interface RawQuote {
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

// ─── Symbol mappings per exchange ─────────────────────────────────────────────

const BINANCE_SYMBOL: Record<string, string> = {
  SOL: 'SOLUSDT', BTC: 'BTCUSDT', ETH: 'ETHUSDT',
  BONK: 'BONKUSDT', JTO: 'JTOUSDT', JUP: 'JUPUSDT',
  RAY: 'RAYUSDT', PYTH: 'PYTHUSDT', W: 'WUSDT',
  WIF: 'WIFUSDT', POPCAT: 'POPCATUSDT',
};

const BYBIT_SYMBOL: Record<string, string> = {
  SOL: 'SOLUSDT', BTC: 'BTCUSDT', ETH: 'ETHUSDT',
  BONK: 'BONKUSDT', JTO: 'JTOUSDT', JUP: 'JUPUSDT',
  RAY: 'RAYUSDT', PYTH: 'PYTHUSDT', W: 'WUSDT',
  WIF: 'WIFUSDT', POPCAT: 'POPCATUSDT',
};

const OKX_SYMBOL: Record<string, string> = {
  SOL: 'SOL-USDT', BTC: 'BTC-USDT', ETH: 'ETH-USDT',
  BONK: 'BONK-USDT', JTO: 'JTO-USDT', JUP: 'JUP-USDT',
  RAY: 'RAY-USDT', PYTH: 'PYTH-USDT', W: 'W-USDT',
  WIF: 'WIF-USDT', POPCAT: 'POPCAT-USDT',
};

const CRYPTOCOM_SYMBOL: Record<string, string> = {
  SOL: 'SOL_USDT', BTC: 'BTC_USDT', ETH: 'ETH_USDT',
  BONK: 'BONK_USDT', JTO: 'JTO_USDT', JUP: 'JUP_USDT',
  RAY: 'RAY_USDT', W: 'W_USDT', WIF: 'WIF_USDT',
};

const COINGECKO_ID: Record<string, string> = {
  SOL: 'solana', BTC: 'bitcoin', ETH: 'ethereum',
  BONK: 'bonk', PENGU: 'penguin', JTO: 'jito-governance',
  JUP: 'jupiter-exchange-solana', RAY: 'raydium',
  PYTH: 'pyth-network', W: 'wormhole', WIF: 'dogwifcoin',
  POPCAT: 'popcat',
};

// ─── Safe fetch ───────────────────────────────────────────────────────────────

async function safeFetch<T>(url: string, timeoutMs = 5000): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!r.ok) return null;
    return r.json() as Promise<T>;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ─── Per-source fetchers ──────────────────────────────────────────────────────

async function fromCoinGecko(tokens: string[]): Promise<Map<string, RawQuote>> {
  const ids = tokens.map(t => COINGECKO_ID[t]).filter(Boolean).join(',');
  if (!ids) return new Map();

  type CGResp = Record<string, { usd: number; usd_24h_change: number; usd_24h_vol: number }>;
  const data = await safeFetch<CGResp>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`
  );
  const result = new Map<string, RawQuote>();
  if (!data) return result;

  for (const token of tokens) {
    const id = COINGECKO_ID[token];
    const d = id ? data[id] : undefined;
    if (d?.usd) {
      result.set(token, {
        price: d.usd,
        change24h: d.usd_24h_change ?? 0,
        volume24h: d.usd_24h_vol ?? 0,
        high24h: d.usd * (1 + Math.max(0, d.usd_24h_change ?? 0) / 100 + 0.01),
        low24h: d.usd * (1 - Math.max(0, -(d.usd_24h_change ?? 0)) / 100 - 0.01),
      });
    }
  }
  return result;
}

async function fromBinance(tokens: string[]): Promise<Map<string, RawQuote>> {
  const result = new Map<string, RawQuote>();
  type BResp = { lastPrice: string; priceChangePercent: string; quoteVolume: string; highPrice: string; lowPrice: string };

  await Promise.allSettled(
    tokens.map(async token => {
      const sym = BINANCE_SYMBOL[token];
      if (!sym) return;
      const d = await safeFetch<BResp>(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`);
      if (d?.lastPrice) {
        result.set(token, {
          price: parseFloat(d.lastPrice),
          change24h: parseFloat(d.priceChangePercent ?? '0'),
          volume24h: parseFloat(d.quoteVolume ?? '0'),
          high24h: parseFloat(d.highPrice ?? d.lastPrice),
          low24h: parseFloat(d.lowPrice ?? d.lastPrice),
        });
      }
    })
  );
  return result;
}

async function fromBybit(tokens: string[]): Promise<Map<string, RawQuote>> {
  const result = new Map<string, RawQuote>();
  type BybitResp = { retCode: number; result: { list: { symbol: string; lastPrice: string; price24hPcnt: string; volume24h: string; highPrice24h: string; lowPrice24h: string }[] } };

  await Promise.allSettled(
    tokens.map(async token => {
      const sym = BYBIT_SYMBOL[token];
      if (!sym) return;
      const d = await safeFetch<BybitResp>(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${sym}`);
      const item = d?.result?.list?.[0];
      if (item?.lastPrice) {
        result.set(token, {
          price: parseFloat(item.lastPrice),
          change24h: parseFloat(item.price24hPcnt ?? '0') * 100,
          volume24h: parseFloat(item.volume24h ?? '0'),
          high24h: parseFloat(item.highPrice24h ?? item.lastPrice),
          low24h: parseFloat(item.lowPrice24h ?? item.lastPrice),
        });
      }
    })
  );
  return result;
}

async function fromOKX(tokens: string[]): Promise<Map<string, RawQuote>> {
  const result = new Map<string, RawQuote>();
  type OKXResp = { code: string; data: { last: string; chg: string; volCcy24h: string; high24h: string; low24h: string; open24h: string }[] };

  await Promise.allSettled(
    tokens.map(async token => {
      const sym = OKX_SYMBOL[token];
      if (!sym) return;
      const d = await safeFetch<OKXResp>(`https://www.okx.com/api/v5/market/ticker?instId=${sym}`);
      const item = d?.data?.[0];
      if (item?.last) {
        const price = parseFloat(item.last);
        const open = parseFloat(item.open24h ?? item.last);
        result.set(token, {
          price,
          change24h: open ? ((price - open) / open) * 100 : 0,
          volume24h: parseFloat(item.volCcy24h ?? '0'),
          high24h: parseFloat(item.high24h ?? item.last),
          low24h: parseFloat(item.low24h ?? item.last),
        });
      }
    })
  );
  return result;
}

async function fromCryptoCom(tokens: string[]): Promise<Map<string, RawQuote>> {
  const result = new Map<string, RawQuote>();
  type CCResp = { result: { data: { a: string[]; b: string[]; k: string[]; c: string[]; h: string[]; l: string[]; v: string[] } } };

  await Promise.allSettled(
    tokens.map(async token => {
      const sym = CRYPTOCOM_SYMBOL[token];
      if (!sym) return;
      const d = await safeFetch<CCResp>(`https://api.crypto.com/v2/public/get-ticker?instrument_name=${sym}`);
      const data = d?.result?.data;
      if (data?.a?.[0]) {
        const price = parseFloat(data.a[0]);
        const open = parseFloat(data.k?.[0] ?? data.a[0]);
        result.set(token, {
          price,
          change24h: open ? ((price - open) / open) * 100 : 0,
          volume24h: parseFloat(data.v?.[0] ?? '0') * price,
          high24h: parseFloat(data.h?.[0] ?? data.a[0]),
          low24h: parseFloat(data.l?.[0] ?? data.a[0]),
        });
      }
    })
  );
  return result;
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const SOURCE_NAMES = ['CoinGecko', 'Binance', 'Bybit', 'OKX', 'Crypto.com'] as const;

function aggregate(
  token: string,
  maps: [Map<string, RawQuote>, ...Map<string, RawQuote>[]],
  names: string[]
): TokenPrice | null {
  const quotes: { name: string; quote: RawQuote }[] = [];
  maps.forEach((m, i) => {
    const q = m.get(token);
    if (q && q.price > 0 && isFinite(q.price)) {
      quotes.push({ name: names[i], quote: q });
    }
  });
  if (quotes.length === 0) return null;

  // Outlier filter: remove prices >10% away from median
  const prices = quotes.map(q => q.quote.price);
  const med = median(prices);
  const filtered = quotes.filter(q => Math.abs(q.quote.price - med) / med < 0.10);
  const final = filtered.length > 0 ? filtered : quotes;

  return {
    token,
    price: median(final.map(q => q.quote.price)),
    change24h: median(final.map(q => q.quote.change24h)),
    volume24h: Math.max(...final.map(q => q.quote.volume24h)),
    high24h: Math.max(...final.map(q => q.quote.high24h)),
    low24h: Math.min(...final.map(q => q.quote.low24h)),
    sources: final.map(q => q.name),
    confidence: final.length,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getMultiSourcePrices(tokens: string[]): Promise<TokenPrice[]> {
  // Fetch all sources in parallel
  const [cgMap, binanceMap, bybitMap, okxMap, ccMap] = await Promise.all([
    fromCoinGecko(tokens),
    fromBinance(tokens),
    fromBybit(tokens),
    fromOKX(tokens),
    fromCryptoCom(tokens),
  ]);

  const results: TokenPrice[] = [];
  for (const token of tokens) {
    const agg = aggregate(token, [cgMap, binanceMap, bybitMap, okxMap, ccMap], [...SOURCE_NAMES]);
    if (agg) results.push(agg);
  }

  return results;
}

export type { RawQuote };
