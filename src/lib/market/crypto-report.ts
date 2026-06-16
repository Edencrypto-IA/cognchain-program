const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const COINLORE_API = 'https://api.coinlore.net/api';

export type MythosCryptoCoin = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  price: number | null;
  marketCap: number | null;
  volume24h: number | null;
  change24h: number | null;
  change7d: number | null;
  rank?: number | null;
};

export type MythosCryptoOpportunity = {
  coin: MythosCryptoCoin;
  conviction: 'high' | 'medium' | 'wait';
  riskLevel: number;
  thesis: string;
  tags: string[];
};

export type MythosCryptoMarketReport = {
  ok: true;
  generatedAt: string;
  source: 'coingecko' | 'coingecko_coinlore_fallback';
  sentiment: 'risk_on' | 'cautious' | 'risk_off';
  global: {
    marketCapUsd: number | null;
    marketCapLabel: string;
    btcDominance: number | null;
    btcDominanceLabel: string;
    volume24hUsd: number | null;
    volume24hLabel: string;
    activeCryptos: number | null;
  };
  gainers: MythosCryptoCoin[];
  losers: MythosCryptoCoin[];
  trending: MythosCryptoCoin[];
  opportunities: MythosCryptoOpportunity[];
  macro: {
    pressure: string[];
    catalysts: string[];
  };
  executiveSummary: string;
  safety: {
    notFinancialAdvice: true;
    readOnlyMarketData: true;
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
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
};

type CoinGeckoGlobal = {
  data?: {
    total_market_cap?: { usd?: number };
    market_cap_percentage?: { btc?: number };
    total_volume?: { usd?: number };
    active_cryptocurrencies?: number;
  };
};

type CoinGeckoTrending = {
  coins?: Array<{
    item?: {
      id?: string;
      coin_id?: number;
      name?: string;
      symbol?: string;
      market_cap_rank?: number;
      small?: string;
      data?: {
        price?: number;
        market_cap?: string;
        total_volume?: string;
      };
    };
  }>;
};

type CoinLoreGlobal = Array<{
  coins_count?: number;
  active_markets?: number;
  total_mcap?: number;
  total_volume?: number;
  btc_d?: string | number;
}>;

function coingeckoHeaders() {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const demoKey = process.env.COINGECKO_API_KEY || process.env.COINGECKO_DEMO_API_KEY;
  const proKey = process.env.COINGECKO_PRO_API_KEY;
  if (proKey) headers['x-cg-pro-api-key'] = proKey;
  if (demoKey && !proKey) headers['x-cg-demo-api-key'] = demoKey;
  return headers;
}

async function safeFetchJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: coingeckoHeaders(),
      next: { revalidate: 120 },
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

async function safeFetchPublicJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 120 },
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
  if (!value || !Number.isFinite(value)) return 'unavailable';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  return `$${value.toLocaleString('en-US', { maximumSignificantDigits: 4 })}`;
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'unavailable';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function toCoin(coin: CoinGeckoMarketCoin): MythosCryptoCoin {
  return {
    id: coin.id || coin.symbol || 'unknown',
    symbol: String(coin.symbol || '---').toUpperCase(),
    name: coin.name || 'Unknown asset',
    image: coin.image,
    price: typeof coin.current_price === 'number' ? coin.current_price : null,
    marketCap: typeof coin.market_cap === 'number' ? coin.market_cap : null,
    volume24h: typeof coin.total_volume === 'number' ? coin.total_volume : null,
    change24h: typeof coin.price_change_percentage_24h === 'number' ? coin.price_change_percentage_24h : null,
    change7d: typeof coin.price_change_percentage_7d_in_currency === 'number' ? coin.price_change_percentage_7d_in_currency : null,
    rank: typeof coin.market_cap_rank === 'number' ? coin.market_cap_rank : null,
  };
}

function tagsFor(coin: MythosCryptoCoin) {
  const text = `${coin.id} ${coin.name} ${coin.symbol}`.toLowerCase();
  const tags = new Set<string>();
  if (/solana|jupiter|raydium|bonk|pyth|drift/.test(text)) tags.add('Solana');
  if (/near|render|bittensor|tao|ai|worldcoin|akash|fetch/.test(text)) tags.add('AI');
  if (/hyperliquid|aave|morpho|uniswap|jupiter|raydium|ondo/.test(text)) tags.add('DeFi');
  if (/ondo|pendle|maple|centrifuge/.test(text)) tags.add('RWA');
  if (/bitcoin|ethereum|solana|near|sui|aptos|sei/.test(text)) tags.add('L1');
  if (tags.size === 0) tags.add('Market');
  return Array.from(tags).slice(0, 3);
}

