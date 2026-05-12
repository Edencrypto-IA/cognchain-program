'use client';

import { motion } from 'framer-motion';
import { ExternalLink, Sparkles } from 'lucide-react';
import type { ForgePhase } from '@/lib/forge/types';

export function ForgePreview({ phase }: { phase: ForgePhase }) {
  const active = ['building', 'deploying', 'complete'].includes(phase);

  return (
    <div className="h-full min-h-[430px] overflow-hidden bg-[#050505]">
      <div className="flex items-center gap-1.5 border-b border-white/[0.07] px-3 py-2">
        <span className="size-2.5 rounded-full bg-red-400/70" />
        <span className="size-2.5 rounded-full bg-yellow-400/70" />
        <span className="size-2.5 rounded-full bg-[#14F195]/70" />
        <span className="ml-2 truncate rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1 text-[11px] text-white/35">
          forge-preview.local
        </span>
      </div>

      <div className="relative h-[calc(100%-40px)] overflow-hidden p-5">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#9945FF]/15 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-44 w-44 rounded-full bg-[#14F195]/10 blur-3xl" />

        <motion.div
          className="relative h-full rounded-3xl border border-white/[0.08] bg-white/[0.045] p-6"
          animate={{ y: active ? [0, -4, 0] : 0 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#14F195]/75">Generated Surface</p>
              <h3 className="mt-3 max-w-sm text-3xl font-semibold leading-tight text-white">
                Verifiable AI software is being assembled.
              </h3>
            </div>
            <button className="rounded-full border border-white/[0.08] bg-white/[0.04] p-2 text-white/40">
              <ExternalLink className="size-4" />
            </button>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ['Agent mesh', active ? 'live' : 'idle'],
              ['Memory proof', phase === 'complete' ? 'ready' : 'staging'],
              ['Deploy', phase === 'complete' ? 'capsule' : 'simulated'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/[0.07] bg-black/25 p-4">
                <p className="text-[10px] uppercase tracking-wider text-white/25">{label}</p>
                <p className="mt-2 text-sm font-semibold text-white/75">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-[#9945FF]/15 bg-[#9945FF]/[0.05] p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#C084FC]" />
              <p className="text-sm font-semibold text-white/80">Live build narrative</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-white/48">
              Forge Phase 1 simulates a full agentic build without touching production systems. Future phases can connect real streaming, file writes, and deployment adapters.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
