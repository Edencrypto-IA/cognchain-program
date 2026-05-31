import { PublicKey } from '@solana/web3.js';
import {
  getAccountSnapshot,
  getTokenMeta,
  type SolscanTokenEntry,
} from '@/lib/solana/solscan';

type CoinGeckoSolanaPrice = {
  solana?: {
    usd?: number;
    usd_24h_change?: number;
  };
};

export type MythosWalletIntelligenceToken = {
  mint: string | null;
  symbol: string;
  name: string;
  amount: number | null;
  valueUsd: number | null;
  change24hPct: number | null;
  source: string;
};

export type MythosWalletIntelligence = {
  address: string;
  fetchedAt: string;
  sources: string[];
  confidence: number;
  portfolio: {
    valueUsd: number | null;
    valueLabel: string;
    change24hPct: number | null;
    change24hLabel: string;
    changeMethod: 'weighted_current_holdings' | 'unavailable';
    estimateNote: string;
  };
  sol: {
    balance: number | null;
    priceUsd: number | null;
    valueUsd: number | null;
    change24hPct: number | null;
  };
  tokens: MythosWalletIntelligenceToken[];
  highlights: string[];
  recommendations: string[];
  unavailable: string[];
  safety: {
    readOnly: true;
    noSigning: true;
    noFundsMovement: true;
    disclaimer: string;
  };
};

function asNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtUsd(value: number | null) {
  if (value === null) return 'unavailable';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function fmtPct(value: number | null) {
  if (value === null) return 'unavailable';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function portfolioTokens(raw: unknown): SolscanTokenEntry[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray((raw as { tokens?: unknown }).tokens)) {
    return (raw as { tokens: SolscanTokenEntry[] }).tokens;
  }
  return [];
}

async function fetchSolPrice(): Promise<{ priceUsd: number | null; change24hPct: number | null }> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true',
      { cache: 'no-store', signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) return { priceUsd: null, change24hPct: null };
    const data = await response.json() as CoinGeckoSolanaPrice;
    return {
      priceUsd: asNumber(data.solana?.usd),
      change24hPct: asNumber(data.solana?.usd_24h_change),
    };
  } catch {
    return { priceUsd: null, change24hPct: null };
  }
}

