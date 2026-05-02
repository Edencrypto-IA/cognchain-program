'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { X, ZapIcon, ShieldCheck, Link2, Brain, Filter } from 'lucide-react';

const ForceGraph2D = dynamic(() => import('react-force-graph').then((m) => m.ForceGraph2D), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-white/40 text-sm">
      Carregando grafo...
    </div>
  ),
});

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

function modelColor(model: string) {
  const key = Object.keys(MODEL_COLORS).find((k) => model.toLowerCase().includes(k));
  return key ? MODEL_COLORS[key] : '#888888';
}

function modelLabel(model: string) {
  const key = Object.keys(MODEL_LABELS).find((k) => model.toLowerCase().includes(k));
  return key ? MODEL_LABELS[key] : model;
}

interface GraphNode {
  id: string;
  label: string;
  model: string;
  timestamp: number;
  score: number;
  verified: boolean;
  zkVerified: boolean;
  onChain: boolean;
  hash: string;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export default function BrainPage() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, byModel: {} as Record<string, number> });
  const graphRef = useRef<unknown>(null);

  useEffect(() => {
    fetch('/api/memory/graph')
      .then((r) => r.json())
      .then((data: GraphData) => {
        setGraphData(data);
        const byModel: Record<string, number> = {};
        for (const n of data.nodes) {
          const key = Object.keys(MODEL_COLORS).find((k) => n.model.toLowerCase().includes(k)) ?? 'other';
          byModel[key] = (byModel[key] ?? 0) + 1;
        }
        setStats({ total: data.nodes.length, byModel });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = {
    nodes: filter === 'all'
      ? graphData.nodes
      : graphData.nodes.filter((n) => n.model.toLowerCase().includes(filter)),
    links: filter === 'all'
      ? graphData.links
      : graphData.links.filter((l) => {
          const srcId = typeof l.source === 'string' ? l.source : l.source.id;
          const tgtId = typeof l.target === 'string' ? l.target : l.target.id;
          const filteredIds = new Set(
            graphData.nodes.filter((n) => n.model.toLowerCase().includes(filter)).map((n) => n.id)
          );
          return filteredIds.has(srcId) && filteredIds.has(tgtId);
        }),
  };

  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const color = modelColor(node.model);
    const r = Math.max(4, (node.score ?? 0) * 0.8 + 5);
    const x = node.x ?? 0;
    const y = node.y ?? 0;

    // Glow for on-chain or verified
    if (node.onChain || node.verified) {
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, 2 * Math.PI);
      ctx.fillStyle = color + '33';
      ctx.fill();
    }

    // Main circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = selected?.id === node.id ? '#ffffff' : color;
    ctx.fill();

    // ZK ring
    if (node.zkVerified) {
      ctx.beginPath();
      ctx.arc(x, y, r + 2, 0, 2 * Math.PI);
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Label when zoomed in
    if (globalScale >= 1.4) {
      const label = node.hash.slice(0, 8) + '…';
      ctx.font = `${10 / globalScale}px monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y + r + 8 / globalScale);
    }
  }, [selected]);

  const dateStr = (ts: number) =>
    new Date(ts * 1000).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="flex h-screen bg-[#060610] text-white overflow-hidden">
      {/* Left panel */}
      <div className="w-64 flex-shrink-0 flex flex-col border-r border-white/[0.06] bg-[#0a0a14]/80 backdrop-blur-xl z-10">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-5 h-5 text-[#9945FF]" />
            <span className="font-semibold text-white">Memory Brain</span>
          </div>
          <p className="text-xs text-white/40">Grafo neural de memórias</p>
        </div>

        {/* Stats */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="text-3xl font-bold text-white mb-0.5">{stats.total}</div>
          <div className="text-xs text-white/40">memórias totais</div>

          <div className="mt-3 flex flex-col gap-1.5">
            {Object.entries(MODEL_COLORS).map(([key, color]) => {
              const count = stats.byModel[key] ?? 0;
              if (count === 0) return null;
              return (
                <div key={key} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-white/60">{MODEL_LABELS[key]}</span>
                  </div>
                  <span className="text-white/80 font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-1.5 mb-2 text-xs text-white/40">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtrar por modelo</span>
          </div>
          <div className="flex flex-col gap-1">
            {[{ key: 'all', label: 'Todos', color: '#ffffff' }, ...Object.entries(MODEL_COLORS).map(([k, c]) => ({ key: k, label: MODEL_LABELS[k], color: c }))].map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all
                  ${filter === key ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'}`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="p-4 mt-auto">
          <div className="text-xs text-white/30 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-white/20 border border-yellow-400/60" />
              <span>ZK Proof verificado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-white/20 ring-2 ring-white/20" />
              <span>Ancorado na Solana</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-white/20">Tamanho</span>
              <span className="text-white/40">= score da memória</span>
            </div>
          </div>
        </div>
      </div>

      {/* Graph canvas */}
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
              <p className="text-white/20 text-xs mt-1">Converse com um agente e salve memórias para ver o grafo.</p>
            </div>
          </div>
        )}

        {!loading && stats.total > 0 && (
          <ForceGraph2D
            // @ts-ignore
            ref={graphRef}
            graphData={filtered}
            nodeCanvasObject={paintNode as never}
            nodeCanvasObjectMode={() => 'replace'}
            nodeLabel={(n: GraphNode) => `${modelLabel(n.model)} · ${n.hash.slice(0, 12)}…\n${n.label}`}
            linkColor={() => 'rgba(255,255,255,0.12)'}
            linkWidth={1}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            backgroundColor="#060610"
            onNodeClick={(n: GraphNode) => setSelected(n)}
            nodeRelSize={1}
            warmupTicks={80}
            cooldownTicks={200}
          />
        )}
      </div>

      {/* Right detail panel */}
      {selected && (
        <div className="w-80 flex-shrink-0 border-l border-white/[0.06] bg-[#0a0a14]/90 backdrop-blur-xl flex flex-col z-10 overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
            <span className="text-sm font-semibold text-white">Memória</span>
            <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 flex flex-col gap-4">
            {/* Model badge */}
            <div className="flex items-center gap-2">
              <span
                className="px-2.5 py-1 rounded-full text-xs font-semibold text-black"
                style={{ background: modelColor(selected.model) }}
              >
                {modelLabel(selected.model)}
              </span>
              {selected.onChain && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[#9945FF]/20 text-[#9945FF] border border-[#9945FF]/30">
                  <Link2 className="w-3 h-3" /> On-Chain
                </span>
              )}
              {selected.zkVerified && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                  <ZapIcon className="w-3 h-3" /> ZK
                </span>
              )}
              {selected.verified && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-500/10 text-green-400 border border-green-500/20">
                  <ShieldCheck className="w-3 h-3" /> PoI
                </span>
              )}
            </div>

            {/* Hash */}
            <div>
              <div className="text-xs text-white/30 mb-1">Hash</div>
              <div className="font-mono text-xs text-white/70 bg-white/[0.04] rounded-lg p-2 break-all select-all">
                {selected.hash}
              </div>
            </div>

            {/* Content */}
            <div>
              <div className="text-xs text-white/30 mb-1">Conteúdo</div>
              <div className="text-sm text-white/80 bg-white/[0.04] rounded-lg p-3 leading-relaxed max-h-48 overflow-y-auto">
                {selected.label}
              </div>
            </div>

            {/* Score */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Score</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 bg-white/[0.08] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195]"
                    style={{ width: `${Math.min(100, (selected.score / 10) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-white/70">{selected.score.toFixed(1)}</span>
              </div>
            </div>

            {/* Timestamp */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Data</span>
              <span className="text-xs text-white/60">{dateStr(selected.timestamp)}</span>
            </div>

            {/* View full */}
            <a
              href={`/memory/${selected.hash}`}
              className="mt-2 w-full py-2 rounded-xl text-center text-sm font-medium
                bg-gradient-to-r from-[#9945FF]/20 to-[#14F195]/10
                border border-[#9945FF]/30 hover:border-[#9945FF]/60
                text-white/70 hover:text-white transition-all"
            >
              Ver memória completa →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
