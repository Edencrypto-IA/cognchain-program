'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
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
import { MYTHOS_AGENT_PROFILE } from '../mythos';

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

const DEFAULT_TEST_MEMORY =
  'Mythos official bridge smoke test: context, observability and task memory are connected to CongChain with authenticated human-reviewed metadata.';

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

  const canUseKey = apiKey.trim().startsWith('cog_live_');

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
          <a href="/brain" className="inline-flex items-center gap-2 rounded-xl border border-[#14F195]/20 bg-[#14F195]/10 px-3 py-2 text-xs font-bold text-[#14F195] transition hover:bg-[#14F195]/15">
            <Brain className="h-4 w-4" />
            Memory Brain
          </a>
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
                  ['Skills', profile.counts.skills],
                  ['Memory providers', profile.counts.memoryProvidersWithCongChain],
                  ['LLM providers', profile.counts.llmProviders],
                  ['Plataformas', profile.counts.messagePlatforms],
                  ['LSPs', profile.counts.languageServers],
                  ['Tool files', profile.counts.toolFiles],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/8 bg-black/25 p-3">
                    <p className="text-2xl font-black text-white">{value}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">{label}</p>
                  </div>
                ))}
              </div>
            </div>
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
