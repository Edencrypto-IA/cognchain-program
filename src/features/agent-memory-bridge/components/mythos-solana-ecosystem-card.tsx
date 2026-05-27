'use client';

import { Activity, BarChart3, CircleDollarSign, Layers3, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import type { MythosSolanaEcosystemReport, SolanaProtocolSummary } from '@/lib/market/solana-ecosystem-report';

function fmtPct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function protocolTone(category: string) {
  const text = category.toLowerCase();
  if (text.includes('aggregator')) return { color: '#FACC15', label: 'Aggregator' };
  if (text.includes('dex')) return { color: '#5AD7FF', label: category };
  if (text.includes('staking')) return { color: '#A78BFA', label: category };
  if (text.includes('lending') || text.includes('yield')) return { color: '#FB7185', label: category };
  return { color: '#76FF03', label: category };
}

function Metric({ label, value, sub, tone = 'green' }: { label: string; value: string; sub?: string; tone?: 'green' | 'blue' | 'yellow' | 'neutral' }) {
  const colors = {
    green: 'border-[#76FF03]/22 bg-[#76FF03]/9',
    blue: 'border-[#5AD7FF]/22 bg-[#5AD7FF]/8',
    yellow: 'border-[#FACC15]/22 bg-[#FACC15]/8',
    neutral: 'border-white/8 bg-white/[0.04]',
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      {sub ? <p className="mt-1 text-xs text-white/44">{sub}</p> : null}
    </div>
  );
}

function ProtocolRow({ protocol, index, maxTvl }: { protocol: SolanaProtocolSummary; index: number; maxTvl: number }) {
  const tone = protocolTone(protocol.category);
  const width = maxTvl > 0 ? Math.max(8, Math.round((protocol.tvlUsd / maxTvl) * 100)) : 8;
  return (
    <div className="rounded-2xl border border-white/8 bg-black/30 p-3">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xs font-black text-white/62">
          #{index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-black text-white">{protocol.name}</p>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold" style={{ borderColor: `${tone.color}55`, color: tone.color }}>
              {tone.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-white/42">
            1d {fmtPct(protocol.change1d)} · 7d {fmtPct(protocol.change7d)}
          </p>
        </div>
        <p className="text-right text-sm font-black text-white">{protocol.tvlLabel}</p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white/8">
        <div className="h-2 rounded-full" style={{ width: `${width}%`, backgroundColor: tone.color }} />
      </div>
    </div>
  );
}

export default function MythosSolanaEcosystemCard({ report }: { report: MythosSolanaEcosystemReport }) {
  const changePositive = (report.price.change24h ?? 0) >= 0;
  const maxTvl = report.defi.topProtocols[0]?.tvlUsd || 0;

  return (
    <div className="mt-4 overflow-hidden rounded-[28px] border border-[#14F195]/24 bg-[radial-gradient(circle_at_50%_0%,rgba(20,241,149,0.18),transparent_34%),linear-gradient(180deg,rgba(2,16,10,0.98),rgba(0,0,0,0.99))] p-5 shadow-[0_0_46px_rgba(20,241,149,0.09)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#14F195]/24 bg-[#14F195]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#14F195]">
            <Layers3 className="h-3.5 w-3.5" />
            Solana ecosystem intelligence
          </div>
          <h3 className="mt-3 text-2xl font-black text-white">SOL price + top protocols</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-white/56">{report.readout.plainEnglish}</p>
        </div>
        <div className={`rounded-2xl border px-4 py-3 text-right ${changePositive ? 'border-[#76FF03]/22 bg-[#76FF03]/10' : 'border-[#FF5C8A]/22 bg-[#FF5C8A]/10'}`}>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/42">24h move</p>
          <div className="mt-1 flex items-center gap-2">
            {changePositive ? <TrendingUp className="h-4 w-4 text-[#76FF03]" /> : <TrendingDown className="h-4 w-4 text-[#FF5C8A]" />}
            <p className={`text-lg font-black ${changePositive ? 'text-[#76FF03]' : 'text-[#FF5C8A]'}`}>{report.price.change24hLabel}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Metric label="SOL / USD" value={report.price.label} sub={report.price.rank ? `Rank #${report.price.rank}` : 'CoinGecko'} tone="green" />
        <Metric label="Market cap" value={report.price.marketCapLabel} sub="SOL network value" tone="neutral" />
        <Metric label="24h volume" value={report.price.volume24hLabel} sub="spot market activity" tone="blue" />
        <Metric label="Solana DeFi TVL" value={report.defi.totalTvlLabel} sub={`${report.defi.protocolCount} top protocols sampled`} tone="yellow" />
        <Metric label="ATH" value={report.price.athLabel} sub={`Circulating ${report.price.circulatingLabel} SOL`} tone="neutral" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_340px]">
        <section className="rounded-2xl border border-white/8 bg-black/24 p-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#14F195]" />
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#14F195]">Top 10 protocols by TVL</p>
          </div>
          <div className="mt-4 grid gap-3">
            {report.defi.topProtocols.map((protocol, index) => (
              <ProtocolRow key={`${protocol.name}-${index}`} protocol={protocol} index={index} maxTvl={maxTvl} />
            ))}
          </div>
        </section>

        <aside className="grid gap-4">
          <section className="rounded-2xl border border-[#14F195]/18 bg-[#14F195]/8 p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#14F195]" />
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#14F195]">Mythos readout</p>
            </div>
            <h4 className="mt-3 text-lg font-black text-white">{report.readout.headline}</h4>
            <p className="mt-2 text-sm leading-6 text-white/58">{report.readout.nextSafeStep}</p>
          </section>

          <section className="rounded-2xl border border-[#5AD7FF]/18 bg-[#5AD7FF]/8 p-4">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-[#5AD7FF]" />
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5AD7FF]">How to read this</p>
            </div>
            <div className="mt-3 space-y-3 text-sm leading-6 text-white/58">
              <p>Price shows what traders pay for SOL now.</p>
              <p>TVL shows where users and liquidity are active inside Solana apps.</p>
              <p>Protocol rank is useful for research, but it is not proof that a protocol is safe.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-[#FACC15]/18 bg-[#FACC15]/7 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#FACC15]" />
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FACC15]">Safety</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/58">
              Read-only market intelligence. Not financial advice. Mythos does not connect to your wallet, sign, swap, or move funds from this card.
            </p>
          </section>
        </aside>
      </div>

      <p className="mt-4 text-xs text-white/36">
        Sources: {report.sources.join(' · ')} · Updated {new Date(report.generatedAt).toLocaleString('en-US')}
      </p>
    </div>
  );
}
