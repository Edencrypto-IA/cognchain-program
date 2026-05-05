'use client';
import type { CognitiveStep } from './types';
import CognitiveActionItem from './CognitiveActionItem';
import CheckpointBadge from './CheckpointBadge';

const TYPE_ICON: Record<CognitiveStep['type'], string> = {
  analysis: '🔍', data_collection: '🌐', verification: '⚖️',
  synthesis: '🧠', anchoring: '⛓️',
};

const MODEL_COLORS: Record<string, string> = {
  gpt: '#10b981', claude: '#f97316', deepseek: '#06b6d4',
  nvidia: '#76B900', gemini: '#4285F4', glm: '#00D1FF',
  minimax: '#FF6B9D', qwen: '#A855F7',
};

function modelColor(model: string) {
  const k = Object.keys(MODEL_COLORS).find(k => model.toLowerCase().includes(k));
  return k ? MODEL_COLORS[k] : '#64748b';
}

export default function CognitiveStepCard({ step, isActive }: { step: CognitiveStep; isActive: boolean }) {
  const borderColor = step.status === 'completed' ? '#00d4aa'
    : step.status === 'running' ? '#f59e0b'
    : step.status === 'error' ? '#ef4444'
    : step.status === 'paused' ? '#8b5cf6'
    : '#1e293b';

  const numBg = step.status === 'completed' ? '#00d4aa'
    : step.status === 'running' ? '#f59e0b'
    : '#1e293b';

  return (
    <div
      className="rounded-xl p-4 mb-3 transition-all duration-300"
      style={{
        background: '#111118',
        borderLeft: `3px solid ${borderColor}`,
        border: `1px solid #1e293b`,
        borderLeftColor: borderColor,
        boxShadow: isActive ? `0 0 20px rgba(245,158,11,0.08)` : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0"
          style={{ background: numBg, color: '#000' }}>
          {step.status === 'completed' ? '✓' : step.id}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#64748b]">
              {TYPE_ICON[step.type]} {step.title}
            </span>
            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" />}
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
          style={{ color: modelColor(step.model), borderColor: modelColor(step.model) + '40', background: modelColor(step.model) + '15' }}>
          {step.model}
        </span>
      </div>

      {/* Thought */}
      {step.thought && (
        <p className="text-[13px] text-[#94a3b8] leading-relaxed mb-3 whitespace-pre-line">{step.thought}</p>
      )}

      {/* Actions */}
      {step.actions.length > 0 && (
        <div className="border-l-2 border-[#1e293b] pl-3 mb-3 space-y-0.5">
          {step.actions.map((a, i) => <CognitiveActionItem key={i} action={a} />)}
        </div>
      )}

      {/* Confidence */}
      {step.confidence != null && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] text-[#64748b]">Confiança</span>
          <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${step.confidence}%`, background: step.confidence >= 70 ? '#00d4aa' : step.confidence >= 50 ? '#f59e0b' : '#ef4444' }} />
          </div>
          <span className="text-[11px] font-mono text-[#e2e8f0]">{step.confidence}%</span>
        </div>
      )}

      {/* Checkpoint */}
      {step.checkpoint && <CheckpointBadge checkpoint={step.checkpoint} />}

      {/* Duration */}
      {step.durationMs != null && (
        <p className="text-[10px] text-[#475569] mt-2">⏱️ {(step.durationMs / 1000).toFixed(2)}s</p>
      )}
    </div>
  );
}
