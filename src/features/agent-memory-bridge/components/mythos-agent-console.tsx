'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronRight,
  Copy,
  Database,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from 'lucide-react';
import { MYTHOS_AGENT_PROFILE, MYTHOS_CAPABILITY_GROUPS, MYTHOS_CATEGORY_SKILL_INDEX, MYTHOS_FEATURED_SKILLS, MYTHOS_SKILL_CATEGORIES } from '../mythos';

type BridgeHealth = {
  ok?: boolean;
  service?: string;
  mode?: string;
  authRequiredForWrites?: boolean;
  sources?: string[];
  contentTypes?: string[];
  safety?: Record<string, boolean>;
};

type BridgeMemory = {
  hash: string;
  timestamp: string;
  source?: string;
  agent?: string;
  agentId?: string;
  contentType?: string;
  content?: string;
  vault?: string;
  readUrl?: string;
  verifyUrl?: string;
  proofUrl?: string;
  on_chain?: boolean;
  verified?: boolean;
  zkVerified?: boolean;
};

type ListResponse = {
  owner?: string;
  count?: number;
  memories?: BridgeMemory[];
  error?: string;
};

type MythosTerminalMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

const DEFAULT_TEST_MEMORY =
  'Mythos official bridge smoke test: context, observability and task memory are connected to CongChain with authenticated human-reviewed metadata.';

const MYTHOS_TERMINAL_PROMPTS = [
  {
    label: 'Analyze',
    prompt: 'Analise como o Mythos usa skills, memoria e CongChain em uma tarefa real.',
  },
  {
    label: 'Research',
    prompt: 'Explique como voce pesquisaria um tema e salvaria uma memoria verificavel na CongChain.',
  },
  {
    label: 'Reason',
    prompt: 'Raciocine sobre qual skill devo escolher para debugar uma API que retorna 401.',
  },
  {
    label: 'Create',
    prompt: 'Crie um plano curto para conectar um agente externo ao Agent Memory Bridge.',
  },
];

function shortHash(value: string, size = 10) {
  if (!value) return 'sem hash';
  return value.length > size ? `${value.slice(0, size)}...` : value;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function buildAuthHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
  };
}

