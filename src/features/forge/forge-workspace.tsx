'use client';

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Bot, Box, Play, RotateCcw, Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useShallow } from 'zustand/react/shallow';
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
    selectedFile,
    buildSteps,
    deployStatus,
    panelTab,
    promptHistory,
    sandboxSessions,
    activeSandboxSessionId,
    setPanelTab,
    setSelectedFile,
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
      setPanelTab: s.setPanelTab,
      setSelectedFile: s.setSelectedFile,
      appendTerminal: s.appendTerminal,
      applyProposal: s.applyProposal,
      resetSession: s.resetSession,
    })),
  );

  const busy = busyPhases.includes(phase as (typeof busyPhases)[number]);
  const canReplay = promptHistory.length > 0 && !busy;
  const latestSandboxSession =
    sandboxSessions.find(session => session.id === activeSandboxSessionId) ?? sandboxSessions[0];

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
          <span className="hidden text-xs text-white/42 sm:inline">File</span>
          <span className="hidden text-xs text-white/42 sm:inline">Edit</span>
          <span className="hidden text-xs text-white/42 sm:inline">Run</span>
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
              selectedFile={selectedFile}
              buildSteps={buildSteps}
              sandboxSessions={sandboxSessions}
              busy={busy}
              onSelectFile={setSelectedFile}
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
                  selectedFile={selectedFile}
                  deployStatus={deployStatus}
                  tab={panelTab}
                  onTabChange={setPanelTab}
                  onSelectFile={setSelectedFile}
                  onPrivatePayDemo={runPrivatePayDemo}
                  onReplayLast={replayLastBuild}
                  onApplyProposal={handleApplyProposal}
                  canReplay={canReplay}
                  busy={busy}
                  latestSandboxSession={latestSandboxSession}
                />
              </ResizablePanel>
              <ResizableHandle className="bg-white/[0.06]" />
              <ResizablePanel defaultSize={38} minSize={26}>
                <ForgeTerminal
                  phase={phase}
                  runStatus={runStatus}
                  terminal={terminal}
                  streamedResponse={streamedResponse}
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
            selectedFile={selectedFile}
            deployStatus={deployStatus}
            tab={panelTab}
            onTabChange={setPanelTab}
            onSelectFile={setSelectedFile}
            onPrivatePayDemo={runPrivatePayDemo}
            onReplayLast={replayLastBuild}
            onApplyProposal={handleApplyProposal}
            canReplay={canReplay}
            busy={busy}
            latestSandboxSession={latestSandboxSession}
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
            selectedFile={selectedFile}
            buildSteps={buildSteps}
            sandboxSessions={sandboxSessions}
            busy={busy}
            onSelectFile={setSelectedFile}
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
    </main>
  );
}

export function ForgeWorkspace() {
  return <ForgeWorkspaceInner />;
}
