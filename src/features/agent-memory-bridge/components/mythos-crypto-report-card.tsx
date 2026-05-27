'use client';

import { Activity, AlertTriangle, BarChart3, ShieldCheck, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import type { MythosCryptoMarketReport, MythosCryptoOpportunity, MythosCryptoCoin } from '@/lib/market/crypto-report';

function fmtUsd(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return 'unavailable';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  return `$${value.toLocaleString('en-US', { maximumSignificantDigits: 4 })}`;
}

function fmtPct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function sentimentLabel(value: MythosCryptoMarketReport['sentiment']) {
  if (value === 'risk_on') return 'Risk-on';
  if (value === 'risk_off') return 'Risk-off';
  return 'Cautious';
}

function MetricCard({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'green' | 'yellow' | 'neutral' }) {
  return (
    <div className={`rounded-2xl border p-4 ${
      tone === 'green'
        ? 'border-[#76FF03]/24 bg-[#76FF03]/9'
        : tone === 'yellow'
          ? 'border-[#FACC15]/24 bg-[#FACC15]/8'
          : 'border-white/8 bg-white/[0.04]'
    }`}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function CoinRow({ coin, mode }: { coin: MythosCryptoCoin; mode: 'up' | 'down' | 'trend' }) {
  const positive = mode !== 'down';
  return (
    <div className="flex items-center gap-3 border-b border-white/7 py-2.5 last:border-b-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/40">
        {coin.image ? <img src={coin.image} alt="" className="h-full w-full object-cover" /> : <BarChart3 className="h-4 w-4 text-white/40" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-black text-white">{coin.symbol}</p>
          {coin.rank ? <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/36">#{coin.rank}</span> : null}
        </div>
        <p className="truncate text-xs text-white/42">{coin.name}</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-bold text-white/72">{fmtUsd(coin.price)}</p>
        <p className={`text-xs font-black ${positive ? 'text-[#76FF03]' : 'text-[#FF5C8A]'}`}>
          {mode === 'trend' ? 'trending' : fmtPct(coin.change7d)}
        </p>
      </div>
    </div>
  );
}

function OpportunityCard({ item }: { item: MythosCryptoOpportunity }) {
  const color = item.conviction === 'high' ? '#76FF03' : item.conviction === 'medium' ? '#5AD7FF' : '#FACC15';
  const label = item.conviction === 'high' ? 'High conviction' : item.conviction === 'medium' ? 'Medium conviction' : 'Wait for confirmation';

  return (
    <div className="rounded-2xl border bg-black/38 p-4" style={{ borderColor: `${color}55` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]" style={{ borderColor: `${color}55`, color }}>
            {label}
          </span>
          <h4 className="mt-3 text-lg font-black text-white">{item.coin.symbol}</h4>
          <p className="text-xs text-white/48">{item.coin.name} · {fmtUsd(item.coin.price)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/32">Risk</p>
          <p className="text-lg font-black" style={{ color }}>{item.riskLevel}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.tags.map(tag => (
          <span key={tag} className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-white/54">
            {tag}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-white/58">{item.thesis}</p>
      <div className="mt-3 h-1.5 rounded-full bg-white/8">
        <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, item.riskLevel)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function MythosCryptoReportCard({ report }: { report: MythosCryptoMarketReport }) {
  return (
    <div className="mt-4 overflow-hidden rounded-[28px] border border-[#76FF03]/22 bg-[radial-gradient(circle_at_50%_0%,rgba(118,255,3,0.16),transparent_34%),linear-gradient(180deg,rgba(7,18,6,0.96),rgba(0,0,0,0.98))] p-5 shadow-[0_0_42px_rgba(118,255,3,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#76FF03]/24 bg-[#76FF03]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#A7FF3D]">
            <Sparkles className="h-3.5 w-3.5" />
            Mythos Market Intelligence
          </div>
          <h3 className="mt-3 text-2xl font-black text-white">Crypto market report</h3>
          <p className="mt-1 text-sm leading-6 text-white/54">
            Data via CoinGecko public API · {new Date(report.generatedAt).toLocaleString('en-US')}
          </p>
        </div>
        <div className="rounded-2xl border border-[#FACC15]/22 bg-[#FACC15]/8 px-4 py-3 text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FACC15]">Sentiment</p>
          <p className="mt-1 text-lg font-black text-white">{sentimentLabel(report.sentiment)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <MetricCard label="Market cap" value={report.global.marketCapLabel} tone="green" />
        <MetricCard label="BTC dominance" value={report.global.btcDominanceLabel} tone="yellow" />
        <MetricCard label="24h volume" value={report.global.volume24hLabel} />
        <MetricCard label="Active assets" value={report.global.activeCryptos?.toLocaleString('en-US') || 'unavailable'} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-[#76FF03]/16 bg-black/30 p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#76FF03]" />
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#76FF03]">Top gainers · 7d</p>
          </div>
          <div className="mt-3">{report.gainers.slice(0, 6).map(coin => <CoinRow key={coin.id} coin={coin} mode="up" />)}</div>
        </section>

        <section className="rounded-2xl border border-[#FF5C8A]/16 bg-black/30 p-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-[#FF5C8A]" />
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FF5C8A]">Weak names · 7d</p>
          </div>
          <div className="mt-3">{report.losers.slice(0, 6).map(coin => <CoinRow key={coin.id} coin={coin} mode="down" />)}</div>
        </section>

        <section className="rounded-2xl border border-[#5AD7FF]/16 bg-black/30 p-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#5AD7FF]" />
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5AD7FF]">Trending attention</p>
          </div>
          <div className="mt-3">{report.trending.slice(0, 6).map(coin => <CoinRow key={coin.id} coin={coin} mode="trend" />)}</div>
        </section>
      </div>

      <section className="mt-5">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Opportunity watchlist · not buy signals</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {report.opportunities.map(item => <OpportunityCard key={item.coin.id} item={item} />)}
        </div>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#FACC15]/16 bg-[#FACC15]/6 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[#FACC15]" />
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FACC15]">Pressure</p>
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-white/58">
            {report.macro.pressure.map(item => <li key={item}>- {item}</li>)}
          </ul>
        </section>
        <section className="rounded-2xl border border-[#76FF03]/16 bg-[#76FF03]/6 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#76FF03]" />
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#76FF03]">Catalysts</p>
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-white/58">
            {report.macro.catalysts.map(item => <li key={item}>- {item}</li>)}
          </ul>
        </section>
      </div>

      <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.04] p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">Executive summary</p>
        <p className="mt-2 text-sm leading-6 text-white/62">{report.executiveSummary}</p>
        <p className="mt-3 text-xs leading-5 text-[#FACC15]">
          Read-only market intelligence. Not financial advice. Mythos does not execute trades from this report.
        </p>
      </div>
    </div>
  );
}
