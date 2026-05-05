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

function GaugeArc({ pct }: { pct: number }) {
  const color = pct >= 71 ? '#00d4aa' : pct >= 41 ? '#f59e0b' : '#ef4444';
  const r = 28; const cx = 36; const cy = 36;
  const startAngle = -180; const endAngle = 0;
  const angle = startAngle + (pct / 100) * (endAngle - startAngle);
  const rad = (a: number) => (a * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(startAngle));
  const y1 = cy + r * Math.sin(rad(startAngle));
  const x2 = cx + r * Math.cos(rad(angle));
  const y2 = cy + r * Math.sin(rad(angle));
  const large = pct > 50 ? 1 : 0;
  return (
    <svg width="72" height="40" viewBox="0 0 72 40">
      <path d={`M ${cx + r * Math.cos(rad(-180))},${cy + r * Math.sin(rad(-180))} A ${r},${r} 0 0,1 ${cx + r},${cy}`}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" strokeLinecap="round" />
      {pct > 0 && (
        <path d={`M ${x1},${y1} A ${r},${r} 0 ${large},1 ${x2},${y2}`}
          fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
      )}
    </svg>
  );
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {section.items.map((item, i) => {
          const key = Object.keys(item)[0];
          const data = item[key];
          const raw = data?.value;
          const numVal = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '0').replace(/[^0-9.]/g, ''));
          const isValid = !isNaN(numVal);
          const pct = Math.min(100, Math.max(0, isValid ? (numVal > 1000 ? 80 : numVal) : 50));

          return (
            <div key={key} className="cogn-animate rounded-xl border border-[#1e293b] bg-[#111118] p-4"
              style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex justify-center mb-1"><GaugeArc pct={pct} /></div>
              <p className="text-center text-[22px] font-bold font-mono text-[#00d4aa]">
                {isValid ? <AnimatedNumber target={numVal} /> : String(raw ?? '—')}
              </p>
              <p className="text-center text-[11px] text-[#64748b] mt-0.5">{key}</p>
              <div className="flex justify-center flex-wrap gap-1 mt-2">
                {(data?.sources ?? []).map(id => <SourceBadge key={id} id={id} sources={allSources} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
