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
import {
  MYTHOS_AGENT_PROFILE,
  MYTHOS_CAPABILITY_GROUPS,
  MYTHOS_CATEGORY_SKILL_INDEX,
  MYTHOS_COGNITIVE_LAYERS,
  MYTHOS_DECISION_TRACE_SCHEMA,
  MYTHOS_FEATURED_SKILLS,
  MYTHOS_READINESS_ITEMS,
  MYTHOS_RUNTIME_PROOF,
  MYTHOS_SKILL_CATEGORIES,
  MYTHOS_UNIQUE_IDENTITY_PILLARS,
} from '../mythos';

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

type MythosDoctorResponse = {
  ok?: boolean;
  checkedAt?: string;
  profile?: {
    skills?: number;
    featuredSkills?: number;
    categories?: number;
    readinessItems?: number;
  };
  bridge?: {
    ok?: boolean;
    mode?: string;
    authRequiredForWrites?: boolean;
  };
  checks?: Array<{
    id: string;
    label: string;
    state: 'ready' | 'configured' | 'review' | 'blocked';
    detail: string;
  }>;
  counts?: {
    ready?: number;
    review?: number;
    blocked?: number;
  };
};

const DEFAULT_TEST_MEMORY =
  'Mythos official bridge smoke test: context, observability and task memory are connected to CongChain with authenticated human-reviewed metadata.';

const PT = {
  backToChat: 'Voltar ao Chat',
  testMythos: 'Abrir Mythos Lab',
  closeTest: 'Fechar teste',
  heroLabel: 'Primeiro agente externo oficial',
  heroSummary:
    'Agente externo estruturado para contexto, observabilidade, skills, tarefas e memoria verificavel na CongChain. Esta aba e o cockpit oficial para conectar Mythos a CongChain com key autenticada, memoria isolada por agente e trilha auditavel.',
  identityEyebrow: 'Identidade Mythos',
  identityTitle: 'Fork compativel, identidade propria',
  identityCopy:
    'Mythos nasceu com compatibilidade Hermes, mas na CongChain ele usa namespace, vault e metadata proprios. Hermes fica como adaptador legado, nao como identidade principal.',
  singularityEyebrow: 'Identidade unica',
  singularityTitle: 'Seis pilares para tornar Mythos diferente no mercado',
  singularityCopy:
    'A meta nao e competir como mais um chat. Mythos deve parecer infraestrutura de agente: memoria comprovavel, skills governadas, vault isolado e auditoria pronta para empresas.',
  auditSignal: 'Sinal auditavel',
  enterpriseValue: 'Valor para empresas',
  cognitiveEyebrow: 'Cerebro verificavel',
  cognitiveTitle: 'Como Mythos pensa, lembra, prevê e explica',
  cognitiveCopy:
    'Esta fase cria uma arquitetura cognitiva auditavel. Mythos nao revela pensamento interno sensivel, mas explica sinais, memoria, decisao, previsao e limites de seguranca.',
  brainAnalogy: 'Analogia cerebral',
  auditOutput: 'Saida auditavel',
  decisionTrace: 'Trilha de decisao',
  capabilityEyebrow: 'Mapa de capacidades',
  capabilityTitle: 'O que esses numeros significam na pratica',
  capabilityCopy:
    'Selecione uma area para ver exemplos, como configurar e quais limites de seguranca precisam ficar claros antes de ligar o Mythos em producao.',
  createKey: 'Criar key',
  skillEyebrow: 'Biblioteca de skills',
  skillTitle: 'Escolha a skill pelo trabalho que o Mythos vai fazer',
  skillCopy:
    'O Mythos tem 168 skills no catalogo. Esta tela organiza as principais por objetivo para voce entender qual usar antes de conectar o agente externo.',
  auditedSkills: 'skills auditadas',
  showingSkills: 'Mostrando',
  mainSkills: 'skills principais',
  selectedSkill: 'Skill selecionada',
  path: 'Caminho',
  howToUse: 'Como usar no Mythos',
  commandCopied: 'Comando copiado',
  copySkillCommand: 'Copiar comando da skill',
  allInCategory: 'Todas da categoria',
  catalog: 'catalogo',
  card: 'card',
  list: 'lista',
  safetySkill: [
    'A selecao aqui nao executa a skill automaticamente.',
    'Use a skill dentro do Mythos com uma key CongChain ativa.',
    'Memorias criadas pela skill devem respeitar o filtro anti-segredos.',
  ],
  bridgeStatus: 'Status da ponte',
  liveContract: 'Contrato vivo',
  refresh: 'Atualizar',
  checking: 'verificando',
  unavailable: 'indisponivel',
  apiKeyRequired: 'API key obrigatoria',
  checkConfig: 'verificar config',
  safeLocalTest: 'Teste local seguro',
  connectKey: 'Conectar key Mythos',
  keyNotice:
    'A key nao e salva nesta tela. Ela existe so enquanto a aba esta aberta para listar ou criar uma memoria de teste.',
  testMemory: 'Memoria de teste',
  listMemories: 'Listar',
  saveTest: 'Salvar teste',
  recentMemories: 'Memorias recentes',
  loadMemoryHint: 'Cole a key para carregar memorias do Mythos.',
  vaultOf: 'Vault de',
  copied: 'Copiado',
  copySetup: 'Copiar setup',
  noMemory: 'Nenhuma memoria Mythos carregada nesta aba.',
  noMemoryHint:
    'Liste com uma key CongChain ou salve uma memoria de teste para ver o Obsidian externo aparecer aqui.',
  setup: 'Setup para Mythos',
  auditedPayload: 'Payload auditado',
  copy: 'Copiar',
  examplesIncluded: 'Exemplos incluidos',
  howTo: 'Como fazer',
  items: 'itens',
  seeBelow: 'ver abaixo',
  clickToUnderstand: 'clique para entender',
  user: 'Voce',
  system: 'Sistema',
  backendDemo: 'Backend demo, sem keys expostas',
  readinessEyebrow: 'Readiness do Mythos',
  readinessTitle: 'O que esta pronto, configurado ou bloqueado',
  readinessCopy:
    'Este painel ajuda operadores a entender o Mythos de hoje: runtime, ponte CongChain, memoria, skills, web, browser, mensagens, media e limites de seguranca.',
  runSafeCheck: 'Abrir teste seguro',
  runtimeProof: 'Prova de runtime',
  copyProof: 'Copiar prova',
  doctor: 'Mythos Doctor',
  ready: 'pronto',
  configured: 'configurado',
  live: 'ao vivo',
  blocked: 'bloqueado',
  review: 'revisar',
  setupNeeded: 'Setup',
  safetyBoundary: 'Limite seguro',
  proofEyebrow: 'Prova do runtime',
  proofTitle: 'Mythos escreveu, leu e verificou uma memoria real',
  proofCopy:
    'Este painel mostra o ultimo teste ponta a ponta do runtime local conectado ao bridge CongChain.',
  memoryReceipt: 'Recibo de memoria',
  runtimeTools: 'Ferramentas ativas',
  providerChecks: 'Providers verificados',
  proofLimit: 'Limite da prova',
};

