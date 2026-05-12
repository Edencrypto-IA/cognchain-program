'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Layers3, LockKeyhole, RotateCcw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ForgeSidebar } from '@/components/forge/forge-sidebar';
import { ForgeTerminal } from '@/components/forge/forge-terminal';
import { ForgeRightPanel } from '@/components/forge/forge-right-panel';
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
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-10rem] h-96 w-[44rem] -translate-x-1/2 rounded-full bg-[#9945FF]/12 blur-3xl" />
        <div className="absolute right-[-8rem] top-1/3 h-96 w-96 rounded-full bg-[#14F195]/8 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-[-10rem] h-96 w-96 rounded-full bg-[#38BDF8]/8 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:64px_64px] opacity-30" />
      </div>

      <header className="relative z-10 flex items-center justify-between border-b border-white/[0.07] bg-black/25 px-4 py-3 backdrop-blur-2xl">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/45 transition-colors hover:text-white/85"
            aria-label="Back to CongChain"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <NeuralOrb active={phase !== 'idle'} className="hidden sm:grid" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#14F195]/70">Phase 1 MVP</p>
              <span className="hidden rounded-full border border-[#14F195]/20 bg-[#14F195]/10 px-2 py-0.5 text-[10px] text-[#14F195]/70 sm:inline-flex">
                isolated sandbox
              </span>
            </div>
            <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">CongChain Forge</h1>
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {[
            [Layers3, 'agent OS'],
            [LockKeyhole, 'no production writes'],
            [Sparkles, 'visual simulation'],
          ].map(([Icon, label]) => (
            <div key={label as string} className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-xs text-white/42">
              <Icon className="size-3.5 text-[#C084FC]" />
              {label as string}
            </div>
          ))}
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-xs text-white/42 transition-colors hover:border-[#9945FF]/30 hover:text-white/80"
          >
            <RotateCcw className="size-3.5 text-[#14F195]" />
            Reset session
          </button>
        </div>

        <button
          onClick={handleReset}
          className="grid size-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/45 transition-colors hover:text-white/85 lg:hidden"
          aria-label="Reset Forge session"
        >
          <RotateCcw className="size-4" />
        </button>
      </header>

      <section className="relative z-10 hidden h-[calc(100vh-65px)] lg:block">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={22} minSize={18} maxSize={28}>
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
          <ResizablePanel defaultSize={45} minSize={34}>
            <div className="flex h-full p-3">
              <ForgeTerminal
                phase={phase}
                terminal={terminal}
                streamedResponse={streamedResponse}
                onRunPrompt={runPrompt}
                onStop={stop}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle className="bg-white/[0.06]" />
          <ResizablePanel defaultSize={33} minSize={28}>
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
