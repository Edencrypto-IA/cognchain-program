'use client';

import { motion } from 'framer-motion';
import { BrainCircuit } from 'lucide-react';
import type { ForgeMemoryNode } from '@/lib/forge/types';

export function MemoryMap({ nodes }: { nodes: ForgeMemoryNode[] }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <BrainCircuit className="size-4 text-[#C084FC]" />
        <h3 className="text-sm font-semibold text-white/80">Agent Memory</h3>
      </div>
      <div className="relative space-y-2">
        <div className="absolute bottom-4 left-4 top-4 w-px bg-gradient-to-b from-[#9945FF]/0 via-[#9945FF]/40 to-[#14F195]/0" />
        {nodes.map((node, index) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="relative rounded-xl border border-white/[0.06] bg-black/20 p-3 pl-9"
          >
            <span className="absolute left-[11px] top-4 size-3 rounded-full border border-[#14F195]/40 bg-[#050505] shadow-[0_0_16px_rgba(20,241,149,0.25)]" />
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-xs font-semibold text-white/70">{node.label}</p>
              <span className="font-mono text-[10px] text-[#14F195]/60">{node.confidence}%</span>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-white/35">{node.detail}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
