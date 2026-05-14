'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Trash2,
  Rocket,
  Bot,
  Cpu,
  Wrench,
  Zap,
  MessageCircle,
  Send,
  Check,
  Loader2,
  Shield,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import ContextVisualization from '@/components/agents/context-visualization';
import DeployDialog from '@/components/agents/deploy-dialog';
import DecisionTimeline from '@/components/agents/decision-timeline';
import RuleBuilder from '@/components/agents/rule-builder';
import SolanaIntentPanel from '@/components/agents/solana-intent-panel';

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
}

type LoopWorkStatus = 'pending' | 'running' | 'complete' | 'error';

interface LoopWorkEvent {
  id: string;
  title: string;
  detail: string;
  source: string;
  status: LoopWorkStatus;
  timestamp: number;
}

const MODELS = [
  { key: 'gpt',      name: 'GPT-4o',       color: 'border-green-500/30 bg-green-500/5 text-green-400' },
  { key: 'claude',   name: 'Claude Opus',  color: 'border-orange-500/30 bg-orange-500/5 text-orange-400' },
  { key: 'deepseek', name: 'DeepSeek V3',  color: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-400' },
  { key: 'nvidia',   name: 'NVIDIA Llama', color: 'border-purple-500/30 bg-purple-500/5 text-purple-400' },
  { key: 'gemini',   name: 'Gemini Pro',   color: 'border-blue-500/30 bg-blue-500/5 text-blue-400' },
];

const TOOL_COLORS: Record<string, string> = {
  memory: 'bg-[#9945FF]/10 text-[#9945FF] border-[#9945FF]/20',
  web_search: 'bg-[#00D1FF]/10 text-[#00D1FF] border-[#00D1FF]/20',
  code_execution: 'bg-[#14F195]/10 text-[#14F195] border-[#14F195]/20',
  image_generation: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  blockchain: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  data_analysis: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

const TOOL_NAMES: Record<string, string> = {
  memory: 'Verifiable Memory',
  web_search: 'Web Search',
  code_execution: 'Code Execution',
  image_generation: 'Image Generation',
  blockchain: 'Blockchain Query',
  data_analysis: 'Data Analysis',
};

function buildLoopWorkstream(agent: Agent, command: string): LoopWorkEvent[] {
  const now = Date.now();
  const action = command === 'start' ? 'Loop armado e ciclo inicial disparado' : 'Execucao manual disparada';

  return [
    {
      id: 'connect',
      title: action,
      detail: `POST /api/agents/${agent.id}/loop`,
      source: 'Agent Runtime',
      status: 'running',
      timestamp: now,
    },
    {
      id: 'memory',
      title: 'Lendo memorias verificadas',
      detail: 'Buscando top memorias por score para montar contexto operacional.',
      source: 'Memory Brain',
      status: 'pending',
      timestamp: now + 1,
    },
    {
      id: 'model',
      title: 'Sintetizando insight autonomo',
      detail: `${agent.model.toUpperCase()} recebe objetivo, personalidade e memorias relevantes.`,
      source: 'AI Router',
      status: 'pending',
      timestamp: now + 2,
    },
    {
      id: 'rules',
      title: 'Avaliando regras ativas',
      detail: 'Decision Engine compara condicoes com evidencias de memoria.',
      source: 'Rule Engine',
      status: 'pending',
      timestamp: now + 3,
    },
    {
      id: 'tools',
      title: 'Executando ferramentas permitidas',
      detail: 'Acoes sao executadas apenas quando uma regra ativa encontra evidencia.',
      source: 'Tool Layer',
      status: 'pending',
      timestamp: now + 4,
    },
    {
      id: 'proof',
      title: 'Salvando resultado e prova',
      detail: 'Novas decisoes entram na timeline; prova on-chain e memoria sao best-effort.',
      source: 'Proof Layer',
      status: 'pending',
      timestamp: now + 5,
    },
  ];
}

function formatLoopAge(lastRun: number | null | undefined): string {
  if (!lastRun) return 'N/A';
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - lastRun));
  if (diff < 60) return diff === 0 ? 'agora' : `${diff}s atras`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atras`;
  return `${Math.floor(diff / 3600)}h atras`;
}

// Mock data for context visualization (would come from API in production)
const MOCK_MEMORIES = [
  {
    hash: '7xK9m2pL4nQ8rT3vW5yA1bC6dE0fG9hJ',
    content: 'Análise do mercado de criptomoedas mostrou tendência de alta para SOL com volume crescente nos últimos 7 dias.',
    model: 'gpt',
    score: 92,
    verified: true,
    timestamp: Date.now() - 86400000,
  },
  {
    hash: '4aB2cD5eF8gH1iJ3kL6mN9oP0qR4sT7uV',
    content: 'O usuário preferiu estratégias conservadoras com stop-loss de 5% para trades de criptomoedas em alta volatilidade.',
    model: 'claude',
    score: 85,
    verified: true,
    timestamp: Date.now() - 172800000,
  },
  {
    hash: '9zY1xW3vU5tS7rQ9pO2nM4lK6jH8gF0dE',
    content: 'Memória de preferência: o usuário sempre pede comparações com benchmarks do mercado antes de decisões de investimento.',
    model: 'gpt',
    score: 78,
    verified: false,
    timestamp: Date.now() - 345600000,
  },
];

function LoopWorkstreamPanel({
  events,
  isBusy,
  loopStatus,
}: {
  events: LoopWorkEvent[];
  isBusy: boolean;
  loopStatus: any;
}) {
  const visibleEvents = events.length > 0
    ? events
    : loopStatus?.isRunning
      ? [{
          id: 'waiting',
          title: 'Loop autonomo ativo',
          detail: 'Aguardando o proximo ciclo agendado. Use Executar Agora para disparar uma leitura imediatamente.',
          source: 'Agent Runtime',
          status: 'running' as const,
          timestamp: Date.now(),
        }]
      : [];

  if (visibleEvents.length === 0) return null;

  const completed = visibleEvents.filter(event => event.status === 'complete').length;
  const progress = Math.max(12, Math.round((completed / visibleEvents.length) * 100));

  return (
    <div className="border-b border-white/[0.04] bg-gradient-to-br from-[#9945FF]/7 via-white/[0.015] to-[#14F195]/5 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#14F195]/20 bg-[#14F195]/10">
            {isBusy ? (
              <Activity className="h-4 w-4 animate-pulse text-[#14F195]" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-[#14F195]" />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Live workstream</p>
            <p className="text-[11px] text-white/30">O agente esta executando o ciclo real: memoria, modelo, regras e prova.</p>
          </div>
        </div>
        <div className="rounded-full border border-white/[0.06] bg-black/25 px-3 py-1 text-[10px] text-white/35">
          {isBusy ? 'executando agora' : loopStatus?.isRunning ? 'loop ativo' : 'ultimo ciclo concluido'}
        </div>
      </div>

      <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#9945FF] via-[#00D1FF] to-[#14F195] transition-all duration-500"
          style={{ width: `${isBusy ? Math.min(progress + 14, 88) : 100}%` }}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {visibleEvents.map((event) => {
          const running = event.status === 'running';
          const complete = event.status === 'complete';
          const failed = event.status === 'error';
          return (
            <div
              key={event.id}
              className={`rounded-xl border p-3 transition-all ${
                running
                  ? 'border-[#14F195]/25 bg-[#14F195]/7 shadow-[0_0_30px_rgba(20,241,149,0.06)]'
                  : complete
                    ? 'border-[#00D1FF]/16 bg-white/[0.025]'
                    : failed
                      ? 'border-red-500/20 bg-red-500/5'
                      : 'border-white/[0.055] bg-black/20'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[11px] font-semibold text-white/70">
                  <span className={`h-2 w-2 rounded-full ${
                    running ? 'animate-pulse bg-[#14F195]' : complete ? 'bg-[#00D1FF]' : failed ? 'bg-red-400' : 'bg-white/18'
                  }`} />
                  {event.title}
                </span>
                <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/28">
                  {event.source}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-white/38">{event.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AutonomyPurposePanel({ onConfigureRules }: { onConfigureRules: () => void }) {
  return (
    <div className="border-b border-white/[0.04] bg-[#080812] p-4">
      <div className="rounded-2xl border border-[#00D1FF]/14 bg-gradient-to-br from-[#00D1FF]/8 via-white/[0.015] to-[#9945FF]/8 p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#00D1FF]/70">Para que isso serve?</p>
            <h3 className="mt-1 text-sm font-semibold text-white/78">Transformar memoria em acao automatica verificavel</h3>
          </div>
          <span className="rounded-full border border-white/[0.07] bg-black/30 px-2.5 py-1 text-[10px] text-white/35">
            IF memoria {'->'} THEN acao
          </span>
        </div>
        <p className="text-[12px] leading-relaxed text-white/42">
          O agente nao deve sair clicando ou decidindo sozinho sem criterio. Primeiro voce define regras. Depois, a cada ciclo, ele le as memorias verificadas, procura evidencias e executa apenas a acao permitida.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            ['Monitorar', 'Se uma memoria nova citar risco, gerar alerta.'],
            ['Decidir', 'Se score passar de 8, rodar analise ou salvar preferencia.'],
            ['Provar', 'Se uma acao for tomada, registrar evidencia e hash.'],
          ].map(([title, text]) => (
            <div key={title} className="rounded-xl border border-white/[0.055] bg-black/20 p-3">
              <p className="text-[11px] font-semibold text-white/65">{title}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-white/30">{text}</p>
            </div>
          ))}
        </div>
        <button
          onClick={onConfigureRules}
          className="mt-4 rounded-xl bg-gradient-to-r from-[#9945FF]/22 to-[#14F195]/18 px-4 py-2 text-xs font-semibold text-white/78 ring-1 ring-white/[0.08] transition-all hover:from-[#9945FF]/32 hover:to-[#14F195]/24"
        >
          Configurar primeira regra
        </button>
      </div>
    </div>
  );
}

