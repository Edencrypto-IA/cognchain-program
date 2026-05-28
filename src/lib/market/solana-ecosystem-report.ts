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

export type SolanaAssetSummary = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  price: number | null;
  priceLabel: string;
  marketCapUsd: number | null;
  marketCapLabel: string;
  volume24hUsd: number | null;
  volume24hLabel: string;
  change24h: number | null;
  change24hLabel: string;
  rank: number | null;
};

export type MythosSolanaReportMode = 'price' | 'protocols' | 'volume' | 'memes';

export type MythosSolanaEcosystemReport = {
  ok: true;
  generatedAt: string;
  symbol: 'SOL';
  mode: MythosSolanaReportMode;
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
  assets: {
    volumeLeaders: SolanaAssetSummary[];
    memeLeaders: SolanaAssetSummary[];
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

type CuratedSolanaProtocol = {
  displayName: string;
  category: string;
  aliases: string[];
};

const SOLANA_NATIVE_PROTOCOLS: CuratedSolanaProtocol[] = [
  { displayName: 'Jupiter', category: 'Aggregator / Perps', aliases: ['jupiter', 'jupiter aggregator', 'jupiter perps', 'jupiter lend'] },
  { displayName: 'Kamino', category: 'Lending / Yield', aliases: ['kamino', 'kamino finance', 'kamino lend'] },
  { displayName: 'Jito', category: 'Liquid Staking / MEV', aliases: ['jito', 'jito liquid staking', 'jito validator lsts'] },
  { displayName: 'Marinade Finance', category: 'Liquid Staking', aliases: ['marinade', 'marinade finance'] },
  { displayName: 'Drift', category: 'Perps / DEX', aliases: ['drift', 'drift protocol', 'drift trade'] },
  { displayName: 'Raydium', category: 'DEX / AMM', aliases: ['raydium'] },
  { displayName: 'Sanctum', category: 'Liquid Staking', aliases: ['sanctum', 'sanctum validator lsts'] },
  { displayName: 'Meteora', category: 'Dynamic Liquidity', aliases: ['meteora'] },
  { displayName: 'Orca', category: 'DEX / AMM', aliases: ['orca'] },
  { displayName: 'Save', category: 'Lending', aliases: ['save', 'solend'] },
];

type CoinGeckoMarketAsset = {
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

function isRealSolanaProtocol(protocol: DefiLlamaProtocol) {
  const chains = Array.isArray(protocol.chains) ? protocol.chains : [];
  const category = String(protocol.category || '').toLowerCase();
  const name = String(protocol.name || '').toLowerCase();
  if (!chains.includes('Solana')) return false;
  if (!Number(protocol.tvl) || Number(protocol.tvl) <= 0) return false;
  if (category === 'cex' || category.includes('centralized')) return false;
  if (/binance|okx|bitfinex|bybit|coinbase|kraken|kucoin|mexc|gate\.?io|crypto\.com/.test(name)) return false;
  return true;
}

function protocolToSummary(protocol: DefiLlamaProtocol, override?: CuratedSolanaProtocol): SolanaProtocolSummary {
  const tvl = typeof protocol.tvl === 'number' ? protocol.tvl : 0;
  return {
    name: override?.displayName || protocol.name || 'Unknown protocol',
    category: override?.category || categoryFor(protocol),
    tvlUsd: tvl,
    tvlLabel: fmtUsd(tvl),
    change1d: typeof protocol.change_1d === 'number' ? protocol.change_1d : null,
    change7d: typeof protocol.change_7d === 'number' ? protocol.change_7d : null,
    url: protocol.url,
    chains: Array.isArray(protocol.chains) ? protocol.chains : [],
  };
}

function createProtocolPlaceholder(protocol: CuratedSolanaProtocol): SolanaProtocolSummary {
  return {
    name: protocol.displayName,
    category: protocol.category,
    tvlUsd: 0,
    tvlLabel: 'live TVL pending',
    change1d: null,
    change7d: null,
    chains: ['Solana'],
  };
}

function protocolName(protocol: DefiLlamaProtocol) {
  return String(protocol.name || '').trim().toLowerCase();
}

function matchesCuratedProtocol(protocol: DefiLlamaProtocol, curated: CuratedSolanaProtocol) {
  const name = protocolName(protocol);
  return curated.aliases.some((alias) => name === alias || name.includes(alias));
}

function buildCuratedSolanaProtocolList(protocolsRaw: DefiLlamaProtocol[] | null) {
  if (!Array.isArray(protocolsRaw)) return SOLANA_NATIVE_PROTOCOLS.map(createProtocolPlaceholder);

  const solanaProtocols = protocolsRaw.filter(isRealSolanaProtocol);

  return SOLANA_NATIVE_PROTOCOLS.map((curated) => {
    const match = solanaProtocols
      .filter((protocol) => matchesCuratedProtocol(protocol, curated))
      .sort((a, b) => (Number(b.tvl) || 0) - (Number(a.tvl) || 0))[0];

    return match ? protocolToSummary(match, curated) : createProtocolPlaceholder(curated);
  });
}

function assetToSummary(asset: CoinGeckoMarketAsset): SolanaAssetSummary {
  const price = typeof asset.current_price === 'number' ? asset.current_price : null;
  const marketCap = typeof asset.market_cap === 'number' ? asset.market_cap : null;
  const volume = typeof asset.total_volume === 'number' ? asset.total_volume : null;
  const change24h = typeof asset.price_change_percentage_24h === 'number' ? asset.price_change_percentage_24h : null;
  return {
    id: asset.id || asset.symbol || 'unknown',
    symbol: String(asset.symbol || '---').toUpperCase(),
    name: asset.name || 'Unknown asset',
    image: asset.image,
    price,
    priceLabel: fmtUsd(price),
    marketCapUsd: marketCap,
    marketCapLabel: fmtUsd(marketCap),
    volume24hUsd: volume,
    volume24hLabel: fmtUsd(volume),
    change24h,
    change24hLabel: fmtPct(change24h),
    rank: typeof asset.market_cap_rank === 'number' ? asset.market_cap_rank : null,
  };
}

function readoutFor(mode: MythosSolanaReportMode, change24h: number | null, totalTvl: number, protocols: SolanaProtocolSummary[], volumeLeaders: SolanaAssetSummary[], memeLeaders: SolanaAssetSummary[]) {
  const sentiment = change24h !== null && change24h > 2
    ? 'bullish'
    : change24h !== null && change24h < -2
      ? 'risk_off'
      : 'neutral';
  const leader = protocols[0]?.name || 'the top protocol';
  const volumeLeader = volumeLeaders[0]?.symbol || 'the leading asset';
  const memeLeader = memeLeaders[0]?.symbol || 'the leading meme coin';
  const headline = mode === 'protocols'
    ? `Top Solana protocols are ranked by DeFi TVL, excluding centralized exchanges.`
    : mode === 'volume'
      ? `${volumeLeader} leads the sampled Solana ecosystem by 24h spot volume.`
      : mode === 'memes'
        ? `${memeLeader} leads the sampled Solana meme market, but meme risk stays high.`
        : sentiment === 'bullish'
          ? 'SOL has positive short-term momentum while Solana DeFi remains active.'
          : sentiment === 'risk_off'
            ? 'SOL is under pressure, so protocol strength matters more than price alone.'
            : 'SOL is near neutral momentum; ecosystem context matters more than price alone.';

  const plainEnglish = mode === 'protocols'
    ? `For a non-crypto user: this report shows core Solana-native applications such as aggregators, lending markets, liquid staking, DEXs, and perps. TVL means how much value is sitting inside those applications when live data is available. ${leader} is shown first because it is one of the primary entry points for Solana liquidity.`
    : mode === 'volume'
      ? `For a non-crypto user: this report shows which Solana ecosystem assets are moving the most trading volume. Volume means attention and liquidity, but it does not prove safety or quality.`
      : mode === 'memes'
        ? `For a non-crypto user: this report shows Solana meme coins by market activity. Meme coins can move fast, but they also carry high liquidity, concentration, and narrative risk.`
        : `For a non-crypto user: this report focuses on SOL price first. Price shows what the market pays for SOL now. Use the separate protocol, volume, or meme reports when you want ecosystem detail.`;

  return {
    sentiment,
    headline,
    plainEnglish,
    nextSafeStep: mode === 'price'
      ? 'Use this for SOL market context. If you want projects, run the protocol report; if you want speculative tokens, run the meme report.'
      : 'Pick one item from the list and run a token, wallet, transaction, or contract check before trusting it.',
  };
}

export async function getMythosSolanaEcosystemReport(mode: MythosSolanaReportMode = 'price'): Promise<MythosSolanaEcosystemReport> {
  const [solana, protocolsRaw, solanaAssetsRaw, memeAssetsRaw] = await Promise.all([
    safeFetchJson<CoinGeckoSolana>(`${COINGECKO_API}/coins/solana?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`),
    safeFetchJson<DefiLlamaProtocol[]>(`${DEFILLAMA_API}/protocols`),
    safeFetchJson<CoinGeckoMarketAsset[]>(`${COINGECKO_API}/coins/markets?vs_currency=usd&category=solana-ecosystem&order=volume_desc&per_page=10&page=1&price_change_percentage=24h`),
    safeFetchJson<CoinGeckoMarketAsset[]>(`${COINGECKO_API}/coins/markets?vs_currency=usd&category=solana-meme-coins&order=volume_desc&per_page=10&page=1&price_change_percentage=24h`),
  ]);

  const market = solana?.market_data;
  const protocols = buildCuratedSolanaProtocolList(protocolsRaw);
  const volumeLeaders = Array.isArray(solanaAssetsRaw) ? solanaAssetsRaw.map(assetToSummary).slice(0, 10) : [];
  const memeLeaders = Array.isArray(memeAssetsRaw) ? memeAssetsRaw.map(assetToSummary).slice(0, 10) : [];
  const totalTvl = protocols.reduce((sum, protocol) => sum + protocol.tvlUsd, 0);
  const change24h = typeof market?.price_change_percentage_24h === 'number' ? market.price_change_percentage_24h : null;
  const readout = readoutFor(mode, change24h, totalTvl, protocols, volumeLeaders, memeLeaders);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    symbol: 'SOL',
    mode,
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
    assets: {
      volumeLeaders,
      memeLeaders,
    },
    readout,
    safety: {
      notFinancialAdvice: true,
      readOnlyMarketData: true,
      noTradeExecution: true,
    },
  };
}
