'use client';
import type { ResponseSection, FactSource, VerificationMeta } from '@/lib/grounding/types';
import SourceBadge from './shared/SourceBadge';
import ConfidenceRing from './shared/ConfidenceRing';

interface AnalysisDashboardProps {
  section: ResponseSection;
  allSources: FactSource[];
  meta: VerificationMeta;
}

const QUADRANTS = [
  { label: '💪 Forças',        key: 'forcas',        border: 'border-l-[#00d4aa]', bg: 'bg-[#00d4aa]/5'  },
  { label: '😰 Fraquezas',     key: 'fraquezas',     border: 'border-l-[#ef4444]', bg: 'bg-[#ef4444]/5'  },
  { label: '🚀 Oportunidades', key: 'oportunidades', border: 'border-l-[#00a8e8]', bg: 'bg-[#00a8e8]/5'  },
  { label: '⚠️ Ameaças',       key: 'ameacas',       border: 'border-l-[#f59e0b]', bg: 'bg-[#f59e0b]/5'  },
];

const SCORES = [85, 45, 78, 62];
const SCORE_COLORS = ['#00d4aa', '#ef4444', '#00a8e8', '#f59e0b'];

function RadialScore({ value, color }: { value: number; color: string }) {
  const r = 14; const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 600ms ease-out' }} />
      <text x="18" y="18" textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif"
        style={{ transform: 'rotate(90deg)', transformOrigin: '18px 18px' }}>
        {value}
      </text>
    </svg>
  );
}

export default function AnalysisDashboard({ section, allSources, meta }: AnalysisDashboardProps) {
  const items = section.items;
  const overall = Math.round(SCORES.reduce((s, n) => s + n, 0) / SCORES.length);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold text-[#e2e8f0]">🔍 {section.heading}</h2>
        <ConfidenceRing value={meta.avgConfidence} size="md" />
      </div>

      {/* 2x2 SWOT grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {QUADRANTS.map((q, qi) => {
          const qItems = items.filter((_, i) => Math.floor(i / Math.ceil(items.length / 4)) === qi);
          const color = SCORE_COLORS[qi];

          return (
            <div key={q.key}
              className={`rounded-xl border border-[#1e293b] border-l-4 ${q.border} ${q.bg} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-semibold text-[#e2e8f0]">{q.label}</span>
                <RadialScore value={SCORES[qi]} color={color} />
              </div>
              <ul className="space-y-1.5">
                {qItems.length > 0 ? qItems.map((item, ii) => {
                  const key = Object.keys(item)[0];
                  const data = item[key];
                  return (
                    <li key={ii} className="flex items-start gap-1.5 text-[12px] text-[#64748b]">
                      <span style={{ color }} className="mt-0.5">•</span>
                      <span className="flex-1">{key}</span>
                      <div className="flex gap-0.5">{(data?.sources ?? []).map(id => <SourceBadge key={id} id={id} sources={allSources} />)}</div>
                    </li>
                  );
                }) : (
                  <li className="text-[11px] text-[#64748b]/50 italic">Sem dados suficientes</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Overall score */}
      <div className="rounded-xl border border-[#1e293b] bg-[#111118] p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] text-[#64748b]">📊 Score Geral</span>
          <span className="text-[14px] font-bold text-[#00d4aa]">{overall}/100 · 📈 Alta</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[#00d4aa] to-[#00a8e8] transition-all duration-700"
            style={{ width: `${overall}%` }} />
        </div>
      </div>
    </div>
  );
}
