const COINGECKO_API = 'https://api.coingecko.com/api/v3';

export type MythosHeatmapTile = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  price: number | null;
  priceLabel: string;
  marketCap: number | null;
  marketCapLabel: string;
  volume24h: number | null;
  volume24hLabel: string;
  change24h: number | null;
  change24hLabel: string;
  rank: number | null;
  sampleDominance: number | null;
};

export type MythosMarketHeatmap = {
  ok: true;
  generatedAt: string;
  source: 'coingecko';
  title: string;
  summary: string;
  tiles: MythosHeatmapTile[];
  safety: {
    readOnlyMarketData: true;
    notFinancialAdvice: true;
    noTradeExecution: true;
    sources: string[];
  };
};

export type MythosTokenChartPoint = {
  time: string;
  price: number;
};

export type MythosTokenChart = {
  ok: true;
  generatedAt: string;
  source: 'coingecko';
  query: string;
  id: string;
  symbol: string;
  name: string;
  image?: string;
  price: number | null;
  priceLabel: string;
  marketCap: number | null;
  marketCapLabel: string;
  volume24h: number | null;
  volume24hLabel: string;
  change24h: number | null;
  change24hLabel: string;
  rank: number | null;
  days: number;
  points: MythosTokenChartPoint[];
  summary: string;
  safety: {
    readOnlyMarketData: true;
    notFinancialAdvice: true;
    noTradeExecution: true;
    sources: string[];
  };
};

type CoinGeckoMarketCoin = {
  id?: string;
  symbol?: string;
  name?: string;
  image?: string;
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  total_volume?: number;
  price_change_percentage_24h?: number;
};

type CoinGeckoSearch = {
  coins?: Array<{
    id?: string;
    name?: string;
    symbol?: string;
    market_cap_rank?: number;
    thumb?: string;
  }>;
};

type CoinGeckoChart = {
  prices?: Array<[number, number]>;
};

const KNOWN_COIN_IDS: Record<string, string> = {
  ada: 'cardano',
  avax: 'avalanche-2',
  bnb: 'binancecoin',
  bonk: 'bonk',
  btc: 'bitcoin',
  doge: 'dogecoin',
  eth: 'ethereum',
  link: 'chainlink',
  pengu: 'pudgy-penguins',
  pepe: 'pepe',
  sol: 'solana',
  solana: 'solana',
  sui: 'sui',
  ton: 'the-open-network',
  trump: 'official-trump',
  usdc: 'usd-coin',
  usdt: 'tether',
  wif: 'dogwifcoin',
  xrp: 'ripple',
};

function coingeckoHeaders() {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const demoKey = process.env.COINGECKO_API_KEY || process.env.COINGECKO_DEMO_API_KEY;
  const proKey = process.env.COINGECKO_PRO_API_KEY;
  if (proKey) headers['x-cg-pro-api-key'] = proKey;
  if (demoKey && !proKey) headers['x-cg-demo-api-key'] = demoKey;
  return headers;
}

async function safeFetchJson<T>(url: string, timeoutMs = 8500): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: coingeckoHeaders(),
      next: { revalidate: 90 },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function fmtUsd(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'unavailable';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  return `$${value.toLocaleString('en-US', { maximumSignificantDigits: 4 })}`;
}

function fmtPct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'unavailable';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function normalizeQuery(input: string) {
  return input.trim().replace(/^\$/, '').replace(/[^a-zA-Z0-9\-_\s]/g, '').trim().toLowerCase();
}

function toTile(coin: CoinGeckoMarketCoin, sampledMarketCap: number): MythosHeatmapTile {
  const marketCap = typeof coin.market_cap === 'number' ? coin.market_cap : null;
  const sampleDominance = marketCap && sampledMarketCap > 0 ? marketCap / sampledMarketCap : null;
  return {
    id: coin.id || coin.symbol || 'unknown',
    symbol: String(coin.symbol || '---').toUpperCase(),
    name: coin.name || 'Unknown asset',
    image: coin.image,
    price: typeof coin.current_price === 'number' ? coin.current_price : null,
    priceLabel: fmtUsd(coin.current_price),
    marketCap,
    marketCapLabel: fmtUsd(marketCap),
    volume24h: typeof coin.total_volume === 'number' ? coin.total_volume : null,
    volume24hLabel: fmtUsd(coin.total_volume),
    change24h: typeof coin.price_change_percentage_24h === 'number' ? coin.price_change_percentage_24h : null,
    change24hLabel: fmtPct(coin.price_change_percentage_24h),
    rank: typeof coin.market_cap_rank === 'number' ? coin.market_cap_rank : null,
    sampleDominance,
  };
}

