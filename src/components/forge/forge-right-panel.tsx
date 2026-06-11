'use client';

import { memo, useMemo } from 'react';
import { CheckCircle2, Files, GitCompareArrows, MonitorPlay, PanelsTopLeft } from 'lucide-react';
import type { ForgeFile, ForgePanelTab, ForgePhase, ForgeRunStatus, ForgeSandboxSession } from '@/lib/forge/types';
import { RUN_STATUS_LABELS } from '@/lib/forge/forge-ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GlassPanel } from './glass-panel';
import { ForgePreview } from './forge-preview';
import { CodeViewer } from './code-viewer';
import { cn } from '@/lib/utils';

const TAB_CONFIG = [
  ['preview', MonitorPlay],
  ['code', PanelsTopLeft],
  ['files', Files],
  ['diff', GitCompareArrows],
] as const;

function ForgeRightPanelComponent({
  phase,
  runStatus,
  files,
  selectedFile,
  deployStatus,
  tab,
  onTabChange,
  onSelectFile,
  onFileSaved,
  onPrivatePayDemo,
  onReplayLast,
  onApplyProposal,
  canReplay,
  busy,
  latestSandboxSession,
}: {
  phase: ForgePhase;
  runStatus: ForgeRunStatus;
  files: ForgeFile[];
  selectedFile: string;
  deployStatus?: string;
  tab: ForgePanelTab;
  onTabChange: (tab: ForgePanelTab) => void;
  onSelectFile: (path: string) => void;
  onFileSaved: (path: string, contents: string) => void;
  onPrivatePayDemo: () => void;
  onReplayLast: () => void;
  onApplyProposal: () => void;
  canReplay: boolean;
  busy: boolean;
  latestSandboxSession?: ForgeSandboxSession;
}) {
  const statusLine = useMemo(() => {
    const deploy = deployStatus ?? '—';
    return `${RUN_STATUS_LABELS[runStatus]} · ${deploy}`;
  }, [runStatus, deployStatus]);
  const selected = useMemo(
    () => files.find(file => file.path === selectedFile) ?? files[0],
    [files, selectedFile],
  );
  const diffPreview = useMemo(() => {
    if (!selected) return 'No file proposal selected.';
    const lines = selected.contents.split('\n').slice(0, 90);
    return [
      `+++ ${selected.path}`,
      `status: ${selected.status} · language: ${selected.language}`,
      '',
      ...lines.map(line => `+ ${line}`),
    ].join('\n');
  }, [selected]);
  const canApplyProposal = files.some(file => file.status === 'created' || file.status === 'modified') && !busy;

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-[#111113]/40">
      <GlassPanel className="min-h-0 flex-1 rounded-none border-0 bg-transparent p-0 shadow-none">
        <Tabs value={tab} onValueChange={value => onTabChange(value as ForgePanelTab)} className="flex h-full min-h-0 flex-col gap-0">
          <div className="flex min-h-10 flex-col gap-1.5 border-b border-white/[0.07] px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-3">
            <TabsList className="h-7 w-full shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.03] p-0.5 sm:w-auto">
              {TAB_CONFIG.map(([value, Icon]) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="h-6 min-w-0 flex-1 rounded-md px-1.5 text-[10px] text-white/38 data-[state=active]:bg-white/[0.08] data-[state=active]:text-white/78 sm:flex-initial sm:px-2 sm:text-[11px]"
                >
                  <Icon className="size-3 shrink-0" />
                  <span className="hidden sm:inline">{value}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <p
              className="truncate text-[10px] text-white/38 sm:max-w-[45%] sm:text-[11px] lg:max-w-[55%]"
              title={statusLine}
              role="status"
              aria-live="polite"
            >
              {statusLine}
            </p>
          </div>

          <TabsContent value="preview" forceMount className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
            <ForgePreview
              phase={phase}
              runStatus={runStatus}
              busy={busy}
              canReplay={canReplay}
              onPrivatePayDemo={onPrivatePayDemo}
              onReplayLast={onReplayLast}
            />
          </TabsContent>
          <TabsContent value="code" className="min-h-0">
            {/* FORGE_UPGRADE: Code tab now hosts an editable CodeMirror-backed editor. */}
            <CodeViewer files={files} selectedFile={selectedFile} onSelectFile={onSelectFile} onFileSaved={onFileSaved} />
          </TabsContent>
          <TabsContent value="files" className="min-h-0 p-3">
            <div className="space-y-2">
              {files.map(file => (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => onSelectFile(file.path)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]',
                    file.path === selectedFile && 'border-[#9945FF]/25 bg-[#9945FF]/10',
                  )}
                >
                  <span className="min-w-0 truncate font-mono text-xs text-white/65">{file.path}</span>
                  <span className="rounded-full border border-white/[0.07] px-2 py-0.5 text-[10px] text-white/35">{file.status}</span>
                </button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="diff" className="min-h-0 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white/72">Sandbox proposal</p>
                <p className="truncate text-[11px] text-white/35">
                  {latestSandboxSession ? `Applied ${latestSandboxSession.hash}` : 'Review generated files before applying.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onApplyProposal}
                disabled={!canApplyProposal}
                className="flex min-h-8 items-center gap-1.5 rounded-lg border border-[#14F195]/25 bg-[#14F195]/10 px-3 py-1.5 text-[11px] font-semibold text-[#14F195] transition-colors hover:bg-[#14F195]/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCircle2 className="size-3.5" />
                Apply Proposal
              </button>
            </div>
            <pre className="h-[min(380px,42vh)] overflow-auto rounded-2xl border border-white/[0.07] bg-black/25 p-4 text-[12px] leading-6 text-white/55">
{`${diffPreview}

Sandbox only - this proposal is not written to the production project.`}
            </pre>
          </TabsContent>
        </Tabs>
      </GlassPanel>
    </aside>
  );
}

export const ForgeRightPanel = memo(ForgeRightPanelComponent);
