const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const DEFILLAMA_API = 'https://api.llama.fi';

export type SolanaProtocolSummary = {
  name: string;
  category: string;
  tvlUsd: number;
  tvlLabel: string;
  change1d: number | null;
  change7d: number | null;
  url?: string;
  chains: string[];
};

export type MythosSolanaEcosystemReport = {
  ok: true;
  generatedAt: string;
  symbol: 'SOL';
  sources: string[];
  price: {
    usd: number | null;
    label: string;
    change24h: number | null;
    change24hLabel: string;
    marketCapUsd: number | null;
    marketCapLabel: string;
    volume24hUsd: number | null;
    volume24hLabel: string;
    rank: number | null;
    athUsd: number | null;
    athLabel: string;
    circulatingSupply: number | null;
    circulatingLabel: string;
  };
  defi: {
    totalTvlUsd: number;
    totalTvlLabel: string;
    protocolCount: number;
    topProtocols: SolanaProtocolSummary[];
  };
  readout: {
    sentiment: 'bullish' | 'neutral' | 'risk_off';
    headline: string;
    plainEnglish: string;
    nextSafeStep: string;
  };
  safety: {
    notFinancialAdvice: true;
    readOnlyMarketData: true;
    noTradeExecution: true;
  };
};

type CoinGeckoSolana = {
  market_cap_rank?: number;
  market_data?: {
    current_price?: { usd?: number };
    market_cap?: { usd?: number };
    total_volume?: { usd?: number };
    price_change_percentage_24h?: number;
    ath?: { usd?: number };
    circulating_supply?: number;
  };
};

type DefiLlamaProtocol = {
  name?: string;
  category?: string;
  chains?: string[];
  tvl?: number;
  change_1d?: number;
  change_7d?: number;
  url?: string;
};

async function safeFetchJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
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
  if (!value || !Number.isFinite(value)) return 'unavailable';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  return `$${value.toLocaleString('en-US', { maximumSignificantDigits: 4 })}`;
}

function fmtNumber(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return 'unavailable';
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtPct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'unavailable';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function categoryFor(protocol: DefiLlamaProtocol) {
  const raw = protocol.category || 'Protocol';
  const name = String(protocol.name || '').toLowerCase();
  if (/jupiter/.test(name)) return 'Aggregator';
  if (/raydium|orca|meteora|lifinity/.test(name)) return 'DEX / AMM';
  if (/jito|marinade|sanctum/.test(name)) return 'Liquid Staking';
  if (/kamino|marginfi|solend|drift/.test(name)) return 'Lending / Yield';
  return raw;
}

function protocolToSummary(protocol: DefiLlamaProtocol): SolanaProtocolSummary {
  const tvl = typeof protocol.tvl === 'number' ? protocol.tvl : 0;
  return {
    name: protocol.name || 'Unknown protocol',
    category: categoryFor(protocol),
    tvlUsd: tvl,
    tvlLabel: fmtUsd(tvl),
    change1d: typeof protocol.change_1d === 'number' ? protocol.change_1d : null,
    change7d: typeof protocol.change_7d === 'number' ? protocol.change_7d : null,
    url: protocol.url,
    chains: Array.isArray(protocol.chains) ? protocol.chains : [],
  };
}

function readoutFor(change24h: number | null, totalTvl: number, protocols: SolanaProtocolSummary[]) {
  const sentiment = change24h !== null && change24h > 2
    ? 'bullish'
    : change24h !== null && change24h < -2
      ? 'risk_off'
      : 'neutral';
  const leader = protocols[0]?.name || 'the top protocol';
  const headline = sentiment === 'bullish'
    ? 'SOL has positive short-term momentum while Solana DeFi remains active.'
    : sentiment === 'risk_off'
      ? 'SOL is under pressure, so protocol strength matters more than price alone.'
      : 'SOL is near neutral momentum; ecosystem TVL gives the better context.';

  return {
    sentiment,
    headline,
    plainEnglish: `For a non-crypto user: this card combines SOL price with Solana DeFi usage. Price shows what the market pays for SOL now. TVL shows how much value is sitting inside Solana applications. ${leader} is currently the largest sampled protocol, and the top 10 protocols represent ${fmtUsd(totalTvl)} in visible DeFi activity.`,
    nextSafeStep: 'If you are researching Solana, review the largest protocols first, then run token, wallet, and transaction checks before making any financial decision.',
  };
}

export async function getMythosSolanaEcosystemReport(): Promise<MythosSolanaEcosystemReport> {
  const [solana, protocolsRaw] = await Promise.all([
    safeFetchJson<CoinGeckoSolana>(`${COINGECKO_API}/coins/solana?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`),
    safeFetchJson<DefiLlamaProtocol[]>(`${DEFILLAMA_API}/protocols`),
  ]);

  const market = solana?.market_data;
  const protocols = Array.isArray(protocolsRaw)
    ? protocolsRaw
        .filter(protocol => Array.isArray(protocol.chains) && protocol.chains.includes('Solana') && Number(protocol.tvl) > 0)
        .map(protocolToSummary)
        .sort((a, b) => b.tvlUsd - a.tvlUsd)
        .slice(0, 10)
    : [];
  const totalTvl = protocols.reduce((sum, protocol) => sum + protocol.tvlUsd, 0);
  const change24h = typeof market?.price_change_percentage_24h === 'number' ? market.price_change_percentage_24h : null;
  const readout = readoutFor(change24h, totalTvl, protocols);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    symbol: 'SOL',
    sources: ['CoinGecko public API', 'DeFiLlama protocols API'],
    price: {
      usd: market?.current_price?.usd ?? null,
      label: fmtUsd(market?.current_price?.usd ?? null),
      change24h,
      change24hLabel: fmtPct(change24h),
      marketCapUsd: market?.market_cap?.usd ?? null,
      marketCapLabel: fmtUsd(market?.market_cap?.usd ?? null),
      volume24hUsd: market?.total_volume?.usd ?? null,
      volume24hLabel: fmtUsd(market?.total_volume?.usd ?? null),
      rank: typeof solana?.market_cap_rank === 'number' ? solana.market_cap_rank : null,
      athUsd: market?.ath?.usd ?? null,
      athLabel: fmtUsd(market?.ath?.usd ?? null),
      circulatingSupply: market?.circulating_supply ?? null,
      circulatingLabel: fmtNumber(market?.circulating_supply ?? null),
    },
    defi: {
      totalTvlUsd: totalTvl,
      totalTvlLabel: fmtUsd(totalTvl),
      protocolCount: protocols.length,
      topProtocols: protocols,
    },
    readout,
    safety: {
      notFinancialAdvice: true,
      readOnlyMarketData: true,
      noTradeExecution: true,
    },
  };
}