async function resolveCoinId(query: string) {
  const normalized = normalizeQuery(query);
  if (!normalized) throw new Error('Informe um token. Exemplo: /chart sol');
  if (KNOWN_COIN_IDS[normalized]) return KNOWN_COIN_IDS[normalized];

  const search = await safeFetchJson<CoinGeckoSearch>(`${COINGECKO_API}/search?query=${encodeURIComponent(normalized)}`);
  const candidates = (search?.coins || [])
    .filter(coin => coin.id && coin.symbol)
    .sort((a, b) => (a.market_cap_rank || 999999) - (b.market_cap_rank || 999999));
  const exact = candidates.find(coin => coin.symbol?.toLowerCase() === normalized || coin.name?.toLowerCase() === normalized);
  const picked = exact || candidates[0];
  if (!picked?.id) throw new Error(`Nao encontrei dados publicos para "${query}" na CoinGecko.`);
  return picked.id;
}

export async function getMythosMarketHeatmap(): Promise<MythosMarketHeatmap> {
  const url = `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=24&page=1&price_change_percentage=24h`;
  const raw = await safeFetchJson<CoinGeckoMarketCoin[]>(url);
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('CoinGecko nao retornou dados suficientes para o mapa de calor.');
  }

  const sampledMarketCap = raw.reduce((sum, coin) => sum + (typeof coin.market_cap === 'number' ? coin.market_cap : 0), 0);
  const tiles = raw.map(coin => toTile(coin, sampledMarketCap));
  const positive = tiles.filter(tile => (tile.change24h ?? 0) > 0).length;
  const negative = tiles.filter(tile => (tile.change24h ?? 0) < 0).length;
  const leader = tiles[0];

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: 'coingecko',
    title: 'Crypto market heatmap',
    summary: `${positive} dos ${tiles.length} maiores ativos da amostra estao positivos em 24h; ${negative} estao negativos. ${leader?.symbol || 'BTC'} lidera a amostra por market cap.`,
    tiles,
    safety: {
      readOnlyMarketData: true,
      notFinancialAdvice: true,
      noTradeExecution: true,
      sources: ['CoinGecko coins/markets API'],
    },
  };
}

export async function getMythosTokenChart(query: string, days = 30): Promise<MythosTokenChart> {
  const safeDays = [1, 7, 14, 30, 90].includes(days) ? days : 30;
  const id = await resolveCoinId(query);
  const marketUrl = `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(id)}&price_change_percentage=24h`;
  const chartUrl = `${COINGECKO_API}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${safeDays}`;
  const [marketRaw, chartRaw] = await Promise.all([
    safeFetchJson<CoinGeckoMarketCoin[]>(marketUrl),
    safeFetchJson<CoinGeckoChart>(chartUrl),
  ]);
  const market = Array.isArray(marketRaw) ? marketRaw[0] : null;
  const points = (chartRaw?.prices || [])
    .filter(point => Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number')
    .map(([time, price]) => ({
      time: new Date(time).toISOString(),
      price,
    }));

  if (!market || points.length < 2) {
    throw new Error(`CoinGecko nao retornou serie de preco suficiente para "${query}".`);
  }

  const price = typeof market.current_price === 'number' ? market.current_price : null;
  const change24h = typeof market.price_change_percentage_24h === 'number' ? market.price_change_percentage_24h : null;
  const symbol = String(market.symbol || query).toUpperCase();

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: 'coingecko',
    query,
    id,
    symbol,
    name: market.name || symbol,
    image: market.image,
    price,
    priceLabel: fmtUsd(price),
    marketCap: typeof market.market_cap === 'number' ? market.market_cap : null,
    marketCapLabel: fmtUsd(market.market_cap),
    volume24h: typeof market.total_volume === 'number' ? market.total_volume : null,
    volume24hLabel: fmtUsd(market.total_volume),
    change24h,
    change24hLabel: fmtPct(change24h),
    rank: typeof market.market_cap_rank === 'number' ? market.market_cap_rank : null,
    days: safeDays,
    points,
    summary: `${symbol} esta em ${fmtUsd(price)} no dado mais recente da CoinGecko, com variacao de 24h em ${fmtPct(change24h)}. Use como leitura de mercado, nao como sinal de compra ou venda.`,
    safety: {
      readOnlyMarketData: true,
      notFinancialAdvice: true,
      noTradeExecution: true,
      sources: ['CoinGecko coins/markets API', 'CoinGecko market_chart API'],
    },
  };
}
