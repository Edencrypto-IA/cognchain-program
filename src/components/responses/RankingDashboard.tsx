'use client';
import type { ResponseSection, FactSource, VerificationMeta } from '@/lib/grounding/types';
import SourceBadge from './shared/SourceBadge';
import ConfidenceRing from './shared/ConfidenceRing';

interface RankingDashboardProps {
  section: ResponseSection;
  allSources: FactSource[];
  meta: VerificationMeta;
}

const MEDALS = ['🥇', '🥈', '🥉'];

function Sparkline({ positive }: { positive: boolean }) {
  const points = Array.from({ length: 7 }, (_, i) => {
    const base = 20 + Math.sin(i * 0.8 + (positive ? 0 : Math.PI)) * 8;
    return `${i * 14},${30 - base + (positive ? -i * 1.5 : i * 1.5)}`;
  }).join(' ');
  const color = positive ? '#00d4aa' : '#ef4444';
  return (
    <svg width="90" height="30" viewBox="0 0 90 30" className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function RankingDashboard({ section, allSources, meta }: RankingDashboardProps) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold text-[#e2e8f0]">📊 {section.heading}</h2>
        <ConfidenceRing value={meta.avgConfidence} size="md" />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 cogn-grid-4">
        {section.items.map((item, idx) => {
          const key = Object.keys(item)[0];
          const data = item[key];
          const val = data?.value;
          const srcs = data?.sources ?? [];
          const note = data?.note;
          const isLow = !!note;
          const isPositive = typeof val === 'string' && val.includes('+');

          return (
            <div
              key={key}
              className={`cogn-animate rounded-xl border p-4 transition-all duration-200 hover:scale-[1.02]
                ${isLow ? 'border-[#f59e0b]/30 bg-[#111118]' : 'border-[#1e293b] bg-[#111118] hover:border-[#00d4aa]/30'}`}
              style={{ animationDelay: `${idx * 100}ms`, boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg">{MEDALS[idx] ?? `#${idx + 1}`}</span>
                {isLow && <span className="text-[10px] text-[#f59e0b] border border-[#f59e0b]/20 rounded px-1">⚠️ Verificar</span>}
              </div>
              <p className="text-[13px] font-semibold text-[#e2e8f0] mb-1 truncate">{key}</p>
              <p className="text-[18px] font-bold font-mono text-[#00d4aa] mb-2">{String(val ?? '—')}</p>
              <Sparkline positive={isPositive} />
              <div className="flex flex-wrap gap-1 mt-2">
                {srcs.map(id => <SourceBadge key={id} id={id} sources={allSources} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
