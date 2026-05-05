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
      else setVal(Math.round(start));
    }, 25);
    return () => clearInterval(id);
  }, [target]);
  return <>{val.toLocaleString()}</>;
}

export default function MetricsDashboard({ section, allSources, meta }: MetricsDashboardProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold text-[#e2e8f0]">📈 {section.heading}</h2>
        <ConfidenceRing value={meta.avgConfidence} size="md" />
      </div>

      {/* Price card — first item highlighted */}
      {section.items[0] && (() => {
        const key0 = Object.keys(section.items[0])[0];
        const d0 = section.items[0][key0];
        const price = typeof d0?.value === 'number' ? d0.value : parseFloat(String(d0?.value ?? '0'));
        return (
          <div className="rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-[#64748b] mb-1">{key0}</p>
              <p className="text-[36px] font-bold font-mono text-[#00d4aa]">
                ${!isNaN(price) ? <AnimatedNumber target={price} /> : '—'}
              </p>
            </div>
            <ConfidenceRing value={meta.avgConfidence} size="lg" />
          </div>
        );
      })()}

      {/* Market data table */}
      {section.items.length > 1 && (
        <div className="rounded-xl border border-[#1e293b] overflow-hidden mb-2">
          <table className="w-full text-[13px]">
            <tbody>
              {section.items.slice(1).map((item, i) => {
                const key = Object.keys(item)[0];
                const data = item[key];
                const raw = data?.value;
                const num = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
                const isNum = !isNaN(num);
                const isPct = key.toLowerCase().includes('variação') || key.toLowerCase().includes('variacao');
                const isBig = isNum && Math.abs(num) > 1_000_000;
                const fmt = isBig
                  ? `$${(num / 1_000_000_000).toFixed(2)}B`
                  : isPct
                    ? `${num > 0 ? '+' : ''}${num.toFixed(2)}%`
                    : isNum ? `$${num.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}` : String(raw ?? '—');
                const color = isPct ? (num > 0 ? 'text-[#00d4aa]' : 'text-[#ef4444]') : 'text-[#e2e8f0]';
                return (
                  <tr key={key} className={i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'}>
                    <td className="px-4 py-2.5 text-[#64748b]">{key}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-semibold ${color}`}>{fmt}</td>
                    <td className="px-4 py-2 text-right w-16">
                      <div className="flex justify-end gap-0.5">
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
