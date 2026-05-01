'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Bot, Cpu, Wrench, Zap, MessageCircle, Send, Loader2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CognitiveProfileCard from '@/components/agents/cognitive-profile-card';

interface IntelligenceScore {
  total: number;
  level: 'Nascente' | 'Aprendiz' | 'Competente' | 'Especialista' | 'Mestre';
  breakdown: { memories: number; quality: number; decisions: number; onChain: number };
}

interface Agent {
  id: string;
  name: string;
  goal: string;
  personality: string;
  model: string;
  tools: string[];
  systemPrompt: string;
  isDeployed: boolean;
  deployTarget: string | null;
  memoryCount: number;
  totalInteractions: number;
  createdAt: string;
  intelligence?: IntelligenceScore | null;
}

const LEVEL_COLORS: Record<string, { stroke: string; text: string; badge: string }> = {
  Nascente:    { stroke: '#6B7280', text: '#6B7280', badge: 'bg-gray-500/10 text-gray-400' },
  Aprendiz:    { stroke: '#3B82F6', text: '#3B82F6', badge: 'bg-blue-500/10 text-blue-400' },
  Competente:  { stroke: '#14F195', text: '#14F195', badge: 'bg-[#14F195]/10 text-[#14F195]' },
  Especialista:{ stroke: '#F97316', text: '#F97316', badge: 'bg-orange-500/10 text-orange-400' },
  Mestre:      { stroke: '#9945FF', text: '#9945FF', badge: 'bg-[#9945FF]/10 text-[#9945FF]' },
};

