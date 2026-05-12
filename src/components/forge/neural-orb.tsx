'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function NeuralOrb({ active = false, className }: { active?: boolean; className?: string }) {
  return (
    <div className={cn('relative grid size-12 place-items-center', className)}>
      <motion.div
        className="absolute inset-0 rounded-full bg-[#9945FF]/20 blur-xl"
        animate={{ scale: active ? [1, 1.2, 1] : [1, 1.06, 1], opacity: active ? [0.4, 0.8, 0.4] : [0.25, 0.45, 0.25] }}
        transition={{ duration: active ? 1.8 : 3.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute size-10 rounded-full border border-[#14F195]/25"
        animate={{ rotate: 360 }}
        transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="size-6 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffffff,#14F195_28%,#9945FF_75%)] shadow-[0_0_32px_rgba(20,241,149,0.45)]"
        animate={{ scale: active ? [1, 1.12, 1] : [1, 1.04, 1] }}
        transition={{ duration: active ? 1.2 : 2.6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className="absolute right-1 top-2 size-1.5 rounded-full bg-[#38BDF8] shadow-[0_0_12px_rgba(56,189,248,0.8)]" />
      <span className="absolute bottom-2 left-2 size-1 rounded-full bg-[#14F195] shadow-[0_0_10px_rgba(20,241,149,0.8)]" />
    </div>
  );
}
