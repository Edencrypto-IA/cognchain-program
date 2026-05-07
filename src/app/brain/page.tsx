'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ZapIcon, ShieldCheck, Link2, Brain, Filter, ZoomIn, ZoomOut, Sparkles, Shuffle, GitBranch, Loader2, ArrowLeft, Trash2, Send, MessageSquare, Menu, Zap, ChevronRight } from 'lucide-react';

// ─── Agent card types ──────────────────────────────────────────────────────────
interface AgentCard {
  hash: string; model: string; timestamp: number; score: number | null;
  service: string; category: string; solPaid: number;
  snippet: string; fullContent: string;
  tag: 'intelligence' | 'insight' | 'pay' | 'agent';
}

const CAT_COLORS: Record<string, string> = {
  Trade: '#F59E0B', DeFi: '#14F195', 'On-Chain': '#9945FF',
  Pesquisa: '#4285F4', Sentimento: '#00D1FF', Segurança: '#FF6B35',
  Pay: '#F59E0B', Insight: '#9945FF', Agente: '#76B900',
};

const MODEL_LABELS_MAP: Record<string, string> = {
  gpt: 'GPT-4o', claude: 'Claude', nvidia: 'NVIDIA',
  gemini: 'Gemini', deepseek: 'DeepSeek', glm: 'GLM-4.7',
  minimax: 'MiniMax', qwen: 'Qwen3',
};

// ─── Hologram face (mini version for cards) ────────────────────────────────────
function HologramFaceMini({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 145" fill="none" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="60" cy="72" rx="38" ry="44" fill={color} opacity="0.07" />
      <ellipse cx="60" cy="64" rx="44" ry="50" stroke={color} strokeWidth="1.2" opacity="0.85" />
      {[38,48,58,68,78,88,100].map(y => {
        const w = Math.max(8, 42 - Math.abs(y - 64) * 0.35);
        return <line key={y} x1={60 - w} y1={y} x2={60 + w} y2={y} stroke={color} strokeWidth="0.4" opacity="0.2" />;
      })}
      <ellipse cx="43" cy="58" rx="9" ry="6" stroke={color} strokeWidth="1.2" opacity="0.9" />
      <ellipse cx="77" cy="58" rx="9" ry="6" stroke={color} strokeWidth="1.2" opacity="0.9" />
      <circle cx="43" cy="58" r="2.5" fill={color} opacity="0.8" />
      <circle cx="77" cy="58" r="2.5" fill={color} opacity="0.8" />
      <path d="M60 64 L54 78 L60 80 L66 78 Z" stroke={color} strokeWidth="0.9" opacity="0.6" />
      <path d="M46 90 Q60 100 74 90" stroke={color} strokeWidth="1.1" opacity="0.75" />
      <path d="M34 108 Q60 122 86 108" stroke={color} strokeWidth="0.8" opacity="0.45" />
      <circle cx="60" cy="14" r="2" fill={color} opacity="0.6" />
      <circle cx="16" cy="64" r="2" fill={color} opacity="0.6" />
      <circle cx="104" cy="64" r="2" fill={color} opacity="0.6" />
    </svg>
  );
}

