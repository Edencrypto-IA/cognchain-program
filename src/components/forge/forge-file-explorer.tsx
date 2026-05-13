'use client';

import { CheckCircle2, Circle, FileCode2, Folder, Loader2 } from 'lucide-react';
import type { ForgeAgent, ForgeBuildStep, ForgeFile } from '@/lib/forge/types';
import { cn } from '@/lib/utils';

export function ForgeFileExplorer({
  files,
  selectedFile,
  buildSteps,
  agents,
  onSelectFile,
}: {
  files: ForgeFile[];
  selectedFile: string;
  buildSteps: ForgeBuildStep[];
  agents: ForgeAgent[];
  onSelectFile: (path: string) => void;
}) {
  const activeAgents = agents.filter(agent => agent.status === 'running' || agent.status === 'thinking');

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-white/[0.07] bg-[#0a0a0c]/70">
      <div className="flex h-10 items-center gap-2 border-b border-white/[0.07] px-3">
        <Folder className="size-3.5 text-white/35" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/32">Explorer</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Generated</p>
        <div className="space-y-0.5">
          {files.map(file => (
            <button
              key={file.path}
              onClick={() => onSelectFile(file.path)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-white/46 transition-colors hover:bg-white/[0.045] hover:text-white/80',
                file.path === selectedFile && 'bg-white/[0.06] text-white/85',
              )}
            >
              <FileCode2 className="size-3.5 shrink-0 text-[#14F195]/55" />
              <span className="min-w-0 flex-1 truncate font-mono">{file.path}</span>
            </button>
          ))}
        </div>

        <p className="mt-5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Tasks</p>
        <div className="space-y-0.5">
          {buildSteps.map(step => {
            const Icon = step.status === 'complete' ? CheckCircle2 : step.status === 'running' ? Loader2 : Circle;
            return (
              <div key={step.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-white/42">
                <Icon className={cn('size-3.5 shrink-0', step.status === 'complete' && 'text-[#14F195]', step.status === 'running' && 'animate-spin text-[#38BDF8]', step.status === 'pending' && 'text-white/18')} />
                <span className="min-w-0 flex-1 truncate">{step.label}</span>
              </div>
            );
          })}
        </div>

        <p className="mt-5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Agents</p>
        <div className="space-y-0.5">
          {(activeAgents.length ? activeAgents : agents).slice(0, 5).map(agent => (
            <div key={agent.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-white/42">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: agent.accent, opacity: agent.status === 'idle' ? 0.35 : 1 }} />
              <span className="min-w-0 flex-1 truncate">{agent.name}</span>
              <span className="font-mono text-[10px] text-white/24">{Math.round(agent.progress)}%</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
