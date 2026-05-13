'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Loader2, Square, Terminal } from 'lucide-react';
import type { ForgePhase, ForgeTerminalLine } from '@/lib/forge/types';
import { suggestedPrompts } from '@/lib/forge/demo-data';

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
    <section className="flex h-full min-h-0 flex-1 flex-col border-t border-white/[0.07] bg-[#0b0b0d]/95">
      <header className="flex h-9 items-center justify-between border-b border-white/[0.07] px-3">
        <div className="flex items-center gap-4 text-[12px] font-medium">
          {['Problems', 'Output', 'Debug Console'].map(item => (
            <span key={item} className="text-white/32">{item}</span>
          ))}
          <span className="rounded-md bg-white/[0.07] px-2 py-1 text-white/80">Terminal</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-white/35">
          {running && <Loader2 className="size-3 animate-spin text-[#14F195]" />}
          <span>{running ? 'agents executing' : 'powershell'}</span>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-1.5">
          {terminal.map(line => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-[64px_1fr] gap-2 rounded-md px-2 py-1.5 font-mono text-[12px]"
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

      <div className="border-t border-white/[0.07] p-3">
        {!running && (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {suggestedPrompts.map(item => (
              <button
                key={item}
                onClick={() => setPrompt(item)}
                className="shrink-0 rounded-md border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[11px] text-white/36 transition-colors hover:border-[#9945FF]/30 hover:text-white/70"
              >
                {item}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="flex items-end gap-2 rounded-xl border border-white/[0.08] bg-black/30 p-2">
          <textarea
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            rows={1}
            placeholder="Describe what you want Forge to build..."
            className="min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-white/80 outline-none placeholder:text-white/25"
            disabled={running}
          />
          <button
            type={running ? 'button' : 'submit'}
            onClick={running ? onStop : undefined}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#9945FF]/25 bg-[#9945FF]/15 text-[#C084FC] transition-colors hover:border-[#14F195]/35 hover:bg-[#14F195]/10 hover:text-[#14F195] disabled:opacity-40"
            disabled={!running && !prompt.trim()}
            aria-label={running ? 'Stop simulation' : 'Run Forge prompt'}
          >
            {running ? <Square className="size-4" /> : <ArrowUp className="size-4" />}
          </button>
        </form>
      </div>
    </section>
  );
}
