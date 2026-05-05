'use client';
import { useState } from 'react';
import type { ResponseSection, FactSource, VerificationMeta } from '@/lib/grounding/types';
import SourceBadge from './shared/SourceBadge';
import ConfidenceRing from './shared/ConfidenceRing';

interface ProcessDashboardProps {
  section: ResponseSection;
  allSources: FactSource[];
  meta: VerificationMeta;
}

type StepStatus = 'done' | 'active' | 'waiting';

function stepStatus(i: number, active: number): StepStatus {
  if (i < active) return 'done';
  if (i === active) return 'active';
  return 'waiting';
}

const STATUS_STYLE: Record<StepStatus, { border: string; badge: string; icon: string }> = {
  done:    { border: 'border-[#00d4aa]/30', badge: 'bg-[#00d4aa]/10 text-[#00d4aa]',    icon: '✅' },
  active:  { border: 'border-[#f59e0b]/40', badge: 'bg-[#f59e0b]/10 text-[#f59e0b]',    icon: '🔄' },
  waiting: { border: 'border-[#1e293b]',    badge: 'bg-white/[0.04] text-[#64748b]',      icon: '⏸️' },
};

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <div className="relative mt-2 rounded-lg border border-[#1e293b] bg-black/40 overflow-hidden">
      <pre className="text-[11px] text-[#00d4aa] font-mono px-3 py-2 overflow-x-auto">{code}</pre>
      <button onClick={copy}
        className="absolute top-1.5 right-2 text-[10px] px-2 py-0.5 rounded border border-[#1e293b] text-[#64748b] hover:text-[#00d4aa] transition-colors">
        {copied ? '✅' : '📋'}
      </button>
    </div>
  );
}

export default function ProcessDashboard({ section, allSources, meta }: ProcessDashboardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const items = section.items;
  const progress = Math.round((activeStep / Math.max(items.length - 1, 1)) * 100);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-[#e2e8f0]">🔧 {section.heading}</h2>
        <ConfidenceRing value={meta.avgConfidence} size="md" />
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-white/[0.06] mb-5 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-[#00d4aa] to-[#00a8e8] transition-all duration-500"
          style={{ width: `${progress}%` }} />
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {items.map((item, i) => {
          const key = Object.keys(item)[0];
          const data = item[key];
          const status = stepStatus(i, activeStep);
          const st = STATUS_STYLE[status];
          const val = String(data?.value ?? '');
          const isCode = val.startsWith('$') || val.startsWith('npm') || val.startsWith('bun') || val.startsWith('anchor') || val.startsWith('sh');

          return (
            <div key={i} className={`rounded-xl border ${st.border} bg-[#111118] p-4 transition-all`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-base mt-0.5">{st.icon}</span>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-[#e2e8f0] mb-1">
                      {i + 1}. {key}
                    </p>
                    {isCode ? <CodeBlock code={val} /> : (
                      <p className="text-[12px] text-[#64748b]">{val}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(data?.sources ?? []).map(id => <SourceBadge key={id} id={id} sources={allSources} />)}
                    </div>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${st.badge}`}>{status}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex gap-2 mt-4">
        {activeStep > 0 && (
          <button onClick={() => setActiveStep(s => s - 1)}
            className="px-3 py-1.5 text-[11px] rounded-lg border border-[#1e293b] text-[#64748b] hover:text-[#e2e8f0] transition-colors">
            ◀ Anterior
          </button>
        )}
        {activeStep < items.length - 1 && (
          <button onClick={() => setActiveStep(s => s + 1)}
            className="px-3 py-1.5 text-[11px] rounded-lg border border-[#00d4aa]/30 text-[#00d4aa] hover:bg-[#00d4aa]/10 transition-colors">
            Próximo ▶
          </button>
        )}
      </div>
    </div>
  );
}
