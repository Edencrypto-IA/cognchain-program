'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Bot, Box, CheckCircle2, Clipboard, Command, Copy, FilePlus2, Play, RotateCcw, Search, ShieldCheck, Sparkles, Square } from 'lucide-react';
import Link from 'next/link';
import { useShallow } from 'zustand/react/shallow';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ForgeSidebar } from '@/components/forge/forge-sidebar';
import { ForgeTerminal } from '@/components/forge/forge-terminal';
import { ForgeRightPanel } from '@/components/forge/forge-right-panel';
import { ForgeFileExplorer } from '@/components/forge/forge-file-explorer';
import { NeuralOrb } from '@/components/forge/neural-orb';
import { useForgeSimulation } from '@/hooks/forge/use-forge-simulation';
import { useForgeStore } from '@/hooks/forge/use-forge-store';
import { RUN_STATUS_LABELS } from '@/lib/forge/forge-ui';
import { forgeId, nowLabel } from '@/lib/forge/simulation';

const busyPhases = ['thinking', 'planning', 'building', 'deploying'] as const;

function ForgeWorkspaceInner() {
  const { runPrompt, stop, runPrivatePayDemo, replayLastBuild } = useForgeSimulation();
  const [agentsOpen, setAgentsOpen] = useState(false);

  const {
    phase,
    runStatus,
    agents,
    terminal,
    streamedResponse,
    files,
    selectedFile: selectedFilePath,
    buildSteps,
    deployStatus,
    panelTab,
    promptHistory,
    sandboxSessions,
    activeSandboxSessionId,
    diffProposal,
    nexusPlan,
    setPanelTab,
    setSelectedFile,
    updateFileContents,
    hydrateFileContents,
    setFiles,
    setCommandRun,
    setDiffProposal,
    appendTerminal,
    applyProposal,
    resetSession,
  } = useForgeStore(
    useShallow(s => ({
      phase: s.phase,
      runStatus: s.runStatus,
      agents: s.agents,
      terminal: s.terminal,
      streamedResponse: s.streamedResponse,
      files: s.files,
      selectedFile: s.selectedFile,
      buildSteps: s.buildSteps,
      deployStatus: s.deployStatus,
      panelTab: s.panelTab,
      promptHistory: s.promptHistory,
      sandboxSessions: s.sandboxSessions,
      activeSandboxSessionId: s.activeSandboxSessionId,
      diffProposal: s.diffProposal,
      nexusPlan: s.nexusPlan,
      setPanelTab: s.setPanelTab,
      setSelectedFile: s.setSelectedFile,
      updateFileContents: s.updateFileContents,
      hydrateFileContents: s.hydrateFileContents,
      setFiles: s.setFiles,
      setCommandRun: s.setCommandRun,
      setDiffProposal: s.setDiffProposal,
      appendTerminal: s.appendTerminal,
      applyProposal: s.applyProposal,
      resetSession: s.resetSession,
    })),
  );

  const busy = busyPhases.includes(phase as (typeof busyPhases)[number]);
  const canReplay = promptHistory.length > 0 && !busy;
  const latestSandboxSession =
    sandboxSessions.find(session => session.id === activeSandboxSessionId) ?? sandboxSessions[0];
  const selectedFile = files.find(file => file.path === selectedFilePath) ?? files[0];
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  // FORGE_UPGRADE: Ctrl+P opens a safe fuzzy picker without changing explorer or terminal state.
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [filePickerQuery, setFilePickerQuery] = useState('');
  const [filePickerIndex, setFilePickerIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/forge/files', { credentials: 'include' })
      .then(response => response.json() as Promise<{ files?: Array<{ path: string; language?: string; size?: number }> }>)
      .then(data => {
        if (cancelled || !Array.isArray(data.files) || data.files.length === 0) return;
        setFiles(data.files.slice(0, 180).map(file => ({
          path: file.path,
          language: file.language ?? 'txt',
          status: 'queued',
          contents: '',
          real: true,
          size: file.size ?? 0,
        })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setFiles]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(value => !value);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setFilePickerOpen(true);
        setFilePickerQuery('');
        setFilePickerIndex(0);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const openFile = useCallback((path: string) => {
    setSelectedFile(path);
    const existing = useForgeStore.getState().files.find(file => file.path === path);
    if (existing?.contents) return;
    void fetch(`/api/forge/file?path=${encodeURIComponent(path)}`, { credentials: 'include' })
      .then(response => response.json() as Promise<{ content?: string }>)
      .then(data => {
        if (typeof data.content === 'string') hydrateFileContents(path, data.content);
      })
      .catch(() => {});
  }, [hydrateFileContents, setSelectedFile]);

  const runSafeCommand = useCallback((command: 'npm run lint' | 'npm run build') => {
    setCommandRun({ command, status: 'running', output: '', startedAt: new Date().toISOString() });
    appendTerminal({
      id: forgeId('line'),
      timestamp: nowLabel(),
      kind: 'shell',
      source: 'Forge Exec',
      text: `Running ${command} in safe allowlist mode...`,
    });
    void fetch('/api/forge/command/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ command }),
    })
      .then(response => response.json() as Promise<{ status?: 'complete' | 'error'; output?: string }>)
      .then(data => {
        const status = data.status === 'complete' ? 'complete' : 'error';
        setCommandRun({ command, status, output: data.output ?? '', finishedAt: new Date().toISOString() });
        appendTerminal({
          id: forgeId('line'),
          timestamp: nowLabel(),
          kind: status === 'complete' ? 'success' : 'error',
          source: 'Forge Exec',
          text: `${command} ${status === 'complete' ? 'passed' : 'failed'}.\n${(data.output ?? '').slice(0, 900)}`,
        });
      })
      .catch(error => {
        setCommandRun({ command, status: 'error', output: error instanceof Error ? error.message : 'Command failed', finishedAt: new Date().toISOString() });
      });
  }, [appendTerminal, setCommandRun]);

  const saveForgeMemory = useCallback(async () => {
    const content = [
      `Forge session: ${promptHistory[0] ?? 'manual session'}`,
      `Selected file: ${selectedFile?.path ?? 'none'}`,
      `Status: ${deployStatus}`,
      `Files loaded: ${files.length}`,
    ].join('\n');
    appendTerminal({
      id: forgeId('line'),
      timestamp: nowLabel(),
      kind: 'shell',
      source: 'Memory Core',
      text: 'Saving Forge decision to CognChain memory layer...',
    });
    try {
      const response = await fetch('/api/save-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content, source: 'forge' }),
      });
      const data = await response.json() as { hash?: string };
      appendTerminal({
        id: forgeId('line'),
        timestamp: nowLabel(),
        kind: response.ok ? 'success' : 'warning',
        source: 'Memory Core',
        text: response.ok ? `Forge memory saved${data.hash ? `: ${data.hash}` : '.'}` : 'Memory save endpoint returned a warning.',
      });
    } catch {
      appendTerminal({
        id: forgeId('line'),
        timestamp: nowLabel(),
        kind: 'warning',
        source: 'Memory Core',
        text: 'Memory save unavailable; session remains local.',
      });
    }
  }, [appendTerminal, deployStatus, files.length, promptHistory, selectedFile]);

  const commandActions = useMemo(() => [
    { label: 'Run lint', detail: 'Execute npm run lint safely', action: () => runSafeCommand('npm run lint') },
    { label: 'Run build', detail: 'Execute npm run build safely', action: () => runSafeCommand('npm run build') },
    { label: 'Open preview', detail: 'Focus real sandbox preview', action: () => setPanelTab('preview') },
    { label: 'Open code', detail: 'Focus CodeMirror editor', action: () => setPanelTab('code') },
    { label: 'Review diff', detail: 'Focus accept/reject diff gate', action: () => setPanelTab('diff') },
    { label: 'Save memory', detail: 'Anchor current Forge decision locally', action: () => void saveForgeMemory() },
  ], [runSafeCommand, saveForgeMemory, setPanelTab]);

  const fuzzyMatch = useCallback((query: string, target: string): number[] | null => {
    if (!query.trim()) return [];
    const hits: number[] = [];
    let cursor = 0;
    const cleanQuery = query.toLowerCase();
    const cleanTarget = target.toLowerCase();
    for (const char of cleanQuery) {
      const found = cleanTarget.indexOf(char, cursor);
      if (found < 0) return null;
      hits.push(found);
      cursor = found + 1;
    }
    return hits;
  }, []);

  const pickerResults = useMemo(() => {
    return files
      .map(file => ({ file, hits: fuzzyMatch(filePickerQuery, file.path) }))
      .filter((item): item is { file: typeof files[number]; hits: number[] } => item.hits !== null)
      .slice(0, 80);
  }, [filePickerQuery, files, fuzzyMatch]);

  const openPickerFile = useCallback((path: string) => {
    openFile(path);
    setPanelTab('code');
    setFilePickerOpen(false);
  }, [openFile, setPanelTab]);

  const handleReset = useCallback(() => {
    stop();
    resetSession();
  }, [stop, resetSession]);

  const handleApplyProposal = useCallback(() => {
    const session = applyProposal();
    appendTerminal({
      id: forgeId('line'),
      timestamp: nowLabel(),
      kind: session ? 'success' : 'warning',
      source: 'Forge Sandbox',
      text: session
        ? `Applied ${session.files.length} file proposal(s) to sandbox session ${session.hash}.`
        : 'No generated file proposal available to apply.',
    });
  }, [appendTerminal, applyProposal]);

  const handleCopySelectedFile = useCallback(() => {
    if (!selectedFile) return;
    navigator.clipboard?.writeText(selectedFile.contents).catch(() => {});
  }, [selectedFile]);

  const handleCopySandboxSummary = useCallback(() => {
    const session = latestSandboxSession;
    const summary = session
      ? [
        `Forge sandbox session: ${session.title}`,
        `Hash: ${session.hash}`,
        `Applied at: ${session.appliedAt}`,
        `Files:`,
        ...session.files.map(file => `- ${file.path} (${file.language})`),
      ].join('\n')
      : [
        'Forge sandbox proposal',
        `Selected file: ${selectedFile?.path ?? 'none'}`,
        `Status: ${deployStatus}`,
      ].join('\n');
    navigator.clipboard?.writeText(summary).catch(() => {});
  }, [deployStatus, latestSandboxSession, selectedFile]);

  return (
    <main className="relative flex h-screen max-h-screen min-h-0 flex-col overflow-hidden bg-[#0f0f10] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-16rem] h-96 w-[42rem] -translate-x-1/2 rounded-full bg-[#9945FF]/8 blur-3xl" />
        <div className="absolute right-[-10rem] bottom-[-12rem] h-96 w-96 rounded-full bg-[#14F195]/5 blur-3xl" />
      </div>

      <header className="relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] bg-[#111113]/95 px-2 py-1.5 sm:min-h-9 sm:flex-nowrap sm:px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="grid size-7 shrink-0 place-items-center rounded-md border border-white/[0.07] bg-white/[0.03] text-white/45 transition-colors hover:text-white/85"
            aria-label="Back to CongChain"
          >
            <ArrowLeft className="size-3.5" />
          </Link>
          <Box className="size-4 shrink-0 text-white/45" />
          <div className="hidden items-center gap-0.5 sm:flex">
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded px-2 py-1 text-xs text-white/42 outline-none transition-colors hover:bg-white/[0.06] hover:text-white/82 data-[state=open]:bg-white/[0.08] data-[state=open]:text-white/82">
                File
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 border-white/[0.08] bg-[#0b0b0d] text-white/76">
                <DropdownMenuLabel className="text-xs text-white/38">Forge Workspace</DropdownMenuLabel>
                <DropdownMenuItem onSelect={handleReset} className="text-xs">
                  <FilePlus2 className="size-3.5" />
                  New Forge Session
                  <DropdownMenuShortcut>Reset</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleApplyProposal} disabled={busy} className="text-xs">
                  <CheckCircle2 className="size-3.5" />
                  Apply Proposal
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleCopySandboxSummary} className="text-xs">
                  <Clipboard className="size-3.5" />
                  Copy Sandbox Summary
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/[0.08]" />
                <DropdownMenuItem disabled className="text-xs">
                  Export Files
                  <DropdownMenuShortcut>Soon</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="text-xs">
                  Save to Project
                  <DropdownMenuShortcut>Future</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger className="rounded px-2 py-1 text-xs text-white/42 outline-none transition-colors hover:bg-white/[0.06] hover:text-white/82 data-[state=open]:bg-white/[0.08] data-[state=open]:text-white/82">
                Edit
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 border-white/[0.08] bg-[#0b0b0d] text-white/76">
                <DropdownMenuLabel className="text-xs text-white/38">Proposal Tools</DropdownMenuLabel>
                <DropdownMenuItem onSelect={handleCopySelectedFile} disabled={!selectedFile} className="text-xs">
                  <Copy className="size-3.5" />
                  Copy Selected File
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleCopySandboxSummary} className="text-xs">
                  <Clipboard className="size-3.5" />
                  Copy Judge Summary
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/[0.08]" />
                <DropdownMenuItem disabled className="text-xs">
                  Format Proposal
                  <DropdownMenuShortcut>Soon</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="text-xs">
                  Clear Terminal
                  <DropdownMenuShortcut>Future</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger className="rounded px-2 py-1 text-xs text-white/42 outline-none transition-colors hover:bg-white/[0.06] hover:text-white/82 data-[state=open]:bg-white/[0.08] data-[state=open]:text-white/82">
                Run
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 border-white/[0.08] bg-[#0b0b0d] text-white/76">
                <DropdownMenuLabel className="text-xs text-white/38">Execution</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => void runPrivatePayDemo()} disabled={busy} className="text-xs">
                  <Play className="size-3.5" />
                  Run PrivatePay Demo
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void replayLastBuild()} disabled={!canReplay} className="text-xs">
                  <Sparkles className="size-3.5" />
                  Replay Last Build
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={stop} disabled={!busy} className="text-xs">
                  <Square className="size-3.5" />
                  Stop Stream
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/[0.08]" />
                <DropdownMenuItem onSelect={handleApplyProposal} disabled={busy} className="text-xs">
                  <ShieldCheck className="size-3.5" />
                  Verify Sandbox
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="order-last flex w-full basis-full items-center justify-center gap-1.5 sm:order-none sm:w-auto sm:basis-auto sm:justify-end">
          <button
            type="button"
            onClick={() => void runPrivatePayDemo()}
            disabled={busy}
            className="flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-[#14F195]/20 bg-[#14F195]/10 px-2 py-1.5 text-[10px] font-medium text-[#14F195] transition-colors hover:bg-[#14F195]/15 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial sm:px-2.5 sm:text-[11px]"
          >
            <Play className="size-3 shrink-0" />
            <span className="truncate">PrivatePay demo</span>
          </button>
          <button
            type="button"
            onClick={() => void replayLastBuild()}
            disabled={!canReplay}
            className="flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-[#9945FF]/25 bg-[#9945FF]/10 px-2 py-1.5 text-[10px] font-medium text-[#C084FC] transition-colors hover:bg-[#9945FF]/15 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial sm:px-2.5 sm:text-[11px]"
          >
            <Sparkles className="size-3 shrink-0" />
            <span className="truncate">Replay build</span>
          </button>
        </div>

        <div className="hidden h-6 max-w-[28vw] items-center gap-2 rounded-md border border-white/[0.09] bg-black/25 px-2 text-[10px] text-white/38 md:flex lg:max-w-[34rem]">
          <Search className="size-3 shrink-0" />
          <span className="truncate">CONGCHAIN-project / Forge workspace - {RUN_STATUS_LABELS[runStatus]}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setAgentsOpen(true)}
            className="flex min-h-8 items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[10px] text-white/48 transition-colors hover:border-[#9945FF]/30 hover:text-white/82 sm:text-[11px]"
          >
            <Bot className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">Agents</span>
          </button>
          <div className="hidden items-center gap-1.5 text-[10px] text-white/32 sm:flex sm:text-[11px]">
            <NeuralOrb active={phase !== 'idle'} className="scale-75" />
            <span className="max-w-[8rem] truncate lg:max-w-none">{RUN_STATUS_LABELS[runStatus]}</span>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="flex min-h-8 items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[10px] text-white/42 transition-colors hover:border-[#9945FF]/30 hover:text-white/80 sm:text-[11px]"
          >
            <RotateCcw className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </header>

      <section className="relative z-10 hidden min-h-0 flex-1 overflow-hidden lg:block">
        <ResizablePanelGroup direction="horizontal" className="h-full min-h-0 overflow-hidden">
          <ResizablePanel defaultSize={21} minSize={16} maxSize={30}>
            <ForgeFileExplorer
              files={files}
              selectedFile={selectedFilePath}
              buildSteps={buildSteps}
              sandboxSessions={sandboxSessions}
              busy={busy}
              onSelectFile={openFile}
            />
          </ResizablePanel>
          <ResizableHandle className="bg-white/[0.06]" />
          <ResizablePanel defaultSize={79} minSize={50}>
            <ResizablePanelGroup direction="vertical" className="h-full min-h-0 overflow-hidden">
              <ResizablePanel defaultSize={62} minSize={38}>
                <ForgeRightPanel
                  phase={phase}
                  runStatus={runStatus}
                  files={files}
                  selectedFile={selectedFilePath}
                  deployStatus={deployStatus}
                  tab={panelTab}
                  onTabChange={setPanelTab}
                  onSelectFile={openFile}
                  // FORGE_UPGRADE: Code tab can persist edited content and update the Forge store.
                  onFileSaved={updateFileContents}
                  onPrivatePayDemo={runPrivatePayDemo}
                  onReplayLast={replayLastBuild}
                  onApplyProposal={handleApplyProposal}
                  canReplay={canReplay}
                  busy={busy}
                  latestSandboxSession={latestSandboxSession}
                  diffProposal={diffProposal}
                  // FORGE_UPGRADE: Diff proposals can be accepted only from the explicit review button.
                  onDiffAccepted={updateFileContents}
                  onDiffRejected={() => setDiffProposal(null)}
                  onRunSafeCommand={runSafeCommand}
                  onInlineDiff={setDiffProposal}
                  nexusPlan={nexusPlan}
                />
              </ResizablePanel>
              <ResizableHandle className="bg-white/[0.06]" />
              <ResizablePanel defaultSize={38} minSize={26}>
                <ForgeTerminal
                  phase={phase}
                  runStatus={runStatus}
                  terminal={terminal}
                  streamedResponse={streamedResponse}
                  // FORGE_UPGRADE: Terminal composer can attach @file context from the explorer graph.
                  files={files}
                  onRunPrompt={runPrompt}
                  onStop={stop}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </section>

      <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3 pb-4 lg:hidden">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-h-[min(52vh,28rem)] shrink-0"
        >
          <ForgeRightPanel
            phase={phase}
            runStatus={runStatus}
            files={files}
            selectedFile={selectedFilePath}
            deployStatus={deployStatus}
            tab={panelTab}
            onTabChange={setPanelTab}
            onSelectFile={openFile}
            // FORGE_UPGRADE: Code tab can persist edited content and update the Forge store.
            onFileSaved={updateFileContents}
            onPrivatePayDemo={runPrivatePayDemo}
            onReplayLast={replayLastBuild}
            onApplyProposal={handleApplyProposal}
            canReplay={canReplay}
            busy={busy}
            latestSandboxSession={latestSandboxSession}
            diffProposal={diffProposal}
            // FORGE_UPGRADE: Diff proposals can be accepted only from the explicit review button.
            onDiffAccepted={updateFileContents}
            onDiffRejected={() => setDiffProposal(null)}
            onRunSafeCommand={runSafeCommand}
            onInlineDiff={setDiffProposal}
            nexusPlan={nexusPlan}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="min-h-[14rem] shrink-0"
        >
          <ForgeTerminal
            phase={phase}
            runStatus={runStatus}
            terminal={terminal}
            streamedResponse={streamedResponse}
            // FORGE_UPGRADE: Terminal composer can attach @file context from the explorer graph.
            files={files}
            onRunPrompt={runPrompt}
            onStop={stop}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="max-h-[38vh] min-h-[12rem] shrink-0 overflow-hidden"
        >
          <ForgeFileExplorer
            files={files}
            selectedFile={selectedFilePath}
            buildSteps={buildSteps}
            sandboxSessions={sandboxSessions}
            busy={busy}
            onSelectFile={openFile}
          />
        </motion.div>
      </section>

      <Sheet open={agentsOpen} onOpenChange={setAgentsOpen}>
        <SheetContent side="right" className="w-[min(28rem,92vw)] border-white/[0.08] bg-[#08080a] p-0 text-white sm:max-w-[28rem]">
          <SheetHeader className="border-b border-white/[0.07] p-4">
            <SheetTitle className="flex items-center gap-2 text-white/88">
              <Bot className="size-4 text-[#C084FC]" />
              Agent Mesh
            </SheetTitle>
            <SheetDescription className="text-white/38">
              Select and monitor Forge agents without leaving the code workspace.
            </SheetDescription>
          </SheetHeader>
          <ForgeSidebar
            agents={agents}
            phase={phase}
            runStatus={runStatus}
            deployStatus={deployStatus}
            promptHistory={promptHistory}
            sandboxSessions={sandboxSessions}
            terminal={terminal}
            busy={busy}
            onPromptSelect={runPrompt}
          />
        </SheetContent>
      </Sheet>
      {commandPaletteOpen && (
        <div className="absolute inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh]" onClick={() => setCommandPaletteOpen(false)}>
          <div className="w-full max-w-xl rounded-2xl border border-white/[0.09] bg-[#08080a] p-2 shadow-2xl shadow-black" onClick={event => event.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2 text-white/50">
              <Command className="size-4 text-[#00D4FF]" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Forge Command Palette</span>
              <span className="ml-auto font-mono text-[10px] text-white/25">Ctrl K</span>
            </div>
            <div className="p-2">
              {commandActions.map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    item.action();
                    setCommandPaletteOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.06]"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.035] text-[#14F195]">
                    <Command className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white/82">{item.label}</span>
                    <span className="block truncate text-[11px] text-white/35">{item.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {filePickerOpen && (
        <div
          className="absolute bottom-0 left-[21%] right-0 top-10 z-40 bg-black/40 pt-8"
          onClick={() => setFilePickerOpen(false)}
        >
          <div
            className="mx-auto w-[min(480px,92%)] overflow-hidden rounded-[10px] border border-[#1f3a1f] bg-[#0d120d] shadow-2xl shadow-black"
            onClick={event => event.stopPropagation()}
          >
            <input
              value={filePickerQuery}
              onChange={event => {
                setFilePickerQuery(event.target.value);
                setFilePickerIndex(0);
              }}
              onKeyDown={event => {
                if (event.key === 'Escape') setFilePickerOpen(false);
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setFilePickerIndex(index => Math.min(index + 1, Math.max(0, pickerResults.length - 1)));
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setFilePickerIndex(index => Math.max(0, index - 1));
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const picked = pickerResults[filePickerIndex]?.file;
                  if (picked) openPickerFile(picked.path);
                }
              }}
              autoFocus
              placeholder="Buscar arquivo..."
              className="w-full border-0 border-b border-[#1f3a1f] bg-transparent px-4 py-3 font-mono text-[13px] text-[#b8d4b8] outline-none"
            />
            <div className="max-h-[17rem] overflow-y-auto py-1">
              {pickerResults.slice(0, 32).map((item, index) => {
                const hitSet = new Set(item.hits);
                return (
                  <button
                    key={item.file.path}
                    type="button"
                    onClick={() => openPickerFile(item.file.path)}
                    className={`block w-full px-4 py-2 text-left font-mono text-[12px] ${
                      index === filePickerIndex ? 'bg-[#0d2a1a] text-[#00FF9C]' : 'text-white/55 hover:bg-[#111a11]'
                    }`}
                  >
                    {item.file.path.split('').map((char, charIndex) => (
                      <span key={`${item.file.path}-${charIndex}`} className={hitSet.has(charIndex) ? 'text-[#00FF9C]' : undefined}>
                        {char}
                      </span>
                    ))}
                  </button>
                );
              })}
              {pickerResults.length === 0 ? <p className="px-4 py-6 text-center text-xs text-white/28">Nenhum arquivo encontrado.</p> : null}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export function ForgeWorkspace() {
  return <ForgeWorkspaceInner />;
}
