'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Circle, FileCode2, Folder, Loader2, ShieldCheck } from 'lucide-react';
import type { ForgeBuildStep, ForgeFile, ForgeSandboxSession } from '@/lib/forge/types';
import { cn } from '@/lib/utils';

const EXPLORER_COLLAPSE_KEY = 'forge:explorer:collapsed:v1';

type ExplorerSection = {
  id: string;
  label: string;
  prefix: string;
};

const EXPLORER_SECTIONS: ExplorerSection[] = [
  { id: 'app', label: '📄 App', prefix: 'src/app/' },
  { id: 'components', label: '🧩 Components', prefix: 'src/components/' },
  { id: 'lib', label: '📦 Lib', prefix: 'src/lib/' },
  { id: 'hooks', label: '🪝 Hooks', prefix: 'src/hooks/' },
  { id: 'solana', label: '⬡ Solana', prefix: 'src/solana/' },
  { id: 'core', label: 'Core', prefix: 'src/' },
];

function shortFileName(filePath: string): string {
  return filePath.split('/').at(-1) ?? filePath;
}

function ForgeFileExplorerComponent({
  files,
  selectedFile,
  buildSteps,
  sandboxSessions,
  busy,
  onSelectFile,
}: {
  files: ForgeFile[];
  selectedFile: string;
  buildSteps: ForgeBuildStep[];
  sandboxSessions: ForgeSandboxSession[];
  busy: boolean;
  onSelectFile: (path: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(EXPLORER_COLLAPSE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      setCollapsed(parsed);
    } catch {
      setCollapsed({});
    }
  }, []);

  const sections = useMemo(() => {
    const used = new Set<string>();
    return EXPLORER_SECTIONS.map(section => {
      const sectionFiles = files
        .filter(file => {
          if (used.has(file.path)) return false;
          if (section.id === 'core') {
            return ['src/skills/', 'src/store/', 'src/trigger/', 'src/security/'].some(prefix => file.path.startsWith(prefix));
          }
          return file.path.startsWith(section.prefix);
        })
        .sort((a, b) => a.path.localeCompare(b.path));
      sectionFiles.forEach(file => used.add(file.path));
      return { ...section, files: sectionFiles };
    }).filter(section => section.files.length > 0);
  }, [files]);

  const toggleSection = (sectionId: string) => {
    setCollapsed(current => {
      const next = { ...current, [sectionId]: !current[sectionId] };
      try {
        window.localStorage.setItem(EXPLORER_COLLAPSE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-white/[0.07] bg-[#0a0a0c]/82">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/[0.07] px-3">
        <Folder className="size-3.5 text-white/35" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">Explorer</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">CONGCHAIN-FORGE</p>
        <div className="space-y-1">
          {sections.map(section => {
            const isCollapsed = collapsed[section.id] ?? false;
            return (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-white/36 transition-colors hover:bg-white/[0.035] hover:text-white/62"
                >
                  {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  <span className="min-w-0 flex-1 truncate">{section.label}</span>
                  <span className="font-mono text-[9px] text-white/22">{section.files.length}</span>
                </button>
                {!isCollapsed ? (
                  <div className="space-y-0.5">
                    {section.files.map(file => (
                      <button
                        key={file.path}
                        type="button"
                        title={file.path}
                        onClick={() => onSelectFile(file.path)}
                        disabled={busy}
                        className={cn(
                          'flex w-full min-h-8 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-white/46 transition-colors hover:bg-white/[0.045] hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-50',
                          file.path === selectedFile && 'bg-white/[0.06] text-white/85',
                        )}
                      >
                        <FileCode2 className="size-3.5 shrink-0 text-[#14F195]/55" />
                        <span className="min-w-0 flex-1 truncate font-mono">{shortFileName(file.path)}</span>
                        <span className="hidden rounded border border-white/[0.06] px-1.5 py-0.5 text-[9px] uppercase text-white/22 xl:inline">
                          {file.status}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {sandboxSessions.length > 0 && (
          <>
            <p className="mt-5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Sandbox Sessions</p>
            <div className="space-y-1">
              {sandboxSessions.slice(0, 4).map(session => (
                <div key={session.id} className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2 py-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-3.5 shrink-0 text-[#C084FC]/75" />
                    <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-white/55">{session.title}</p>
                  </div>
                  <p className="mt-1 truncate pl-5 font-mono text-[10px] text-[#14F195]/60">{session.hash}</p>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="mt-5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Tasks</p>
        <div className="space-y-0.5">
          {buildSteps.map(step => {
            const Icon = step.status === 'complete' ? CheckCircle2 : step.status === 'running' ? Loader2 : Circle;
            return (
              <div key={step.id} className="rounded-lg px-2 py-1.5 text-[11px] text-white/42">
                <div className="flex items-center gap-2">
                  <Icon className={cn('size-3.5 shrink-0', step.status === 'complete' && 'text-[#14F195]', step.status === 'running' && 'animate-spin text-[#38BDF8]', step.status === 'pending' && 'text-white/18')} />
                  <span className="min-w-0 flex-1 truncate">{step.label}</span>
                </div>
                <p className="mt-1 line-clamp-2 pl-5 text-[10px] leading-4 text-white/26">{step.result || step.detail}</p>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

export const ForgeFileExplorer = memo(ForgeFileExplorerComponent);
