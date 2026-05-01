'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  BookOpen,
  Headphones,
  Cpu,
  Check,
  Brain,
  ShieldCheck,
} from 'lucide-react';

interface VerifiedMemory {
  hash: string;
  content: string;
  model: string;
  score: number | null;
  verified: boolean;
}

const AVAILABLE_TOOLS = [
  { key: 'memory', name: 'Verifiable Memory' },
  { key: 'web_search', name: 'Web Search' },
  { key: 'code_execution', name: 'Code Execution' },
  { key: 'image_generation', name: 'Image Generation' },
  { key: 'blockchain', name: 'Blockchain Query' },
  { key: 'data_analysis', name: 'Data Analysis' },
];

const TEMPLATES = [
  {
    key: 'trading',
    name: 'Trading Analyst',
    icon: TrendingUp,
    description: 'Análise de mercado e sinais de trading',
    goal: 'Analyze markets, provide trading signals, and track portfolio performance with verified memory of all past analyses.',
    personality: 'analytical, data-driven, cautious with risk warnings, always cites sources, explains reasoning step by step',
    model: 'gpt',
    tools: ['memory', 'web_search', 'blockchain', 'data_analysis'],
    color: 'from-[#14F195]/20 to-[#14F195]/5 border-[#14F195]/20 hover:border-[#14F195]/40',
    iconColor: 'text-[#14F195]',
  },
  {
    key: 'research',
    name: 'Research Assistant',
    icon: BookOpen,
    description: 'Pesquisa profunda com base de conhecimento',
    goal: 'Conduct deep research on any topic, synthesize findings, and maintain a verified knowledge base across sessions.',
    personality: 'thorough, academic yet accessible, always provides sources, structures information hierarchically',
    model: 'claude',
    tools: ['memory', 'web_search', 'data_analysis'],
    color: 'from-[#00D1FF]/20 to-[#00D1FF]/5 border-[#00D1FF]/20 hover:border-[#00D1FF]/40',
    iconColor: 'text-[#00D1FF]',
  },
  {
    key: 'support',
    name: 'Customer Support',
    icon: Headphones,
    description: 'Suporte ao cliente com histórico completo',
    goal: 'Provide excellent customer support with full context of past interactions and verified resolution records.',
    personality: 'empathetic, professional, solution-oriented, follows up on previous issues',
    model: 'gemini',
    tools: ['memory', 'web_search'],
    color: 'from-[#9945FF]/20 to-[#9945FF]/5 border-[#9945FF]/20 hover:border-[#9945FF]/40',
    iconColor: 'text-[#9945FF]',
  },
];

