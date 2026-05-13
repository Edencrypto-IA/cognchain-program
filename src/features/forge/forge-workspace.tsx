'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Box, RotateCcw, Search } from 'lucide-react';
import Link from 'next/link';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ForgeSidebar } from '@/components/forge/forge-sidebar';
import { ForgeTerminal } from '@/components/forge/forge-terminal';
import { ForgeRightPanel } from '@/components/forge/forge-right-panel';
import { ForgeFileExplorer } from '@/components/forge/forge-file-explorer';
import { NeuralOrb } from '@/components/forge/neural-orb';
import { useForgeSimulation } from '@/hooks/forge/use-forge-simulation';
import { useForgeStore } from '@/hooks/forge/use-forge-store';

export function ForgeWorkspace() {
  const { runPrompt, stop } = useForgeSimulation();
  const phase = useForgeStore(state => state.phase);
  const agents = useForgeStore(state => state.agents);
  const terminal = useForgeStore(state => state.terminal);
  const streamedResponse = useForgeStore(state => state.streamedResponse);
  const files = useForgeStore(state => state.files);
  const selectedFile = useForgeStore(state => state.selectedFile);
  const buildSteps = useForgeStore(state => state.buildSteps);
  const memoryNodes = useForgeStore(state => state.memoryNodes);
  const deployStatus = useForgeStore(state => state.deployStatus);
  const panelTab = useForgeStore(state => state.panelTab);
  const promptHistory = useForgeStore(state => state.promptHistory);
  const setPanelTab = useForgeStore(state => state.setPanelTab);
  const setSelectedFile = useForgeStore(state => state.setSelectedFile);
  const resetSession = useForgeStore(state => state.resetSession);

  const handleReset = () => {
    stop();
    resetSession();
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0f0f10] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-16rem] h-96 w-[42rem] -translate-x-1/2 rounded-full bg-[#9945FF]/8 blur-3xl" />
        <div className="absolute right-[-10rem] bottom-[-12rem] h-96 w-96 rounded-full bg-[#14F195]/5 blur-3xl" />
      </div>

      <header className="relative z-10 flex h-9 items-center justify-between border-b border-white/[0.07] bg-[#111113]/95 px-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="grid size-7 shrink-0 place-items-center rounded-md border border-white/[0.07] bg-white/[0.03] text-white/45 transition-colors hover:text-white/85"
            aria-label="Back to CongChain"
          >
            <ArrowLeft className="size-3.5" />
          </Link>
          <Box className="size-4 text-white/45" />
          <span className="hidden text-xs text-white/42 sm:inline">File</span>
          <span className="hidden text-xs text-white/42 sm:inline">Edit</span>
          <span className="hidden text-xs text-white/42 sm:inline">Run</span>
        </div>

        <div className="hidden h-6 w-[34rem] max-w-[42vw] items-center gap-2 rounded-md border border-white/[0.09] bg-black/25 px-3 text-xs text-white/38 md:flex">
          <Search className="size-3.5" />
          <span className="truncate">CONGCHAIN-project / Forge sandbox</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 text-[11px] text-white/32 sm:flex">
            <NeuralOrb active={phase !== 'idle'} className="scale-75" />
            <span>Phase 1 MVP</span>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[11px] text-white/42 transition-colors hover:border-[#9945FF]/30 hover:text-white/80"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </header>

      <section className="relative z-10 hidden h-[calc(100vh-36px)] lg:block">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={19} minSize={15} maxSize={24}>
            <ForgeSidebar
              agents={agents}
              phase={phase}
              deployStatus={deployStatus}
              promptHistory={promptHistory}
              terminal={terminal}
              onPromptSelect={runPrompt}
            />
          </ResizablePanel>
          <ResizableHandle className="bg-white/[0.06]" />
          <ResizablePanel defaultSize={63} minSize={42}>
            <ResizablePanelGroup direction="vertical" className="h-full">
              <ResizablePanel defaultSize={68} minSize={42}>
                <ForgeRightPanel
                  phase={phase}
                  files={files}
                  selectedFile={selectedFile}
                  buildSteps={buildSteps}
                  memoryNodes={memoryNodes}
                  deployStatus={deployStatus}
                  tab={panelTab}
                  onTabChange={setPanelTab}
                  onSelectFile={setSelectedFile}
                />
              </ResizablePanel>
              <ResizableHandle className="bg-white/[0.06]" />
              <ResizablePanel defaultSize={32} minSize={22}>
                <ForgeTerminal
                  phase={phase}
                  terminal={terminal}
                  streamedResponse={streamedResponse}
                  onRunPrompt={runPrompt}
                  onStop={stop}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle className="bg-white/[0.06]" />
          <ResizablePanel defaultSize={18} minSize={14} maxSize={24}>
            <ForgeFileExplorer
              files={files}
              selectedFile={selectedFile}
              buildSteps={buildSteps}
              agents={agents}
              onSelectFile={setSelectedFile}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </section>

      <section className="relative z-10 grid gap-3 p-3 lg:hidden">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <ForgeTerminal
            phase={phase}
            terminal={terminal}
            streamedResponse={streamedResponse}
            onRunPrompt={runPrompt}
            onStop={stop}
          />
        </motion.div>
        <ForgeRightPanel
          phase={phase}
          files={files}
          selectedFile={selectedFile}
          buildSteps={buildSteps}
          memoryNodes={memoryNodes}
          deployStatus={deployStatus}
          tab={panelTab}
          onTabChange={setPanelTab}
          onSelectFile={setSelectedFile}
        />
        <ForgeSidebar
          agents={agents}
          phase={phase}
          deployStatus={deployStatus}
          promptHistory={promptHistory}
          terminal={terminal}
          onPromptSelect={runPrompt}
        />
      </section>
    </main>
  );
}
