import { CheckCircle2, Circle, Loader2, Rocket } from 'lucide-react';
import type { ForgeBuildStep, ForgePhase } from '@/lib/forge/types';
import { cn } from '@/lib/utils';

export function BuildStatus({
  steps,
  phase,
  deployStatus,
}: {
  steps: ForgeBuildStep[];
  phase: ForgePhase;
  deployStatus: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Rocket className="size-4 text-[#14F195]" />
          <h3 className="text-sm font-semibold text-white/80">Build Status</h3>
        </div>
        <span className="truncate rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[11px] text-white/40">
          {deployStatus}
        </span>
      </div>

      <div className="space-y-2">
        {steps.map(step => {
          const Icon = step.status === 'complete' ? CheckCircle2 : step.status === 'running' ? Loader2 : Circle;
          return (
            <div key={step.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
              <Icon className={cn('size-4 shrink-0', step.status === 'complete' && 'text-[#14F195]', step.status === 'running' && 'animate-spin text-[#38BDF8]', step.status === 'pending' && 'text-white/20')} />
              <span className="min-w-0 flex-1 truncate text-xs text-white/55">{step.label}</span>
              <span className="text-[10px] uppercase tracking-wider text-white/25">{step.status}</span>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[#14F195]/15 bg-[#14F195]/[0.045] p-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#14F195]/55">Runtime Boundary</p>
        <p className="mt-2 text-xs leading-5 text-white/45">
          Forge MVP is a safe simulation. No shell commands, deployments, current APIs, Memory Brain, or Solana integrations are modified.
        </p>
      </div>
    </div>
  );
}
