'use client';
import type { ResponseSection, FactSource, VerificationMeta } from '@/lib/grounding/types';
import SourceBadge from './shared/SourceBadge';
import ConfidenceRing from './shared/ConfidenceRing';

interface ComparisonDashboardProps {
  section: ResponseSection;
  allSources: FactSource[];
  meta: VerificationMeta;
}

export default function ComparisonDashboard({ section, allSources, meta }: ComparisonDashboardProps) {
  const items = section.items;
  const half = Math.ceil(items.length / 2);
  const leftItems = items.slice(0, half);
  const rightItems = items.slice(half);

  const leftLabel = Object.keys(leftItems[0] ?? {})[0]?.split(':')[0] ?? 'A';
  const rightLabel = Object.keys(rightItems[0] ?? {})[0]?.split(':')[0] ?? 'B';

  let leftWins = 0;
  let rightWins = 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold text-[#e2e8f0]">⚖️ {section.heading}</h2>
        <ConfidenceRing value={meta.avgConfidence} size="md" />
      </div>

      {/* Score cards */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 p-4 text-center">
          <p className="text-xs text-[#64748b] mb-1">{leftLabel}</p>
          <p className="text-3xl font-bold text-[#00d4aa]">{leftWins}</p>
          <p className="text-xs text-[#64748b]">vitórias</p>
        </div>
        <span className="text-[#64748b] text-xl font-bold">VS</span>
        <div className="flex-1 rounded-xl border border-[#00a8e8]/20 bg-[#00a8e8]/5 p-4 text-center">
          <p className="text-xs text-[#64748b] mb-1">{rightLabel}</p>
          <p className="text-3xl font-bold text-[#00a8e8]">{rightWins}</p>
          <p className="text-xs text-[#64748b]">vitórias</p>
        </div>
      </div>

      {/* Comparison table */}
      <div className="rounded-xl border border-[#1e293b] overflow-hidden">
        <table className="cogn-table w-full">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-[11px] text-[#64748b] uppercase tracking-wider border-b border-[#1e293b]">Atributo</th>
              <th className="text-left px-3 py-2 text-[11px] text-[#00d4aa] uppercase tracking-wider border-b border-[#1e293b]">{leftLabel}</th>
              <th className="text-left px-3 py-2 text-[11px] text-[#00a8e8] uppercase tracking-wider border-b border-[#1e293b]">{rightLabel}</th>
              <th className="text-left px-3 py-2 text-[11px] text-[#64748b] uppercase tracking-wider border-b border-[#1e293b]">Vencedor</th>
            </tr>
          </thead>
          <tbody>
            {leftItems.map((lItem, i) => {
              const lKey = Object.keys(lItem)[0];
              const rItem = rightItems[i];
              const rKey = rItem ? Object.keys(rItem)[0] : null;
              const lData = lItem[lKey];
              const rData = rItem && rKey ? rItem[rKey] : null;
              const attr = lKey?.split(':')[1] ?? lKey;
              const winner = lData && rData ? leftLabel : leftLabel;
              leftWins++;

              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.01]'}>
                  <td className="px-3 py-2.5 text-[12px] text-[#e2e8f0]">{attr}</td>
                  <td className="px-3 py-2.5 text-[12px] font-mono text-[#00d4aa]">
                    {String(lData?.value ?? '—')}
                    <span className="ml-1">{(lData?.sources ?? []).map(id => <SourceBadge key={id} id={id} sources={allSources} />)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] font-mono text-[#00a8e8]">
                    {rData ? String(rData.value ?? '—') : '—'}
                    <span className="ml-1">{(rData?.sources ?? []).map(id => <SourceBadge key={id} id={id} sources={allSources} />)}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20">
                      ✅ {winner}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
