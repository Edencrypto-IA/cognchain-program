'use client';

import { useState } from 'react';
import { Brain, Hash, Shield, ExternalLink, Clock, Star } from 'lucide-react';

interface Memory {
  hash: string;
  content: string;
  model: string;
  score: number | null;
  verified: boolean;
  timestamp: number;
}

interface ContextVisualizationProps {
  memories: Memory[];
}

const MODEL_LABELS: Record<string, string> = {
  gpt: 'GPT-4o', claude: 'Claude 3.5', nvidia: 'Llama', gemini: 'Gemini Pro',
};

const MODEL_COLORS: Record<string, string> = {
  gpt: 'bg-green-500/20 text-green-400',
  claude: 'bg-orange-500/20 text-orange-400',
  nvidia: 'bg-purple-500/20 text-purple-400',
  gemini: 'bg-blue-500/20 text-blue-400',
};

function MemoryCard({ memory }: { memory: Memory }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = memory.content.length > 120;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-sm transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.05]">
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 h-full w-1 rounded-full bg-gradient-to-b from-[#9945FF] to-[#00D1FF]"
        style={{ opacity: 0.4 + (memory.score || 0) * 0.006 }} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="flex items-center gap-1 text-white/30">
              <Hash className="h-3 w-3" />
              <span className="font-mono text-[11px]">{memory.hash.slice(0, 6)}...{memory.hash.slice(-4)}</span>
            </div>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${MODEL_COLORS[memory.model] ?? 'bg-white/10 text-white/50'}`}>
              {MODEL_LABELS[memory.model] ?? memory.model}
            </span>
            {memory.verified && (
              <div className="flex items-center gap-0.5">
                <Shield className="h-3 w-3 text-[#14F195]" />
                <span className="text-[10px] font-medium text-[#14F195]">Verificada</span>
              </div>
            )}
            {memory.score !== null && (
              <div className="flex items-center gap-0.5">
                <Star className="h-3 w-3 text-[#00D1FF]" />
                <span className="text-[10px] font-medium text-[#00D1FF]">{memory.score.toFixed(1)}</span>
              </div>
            )}
            <div className="flex items-center gap-0.5 text-white/30">
              <Clock className="h-3 w-3" />
              <span className="text-[10px]">
                {new Date(memory.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Full content — expandable */}
          <p className={`text-sm text-white/75 leading-relaxed whitespace-pre-wrap break-words ${!expanded && isLong ? 'line-clamp-3' : ''}`}>
            {memory.content}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-1.5 text-[11px] font-medium text-[#9945FF]/60 hover:text-[#9945FF] transition-colors"
            >
              {expanded ? '▲ mostrar menos' : '▼ ver texto completo'}
            </button>
          )}
        </div>

        {memory.verified && (
          <a href={`https://explorer.solana.com/tx/${memory.hash}`}
            target="_blank" rel="noopener noreferrer"
            className="mt-1 flex-shrink-0 rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/60">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Score bar */}
      {memory.score !== null && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/30">Relevância</span>
            <span className="text-[10px] font-medium text-white/50">{Math.round(memory.score)}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#9945FF] via-[#00D1FF] to-[#14F195] transition-all duration-500"
              style={{ width: `${memory.score}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContextVisualization({ memories }: ContextVisualizationProps) {
  if (!memories || memories.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
        <Brain className="mx-auto mb-3 h-8 w-8 text-white/20" />
        <p className="text-sm text-white/40">Nenhuma memória relevante encontrada</p>
      </div>
    );
  }

  const topMemories = memories.slice(0, 3);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Brain className="h-4 w-4 text-[#9945FF]" />
        <span className="text-xs font-medium uppercase tracking-wider text-white/50">Memórias Relevantes</span>
        <span className="rounded-full bg-[#9945FF]/20 px-2 py-0.5 text-[10px] font-semibold text-[#9945FF]">
          {topMemories.length}
        </span>
      </div>
      <div className="space-y-2">
        {topMemories.map(memory => (
          <MemoryCard key={memory.hash} memory={memory} />
        ))}
      </div>
    </div>
  );
}
