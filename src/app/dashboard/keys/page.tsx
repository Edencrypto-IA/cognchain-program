'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Key, Plus, Trash2, Copy, Check, ArrowLeft,
  Shield, Zap, Activity, AlertTriangle, Eye, EyeOff,
  Bot, Database, Network,
} from 'lucide-react';

interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string;
  owner: string;
  plan: string;
  planLabel: string;
  isActive: boolean;
  requestsToday: number;
  requestsTotal: number;
  memoriesSaved: number;
  tokensUsed: number;
  limitReqPerDay: number;
  limitMemPerDay: number;
  lastUsedAt: string | null;
  createdAt: string;
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-white/5 text-white/50 border-white/10',
  pro: 'bg-[#9945FF]/10 text-[#9945FF] border-[#9945FF]/30',
  enterprise: 'bg-[#14F195]/10 text-[#14F195] border-[#14F195]/30',
};

const API_BASE_URL = 'https://cognchain-program-production.up.railway.app';
const FULL_KEY_PLACEHOLDER = 'COLE_SUA_KEY_COMPLETA_AQUI';

const AGENT_CONNECTORS = [
  { name: 'Mythos', detail: 'Context engine, observability, skills e task results com vault proprio.' },
  { name: 'Hermes', detail: 'Skills, memorias, ferramentas e resultados de tarefas.' },
  { name: 'Eliza', detail: 'Memorias de agente, persona, decisoes e logs resumidos.' },
  { name: 'OpenClaw', detail: 'Execucoes locais, pesquisas, artefatos e handoffs.' },
];

const KEY_CAPABILITIES = [
  { icon: Bot, label: 'Agentes externos', detail: 'Conecte Hermes, Eliza, OpenClaw e providers locais sem expor segredos.' },
  { icon: Database, label: 'Memoria verificavel', detail: 'Salve conteudo com hash, modelo, metadata de origem e trilha por agente.' },
  { icon: Network, label: 'Provas e anchor', detail: 'Peça ZK proof e anchor on-chain apenas quando o fluxo exigir.' },
  { icon: Shield, label: 'Limite seguro', detail: 'A key autentica memoria e API. Ela nao assina, nao agenda e nao move fundos.' },
];

const CODE_EXAMPLES = {
  curl: (key: string) => `curl -X POST ${API_BASE_URL}/api/memory/write \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "Hermes skill summary or task result",
    "model": "hermes",
    "generateZkProof": true,
    "metadata": {
      "source": "hermes",
      "contentType": "hermes_skill",
      "agentId": "hermes-local",
      "proofMode": "zk_requested",
      "anchorMode": "manual"
    }
  }'`,

  typescript: (key: string) => `const response = await fetch('${API_BASE_URL}/api/memory/write', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${key}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    content: 'Hermes skill summary or task result',
    model: 'hermes',
    generateZkProof: true,
    metadata: {
      source: 'hermes',
      contentType: 'hermes_skill',
      agentId: 'hermes-local',
      proofMode: 'zk_requested',
      anchorMode: 'manual',
    },
  }),
});
const { hash } = await response.json();
// hash = '202fe03d...' - verifiable CongChain memory`,

  python: (key: string) => `import requests

r = requests.post('${API_BASE_URL}/api/memory/write',
  headers={'Authorization': f'Bearer ${key}'},
  json={
    'content': 'Hermes skill summary or task result',
    'model': 'hermes',
    'generateZkProof': True,
    'metadata': {
      'source': 'hermes',
      'contentType': 'hermes_skill',
      'agentId': 'hermes-local',
      'proofMode': 'zk_requested',
      'anchorMode': 'manual',
    },
  }
)
hash = r.json()['hash']  # verifiable CongChain memory`,
};

