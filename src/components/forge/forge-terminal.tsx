'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Command, Loader2, Square, Terminal } from 'lucide-react';
import type { ForgePhase, ForgeTerminalLine } from '@/lib/forge/types';
import { suggestedPrompts } from '@/lib/forge/demo-data';
import { GlassPanel } from './glass-panel';
import { NeuralOrb } from './neural-orb';

const lineColors = {
  system: 'text-[#C084FC]',
  agent: 'text-[#7DD3FC]',
  shell: 'text-white/45',
  success: 'text-[#14F195]',
  warning: 'text-[#FBBF24]',
  error: 'text-red-300',
};

export function ForgeTerminal({
  phase,
  terminal,
  streamedResponse,
  onRunPrompt,
  onStop,
}: {
  phase: ForgePhase;
  terminal: ForgeTerminalLine[];
  streamedResponse: string;
  onRunPrompt: (prompt: string) => void;
  onStop: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const running = ['thinking', 'planning', 'building', 'deploying'].includes(phase);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [terminal, streamedResponse]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim() || running) return;
    onRunPrompt(prompt);
    setPrompt('');
  }

  return (
    <GlassPanel className="flex min-h-[560px] flex-1 flex-col p-0">
      <header className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <div className="flex items-center gap-3">
          <NeuralOrb active={running} className="size-10" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-white/30">AI Operating Terminal</p>
            <h2 className="text-lg font-semibold text-white/90">Build with agent memory</h2>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-xs text-white/40 sm:flex">
          {running ? <Loader2 className="size-3 animate-spin text-[#14F195]" /> : <Command className="size-3 text-[#9945FF]" />}
          {running ? 'agents executing' : 'sandbox ready'}
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          {terminal.map(line => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-[76px_1fr] gap-3 rounded-xl border border-white/[0.04] bg-black/20 px-3 py-2.5 font-mono text-xs"
            >
              <span className="text-white/22">{line.timestamp}</span>
              <div className="min-w-0">
                <span className={lineColors[line.kind]}>{line.source}</span>
                <span className="text-white/25"> :: </span>
                <span className="break-words text-white/58">{line.text}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {(streamedResponse || running) && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mt-4 rounded-2xl border border-[#9945FF]/15 bg-[#9945FF]/[0.045] p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <Terminal className="size-4 text-[#C084FC]" />
                <p className="text-sm font-semibold text-white/80">Forge response stream</p>
                {running && <span className="h-2 w-2 animate-pulse rounded-full bg-[#14F195]" />}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-7 text-white/65">
                {streamedResponse}
                {running && <span className="ml-1 inline-block h-4 w-2 translate-y-0.5 animate-pulse rounded-sm bg-[#14F195]/70" />}
              </p>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <div className="border-t border-white/[0.07] p-4">
        {!running && (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {suggestedPrompts.map(item => (
              <button
                key={item}
                onClick={() => setPrompt(item)}
                className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/40 transition-colors hover:border-[#9945FF]/30 hover:text-white/75"
              >
                {item}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border border-white/[0.09] bg-black/35 p-2">
          <textarea
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            rows={2}
            placeholder="Ask Forge to build an app, agent workflow, API, or Solana-native interface..."
            className="min-h-12 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-white/80 outline-none placeholder:text-white/25"
            disabled={running}
          />
          <button
            type={running ? 'button' : 'submit'}
            onClick={running ? onStop : undefined}
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#9945FF]/25 bg-[#9945FF]/15 text-[#C084FC] transition-colors hover:border-[#14F195]/35 hover:bg-[#14F195]/10 hover:text-[#14F195] disabled:opacity-40"
            disabled={!running && !prompt.trim()}
            aria-label={running ? 'Stop simulation' : 'Run Forge prompt'}
          >
            {running ? <Square className="size-4" /> : <ArrowUp className="size-4" />}
          </button>
        </form>
      </div>
    </GlassPanel>
  );
}
