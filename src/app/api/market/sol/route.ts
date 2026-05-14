import { NextResponse } from 'next/server';

async function safeFetch(url: string, ms = 6000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 30 } });
    clearTimeout(timer);
    if (!res.ok) return null;
    return res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function fmtB(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return null;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toFixed(2)}`;
}

export async function GET() {
  const [ticker, cg, protocols, klines, cgChart] = await Promise.all([
    safeFetch('https://api.binance.com/api/v3/ticker/24hr?symbol=SOLUSDT'),
    safeFetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true'),
    safeFetch('https://api.llama.fi/protocols'),
    safeFetch('https://api.binance.com/api/v3/klines?symbol=SOLUSDT&interval=1h&limit=24'),
    safeFetch('https://api.coingecko.com/api/v3/coins/solana/market_chart?vs_currency=usd&days=1&interval=hourly'),
  ]);

  const binance = ticker as Record<string, string> | null;
  const coingecko = (cg as { solana?: Record<string, number> } | null)?.solana;
  const klineRows = Array.isArray(klines) ? klines : [];
  const binanceChart = klineRows
    .map(row => Array.isArray(row) ? Number(row[4]) : NaN)
    .filter(n => Number.isFinite(n));
  const coingeckoChart = ((cgChart as { prices?: Array<[number, number]> } | null)?.prices ?? [])
    .map(row => Number(row[1]))
    .filter(n => Number.isFinite(n));
  const chart = binanceChart.length >= 8 ? binanceChart : coingeckoChart;

  const solanaProtocols = Array.isArray(protocols)
    ? protocols
        .filter((p: unknown) => {
          const item = p as Record<string, unknown>;
          return (item.chains as string[] | undefined)?.includes('Solana') && Number(item.tvl) > 500_000;
        })
        .sort((a: unknown, b: unknown) => Number((b as Record<string, unknown>).tvl) - Number((a as Record<string, unknown>).tvl))
        .slice(0, 5)
        .map((p: unknown) => {
          const item = p as Record<string, unknown>;
          return {
            name: String(item.name ?? 'Protocol'),
            tvl: Number(item.tvl ?? 0),
            change1d: typeof item.change_1d === 'number' ? item.change_1d : null,
          };
        })
    : [];

  const price = binance?.lastPrice ? Number(binance.lastPrice) : coingecko?.usd ?? null;
  const change24h = binance?.priceChangePercent ? Number(binance.priceChangePercent) : coingecko?.usd_24h_change ?? null;
  const volume24h = binance?.quoteVolume ? Number(binance.quoteVolume) : coingecko?.usd_24h_vol ?? null;
  const marketCap = coingecko?.usd_market_cap ?? null;
  const liquidity = solanaProtocols.reduce((sum, p) => sum + (Number.isFinite(p.tvl) ? p.tvl : 0), 0);
  const trustScore = Math.min(100, 40 + (price ? 20 : 0) + (chart.length >= 8 ? 15 : 0) + (marketCap ? 10 : 0) + (solanaProtocols.length ? 15 : 0));
  const signal = change24h === null ? 'neutral' : change24h > 2 ? 'bullish' : change24h < -2 ? 'risk-off' : 'neutral';
  const action = signal === 'bullish'
    ? 'Momentum positivo. Monitore volume e resistencia antes de aumentar exposicao.'
    : signal === 'risk-off'
      ? 'Mercado em pressao. Priorize gestao de risco e espere confirmacao de reversao.'
      : 'Cenario neutro. Use como snapshot e acompanhe volume/liquidez antes de agir.';

  return NextResponse.json({
    symbol: 'SOL',
    price,
    change24h,
    volume24h,
    marketCap,
    liquidity,
    liquidityLabel: fmtB(liquidity),
    marketCapLabel: fmtB(marketCap),
    volumeLabel: fmtB(volume24h),
    chart,
    protocols: solanaProtocols,
    signal,
    action,
    trustScore,
    sources: ['Binance', 'CoinGecko', 'DeFiLlama'],
    updatedAt: new Date().toISOString(),
  });
}
