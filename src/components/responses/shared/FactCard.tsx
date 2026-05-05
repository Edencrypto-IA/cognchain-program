'use client';
import type { VerifiedFact } from '@/lib/grounding/types';
import SourceBadge from './SourceBadge';

interface FactCardProps {
  fact: VerifiedFact;
  index?: number;
}

export default function FactCard({ fact, index = 0 }: FactCardProps) {
  const isLow = fact.confidence < 70;
  const isNum = typeof fact.value === 'number' || (typeof fact.value === 'string' && !isNaN(parseFloat(fact.value as string)));

  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-300 cogn-animate cogn-animate-${Math.min(index + 1, 4)}`}
      style={{
        background: 'var(--cogn-surface)',
        borderColor: isLow ? 'rgba(245,158,11,0.3)' : 'var(--cogn-border)',
        animationDelay: `${index * 60}ms`,
      }}
    >
      {isLow && (
        <div className="mb-2 px-2 py-1 rounded text-[11px] bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20">
          ⚠️ Baixa confiança ({fact.confidence}%)
        </div>
      )}
      <p className="text-[13px] text-[#e2e8f0] leading-relaxed mb-1">{fact.claim}</p>
      {fact.value !== undefined && fact.value !== null && (
        <p className={`font-mono font-bold ${isNum ? 'text-xl text-[#00d4aa]' : 'text-sm text-[#e2e8f0]'}`}>
          {String(fact.value)}{fact.unit ? ` ${fact.unit}` : ''}
        </p>
      )}
      <div className="flex flex-wrap gap-1 mt-2">
        {fact.sources.map(s => (
          <SourceBadge key={s.id} id={s.id} sources={fact.sources} />
        ))}
      </div>
    </div>
  );
}
