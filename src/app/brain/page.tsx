'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ZapIcon, ShieldCheck, Link2, Brain, Filter, ZoomIn, ZoomOut } from 'lucide-react';

const MODEL_COLORS: Record<string, string> = {
  gpt:      '#10A37F',
  claude:   '#9945FF',
  nvidia:   '#76B900',
  gemini:   '#4285F4',
  deepseek: '#FF6B35',
};

const MODEL_LABELS: Record<string, string> = {
  gpt:      'GPT-4o',
  claude:   'Claude',
  nvidia:   'NVIDIA',
  gemini:   'Gemini',
  deepseek: 'DeepSeek',
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
interface GraphLink { source: string; target: string; type?: string; }
interface RawData { nodes: Omit<GraphNode, 'x'|'y'|'vx'|'vy'>[]; links: GraphLink[]; }

const REPULSION = 8000;
const SPRING_LEN = 160;
const SPRING_K = 0.03;
const DAMPING = 0.82;
const ITERATIONS_PER_FRAME = 3;
const NODE_MIN_R = 12;

function runSimStep(nodes: GraphNode[], links: GraphLink[]) {
  const idxMap = new Map(nodes.map((n, i) => [n.id, i]));
  for (let iter = 0; iter < ITERATIONS_PER_FRAME; iter++) {
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
      const force = (dist - SPRING_LEN) * SPRING_K;
      const fx = (dx / dist) * force; const fy = (dy / dist) * force;
      s.vx += fx; s.vy += fy; t.vx -= fx; t.vy -= fy;
    }
    for (const n of nodes) {
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

  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, byModel: {} as Record<string, number> });
  const [, setRawData] = useState<RawData>({ nodes: [], links: [] });

  useEffect(() => {
    fetch('/api/memory/graph')
      .then(r => r.json())
      .then((data: RawData) => {
        const byModel: Record<string, number> = {};
        const nodes: GraphNode[] = data.nodes.map((n, i) => {
          const k = modelKey(n.model);
          byModel[k] = (byModel[k] ?? 0) + 1;
          const angle = (i / data.nodes.length) * 2 * Math.PI;
          const radius = 80 + Math.random() * 60;
          return { ...n, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, vx: 0, vy: 0 };
        });
        nodesRef.current = nodes;
        linksRef.current = data.links;
        setRawData(data);
        setStats({ total: nodes.length, byModel });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getFilteredIds = useCallback(() => {
    if (filter === 'all') return null;
    return new Set(nodesRef.current.filter(n => n.model.toLowerCase().includes(filter)).map(n => n.id));
  }, [filter]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x: tx, y: ty, scale } = transformRef.current;
    const w = canvas.width; const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(tx + w / 2, ty + h / 2);
    ctx.scale(scale, scale);

    const filteredIds = getFilteredIds();
    const nodes = nodesRef.current;
    const links = linksRef.current;
    const idxMap = new Map(nodes.map((n, i) => [n.id, i]));

    // Draw links
    for (const l of links) {
      const si = idxMap.get(l.source); const ti = idxMap.get(l.target);
      if (si == null || ti == null) continue;
      const s = nodes[si]; const t = nodes[ti];
      if (filteredIds && (!filteredIds.has(s.id) || !filteredIds.has(t.id))) continue;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      if (l.type === 'chain') {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = 'rgba(153,69,255,0.3)';
        ctx.lineWidth = 1 / scale;
        ctx.setLineDash([6 / scale, 4 / scale]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // Arrow
      const angle = Math.atan2(t.y - s.y, t.x - s.x);
      const r = Math.max(4, (t.score ?? 0) * 0.8 + 5) + 2;
      const ax = t.x - Math.cos(angle) * r;
      const ay = t.y - Math.sin(angle) * r;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - Math.cos(angle - 0.4) * 6 / scale, ay - Math.sin(angle - 0.4) * 6 / scale);
      ctx.lineTo(ax - Math.cos(angle + 0.4) * 6 / scale, ay - Math.sin(angle + 0.4) * 6 / scale);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fill();
    }

    // Draw nodes
    for (const n of nodes) {
      if (filteredIds && !filteredIds.has(n.id)) continue;
      const color = modelColor(n.model);
      const r = Math.max(NODE_MIN_R, (n.score ?? 0) * 0.8 + NODE_MIN_R);
      const isSelected = selected?.id === n.id;

      if (n.onChain || n.verified) {
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 5, 0, 2 * Math.PI);
        ctx.fillStyle = color + '22'; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? '#ffffff' : color; ctx.fill();
      if (isSelected) {
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 / scale; ctx.stroke();
      }
      if (n.zkVerified) {
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 2, 0, 2 * Math.PI);
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.5 / scale; ctx.stroke();
      }
      if (scale >= 1.2) {
        ctx.font = `${11 / scale}px monospace`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.textAlign = 'center';
        ctx.fillText(n.hash.slice(0, 8) + '…', n.x, n.y + r + 12 / scale);
      }
    }
    ctx.restore();
  }, [selected, getFilteredIds]);

  useEffect(() => {
    if (loading || nodesRef.current.length === 0) return;
    let stopped = false;
    let tick = 0;
    function frame() {
      if (stopped) return;
      if (tick < 200) { runSimStep(nodesRef.current, linksRef.current); tick++; }
      draw();
      animRef.current = requestAnimationFrame(frame);
    }
    animRef.current = requestAnimationFrame(frame);
    return () => { stopped = true; cancelAnimationFrame(animRef.current); };
  }, [loading, draw]);

  // Resize canvas
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
      draw();
    } else if (isPanningRef.current) {
      transformRef.current.x = panStartRef.current.tx + (e.clientX - panStartRef.current.x);
      transformRef.current.y = panStartRef.current.ty + (e.clientY - panStartRef.current.y);
      draw();
    }
  }, [screenToWorld, draw]);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current.nodeId && !isPanningRef.current) return;
    const wasDraggingNode = !!draggingRef.current.nodeId;
    draggingRef.current = { nodeId: null, offsetX: 0, offsetY: 0 };
    isPanningRef.current = false;
    if (!wasDraggingNode) {
      // click on canvas = deselect
      const rect = canvasRef.current!.getBoundingClientRect();
      const { x: wx, y: wy } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const hit = hitTest(wx, wy);
      setSelected(hit);
    }
  }, [screenToWorld, hitTest]);

  const onClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const { x: wx, y: wy } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    setSelected(hitTest(wx, wy));
  }, [screenToWorld, hitTest]);

  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    transformRef.current.scale = Math.min(4, Math.max(0.2, transformRef.current.scale * factor));
    draw();
  }, [draw]);

  const zoom = (dir: 1 | -1) => {
    transformRef.current.scale = Math.min(4, Math.max(0.2, transformRef.current.scale * (dir > 0 ? 1.2 : 0.83)));
    draw();
  };

  return (
    <div className="flex h-screen bg-[#060610] text-white overflow-hidden">
      {/* Left panel */}
      <div className="w-60 flex-shrink-0 flex flex-col border-r border-white/[0.06] bg-[#0a0a14]/80 backdrop-blur-xl z-10">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-5 h-5 text-[#9945FF]" />
            <span className="font-semibold text-white">Memory Brain</span>
          </div>
          <p className="text-xs text-white/40">Grafo neural de memórias</p>
        </div>

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

        <div className="p-4 border-b border-white/[0.06]">
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

        <div className="p-4 mt-auto">
          <div className="text-xs text-white/25 space-y-1.5">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full border border-yellow-400/50" /><span>ZK verificado</span></div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-white/10 ring-1 ring-white/20" /><span>On-chain</span></div>
            <div className="flex items-center gap-2 mt-1"><span className="text-white/20">Tamanho</span><span className="text-white/30">= score</span></div>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
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
              <p className="text-white/20 text-xs mt-1">Salve memórias no chat para ver o grafo.</p>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onClick={onClick}
          onWheel={onWheel}
          style={{ cursor: draggingRef.current.nodeId ? 'grabbing' : 'grab' }}
        />
        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1">
          <button onClick={() => zoom(1)} className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/[0.08] flex items-center justify-center text-white/60 hover:text-white transition-all">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => zoom(-1)} className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/[0.08] flex items-center justify-center text-white/60 hover:text-white transition-all">
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-72 flex-shrink-0 border-l border-white/[0.06] bg-[#0a0a14]/90 backdrop-blur-xl flex flex-col z-10 overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
            <span className="text-sm font-semibold text-white">Memória</span>
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
            <a href={`/memory/${selected.hash}`}
              className="mt-2 w-full py-2 rounded-xl text-center text-sm font-medium bg-gradient-to-r from-[#9945FF]/20 to-[#14F195]/10 border border-[#9945FF]/30 hover:border-[#9945FF]/60 text-white/70 hover:text-white transition-all">
              Ver memória completa →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