// ─── Agent Memory Card ─────────────────────────────────────────────────────────
function AgentMemoryCard({ card, onClick }: { card: AgentCard; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const mk = Object.keys({ gpt: 1, claude: 1, nvidia: 1, gemini: 1, deepseek: 1, glm: 1, minimax: 1, qwen: 1 })
    .find(k => card.model.toLowerCase().includes(k)) ?? 'nvidia';
  const color = ({ gpt: '#10A37F', claude: '#9945FF', nvidia: '#76B900', gemini: '#4285F4', deepseek: '#FF6B35', glm: '#00D1FF', minimax: '#FF6B9D', qwen: '#A855F7' } as Record<string, string>)[mk] ?? '#888';
  const catColor = CAT_COLORS[card.category] ?? color;

  return (
    <div onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        borderColor: hover ? `${color}40` : `${color}18`,
        boxShadow: hover ? `0 0 32px ${color}15, 0 8px 32px rgba(0,0,0,0.5)` : '0 4px 20px rgba(0,0,0,0.4)',
        transform: hover ? 'translateY(-3px)' : 'translateY(0)',
        background: hover ? `linear-gradient(180deg, ${color}08 0%, #0a0a14 100%)` : '#0a0a14',
      }}
      className="rounded-2xl overflow-hidden border cursor-pointer transition-all duration-300">

      {/* Hologram area */}
      <div className="relative flex justify-center pt-5 pb-3" style={{ background: `linear-gradient(180deg, ${color}12, transparent)` }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full blur-3xl opacity-15" style={{ background: color }} />
        <div className="relative w-20 h-24">
          <HologramFaceMini color={color} />
        </div>
        {/* Tag badge */}
        <div className="absolute top-2.5 right-2.5 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
          style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}>
          {card.tag === 'intelligence' ? 'SERVIÇO' : card.tag === 'insight' ? 'INSIGHT' : card.tag === 'pay' ? 'PAY' : 'AGENTE'}
        </div>
      </div>

      {/* Info */}
      <div className="px-3.5 pb-4">
        {/* Model + Category */}
        <div className="flex flex-wrap gap-1 mb-2.5">
          <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
            style={{ background: `${color}18`, color, border: `1px solid ${color}25` }}>
            {MODEL_LABELS_MAP[mk] ?? mk}
          </span>
          {card.category && (
            <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
              style={{ background: `${catColor}12`, color: catColor, border: `1px solid ${catColor}20` }}>
              {card.category}
            </span>
          )}
        </div>

        {/* Service name */}
        <h3 className="text-[12px] font-bold text-white/80 leading-tight mb-2 line-clamp-2">{card.service}</h3>

        {/* SOL paid */}
        {card.solPaid > 0 && (
          <div className="flex items-center gap-1 mb-2">
            <Zap className="w-3 h-3 text-[#F59E0B]" />
            <span className="text-[10px] font-mono font-bold text-[#F59E0B]">{card.solPaid} SOL</span>
          </div>
        )}

        {/* Snippet */}
        <p className="text-[10px] text-white/38 leading-relaxed line-clamp-3 mb-3">{card.snippet}</p>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.04] pt-2.5">
          <span className="font-mono text-[9px] text-white/20">{card.hash.slice(0, 8)}…</span>
          <span className="text-[9px] text-white/20">
            {new Date(card.timestamp * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Agent Detail Modal ────────────────────────────────────────────────────────
function AgentDetailModal({ card, onClose }: { card: AgentCard; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const mk = Object.keys({ gpt:1,claude:1,nvidia:1,gemini:1,deepseek:1,glm:1,minimax:1,qwen:1 })
    .find(k => card.model.toLowerCase().includes(k)) ?? 'nvidia';
  const color = ({ gpt:'#10A37F',claude:'#9945FF',nvidia:'#76B900',gemini:'#4285F4',deepseek:'#FF6B35',glm:'#00D1FF',minimax:'#FF6B9D',qwen:'#A855F7' } as Record<string,string>)[mk] ?? '#888';

  // Body content (skip header lines)
  const bodyLines = card.fullContent.split('\n');
  const bodyStart = card.tag === 'intelligence' || card.tag === 'insight' ? 6 : 2;
  const body = bodyLines.slice(bodyStart).join('\n').trim();

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
      onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ background: '#0b0d14', border: `1px solid ${color}25`, boxShadow: `0 0 60px ${color}15, 0 40px 100px rgba(0,0,0,0.8)` }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-10">
              <HologramFaceMini color={color} />
            </div>
            <div>
              <div className="text-[13px] font-bold text-white/85">{card.service}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                  style={{ background: `${color}18`, color }}>{MODEL_LABELS_MAP[mk] ?? mk}</span>
                {card.category && <span className="text-[9px] text-white/30">{card.category}</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors text-xl">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-3">
            {card.solPaid > 0 && (
              <div className="rounded-xl p-3 bg-[#F59E0B]/08 border border-[#F59E0B]/15 text-center">
                <div className="text-[16px] font-black font-mono text-[#F59E0B]">{card.solPaid}</div>
                <div className="text-[9px] text-white/30 uppercase tracking-widest">SOL pago</div>
              </div>
            )}
            {card.score !== null && (
              <div className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.06] text-center">
                <div className="text-[16px] font-black font-mono text-white/70">{card.score.toFixed(1)}</div>
                <div className="text-[9px] text-white/30 uppercase tracking-widest">Score</div>
              </div>
            )}
            <div className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.06] text-center">
              <div className="text-[11px] font-bold text-white/50">
                {new Date(card.timestamp * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })}
              </div>
              <div className="text-[9px] text-white/30 uppercase tracking-widest">Data</div>
            </div>
          </div>

          {/* Full analysis */}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-2">Análise Completa</div>
            <div className="rounded-xl p-4 bg-white/[0.025] border border-white/[0.05] text-[12px] text-white/70 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
              {body}
            </div>
          </div>

          {/* Hash + proof */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-white/20 w-12">Hash</span>
              <span className="font-mono text-[10px] text-white/40 flex-1 truncate">{card.hash}</span>
              <button onClick={() => { navigator.clipboard?.writeText(card.hash).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),1500); }}
                className="text-white/20 hover:text-white/60 transition-colors">
                {copied ? <ZapIcon className="w-3 h-3 text-[#14F195]" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-[#14F195]/40 w-12">Proof</span>
              <span className="font-mono text-[10px] text-[#14F195]/50 flex-1 truncate">CONGCHAIN://memory/{card.hash.slice(0,16)}…</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const MODEL_COLORS: Record<string, string> = {
  gpt:      '#10A37F',
  claude:   '#9945FF',
  nvidia:   '#76B900',
  gemini:   '#4285F4',
  deepseek: '#FF6B35',
  glm:      '#00D1FF',
  minimax:  '#FF6B9D',
  qwen:     '#A855F7',
};

const MODEL_LABELS: Record<string, string> = {
  gpt:      'GPT-4o',
  claude:   'Claude',
  nvidia:   'NVIDIA',
  gemini:   'Gemini',
  deepseek: 'DeepSeek',
  glm:      'GLM-4.7',
  minimax:  'MiniMax',
  qwen:     'Qwen3',
};

function modelKey(model: string) {
  return Object.keys(MODEL_COLORS).find((k) => model.toLowerCase().includes(k)) ?? 'other';
}
function modelColor(model: string) { return MODEL_COLORS[modelKey(model)] ?? '#888'; }
function modelLabel(model: string) { return MODEL_LABELS[modelKey(model)] ?? model; }

interface GraphNode {
  id: string; label: string; model: string; timestamp: number;
  score: number; verified: boolean; zkVerified: boolean; onChain: boolean; hash: string;
  x: number; y: number; vx: number; vy: number;
}
interface GraphLink { source: string; target: string; type?: string; strength?: number; }
interface RawData { nodes: Omit<GraphNode, 'x'|'y'|'vx'|'vy'>[]; links: GraphLink[]; }

const REPULSION = 18000;
const SPRING_LEN = 200;
const SPRING_K = 0.018;
const DAMPING = 0.72;
const GRAVITY = 0.002;
const NODE_MIN_R = 8;

function getNodeRadius(id: string, links: GraphLink[]): number {
  const degree = links.filter(l => l.source === id || l.target === id).length;
  return Math.max(NODE_MIN_R, NODE_MIN_R + degree * 1.8);
}

function runSimStep(nodes: GraphNode[], links: GraphLink[], iterations = 3) {
  const idxMap = new Map(nodes.map((n, i) => [n.id, i]));
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx -= fx; nodes[i].vy -= fy;
        nodes[j].vx += fx; nodes[j].vy += fy;
      }
    }
    for (const l of links) {
      const si = idxMap.get(l.source); const ti = idxMap.get(l.target);
      if (si == null || ti == null) continue;
      const s = nodes[si]; const t = nodes[ti];
      const dx = t.x - s.x; const dy = t.y - s.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const k = SPRING_K * (l.strength ?? 0.5);
      const targetLen = SPRING_LEN / Math.max(l.strength ?? 0.5, 0.2);
      const force = (dist - targetLen) * k;
      const fx = (dx / dist) * force; const fy = (dy / dist) * force;
      s.vx += fx; s.vy += fy; t.vx -= fx; t.vy -= fy;
    }
    for (const n of nodes) {
      n.vx -= n.x * GRAVITY;
      n.vy -= n.y * GRAVITY;
      n.vx *= DAMPING; n.vy *= DAMPING;
      n.x += n.vx; n.y += n.vy;
    }
  }
}