function IntelligenceGauge({ score, level }: { score: number; level: string }) {
  const c = LEVEL_COLORS[level] || LEVEL_COLORS.Nascente;
  const r = 13;
  const circ = 2 * Math.PI * r;
  const arcLen = circ * 0.75;
  const progress = (score / 100) * arcLen;
  return (
    <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center">
      <svg width="36" height="36" viewBox="0 0 36 36" style={{ transform: 'rotate(135deg)' }}>
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${arcLen} ${circ}`} />
        <circle cx="18" cy="18" r={r} fill="none" stroke={c.stroke} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${progress} ${circ}`} style={{ filter: `drop-shadow(0 0 4px ${c.stroke}80)`, transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <span className="absolute text-[9px] font-bold leading-none" style={{ color: c.text }}>{score}</span>
    </div>
  );
}

const MODEL_BADGES: Record<string, { label: string; color: string }> = {
  gpt:      { label: 'GPT-4o',     color: 'bg-green-500/15 text-green-400 border-green-500/20' },
  claude:   { label: 'Claude',     color: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
  nvidia:   { label: 'Llama',      color: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
  gemini:   { label: 'Gemini',     color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  deepseek: { label: 'DeepSeek',   color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' },
};

const TOOL_COLORS: Record<string, string> = {
  memory: 'bg-[#9945FF]/10 text-[#9945FF]',
  web_search: 'bg-[#00D1FF]/10 text-[#00D1FF]',
  code_execution: 'bg-[#14F195]/10 text-[#14F195]',
  image_generation: 'bg-pink-500/10 text-pink-400',
  blockchain: 'bg-yellow-500/10 text-yellow-400',
  data_analysis: 'bg-orange-500/10 text-orange-400',
};

const TOOL_NAMES: Record<string, string> = {
  memory: 'Memória',
  web_search: 'Busca',
  code_execution: 'Código',
  image_generation: 'Imagens',
  blockchain: 'Blockchain',
  data_analysis: 'Dados',
};

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [creatingSage, setCreatingSage] = useState(false);

  async function createSolanaSage() {
    setCreatingSage(true);
    try {
      const res = await fetch('/api/agents/solana-sage', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        router.push(`/agents/${data.agent.id}`);
      }
    } catch { /* silent */ }
    finally { setCreatingSage(false); }
  }

  const fetchAgents = React.useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      if (data.agents) setAgents(data.agents);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              onClick={() => router.push('/')}
              className="mb-3 inline-flex items-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white/60"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Chat
            </button>
            <h1 className="text-2xl font-bold text-white/90 sm:text-3xl">Agent Builder</h1>
            <p className="mt-1 text-sm text-white/40">
              Crie, gerencie e implante seus agentes de IA com memória verificável
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={createSolanaSage}
              disabled={creatingSage}
              className="inline-flex items-center gap-2 rounded-xl border border-[#9945FF]/30 bg-[#9945FF]/10 px-4 py-3 text-sm font-semibold text-[#9945FF] transition-all hover:bg-[#9945FF]/20 disabled:opacity-50"
              title="Cria o agente Solana Sage pré-configurado com segurança"
            >
              {creatingSage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="text-base leading-none">⚡</span>
              )}
              Solana Sage
            </button>
            <button
              onClick={() => router.push('/agents/create')}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#00D1FF] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#9945FF]/20 transition-all hover:shadow-[#9945FF]/30"
            >
              <Plus className="h-4 w-4" />
              Criar Agente
            </button>
          </div>
        </div>

        {/* Cognitive Profile */}
        <div className="mb-8">
          <CognitiveProfileCard />
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-white/30" />
          </div>
        )}

        {/* Error state */}
        {fetchError && !loading && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5 py-16">
            <p className="mb-4 text-sm text-red-400/80">Não foi possível carregar os agentes. Verifique sua conexão.</p>
            <button
              onClick={fetchAgents}
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/[0.08]"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && agents.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] py-20">
            <div className="mb-4 rounded-2xl bg-gradient-to-br from-[#9945FF]/10 to-[#00D1FF]/10 p-5">
              <Bot className="h-10 w-10 text-[#9945FF]/50" />
            </div>
            <h3 className="mb-1 text-base font-semibold text-white/60">Nenhum agente criado</h3>
            <p className="mb-6 max-w-sm text-center text-sm text-white/30">
              Crie seu primeiro agente de IA com memória verificável na blockchain Solana.
              Comece com um template ou do zero.
            </p>
            <button
              onClick={() => router.push('/agents/create')}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#00D1FF] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#9945FF]/20 transition-all hover:shadow-[#9945FF]/30"
            >
              <Plus className="h-4 w-4" />
              Criar Primeiro Agente
            </button>
          </div>
        )}

        {/* Agent grid */}
        {!loading && agents.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => router.push(`/agents/${agent.id}`)}
                className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 text-left transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.05]"
              >
                {/* Level-colored top accent bar */}
                {agent.intelligence && (
                  <div
                    className="absolute inset-x-0 top-0 h-[2px] rounded-t-xl opacity-60"
                    style={{ background: `linear-gradient(90deg, ${LEVEL_COLORS[agent.intelligence.level]?.stroke ?? '#9945FF'} ${agent.intelligence.total}%, transparent ${agent.intelligence.total}%)` }}
                  />
                )}

                {/* Hover gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#9945FF]/5 via-transparent to-[#00D1FF]/5 opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="relative">
                  {/* Top row */}
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-lg bg-gradient-to-br from-[#9945FF]/20 to-[#00D1FF]/20 p-2">
                        <Bot className="h-4 w-4 text-[#9945FF]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white/80 group-hover:text-white/95">
                          {agent.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          {MODEL_BADGES[agent.model] && (
                            <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${MODEL_BADGES[agent.model].color}`}>
                              <Cpu className="h-2.5 w-2.5" />
                              {MODEL_BADGES[agent.model].label}
                            </span>
                          )}
                          {agent.isDeployed && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#14F195]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#14F195]">
                              {agent.deployTarget === 'telegram' ? (
                                <Send className="h-2.5 w-2.5" />
                              ) : (
                                <MessageCircle className="h-2.5 w-2.5" />
                              )}
                              Ativo
                            </span>
                          )}
                          {agent.intelligence && (
                            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${LEVEL_COLORS[agent.intelligence.level]?.badge}`}>
                              {agent.intelligence.level}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {agent.intelligence ? (
                      <IntelligenceGauge score={agent.intelligence.total} level={agent.intelligence.level} />
                    ) : null}
                  </div>

                  {/* Goal */}
                  <p className="mb-3 text-xs text-white/40 line-clamp-2 leading-relaxed">
                    {agent.goal}
                  </p>

                  {/* Tools */}
                  <div className="mb-3 flex flex-wrap gap-1">
                    {agent.tools.slice(0, 4).map((tool) => (
                      <span
                        key={tool}
                        className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${TOOL_COLORS[tool] || 'bg-white/5 text-white/40'}`}
                      >
                        {TOOL_NAMES[tool] || tool}
                      </span>
                    ))}
                    {agent.tools.length > 4 && (
                      <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/30">
                        +{agent.tools.length - 4}
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 border-t border-white/[0.04] pt-3">
                    <div className="flex items-center gap-1 text-white/25">
                      <Zap className="h-3 w-3" />
                      <span className="text-[11px]">{agent.totalInteractions} interações</span>
                    </div>
                    <div className="flex items-center gap-1 text-white/25">
                      <Wrench className="h-3 w-3" />
                      <span className="text-[11px]">{agent.memoryCount} memórias</span>
                    </div>
                    {agent.intelligence && (
                      <div className="ml-auto flex gap-1.5 text-white/20">
                        <span className="text-[10px]">M{agent.intelligence.breakdown.memories}</span>
                        <span className="text-[10px]">Q{agent.intelligence.breakdown.quality}</span>
                        <span className="text-[10px]">D{agent.intelligence.breakdown.decisions}</span>
                        <span className="text-[10px]">⛓{agent.intelligence.breakdown.onChain}</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}

            {/* Create card */}
            <button
              onClick={() => router.push('/agents/create')}
              className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] p-8 transition-all hover:border-[#9945FF]/30 hover:bg-[#9945FF]/5"
            >
              <div className="mb-3 rounded-xl bg-white/[0.04] p-3">
                <Plus className="h-5 w-5 text-white/30" />
              </div>
              <span className="text-sm font-medium text-white/30">Novo Agente</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