export default function ApiKeysPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [owner, setOwner] = useState('');
  const [ownerInput, setOwnerInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPlan, setNewKeyPlan] = useState('free');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showExample, setShowExample] = useState<Record<string, string>>({});
  const [exampleLang, setExampleLang] = useState<'curl' | 'typescript' | 'python'>('curl');

  async function loadKeys(ownerEmail: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/keys?owner=${encodeURIComponent(ownerEmail)}`);
      const data = await res.json();
      setKeys(data.keys || []);
    } catch {
      // Keep the page usable even if the key service is unavailable.
    } finally {
      setLoading(false);
    }
  }

  function handleOwnerSubmit() {
    if (!ownerInput.trim()) return;
    setOwner(ownerInput.trim());
    loadKeys(ownerInput.trim());
  }

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim(), owner, plan: newKeyPlan }),
      });
      const data = await res.json();
      if (data.rawKey) {
        setCreatedKey(data.rawKey);
        setShowCreateForm(false);
        setNewKeyName('');
        loadKeys(owner);
      }
    } catch {
      // Inline error handling can be added when the API key surface gets auth.
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string, name: string) {
    if (!confirm(`Revogar a chave "${name}"? Isso vai parar todos os agentes que a usam imediatamente.`)) return;
    await fetch(`/api/keys/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner }),
    });
    loadKeys(owner);
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white/60"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao Chat
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-gradient-to-br from-[#9945FF]/20 to-[#00D1FF]/20 p-3">
              <Key className="h-6 w-6 text-[#9945FF]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white/90">API Keys</h1>
              <p className="text-sm text-white/40">Conecte seu agente Hermes, Eliza ou OpenClaw direto na CongChain</p>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-[#00D1FF]/18 bg-[#00D1FF]/[0.035] p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-lg bg-[#00D1FF]/10 p-2">
              <Bot className="h-5 w-5 text-[#00D1FF]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white/82">Agent Memory Bridge</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/45">
                Gere uma key para agentes externos gravarem memorias verificaveis, recuperar hashes, pedir provas e preparar anchors sem tocar em fundos ou assinaturas.
              </p>
            </div>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {AGENT_CONNECTORS.map((agent) => (
              <div key={agent.name} className="rounded-lg border border-white/[0.05] bg-black/20 p-3">
                <p className="text-xs font-semibold text-[#00D1FF]/80">{agent.name}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/35">{agent.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {KEY_CAPABILITIES.map(({ icon: Icon, label, detail }) => (
              <div key={label} className="rounded-lg border border-white/[0.05] bg-black/16 p-3">
                <Icon className="mb-2 h-4 w-4 text-[#9945FF]/75" />
                <p className="text-xs font-semibold text-white/72">{label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/34">{detail}</p>
              </div>
            ))}
          </div>
        </div>

        {createdKey && (
          <div className="mb-6 rounded-xl border border-[#14F195]/30 bg-[#14F195]/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-[#14F195]" />
              <span className="text-sm font-semibold text-[#14F195]">Chave completa criada - salve agora!</span>
              <span className="text-xs text-[#14F195]/60">Esta e a unica vez que ela aparece inteira.</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#14F195]/20 bg-black/30 px-4 py-3">
              <code className="flex-1 break-all font-mono text-sm text-[#14F195]">{createdKey}</code>
              <button
                onClick={() => copy(createdKey, 'new-key')}
                className="ml-2 flex-shrink-0 rounded-lg bg-[#14F195]/10 p-2 text-[#14F195] transition-colors hover:bg-[#14F195]/20"
              >
                {copied === 'new-key' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <button onClick={() => setCreatedKey(null)} className="mt-3 text-xs text-white/30 hover:text-white/50">
              Ja salvei, pode fechar
            </button>
            <p className="mt-2 text-[11px] text-[#14F195]/45">
              Depois que fechar, a lista mostra apenas o prefixo. Prefixo com "..." nao autentica chamadas.
            </p>
          </div>
        )}

        {!owner ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/60">Identificacao</h2>
            <div className="flex gap-3">
              <input
                type="email"
                placeholder="Seu email ou endereco de carteira"
                value={ownerInput}
                onChange={(e) => setOwnerInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleOwnerSubmit()}
                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/20 focus:border-[#9945FF]/40"
              />
              <button
                onClick={handleOwnerSubmit}
                className="rounded-xl bg-gradient-to-r from-[#9945FF] to-[#00D1FF] px-5 py-3 text-sm font-semibold text-white"
              >
                Ver Keys
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <span className="text-sm text-white/50">
                Keys de <span className="font-mono text-white/80">{owner}</span>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#9945FF]/80 to-[#00D1FF]/80 px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                >
                  <Plus className="h-3.5 w-3.5" /> Nova Key
                </button>
                <button
                  onClick={() => setOwner('')}
                  className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-white/40 hover:text-white/60"
                >
                  Trocar
                </button>
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-[#00D1FF]/20 bg-[#00D1FF]/[0.04] p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-lg bg-[#00D1FF]/10 p-2">
                  <Bot className="h-5 w-5 text-[#00D1FF]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white/80">Agent Memory Bridge</h2>
                  <p className="mt-1 text-sm leading-relaxed text-white/45">
                    Use estas keys para conectar Hermes, Eliza, OpenClaw, providers locais e outros agentes externos a memorias verificaveis da CongChain.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {KEY_CAPABILITIES.map(({ icon: Icon, label, detail }) => (
                  <div key={label} className="rounded-lg border border-white/[0.05] bg-black/20 p-3">
                    <Icon className="mb-2 h-4 w-4 text-[#00D1FF]/70" />
                    <p className="text-xs font-semibold text-white/70">{label}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-white/35">{detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {AGENT_CONNECTORS.map((agent) => (
                  <div key={agent.name} className="rounded-lg border border-white/[0.05] bg-black/18 px-3 py-2">
                    <p className="text-[11px] font-semibold text-[#14F195]/72">{agent.name}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-white/32">{agent.detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-white/[0.05] bg-black/25 p-3 text-xs leading-relaxed text-white/40">
                Safe boundary: esta area cria acesso para memoria verificavel. Ela nao assina, nao agenda, nao compra, nao vende e nao move fundos.
              </div>
            </div>

            {showCreateForm && (
              <div className="mb-6 space-y-4 rounded-xl border border-[#9945FF]/20 bg-[#9945FF]/5 p-5">
                <h3 className="text-sm font-semibold text-[#9945FF]">Nova API Key</h3>
                <input
                  placeholder="Nome da integracao (ex: Hermes Skill Bridge, MiniMax Agent)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/20 focus:border-[#9945FF]/40"
                />
                <div className="grid grid-cols-3 gap-2">
                  {['free', 'pro', 'enterprise'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setNewKeyPlan(p)}
                      className={`rounded-xl border py-3 text-sm font-semibold transition-all ${newKeyPlan === p ? PLAN_COLORS[p] : 'border-white/[0.06] bg-white/[0.03] text-white/40'}`}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                      <div className="mt-0.5 text-[10px] font-normal opacity-60">
                        {p === 'free' ? '100 req/dia' : p === 'pro' ? '10k req/dia' : 'Ilimitado'}
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newKeyName.trim()}
                  className="w-full rounded-xl bg-gradient-to-r from-[#9945FF] to-[#00D1FF] py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {creating ? 'Gerando...' : 'Gerar API Key'}
                </button>
              </div>
            )}

            {loading ? (
              <div className="py-12 text-center text-sm text-white/30">Carregando...</div>
            ) : keys.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/[0.08] py-16 text-center">
                <Key className="mx-auto mb-3 h-8 w-8 text-white/10" />
                <p className="text-sm text-white/30">Nenhuma key criada ainda</p>
                <button onClick={() => setShowCreateForm(true)} className="mt-4 text-xs text-[#9945FF] hover:text-[#9945FF]/80">
                  Criar primeira key
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {keys.map((k) => (
                  <div
                    key={k.id}
                    className={`rounded-xl border p-5 transition-all ${k.isActive ? 'border-white/[0.06] bg-white/[0.02]' : 'border-white/[0.03] bg-white/[0.01] opacity-50'}`}
                  >
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white/80">{k.name}</h3>
                          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${PLAN_COLORS[k.plan]}`}>
                            {k.planLabel}
                          </span>
                          {!k.isActive && <span className="text-[10px] text-red-400">REVOGADA</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-xs text-white/40">{k.keyPrefix}...</code>
                          <span className="text-[10px] text-white/22">prefixo de identificacao, nao e a key completa</span>
                        </div>
                      </div>
                      {k.isActive && (
                        <button
                          onClick={() => handleRevoke(k.id, k.name)}
                          className="rounded-lg border border-red-500/20 p-2 text-red-400/50 transition-colors hover:bg-red-500/5 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { icon: Activity, label: 'Req hoje', value: `${k.requestsToday}${k.limitReqPerDay > 0 ? `/${k.limitReqPerDay}` : ''}` },
                        { icon: Zap, label: 'Total reqs', value: k.requestsTotal.toLocaleString() },
                        { icon: Key, label: 'Memorias salvas', value: k.memoriesSaved.toLocaleString() },
                        { icon: Shield, label: 'Tokens usados', value: k.tokensUsed.toLocaleString() },
                      ].map(({ icon: Icon, label, value }) => (
                        <div key={label} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                          <Icon className="mb-1 h-3.5 w-3.5 text-white/25" />
                          <p className="text-sm font-bold text-white/70">{value}</p>
                          <p className="text-[10px] uppercase tracking-wider text-white/25">{label}</p>
                        </div>
                      ))}
                    </div>

                    {k.isActive && (
                      <div>
                        <button
                          onClick={() => setShowExample((prev) => ({ ...prev, [k.id]: prev[k.id] ? '' : 'show' }))}
                          className="mb-2 flex items-center gap-1.5 text-[11px] text-[#9945FF]/70 transition-colors hover:text-[#9945FF]"
                        >
                          {showExample[k.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {showExample[k.id] ? 'Ocultar exemplo' : 'Ver exemplo de conexao'}
                        </button>
                        {showExample[k.id] && (
                          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/30">
                            <div className="flex border-b border-white/[0.06]">
                              {(['curl', 'typescript', 'python'] as const).map((lang) => (
                                <button
                                  key={lang}
                                  onClick={() => setExampleLang(lang)}
                                  className={`px-4 py-2 font-mono text-[11px] transition-colors ${exampleLang === lang ? 'border-b border-[#9945FF] bg-[#9945FF]/5 text-[#9945FF]' : 'text-white/30 hover:text-white/50'}`}
                                >
                                  {lang}
                                </button>
                              ))}
                              <button
                                onClick={() => copy(CODE_EXAMPLES[exampleLang](FULL_KEY_PLACEHOLDER), `code-${k.id}`)}
                                className="ml-auto px-3 py-2 text-white/25 transition-colors hover:text-white/50"
                              >
                                {copied === `code-${k.id}` ? <Check className="h-3.5 w-3.5 text-[#14F195]" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                            <pre className="overflow-x-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-white/60">
                              {CODE_EXAMPLES[exampleLang](FULL_KEY_PLACEHOLDER)}
                            </pre>
                            <div className="border-t border-white/[0.06] px-4 py-2 text-[11px] text-yellow-300/55">
                              Troque {FULL_KEY_PLACEHOLDER} pela key completa exibida uma unica vez ao criar uma nova key.
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <div className="mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400/60" />
                <h3 className="text-sm font-semibold text-white/60">Guia do Agent Memory Bridge</h3>
              </div>
              <div className="space-y-3 text-sm leading-relaxed text-white/40">
                <p><strong className="text-white/60">1. Criar key</strong> - gere uma API key para Mythos, Hermes, Eliza, OpenClaw ou outro agente externo nesta pagina.</p>
                <p><strong className="text-white/60">2. Salvar memoria</strong> - <code className="font-mono text-xs text-[#9945FF]/70">POST /api/memory/write</code> com <code className="font-mono text-xs">Authorization: Bearer sua_key</code> e metadata do agente.</p>
                <p><strong className="text-white/60">3. Recuperar por hash</strong> - <code className="font-mono text-xs text-[#9945FF]/70">GET /api/memory/{'{hash}'}</code> para revisar a memoria gravada.</p>
                <p><strong className="text-white/60">4. Prova e anchor</strong> - <code className="font-mono text-xs text-[#9945FF]/70">GET /api/memory/{'{hash}'}/proof</code> e <code className="font-mono text-xs text-[#9945FF]/70">POST /api/blockchain/store</code> quando o agente pedir explicitamente.</p>
                <p><strong className="text-white/60">5. Medir uso</strong> - acompanhe requisicoes, memorias salvas, tokens usados e limites por plano em cada key.</p>
                <p><strong className="text-white/60">6. Revogar acesso</strong> - desative uma key quando um agente, ambiente local ou provider nao deve mais gravar memoria.</p>
                <p><strong className="text-white/60">7. Limite de seguranca</strong> - nunca envie secrets, private keys, seed phrases, signed payloads ou dados que autorizem movimentacao financeira.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