function opportunityFor(coin: MythosCryptoCoin): MythosCryptoOpportunity {
  const change = coin.change7d ?? coin.change24h ?? 0;
  const marketCap = coin.marketCap ?? 0;
  const conviction = change > 18 && marketCap > 300_000_000 ? 'high' : change > 6 ? 'medium' : 'wait';
  const riskLevel = marketCap > 10_000_000_000 ? 28 : marketCap > 1_000_000_000 ? 48 : 74;
  const tags = tagsFor(coin);
  return {
    coin,
    conviction,
    riskLevel,
    tags,
    thesis: `${tags.join(' + ')} narrative. 7d momentum ${pct(coin.change7d)} with market cap ${fmtUsd(coin.marketCap)}. Review liquidity, unlocks, and trend durability before acting.`,
  };
}

function buildSentiment(global: MythosCryptoMarketReport['global'], topCoins: MythosCryptoCoin[]): MythosCryptoMarketReport['sentiment'] {
  const btcDominance = global.btcDominance ?? 0;
  const average7d = topCoins.slice(0, 20).reduce((sum, coin) => sum + (coin.change7d ?? 0), 0) / Math.max(1, topCoins.slice(0, 20).length);
  if (average7d > 5 && btcDominance < 62) return 'risk_on';
  if (average7d < -4 || btcDominance > 64) return 'risk_off';
  return 'cautious';
}

function buildGlobalFallback(globalRaw: CoinGeckoGlobal | null, coinLoreRaw: CoinLoreGlobal | null, topCoins: MythosCryptoCoin[]) {
  const coinLore = Array.isArray(coinLoreRaw) ? coinLoreRaw[0] : null;
  const sampledMarketCap = topCoins.reduce((sum, coin) => sum + (coin.marketCap || 0), 0);
  const sampledVolume = topCoins.reduce((sum, coin) => sum + (coin.volume24h || 0), 0);
  const btc = topCoins.find(coin => coin.id === 'bitcoin' || coin.symbol === 'BTC');
  const sampledBtcDominance = btc?.marketCap && sampledMarketCap > 0 ? (btc.marketCap / sampledMarketCap) * 100 : null;

  const marketCapUsd = globalRaw?.data?.total_market_cap?.usd
    ?? coinLore?.total_mcap
    ?? (sampledMarketCap > 0 ? sampledMarketCap : null);
  const volume24hUsd = globalRaw?.data?.total_volume?.usd
    ?? coinLore?.total_volume
    ?? (sampledVolume > 0 ? sampledVolume : null);
  const btcDominanceRaw = globalRaw?.data?.market_cap_percentage?.btc
    ?? (typeof coinLore?.btc_d === 'string' ? Number(coinLore.btc_d) : coinLore?.btc_d)
    ?? sampledBtcDominance;
  const activeCryptos = globalRaw?.data?.active_cryptocurrencies
    ?? coinLore?.coins_count
    ?? (topCoins.length > 0 ? topCoins.length : null);

  return {
    marketCapUsd,
    marketCapLabel: fmtUsd(marketCapUsd),
    btcDominance: typeof btcDominanceRaw === 'number' && Number.isFinite(btcDominanceRaw) ? btcDominanceRaw : null,
    btcDominanceLabel: typeof btcDominanceRaw === 'number' && Number.isFinite(btcDominanceRaw) ? `${btcDominanceRaw.toFixed(1)}%` : 'unavailable',
    volume24hUsd,
    volume24hLabel: fmtUsd(volume24hUsd),
    activeCryptos,
  };
}

function buildMacro(sentiment: MythosCryptoMarketReport['sentiment'], topCoins: MythosCryptoCoin[]) {
  const positive = topCoins.filter(coin => (coin.change7d ?? 0) > 0).length;
  const negative = topCoins.filter(coin => (coin.change7d ?? 0) < 0).length;
  return {
    pressure: [
      sentiment === 'risk_off' ? 'Risk-off tone across large caps.' : 'Market still requires confirmation before aggressive exposure.',
      `${negative} of top sampled assets are negative on the 7d window.`,
      'Use wallet-level and token-level Mythos checks before acting on any asset.',
    ],
    catalysts: [
      sentiment === 'risk_on' ? 'Broad positive 7d momentum is visible in sampled assets.' : 'Selective rotation is more important than broad beta.',
      `${positive} of top sampled assets are positive on the 7d window.`,
      'Trending assets can identify attention, but attention is not proof of quality.',
    ],
  };
}