export default function MythosAgentConsole() {
  const profile = MYTHOS_AGENT_PROFILE;
  const [health, setHealth] = useState<BridgeHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [agentId, setAgentId] = useState('mythos-local-test');
  const [testMemory, setTestMemory] = useState(DEFAULT_TEST_MEMORY);
  const [memories, setMemories] = useState<BridgeMemory[]>([]);
  const [owner, setOwner] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState('');
  const [selectedCapabilityId, setSelectedCapabilityId] = useState(MYTHOS_CAPABILITY_GROUPS[0]?.id || '');
  const [selectedCategory, setSelectedCategory] = useState('congchain');
  const [selectedSkillId, setSelectedSkillId] = useState(MYTHOS_FEATURED_SKILLS[0]?.id || '');
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalModel, setTerminalModel] = useState('nvidia');
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLoading, setTerminalLoading] = useState(false);
  const [terminalMessages, setTerminalMessages] = useState<MythosTerminalMessage[]>([
    {
      role: 'system',
      content:
        'Terminal Mythos pronto. Este teste usa providers configurados no backend da CongChain; nenhuma API key aparece no navegador.',
    },
  ]);

  const canUseKey = apiKey.trim().startsWith('cog_live_');
  const selectedCapability =
    MYTHOS_CAPABILITY_GROUPS.find(group => group.id === selectedCapabilityId) ||
    MYTHOS_CAPABILITY_GROUPS[0];
  const visibleSkills = MYTHOS_FEATURED_SKILLS.filter(skill => skill.category === selectedCategory);
  const selectedCategoryMeta = MYTHOS_SKILL_CATEGORIES.find(category => category.id === selectedCategory);
  const categorySkillIndex = MYTHOS_CATEGORY_SKILL_INDEX[selectedCategory as keyof typeof MYTHOS_CATEGORY_SKILL_INDEX] || [];
  const selectedSkill =
    MYTHOS_FEATURED_SKILLS.find(skill => skill.id === selectedSkillId) ||
    visibleSkills[0] ||
    MYTHOS_FEATURED_SKILLS[0];
  const hasTerminalConversation = terminalMessages.some(item => item.role !== 'system');

  const setupSnippet = useMemo(() => {
    return [
      'CONGCHAIN_API_URL=https://cognchain-program-production.up.railway.app',
      'CONGCHAIN_API_KEY=cog_live_sua_key_completa',
      `CONGCHAIN_AGENT_ID=${agentId || 'mythos-local-test'}`,
      'mythos config set memory.provider congchain',
      'mythos plugins enable observability/congchain',
      'mythos config set context.engine congchain',
    ].join('\n');
  }, [agentId]);

  const payloadPreview = useMemo(() => ({
    content: testMemory,
    model: 'mythos',
    metadata: {
      source: 'mythos',
      contentType: 'mythos_memory',
      agentId: agentId || 'mythos-local-test',
      agentName: 'Mythos',
      origin: 'congchain-mythos-console',
      proofMode: 'none',
      anchorMode: 'none',
      safety: {
        containsSecrets: false,
        containsPrivateKeys: false,
        containsSignedPayloads: false,
        canMoveFunds: false,
        requiresHumanReview: true,
      },
    },
  }), [agentId, testMemory]);

  async function loadHealth() {
    setHealthLoading(true);
    try {
      const response = await fetch(profile.endpoints.health, { cache: 'no-store' });
      const data = await response.json();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }

  async function listMemories() {
    if (!canUseKey) {
      setMessage('Cole uma key cog_live completa para listar o vault Mythos.');
      return;
    }
    setLoadingList(true);
    setMessage('');
    try {
      const params = new URLSearchParams({ source: 'mythos', limit: '12' });
      if (agentId.trim()) params.set('agentId', agentId.trim());
      const response = await fetch(`${profile.endpoints.listMemories}?${params.toString()}`, {
        headers: buildAuthHeaders(apiKey),
        cache: 'no-store',
      });
      const data = await response.json() as ListResponse;
      if (!response.ok) throw new Error(data.error || 'Falha ao listar memorias Mythos.');
      setMemories(data.memories || []);
      setOwner(data.owner || '');
      setMessage(`${data.count || 0} memorias Mythos carregadas.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel listar memorias.');
    } finally {
      setLoadingList(false);
    }
  }

  async function writeTestMemory() {
    if (!canUseKey) {
      setMessage('Cole uma key cog_live completa antes de salvar uma memoria de teste.');
      return;
    }
    if (!testMemory.trim()) {
      setMessage('Escreva uma memoria de teste antes de enviar.');
      return;
    }
    setWriting(true);
    setMessage('');
    try {
      const response = await fetch(profile.endpoints.writeMemory, {
        method: 'POST',
        headers: buildAuthHeaders(apiKey),
        body: JSON.stringify(payloadPreview),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao salvar memoria Mythos.');
      setMessage(`Memoria Mythos salva: ${shortHash(data.hash, 18)}`);
      await listMemories();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar memoria Mythos.');
    } finally {
      setWriting(false);
    }
  }

  async function copyText(id: string, value: string) {
    await navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(id);
    window.setTimeout(() => setCopied(''), 1400);
  }

  async function sendTerminalMessage(prompt?: string) {
    const content = (prompt || terminalInput).trim();
    if (!content || terminalLoading) return;

    const userMessage: MythosTerminalMessage = { role: 'user', content };
    const nextMessages = [...terminalMessages, userMessage];
    setTerminalMessages(nextMessages);
    setTerminalInput('');
    setTerminalLoading(true);

    try {
      const response = await fetch('/api/mythos/test-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: terminalModel,
          messages: nextMessages
            .filter(item => item.role !== 'system')
            .map(item => ({ role: item.role, content: item.content })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao chamar terminal Mythos.');
      setTerminalMessages(current => [
        ...current,
        {
          role: 'assistant',
          content: data.response || 'Mythos respondeu sem conteudo.',
        },
      ]);
    } catch (error) {
      setTerminalMessages(current => [
        ...current,
        {
          role: 'system',
          content: error instanceof Error ? error.message : 'Nao foi possivel testar o Mythos agora.',
        },
      ]);
    } finally {
      setTerminalLoading(false);
    }
  }

  useEffect(() => {
    loadHealth();
  }, []);

  return (
    <main className="min-h-screen bg-[#05050b] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <a href="/" className="text-sm text-white/45 transition hover:text-white/80">
            Voltar ao Chat
          </a>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsTerminalOpen(value => !value)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#76FF03]/25 bg-[#76FF03]/12 px-3 py-2 text-xs font-bold text-[#A7FF3D] transition hover:bg-[#76FF03]/18"
            >
              <TerminalSquare className="h-4 w-4" />
              {isTerminalOpen ? 'Fechar teste' : 'Testar Mythos'}
            </button>
            <a href="/brain" className="inline-flex items-center gap-2 rounded-xl border border-[#14F195]/20 bg-[#14F195]/10 px-3 py-2 text-xs font-bold text-[#14F195] transition hover:bg-[#14F195]/15">
              <Brain className="h-4 w-4" />
              Memory Brain
            </a>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#76FF03]/25 bg-[radial-gradient(circle_at_top_left,rgba(118,255,3,0.12),transparent_34%),linear-gradient(135deg,rgba(12,20,14,0.96),rgba(7,7,16,0.98))]">
          <div className="grid gap-6 p-5 lg:grid-cols-[220px_1fr] lg:p-7">
            <div className="flex items-center justify-center">
              <div className="relative h-44 w-44 overflow-hidden rounded-full border border-[#76FF03]/35 bg-black shadow-[0_0_50px_rgba(118,255,3,0.18)]">
                <img src={profile.image} alt="" className="h-full w-full object-cover" />
              </div>
            </div>
            <div className="flex flex-col justify-center gap-5">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#76FF03]/25 bg-[#76FF03]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#A7FF3D]">
                    {profile.label}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                    Agent Memory Bridge
                  </span>
                </div>
                <h1 className="text-3xl font-black tracking-[-0.01em] text-white sm:text-5xl">Mythos Agent Bridge</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/58 sm:text-base">
                  {profile.summary} Esta aba e o cockpit oficial para conectar Mythos a CongChain com key autenticada, memoria isolada por agente e trilha auditavel.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ['skills', 'Skills', profile.counts.skills],
                  ['memory', 'Memory providers', profile.counts.memoryProvidersWithCongChain],
                  ['llm', 'LLM providers', profile.counts.llmProviders],
                  ['platforms', 'Plataformas', profile.counts.messagePlatforms],
                  ['lsp', 'LSPs', profile.counts.languageServers],
                  ['tools', 'Tool files', profile.counts.toolFiles],
                ].map(([id, label, value]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      if (id !== 'skills') setSelectedCapabilityId(String(id));
                    }}
                    className={`rounded-xl border p-3 text-left transition ${
                      id !== 'skills' && selectedCapabilityId === id
                        ? 'border-[#76FF03]/35 bg-[#76FF03]/10'
                        : 'border-white/8 bg-black/25 hover:border-white/14 hover:bg-white/[0.04]'
                    }`}
                  >
                    <p className="text-2xl font-black text-white">{value}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">{label}</p>
                    <p className="mt-2 text-[10px] text-white/28">{id === 'skills' ? 'ver abaixo' : 'clique para entender'}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {isTerminalOpen && (
          <section className="overflow-hidden rounded-[28px] border border-[#76FF03]/18 bg-[#020402] shadow-[0_0_80px_rgba(118,255,3,0.08)]">
            <div className="grid min-h-[760px] lg:grid-cols-[300px_1fr]">
              <aside className="relative flex flex-col border-b border-white/8 bg-[linear-gradient(180deg,rgba(6,12,6,0.92),rgba(0,0,0,0.98))] p-5 lg:border-b-0 lg:border-r">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_5%,rgba(118,255,3,0.16),transparent_28%)]" />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 overflow-hidden rounded-full border border-[#76FF03]/34 bg-black shadow-[0_0_28px_rgba(118,255,3,0.22)]">
                      <img src={profile.image} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <p className="text-xl font-black uppercase tracking-[0.28em] text-[#A7FF3D]">Mythos</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">The 1st autonomous external agent</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTerminalMessages([{ role: 'system', content: 'Nova conversa Mythos iniciada. Nenhuma memoria e salva automaticamente neste terminal.' }])}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-[#A7FF3D] transition hover:bg-[#76FF03]/10"
                    aria-label="Nova conversa Mythos"
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setTerminalMessages([{ role: 'system', content: 'Nova conversa Mythos iniciada. Nenhuma memoria e salva automaticamente neste terminal.' }])}
                  className="relative mt-8 inline-flex h-14 items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.055] px-4 text-sm font-bold text-white/80 transition hover:border-[#76FF03]/20 hover:bg-[#76FF03]/8"
                >
                  <TerminalSquare className="h-5 w-5 text-white/78" />
                  New Conversation
                </button>

                <div className="relative mt-8">
                  <p className="text-sm text-white/42">Today</p>
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl px-1 text-sm text-white/72">
                    <span>Welcome to Mythos</span>
                    <span className="text-white/35">...</span>
                  </div>
                </div>

                <div className="relative mt-8 rounded-2xl border border-white/8 bg-black/28 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A7FF3D]">Safe test mode</p>
                  <p className="mt-2 text-xs leading-5 text-white/45">
                    O teste usa o backend da CongChain. Keys ficam no servidor, nao no navegador.
                  </p>
                  <select
                    value={terminalModel}
                    onChange={event => setTerminalModel(event.target.value)}
                    className="mt-4 w-full rounded-xl border border-white/10 bg-black/45 px-3 py-2.5 text-sm text-white outline-none focus:border-[#76FF03]/35"
                  >
                    <option value="nvidia">NVIDIA</option>
                    <option value="glm">GLM-4.7</option>
                    <option value="minimax">MiniMax</option>
                    <option value="qwen">Qwen</option>
                  </select>
                </div>

                <div className="relative mt-auto pt-8">
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/35 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 overflow-hidden rounded-full border border-[#76FF03]/25 bg-black">
                        <img src={profile.image} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">Mythos</p>
                        <p className="text-xs text-white/50"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#76FF03]" />ONLINE</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/35" />
                  </div>
                </div>
              </aside>

              <div className="relative flex min-h-[760px] flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_12%,rgba(118,255,3,0.16),transparent_28%),linear-gradient(180deg,rgba(2,4,2,0.98),rgba(0,0,0,0.99))]">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(118,255,3,0.03)_1px,transparent_1px),linear-gradient(180deg,rgba(118,255,3,0.025)_1px,transparent_1px)] bg-[size:90px_90px] opacity-20" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_center,rgba(118,255,3,0.18),transparent_52%)] blur-2xl" />

                <div className="relative flex flex-1 flex-col items-center px-5 py-8">
                  {!hasTerminalConversation && (
                    <div className="flex w-full flex-1 flex-col items-center justify-center">
                      <div className="relative h-64 w-64 sm:h-80 sm:w-80">
                        <div className="absolute inset-4 rounded-full border border-[#76FF03]/18 shadow-[0_0_80px_rgba(118,255,3,0.16)]" />
                        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(118,255,3,0.14),transparent_64%)]" />
                        <img src={profile.image} alt="" className="relative h-full w-full rounded-full object-cover opacity-95 mix-blend-screen" />
                      </div>
                      <h2 className="mt-6 text-center text-4xl font-black uppercase tracking-[0.38em] text-[#A7FF3D] sm:text-5xl">Mythos</h2>
                      <p className="mt-3 text-center text-xs font-bold uppercase tracking-[0.22em] text-white/45 sm:text-sm">
                        The 1st autonomous external agent
                      </p>
                    </div>
                  )}

                  {hasTerminalConversation && (
                    <div className="w-full flex-1 overflow-y-auto py-2">
                      <div className="mx-auto flex max-w-3xl flex-col gap-3">
                        {terminalMessages.map((item, index) => (
                          <div
                            key={`${item.role}-${index}`}
                            className={`rounded-2xl border px-4 py-3 text-sm leading-6 backdrop-blur ${
                              item.role === 'user'
                                ? 'ml-auto max-w-[85%] border-[#76FF03]/26 bg-[#76FF03]/12 text-white'
                                : item.role === 'assistant'
                                  ? 'mr-auto max-w-[92%] border-white/8 bg-white/[0.055] text-white/74'
                                  : 'mx-auto max-w-[92%] border-[#5AD7FF]/14 bg-[#5AD7FF]/8 text-white/52'
                            }`}
                          >
                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/32">
                              {item.role === 'user' ? 'Voce' : item.role === 'assistant' ? 'Mythos' : 'Sistema'}
                            </p>
                            <p className="whitespace-pre-wrap">{item.content}</p>
                          </div>
                        ))}
                        {terminalLoading && (
                          <div className="mr-auto inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.055] px-4 py-3 text-sm text-white/55">
                            <Loader2 className="h-4 w-4 animate-spin text-[#76FF03]" />
                            Mythos pensando...
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="w-full max-w-3xl">
                    <div className="rounded-[26px] border border-[#76FF03]/28 bg-black/48 p-4 shadow-[0_0_40px_rgba(118,255,3,0.08)] backdrop-blur-xl">
                      <textarea
                        value={terminalInput}
                        onChange={event => setTerminalInput(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            sendTerminalMessage();
                          }
                        }}
                        rows={3}
                        placeholder="Message Mythos..."
                        className="w-full resize-none bg-transparent px-1 text-base leading-6 text-white outline-none placeholder:text-white/34"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-white/42">
                          <span className="text-xl leading-none">⌘</span>
                          <span className="text-[11px]">Backend demo, no exposed keys</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => sendTerminalMessage()}
                          disabled={!terminalInput.trim() || terminalLoading}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/80 text-black transition hover:bg-[#A7FF3D] disabled:cursor-not-allowed disabled:opacity-45"
                          aria-label="Enviar mensagem ao Mythos"
                        >
                          {terminalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                      {MYTHOS_TERMINAL_PROMPTS.map(item => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => sendTerminalMessage(item.prompt)}
                          disabled={terminalLoading}
                          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-black/28 px-5 text-sm font-semibold text-white/74 transition hover:border-[#76FF03]/25 hover:bg-[#76FF03]/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Sparkles className="h-4 w-4 text-[#A7FF3D]" />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="mt-10 text-center text-xs text-white/35">
                    Mythos can make mistakes. Verify important information.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-[#5AD7FF]/14 bg-white/[0.025] p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#5AD7FF]">Mapa de capacidades</p>
              <h2 className="mt-1 text-2xl font-black">O que esses numeros significam na pratica</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/48">
                Selecione uma area para ver exemplos, como configurar e quais limites de seguranca precisam ficar claros antes de ligar o Mythos em producao.
              </p>
            </div>
            <a href="/dashboard/keys" className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#76FF03]/20 bg-[#76FF03]/10 px-3 text-xs font-bold text-[#A7FF3D] transition hover:bg-[#76FF03]/15">
              <KeyRound className="h-4 w-4" />
              Criar key
            </a>
          </div>

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {MYTHOS_CAPABILITY_GROUPS.map(group => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedCapabilityId(group.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    selectedCapability?.id === group.id
                      ? 'border-[#5AD7FF]/35 bg-[#5AD7FF]/10'
                      : 'border-white/8 bg-black/20 hover:border-white/14 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black text-white">{group.label}</span>
                    <span className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-0.5 text-[10px] font-bold text-white/55">
                      {group.count}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/43">{group.headline}</p>
                </button>
              ))}
            </div>

            {selectedCapability && (
              <div className="rounded-2xl border border-white/8 bg-black/22 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5AD7FF]">{selectedCapability.label}</p>
                    <h3 className="mt-2 text-xl font-black text-white">{selectedCapability.headline}</h3>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-white/52">{selectedCapability.explanation}</p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.035] px-4 py-3 text-right">
                    <p className="text-2xl font-black text-white">{selectedCapability.count}</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">itens</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_320px]">
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Exemplos incluidos</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedCapability.items.map(item => (
                        <span
                          key={item}
                          className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-semibold text-white/62"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#76FF03]/16 bg-[#76FF03]/[0.055] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A7FF3D]">Como fazer</p>
                    <div className="mt-3 space-y-2">
                      {selectedCapability.howToUse.map((step, index) => (
                        <div key={step} className="flex gap-2 text-xs leading-5 text-white/58">
                          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-[#76FF03]/20 bg-[#76FF03]/10 text-[10px] font-black text-[#A7FF3D]">
                            {index + 1}
                          </span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2 rounded-xl border border-[#FACC15]/16 bg-[#FACC15]/[0.045] p-3 text-xs leading-5 text-white/52">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#FACC15]" />
                  <span>{selectedCapability.safety}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#76FF03]/18 bg-[linear-gradient(135deg,rgba(118,255,3,0.055),rgba(255,255,255,0.025))] p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#76FF03]">Biblioteca de skills</p>
              <h2 className="mt-1 text-2xl font-black">Escolha a skill pelo trabalho que o Mythos vai fazer</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
                O Mythos tem 168 skills no catalogo. Esta tela organiza as principais por objetivo para voce entender qual usar antes de conectar o agente externo.
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/25 px-4 py-3 text-right">
              <p className="text-2xl font-black text-white">{profile.counts.skills}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">skills auditadas</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[260px_1fr_360px]">
            <div className="space-y-2">
              {MYTHOS_SKILL_CATEGORIES.map(category => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(category.id);
                    const firstSkill = MYTHOS_FEATURED_SKILLS.find(skill => skill.category === category.id);
                    if (firstSkill) setSelectedSkillId(firstSkill.id);
                  }}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedCategory === category.id
                      ? 'border-[#76FF03]/35 bg-[#76FF03]/12'
                      : 'border-white/8 bg-black/20 hover:border-white/14 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black text-white">{category.label}</span>
                    <span className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-0.5 text-[10px] font-bold text-white/55">
                      {category.count}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/43">{category.summary}</p>
                </button>
              ))}
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-white/80">
                  {selectedCategoryMeta?.label || 'Skills'}
                </p>
                <p className="text-xs text-white/36">
                  Mostrando {visibleSkills.length} de {selectedCategoryMeta?.count || categorySkillIndex.length} skills principais
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {visibleSkills.map(skill => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => setSelectedSkillId(skill.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      selectedSkill?.id === skill.id
                        ? 'border-[#76FF03]/35 bg-[#76FF03]/10 shadow-[0_0_28px_rgba(118,255,3,0.08)]'
                        : 'border-white/8 bg-black/22 hover:border-[#76FF03]/18 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-white/45">
                        {skill.level}
                      </span>
                      <span className="text-[10px] font-bold text-[#76FF03]/70">{skill.status}</span>
                    </div>
                    <p className="text-sm font-black text-white">{skill.name}</p>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/47">{skill.useCase}</p>
                    <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-[#5AD7FF]/75">
                      Ver uso
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/8 bg-black/18 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Todas da categoria</p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {selectedCategoryMeta?.count || categorySkillIndex.length} skills {selectedCategoryMeta?.label || ''}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[10px] font-bold text-white/50">
                    catalogo
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {categorySkillIndex.map((skillName, index) => {
                    const highlighted = visibleSkills.some(skill => skill.name === skillName);
                    return (
                      <div
                        key={`${skillName}-${index}`}
                        className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                          highlighted
                            ? 'border-[#76FF03]/20 bg-[#76FF03]/8'
                            : 'border-white/8 bg-white/[0.025]'
                        }`}
                      >
                        <span className="truncate text-xs font-semibold text-white/68">{skillName}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] ${
                          highlighted
                            ? 'bg-[#76FF03]/12 text-[#A7FF3D]'
                            : 'bg-white/[0.055] text-white/32'
                        }`}>
                          {highlighted ? 'card' : 'lista'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {selectedSkill && (
              <aside className="rounded-2xl border border-[#5AD7FF]/16 bg-[#5AD7FF]/[0.045] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5AD7FF]">Skill selecionada</p>
                <h3 className="mt-2 text-xl font-black text-white">{selectedSkill.name}</h3>
                <p className="mt-3 text-sm leading-6 text-white/55">{selectedSkill.bestFor}</p>

                <div className="mt-4 rounded-xl border border-white/8 bg-black/25 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Caminho</p>
                  <p className="mt-2 break-all font-mono text-xs text-white/68">{selectedSkill.path}</p>
                </div>

                <div className="mt-3 rounded-xl border border-white/8 bg-black/25 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Como usar no Mythos</p>
                  <pre className="mt-2 overflow-x-auto text-xs leading-5 text-white/68"><code>{selectedSkill.command}</code></pre>
                </div>

                <button
                  type="button"
                  onClick={() => copyText(`skill-${selectedSkill.id}`, selectedSkill.command)}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#5AD7FF]/20 bg-[#5AD7FF]/10 px-3 text-xs font-bold text-[#7DE4FF] transition hover:bg-[#5AD7FF]/15"
                >
                  <Copy className="h-4 w-4" />
                  {copied === `skill-${selectedSkill.id}` ? 'Comando copiado' : 'Copiar comando da skill'}
                </button>

                <div className="mt-4 space-y-2 border-t border-white/8 pt-4">
                  {[
                    'A selecao aqui nao executa a skill automaticamente.',
                    'Use a skill dentro do Mythos com uma key CongChain ativa.',
                    'Memorias criadas pela skill devem respeitar o filtro anti-segredos.',
                  ].map(item => (
                    <div key={item} className="flex gap-2 text-xs leading-5 text-white/50">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#14F195]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </aside>
            )}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#14F195]">Contrato vivo</p>
                <h2 className="mt-1 text-xl font-black">Status da ponte</h2>
              </div>
              <button
                onClick={loadHealth}
                disabled={healthLoading}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-bold text-white/70 transition hover:bg-white/[0.06] disabled:opacity-50"
              >
                {healthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Atualizar
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-[#14F195]/18 bg-[#14F195]/8 p-4">
                <CheckCircle2 className="mb-3 h-5 w-5 text-[#14F195]" />
                <p className="text-sm font-bold">Health</p>
                <p className="mt-1 text-xs text-white/45">{health?.ok ? 'online' : healthLoading ? 'verificando' : 'indisponivel'}</p>
              </div>
              <div className="rounded-xl border border-[#5AD7FF]/18 bg-[#5AD7FF]/8 p-4">
                <KeyRound className="mb-3 h-5 w-5 text-[#5AD7FF]" />
                <p className="text-sm font-bold">Writes</p>
                <p className="mt-1 text-xs text-white/45">{health?.authRequiredForWrites ? 'API key obrigatoria' : 'verificar config'}</p>
              </div>
              <div className="rounded-xl border border-[#9945FF]/18 bg-[#9945FF]/8 p-4">
                <ShieldCheck className="mb-3 h-5 w-5 text-[#B768FF]" />
                <p className="text-sm font-bold">Modo</p>
                <p className="mt-1 text-xs text-white/45">{health?.mode || 'compat'}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {profile.contracts.map(item => (
                <div key={item.name} className="rounded-xl border border-white/8 bg-black/20 p-4">
                  <p className="text-sm font-bold text-white">{item.name}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#FACC15]">{item.status}</p>
                  <p className="mt-3 text-xs leading-5 text-white/45">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#FACC15]/18 bg-[#FACC15]/[0.045] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-[#FACC15]" />
              <div>
                <p className="text-sm font-black text-white">Auditoria do Mythos atual</p>
                <p className="mt-2 text-xs leading-5 text-white/52">
                  O pacote do Mythos ja tem plugins CongChain, mas eles usam o contrato antigo por vault. A versao correta para producao deve usar <span className="font-mono text-[#FACC15]">Authorization: Bearer cog_live_...</span>.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {profile.safety.map(item => (
                <div key={item} className="flex gap-2 text-xs leading-5 text-white/52">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#14F195]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#76FF03]">Teste local seguro</p>
            <h2 className="mt-1 text-xl font-black">Conectar key Mythos</h2>
            <p className="mt-2 text-xs leading-5 text-white/45">
              A key nao e salva nesta tela. Ela existe so enquanto a aba esta aberta para listar ou criar uma memoria de teste.
            </p>

            <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">CongChain API key</label>
            <input
              value={apiKey}
              onChange={event => setApiKey(event.target.value)}
              placeholder="cog_live_..."
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 font-mono text-xs text-white outline-none transition placeholder:text-white/20 focus:border-[#76FF03]/40"
            />

            <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Agent ID</label>
            <input
              value={agentId}
              onChange={event => setAgentId(event.target.value)}
              placeholder="mythos-local-test"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#76FF03]/40"
            />

            <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Memoria de teste</label>
            <textarea
              value={testMemory}
              onChange={event => setTestMemory(event.target.value)}
              rows={5}
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm leading-5 text-white outline-none transition placeholder:text-white/20 focus:border-[#76FF03]/40"
            />

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={listMemories}
                disabled={loadingList || !canUseKey}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#5AD7FF]/20 bg-[#5AD7FF]/10 px-3 text-xs font-bold text-[#7DE4FF] transition hover:bg-[#5AD7FF]/15 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                Listar
              </button>
              <button
                onClick={writeTestMemory}
                disabled={writing || !canUseKey}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#76FF03]/25 bg-[#76FF03]/12 px-3 text-xs font-bold text-[#A7FF3D] transition hover:bg-[#76FF03]/18 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {writing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Salvar teste
              </button>
            </div>

            {message && (
              <p className="mt-3 rounded-xl border border-white/8 bg-black/25 px-3 py-2 text-xs leading-5 text-white/58">{message}</p>
            )}
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#B768FF]">Mythos Obsidian</p>
                <h2 className="mt-1 text-xl font-black">Memorias recentes</h2>
                <p className="mt-1 text-xs text-white/42">{owner ? `Vault de ${owner}` : 'Cole a key para carregar memorias do Mythos.'}</p>
              </div>
              <button
                onClick={() => copyText('snippet', setupSnippet)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-bold text-white/70 transition hover:bg-white/[0.06]"
              >
                <Copy className="h-4 w-4" />
                {copied === 'snippet' ? 'Copiado' : 'Copiar setup'}
              </button>
            </div>

            {memories.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {memories.map(memory => (
                  <article key={memory.hash} className="rounded-xl border border-[#76FF03]/16 bg-[linear-gradient(180deg,rgba(118,255,3,0.08),rgba(0,0,0,0.18))] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="rounded-full border border-[#76FF03]/20 bg-[#76FF03]/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#A7FF3D]">
                        {memory.contentType || 'mythos_memory'}
                      </span>
                      <span className="text-[10px] text-white/32">{formatDate(memory.timestamp)}</span>
                    </div>
                    <p className="text-sm font-bold text-white">{memory.agent || 'Mythos'}</p>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/50">{memory.content || 'Sem preview disponivel.'}</p>
                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/8 pt-3">
                      <button
                        onClick={() => copyText(memory.hash, memory.hash)}
                        className="font-mono text-[11px] text-white/45 transition hover:text-white"
                      >
                        {copied === memory.hash ? 'hash copiado' : shortHash(memory.hash, 16)}
                      </button>
                      <div className="flex items-center gap-2">
                        {memory.readUrl && <a href={memory.readUrl} target="_blank" className="text-white/35 transition hover:text-[#5AD7FF]" aria-label="Abrir memoria"><ExternalLink className="h-4 w-4" /></a>}
                        {memory.verifyUrl && <a href={memory.verifyUrl} target="_blank" className="text-white/35 transition hover:text-[#76FF03]" aria-label="Verificar memoria"><ShieldCheck className="h-4 w-4" /></a>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 text-center">
                <Sparkles className="h-8 w-8 text-[#76FF03]/50" />
                <p className="mt-4 text-sm font-bold text-white">Nenhuma memoria Mythos carregada nesta aba.</p>
                <p className="mt-2 max-w-md text-xs leading-5 text-white/38">
                  Liste com uma key CongChain ou salve uma memoria de teste para ver o Obsidian externo aparecer aqui.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <div className="mb-3 flex items-center gap-2">
              <TerminalSquare className="h-5 w-5 text-[#5AD7FF]" />
              <h2 className="text-lg font-black">Setup para Mythos</h2>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-white/8 bg-black/35 p-4 text-xs leading-6 text-white/66"><code>{setupSnippet}</code></pre>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-[#B768FF]" />
                <h2 className="text-lg font-black">Payload auditado</h2>
              </div>
              <button
                onClick={() => copyText('payload', JSON.stringify(payloadPreview, null, 2))}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-bold text-white/60 transition hover:bg-white/[0.06]"
              >
                <Copy className="h-4 w-4" />
                {copied === 'payload' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <pre className="max-h-72 overflow-auto rounded-xl border border-white/8 bg-black/35 p-4 text-xs leading-5 text-white/60"><code>{JSON.stringify(payloadPreview, null, 2)}</code></pre>
          </div>
        </section>
      </div>
    </main>
  );
}
