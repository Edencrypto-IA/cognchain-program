import type { MythosTokenChart, MythosTokenChartPoint } from '@/lib/market/crypto-visuals';

function trendClass(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'text-white/48';
  return value >= 0 ? 'text-[#76FF03]' : 'text-[#FF5C7A]';
}

function buildPath(points: MythosTokenChartPoint[]) {
  const width = 640;
  const height = 260;
  const pad = 18;
  const prices = points.map(point => point.price).filter(price => Number.isFinite(price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = Math.max(0.00000001, max - min);
  return points.map((point, index) => {
    const x = pad + (index / Math.max(1, points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((point.price - min) / span) * (height - pad * 2);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

function chartFillPath(points: MythosTokenChartPoint[]) {
  const line = buildPath(points);
  return `${line} L 622 242 L 18 242 Z`;
}

export function MythosTokenChartCard({ chart }: { chart: MythosTokenChart }) {
  const points = chart.points.slice(-180);
  const path = buildPath(points);
  const fillPath = chartFillPath(points);
  const isPositive = chart.change24h !== null && chart.change24h >= 0;
  const lineColor = isPositive ? '#76FF03' : '#FF5C7A';
  const fillColor = isPositive ? 'rgba(118,255,3,0.18)' : 'rgba(255,92,122,0.16)';

  return (
    <div className="mt-4 overflow-hidden rounded-[22px] border border-[#7DE4FF]/18 bg-[radial-gradient(circle_at_top_right,rgba(125,228,255,0.13),transparent_40%),rgba(2,12,18,0.9)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/12 bg-white/8">
            {chart.image ? <img src={chart.image} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-black text-white/52">{chart.symbol}</span>}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9AEAFF]">Token Chart</p>
            <h3 className="mt-1 text-2xl font-black text-white">{chart.name} <span className="text-[#76FF03]">${chart.symbol}</span></h3>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-white">{chart.priceLabel}</p>
          <p className={`text-sm font-black ${trendClass(chart.change24h)}`}>{chart.change24hLabel} 24h</p>
        </div>
      </div>

      <div className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/36 p-3">
            <svg viewBox="0 0 640 260" className="h-[250px] w-full" role="img" aria-label={`${chart.symbol} price chart`}>
              <defs>
                <linearGradient id={`mythos-chart-${chart.id}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={fillColor} />
                  <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </linearGradient>
              </defs>
              <path d={fillPath} fill={`url(#mythos-chart-${chart.id})`} />
              <path d={path} fill="none" stroke={lineColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
              <line x1="18" x2="622" y1="242" y2="242" stroke="rgba(255,255,255,0.12)" strokeDasharray="6 8" />
            </svg>
          </div>
          <div className="grid gap-3">
            {[
              ['Rank', chart.rank ? `#${chart.rank}` : 'unavailable'],
              ['Market cap', chart.marketCapLabel],
              ['24h volume', chart.volume24hLabel],
              ['Window', `${chart.days} dias`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-black/24 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/34">{label}</p>
                <p className="mt-1 text-sm font-black text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-white/54">{chart.summary}</p>
      </div>

      <div className="border-t border-white/8 px-4 py-3 text-[11px] leading-5 text-white/42">
        Fonte: CoinGecko. Read-only: nenhum swap, assinatura, compra, venda, pagamento ou envio de transacao foi executado.
      </div>
    </div>
  );
}
