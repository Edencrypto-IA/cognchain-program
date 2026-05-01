'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Hash, Cpu, Clock, Star, Shield, Link2, Copy, Check } from 'lucide-react';
import { shortHash, formatTimestamp } from '@/services/memory';
import { MODEL_LABELS, type MemoryEntry } from '@/services/memory/memory.model';
import Orb from '@/components/congchain/orb';

export default function MemoryPage() {
  const params = useParams();
  const hash = params.hash as string;
  const [memory, setMemory] = useState<MemoryEntry | null>(null);
  const [chain, setChain] = useState<MemoryEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chainError, setChainError] = useState(false);

  useEffect(() => {
    if (!hash) return;

    async function load() {
      try {
        const [memRes, chainRes] = await Promise.all([
          fetch(`/api/memory/${hash}`),
          fetch(`/api/memory/${hash}?chain=true`),
        ]);
        const memData = await memRes.json();
        if (memData.memory) setMemory(memData.memory);

        if (chainRes.ok) {
          const chainData = await chainRes.json();
          if (chainData.chain) setChain(chainData.chain);
        } else {
          setChainError(true);
        }
      } catch {
        // Error handled by loading state
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [hash]);

  const copyHash = () => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06060e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Orb mode="thinking" size="lg" interactive={false} />
          <p className="text-sm text-white/40">Carregando memoria...</p>
        </div>
      </div>
    );
  }

  if (!memory) {
    return (
      <div className="min-h-screen bg-[#06060e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Orb mode="error" size="lg" interactive={false} />
          <p className="text-sm text-white/40">Memoria nao encontrada</p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-2 px-4 py-2 rounded-xl bg-white/[0.06] text-white/60 text-sm hover:bg-white/[0.1] transition-colors"
          >
            Voltar ao Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06060e]">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#0a0a14]/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.href = '/'}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Orb mode={memory.verified ? 'success' : 'idle'} size="sm" interactive={false} />
              <div>
                <h1 className="text-sm font-semibold text-white/90">Memory View</h1>
                <p className="text-[11px] text-white/35">CONGCHAIN — Verifiable AI Memory Layer</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {memory.verified && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-[#14F195]/10 text-[#14F195]/70 border border-[#14F195]/20">
                <Shield className="w-3 h-3" />
                Verified
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Memory Card */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden mb-8">
          {/* Hash */}
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-[#9945FF]" />
              <code className="text-xs text-[#14F195]/70 font-mono">{hash}</code>
            </div>
            <button
              onClick={copyHash}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/25 hover:text-white/50 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-[#14F195]" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-5">
            <p className="text-[15px] text-white/80 leading-relaxed whitespace-pre-wrap">{memory.content}</p>
          </div>

          {/* Metadata */}
          <div className="px-5 py-4 border-t border-white/[0.06] grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Cpu className="w-3.5 h-3.5 text-white/25" />
                <span className="text-[10px] font-semibold text-white/30 uppercase">Modelo</span>
              </div>
              <p className="text-sm text-white/70">{(MODEL_LABELS as Record<string, string>)[memory.model] || memory.model}</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-white/25" />
                <span className="text-[10px] font-semibold text-white/30 uppercase">Timestamp</span>
              </div>
              <p className="text-sm text-white/70">{formatTimestamp(memory.timestamp)}</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Star className="w-3.5 h-3.5 text-white/25" />
                <span className="text-[10px] font-semibold text-white/30 uppercase">Score</span>
              </div>
              <p className="text-sm text-white/70">{memory.score ? `${memory.score}/10` : 'Nao avaliado'}</p>
            </div>
          </div>
        </div>

        {/* Chain load error — non-blocking warning */}
        {chainError && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-xs text-yellow-400/70">
            Não foi possível carregar a cadeia de evolução desta memória.
          </div>
        )}

        {/* Evolution Chain */}
        {chain.length > 1 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#9945FF]" />
              Cadeia de Evolucao
            </h2>
            <div className="relative space-y-3">
              {chain.map((entry, idx) => (
                <div key={entry.hash} className="relative flex items-start gap-3">
                  {/* Timeline connector */}
                  {idx < chain.length - 1 && (
                    <div className="absolute left-[11px] top-[24px] w-px h-[calc(100%+12px)] bg-gradient-to-b from-[#9945FF]/30 to-[#14F195]/30" />
                  )}
                  {/* Timeline dot */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10
                    ${entry.hash === hash
                      ? 'bg-gradient-to-br from-[#9945FF] to-[#14F195]'
                      : 'bg-white/[0.08] border border-white/[0.12]'
                    }`}>
                    <span className="text-[9px] font-bold text-white/80">{idx + 1}</span>
                  </div>
                  {/* Content */}
                  <div className={`flex-1 p-3 rounded-xl transition-colors
                    ${entry.hash === hash
                      ? 'bg-white/[0.06] border border-[#9945FF]/20'
                      : 'bg-white/[0.02] border border-white/[0.04]'
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-[10px] text-[#14F195]/50 font-mono">{shortHash(entry.hash)}</code>
                      <span className="text-[10px] text-white/20">{(MODEL_LABELS as Record<string, string>)[entry.model] || entry.model}</span>
                    </div>
                    <p className="text-xs text-white/50 line-clamp-2">{entry.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