const EN = {
  backToChat: 'Back to Chat',
  testMythos: 'Open Mythos Lab',
  closeTest: 'Close test',
  heroLabel: 'First official external agent',
  heroSummary:
    'External agent structured for context, observability, skills, tasks, and verifiable memory on CongChain. This is the official cockpit for connecting Mythos to CongChain with an authenticated key, isolated agent memory, and an auditable trail.',
  identityEyebrow: 'Mythos identity',
  identityTitle: 'Compatible fork, independent identity',
  identityCopy:
    'Mythos began with Hermes compatibility, but on CongChain it uses its own namespace, vault, and metadata. Hermes remains a legacy adapter, not the primary identity.',
  singularityEyebrow: 'Unique identity',
  singularityTitle: 'Six pillars that make Mythos different in the market',
  singularityCopy:
    'The goal is not to be another chat surface. Mythos should feel like agent infrastructure: provable memory, governed skills, isolated vaults, and enterprise-ready audit context.',
  auditSignal: 'Audit signal',
  enterpriseValue: 'Enterprise value',
  cognitiveEyebrow: 'Verifiable brain',
  cognitiveTitle: 'How Mythos thinks, remembers, predicts, and explains',
  cognitiveCopy:
    'This phase creates an auditable cognitive architecture. Mythos does not expose sensitive hidden reasoning, but it can explain signals, memory, decisions, forecasts, and safety limits.',
  brainAnalogy: 'Brain analogy',
  auditOutput: 'Audit output',
  decisionTrace: 'Decision trace',
  capabilityEyebrow: 'Capability map',
  capabilityTitle: 'What these numbers mean in practice',
  capabilityCopy:
    'Select an area to see examples, setup steps, and safety limits before connecting Mythos in production.',
  createKey: 'Create key',
  skillEyebrow: 'Skill library',
  skillTitle: 'Choose the skill by the job Mythos needs to do',
  skillCopy:
    'Mythos has 168 skills in the catalog. This view organizes the main ones by objective so users understand what to use before connecting the external agent.',
  auditedSkills: 'audited skills',
  showingSkills: 'Showing',
  mainSkills: 'main skills',
  selectedSkill: 'Selected skill',
  path: 'Path',
  howToUse: 'How to use in Mythos',
  commandCopied: 'Command copied',
  copySkillCommand: 'Copy skill command',
  allInCategory: 'All in category',
  catalog: 'catalog',
  card: 'card',
  list: 'list',
  safetySkill: [
    'Selecting a skill here does not execute it automatically.',
    'Use the skill inside Mythos with an active CongChain key.',
    'Memories created by the skill must respect the anti-secret filter.',
  ],
  bridgeStatus: 'Bridge status',
  liveContract: 'Live contract',
  refresh: 'Refresh',
  checking: 'checking',
  unavailable: 'unavailable',
  apiKeyRequired: 'API key required',
  checkConfig: 'check config',
  safeLocalTest: 'Safe local test',
  connectKey: 'Connect Mythos key',
  keyNotice:
    'The key is not saved on this screen. It only exists while this tab is open to list or create a test memory.',
  testMemory: 'Test memory',
  listMemories: 'List',
  saveTest: 'Save test',
  recentMemories: 'Recent memories',
  loadMemoryHint: 'Paste a key to load Mythos memories.',
  vaultOf: 'Vault for',
  copied: 'Copied',
  copySetup: 'Copy setup',
  noMemory: 'No Mythos memory loaded in this tab.',
  noMemoryHint:
    'List with a CongChain key or save a test memory to see the external Obsidian view appear here.',
  setup: 'Setup for Mythos',
  auditedPayload: 'Audited payload',
  copy: 'Copy',
  examplesIncluded: 'Included examples',
  howTo: 'How to use',
  items: 'items',
  seeBelow: 'see below',
  clickToUnderstand: 'click to understand',
  user: 'You',
  system: 'System',
  backendDemo: 'Backend demo, no exposed keys',
  readinessEyebrow: 'Mythos readiness',
  readinessTitle: 'What is ready, configured, or intentionally blocked',
  readinessCopy:
    'This panel gives operators a clean view of Mythos today: runtime, CongChain bridge, memory, skills, web, browser, messaging, media, and safety limits.',
  runSafeCheck: 'Open safe test',
  runtimeProof: 'Runtime proof',
  copyProof: 'Copy proof',
  doctor: 'Mythos Doctor',
  ready: 'ready',
  configured: 'configured',
  live: 'live',
  blocked: 'blocked',
  review: 'review',
  setupNeeded: 'Setup',
  safetyBoundary: 'Safety boundary',
  proofEyebrow: 'Runtime proof',
  proofTitle: 'Mythos wrote, read, and verified a real memory',
  proofCopy:
    'This panel shows the latest end-to-end test from the local runtime connected to the CongChain bridge.',
  memoryReceipt: 'Memory receipt',
  runtimeTools: 'Active tools',
  providerChecks: 'Provider checks',
  proofLimit: 'Proof limit',
};

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
  const [doctor, setDoctor] = useState<MythosDoctorResponse | null>(null);
  const [doctorLoading, setDoctorLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [agentId, setAgentId] = useState('mythos-local-test');
  const [testMemory, setTestMemory] = useState(DEFAULT_TEST_MEMORY);
  const [memories, setMemories] = useState<BridgeMemory[]>([]);
  const [owner, setOwner] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState('');
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<string>(MYTHOS_CAPABILITY_GROUPS[0]?.id || '');
  const [selectedCategory, setSelectedCategory] = useState<string>('congchain');
  const [selectedSkillId, setSelectedSkillId] = useState<string>(MYTHOS_FEATURED_SKILLS[0]?.id || '');
  const [language, setLanguage] = useState<'en' | 'pt'>('en');

  const canUseKey = apiKey.trim().startsWith('cog_live_');
  const copy = language === 'pt' ? PT : EN;
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
  const readinessItems = MYTHOS_READINESS_ITEMS.map(item => {
    if (item.id !== 'bridge') return item;
    if (healthLoading) return { ...item, state: 'review' as const, signal: 'Checking the public CongChain bridge health endpoint now.' };
    if (health?.ok) return { ...item, state: 'live' as const, signal: `${item.signal} Current status: online.` };
    return { ...item, state: 'review' as const, signal: 'Bridge health is unavailable from this browser right now; check Railway or the health endpoint before production use.' };
  });
  const readinessCounts = {
    ready: readinessItems.filter(item => item.state === 'ready' || item.state === 'configured' || item.state === 'live').length,
    review: readinessItems.filter(item => item.state === 'review').length,
    blocked: readinessItems.filter(item => item.state === 'blocked').length,
  };
  const latestMemory = memories[0];
  const runtimeProof = useMemo(() => {
    return [
      'Mythos Runtime Proof',
      `checkedAt=${doctor?.checkedAt || new Date().toISOString()}`,
      `bridge=${health?.ok || doctor?.bridge?.ok ? 'online' : 'review'}`,
      `bridgeMode=${health?.mode || doctor?.bridge?.mode || 'unknown'}`,
      `agentId=${agentId || 'mythos-local-test'}`,
      `selectedSkill=${selectedSkill?.name || 'none'}`,
      `skillPath=${selectedSkill?.path || 'none'}`,
      `skillsCatalog=${profile.counts.skills}`,
      `featuredSkills=${MYTHOS_FEATURED_SKILLS.length}`,
      `readinessReady=${doctor?.counts?.ready ?? readinessCounts.ready}`,
      `readinessReview=${doctor?.counts?.review ?? readinessCounts.review}`,
      `readinessBlocked=${doctor?.counts?.blocked ?? readinessCounts.blocked}`,
      `loadedMemories=${memories.length}`,
      `latestMemoryHash=${latestMemory?.hash || 'none'}`,
      'safety=no-secrets,no-private-keys,no-signed-payloads,no-fund-movement,human-review',
    ].join('\n');
  }, [agentId, doctor, health, latestMemory?.hash, memories.length, profile.counts.skills, readinessCounts.blocked, readinessCounts.ready, readinessCounts.review, selectedSkill?.name, selectedSkill?.path]);

  function readinessLabel(state: string) {
    if (state === 'ready') return copy.ready;
    if (state === 'configured') return copy.configured;
    if (state === 'live') return copy.live;
    if (state === 'blocked') return copy.blocked;
    return copy.review;
  }

  const setupSnippet = useMemo(() => {
    return [
      'CONGCHAIN_API_URL=https://cognchain-program-production.up.railway.app',
      'CONGCHAIN_API_KEY=cog_live_your_full_key',
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
      namespace: profile.identity.namespace,
      lineage: profile.identity.lineage,
      compatibilityMode: 'hermes_compatible_mythos_primary',
      identityProgram: 'mythos_six_pillar_agent_identity',
      identityPillars: MYTHOS_UNIQUE_IDENTITY_PILLARS.map(pillar => pillar.id),
      cognitiveArchitecture: 'mythos_verifiable_brain_v1',
      cognitiveLayers: MYTHOS_COGNITIVE_LAYERS.map(layer => layer.id),
      decisionTraceSchema: MYTHOS_DECISION_TRACE_SCHEMA.id,
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

  async function loadDoctor() {
    setDoctorLoading(true);
    try {
      const response = await fetch('/api/mythos/doctor', { cache: 'no-store' });
      const data = await response.json() as MythosDoctorResponse;
      setDoctor(data);
    } catch {
      setDoctor(null);
    } finally {
      setDoctorLoading(false);
    }
  }

  async function listMemories() {
    if (!canUseKey) {
      setMessage(language === 'pt' ? 'Cole uma key cog_live completa para listar o vault Mythos.' : 'Paste a full cog_live key to list the Mythos vault.');
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
      if (!response.ok) throw new Error(data.error || (language === 'pt' ? 'Falha ao listar memorias Mythos.' : 'Failed to list Mythos memories.'));
      setMemories(data.memories || []);
      setOwner(data.owner || '');
      setMessage(language === 'pt' ? `${data.count || 0} memorias Mythos carregadas.` : `${data.count || 0} Mythos memories loaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (language === 'pt' ? 'Nao foi possivel listar memorias.' : 'Could not list memories.'));
    } finally {
      setLoadingList(false);
    }
  }

  async function writeTestMemory() {
    if (!canUseKey) {
      setMessage(language === 'pt' ? 'Cole uma key cog_live completa antes de salvar uma memoria de teste.' : 'Paste a full cog_live key before saving a test memory.');
      return;
    }
    if (!testMemory.trim()) {
      setMessage(language === 'pt' ? 'Escreva uma memoria de teste antes de enviar.' : 'Write a test memory before sending.');
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
      if (!response.ok) throw new Error(data.error || (language === 'pt' ? 'Falha ao salvar memoria Mythos.' : 'Failed to save Mythos memory.'));
      setMessage(language === 'pt' ? `Memoria Mythos salva: ${shortHash(data.hash, 18)}` : `Mythos memory saved: ${shortHash(data.hash, 18)}`);
      await listMemories();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (language === 'pt' ? 'Nao foi possivel salvar memoria Mythos.' : 'Could not save Mythos memory.'));
    } finally {
      setWriting(false);
    }
  }

  async function copyText(id: string, value: string) {
    await navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(id);
    window.setTimeout(() => setCopied(''), 1400);
  }

  useEffect(() => {
    loadHealth();
    loadDoctor();
  }, []);

  return (
    <main className="min-h-screen bg-[#05050b] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <a href="/" className="text-sm text-white/45 transition hover:text-white/80">
            {copy.backToChat}
          </a>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setLanguage(value => value === 'en' ? 'pt' : 'en')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-white/62 transition hover:bg-white/[0.06]"
            >
              {language === 'en' ? 'PT' : 'EN'}
            </button>
            <a
              href="/mythos/lab"
              className="inline-flex items-center gap-2 rounded-xl border border-[#76FF03]/25 bg-[#76FF03]/12 px-3 py-2 text-xs font-bold text-[#A7FF3D] transition hover:bg-[#76FF03]/18"
            >
              <TerminalSquare className="h-4 w-4" />
              {copy.testMythos}
            </a>
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
                    {language === 'pt' ? copy.heroLabel : profile.label}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                    Agent Memory Bridge
                  </span>
                </div>
                <h1 className="text-3xl font-black tracking-[-0.01em] text-white sm:text-5xl">Mythos Agent</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/58 sm:text-base">
                  {copy.heroSummary}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ['skills', 'Skills', profile.counts.skills],
                  ['memory', 'Memory providers', profile.counts.memoryProvidersWithCongChain],
                  ['llm', 'LLM providers', profile.counts.llmProviders],
                  ['platforms', language === 'pt' ? 'Plataformas' : 'Platforms', profile.counts.messagePlatforms],
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
                    <p className="mt-2 text-[10px] text-white/28">{id === 'skills' ? copy.seeBelow : copy.clickToUnderstand}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#14F195]/18 bg-[radial-gradient(circle_at_top_right,rgba(20,241,149,0.09),transparent_30%),linear-gradient(180deg,rgba(5,14,12,0.86),rgba(5,5,11,0.96))] p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#14F195]">{copy.readinessEyebrow}</p>
              <h2 className="mt-1 text-2xl font-black">{copy.readinessTitle}</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/50">{copy.readinessCopy}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-[#14F195]/18 bg-[#14F195]/10 px-3 py-2">
                <p className="text-xl font-black text-white">{readinessCounts.ready}</p>
                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#14F195]">{copy.ready}</p>
              </div>
              <div className="rounded-xl border border-[#FACC15]/18 bg-[#FACC15]/10 px-3 py-2">
                <p className="text-xl font-black text-white">{readinessCounts.review}</p>
                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#FACC15]">{copy.review}</p>
              </div>
              <div className="rounded-xl border border-[#FF5C8A]/18 bg-[#FF5C8A]/10 px-3 py-2">
                <p className="text-xl font-black text-white">{readinessCounts.blocked}</p>
                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#FF7AA2]">{copy.blocked}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {readinessItems.map(item => {
              const isReady = item.state === 'ready' || item.state === 'configured' || item.state === 'live';
              const isBlocked = item.state === 'blocked';
              return (
                <article
                  key={item.id}
                  className={`rounded-2xl border p-4 ${
                    isReady
                      ? 'border-[#14F195]/18 bg-[#14F195]/[0.055]'
                      : isBlocked
                        ? 'border-[#FF5C8A]/18 bg-[#FF5C8A]/[0.055]'
                        : 'border-[#FACC15]/18 bg-[#FACC15]/[0.055]'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                        isReady
                          ? 'border-[#14F195]/22 bg-[#14F195]/10 text-[#14F195]'
                          : isBlocked
                            ? 'border-[#FF5C8A]/22 bg-[#FF5C8A]/10 text-[#FF7AA2]'
                            : 'border-[#FACC15]/22 bg-[#FACC15]/10 text-[#FACC15]'
                      }`}
                    >
                      {isReady ? <CheckCircle2 className="h-4 w-4" /> : isBlocked ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${
                        isReady
                          ? 'bg-[#14F195]/12 text-[#14F195]'
                          : isBlocked
                            ? 'bg-[#FF5C8A]/12 text-[#FF7AA2]'
                            : 'bg-[#FACC15]/12 text-[#FACC15]'
                      }`}
                    >
                      {readinessLabel(item.state)}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-white">{item.label}</h3>
                  <p className="mt-2 text-xs leading-5 text-white/52">{item.signal}</p>
                  <div className="mt-4 space-y-2 border-t border-white/8 pt-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/32">{copy.setupNeeded}</p>
                      <p className="mt-1 text-[11px] leading-5 text-white/50">{item.setup}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/32">{copy.safetyBoundary}</p>
                      <p className="mt-1 text-[11px] leading-5 text-white/50">{item.safety}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/24 p-4">
            <div className="flex items-start gap-3">
              <TerminalSquare className="mt-0.5 h-5 w-5 text-[#A7FF3D]" />
              <div>
                <p className="text-sm font-black text-white">Safe Mythos Check</p>
                <p className="mt-1 text-xs leading-5 text-white/46">
                  {language === 'pt'
                    ? 'Use o Lab para testar resposta, skill, trilha cognitiva e memoria sem expor keys no navegador.'
                    : 'Use the Lab to test response, skill, cognitive trace, and memory without exposing provider keys in the browser.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/mythos/lab"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#76FF03]/20 bg-[#76FF03]/10 px-3 text-xs font-bold text-[#A7FF3D] transition hover:bg-[#76FF03]/15"
              >
                <TerminalSquare className="h-4 w-4" />
                {copy.runSafeCheck}
              </a>
              <a
                href="/dashboard/keys"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#5AD7FF]/20 bg-[#5AD7FF]/10 px-3 text-xs font-bold text-[#7DE4FF] transition hover:bg-[#5AD7FF]/15"
              >
                <KeyRound className="h-4 w-4" />
                {copy.createKey}
              </a>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_360px]">
            <div className="rounded-2xl border border-[#5AD7FF]/14 bg-[#5AD7FF]/[0.045] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7DE4FF]">{copy.doctor}</p>
                  <h3 className="mt-1 text-lg font-black text-white">{copy.runtimeProof}</h3>
                  <p className="mt-2 max-w-3xl text-xs leading-5 text-white/48">
                    {language === 'pt'
                      ? 'Recibo operacional do Mythos de hoje: ponte, skills, readiness, memoria carregada e limites de seguranca. Nao revela keys nem executa acoes.'
                      : 'Operational receipt for today Mythos state: bridge, skills, readiness, loaded memory, and safety boundaries. It reveals no keys and executes no actions.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyText('runtime-proof', runtimeProof)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#5AD7FF]/20 bg-[#5AD7FF]/10 px-3 text-xs font-bold text-[#7DE4FF] transition hover:bg-[#5AD7FF]/15"
                >
                  <Copy className="h-4 w-4" />
                  {copied === 'runtime-proof' ? copy.copied : copy.copyProof}
                </button>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Bridge', health?.ok || doctor?.bridge?.ok ? 'online' : doctorLoading || healthLoading ? copy.checking : copy.review],
                  ['Skill', selectedSkill?.name || 'none'],
                  ['Memory', latestMemory?.hash ? shortHash(latestMemory.hash, 14) : `${memories.length} loaded`],
                  ['Checked', doctor?.checkedAt ? formatDate(doctor.checkedAt) : doctorLoading ? copy.checking : 'local'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/8 bg-black/28 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/32">{label}</p>
                    <p className="mt-1 break-words text-xs font-bold text-white/72">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/24 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/38">Doctor checks</p>
                <button
                  type="button"
                  onClick={() => {
                    loadHealth();
                    loadDoctor();
                  }}
                  className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-[10px] font-bold text-white/56 transition hover:bg-white/[0.07]"
                >
                  {doctorLoading || healthLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {copy.refresh}
                </button>
              </div>
              <div className="grid gap-2">
                {(doctor?.checks || []).slice(0, 4).map(check => (
                  <div key={check.id} className="flex items-start gap-2 rounded-xl border border-white/8 bg-white/[0.035] p-3">
                    <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      check.state === 'ready' || check.state === 'configured'
                        ? 'bg-[#14F195]'
                        : check.state === 'blocked'
                          ? 'bg-[#FF5C8A]'
                          : 'bg-[#FACC15]'
                    }`} />
                    <div>
                      <p className="text-xs font-bold text-white/76">{check.label}</p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/42">{check.detail}</p>
                    </div>
                  </div>
                ))}
                {!doctor?.checks?.length && (
                  <p className="rounded-xl border border-white/8 bg-white/[0.035] p-3 text-xs leading-5 text-white/42">
                    {doctorLoading ? copy.checking : 'Doctor data unavailable.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#5AD7FF]/18 bg-[radial-gradient(circle_at_top_left,rgba(90,215,255,0.12),transparent_30%),linear-gradient(180deg,rgba(4,10,13,0.88),rgba(5,5,11,0.96))] p-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7DE4FF]">{copy.proofEyebrow}</p>
              <h2 className="mt-1 text-2xl font-black">{copy.proofTitle}</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/50">{copy.proofCopy}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Write', MYTHOS_RUNTIME_PROOF.memoryState.write],
                  ['Read', MYTHOS_RUNTIME_PROOF.memoryState.read],
                  ['Verify', MYTHOS_RUNTIME_PROOF.memoryState.verify],
                  ['List', MYTHOS_RUNTIME_PROOF.memoryState.list],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[#14F195]/16 bg-[#14F195]/[0.06] p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#14F195]" />
                      <p className="text-sm font-black text-white">{label}</p>
                    </div>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#14F195]">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-white/8 bg-black/25 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">{copy.memoryReceipt}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">Hash</p>
                    <p className="mt-1 break-all font-mono text-xs text-[#7DE4FF]">{MYTHOS_RUNTIME_PROOF.shortHash}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">Agent / source</p>
                    <p className="mt-1 text-xs font-semibold text-white/65">
                      {MYTHOS_RUNTIME_PROOF.agentId} · {MYTHOS_RUNTIME_PROOF.source}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">Skills</p>
                    <p className="mt-1 text-xs font-semibold text-white/65">
                      {MYTHOS_RUNTIME_PROOF.installedCongChainSkills} CongChain · {MYTHOS_RUNTIME_PROOF.totalRuntimeSkillsEnabled} enabled
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">ZK / on-chain</p>
                    <p className="mt-1 text-xs font-semibold text-white/65">
                      {MYTHOS_RUNTIME_PROOF.memoryState.zkVerified ? 'zk verified' : 'not requested'} · {MYTHOS_RUNTIME_PROOF.memoryState.onChain ? 'on-chain' : 'off-chain bridge'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <aside className="rounded-2xl border border-white/8 bg-black/25 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A7FF3D]">{copy.providerChecks}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {MYTHOS_RUNTIME_PROOF.providerChecks.map(provider => (
                  <span key={provider} className="rounded-full border border-[#14F195]/16 bg-[#14F195]/10 px-3 py-1 text-[11px] font-bold text-[#14F195]">
                    {provider}
                  </span>
                ))}
              </div>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-[#7DE4FF]">{copy.runtimeTools}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {MYTHOS_RUNTIME_PROOF.enabledTools.map(tool => (
                  <span key={tool} className="rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[10px] font-semibold text-white/58">
                    {tool}
                  </span>
                ))}
              </div>

              <div className="mt-5 rounded-xl border border-[#FACC15]/16 bg-[#FACC15]/[0.055] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FACC15]">{copy.proofLimit}</p>
                <p className="mt-2 text-xs leading-5 text-white/52">{MYTHOS_RUNTIME_PROOF.note}</p>
              </div>

              <div className="mt-4 space-y-2">
                {MYTHOS_RUNTIME_PROOF.safety.map(item => (
                  <div key={item} className="flex gap-2 text-xs leading-5 text-white/50">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#14F195]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="rounded-2xl border border-[#76FF03]/18 bg-[#76FF03]/[0.035] p-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7FF3D]">{copy.identityEyebrow}</p>
              <h2 className="mt-1 text-2xl font-black">{copy.identityTitle}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/52">{copy.identityCopy}</p>
              <p className="mt-3 max-w-3xl text-xs leading-5 text-white/38">{profile.identity.compatibility}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {[
                ['Namespace', profile.identity.namespace],
                ['Lineage', profile.identity.lineage],
                ['Position', profile.identity.position],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/8 bg-black/22 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/32">{label}</p>
                  <p className="mt-1 text-sm font-bold text-white/76">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#76FF03]/20 bg-[radial-gradient(circle_at_top_right,rgba(118,255,3,0.11),transparent_32%),linear-gradient(180deg,rgba(8,13,8,0.86),rgba(5,5,11,0.96))] p-4">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7FF3D]">{copy.singularityEyebrow}</p>
              <h2 className="mt-1 max-w-3xl text-2xl font-black">{copy.singularityTitle}</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/50">{copy.singularityCopy}</p>
            </div>
            <div className="rounded-xl border border-[#76FF03]/20 bg-[#76FF03]/10 px-4 py-3 text-right">
              <p className="text-2xl font-black text-white">6</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A7FF3D]">identity pillars</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {MYTHOS_UNIQUE_IDENTITY_PILLARS.map((pillar, index) => (
              <article key={pillar.id} className="rounded-2xl border border-white/8 bg-black/24 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#76FF03]/22 bg-[#76FF03]/10 text-xs font-black text-[#A7FF3D]">
                    {index + 1}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-white/42">
                    Mythos-native
                  </span>
                </div>
                <h3 className="text-base font-black text-white">{pillar.name}</h3>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-[#5AD7FF]/12 bg-[#5AD7FF]/[0.045] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7DE4FF]">{copy.auditSignal}</p>
                    <p className="mt-2 text-xs leading-5 text-white/56">{pillar.signal}</p>
                  </div>
                  <div className="rounded-xl border border-[#76FF03]/12 bg-[#76FF03]/[0.045] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A7FF3D]">{copy.enterpriseValue}</p>
                    <p className="mt-2 text-xs leading-5 text-white/56">{pillar.enterpriseValue}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#5AD7FF]/18 bg-[radial-gradient(circle_at_top_left,rgba(90,215,255,0.10),transparent_30%),linear-gradient(180deg,rgba(3,9,12,0.82),rgba(5,5,11,0.96))] p-4">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7DE4FF]">{copy.cognitiveEyebrow}</p>
              <h2 className="mt-1 max-w-3xl text-2xl font-black">{copy.cognitiveTitle}</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/50">{copy.cognitiveCopy}</p>
            </div>
            <div className="rounded-xl border border-[#5AD7FF]/20 bg-[#5AD7FF]/10 px-4 py-3 text-right">
              <p className="text-2xl font-black text-white">{MYTHOS_COGNITIVE_LAYERS.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7DE4FF]">cognitive layers</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {MYTHOS_COGNITIVE_LAYERS.map((layer, index) => (
              <article key={layer.id} className="rounded-2xl border border-white/8 bg-black/24 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#5AD7FF]/22 bg-[#5AD7FF]/10 text-xs font-black text-[#7DE4FF]">
                    {index + 1}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-white/42">
                    {layer.id}
                  </span>
                </div>
                <h3 className="text-base font-black text-white">{layer.name}</h3>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[#7DE4FF]/70">{copy.brainAnalogy}: {layer.brainAnalogy}</p>
                <p className="mt-3 text-xs leading-5 text-white/52">{layer.function}</p>
                <div className="mt-4 rounded-xl border border-[#76FF03]/12 bg-[#76FF03]/[0.045] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A7FF3D]">{copy.auditOutput}</p>
                  <p className="mt-2 text-xs leading-5 text-white/56">{layer.auditOutput}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-white/8 bg-black/24 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/38">{copy.decisionTrace}</p>
                <h3 className="mt-1 text-lg font-black text-white">{MYTHOS_DECISION_TRACE_SCHEMA.id}</h3>
                <p className="mt-2 max-w-3xl text-xs leading-5 text-white/48">{MYTHOS_DECISION_TRACE_SCHEMA.guarantee}</p>
              </div>
              <span className="rounded-full border border-[#5AD7FF]/20 bg-[#5AD7FF]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#7DE4FF]">
                v{MYTHOS_DECISION_TRACE_SCHEMA.version}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {MYTHOS_DECISION_TRACE_SCHEMA.requiredFields.map(field => (
                <span key={field} className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-[11px] font-semibold text-white/58">
                  {field}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#5AD7FF]/14 bg-white/[0.025] p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#5AD7FF]">{copy.capabilityEyebrow}</p>
              <h2 className="mt-1 text-2xl font-black">{copy.capabilityTitle}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/48">
                {copy.capabilityCopy}
              </p>
            </div>
            <a href="/dashboard/keys" className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#76FF03]/20 bg-[#76FF03]/10 px-3 text-xs font-bold text-[#A7FF3D] transition hover:bg-[#76FF03]/15">
              <KeyRound className="h-4 w-4" />
              {copy.createKey}
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
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{copy.items}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_320px]">
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{copy.examplesIncluded}</p>
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
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A7FF3D]">{copy.howTo}</p>
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
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#76FF03]">{copy.skillEyebrow}</p>
              <h2 className="mt-1 text-2xl font-black">{copy.skillTitle}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
                {copy.skillCopy}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/25 px-4 py-3 text-right">
              <p className="text-2xl font-black text-white">{profile.counts.skills}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{copy.auditedSkills}</p>
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
                  {copy.showingSkills} {visibleSkills.length} / {selectedCategoryMeta?.count || categorySkillIndex.length} {copy.mainSkills}
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
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{copy.allInCategory}</p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {selectedCategoryMeta?.count || categorySkillIndex.length} skills {selectedCategoryMeta?.label || ''}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[10px] font-bold text-white/50">
                    {copy.catalog}
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
                          {highlighted ? copy.card : copy.list}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {selectedSkill && (
              <aside className="rounded-2xl border border-[#5AD7FF]/16 bg-[#5AD7FF]/[0.045] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5AD7FF]">{copy.selectedSkill}</p>
                <h3 className="mt-2 text-xl font-black text-white">{selectedSkill.name}</h3>
                <p className="mt-3 text-sm leading-6 text-white/55">{selectedSkill.bestFor}</p>

                <div className="mt-4 rounded-xl border border-white/8 bg-black/25 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{copy.path}</p>
                  <p className="mt-2 break-all font-mono text-xs text-white/68">{selectedSkill.path}</p>
                </div>

                <div className="mt-3 rounded-xl border border-white/8 bg-black/25 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{copy.howToUse}</p>
                  <pre className="mt-2 overflow-x-auto text-xs leading-5 text-white/68"><code>{selectedSkill.command}</code></pre>
                </div>

                <button
                  type="button"
                  onClick={() => copyText(`skill-${selectedSkill.id}`, selectedSkill.command)}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#5AD7FF]/20 bg-[#5AD7FF]/10 px-3 text-xs font-bold text-[#7DE4FF] transition hover:bg-[#5AD7FF]/15"
                >
                  <Copy className="h-4 w-4" />
                  {copied === `skill-${selectedSkill.id}` ? copy.commandCopied : copy.copySkillCommand}
                </button>

                <div className="mt-4 space-y-2 border-t border-white/8 pt-4">
                  {copy.safetySkill.map(item => (
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
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#14F195]">{copy.liveContract}</p>
                <h2 className="mt-1 text-xl font-black">{copy.bridgeStatus}</h2>
              </div>
              <button
                onClick={loadHealth}
                disabled={healthLoading}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-bold text-white/70 transition hover:bg-white/[0.06] disabled:opacity-50"
              >
                {healthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {copy.refresh}
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-[#14F195]/18 bg-[#14F195]/8 p-4">
                <CheckCircle2 className="mb-3 h-5 w-5 text-[#14F195]" />
                <p className="text-sm font-bold">Health</p>
                <p className="mt-1 text-xs text-white/45">{health?.ok ? 'online' : healthLoading ? copy.checking : copy.unavailable}</p>
              </div>
              <div className="rounded-xl border border-[#5AD7FF]/18 bg-[#5AD7FF]/8 p-4">
                <KeyRound className="mb-3 h-5 w-5 text-[#5AD7FF]" />
                <p className="text-sm font-bold">Writes</p>
                <p className="mt-1 text-xs text-white/45">{health?.authRequiredForWrites ? copy.apiKeyRequired : copy.checkConfig}</p>
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
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#76FF03]">{copy.safeLocalTest}</p>
            <h2 className="mt-1 text-xl font-black">{copy.connectKey}</h2>
            <p className="mt-2 text-xs leading-5 text-white/45">
              {copy.keyNotice}
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

            <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{copy.testMemory}</label>
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
                {copy.listMemories}
              </button>
              <button
                onClick={writeTestMemory}
                disabled={writing || !canUseKey}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#76FF03]/25 bg-[#76FF03]/12 px-3 text-xs font-bold text-[#A7FF3D] transition hover:bg-[#76FF03]/18 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {writing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {copy.saveTest}
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
                <h2 className="mt-1 text-xl font-black">{copy.recentMemories}</h2>
                <p className="mt-1 text-xs text-white/42">{owner ? `${copy.vaultOf} ${owner}` : copy.loadMemoryHint}</p>
              </div>
              <button
                onClick={() => copyText('snippet', setupSnippet)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-bold text-white/70 transition hover:bg-white/[0.06]"
              >
                <Copy className="h-4 w-4" />
                {copied === 'snippet' ? copy.copied : copy.copySetup}
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
                        {memory.readUrl && <a href={memory.readUrl} target="_blank" className="text-white/35 transition hover:text-[#5AD7FF]" aria-label={language === 'pt' ? 'Abrir memoria' : 'Open memory'}><ExternalLink className="h-4 w-4" /></a>}
                        {memory.verifyUrl && <a href={memory.verifyUrl} target="_blank" className="text-white/35 transition hover:text-[#76FF03]" aria-label={language === 'pt' ? 'Verificar memoria' : 'Verify memory'}><ShieldCheck className="h-4 w-4" /></a>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 text-center">
                <Sparkles className="h-8 w-8 text-[#76FF03]/50" />
                <p className="mt-4 text-sm font-bold text-white">{copy.noMemory}</p>
                <p className="mt-2 max-w-md text-xs leading-5 text-white/38">
                  {copy.noMemoryHint}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <div className="mb-3 flex items-center gap-2">
              <TerminalSquare className="h-5 w-5 text-[#5AD7FF]" />
              <h2 className="text-lg font-black">{copy.setup}</h2>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-white/8 bg-black/35 p-4 text-xs leading-6 text-white/66"><code>{setupSnippet}</code></pre>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-[#B768FF]" />
                <h2 className="text-lg font-black">{copy.auditedPayload}</h2>
              </div>
              <button
                onClick={() => copyText('payload', JSON.stringify(payloadPreview, null, 2))}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-bold text-white/60 transition hover:bg-white/[0.06]"
              >
                <Copy className="h-4 w-4" />
                {copied === 'payload' ? copy.copied : copy.copy}
              </button>
            </div>
            <pre className="max-h-72 overflow-auto rounded-xl border border-white/8 bg-black/35 p-4 text-xs leading-5 text-white/60"><code>{JSON.stringify(payloadPreview, null, 2)}</code></pre>
          </div>
        </section>
      </div>
    </main>
  );
}
