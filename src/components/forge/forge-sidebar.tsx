'use client';

import { Clock3, FolderKanban, History, Server, ShieldCheck } from 'lucide-react';
import type { ForgeAgent, ForgePhase, ForgeTerminalLine } from '@/lib/forge/types';
import { suggestedPrompts } from '@/lib/forge/demo-data';
import { GlassPanel } from './glass-panel';
import { NeuralOrb } from './neural-orb';
import { AgentCard } from './agent-card';
import { StatusPill } from './status-pill';

export function ForgeSidebar({
  agents,
  phase,
  deployStatus,
  promptHistory,
  terminal,
  onPromptSelect,
}: {
  agents: ForgeAgent[];
  phase: ForgePhase;
  deployStatus: string;
  promptHistory: string[];
  terminal: ForgeTerminalLine[];
  onPromptSelect: (prompt: string) => void;
}) {
  const history = promptHistory.length > 0 ? promptHistory : suggestedPrompts;

  return (
    <aside className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <GlassPanel className="shrink-0">
        <div className="flex items-center gap-3">
          <NeuralOrb active={phase !== 'idle'} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#14F195]/70">CongChain</p>
            <h1 className="truncate text-xl font-semibold tracking-tight text-white">Forge</h1>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/25">Session</p>
            <StatusPill status={phase === 'complete' ? 'complete' : phase === 'idle' ? 'idle' : 'running'} label={phase} className="mt-2" />
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/25">Deploy</p>
            <p className="mt-2 truncate text-xs font-medium text-[#14F195]/75">{deployStatus}</p>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="shrink-0">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="size-4 text-[#14F195]" />
          <h2 className="text-sm font-semibold text-white/80">Active Agents</h2>
        </div>
        <div className="space-y-2">
          {agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
        </div>
      </GlassPanel>

      <GlassPanel className="shrink-0">
        <div className="mb-3 flex items-center gap-2">
          <FolderKanban className="size-4 text-[#C084FC]" />
          <h2 className="text-sm font-semibold text-white/80">Projects</h2>
        </div>
        <div className="space-y-2 text-sm">
          {['Memory OS', 'Solana Proof App', 'Agent Console'].map((project, index) => (
            <button key={project} className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-left text-white/55 transition-colors hover:bg-white/[0.05]">
              <span className="truncate">{project}</span>
              <span className="text-[10px] text-white/25">0{index + 1}</span>
            </button>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel className="shrink-0">
        <div className="mb-3 flex items-center gap-2">
          <History className="size-4 text-[#38BDF8]" />
          <h2 className="text-sm font-semibold text-white/80">Prompt History</h2>
        </div>
        <div className="space-y-2">
          {history.map(prompt => (
            <button key={prompt} onClick={() => onPromptSelect(prompt)} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-left text-xs leading-relaxed text-white/45 transition-colors hover:border-[#9945FF]/25 hover:text-white/75">
              {prompt}
            </button>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel className="shrink-0">
        <div className="mb-3 flex items-center gap-2">
          <Server className="size-4 text-[#14F195]" />
          <h2 className="text-sm font-semibold text-white/80">Build History</h2>
        </div>
        <div className="space-y-2">
          {terminal.slice(-4).reverse().map(line => (
            <div key={line.id} className="flex gap-2 rounded-xl bg-white/[0.025] px-3 py-2">
              <Clock3 className="mt-0.5 size-3 shrink-0 text-white/25" />
              <p className="min-w-0 truncate text-[11px] text-white/40">{line.text}</p>
            </div>
          ))}
        </div>
      </GlassPanel>
    </aside>
  );
}
