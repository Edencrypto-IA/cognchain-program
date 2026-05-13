'use client';

import { memo, useMemo } from 'react';
import { Clock3, History, Plus, Search, ShieldCheck } from 'lucide-react';
import type { ForgeAgent, ForgePhase, ForgeRunStatus, ForgeTerminalLine } from '@/lib/forge/types';
import { suggestedPrompts } from '@/lib/forge/demo-data';
import { RUN_STATUS_LABELS } from '@/lib/forge/forge-ui';
import { NeuralOrb } from './neural-orb';
import { StatusPill } from './status-pill';

function ForgeSidebarComponent({
  agents,
  phase,
  runStatus,
  deployStatus,
  promptHistory,
  terminal,
  busy,
  onPromptSelect,
}: {
  agents: ForgeAgent[];
  phase: ForgePhase;
  runStatus: ForgeRunStatus;
  deployStatus: string;
  promptHistory: string[];
  terminal: ForgeTerminalLine[];
  busy: boolean;
  onPromptSelect: (prompt: string) => void;
}) {
  const history = useMemo(
    () => (promptHistory.length > 0 ? promptHistory : suggestedPrompts),
    [promptHistory],
  );

  const terminalPreview = useMemo(() => terminal.slice(-4).reverse(), [terminal]);

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-white/[0.07] bg-[#0a0a0c]/70 lg:border-r">
      <div className="border-b border-white/[0.07] p-3">
        <div className="mb-3 flex items-center gap-3">
          <NeuralOrb active={phase !== 'idle'} className="size-9" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight text-white/88">CongChain Forge</h1>
            <p className="text-[11px] text-white/30">AI IDE sandbox</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/22" />
          <input
            placeholder="Search agents..."
            className="h-8 w-full rounded-lg border border-white/[0.06] bg-white/[0.035] pl-8 pr-3 text-xs text-white/65 outline-none placeholder:text-white/22 focus:border-[#9945FF]/25"
            disabled={busy}
            aria-busy={busy}
          />
        </div>
        <button
          type="button"
          disabled={busy}
          className="mt-2 flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] text-xs text-white/70 transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          New Agent
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Agents</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill status={phase === 'complete' ? 'complete' : phase === 'idle' ? 'idle' : 'running'} label={phase} />
            <span className="rounded-md border border-white/[0.06] bg-black/30 px-2 py-0.5 text-[10px] text-white/45">
              {RUN_STATUS_LABELS[runStatus]}
            </span>
          </div>
        </div>
        <div className="space-y-1">
          {agents.map(agent => (
            <div key={agent.id} className="rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.035]">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: agent.accent, opacity: agent.status === 'idle' ? 0.45 : 1 }} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-white/62">{agent.name}</span>
                <span className="text-[10px] text-white/24">{agent.status}</span>
              </div>
              <p className="mt-1 truncate pl-4 text-[11px] text-white/30">{agent.currentTask}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 mb-2 flex items-center gap-2">
          <ShieldCheck className="size-4 text-[#14F195]" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Status</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2">
          <p className="text-[11px] text-white/32">Deploy</p>
          <p className="truncate text-xs font-medium text-[#14F195]/75">{deployStatus}</p>
        </div>

        <div className="mt-5 mb-2 flex items-center gap-2">
          <History className="size-4 text-[#38BDF8]" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Recent</p>
        </div>
        <div className="space-y-1">
          {history.map(prompt => (
            <button
              key={prompt}
              type="button"
              disabled={busy}
              onClick={() => onPromptSelect(prompt)}
              className="w-full truncate rounded-lg px-2 py-1.5 text-left text-xs text-white/42 transition-colors hover:bg-white/[0.035] hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="mt-5 mb-2 flex items-center gap-2">
          <Clock3 className="size-4 text-white/28" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Terminal</p>
        </div>
        <div className="space-y-1">
          {terminalPreview.map(line => (
            <div key={line.id} className="flex gap-2 rounded-lg px-2 py-1.5">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-white/18" />
              <p className="min-w-0 truncate text-[11px] text-white/32">{line.text}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export const ForgeSidebar = memo(ForgeSidebarComponent);
