'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap, Brain, CheckCircle, XCircle, TrendingUp, TrendingDown, DollarSign, Users, Activity, Plus, Play, Loader2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentState {
  id: string; name: string; model: string; goal: string;
  score: number; status: 'idle' | 'thinking' | 'executing' | 'warning' | 'fired';
  currentTask?: string; memoryCount: number; solSpent: number;
  tasksDone: number; consecutivePoor: number; firedAt?: number;
}

interface FeedEvent {
  id: string; ts: number; type: string;
  agentId?: string; name?: string; model?: string;
  text?: string; task?: string; reward?: number;
  success?: boolean; duration?: number;
  oldScore?: number; newScore?: number;
  snippet?: string; hash?: string; scoreGain?: number;
  fromName?: string; toName?: string; amount?: number;
  finalScore?: number; reason?: string;
  agent?: AgentState;
}

interface GlobalStats {
  activeAgents: number; solSpent: number; memories: number; tasks: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MODEL_META: Record<string, { color: string; label: string }> = {
  gpt:      { color: '#10A37F', label: 'GPT-4o' },
  claude:   { color: '#9945FF', label: 'Claude' },
  nvidia:   { color: '#76B900', label: 'NVIDIA' },
  gemini:   { color: '#4285F4', label: 'Gemini' },
  deepseek: { color: '#FF6B35', label: 'DeepSeek' },
  glm:      { color: '#00D1FF', label: 'GLM-4.7' },
  minimax:  { color: '#FF6B9D', label: 'MiniMax' },
  qwen:     { color: '#A855F7', label: 'Qwen3' },
};

function formatAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
}

// ─── Hologram Face SVG ───────────────────────────────────────────────────────

function HologramFace({ color, isActive, isFired }: { color: string; isActive: boolean; isFired: boolean }) {
  const c = isFired ? '#EF4444' : color;
  const op = isFired ? 0.4 : 1;
  return (
    <svg viewBox="0 0 120 145" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: op }}>
      {/* Glow blob behind */}
      <ellipse cx="60" cy="72" rx="38" ry="44" fill={c} opacity="0.08" />
      {/* Head outline */}
      <ellipse cx="60" cy="64" rx="44" ry="50" stroke={c} strokeWidth="1.2" opacity="0.9" />
      {/* Horizontal scan lines */}
      {[38,48,58,68,78,88,98,108].map((y, i) => {
        const w = Math.min(40, 10 + Math.abs(y - 64) * 0.4);
        return <line key={y} x1={60 - w} y1={y} x2={60 + w} y2={y} stroke={c} strokeWidth="0.4" opacity={0.25 - i * 0.015} />;
      })}
      {/* Eyes */}
      <ellipse cx="43" cy="58" rx="9" ry="6" stroke={c} strokeWidth="1.2" opacity="0.9" />
      <ellipse cx="77" cy="58" rx="9" ry="6" stroke={c} strokeWidth="1.2" opacity="0.9" />
      <circle cx="43" cy="58" r="2.5" fill={c} opacity="0.85" />
      <circle cx="77" cy="58" r="2.5" fill={c} opacity="0.85" />
      {/* Nose */}
      <path d="M60 64 L54 78 L60 80 L66 78 Z" stroke={c} strokeWidth="0.9" opacity="0.65" />
      {/* Mouth */}
      <path d="M46 90 Q60 100 74 90" stroke={c} strokeWidth="1.1" opacity="0.8" />
      {/* Chin */}
      <path d="M34 108 Q60 124 86 108" stroke={c} strokeWidth="0.8" opacity="0.5" />
      {/* Neck lines */}
      <line x1="52" y1="113" x2="46" y2="138" stroke={c} strokeWidth="0.7" opacity="0.4" />
      <line x1="68" y1="113" x2="74" y2="138" stroke={c} strokeWidth="0.7" opacity="0.4" />
      {/* Node dots */}
      <circle cx="60" cy="14" r="2.5" fill={c} opacity="0.7" />
      <circle cx="16" cy="64" r="2.5" fill={c} opacity="0.7" />
      <circle cx="104" cy="64" r="2.5" fill={c} opacity="0.7" />
      <circle cx="60" cy="141" r="2.5" fill={c} opacity="0.7" />
      {/* Connection lines to nodes */}
      <line x1="60" y1="14" x2="60" y2="14" stroke={c} strokeWidth="0.5" opacity="0.3" />
      <line x1="16" y1="64" x2="16" y2="64" stroke={c} strokeWidth="0.5" opacity="0.3" />
      {/* Animated scan line */}
      {isActive && (
        <line x1="16" y1="64" x2="104" y2="64" stroke={c} strokeWidth="1" opacity="0.4"
          style={{ animation: 'scan-v 2s ease-in-out infinite' }} />
      )}
    </svg>
  );
}

