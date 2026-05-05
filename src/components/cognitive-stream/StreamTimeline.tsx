'use client';
import type { CognitiveStep } from './types';

const TYPE_ICON: Record<CognitiveStep['type'], string> = {
  analysis: '🔍', data_collection: '🌐', verification: '⚖️',
  synthesis: '🧠', anchoring: '⛓️',
};

export default function StreamTimeline({ steps, currentId }: { steps: CognitiveStep[]; currentId: number }) {
  return (
    <div className="flex flex-col gap-1 py-2">
      {steps.map(s => {
        const isCurrent = s.id === currentId;
        const isDone = s.status === 'completed';
        return (
          <div key={s.id} className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-all
            ${isCurrent ? 'bg-[#f59e0b]/10 text-[#f59e0b]' : isDone ? 'text-[#00d4aa]' : 'text-[#475569]'}`}>
            <span className="w-4 text-center">{TYPE_ICON[s.type]}</span>
            <span className="flex-1 truncate">{s.title}</span>
            {s.durationMs != null && <span className="text-[10px] opacity-60">{(s.durationMs / 1000).toFixed(1)}s</span>}
            {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" />}
            {isDone && <span className="text-[10px]">✓</span>}
          </div>
        );
      })}
    </div>
  );
}
