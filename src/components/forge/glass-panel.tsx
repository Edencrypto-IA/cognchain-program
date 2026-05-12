import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function GlassPanel({
  children,
  className,
  compact = false,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-2xl shadow-black/30 backdrop-blur-2xl',
        compact ? 'p-3' : 'p-4',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {children}
    </section>
  );
}