// ─── Agent Card — Premium Design ─────────────────────────────────────────────

function AgentCard({ agent, isNew }: { agent: AgentState; isNew?: boolean }) {
  const meta = MODEL_META[agent.model] ?? { color: '#888', label: agent.model };
  const isFired = agent.status === 'fired';
  const isActive = agent.status === 'thinking' || agent.status === 'executing';
  const color = isFired ? '#EF4444' : meta.color;
  const prevScore = useRef(agent.score);
  const delta = agent.score - prevScore.current;
  useEffect(() => { prevScore.current = agent.score; }, [agent.score]);

  const statusLabel = isFired ? 'DEMITIDO'
    : agent.status === 'thinking' ? 'PENSANDO'
    : agent.status === 'executing' ? 'EXECUTANDO'
    : agent.status === 'warning' ? 'ATENÇÃO'
    : 'ATIVO';

  const description = agent.currentTask ?? agent.goal;

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 24, scale: 0.95 } : false}
      animate={isActive ? { scale: [1, 1.008, 1] } : { scale: 1, opacity: isFired ? 0.6 : 1 }}
      transition={isActive ? { duration: 3.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.5 }}
      whileHover={{ y: -5, scale: 1.015 }}
      className="relative overflow-hidden rounded-[28px] p-6 cursor-default"
      style={{
        background: '#050505',
        border: `1px solid ${color}25`,
        boxShadow: `0 0 40px ${color}18, 0 8px 32px rgba(0,0,0,0.6)`,
      }}
    >
      {/* Background glow blob */}
      <div className="absolute inset-0 opacity-[0.07] blur-3xl rounded-full"
        style={{ background: color, transform: 'scale(0.8)' }} />

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg,rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-1">
          <div className="flex items-center gap-2.5 mb-1">
            <motion.div className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: color }}
              animate={isActive ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
              transition={{ duration: 1.2, repeat: Infinity }} />
            <span className="text-[22px] font-black tracking-wide text-white/90 leading-none">
              {agent.name.toUpperCase()}-{agent.model.toUpperCase().slice(0, 3)}
            </span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color }}>
            {statusLabel}
          </span>
        </div>

        {/* Hologram face */}
        <div className="relative flex justify-center my-5">
          <div className="absolute w-36 h-36 rounded-full blur-3xl opacity-15" style={{ background: color }} />
          <div className="relative w-36">
            <HologramFace color={color} isActive={isActive} isFired={isFired} />
          </div>
        </div>

        {/* Description */}
        <p className="text-[14px] leading-relaxed text-zinc-400 mb-6 line-clamp-2 min-h-[42px]">
          {description}
        </p>

        {/* Score */}
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-2">Score</p>
          <div className="flex items-end justify-between">
            <div className="flex items-end gap-2">
              <motion.span className="text-[52px] font-black leading-none"
                key={Math.floor(agent.score * 10)}
                initial={{ opacity: 0.5, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                {agent.score.toFixed(1)}
              </motion.span>
              <span className="mb-2 text-[20px] text-zinc-600">/10</span>
            </div>
            <div className={`flex items-center gap-1 text-[18px] font-bold ${delta >= 0 ? 'text-lime-400' : 'text-red-400'}`}>
              {delta >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              <span>{Math.abs(delta).toFixed(1)}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-[5px] rounded-full overflow-hidden bg-zinc-900">
            <motion.div className="h-full rounded-full"
              style={{ background: color, boxShadow: `0 0 8px ${color}` }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(2, agent.score * 10)}%` }}
              transition={{ duration: 1, ease: 'easeOut' }} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t pt-4" style={{ borderColor: `${color}18` }}>
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">Last Action</p>
            <p className="mt-1 text-[12px] text-zinc-400 flex items-center gap-2">
              <Brain className="w-3 h-3" />{agent.tasksDone} tarefas
              <span className="text-zinc-700">·</span>
              <DollarSign className="w-3 h-3" />{agent.solSpent.toFixed(3)} SOL
            </p>
          </div>
          {isFired ? (
            <button className="rounded-2xl border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] transition hover:opacity-80"
              style={{ borderColor: `${color}30`, background: `${color}15`, color }}>
              View Report
            </button>
          ) : agent.consecutivePoor > 0 ? (
            <span className="text-[10px] font-bold px-2.5 py-1.5 rounded-full border"
              style={{ color: '#F59E0B', background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.2)' }}>
              ⚠ {agent.consecutivePoor}/3 falhas
            </span>
          ) : null}
        </div>
      </div>

      {/* Active glow line at top */}
      {isActive && (
        <div className="absolute top-0 left-6 right-6 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />
      )}
    </motion.div>
  );
}

// ─── Feed Event Row ───────────────────────────────────────────────────────────

function EventRow({ event }: { event: FeedEvent }) {
  const config: Record<string, { icon: React.ReactElement; color: string; label: string }> = {
    thinking:       { icon: <Brain className="w-3.5 h-3.5" />,       color: '#00D1FF', label: 'Pensando'    },
    task_start:     { icon: <Activity className="w-3.5 h-3.5" />,    color: '#9945FF', label: 'Iniciou'     },
    task_done:      { icon: <CheckCircle className="w-3.5 h-3.5" />, color: '#14F195', label: 'Concluiu'    },
    memory_saved:   { icon: <Brain className="w-3.5 h-3.5" />,       color: '#9945FF', label: 'Memória'     },
    sol_payment:    { icon: <DollarSign className="w-3.5 h-3.5" />,  color: '#F59E0B', label: 'Pagou'       },
    agent_fired:    { icon: <XCircle className="w-3.5 h-3.5" />,     color: '#EF4444', label: 'Demitido'    },
    agent_hired:    { icon: <Plus className="w-3.5 h-3.5" />,        color: '#14F195', label: 'Contratado'  },
    real_task_done: { icon: <Zap className="w-3.5 h-3.5" />,         color: '#F59E0B', label: 'IA Real'     },
  };

  const c = config[event.type] ?? { icon: <Activity className="w-3.5 h-3.5" />, color: '#64748b', label: '' };
  const meta = event.model ? (MODEL_META[event.model] ?? { color: '#888' }) : { color: '#888' };

  function getDesc() {
    switch (event.type) {
      case 'thinking':    return event.text ?? '';
      case 'task_start':  return `${event.task?.slice(0, 40) ?? ''} · +${event.reward} SOL`;
      case 'task_done':   return event.success ? `✓ ${event.task?.slice(0, 35) ?? ''} (${event.duration}ms)` : `✗ ${event.task?.slice(0, 35) ?? ''} — falhou`;
      case 'memory_saved':return `#${event.hash} — ${event.snippet?.slice(0, 35) ?? ''}`;
      case 'sol_payment': return `${event.fromName} → ${event.toName} · ${event.amount} SOL`;
      case 'agent_fired': return `Score ${event.finalScore} · ${event.reason}`;
      case 'agent_hired':    return `${event.agent?.name} (${MODEL_META[event.agent?.model ?? '']?.label ?? ''}) contratado`;
      case 'real_task_done': return `${(event as {task?:string;result?:string}).task ?? ''} — ${(event as {result?:string}).result?.slice(0, 60) ?? ''}`;
      default: return '';
    }
  }

  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-white/[0.04] group"
      style={{ animation: 'event-slide 0.3s ease-out' }}>
      <div className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center"
        style={{ background: `${c.color}15`, color: c.color }}>
        {c.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {event.name && (
            <span className="text-[10px] font-bold" style={{ color: meta.color }}>{event.name}</span>
          )}
          <span className="text-[9px] text-white/20">{formatAgo(event.ts)}</span>
          {event.type === 'task_done' && event.newScore !== undefined && event.oldScore !== undefined && (
            <span className={`text-[9px] font-bold flex items-center gap-0.5 ${event.newScore > event.oldScore ? 'text-[#14F195]' : 'text-[#EF4444]'}`}>
              {event.newScore > event.oldScore ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              {event.newScore.toFixed(1)}
            </span>
          )}
          {(event as {isReal?: boolean}).isReal && (
            <span className="text-[8px] font-black text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/25 px-1.5 py-0.5 rounded-full tracking-widest">REAL</span>
          )}
        </div>
        <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2">{getDesc()}</p>
      </div>
    </div>
  );
}

// ─── Stat Block ───────────────────────────────────────────────────────────────

function StatBlock({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon: React.ReactElement }) {
  return (
    <div className="flex-1 px-6 py-5 border-r border-white/[0.05] last:border-r-0">
      <div className="flex items-center gap-2 mb-2">
        <div style={{ color }}>{icon}</div>
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25">{label}</span>
      </div>
      <div className="text-[28px] font-black font-mono text-white/90 leading-none mb-1"
        style={{ textShadow: `0 0 20px ${color}40` }}>{value}</div>
      {sub && <div className="text-[10px] text-white/25">{sub}</div>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OfficePage() {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [stats, setStats] = useState<GlobalStats>({ activeAgents: 0, solSpent: 0, memories: 0, tasks: 0 });
  const [newAgentIds, setNewAgentIds] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const [time, setTime] = useState('');
  const [running, setRunning] = useState(false);
  const [schedulerOn, setSchedulerOn] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const eventCounter = useRef(0);

  // Check scheduler state on mount
  useEffect(() => {
    fetch('/api/office/scheduler').then(r => r.json()).then(d => setSchedulerOn(d.active)).catch(() => {});
  }, []);

  // Stop scheduler when leaving the page
  useEffect(() => {
    return () => {
      fetch('/api/office/scheduler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) }).catch(() => {});
    };
  }, []);

  const toggleScheduler = useCallback(async () => {
    const action = schedulerOn ? 'stop' : 'start';
    try {
      const r = await fetch('/api/office/scheduler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const d = await r.json();
      setSchedulerOn(d.active);
    } catch { /* silent */ }
  }, [schedulerOn]);

  const triggerRealTask = useCallback(async () => {
    if (running) return;
    setRunning(true);
    try {
      await fetch('/api/office/run-task', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    } catch { /* silent */ }
    setTimeout(() => setRunning(false), 8000);
  }, [running]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const addEvent = useCallback((ev: Omit<FeedEvent, 'id'>) => {
    const e: FeedEvent = { ...ev, id: String(eventCounter.current++) };
    setFeed(prev => [e, ...prev].slice(0, 80));
  }, []);

  // SSE connection
  useEffect(() => {
    const es = new EventSource('/api/office/stream');
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === 'init') {
          setAgents(data.agents);
          setStats(data.stats);
          return;
        }

        if (data.type === 'stats') {
          setStats({ activeAgents: data.activeAgents, solSpent: data.solSpent, memories: data.memories, tasks: data.tasks });
          return;
        }

        if (data.type === 'thinking') {
          setAgents(prev => prev.map(a => a.id === data.agentId ? { ...a, status: 'thinking', currentTask: undefined } : a));
          addEvent(data);
          return;
        }

        if (data.type === 'task_start') {
          setAgents(prev => prev.map(a => a.id === data.agentId ? { ...a, status: 'executing', currentTask: data.task } : a));
          addEvent(data);
          return;
        }

        if (data.type === 'task_done') {
          setAgents(prev => prev.map(a => a.id === data.agentId
            ? { ...a, status: a.score < 4.5 ? 'warning' : 'idle', currentTask: undefined, score: data.newScore, tasksDone: a.tasksDone + 1, solSpent: a.solSpent + (data.reward ?? 0), consecutivePoor: data.success ? 0 : a.consecutivePoor + 1 }
            : a));
          addEvent(data);
          return;
        }

        if (data.type === 'memory_saved') {
          setAgents(prev => prev.map(a => a.id === data.agentId
            ? { ...a, memoryCount: a.memoryCount + 1, score: Math.min(10, a.score + (data.scoreGain ?? 0.1)) }
            : a));
          addEvent(data);
          return;
        }

        if (data.type === 'sol_payment') {
          addEvent(data);
          return;
        }

        if (data.type === 'agent_fired') {
          setAgents(prev => prev.map(a => a.id === data.agentId ? { ...a, status: 'fired', firedAt: data.ts } : a));
          addEvent(data);
          return;
        }

        if (data.type === 'agent_hired') {
          setAgents(prev => [...prev, data.agent]);
          setNewAgentIds(prev => new Set([...prev, data.agent.id]));
          setTimeout(() => setNewAgentIds(prev => { const n = new Set(prev); n.delete(data.agent.id); return n; }), 1000);
          addEvent(data);
          return;
        }
      } catch { /* ignore */ }
    };

    return () => { es.close(); esRef.current = null; setConnected(false); };
  }, [addEvent]);

  const activeAgents = agents.filter(a => a.status !== 'fired');
  const firedAgents = agents.filter(a => a.status === 'fired');

  return (
    <>
      <style>{`
        @keyframes event-slide {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes scan-v {
          0%,100% { transform: translateY(-24px); opacity: 0; }
          30%,70% { opacity: 0.5; }
          50%      { transform: translateY(24px); opacity: 0.4; }
        }
        @keyframes agent-appear {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes agent-fire {
          0%  { transform: translateX(0); }
          20% { transform: translateX(-3px); }
          40% { transform: translateX(3px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
          100%{ transform: translateX(0); }
        }
        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .live-dot { animation: live-pulse 1.5s ease-in-out infinite; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
      `}</style>

      <div className="flex flex-col h-screen bg-[#000000] text-white overflow-hidden"
        style={{
          backgroundImage: 'linear-gradient(rgba(153,69,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(153,69,255,0.025) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}>

        {/* ── Header ── */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] bg-black/60 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-1.5 text-white/30 hover:text-white/70 transition-colors text-xs">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chat</span>
            </a>
            <div className="w-px h-4 bg-white/[0.08]" />
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center shadow-lg shadow-[#9945FF]/30">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1L12.5 4V10L7 13L1.5 10V4L7 1Z" fill="white" fillOpacity="0.9"/>
                </svg>
              </div>
              <div>
                <div className="text-[13px] font-black tracking-[0.1em] bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">CONGCHAIN</div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.25em] text-white/25">Agent Office</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Scheduler Play/Pause — main control */}
            <button
              onClick={toggleScheduler}
              disabled={!connected}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all disabled:opacity-40"
              style={{
                background: schedulerOn ? 'rgba(20,241,149,0.12)' : 'rgba(153,69,255,0.12)',
                border: schedulerOn ? '1px solid rgba(20,241,149,0.35)' : '1px solid rgba(153,69,255,0.35)',
                color: schedulerOn ? '#14F195' : '#9945FF',
              }}
            >
              {schedulerOn
                ? <><span className="w-2 h-2 rounded-full bg-[#14F195] animate-pulse" />Pausar Agentes</>
                : <><Play className="w-3 h-3" />Iniciar Agentes</>}
            </button>
            {/* One-shot manual trigger */}
            <button
              onClick={triggerRealTask}
              disabled={running || !connected}
              title="Executar uma tarefa real agora"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-30"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B' }}
            >
              {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            </button>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[#14F195] live-dot' : 'bg-[#EF4444]'}`} />
              <span className={`text-[10px] font-semibold ${connected ? 'text-[#14F195]/80' : 'text-[#EF4444]/80'}`}>
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            <span className="text-[11px] font-mono text-white/30 tabular-nums">{time}</span>
          </div>
        </header>

        {/* ── Stats Bar ── */}
        <div className="flex border-b border-white/[0.05] bg-black/40 flex-shrink-0">
          <StatBlock label="Agentes Ativos" value={String(stats.activeAgents || activeAgents.length)} sub={`${firedAgents.length} demitidos`} color="#14F195" icon={<Users className="w-3.5 h-3.5" />} />
          <StatBlock label="SOL Gasto" value={stats.solSpent.toFixed(3)} sub="lifetime" color="#F59E0B" icon={<DollarSign className="w-3.5 h-3.5" />} />
          <StatBlock label="Memórias" value={String(stats.memories)} sub="total geradas" color="#9945FF" icon={<Brain className="w-3.5 h-3.5" />} />
          <StatBlock label="Tarefas" value={String(stats.tasks)} sub="completadas" color="#00D1FF" icon={<Zap className="w-3.5 h-3.5" />} />
        </div>

        {/* ── Main Content ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Agent Grid ── */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {/* Active agents */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Agentes</span>
              <div className="flex-1 h-px bg-white/[0.04]" />
              <span className="text-[10px] font-mono text-white/20">{activeAgents.length} ativos</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
              {activeAgents.map(agent => (
                <AgentCard key={agent.id} agent={agent} isNew={newAgentIds.has(agent.id)} />
              ))}
            </div>

            {/* Fired agents */}
            {firedAgents.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#EF4444]/40">Demitidos</span>
                  <div className="flex-1 h-px bg-[#EF4444]/10" />
                  <span className="text-[10px] font-mono text-[#EF4444]/20">{firedAgents.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {firedAgents.map(agent => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Live Feed ── */}
          <div className="w-80 xl:w-96 flex-shrink-0 border-l border-white/[0.05] flex flex-col bg-black/20">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] flex-shrink-0">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-white/30" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Feed ao Vivo</span>
              </div>
              <span className="text-[9px] font-mono text-white/15">{feed.length} eventos</span>
            </div>

            <div ref={feedRef} className="flex-1 overflow-y-auto px-4 py-2">
              {feed.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-6 h-6 border-2 border-white/10 border-t-[#9945FF]/40 rounded-full animate-spin" />
                  <span className="text-[10px] text-white/20">Conectando agentes...</span>
                </div>
              ) : (
                feed.map(ev => <EventRow key={ev.id} event={ev} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