const MODELS = [
  { key: 'gpt',      name: 'GPT-4o',       description: 'Versátil e preciso',         color: 'border-green-500/30 bg-green-500/5 text-green-400' },
  { key: 'claude',   name: 'Claude Opus',  description: 'Analítico e detalhista',      color: 'border-orange-500/30 bg-orange-500/5 text-orange-400' },
  { key: 'deepseek', name: 'DeepSeek V3',  description: 'Raciocínio + custo baixo',    color: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-400' },
  { key: 'nvidia',   name: 'NVIDIA Llama', description: 'Open source otimizado',       color: 'border-purple-500/30 bg-purple-500/5 text-purple-400' },
  { key: 'gemini',   name: 'Gemini Pro',   description: 'Rápido e criativo',           color: 'border-blue-500/30 bg-blue-500/5 text-blue-400' },
];

export default function CreateAgentPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [personality, setPersonality] = useState('');
  const [model, setModel] = useState('gpt');
  const [tools, setTools] = useState<string[]>(['memory']);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showInheritance, setShowInheritance] = useState(false);
  const [seedMemories, setSeedMemories] = useState<string[]>([]);
  const [availableMemories, setAvailableMemories] = useState<VerifiedMemory[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);

  useEffect(() => {
    if (!showInheritance || availableMemories.length > 0) return;
    setLoadingMemories(true);
    fetch('/api/memory/timeline')
      .then(r => r.json())
      .then(data => {
        const verified = (data.memories || []).filter((m: VerifiedMemory) => m.verified && m.score !== null);
        setAvailableMemories(verified);
      })
      .catch(() => {})
      .finally(() => setLoadingMemories(false));
  }, [showInheritance, availableMemories.length]);

  function toggleSeedMemory(hash: string) {
    setSeedMemories(prev =>
      prev.includes(hash) ? prev.filter(h => h !== hash) : [...prev, hash]
    );
  }

  function applyTemplate(tpl: typeof TEMPLATES[0]) {
    setName(tpl.name);
    setGoal(tpl.goal);
    setPersonality(tpl.personality);
    setModel(tpl.model);
    setTools([...tpl.tools]);
    setSystemPrompt('');
    setShowCustomPrompt(false);
  }

  function toggleTool(toolKey: string) {
    setTools((prev) =>
      prev.includes(toolKey)
        ? prev.filter((t) => t !== toolKey)
        : [...prev, toolKey]
    );
  }

  async function handleCreate() {
    if (!name.trim() || !goal.trim()) {
      setError('Nome e objetivo são obrigatórios.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          goal: goal.trim(),
          personality: personality.trim() || 'amigável e prestativo',
          model,
          tools,
          systemPrompt: systemPrompt.trim() || null,
          seedMemories: seedMemories.length > 0 ? seedMemories : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao criar o agente.');
        setLoading(false);
        return;
      }

      router.push('/agents');
    } catch {
      setError('Erro de conexão. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/agents')}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white/60"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <h1 className="text-2xl font-bold text-white/90">Criar Agente</h1>
          <p className="mt-1 text-sm text-white/40">
            Configure seu agente de IA com memória verificável
          </p>
        </div>

        <div className="space-y-6">
          {/* Templates */}
          <div>
            <h2 className="mb-3 text-sm font-medium text-white/60">Templates Rápidos</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.key}
                  onClick={() => applyTemplate(tpl)}
                  className={`group rounded-xl border bg-gradient-to-b p-4 text-left transition-all ${tpl.color}`}
                >
                  <tpl.icon className={`mb-2 h-5 w-5 ${tpl.iconColor}`} />
                  <h3 className="text-sm font-semibold text-white/80">{tpl.name}</h3>
                  <p className="mt-0.5 text-[11px] text-white/30">{tpl.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/60">
              Nome do Agente <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Assistente de Trading"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/90 placeholder:text-white/20 outline-none transition-colors focus:border-[#9945FF]/40 focus:bg-white/[0.06]"
            />
          </div>

          {/* Goal */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/60">
              Objetivo <span className="text-red-400">*</span>
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              placeholder="Descreva o objetivo principal do agente..."
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/90 placeholder:text-white/20 outline-none transition-colors focus:border-[#9945FF]/40 focus:bg-white/[0.06]"
            />
          </div>

          {/* Personality */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/60">
              Personalidade
            </label>
            <textarea
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              rows={2}
              placeholder="Descreva a personalidade e tom do agente..."
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/90 placeholder:text-white/20 outline-none transition-colors focus:border-[#9945FF]/40 focus:bg-white/[0.06]"
            />
          </div>

          {/* Model selector */}
          <div>
            <label className="mb-3 block text-sm font-medium text-white/60">Modelo de IA</label>
            <div className="grid grid-cols-2 gap-3">
              {MODELS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setModel(m.key)}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                    model === m.key
                      ? m.color
                      : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]'
                  }`}
                >
                  <Cpu className={`h-5 w-5 flex-shrink-0 ${model === m.key ? '' : 'text-white/20'}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${model === m.key ? 'text-white/90' : 'text-white/60'}`}>
                        {m.name}
                      </span>
                      {model === m.key && <Check className="h-3.5 w-3.5 text-white/60" />}
                    </div>
                    <span className="text-[11px] text-white/30">{m.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tools */}
          <div>
            <label className="mb-3 block text-sm font-medium text-white/60">Ferramentas</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AVAILABLE_TOOLS.map((tool) => (
                <button
                  key={tool.key}
                  onClick={() => toggleTool(tool.key)}
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm transition-all ${
                    tools.includes(tool.key)
                      ? 'border-[#9945FF]/30 bg-[#9945FF]/10 text-[#9945FF]'
                      : 'border-white/[0.06] bg-white/[0.03] text-white/40 hover:bg-white/[0.05]'
                  }`}
                >
                  <div
                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                      tools.includes(tool.key)
                        ? 'border-[#9945FF] bg-[#9945FF]'
                        : 'border-white/20'
                    }`}
                  >
                    {tools.includes(tool.key) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-xs font-medium">{tool.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Memory Inheritance (collapsible) */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <button
              onClick={() => setShowInheritance(!showInheritance)}
              className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-[#9945FF]/60" />
                <span className="text-sm font-medium text-white/60">Herança de Memória</span>
                <span className="text-[10px] text-white/25">(opcional)</span>
                {seedMemories.length > 0 && (
                  <span className="rounded-full bg-[#9945FF]/20 px-2 py-0.5 text-[10px] font-semibold text-[#9945FF]">
                    {seedMemories.length} selecionada{seedMemories.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {showInheritance ? (
                <ChevronUp className="h-4 w-4 text-white/30" />
              ) : (
                <ChevronDown className="h-4 w-4 text-white/30" />
              )}
            </button>
            {showInheritance && (
              <div className="border-t border-white/[0.04] p-4">
                <p className="mb-3 text-xs text-white/35 leading-relaxed">
                  Selecione memórias verificadas na blockchain para injetar como conhecimento base do agente.
                  O agente nascerá já ciente dessas informações.
                </p>
                {loadingMemories && (
                  <div className="flex items-center gap-2 py-4 text-white/30">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Carregando memórias verificadas...</span>
                  </div>
                )}
                {!loadingMemories && availableMemories.length === 0 && (
                  <p className="py-4 text-center text-xs text-white/25">
                    Nenhuma memória verificada disponível. Salve e vote em memórias no chat primeiro.
                  </p>
                )}
                {!loadingMemories && availableMemories.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {availableMemories.map((mem) => {
                      const selected = seedMemories.includes(mem.hash);
                      return (
                        <button
                          key={mem.hash}
                          onClick={() => toggleSeedMemory(mem.hash)}
                          className={`w-full rounded-xl border p-3 text-left transition-all ${
                            selected
                              ? 'border-[#9945FF]/40 bg-[#9945FF]/8'
                              : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                              selected ? 'border-[#9945FF] bg-[#9945FF]' : 'border-white/20'
                            }`}>
                              {selected && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                <span className="font-mono text-[9px] text-white/25">{mem.hash.slice(0, 12)}…</span>
                                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-white/40 uppercase">{mem.model}</span>
                                {mem.score !== null && (
                                  <span className="rounded bg-[#14F195]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#14F195]">
                                    PoI {mem.score}/10
                                  </span>
                                )}
                                <ShieldCheck className="h-3 w-3 text-[#14F195]/60" />
                              </div>
                              <p className="text-[11px] text-white/50 line-clamp-2 leading-relaxed">{mem.content}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Custom system prompt (collapsible) */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <button
              onClick={() => setShowCustomPrompt(!showCustomPrompt)}
              className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-white/40" />
                <span className="text-sm font-medium text-white/60">Prompt de Sistema Customizado</span>
                <span className="text-[10px] text-white/25">(opcional)</span>
              </div>
              {showCustomPrompt ? (
                <ChevronUp className="h-4 w-4 text-white/30" />
              ) : (
                <ChevronDown className="h-4 w-4 text-white/30" />
              )}
            </button>
            {showCustomPrompt && (
              <div className="border-t border-white/[0.04] p-4">
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={4}
                  placeholder="Defina instruções customizadas para o agente..."
                  className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/90 placeholder:text-white/20 outline-none transition-colors focus:border-[#9945FF]/40 focus:bg-white/[0.06]"
                />
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#00D1FF] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#9945FF]/20 transition-all hover:shadow-[#9945FF]/30 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Criando Agente...' : 'Criar Agente'}
          </button>
        </div>
      </div>
    </div>
  );
}
