'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Bot, CheckCircle2, Cpu, Loader2, Play, Square, XCircle } from 'lucide-react';
import { formatCostUSD } from '@/lib/mythos/agentic-metrics';

type ApprovedItem = {
  kind: string;
  detail: string;
  hash?: string;
  html?: string;
};

type MythosAgenticEvent =
  | { type: 'status'; text: string }
  | { type: 'plan'; plan: { intent: string; steps: Array<{ tool: string; purpose: string }>; safety: string[] } }
  | { type: 'tool_start'; tool: string; args: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; ok: boolean; summary: string }
  | { type: 'proposal'; proposal: { kind: string; title: string; payload: Record<string, unknown> } }
  | { type: 'done'; summary: string; tools: Array<{ tool: string; ok?: boolean }>; proposals: Array<{ kind: string }>; mode: string; cost?: { estimatedCostUSD: number; inputChars: number; outputChars: number }; memory?: { reused: number; saved: boolean; savedHash?: string } }
  | { type: 'error'; message: string };

function parseSseData(raw: string): string | null {
  const data = raw
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => line.replace(/^data:\s?/, ''))
    .join('\n');
  return data || null;
}

export function MythosAgenticConsole() {
  const [command, setCommand] = useState('');
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [tools, setTools] = useState<Array<{ tool: string; ok?: boolean; summary?: string }>>([]);
  const [proposals, setProposals] = useState<Array<{ kind: string; title: string; payload: Record<string, unknown> }>>([]);
  const [approved, setApproved] = useState<ApprovedItem[]>([]);
  const [approvingKey, setApprovingKey] = useState('');
  const [stats, setStats] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, tools, proposals, summary]);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  const run = useCallback(async () => {
    const clean = command.trim();
    if (!clean || running) return;
    abortRef.current?.abort();
    setRunning(true);
    setLines([]);
    setTools([]);
    setProposals([]);
    setSummary('');
    setError('');
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const response = await fetch('/api/mythos/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command: clean }),
        signal: ac.signal,
      });
      if (!response.ok || !response.body) {
        const detail = response.status === 429 ? 'Limite de requisições. Aguarde um momento.' : `HTTP ${response.status}`;
        setError(detail);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const raw of events) {
          const data = parseSseData(raw);
          if (!data) continue;
          try {
            const event = JSON.parse(data) as MythosAgenticEvent;
            if (event.type === 'status') setLines(current => [...current, event.text]);
            if (event.type === 'plan') setLines(current => [...current, `🧭 Plano (${event.plan.intent}): ${event.plan.steps.map(s => s.tool).join(' → ')}`]);
            if (event.type === 'tool_start') setLines(current => [...current, `⚙️ ${event.tool}(${JSON.stringify(event.args).slice(0, 120)})`]);
            if (event.type === 'tool_result') setTools(current => [...current, { tool: event.tool, ok: event.ok, summary: event.summary.slice(0, 300) }]);
            if (event.type === 'proposal') setProposals(current => [...current, event.proposal]);
            if (event.type === 'done') {
              setSummary(event.summary);
              const costLine = event.cost
                ? ` | 💸 Custo estimado: ${formatCostUSD(event.cost.estimatedCostUSD)} (${event.cost.inputChars} chars in / ${event.cost.outputChars} out)`
                : '';
              const memoryLine = event.memory
                ? `${event.memory.reused > 0 ? ` | ♻️ ${event.memory.reused} memória(s) reusada(s)` : ''}${event.memory.saved ? ` | 💾 memória de tarefa salva${event.memory.savedHash ? ` (${event.memory.savedHash.slice(0, 16)}…)` : ''}` : ''}`
                : '';
              setLines(current => [...current, `✅ Concluído (${event.mode}): ${event.summary.slice(0, 200)}${costLine}${memoryLine}`]);
            }
            if (event.type === 'error') setError(event.message);
          } catch { /* malformed */ }
        }
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'Falha no loop agêntico.');
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }, [command, running]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  }, []);

  const approve = useCallback(async (key: string, kind: string, payload: Record<string, unknown>) => {
    if (approvingKey) return;
    setApprovingKey(key);
    setError('');
    try {
      const response = await fetch('/api/mythos/agent/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind, payload }),
      });
      const data = await response.json() as { ok?: boolean; detail?: string; hash?: string; html?: string; error?: string };
      if (!response.ok || data.ok !== true) {
        throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${response.status}`);
      }
      setApproved(current => [...current, { kind, detail: data.detail ?? 'Aprovado.', hash: data.hash, html: data.html }]);
      setProposals(current => current.filter((_, index) => key !== `${kind}-${index}`));
      setLines(current => [...current, `✅ Aprovado (${kind}): ${data.detail ?? ''}`]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao aprovar proposta.');
    } finally {
      setApprovingKey('');
    }
  }, [approvingKey]);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/mythos/agent/stats', { credentials: 'include' });
      const data = await response.json() as Record<string, unknown>;
      setStats(JSON.stringify(data, null, 2));
    } catch {
      setStats('Não foi possível carregar as métricas.');
    }
  }, []);

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl border border-[#9945FF]/25 bg-[#9945FF]/12 text-[#C084FC]">
          <Bot className="size-5" />
        </span>
        <div>
          <h1 className="text-sm font-semibold text-white/85">Mythos Agentic Loop</h1>
          <p className="text-[11px] text-white/35">
            Planeja → executa ferramentas reais (somente leitura) → propõe ações → conclui. DeepSeek + function calling.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadStats()}
          className="ml-auto flex h-8 items-center gap-1.5 rounded-lg border border-[#00D4FF]/20 bg-[#00D4FF]/8 px-2.5 text-[11px] font-medium text-[#5EEAD4] transition-colors hover:border-[#00D4FF]/35 hover:bg-[#00D4FF]/12"
        >
          <BarChart3 className="size-3.5" />
          Métricas
        </button>
      </header>

      {stats ? (
        <pre className="max-h-72 overflow-auto rounded-2xl border border-[#00D4FF]/15 bg-[#0b0b0d]/90 p-3 font-mono text-[11px] leading-5 text-white/55">{stats}</pre>
      ) : null}

      <form
        onSubmit={event => { event.preventDefault(); void run(); }}
        className="flex items-end gap-2 rounded-2xl border border-white/[0.09] bg-[#101013]/95 p-2 shadow-2xl shadow-black/25"
      >
        <textarea
          value={command}
          onChange={event => setCommand(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void run(); } }}
          rows={2}
          placeholder="Ex.: pesquisa o preço atual do SOL e resume o mercado · analisa a carteira 7xP4... · radar politico do prefeito"
          className="min-h-[3.5rem] flex-1 resize-y bg-transparent px-2 py-2 text-sm leading-6 text-white/82 outline-none placeholder:text-white/24"
          disabled={running}
        />
        <button
          type={running ? 'button' : 'submit'}
          onClick={running ? stop : undefined}
          disabled={!running && !command.trim()}
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#9945FF]/25 bg-[#9945FF]/15 text-[#C084FC] transition-colors hover:border-[#14F195]/35 hover:bg-[#14F195]/10 hover:text-[#14F195] disabled:opacity-40"
          aria-label={running ? 'Parar' : 'Executar agêntico'}
        >
          {running ? <Square className="size-4" /> : <Play className="size-4" />}
        </button>
      </form>

      {(running || lines.length > 0 || error || summary) && (
        <div ref={scrollRef} className="max-h-[30vh] overflow-y-auto rounded-2xl border border-white/[0.07] bg-[#0b0b0d]/90 p-3 font-mono text-[12px] leading-6">
          {lines.map((line, index) => (
            <p key={index} className="text-white/55">{line}</p>
          ))}
          {running && <p className="flex items-center gap-2 text-[#14F195]/80"><Loader2 className="size-3 animate-spin" /> executando…</p>}
          {error ? <p className="mt-1 text-red-300">✗ {error}</p> : null}
        </div>
      )}

      {tools.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">Ferramentas executadas</p>
          {tools.map((tool, index) => (
            <div key={`${tool.tool}-${index}`} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
              <p className="flex items-center gap-2 text-[12px] font-medium">
                {tool.ok === false
                  ? <XCircle className="size-3.5 text-red-300" />
                  : <CheckCircle2 className="size-3.5 text-[#14F195]" />}
                <span className="text-white/75">{tool.tool}</span>
              </p>
              {tool.summary ? <p className="mt-1 pl-5 text-[11px] leading-5 text-white/40">{tool.summary}</p> : null}
            </div>
          ))}
        </div>
      )}

      {proposals.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
            Propostas aguardando aprovação humana ({proposals.length})
          </p>
          {proposals.map((proposal, index) => {
            const key = `${proposal.kind}-${index}`;
            return (
              <div key={key} className="rounded-xl border border-[#14F195]/20 bg-[#14F195]/[0.04] px-3 py-2">
                <p className="flex items-center gap-2 text-[12px] font-medium text-[#14F195]">
                  <Cpu className="size-3.5" />
                  {proposal.kind}
                </p>
                <p className="mt-1 pl-5 text-[11px] text-white/45">{proposal.title}</p>
                <p className="mt-1 truncate pl-5 font-mono text-[10px] text-white/30">{JSON.stringify(proposal.payload).slice(0, 200)}</p>
                <button
                  type="button"
                  onClick={() => void approve(key, proposal.kind, proposal.payload)}
                  disabled={approvingKey === key || running}
                  className="ml-5 mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#14F195]/30 bg-[#14F195]/10 px-3 py-1.5 text-[11px] font-semibold text-[#14F195] transition-colors hover:bg-[#14F195]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {approvingKey === key ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                  {approvingKey === key ? 'Aprovando…' : '✓ Aprovar'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {approved.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">Aprovadas ({approved.length})</p>
          {approved.map((item, index) => (
            <div key={`${item.kind}-${index}`} className="rounded-xl border border-[#9945FF]/20 bg-[#9945FF]/[0.05] px-3 py-2">
              <p className="flex items-center gap-2 text-[12px] font-medium text-[#C084FC]">
                <CheckCircle2 className="size-3.5" />
                {item.kind}
              </p>
              <p className="mt-1 pl-5 text-[11px] text-white/50">{item.detail}</p>
              {item.hash ? <p className="mt-1 truncate pl-5 font-mono text-[10px] text-[#14F195]/70">{item.hash}</p> : null}
              {item.html ? (
                <details className="mt-1 pl-5">
                  <summary className="cursor-pointer text-[10px] text-[#00D4FF]/70">ver HTML ({item.html.length} chars)</summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-black/30 p-2 font-mono text-[10px] leading-4 text-white/50">{item.html.slice(0, 2000)}</pre>
                </details>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {summary && (
        <div className="rounded-2xl border border-[#9945FF]/15 bg-[#9945FF]/[0.05] p-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C084FC]/80">Resumo</p>
          <p className="whitespace-pre-wrap text-sm leading-6 text-white/65">{summary}</p>
        </div>
      )}
    </section>
  );
}
