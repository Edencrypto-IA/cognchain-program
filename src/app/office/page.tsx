'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Zap, Brain, CheckCircle, AlertTriangle, XCircle, TrendingUp, TrendingDown, DollarSign, Users, Activity, Plus } from 'lucide-react';

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

const STATUS_CONFIG = {
  idle:      { dot: 'bg-white/30',      label: 'Aguardando',   glow: 'transparent' },
  thinking:  { dot: 'bg-[#00D1FF]',    label: 'Pensando...',  glow: '#00D1FF' },
  executing: { dot: 'bg-[#14F195]',    label: 'Executando...',glow: '#14F195' },
  warning:   { dot: 'bg-[#F59E0B]',    label: 'Atenção',      glow: '#F59E0B' },
  fired:     { dot: 'bg-[#EF4444]',    label: 'DEMITIDO',     glow: '#EF4444' },
};

function scoreColor(s: number) {
  if (s >= 8) return '#14F195';
  if (s >= 6) return '#9945FF';
  if (s >= 4) return '#F59E0B';
  return '#EF4444';
}

function formatAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
}

// ─── Score Arc ───────────────────────────────────────────────────────────────

function ScoreArc({ score }: { score: number }) {
  const r = 22; const cx = 28; const cy = 28;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score / 10)) * 0.75;
  const dash = pct * circ;
  const color = scoreColor(score);
  return (
    <svg width="56" height="56" className="rotate-[135deg]">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3.5" strokeDasharray={`${circ * 0.75} ${circ}`} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="3.5"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.5s ease', filter: `drop-shadow(0 0 4px ${color}80)` }} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill={color}
        fontSize="11" fontWeight="800" fontFamily="monospace"
        style={{ transform: 'rotate(-135deg)', transformOrigin: `${cx}px ${cy}px` }}>
        {score.toFixed(1)}
      </text>
    </svg>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, isNew }: { agent: AgentState; isNew?: boolean }) {
  const meta = MODEL_META[agent.model] ?? { color: '#888', label: agent.model };
  const sc = STATUS_CONFIG[agent.status];
  const isFired = agent.status === 'fired';
  const isActive = agent.status === 'thinking' || agent.status === 'executing';

  return (
    <div
      className="relative rounded-2xl p-5 transition-all duration-700 overflow-hidden"
      style={{
        background: isFired
          ? 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.03) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
        border: isFired
          ? '1px solid rgba(239,68,68,0.25)'
          : isActive
            ? `1px solid ${meta.color}30`
            : '1px solid rgba(255,255,255,0.07)',
        boxShadow: isFired
          ? '0 0 30px rgba(239,68,68,0.08)'
          : isActive
            ? `0 0 30px ${meta.color}12`
            : '0 4px 20px rgba(0,0,0,0.4)',
        animation: isNew ? 'agent-appear 0.5s ease-out' : isFired ? 'agent-fire 0.6s ease-in-out' : undefined,
        opacity: isFired ? 0.5 : 1,
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {/* Status dot */}
          <div className="relative flex-shrink-0">
            <div className={`w-2 h-2 rounded-full ${sc.dot}`} />
            {isActive && (
              <div className={`absolute inset-0 w-2 h-2 rounded-full ${sc.dot} animate-ping opacity-50`} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-white/90 tracking-wide">{agent.name}</span>
              {isFired && <span className="text-[9px] font-black text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 px-1.5 py-0.5 rounded-full tracking-widest">DEMITIDO</span>}
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: meta.color }}>
              {meta.label}
            </span>
          </div>
        </div>
        <ScoreArc score={agent.score} />
      </div>

      {/* Goal */}
      <p className="text-[11px] text-white/35 mb-3 leading-relaxed line-clamp-1">{agent.goal}</p>

      {/* Current status */}
      <div className="h-8 mb-4 flex items-center">
        {agent.currentTask ? (
          <p className="text-[11px] text-white/60 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse" />
            {agent.currentTask.slice(0, 45)}{agent.currentTask.length > 45 ? '...' : ''}
          </p>
        ) : (
          <p className="text-[11px]" style={{ color: isActive ? sc.dot.replace('bg-', '') : 'rgba(255,255,255,0.25)' }}>
            {sc.label}
          </p>
        )}
      </div>

      {/* Score bar */}
      <div className="mb-4">
        <div className="h-[2px] bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${Math.max(2, agent.score * 10)}%`, background: scoreColor(agent.score), boxShadow: `0 0 6px ${scoreColor(agent.score)}80` }} />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-white/30">
            <Brain className="w-3 h-3" />{agent.memoryCount}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-white/30">
            <CheckCircle className="w-3 h-3" />{agent.tasksDone}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-white/30">
            <DollarSign className="w-3 h-3" />{agent.solSpent.toFixed(3)}
          </span>
        </div>
        {agent.consecutivePoor > 0 && !isFired && (
          <span className="text-[9px] font-bold text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20 px-1.5 py-0.5 rounded-full">
            ⚠ {agent.consecutivePoor}/3
          </span>
        )}
      </div>

      {/* Active glow line at top */}
      {isActive && (
        <div className="absolute top-0 left-6 right-6 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${meta.color}60, transparent)` }} />
      )}
    </div>
  );
}

// ─── Feed Event Row ───────────────────────────────────────────────────────────

function EventRow({ event }: { event: FeedEvent }) {
  const config: Record<string, { icon: JSX.Element; color: string; label: string }> = {
    thinking:     { icon: <Brain className="w-3.5 h-3.5" />,       color: '#00D1FF', label: 'Pensando' },
    task_start:   { icon: <Activity className="w-3.5 h-3.5" />,    color: '#9945FF', label: 'Iniciou' },
    task_done:    { icon: <CheckCircle className="w-3.5 h-3.5" />,  color: '#14F195', label: 'Concluiu' },
    memory_saved: { icon: <Brain className="w-3.5 h-3.5" />,       color: '#9945FF', label: 'Memória' },
    sol_payment:  { icon: <DollarSign className="w-3.5 h-3.5" />,  color: '#F59E0B', label: 'Pagou' },
    agent_fired:  { icon: <XCircle className="w-3.5 h-3.5" />,     color: '#EF4444', label: 'Demitido' },
    agent_hired:  { icon: <Plus className="w-3.5 h-3.5" />,        color: '#14F195', label: 'Contratado' },
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
      case 'agent_hired': return `${event.agent?.name} (${MODEL_META[event.agent?.model ?? '']?.label ?? ''}) contratado`;
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
        </div>
        <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2">{getDesc()}</p>
      </div>
    </div>
  );
}

// ─── Stat Block ───────────────────────────────────────────────────────────────

function StatBlock({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon: JSX.Element }) {
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
  const feedRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const eventCounter = useRef(0);

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

          <div className="flex items-center gap-4">
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
