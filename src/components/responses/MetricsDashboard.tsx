'use client';
import { useEffect, useState } from 'react';
import type { ResponseSection, FactSource, VerificationMeta } from '@/lib/grounding/types';
import SourceBadge from './shared/SourceBadge';
import ConfidenceRing from './shared/ConfidenceRing';

interface MetricsDashboardProps {
  section: ResponseSection;
  allSources: FactSource[];
  meta: VerificationMeta;
}

function AnimatedNumber({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / 30;
    const id = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(id); }
      else setVal(Math.round(start * 100) / 100);
    }, 25);
    return () => clearInterval(id);
  }, [target]);
  return <>{val.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}</>;
}

function parseNum(raw: unknown): number | null {
  if (typeof raw === 'number') return raw;
  const n = parseFloat(String(raw ?? ''));
  return isNaN(n) ? null : n;
}

function formatValue(raw: unknown, key: string): string {
  const num = parseNum(raw);
  if (num === null) return String(raw ?? '—');
  const isPct = /variação|variacao/i.test(key);
  const isBig = Math.abs(num) > 1_000_000;
  if (isPct) return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
  if (isBig) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  return `$${num.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}`;
}

function isMarketDataKey(key: string): boolean {
  return /máxima|mínima|volume|market.?cap|variação/i.test(key);
}

export default function MetricsDashboard({ section, allSources, meta }: MetricsDashboardProps) {
  const allKeys = section.items.map(item => Object.keys(item)[0]);
  // Multi-token mode: multiple items and none of them are market-data rows
  const isMultiToken = section.items.length > 1 && allKeys.every(k => !isMarketDataKey(k));

  // ── Multi-token: price grid ────────────────────────────────────────────────
  if (isMultiToken) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-[#64748b] uppercase tracking-wider">Preços em Tempo Real</h2>
          <ConfidenceRing value={meta.avgConfidence} size="sm" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {section.items.map((item, i) => {
            const key = Object.keys(item)[0];
            const data = item[key];
            const num = parseNum(data?.value);
            const token = key.split(' ').pop() ?? key;
            return (
              <div
                key={i}
                className="rounded-xl border border-[#9945FF]/20 bg-gradient-to-br from-[#9945FF]/5 to-[#14F195]/5 p-4 hover:border-[#9945FF]/40 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-widest">{token}</span>
                  <ConfidenceRing value={meta.avgConfidence} size="sm" />
                </div>
                <p className="text-[28px] font-bold font-mono text-[#14F195] leading-none mb-3">
                  {num !== null ? <>$<AnimatedNumber target={num} /></> : '—'}
                </p>
                <div className="flex flex-wrap gap-1">
                  {(data?.sources ?? []).map(id => <SourceBadge key={id} id={id} sources={allSources} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Single-token: price card + market data table ───────────────────────────
  const priceItem = section.items[0];
  const priceKey = priceItem ? Object.keys(priceItem)[0] : '';
  const priceData = priceItem?.[priceKey];
  const priceNum = parseNum(priceData?.value);

  return (
    <div className="w-full">
      {/* Price card */}
      {priceItem && (
        <div className="rounded-xl border border-[#14F195]/25 bg-gradient-to-br from-[#14F195]/5 to-[#9945FF]/5 p-4 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#64748b] uppercase tracking-widest mb-1">{priceKey}</p>
              <p className="text-[42px] font-bold font-mono text-[#14F195] leading-none">
                {priceNum !== null ? <>$<AnimatedNumber target={priceNum} /></> : '—'}
              </p>
            </div>
            <ConfidenceRing value={meta.avgConfidence} size="lg" />
          </div>
          <div className="flex flex-wrap gap-1 mt-3">
            {(priceData?.sources ?? []).map(id => <SourceBadge key={id} id={id} sources={allSources} />)}
          </div>
        </div>
      )}

      {/* Market data table */}
      {section.items.length > 1 && (
        <div className="rounded-xl border border-[#1e293b] overflow-hidden">
          <table className="w-full text-[13px]">
            <tbody>
              {section.items.slice(1).map((item, i) => {
                const key = Object.keys(item)[0];
                const data = item[key];
                const fmt = formatValue(data?.value, key);
                const isPct = /variação|variacao/i.test(key);
                const num = parseNum(data?.value);
                const color = isPct
                  ? (num !== null && num > 0 ? 'text-[#14F195]' : 'text-[#ef4444]')
                  : 'text-[#e2e8f0]';
                return (
                  <tr key={key} className={i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'}>
                    <td className="px-4 py-2.5 text-[#64748b] text-[12px]">{key}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-semibold ${color}`}>{fmt}</td>
                    <td className="px-3 py-2 text-right w-20">
                      <div className="flex justify-end gap-1">
                        {(data?.sources ?? []).map(id => <SourceBadge key={id} id={id} sources={allSources} />)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
