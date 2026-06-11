'use client';

import { memo, useMemo, useState } from 'react';
import { CheckCircle2, Files, GitCompareArrows, MonitorPlay, PanelsTopLeft, XCircle } from 'lucide-react';
import type { ForgeDiffProposal, ForgeFile, ForgePanelTab, ForgePhase, ForgeRunStatus, ForgeSandboxSession } from '@/lib/forge/types';
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
  diffProposal,
  onDiffAccepted,
  onDiffRejected,
  onRunSafeCommand,
  onInlineDiff,
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
  diffProposal?: ForgeDiffProposal | null;
  onDiffAccepted: (path: string, contents: string) => void;
  onDiffRejected: () => void;
  onRunSafeCommand: (command: 'npm run lint' | 'npm run build') => void;
  onInlineDiff: (proposal: ForgeDiffProposal) => void;
}) {
  const [applyingDiff, setApplyingDiff] = useState(false);
  const [diffError, setDiffError] = useState('');
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
  const diffLines = useMemo(() => {
    const source = diffProposal?.diff || diffPreview;
    return source.split('\n').slice(0, 600).map((line, index) => {
      const variant = line.startsWith('+') && !line.startsWith('+++')
        ? 'add'
        : line.startsWith('-') && !line.startsWith('---')
          ? 'remove'
          : line.startsWith('@@')
            ? 'hunk'
            : 'context';
      return { id: `${index}-${line.slice(0, 12)}`, line, variant };
    });
  }, [diffPreview, diffProposal]);
  const diffStats = useMemo(() => {
    const lines = (diffProposal?.diff || '').split('\n');
    return {
      added: lines.filter(line => line.startsWith('+') && !line.startsWith('+++')).length,
      removed: lines.filter(line => line.startsWith('-') && !line.startsWith('---')).length,
      hunks: lines.filter(line => line.startsWith('@@')).length,
    };
  }, [diffProposal]);

  const acceptDiff = async () => {
    if (!diffProposal || applyingDiff) return;
    setApplyingDiff(true);
    setDiffError('');
    try {
      const response = await fetch('/api/forge/file/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          path: diffProposal.path,
          diff: diffProposal.diff,
          originalCode: diffProposal.originalCode,
          proposedCode: diffProposal.proposedCode,
        }),
      });
      const data = await response.json() as { content?: unknown; error?: unknown };
      if (!response.ok || typeof data.content !== 'string') {
        throw new Error(typeof data.error === 'string' ? data.error : 'Diff apply failed');
      }
      onDiffAccepted(diffProposal.path, data.content);
      onDiffRejected();
      onTabChange('code');
    } catch (error) {
      setDiffError(error instanceof Error ? error.message : 'Diff apply failed');
    } finally {
      setApplyingDiff(false);
    }
  };

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
            <div className="hidden items-center gap-1 sm:flex">
              <button
                type="button"
                onClick={() => onRunSafeCommand('npm run lint')}
                className="rounded-md border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[10px] text-white/38 hover:border-[#14F195]/25 hover:text-[#14F195]"
              >
                lint
              </button>
              <button
                type="button"
                onClick={() => onRunSafeCommand('npm run build')}
                className="rounded-md border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[10px] text-white/38 hover:border-[#00D4FF]/25 hover:text-[#00D4FF]"
              >
                build
              </button>
            </div>
          </div>

          <TabsContent value="preview" forceMount className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
            <ForgePreview
              phase={phase}
              runStatus={runStatus}
              files={files}
              selectedFile={selectedFile}
              busy={busy}
              canReplay={canReplay}
              onPrivatePayDemo={onPrivatePayDemo}
              onReplayLast={onReplayLast}
            />
          </TabsContent>
          <TabsContent value="code" className="min-h-0">
            {/* FORGE_UPGRADE: Code tab now hosts an editable CodeMirror-backed editor. */}
            <CodeViewer files={files} selectedFile={selectedFile} onSelectFile={onSelectFile} onFileSaved={onFileSaved} onInlineDiff={onInlineDiff} />
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
                <p className="text-xs font-semibold text-white/72">
                  {diffProposal ? `Inline diff · ${diffProposal.path}` : 'Sandbox proposal'}
                </p>
                <p className="truncate text-[11px] text-white/35">
                  {diffProposal
                    ? 'Review changes. Nothing is written until you click Accept.'
                    : latestSandboxSession ? `Applied ${latestSandboxSession.hash}` : 'Review generated files before applying.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {diffProposal ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onDiffRejected();
                        setDiffError('');
                      }}
                      className="flex min-h-8 items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-300 transition-colors hover:bg-red-500/15"
                    >
                      <XCircle className="size-3.5" />
                      Rejeitar
                    </button>
                    <button
                      type="button"
                      onClick={() => void acceptDiff()}
                      disabled={applyingDiff}
                      className="flex min-h-8 items-center gap-1.5 rounded-lg border border-[#14F195]/25 bg-[#14F195]/10 px-3 py-1.5 text-[11px] font-semibold text-[#14F195] transition-colors hover:bg-[#14F195]/15 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <CheckCircle2 className="size-3.5" />
                      {applyingDiff ? 'Aplicando...' : 'Aceitar'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={onApplyProposal}
                    disabled={!canApplyProposal}
                    className="flex min-h-8 items-center gap-1.5 rounded-lg border border-[#14F195]/25 bg-[#14F195]/10 px-3 py-1.5 text-[11px] font-semibold text-[#14F195] transition-colors hover:bg-[#14F195]/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CheckCircle2 className="size-3.5" />
                    Apply Proposal
                  </button>
                )}
              </div>
            </div>
            {diffError ? (
              <div className="mb-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">{diffError}</div>
            ) : null}
            {diffProposal ? (
              <div className="mb-3 grid grid-cols-3 gap-2">
                {[
                  ['adições', diffStats.added, 'text-[#14F195]'],
                  ['remoções', diffStats.removed, 'text-red-300'],
                  ['blocos', diffStats.hunks, 'text-[#00D4FF]'],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/25">{label}</p>
                    <p className={cn('mt-1 text-lg font-bold', color as string)}>{value}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {/* FORGE_UPGRADE: render inline diffs manually so the review gate works without extra dependencies. */}
            <div className="h-[min(380px,42vh)] overflow-auto rounded-2xl border border-white/[0.07] bg-black/25 p-4 font-mono text-[12px] leading-6">
              {diffLines.map(item => (
                <div
                  key={item.id}
                  className={cn(
                    'whitespace-pre-wrap border-l-2 px-2',
                    item.variant === 'add' && 'border-[#14F195]/45 bg-[#14F195]/10 text-[#B8FFD9]',
                    item.variant === 'remove' && 'border-red-400/45 bg-red-500/10 text-red-200',
                    item.variant === 'hunk' && 'border-[#00D4FF]/45 bg-[#00D4FF]/10 text-[#A7F3FF]',
                    item.variant === 'context' && 'border-transparent text-white/50',
                  )}
                >
                  {item.line || ' '}
                </div>
              ))}
              {!diffProposal ? (
                <div className="mt-4 border-l-2 border-transparent px-2 text-white/35">
                  Sandbox only - this proposal is not written to the production project.
                </div>
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </GlassPanel>
    </aside>
  );
}

export const ForgeRightPanel = memo(ForgeRightPanelComponent);