export default function AgentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loopStatus, setLoopStatus] = useState<any>(null);
  const [loopWorkstream, setLoopWorkstream] = useState<LoopWorkEvent[]>([]);
  const [loopBusy, setLoopBusy] = useState(false);
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'decisions' | 'rules' | 'solana'>('decisions');
  const loopTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Editable fields
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [personality, setPersonality] = useState('');
  const [model, setModel] = useState('gpt');

  function clearLoopTimers() {
    loopTimersRef.current.forEach(timer => clearTimeout(timer));
    loopTimersRef.current = [];
  }

  function startVisualWorkstream(command: string) {
    if (!agent) return;
    clearLoopTimers();
    setActiveTab('decisions');
    setLoopBusy(true);
    const events = buildLoopWorkstream(agent, command);
    setLoopWorkstream(events);

    events.slice(1).forEach((event, index) => {
      const timer = setTimeout(() => {
        setLoopWorkstream(prev => prev.map(item => {
          if (item.id === event.id) return { ...item, status: 'running' };
          const currentIndex = events.findIndex(step => step.id === item.id);
          return currentIndex < index + 1 && item.status !== 'error'
            ? { ...item, status: 'complete' }
            : item;
        }));
      }, 650 + index * 720);
      loopTimersRef.current.push(timer);
    });
  }

  function finishVisualWorkstream(successful: boolean, detail?: string) {
    clearLoopTimers();
    setLoopBusy(false);
    setLoopWorkstream(prev => prev.map((event, index) => {
      if (!successful && index === prev.length - 1) {
        return { ...event, status: 'error', detail: detail || event.detail };
      }
      return {
        ...event,
        status: successful ? 'complete' : event.status === 'running' ? 'error' : event.status,
        detail: successful && index === prev.length - 1 && detail ? detail : event.detail,
      };
    }));
  }

  useEffect(() => {
    return () => {
      loopTimersRef.current.forEach(timer => clearTimeout(timer));
      loopTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    async function fetchAgent() {
      try {
        const res = await fetch(`/api/agents/${id}`);
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (data.agent) {
          const a = data.agent;
          setAgent(a);
          setName(a.name);
          setGoal(a.goal);
          setPersonality(a.personality);
          setModel(a.model);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchAgent();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const pollLoop = () => {
      fetch(`/api/agents/${id}/loop`)
        .then(r => r.json())
        .then(setLoopStatus)
        .catch(() => {});
    };
    pollLoop();
    const interval = setInterval(pollLoop, 5000);
    return () => clearInterval(interval);
  }, [id]);

  async function handleSave() {
    if (!agent) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          goal: goal.trim(),
          personality: personality.trim(),
          model,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao salvar o agente.');
        setSaving(false);
        return;
      }

      setAgent(data.agent);
      setSuccess('Agente salvo com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLoop(command: string, intervalMs?: number) {
    if (!agent) return;
    if (command === 'start' || command === 'trigger') {
      startVisualWorkstream(command);
    }
    try {
      const res = await fetch(`/api/agents/${agent.id}/loop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, intervalMs }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao controlar loop');
      }

      if (data.status) {
        setLoopStatus(data.status);
      } else if (data.result) {
        setLoopStatus((prev: any) => ({
          ...(prev || {}),
          agentId: agent.id,
          isRunning: prev?.isRunning || false,
          lastRun: data.result.timestamp,
          totalRuns: (prev?.totalRuns || 0) + 1,
          totalDecisions: (prev?.totalDecisions || 0) + (data.result.decisions || 0),
          lastInsight: data.result.insight || prev?.lastInsight || '',
        }));
      } else {
        setLoopStatus(data);
      }

      if (command === 'start' || command === 'trigger') {
        const decisions = data.result?.decisions ?? data.status?.totalDecisions ?? 0;
        finishVisualWorkstream(true, decisions > 0
          ? `${decisions} decisao(oes) registradas. A timeline foi atualizada.`
          : 'Ciclo concluido sem acao: crie uma regra ativa para dizer quando o agente deve agir.'
        );
        setTimelineRefreshKey(prev => prev + 1);
      }

      if (command === 'stop') {
        clearLoopTimers();
        setLoopBusy(false);
        setLoopWorkstream(prev => prev.length
          ? prev.map(event => event.status === 'running' ? { ...event, status: 'complete', detail: 'Loop interrompido pelo usuario.' } : event)
          : [{
              id: 'stopped',
              title: 'Loop interrompido',
              detail: 'O agente parou de executar ciclos automaticos.',
              source: 'Agent Runtime',
              status: 'complete',
              timestamp: Date.now(),
            }]
        );
      }

      setSuccess(data.message || '');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      finishVisualWorkstream(false, err instanceof Error ? err.message : 'Erro ao controlar loop');
      setError('Erro ao controlar loop');
    }
  }

  async function handleDelete() {
    if (!agent) return;
    setDeleting(true);
    setError('');

    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao excluir o agente.');
        setDeleting(false);
        setShowDeleteConfirm(false);
        return;
      }

      router.push('/agents');
    } catch {
      setError('Erro de conexão. Tente novamente.');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/30" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Bot className="h-12 w-12 text-white/10" />
        <p className="text-sm text-white/40">Agente não encontrado</p>
        <button
          onClick={() => router.push('/agents')}
          className="text-sm text-[#9945FF] hover:text-[#9945FF]/80"
        >
          Voltar para Agentes
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/agents')}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white/60"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-[#9945FF]/20 to-[#00D1FF]/20 p-3">
                <Bot className="h-6 w-6 text-[#9945FF]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white/90">{agent.name}</h1>
                <p className="text-sm text-white/30">Criado em {new Date(agent.createdAt).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeploy(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#00D1FF] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#9945FF]/20 transition-all hover:shadow-[#9945FF]/30"
              >
                <Rocket className="h-4 w-4" />
                <span className="hidden sm:inline">Implantar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-center">
            <Zap className="mx-auto mb-1.5 h-5 w-5 text-[#00D1FF]" />
            <p className="text-lg font-bold text-white/80">{agent.totalInteractions}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/30">Interações</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-center">
            <Wrench className="mx-auto mb-1.5 h-5 w-5 text-[#9945FF]" />
            <p className="text-lg font-bold text-white/80">{agent.memoryCount}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/30">Memórias</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-center">
            {agent.isDeployed ? (
              <>
                <Shield className="mx-auto mb-1.5 h-5 w-5 text-[#14F195]" />
                <p className="text-lg font-bold text-[#14F195]">Ativo</p>
              </>
            ) : (
              <>
                <Shield className="mx-auto mb-1.5 h-5 w-5 text-white/20" />
                <p className="text-lg font-bold text-white/30">Inativo</p>
              </>
            )}
            <p className="text-[10px] uppercase tracking-wider text-white/30">Status</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-center">
            {agent.deployTarget === 'telegram' ? (
              <Send className="mx-auto mb-1.5 h-5 w-5 text-[#00D1FF]" />
            ) : agent.deployTarget === 'whatsapp' ? (
              <MessageCircle className="mx-auto mb-1.5 h-5 w-5 text-[#14F195]" />
            ) : (
              <Send className="mx-auto mb-1.5 h-5 w-5 text-white/20" />
            )}
            <p className="text-lg font-bold text-white/80 capitalize">{agent.deployTarget || 'Nenhum'}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/30">Canal</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Edit section */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6">
            <h2 className="mb-4 text-sm font-semibold text-white/60 uppercase tracking-wider">Configurações</h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/40">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/90 placeholder:text-white/20 outline-none transition-colors focus:border-[#9945FF]/40 focus:bg-white/[0.06]"
                />
              </div>

              {/* Goal */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/40">Objetivo</label>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/90 placeholder:text-white/20 outline-none transition-colors focus:border-[#9945FF]/40 focus:bg-white/[0.06]"
                />
              </div>

              {/* Personality */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/40">Personalidade</label>
                <textarea
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/90 placeholder:text-white/20 outline-none transition-colors focus:border-[#9945FF]/40 focus:bg-white/[0.06]"
                />
              </div>

              {/* Model */}
              <div>
                <label className="mb-2 block text-xs font-medium text-white/40">Modelo</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {MODELS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setModel(m.key)}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                        model === m.key
                          ? m.color
                          : 'border-white/[0.06] bg-white/[0.03] text-white/40 hover:bg-white/[0.05]'
                      }`}
                    >
                      <Cpu className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{m.name}</span>
                      {model === m.key && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tools display */}
              <div>
                <label className="mb-2 block text-xs font-medium text-white/40">Ferramentas Ativas</label>
                <div className="flex flex-wrap gap-2">
                  {agent.tools.map((tool) => (
                    <span
                      key={tool}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${TOOL_COLORS[tool] || 'bg-white/5 text-white/40 border-white/[0.06]'}`}
                    >
                      <Wrench className="h-3 w-3" />
                      {TOOL_NAMES[tool] || tool}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Context Visualization */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6">
            <h2 className="mb-4 text-sm font-semibold text-white/60 uppercase tracking-wider">Memórias Relevantes</h2>
            <ContextVisualization memories={MOCK_MEMORIES} />
          </div>

          {/* Autonomous Agent — Decisions & Rules */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
            {/* Header with loop control */}
            <div className="flex items-center justify-between p-4 border-b border-white/[0.04]">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#9945FF]/20 to-[#14F195]/20">
                  <Zap className="h-4 w-4 text-[#9945FF]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Agente Autonomo</h2>
                  <p className="text-[10px] text-white/25">Ler → Decidir → Agir → Salvar</p>
                </div>
              </div>

              {/* Loop controls */}
              <div className="flex items-center gap-2">
                {loopStatus?.isRunning ? (
                  <>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#14F195]/10 border border-[#14F195]/20">
                      <div className="h-2 w-2 rounded-full bg-[#14F195] animate-pulse" />
                      <span className="text-[10px] text-[#14F195]/70">Loop ativo</span>
                    </div>
                    <button
                      onClick={() => handleLoop('stop')}
                      disabled={loopBusy}
                      className="px-3 py-1.5 rounded-lg border border-red-500/20 text-[11px] text-red-400 hover:bg-red-500/5 transition-colors"
                    >
                      Parar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleLoop('start', 30000)}
                    disabled={loopBusy}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#9945FF]/20 to-[#14F195]/20 border border-[#9945FF]/20 text-[11px] text-[#9945FF]/80 hover:from-[#9945FF]/30 hover:to-[#14F195]/30 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loopBusy ? 'Executando...' : 'Iniciar Loop (30s)'}
                  </button>
                )}
                <button
                  onClick={() => handleLoop('trigger')}
                  disabled={loopBusy}
                  className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-[11px] text-white/40 hover:bg-white/[0.04] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loopBusy ? 'Rodando...' : 'Executar Agora'}
                </button>
              </div>
            </div>

            {/* Loop stats */}
            {loopStatus && (loopStatus.isRunning || loopStatus.totalRuns > 0) && (
              <div className="grid grid-cols-3 gap-px bg-white/[0.04] border-b border-white/[0.04]">
                <div className="bg-[#0a0a14] px-4 py-3 text-center">
                  <p className="text-sm font-bold text-white/70">{loopStatus.totalRuns}</p>
                  <p className="text-[9px] text-white/25 uppercase">Ciclos</p>
                </div>
                <div className="bg-[#0a0a14] px-4 py-3 text-center">
                  <p className="text-sm font-bold text-[#14F195]/80">{loopStatus.totalDecisions}</p>
                  <p className="text-[9px] text-white/25 uppercase">Decisoes</p>
                </div>
                <div className="bg-[#0a0a14] px-4 py-3 text-center">
                  <p className="text-sm font-bold text-white/70">{formatLoopAge(loopStatus.lastRun)}</p>
                  <p className="text-[9px] text-white/25 uppercase">Ultimo Run</p>
                </div>
              </div>
            )}

            {(!loopStatus || (loopStatus.totalDecisions || 0) === 0) && (
              <AutonomyPurposePanel onConfigureRules={() => setActiveTab('rules')} />
            )}

            <LoopWorkstreamPanel
              events={loopWorkstream}
              isBusy={loopBusy}
              loopStatus={loopStatus}
            />

            {/* Tabs: Decisions / Rules / Solana */}
            <div className="flex border-b border-white/[0.04]">
              {[
                { key: 'decisions', label: 'Timeline' },
                { key: 'rules',     label: 'Regras' },
                { key: 'solana',    label: '⚡ Solana' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex-1 px-4 py-3 text-xs font-medium transition-all ${
                    activeTab === tab.key
                      ? 'text-[#9945FF] border-b-2 border-[#9945FF]'
                      : 'text-white/30 hover:text-white/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-4">
              {activeTab === 'decisions' && (
                <DecisionTimeline
                  key={timelineRefreshKey}
                  agentId={id}
                  onConfigureRules={() => setActiveTab('rules')}
                />
              )}
              {activeTab === 'rules'     && (
                <RuleBuilder
                  agentId={id}
                  agentName={agent.name}
                  agentGoal={agent.goal}
                  agentTools={agent.tools}
                />
              )}
              {activeTab === 'solana'    && <SolanaIntentPanel agentId={id} />}
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-[#14F195]/20 bg-[#14F195]/5 px-4 py-3 text-sm text-[#14F195]">
              {success}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/20 px-5 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/5 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {deleting ? 'Excluindo...' : 'Excluir Agente'}
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#00D1FF] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#9945FF]/20 transition-all hover:shadow-[#9945FF]/30 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>

          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
              <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0f0f1e] p-6">
                <h3 className="mb-2 text-base font-semibold text-white/90">Excluir Agente?</h3>
                <p className="mb-6 text-sm text-white/40">
                  Esta ação não pode ser desfeita. Todas as memórias e interações associadas a <span className="text-white/60">{agent.name}</span> serão perdidas.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-xl border border-white/[0.06] py-2.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/[0.04]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 rounded-xl bg-red-500/20 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/30"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deploy dialog */}
      <DeployDialog
        isOpen={showDeploy}
        onClose={() => setShowDeploy(false)}
        agentId={agent.id}
        agentName={agent.name}
      />
    </div>
  );
}