function weightedChange(items: Array<{ valueUsd: number | null; change24hPct: number | null }>) {
  const usable = items.filter(item =>
    item.valueUsd !== null &&
    item.valueUsd > 0 &&
    item.change24hPct !== null &&
    item.change24hPct > -99.9
  );
  if (!usable.length) return null;

  let current = 0;
  let previous = 0;
  for (const item of usable) {
    current += item.valueUsd!;
    previous += item.valueUsd! / (1 + item.change24hPct! / 100);
  }

  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export async function getMythosWalletIntelligence(address: string): Promise<MythosWalletIntelligence> {
  new PublicKey(address);

  const fetchedAt = new Date().toISOString();
  const [snapshot, solPrice] = await Promise.all([
    getAccountSnapshot(address),
    fetchSolPrice(),
  ]);

  const detail = snapshot.detail;
  const rawTokens = portfolioTokens(snapshot.portfolio);
  const solBalance = asNumber(detail?.sol_balance) ?? (asNumber(detail?.lamports) ? asNumber(detail?.lamports)! / 1_000_000_000 : null);
  const solValueUsd = solBalance !== null && solPrice.priceUsd !== null ? solBalance * solPrice.priceUsd : null;

  const topRawTokens = rawTokens
    .map(token => ({
      token,
      valueUsd: asNumber(token.value),
    }))
    .filter(item => item.valueUsd !== null && item.valueUsd > 0)
    .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0))
    .slice(0, 8);

  const enrichedTokens = await Promise.all(topRawTokens.map(async ({ token, valueUsd }) => {
    const mint = token.token_address || null;
    let change24hPct: number | null = null;
    let source = 'Solscan portfolio';

    if (mint) {
      try {
        const meta = await getTokenMeta(mint);
        change24hPct = asNumber(meta.data?.price_change_24h);
        source = change24hPct === null ? 'Solscan portfolio' : 'Solscan portfolio + token meta';
      } catch {
        source = 'Solscan portfolio';
      }
    }

    return {
      mint,
      symbol: token.token_symbol || 'UNKNOWN',
      name: token.token_name || token.token_symbol || 'Unknown token',
      amount: asNumber(token.amount),
      valueUsd,
      change24hPct,
      source,
    };
  }));

  const tokenValueUsd = enrichedTokens.reduce((sum, token) => sum + (token.valueUsd ?? 0), 0);
  const portfolioValueUsd =
    asNumber(detail?.total_value) ??
    (snapshot.portfolio && !Array.isArray(snapshot.portfolio) ? asNumber(snapshot.portfolio.total_value) : null) ??
    (solValueUsd !== null || tokenValueUsd > 0 ? (solValueUsd ?? 0) + tokenValueUsd : null);

  const portfolioChange24h = weightedChange([
    { valueUsd: solValueUsd, change24hPct: solPrice.change24hPct },
    ...enrichedTokens.map(token => ({ valueUsd: token.valueUsd, change24hPct: token.change24hPct })),
  ]);

  const unavailable = [
    solPrice.priceUsd === null ? 'SOL price unavailable from CoinGecko.' : '',
    portfolioValueUsd === null ? 'Portfolio USD value unavailable from Solscan.' : '',
    portfolioChange24h === null ? '24h portfolio change unavailable because token-level 24h changes were incomplete.' : '',
  ].filter(Boolean);

  const best = enrichedTokens.filter(token => token.change24hPct !== null).sort((a, b) => (b.change24hPct ?? 0) - (a.change24hPct ?? 0))[0];
  const worst = enrichedTokens.filter(token => token.change24hPct !== null).sort((a, b) => (a.change24hPct ?? 0) - (b.change24hPct ?? 0))[0];

  const highlights = [
    portfolioValueUsd !== null ? `Current estimated wallet value: ${fmtUsd(portfolioValueUsd)}.` : '',
    portfolioChange24h !== null ? `Estimated 24h move from current holdings: ${fmtPct(portfolioChange24h)}.` : '',
    solBalance !== null ? `SOL balance: ${solBalance.toFixed(4)} SOL${solValueUsd !== null ? ` (${fmtUsd(solValueUsd)})` : ''}.` : '',
    best ? `Strongest tracked token today: ${best.symbol} at ${fmtPct(best.change24hPct)}.` : '',
    worst ? `Weakest tracked token today: ${worst.symbol} at ${fmtPct(worst.change24hPct)}.` : '',
  ].filter(Boolean);

  const recommendations = [
    portfolioChange24h !== null && portfolioChange24h > 8
      ? 'Review whether taking partial profit reduces risk after a strong daily move.'
      : 'Review position size before adding risk; today does not require automatic action.',
    'Check liquidity, concentration, and token contract risk before buying or selling.',
    'Use Mythos to simulate partial profit-taking scenarios before opening any wallet signature.',
  ];

  const confidence = Math.min(100, 35 + (portfolioValueUsd !== null ? 20 : 0) + (solPrice.priceUsd !== null ? 15 : 0) + Math.min(20, enrichedTokens.length * 3) + (portfolioChange24h !== null ? 10 : 0));

  return {
    address,
    fetchedAt,
    sources: ['Solana public wallet address', 'Solscan Pro account/portfolio/token metadata', 'CoinGecko SOL price'],
    confidence,
    portfolio: {
      valueUsd: portfolioValueUsd,
      valueLabel: fmtUsd(portfolioValueUsd),
      change24hPct: portfolioChange24h,
      change24hLabel: fmtPct(portfolioChange24h),
      changeMethod: portfolioChange24h === null ? 'unavailable' : 'weighted_current_holdings',
      estimateNote: '24h change is estimated from current visible holdings and live token price changes. It is not realized PnL or cost-basis profit.',
    },
    sol: {
      balance: solBalance,
      priceUsd: solPrice.priceUsd,
      valueUsd: solValueUsd,
      change24hPct: solPrice.change24hPct,
    },
    tokens: enrichedTokens,
    highlights,
    recommendations,
    unavailable,
    safety: {
      readOnly: true,
      noSigning: true,
      noFundsMovement: true,
      disclaimer: 'Informational wallet intelligence only. Not financial advice. Mythos never signs, submits, buys, sells, or moves funds from this report.',
    },
  };
}