function dateStr(ts: number) {
  return new Date(ts * 1000).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function BrainPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const animRef = useRef<number>(0);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const draggingRef = useRef<{ nodeId: string | null; offsetX: number; offsetY: number }>({ nodeId: null, offsetX: 0, offsetY: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const mouseDownPosRef = useRef({ x: 0, y: 0 });

  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [continueModel, setContinueModel] = useState('nvidia');
  const [continuing, setContinuing] = useState(false);
  const [continueMsg, setContinueMsg] = useState('');
  const [stats, setStats] = useState({ total: 0, byModel: {} as Record<string, number> });
  const [, setRawData] = useState<RawData>({ nodes: [], links: [] });

  // New command input state
  const [cmdText, setCmdText] = useState('');
  const [cmdModel, setCmdModel] = useState('nvidia');
  const [cmdSending, setCmdSending] = useState(false);
  const [cmdMsg, setCmdMsg] = useState('');

  // Delete state
  const [deleting, setDeleting] = useState(false);
  // Mobile panel toggle
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  // View toggle
  const [view, setView] = useState<'graph' | 'agents'>('graph');
  const [agentCards, setAgentCards] = useState<AgentCard[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<AgentCard | null>(null);

  useEffect(() => {
    if (view !== 'agents') return;
    setAgentLoading(true);
    fetch('/api/memory/cards').then(r => r.json()).then(d => {
      setAgentCards(d.cards ?? []);
      setAgentLoading(false);
    }).catch(() => setAgentLoading(false));
  }, [view]);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    const data: RawData = await fetch('/api/memory/graph').then(r => r.json());
    const byModel: Record<string, number> = {};
    const nodes: GraphNode[] = data.nodes.map((n, i) => {
      const k = modelKey(n.model);
      byModel[k] = (byModel[k] ?? 0) + 1;
      const angle = (i / data.nodes.length) * 2 * Math.PI + (Math.random() - 0.5) * 0.8;
      const radius = 150 + Math.random() * 120;
      return { ...n, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, vx: 0, vy: 0 };
    });
    nodesRef.current = nodes;
    linksRef.current = data.links;
    setRawData(data);
    setStats({ total: nodes.length, byModel });
    setLoading(false);
  }, []);

  useEffect(() => { loadGraph().catch(() => setLoading(false)); }, [loadGraph]);

  const getFilteredIds = useCallback(() => {
    if (filter === 'all') return null;
    return new Set(nodesRef.current.filter(n => n.model.toLowerCase().includes(filter)).map(n => n.id));
  }, [filter]);

  const starsRef = useRef<{x:number;y:number;r:number;o:number}[]>([]);
  if (starsRef.current.length === 0) {
    for (let i = 0; i < 180; i++) {
      starsRef.current.push({
        x: Math.random() * 2000 - 1000,
        y: Math.random() * 2000 - 1000,
        r: Math.random() * 1.2,
        o: 0.1 + Math.random() * 0.5,
      });
    }
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x: tx, y: ty, scale } = transformRef.current;
    const w = canvas.width; const h = canvas.height;

    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(tx + w / 2, ty + h / 2);
    ctx.scale(scale, scale);

    for (const s of starsRef.current) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r / scale, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(255,255,255,${s.o})`;
      ctx.fill();
    }

    const filteredIds = getFilteredIds();
    const nodes = nodesRef.current;
    const links = linksRef.current;
    const idxMap = new Map(nodes.map((n, i) => [n.id, i]));
    const isLargeGraph = nodes.length > 40;

    for (const l of links) {
      const si = idxMap.get(l.source); const ti = idxMap.get(l.target);
      if (si == null || ti == null) continue;
      const s = nodes[si]; const t = nodes[ti];
      if (filteredIds && (!filteredIds.has(s.id) || !filteredIds.has(t.id))) continue;

      const str = l.strength ?? 0.5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.setLineDash([]);

      if (l.type === 'chain') {
        const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
        grad.addColorStop(0, modelColor(s.model) + 'cc');
        grad.addColorStop(1, modelColor(t.model) + 'cc');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2 / scale;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 6;
      } else if (l.type === 'model') {
        ctx.strokeStyle = modelColor(nodes[si].model) + '99';
        ctx.lineWidth = 1.2 / scale;
        ctx.shadowColor = modelColor(nodes[si].model);
        ctx.shadowBlur = 4;
        ctx.setLineDash([5 / scale, 4 / scale]);
      } else if (l.type === 'bridge') {
        ctx.strokeStyle = 'rgba(20,241,149,0.6)';
        ctx.lineWidth = 1 / scale;
        ctx.shadowColor = '#14F195';
        ctx.shadowBlur = 5;
        ctx.setLineDash([3 / scale, 7 / scale]);
      } else {
        ctx.strokeStyle = `rgba(153,69,255,${0.55 * str})`;
        ctx.lineWidth = 0.9 / scale;
        ctx.shadowColor = '#9945FF';
        ctx.shadowBlur = 3;
        ctx.setLineDash([4 / scale, 6 / scale]);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
    }

    for (const n of nodes) {
      if (filteredIds && !filteredIds.has(n.id)) continue;
      const color = modelColor(n.model);
      const r = getNodeRadius(n.id, links);
      const isSelected = selected?.id === n.id;

      // Skip expensive outer glow on large graphs
      if (!isLargeGraph) {
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3);
        glow.addColorStop(0, color + '55');
        glow.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(n.x, n.y, r * 3, 0, 2 * Math.PI);
        ctx.fillStyle = glow; ctx.fill();
      }

      ctx.beginPath(); ctx.arc(n.x, n.y, r * 1.6, 0, 2 * Math.PI);
      ctx.fillStyle = color + (isLargeGraph ? '22' : '33'); ctx.fill();

      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? '#ffffff' : color;
      ctx.shadowColor = color;
      ctx.shadowBlur = isSelected ? 20 : 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (isSelected) {
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 1.5 / scale; ctx.stroke();
      }
      if (n.zkVerified) {
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = '#FFD700cc'; ctx.lineWidth = 1.5 / scale;
        ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 6;
        ctx.stroke(); ctx.shadowBlur = 0;
      }

      const snippet = n.label.slice(0, 24) + (n.label.length > 24 ? '…' : '');
      ctx.font = `${10 / scale}px sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.textAlign = 'center';
      ctx.fillText(snippet, n.x, n.y + r + 14 / scale);
    }
    ctx.restore();
  }, [selected, getFilteredIds]);

  // On-demand redraw (used after simulation stops)
  const rafPendingRef = useRef(false);
  const scheduleRedraw = useCallback(() => {
    if (rafPendingRef.current) return;
    rafPendingRef.current = true;
    animRef.current = requestAnimationFrame(() => {
      rafPendingRef.current = false;
      draw();
    });
  }, [draw]);

  useEffect(() => {
    if (loading || nodesRef.current.length === 0) return;
    let stopped = false;
    let tick = 0;
    const n = nodesRef.current.length;
    // Fewer iterations for large graphs
    const itersPerFrame = n > 50 ? 1 : n > 30 ? 2 : 3;
    // More ticks needed to spread large graphs
    const maxTicks = Math.min(400, 150 + n * 2);

    function frame() {
      if (stopped) return;
      if (tick < maxTicks) {
        runSimStep(nodesRef.current, linksRef.current, itersPerFrame);
        tick++;
        draw();
        animRef.current = requestAnimationFrame(frame);
      } else {
        // Simulation done — check if still moving
        const maxVel = nodesRef.current.reduce((m, nd) => Math.max(m, Math.abs(nd.vx) + Math.abs(nd.vy)), 0);
        if (maxVel > 0.1) {
          runSimStep(nodesRef.current, linksRef.current, 1);
          draw();
          animRef.current = requestAnimationFrame(frame);
        } else {
          // Fully static — stop loop, redraw only on interaction
          draw();
        }
      }
    }
    animRef.current = requestAnimationFrame(frame);
    return () => { stopped = true; cancelAnimationFrame(animRef.current); };
  }, [loading, draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw();
    });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => ro.disconnect();
  }, [draw]);

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const { x: tx, y: ty, scale } = transformRef.current;
    return {
      x: (sx - canvas.width / 2 - tx) / scale,
      y: (sy - canvas.height / 2 - ty) / scale,
    };
  }, []);

  const hitTest = useCallback((wx: number, wy: number) => {
    const filteredIds = getFilteredIds();
    for (const n of nodesRef.current) {
      if (filteredIds && !filteredIds.has(n.id)) continue;
      const r = Math.max(NODE_MIN_R, (n.score ?? 0) * 0.8 + NODE_MIN_R) + 4;
      if ((n.x - wx) ** 2 + (n.y - wy) ** 2 <= r * r) return n;
    }
    return null;
  }, [getFilteredIds]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left; const sy = e.clientY - rect.top;
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    const { x: wx, y: wy } = screenToWorld(sx, sy);
    const hit = hitTest(wx, wy);
    if (hit) {
      draggingRef.current = { nodeId: hit.id, offsetX: wx - hit.x, offsetY: wy - hit.y };
    } else {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, tx: transformRef.current.x, ty: transformRef.current.y };
    }
  }, [screenToWorld, hitTest]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggingRef.current.nodeId) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const { x: wx, y: wy } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const n = nodesRef.current.find(n => n.id === draggingRef.current.nodeId);
      if (n) { n.x = wx - draggingRef.current.offsetX; n.y = wy - draggingRef.current.offsetY; n.vx = 0; n.vy = 0; }
      scheduleRedraw();
    } else if (isPanningRef.current) {
      transformRef.current.x = panStartRef.current.tx + (e.clientX - panStartRef.current.x);
      transformRef.current.y = panStartRef.current.ty + (e.clientY - panStartRef.current.y);
      scheduleRedraw();
    }
  }, [screenToWorld, scheduleRedraw]);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const wasDraggingNode = !!draggingRef.current.nodeId;
    const wasPanning = isPanningRef.current;
    draggingRef.current = { nodeId: null, offsetX: 0, offsetY: 0 };
    isPanningRef.current = false;

    const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
    const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
    if (dx < 5 && dy < 5 && !wasPanning) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const { x: wx, y: wy } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const hit = hitTest(wx, wy);
      setSelected(hit);
      scheduleRedraw();
    } else if (wasDraggingNode) {
      scheduleRedraw();
    }
  }, [screenToWorld, hitTest, scheduleRedraw]);

  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    transformRef.current.scale = Math.min(4, Math.max(0.2, transformRef.current.scale * factor));
    scheduleRedraw();
  }, [scheduleRedraw]);

  const zoom = (dir: 1 | -1) => {
    transformRef.current.scale = Math.min(4, Math.max(0.2, transformRef.current.scale * (dir > 0 ? 1.2 : 0.83)));
    scheduleRedraw();
  };

  const scatter = () => {
    const n = nodesRef.current.length;
    nodesRef.current = nodesRef.current.map((node, i) => {
      const angle = (i / n) * 2 * Math.PI + (Math.random() - 0.5) * 1.2;
      const radius = 180 + Math.random() * 200;
      return { ...node, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40 };
    });
    // Restart simulation briefly after scatter
    let tick = 0;
    const resume = () => {
      if (tick++ < 150) { runSimStep(nodesRef.current, linksRef.current, 2); draw(); animRef.current = requestAnimationFrame(resume); }
      else draw();
    };
    animRef.current = requestAnimationFrame(resume);
  };

  const deleteNode = async (node: GraphNode) => {
    if (!confirm(`Excluir esta memória?\n\n"${node.label}"`) ) return;
    setDeleting(true);
    try {
      await fetch(`/api/memory/${node.hash}`, { method: 'DELETE' });
      nodesRef.current = nodesRef.current.filter(n => n.id !== node.id);
      linksRef.current = linksRef.current.filter(l => l.source !== node.id && l.target !== node.id);
      setStats(s => {
        const k = modelKey(node.model);
        const byModel = { ...s.byModel, [k]: Math.max(0, (s.byModel[k] ?? 1) - 1) };
        return { total: s.total - 1, byModel };
      });
      setSelected(null);
    } catch {
      alert('Erro ao excluir memória');
    } finally {
      setDeleting(false);
    }
  };

  const sendCommand = async () => {
    if (!cmdText.trim() || cmdSending) return;
    setCmdSending(true);
    setCmdMsg('Enviando...');
    try {
      // Save as memory directly
      const res = await fetch('/api/save-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: cmdText.trim(), model: cmdModel }),
      });
      if (!res.ok) throw new Error('Erro ao salvar');
      const saved = await res.json();

      // Add node to graph immediately
      const newNode: GraphNode = {
        id: saved.hash,
        hash: saved.hash,
        label: cmdText.trim().slice(0, 60),
        model: cmdModel,
        timestamp: Math.floor(Date.now() / 1000),
        score: 7,
        verified: false,
        zkVerified: false,
        onChain: false,
        x: (Math.random() - 0.5) * 300,
        y: (Math.random() - 0.5) * 300,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
      };
      nodesRef.current = [...nodesRef.current, newNode];
      setStats(s => {
        const k = modelKey(cmdModel);
        return { total: s.total + 1, byModel: { ...s.byModel, [k]: (s.byModel[k] ?? 0) + 1 } };
      });
      setCmdText('');
      setCmdMsg('✓ Memória salva no grafo');
      setSelected(newNode);
      setTimeout(() => setCmdMsg(''), 3000);
    } catch {
      setCmdMsg('Erro ao salvar');
    } finally {
      setCmdSending(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#060610] text-white overflow-hidden">
      {/* Mobile overlay behind left panel */}
      {mobilePanelOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setMobilePanelOpen(false)} />
      )}

      {/* Left panel — slide-in on mobile */}
      <div className={`
        fixed md:relative inset-y-0 left-0 w-64 flex-shrink-0 flex flex-col
        border-r border-white/[0.06] bg-[#0a0a14]/95 backdrop-blur-xl z-30
        transition-transform duration-300 ease-in-out
        ${mobilePanelOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        {/* Header with back button */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <a href="/" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/50 hover:text-white text-xs transition-all">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Chat</span>
            </a>
            <button
              className="ml-auto md:hidden p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors"
              onClick={() => setMobilePanelOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-5 h-5 text-[#9945FF]" />
            <span className="font-semibold text-white">Memory Brain</span>
          </div>
          <p className="text-xs text-white/40 mb-3">Grafo neural de memórias</p>

          {/* View toggle */}
          <div className="flex gap-1 p-1 bg-white/[0.04] rounded-lg mb-3 border border-white/[0.04]">
            <button
              onClick={() => setView('graph')}
              className="flex-1 text-[11px] font-semibold py-1.5 rounded-md transition-all"
              style={{ background: view === 'graph' ? '#9945FF' : 'transparent', color: view === 'graph' ? '#fff' : 'rgba(255,255,255,0.4)' }}
            >
              Memórias
            </button>
            <button
              onClick={() => setView('agents')}
              className="flex-1 text-[11px] font-semibold py-1.5 rounded-md transition-all"
              style={{ background: view === 'agents' ? '#F59E0B' : 'transparent', color: view === 'agents' ? '#000' : 'rgba(255,255,255,0.4)' }}
            >
              Agentes
            </button>
          </div>
          <button
            onClick={async () => {
              setSeeding(true);
              await fetch('/api/demo/memories', { method: 'POST' });
              await loadGraph();
              setSeeding(false);
            }}
            disabled={seeding}
            className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-[#9945FF]/10 border border-[#9945FF]/20 hover:bg-[#9945FF]/20 text-[#9945FF] text-xs font-medium transition-all disabled:opacity-40"
          >
            {seeding
              ? <><span className="w-3 h-3 border border-[#9945FF] border-t-transparent rounded-full animate-spin" />Criando...</>
              : <><Sparkles className="w-3.5 h-3.5" />Seed Memórias Demo</>}
          </button>
        </div>

        {/* Stats */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="text-3xl font-bold text-white mb-0.5">{stats.total}</div>
          <div className="text-xs text-white/40 mb-3">memórias totais</div>
          <div className="flex flex-col gap-1.5">
            {Object.entries(MODEL_COLORS).map(([key, color]) => {
              const count = stats.byModel[key] ?? 0;
              if (!count) return null;
              return (
                <div key={key} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                    <span className="text-white/60">{MODEL_LABELS[key]}</span>
                  </div>
                  <span className="text-white/80 font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* New Command Input */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-1.5 mb-2 text-xs text-white/50">
            <MessageSquare className="w-3.5 h-3.5 text-[#14F195]" />
            <span className="font-semibold text-[#14F195]">Nova Memória</span>
          </div>
          <textarea
            value={cmdText}
            onChange={e => setCmdText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCommand(); } }}
            placeholder="Digite um conhecimento para salvar no grafo..."
            rows={3}
            className="w-full px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] focus:border-[#14F195]/40 text-xs text-white/80 placeholder-white/25 outline-none resize-none transition-colors mb-2"
          />
          <div className="flex gap-1.5">
            <select
              value={cmdModel}
              onChange={e => setCmdModel(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-white/60 outline-none"
            >
              <option value="nvidia">NVIDIA</option>
              <option value="glm">GLM-4.7</option>
              <option value="minimax">MiniMax</option>
              <option value="qwen">Qwen3</option>
              <option value="gpt">GPT-4o</option>
              <option value="claude">Claude</option>
            </select>
            <button
              onClick={sendCommand}
              disabled={cmdSending || !cmdText.trim()}
              className="px-3 py-1.5 rounded-lg bg-[#14F195]/10 border border-[#14F195]/20 hover:bg-[#14F195]/20 text-[#14F195] transition-all disabled:opacity-40 flex items-center gap-1"
            >
              {cmdSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
          {cmdMsg && <p className="text-[10px] text-[#14F195]/70 mt-1.5">{cmdMsg}</p>}
        </div>

        {/* Filter */}
        <div className="p-4 border-b border-white/[0.06] overflow-y-auto">
          <div className="flex items-center gap-1.5 mb-2 text-xs text-white/40">
            <Filter className="w-3.5 h-3.5" /><span>Filtrar por modelo</span>
          </div>
          <div className="flex flex-col gap-1">
            {[{ key: 'all', label: 'Todos', color: '#ffffff' }, ...Object.entries(MODEL_COLORS).map(([k, c]) => ({ key: k, label: MODEL_LABELS[k], color: c }))].map(({ key, label, color }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all ${filter === key ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'}`}>
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />{label}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="p-4 mt-auto">
          <div className="text-xs text-white/25 space-y-1.5">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full border border-yellow-400/50" /><span>ZK verificado</span></div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-white/10 ring-1 ring-white/20" /><span>On-chain</span></div>
            <div className="flex items-center gap-2 mt-1 text-white/20"><span>Clique</span><span className="text-white/30">= ver detalhes</span></div>
          </div>
        </div>
      </div>

      {/* Agent Cards View */}
      {view === 'agents' && (
        <div className="flex-1 overflow-y-auto bg-[#060610]">
          {/* Mobile: open panel button */}
          <button className="fixed top-3 left-3 z-40 md:hidden w-9 h-9 rounded-xl bg-[#0a0a14]/90 border border-white/[0.08] flex items-center justify-center text-white/60 backdrop-blur-xl shadow-lg"
            onClick={() => setMobilePanelOpen(true)}>
            <Menu className="w-4 h-4" />
          </button>

          <div className="max-w-5xl mx-auto px-5 py-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F59E0B]/70 mb-1">Decisões dos Agentes</div>
                <div className="text-[12px] text-white/35">{agentCards.length} registros — insights, serviços comprados e atividade</div>
              </div>
            </div>

            {agentLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-7 h-7 border-2 border-[#F59E0B]/40 border-t-[#F59E0B] rounded-full animate-spin" />
                <span className="text-[11px] text-white/25">Carregando memórias dos agentes...</span>
              </div>
            ) : agentCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Brain className="w-10 h-10 text-white/10" />
                <p className="text-[12px] text-white/30">Nenhuma memória de agente ainda.</p>
                <p className="text-[11px] text-white/20">Abra o Office, inicie os agentes ou compre um serviço em /pay.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {agentCards.map(card => (
                  <AgentMemoryCard key={card.hash} card={card} onClick={() => setSelectedCard(card)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Canvas — Graph View */}
      {view === 'graph' && <div className="flex-1 relative">
        {/* Mobile: floating button to open left panel */}
        <button
          className="fixed top-3 left-3 z-40 md:hidden w-9 h-9 rounded-xl bg-[#0a0a14]/90 border border-white/[0.08] flex items-center justify-center text-white/60 backdrop-blur-xl shadow-lg"
          onClick={() => setMobilePanelOpen(true)}
        >
          <Menu className="w-4 h-4" />
        </button>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#9945FF] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-white/40">Carregando memórias...</span>
            </div>
          </div>
        )}
        {!loading && stats.total === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center">
              <Brain className="w-12 h-12 text-white/10 mx-auto mb-3" />
              <p className="text-white/40 text-sm">Nenhuma memória salva ainda.</p>
              <p className="text-white/20 text-xs mt-1">Use o campo ao lado para criar a primeira.</p>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onWheel={onWheel}
        />
        {/* Zoom + Scatter controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1">
          <button onClick={() => zoom(1)} className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/[0.08] flex items-center justify-center text-white/60 hover:text-white transition-all">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => zoom(-1)} className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/[0.08] flex items-center justify-center text-white/60 hover:text-white transition-all">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={scatter} title="Espalhar nós" className="w-8 h-8 rounded-lg bg-[#9945FF]/10 hover:bg-[#9945FF]/20 border border-[#9945FF]/20 flex items-center justify-center text-[#9945FF]/60 hover:text-[#9945FF] transition-all">
            <Shuffle className="w-4 h-4" />
          </button>
        </div>
      </div>}

      {/* Agent detail modal */}
      {selectedCard && <AgentDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />}

      {/* Detail panel — full-screen on mobile, sidebar on desktop */}
      {selected && (
        <div className="fixed inset-0 md:relative md:inset-auto md:w-72 md:flex-shrink-0 border-l border-white/[0.06] bg-[#0a0a14]/90 backdrop-blur-xl flex flex-col z-50 md:z-10 overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
            <span className="text-sm font-semibold text-white">Memória Selecionada</span>
            <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold text-black" style={{ background: modelColor(selected.model) }}>
                {modelLabel(selected.model)}
              </span>
              {selected.onChain && <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[#9945FF]/20 text-[#9945FF] border border-[#9945FF]/30"><Link2 className="w-3 h-3" /> On-Chain</span>}
              {selected.zkVerified && <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"><ZapIcon className="w-3 h-3" /> ZK</span>}
              {selected.verified && <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-500/10 text-green-400 border border-green-500/20"><ShieldCheck className="w-3 h-3" /> PoI</span>}
            </div>
            <div>
              <div className="text-xs text-white/30 mb-1">Hash</div>
              <div className="font-mono text-xs text-white/70 bg-white/[0.04] rounded-lg p-2 break-all select-all">{selected.hash}</div>
            </div>
            <div>
              <div className="text-xs text-white/30 mb-1">Conteúdo</div>
              <div className="text-sm text-white/80 bg-white/[0.04] rounded-lg p-3 leading-relaxed max-h-48 overflow-y-auto">{selected.label}</div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Score</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 bg-white/[0.08] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195]" style={{ width: `${Math.min(100, (selected.score / 10) * 100)}%` }} />
                </div>
                <span className="text-xs font-medium text-white/70">{selected.score.toFixed(1)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Data</span>
              <span className="text-xs text-white/60">{dateStr(selected.timestamp)}</span>
            </div>

            {/* Continue Memory */}
            <div className="border border-white/[0.06] rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <GitBranch className="w-3.5 h-3.5 text-[#14F195]" />
                <span className="text-xs font-semibold text-white/70">Continuar com IA</span>
              </div>
              <select
                value={continueModel}
                onChange={e => setContinueModel(e.target.value)}
                className="w-full mb-2 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-white/60 outline-none"
              >
                <option value="nvidia">NVIDIA Llama (grátis)</option>
                <option value="glm">GLM-4.7 (grátis)</option>
                <option value="minimax">MiniMax M2.7 (grátis)</option>
                <option value="qwen">Qwen3 80B (grátis)</option>
              </select>
              <button
                disabled={continuing}
                onClick={async () => {
                  setContinuing(true);
                  setContinueMsg('Gerando...');
                  try {
                    const r = await fetch('/api/memory/continue', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ hash: selected.hash, model: continueModel }),
                    });
                    if (!r.ok) throw new Error('Falhou');
                    const newMem = await r.json();
                    const newNode: GraphNode = {
                      ...newMem,
                      id: newMem.hash,
                      label: newMem.content.slice(0, 60),
                      score: newMem.score ?? 7,
                      verified: false, zkVerified: false, onChain: false,
                      x: (selected.x ?? 0) + (Math.random() - 0.5) * 150,
                      y: (selected.y ?? 0) + (Math.random() - 0.5) * 150,
                      vx: (Math.random() - 0.5) * 15,
                      vy: (Math.random() - 0.5) * 15,
                    };
                    nodesRef.current = [...nodesRef.current, newNode];
                    linksRef.current = [...linksRef.current, { source: selected.hash, target: newMem.hash, type: 'chain', strength: 1.0 }];
                    setStats(s => ({ ...s, total: s.total + 1 }));
                    setContinueMsg(`✓ ${continueModel.toUpperCase()} — novo nó no grafo`);
                    setSelected(newNode);
                  } catch {
                    setContinueMsg('Erro ao gerar');
                  } finally {
                    setContinuing(false);
                  }
                }}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-[#14F195]/20 to-[#9945FF]/20 border border-[#14F195]/30 hover:border-[#14F195]/60 text-xs font-semibold text-white/70 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {continuing
                  ? <><Loader2 className="w-3 h-3 animate-spin" />Gerando...</>
                  : <><GitBranch className="w-3 h-3" />Continuar memória</>}
              </button>
              {continueMsg && <p className="text-[10px] text-[#14F195]/70 mt-1.5 text-center">{continueMsg}</p>}
            </div>

            <a href={`/memory/${selected.hash}`}
              className="w-full py-2 rounded-xl text-center text-sm font-medium bg-gradient-to-r from-[#9945FF]/20 to-[#14F195]/10 border border-[#9945FF]/30 hover:border-[#9945FF]/60 text-white/70 hover:text-white transition-all block">
              Ver memória completa →
            </a>

            {/* Delete button */}
            <button
              onClick={() => deleteNode(selected)}
              disabled={deleting}
              className="w-full py-2 rounded-xl text-center text-xs font-medium bg-red-500/5 border border-red-500/20 hover:bg-red-500/15 hover:border-red-500/40 text-red-400/60 hover:text-red-400 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Excluir esta memória
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
