'use client';
import { useState } from 'react';
import type { ResponseSection, FactSource, VerificationMeta } from '@/lib/grounding/types';
import ConfidenceRing from './shared/ConfidenceRing';

interface TimelineDashboardProps {
  section: ResponseSection;
  allSources: FactSource[];
  meta: VerificationMeta;
}

const STATUS_ICON: Record<string, string> = { done: '✅', active: '🔄', pending: '🔜' };

function inferStatus(val: unknown): 'done' | 'active' | 'pending' {
  const s = String(val ?? '').toLowerCase();
  if (s.includes('✅') || s.includes('concluído') || s.includes('done')) return 'done';
  if (s.includes('🔄') || s.includes('andamento') || s.includes('active')) return 'active';
  return 'pending';
}

export default function TimelineDashboard({ section, allSources: _allSources, meta }: TimelineDashboardProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[15px] font-semibold text-[#e2e8f0]">📅 {section.heading}</h2>
        <ConfidenceRing value={meta.avgConfidence} size="md" />
      </div>

      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute left-[15px] top-4 bottom-4 w-px bg-gradient-to-b from-[#00d4aa]/60 via-[#f59e0b]/40 to-[#64748b]/20" />

        <div className="space-y-3 pl-10">
          {section.items.map((item, i) => {
            const key = Object.keys(item)[0];
            const data = item[key];
            const status = inferStatus(data?.value);
            const isOpen = expanded[i];
            const dotColor = status === 'done' ? '#00d4aa' : status === 'active' ? '#f59e0b' : '#334155';

            return (
              <div key={i} className="relative">
                {/* Dot */}
                <div className="absolute -left-[26px] top-3 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                  style={{ background: dotColor, borderColor: dotColor, boxShadow: status !== 'pending' ? `0 0 8px ${dotColor}66` : 'none' }}>
                  {status === 'active' && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                </div>

                <button
                  onClick={() => setExpanded(e => ({ ...e, [i]: !e[i] }))}
                  className="w-full text-left rounded-xl border border-[#1e293b] bg-[#111118] p-3 hover:border-[#334155] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{STATUS_ICON[status]}</span>
                      <span className="text-[13px] font-medium text-[#e2e8f0]">{key}</span>
                    </div>
                    <span className="text-[#64748b] text-xs">{isOpen ? '▲' : '▼'}</span>
                  </div>
                  {isOpen && (
                    <p className="mt-2 text-[12px] text-[#64748b] leading-relaxed">{String(data?.value ?? '')}</p>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