function buildSummary(report: Omit<MythosCryptoMarketReport, 'executiveSummary'>) {
  const leaders = report.gainers.slice(0, 3).map(coin => `${coin.symbol} ${pct(coin.change7d)}`).join(', ') || 'no clear leaders';
  const laggards = report.losers.slice(0, 3).map(coin => `${coin.symbol} ${pct(coin.change7d)}`).join(', ') || 'no clear laggards';
  const opps = report.opportunities.slice(0, 3).map(item => item.coin.symbol).join(', ') || 'none';
  return `Market sentiment is ${report.sentiment.replace('_', '-')}. Weekly leaders: ${leaders}. Weak names: ${laggards}. Mythos highlights ${opps} as watchlist candidates, not buy signals. Every opportunity should be checked with token, wallet, liquidity, and execution-risk analysis before action.`;
}

export async function getMythosCryptoMarketReport(): Promise<MythosCryptoMarketReport> {
  const topUrl = `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&price_change_percentage=24h,7d`;
  const opportunityIds = 'hyperliquid,near,morpho,ondo-finance,solana,ethereum,bitcoin,jupiter-exchange-solana,render-token,pyth-network';
  const opportunityUrl = `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${opportunityIds}&price_change_percentage=24h,7d,30d`;

  const [globalRaw, topRaw, trendingRaw, opportunitiesRaw] = await Promise.all([
    safeFetchJson<CoinGeckoGlobal>(`${COINGECKO_API}/global`),
    safeFetchJson<CoinGeckoMarketCoin[]>(topUrl),
    safeFetchJson<CoinGeckoTrending>(`${COINGECKO_API}/search/trending`),
    safeFetchJson<CoinGeckoMarketCoin[]>(opportunityUrl),
  ]);
  const coinLoreRaw = globalRaw?.data?.total_market_cap?.usd
    ? null
    : await safeFetchPublicJson<CoinLoreGlobal>(`${COINLORE_API}/global/`);

  const topCoins = Array.isArray(topRaw) ? topRaw.map(toCoin) : [];
  const gainers = [...topCoins]
    .filter(coin => (coin.change7d ?? coin.change24h ?? 0) > 0)
    .sort((a, b) => (b.change7d ?? 0) - (a.change7d ?? 0))
    .slice(0, 8);
  const losers = [...topCoins]
    .filter(coin => (coin.change7d ?? coin.change24h ?? 0) < 0)
    .sort((a, b) => (a.change7d ?? 0) - (b.change7d ?? 0))
    .slice(0, 8);
  const trending = (trendingRaw?.coins || []).slice(0, 8).map(entry => ({
    id: entry.item?.id || String(entry.item?.coin_id || 'trending'),
    symbol: String(entry.item?.symbol || '---').toUpperCase(),
    name: entry.item?.name || 'Trending asset',
    image: entry.item?.small,
    price: typeof entry.item?.data?.price === 'number' ? entry.item.data.price : null,
    marketCap: null,
    volume24h: null,
    change24h: null,
    change7d: null,
    rank: typeof entry.item?.market_cap_rank === 'number' ? entry.item.market_cap_rank : null,
  }));

  const global = buildGlobalFallback(globalRaw, coinLoreRaw, topCoins);
  const sentiment = buildSentiment(global, topCoins);
  const opportunities = (Array.isArray(opportunitiesRaw) ? opportunitiesRaw.map(toCoin) : topCoins.slice(0, 8))
    .map(opportunityFor)
    .sort((a, b) => {
      const rank = { high: 3, medium: 2, wait: 1 };
      return rank[b.conviction] - rank[a.conviction] || (b.coin.change7d ?? 0) - (a.coin.change7d ?? 0);
    })
    .slice(0, 6);

  const partial = {
    ok: true as const,
    generatedAt: new Date().toISOString(),
    source: globalRaw?.data?.total_market_cap?.usd ? 'coingecko' as const : 'coingecko_coinlore_fallback' as const,
    sentiment,
    global,
    gainers,
    losers,
    trending,
    opportunities,
    macro: buildMacro(sentiment, topCoins),
    safety: {
      notFinancialAdvice: true as const,
      readOnlyMarketData: true as const,
      noTradeExecution: true as const,
      sources: [
        'CoinGecko market API',
        globalRaw?.data?.total_market_cap?.usd ? 'CoinGecko global API' : 'CoinLore global fallback',
      ],
    },
  };

  return {
    ...partial,
    executiveSummary: buildSummary(partial),
  };
}
