'use client';

import { FormEvent, memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Bot, Boxes, Braces, Layers3, Loader2, Square, Terminal } from 'lucide-react';
import type { ForgePhase, ForgeRunStatus, ForgeTerminalLine } from '@/lib/forge/types';
import { RUN_STATUS_LABELS } from '@/lib/forge/forge-ui';
import { suggestedPrompts } from '@/lib/forge/demo-data';

const lineColors = {
  system: 'text-[#C084FC]',
  agent: 'text-[#7DD3FC]',
  shell: 'text-white/45',
  success: 'text-[#14F195]',
  warning: 'text-[#FBBF24]',
  error: 'text-red-300',
};

type ForgeComposerMode = 'App' | 'Component' | 'API' | 'Agent';

const COMPOSER_MODES: Array<{ mode: ForgeComposerMode; icon: typeof Layers3; placeholder: string }> = [
  { mode: 'App', icon: Layers3, placeholder: 'Describe the full app you want Forge to build...' },
  { mode: 'Component', icon: Boxes, placeholder: 'Describe the component, state, props, and behavior...' },
  { mode: 'API', icon: Braces, placeholder: 'Describe the endpoint, data contract, and validation...' },
  { mode: 'Agent', icon: Bot, placeholder: 'Describe the agent workflow, tools, and success criteria...' },
];

const SUGGESTED_PREVIEW = suggestedPrompts.slice(0, 2);

const TerminalLineList = memo(function TerminalLineList({ lines }: { lines: ForgeTerminalLine[] }) {
  return (
    <div className="space-y-1.5">
      {lines.map(line => (
        <motion.div
          key={line.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-[52px_1fr] gap-2 rounded-md px-2 py-1.5 font-mono text-[12px] sm:grid-cols-[64px_1fr]"
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
  );
});

const StreamPanel = memo(function StreamPanel({ text, pulsing }: { text: string; pulsing: boolean }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="mt-4 rounded-2xl border border-[#9945FF]/15 bg-[#9945FF]/[0.045] p-3 sm:p-4"
    >
      <div className="mb-2 flex items-center gap-2 sm:mb-3">
        <Terminal className="size-4 shrink-0 text-[#C084FC]" />
        <p className="text-sm font-semibold text-white/80">Forge response stream</p>
        {pulsing && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#14F195]" />}
      </div>
      <p className="max-h-[min(40vh,22rem)] overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-white/65">
        {text}
        {pulsing && <span className="ml-1 inline-block h-4 w-2 translate-y-0.5 animate-pulse rounded-sm bg-[#14F195]/70" />}
      </p>
    </motion.section>
  );
});

function ForgeTerminalComponent({
  phase,
  runStatus,
  terminal,
  streamedResponse,
  onRunPrompt,
  onStop,
}: {
  phase: ForgePhase;
  runStatus: ForgeRunStatus;
  terminal: ForgeTerminalLine[];
  streamedResponse: string;
  onRunPrompt: (prompt: string) => void;
  onStop: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<ForgeComposerMode>('App');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);

  const running = ['thinking', 'planning', 'building', 'deploying'].includes(phase);
  const connecting = runStatus === 'connecting';
  const streaming = runStatus === 'streaming';
  const activeMode = COMPOSER_MODES.find(item => item.mode === mode) ?? COMPOSER_MODES[0];
  const ActiveModeIcon = activeMode.icon;

  const scheduleScroll = useCallback(() => {
    if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = scrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
    });
  }, []);

  useLayoutEffect(() => {
    scheduleScroll();
  }, [terminal, streamedResponse, scheduleScroll]);

  useEffect(() => () => {
    if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim() || running || connecting) return;
    onRunPrompt(`[${mode}] ${prompt}`);
    setPrompt('');
  }

  const footerLabel =
    running || connecting
      ? (streaming ? RUN_STATUS_LABELS.streaming : RUN_STATUS_LABELS.connecting)
      : RUN_STATUS_LABELS[runStatus];

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col border-t border-white/[0.07] bg-[#0b0b0d]/95">
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.07] px-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-3 text-[12px] font-medium">
          {['Problems', 'Output', 'Debug'].map(item => (
            <span key={item} className="hidden text-white/32 sm:inline">
              {item}
            </span>
          ))}
          <span className="rounded-md bg-white/[0.07] px-2 py-1 text-white/80">Terminal</span>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-white/35">
          {(running || connecting) && <Loader2 className="size-3 shrink-0 animate-spin text-[#14F195]" />}
          <span className="truncate">{footerLabel}</span>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 sm:px-3">
        <TerminalLineList lines={terminal} />

        <AnimatePresence>
          {(streamedResponse || running || connecting) && (
            <StreamPanel text={streamedResponse} pulsing={running || connecting} />
          )}
        </AnimatePresence>
      </div>

      <div className="shrink-0 border-t border-white/[0.07] p-2 sm:p-3">
        <form onSubmit={submit} className="rounded-2xl border border-white/[0.09] bg-[#101013]/95 p-2 shadow-2xl shadow-black/25">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full rounded-xl border border-white/[0.07] bg-black/25 p-1 sm:w-auto">
              {COMPOSER_MODES.map(({ mode: itemMode, icon: Icon }) => (
                <button
                  key={itemMode}
                  type="button"
                  onClick={() => setMode(itemMode)}
                  disabled={running || connecting}
                  className={`flex min-h-8 flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors sm:gap-1.5 sm:px-2.5 sm:text-[11px] ${
                    mode === itemMode
                      ? 'bg-white/[0.08] text-white/85'
                      : 'text-white/34 hover:bg-white/[0.045] hover:text-white/65'
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <Icon className="size-3.5 shrink-0" />
                  {itemMode}
                </button>
              ))}
            </div>

            {!running && !connecting && (
              <div className="hidden min-w-0 flex-1 justify-end gap-1.5 overflow-hidden md:flex">
                {SUGGESTED_PREVIEW.map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPrompt(item)}
                    className="truncate rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5 text-[11px] text-white/32 transition-colors hover:border-[#9945FF]/30 hover:text-white/68"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-end gap-2">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-white/42">
              <ActiveModeIcon className="size-4" />
            </div>
            <textarea
              value={prompt}
              onChange={event => setPrompt(event.target.value)}
              rows={1}
              placeholder={activeMode.placeholder}
              className="min-h-[2.75rem] flex-1 resize-y bg-transparent px-1 py-2 text-sm leading-5 text-white/82 outline-none placeholder:text-white/24 sm:min-h-9"
              disabled={running || connecting}
            />
            <button
              type={running || connecting ? 'button' : 'submit'}
              onClick={running || connecting ? onStop : undefined}
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#9945FF]/25 bg-[#9945FF]/15 text-[#C084FC] transition-colors hover:border-[#14F195]/35 hover:bg-[#14F195]/10 hover:text-[#14F195] disabled:opacity-40"
              disabled={!running && !connecting && !prompt.trim()}
              aria-label={running || connecting ? 'Stop stream' : 'Run Forge prompt'}
            >
              {running || connecting ? <Square className="size-4" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export const ForgeTerminal = memo(ForgeTerminalComponent);
