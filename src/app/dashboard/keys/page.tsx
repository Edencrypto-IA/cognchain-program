'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Key, Plus, Trash2, Copy, Check, ArrowLeft,
  Shield, Zap, Activity, AlertTriangle, Eye, EyeOff,
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
  free:       'bg-white/5 text-white/50 border-white/10',
  pro:        'bg-[#9945FF]/10 text-[#9945FF] border-[#9945FF]/30',
  enterprise: 'bg-[#14F195]/10 text-[#14F195] border-[#14F195]/30',
};

const CODE_EXAMPLES = {
  curl: (key: string) => `curl -X POST https://cognchain.xyz/api/save-memory \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"content":"Insight from my agent","model":"gpt"}'`,

  typescript: (key: string) => `const response = await fetch('https://cognchain.xyz/api/save-memory', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${key}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ content: 'Insight from my agent', model: 'gpt' }),
});
const { hash } = await response.json();
// hash = '202fe03d...' — permanent, verifiable on Solana`,

  python: (key: string) => `import requests

r = requests.post('https://cognchain.xyz/api/save-memory',
  headers={'Authorization': f'Bearer ${key}'},
  json={'content': 'Insight from my agent', 'model': 'gpt'}
)
hash = r.json()['hash']  # permanent Solana memory`,
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
    } catch { /* silent */ }
    finally { setLoading(false); }
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
    } catch { /* silent */ }
    finally { setCreating(false); }
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

        {/* Header */}
        <div className="mb-8">
          <button onClick={() => router.push('/')}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/60 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Chat
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-gradient-to-br from-[#9945FF]/20 to-[#00D1FF]/20 p-3">
              <Key className="h-6 w-6 text-[#9945FF]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white/90">API Keys</h1>
              <p className="text-sm text-white/40">Integre agentes externos com o CognChain</p>
            </div>
          </div>
        </div>

        {/* Novo key criado — mostrar UMA VEZ */}
        {createdKey && (
          <div className="mb-6 rounded-xl border border-[#14F195]/30 bg-[#14F195]/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-[#14F195]" />
              <span className="text-sm font-semibold text-[#14F195]">Chave criada — salve agora!</span>
              <span className="text-xs text-[#14F195]/60">Esta é a única vez que ela aparece.</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#14F195]/20 bg-black/30 px-4 py-3">
              <code className="flex-1 font-mono text-sm text-[#14F195] break-all">{createdKey}</code>
              <button onClick={() => copy(createdKey, 'new-key')}
                className="ml-2 flex-shrink-0 rounded-lg bg-[#14F195]/10 p-2 text-[#14F195] hover:bg-[#14F195]/20 transition-colors">
                {copied === 'new-key' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <button onClick={() => setCreatedKey(null)} className="mt-3 text-xs text-white/30 hover:text-white/50">
              Já salvei, pode fechar ×
            </button>
          </div>
        )}

        {/* Owner lookup */}
        {!owner ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6">
            <h2 className="mb-4 text-sm font-semibold text-white/60 uppercase tracking-wider">Identificação</h2>
            <div className="flex gap-3">
              <input
                type="email"
                placeholder="Seu email ou endereço de carteira"
                value={ownerInput}
                onChange={e => setOwnerInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleOwnerSubmit()}
                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-[#9945FF]/40"
              />
              <button onClick={handleOwnerSubmit}
                className="rounded-xl bg-gradient-to-r from-[#9945FF] to-[#00D1FF] px-5 py-3 text-sm font-semibold text-white">
                Ver Keys
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Owner bar */}
            <div className="mb-6 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <span className="text-sm text-white/50">Keys de <span className="text-white/80 font-mono">{owner}</span></span>
              <div className="flex gap-2">
                <button onClick={() => setShowCreateForm(!showCreateForm)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#9945FF]/80 to-[#00D1FF]/80 px-4 py-2 text-xs font-semibold text-white hover:opacity-90">
                  <Plus className="h-3.5 w-3.5" /> Nova Key
                </button>
                <button onClick={() => setOwner('')}
                  className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-white/40 hover:text-white/60">
                  Trocar
                </button>
              </div>
            </div>

            {/* Create form */}
            {showCreateForm && (
              <div className="mb-6 rounded-xl border border-[#9945FF]/20 bg-[#9945FF]/5 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-[#9945FF]">Nova API Key</h3>
                <input
                  placeholder="Nome da integração (ex: MiniMax Agent, OpenClaw Bot)"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-[#9945FF]/40"
                />
                <div className="grid grid-cols-3 gap-2">
                  {['free', 'pro', 'enterprise'].map(p => (
                    <button key={p} onClick={() => setNewKeyPlan(p)}
                      className={`rounded-xl border py-3 text-sm font-semibold transition-all ${newKeyPlan === p ? PLAN_COLORS[p] : 'border-white/[0.06] bg-white/[0.03] text-white/40'}`}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                      <div className="text-[10px] font-normal mt-0.5 opacity-60">
                        {p === 'free' ? '100 req/dia' : p === 'pro' ? '10k req/dia' : 'Ilimitado'}
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={handleCreate} disabled={creating || !newKeyName.trim()}
                  className="w-full rounded-xl bg-gradient-to-r from-[#9945FF] to-[#00D1FF] py-3 text-sm font-semibold text-white disabled:opacity-50">
                  {creating ? 'Gerando...' : 'Gerar API Key'}
                </button>
              </div>
            )}

            {/* Keys list */}
            {loading ? (
              <div className="py-12 text-center text-white/30 text-sm">Carregando...</div>
            ) : keys.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/[0.08] py-16 text-center">
                <Key className="mx-auto mb-3 h-8 w-8 text-white/10" />
                <p className="text-sm text-white/30">Nenhuma key criada ainda</p>
                <button onClick={() => setShowCreateForm(true)}
                  className="mt-4 text-xs text-[#9945FF] hover:text-[#9945FF]/80">
                  Criar primeira key →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {keys.map(k => (
                  <div key={k.id} className={`rounded-xl border p-5 transition-all ${k.isActive ? 'border-white/[0.06] bg-white/[0.02]' : 'border-white/[0.03] bg-white/[0.01] opacity-50'}`}>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-white/80">{k.name}</h3>
                          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${PLAN_COLORS[k.plan]}`}>
                            {k.planLabel}
                          </span>
                          {!k.isActive && <span className="text-[10px] text-red-400">REVOGADA</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-xs text-white/40">{k.keyPrefix}...</code>
                          <button onClick={() => copy(k.keyPrefix + '...', k.id)}
                            className="text-white/20 hover:text-white/50 transition-colors">
                            {copied === k.id ? <Check className="h-3 w-3 text-[#14F195]" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                      {k.isActive && (
                        <button onClick={() => handleRevoke(k.id, k.name)}
                          className="rounded-lg border border-red-500/20 p-2 text-red-400/50 hover:bg-red-500/5 hover:text-red-400 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      {[
                        { icon: Activity, label: 'Req hoje', value: `${k.requestsToday}${k.limitReqPerDay > 0 ? `/${k.limitReqPerDay}` : ''}` },
                        { icon: Zap, label: 'Total reqs', value: k.requestsTotal.toLocaleString() },
                        { icon: Key, label: 'Memórias salvas', value: k.memoriesSaved.toLocaleString() },
                        { icon: Shield, label: 'Tokens usados', value: k.tokensUsed.toLocaleString() },
                      ].map(({ icon: Icon, label, value }) => (
                        <div key={label} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                          <Icon className="h-3.5 w-3.5 text-white/25 mb-1" />
                          <p className="text-sm font-bold text-white/70">{value}</p>
                          <p className="text-[10px] text-white/25 uppercase tracking-wider">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Code example toggle */}
                    {k.isActive && (
                      <div>
                        <button
                          onClick={() => setShowExample(prev => ({ ...prev, [k.id]: prev[k.id] ? '' : 'show' }))}
                          className="flex items-center gap-1.5 text-[11px] text-[#9945FF]/70 hover:text-[#9945FF] transition-colors mb-2">
                          {showExample[k.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {showExample[k.id] ? 'Ocultar exemplo' : 'Ver exemplo de integração'}
                        </button>
                        {showExample[k.id] && (
                          <div className="rounded-xl border border-white/[0.06] bg-black/30 overflow-hidden">
                            <div className="flex border-b border-white/[0.06]">
                              {(['curl', 'typescript', 'python'] as const).map(lang => (
                                <button key={lang} onClick={() => setExampleLang(lang)}
                                  className={`px-4 py-2 text-[11px] font-mono transition-colors ${exampleLang === lang ? 'text-[#9945FF] bg-[#9945FF]/5 border-b border-[#9945FF]' : 'text-white/30 hover:text-white/50'}`}>
                                  {lang}
                                </button>
                              ))}
                              <button onClick={() => copy(CODE_EXAMPLES[exampleLang](k.keyPrefix + '...'), `code-${k.id}`)}
                                className="ml-auto px-3 py-2 text-white/25 hover:text-white/50 transition-colors">
                                {copied === `code-${k.id}` ? <Check className="h-3.5 w-3.5 text-[#14F195]" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                            <pre className="p-4 text-xs font-mono text-white/60 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                              {CODE_EXAMPLES[exampleLang](k.keyPrefix + '...')}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Integration guide */}
            <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-yellow-400/60" />
                <h3 className="text-sm font-semibold text-white/60">Guia de Integração</h3>
              </div>
              <div className="space-y-3 text-sm text-white/40 leading-relaxed">
                <p><strong className="text-white/60">1. Salvar memória</strong> — <code className="font-mono text-[#9945FF]/70 text-xs">POST /api/save-memory</code> com o header <code className="font-mono text-xs">Authorization: Bearer sua_key</code></p>
                <p><strong className="text-white/60">2. Recuperar por hash</strong> — <code className="font-mono text-[#9945FF]/70 text-xs">GET /api/memory/{'{hash}'}</code> — sem autenticação (hashes são públicos)</p>
                <p><strong className="text-white/60">3. Buscar memórias</strong> — <code className="font-mono text-[#9945FF]/70 text-xs">GET /api/memory/timeline</code> — lista memórias verificadas</p>
                <p><strong className="text-white/60">4. Cadeia cross-model</strong> — passe o hash na mensagem do usuário; o CognChain injeta automaticamente o contexto verificado com abertura especial</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
