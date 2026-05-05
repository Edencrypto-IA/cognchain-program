'use client';
import type { FactSource } from '@/lib/grounding/types';

interface SourceBadgeProps {
  id: string;
  sources: FactSource[];
}

export default function SourceBadge({ id, sources }: SourceBadgeProps) {
  const source = sources.find(s => s.id === id);
  if (!source) return null;

  const isLowCred = source.credibilityScore < 50;
  const color = isLowCred ? 'text-[#f59e0b] border-[#f59e0b]/20 bg-[#f59e0b]/10'
                           : 'text-[#00a8e8] border-[#00a8e8]/20 bg-[#00a8e8]/10';
  const ago = Math.round((Date.now() - new Date(source.fetchedAt).getTime()) / 60000);

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${source.name} · ${source.credibilityScore}/100 · ${ago}min atrás\n${source.url}`}
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all
        hover:opacity-80 hover:scale-105 ${color}`}
    >
      {id}
    </a>
  );
}
