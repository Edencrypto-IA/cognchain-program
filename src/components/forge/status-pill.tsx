import { Check, CircleDashed, Loader2, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusStyles = {
  idle: 'border-white/[0.08] bg-white/[0.04] text-white/45',
  thinking: 'border-[#9945FF]/25 bg-[#9945FF]/10 text-[#C084FC]',
  running: 'border-[#38BDF8]/25 bg-[#38BDF8]/10 text-[#7DD3FC]',
  complete: 'border-[#14F195]/25 bg-[#14F195]/10 text-[#14F195]',
  blocked: 'border-[#F59E0B]/25 bg-[#F59E0B]/10 text-[#FBBF24]',
  error: 'border-red-400/25 bg-red-400/10 text-red-300',
};

export function StatusPill({
  status,
  label,
  className,
}: {
  status: keyof typeof statusStyles;
  label?: string;
  className?: string;
}) {
  const Icon = status === 'complete' ? Check : status === 'error' || status === 'blocked' ? TriangleAlert : status === 'running' || status === 'thinking' ? Loader2 : CircleDashed;

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium', statusStyles[status], className)}>
      <Icon className={cn('size-3', (status === 'running' || status === 'thinking') && 'animate-spin')} />
      {label ?? status}
    </span>
  );
}
