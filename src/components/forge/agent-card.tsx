'use client';

import { motion } from 'framer-motion';
import { Cpu, Radio } from 'lucide-react';
import type { ForgeAgent } from '@/lib/forge/types';
import { cn } from '@/lib/utils';
import { StatusPill } from './status-pill';

export function AgentCard({ agent, dense = false }: { agent: ForgeAgent; dense?: boolean }) {
  const isActive = agent.status === 'running' || agent.status === 'thinking';

  return (
    <motion.article
      layout
      className={cn(
        'rounded-2xl border border-white/[0.07] bg-black/25 p-3 transition-colors',
        isActive && 'border-white/[0.12] bg-white/[0.045]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
            <Cpu className="size-4" style={{ color: agent.accent }} />
            {isActive && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full" style={{ background: agent.accent, boxShadow: `0 0 12px ${agent.accent}` }} />}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white/85">{agent.name}</h3>
            <p className="truncate text-[11px] text-white/35">{agent.role}</p>
          </div>
        </div>
        {!dense && <StatusPill status={agent.status === 'blocked' ? 'blocked' : agent.status} />}
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="truncate text-[11px] text-white/45">{agent.currentTask}</p>
          <span className="font-mono text-[10px] text-white/30">{Math.round(agent.progress)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${agent.accent}, #14F195)` }}
            animate={{ width: `${agent.progress}%` }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        </div>
      </div>

      {!dense && (
        <div className="mt-3 space-y-1.5">
          {agent.logs.slice(0, 2).map(log => (
            <div key={log} className="flex items-center gap-2 text-[11px] text-white/35">
              <Radio className="size-3 shrink-0" style={{ color: agent.accent }} />
              <span className="truncate">{log}</span>
            </div>
          ))}
        </div>
      )}
    </motion.article>
  );
}
