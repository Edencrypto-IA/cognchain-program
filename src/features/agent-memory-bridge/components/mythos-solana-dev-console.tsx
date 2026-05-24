'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Save,
  ShieldCheck,
  TerminalSquare,
  Wrench,
  Zap,
} from 'lucide-react';
import { MYTHOS_AGENT_PROFILE, MYTHOS_RUNTIME_PROOF } from '../mythos';

type DemoMode = 'transaction' | 'anchor' | 'rpc';
type Cluster = 'mainnet' | 'devnet';

type EvidenceItem = {
  label: string;
  value: string;
  status: 'ready' | 'review' | 'blocked';
};

type EngineResult = {
  ok: true;
  mode: DemoMode;
  cluster: Cluster;
  subject: string;
  analysis: string;
  fallbackUsed: boolean;
  evidence: EvidenceItem[];
  cognitiveTrace: {
    perception: string;
    evidenceUsed: string;
    skill: string;
    decision: string;
    prediction: string;
    safetyBoundary: string;
    nextHumanStep: string;
  };
  observability: {
    provider: 'helius' | 'solana-rpc';
    rpcConfigured: boolean;
    model: string;
    modelLabel: string;
    latencyMs: number;
    timestamp: string;
  };
  memoryDraft: {
    content: string;
    model: string;
    metadata: Record<string, unknown>;
  };
  safety: {
    readOnlyRpc: true;
    storesSecrets: false;
    canMoveFunds: false;
    requiresHumanReview: true;
  };
};

type SaveResult = {
  hash?: string;
  proofUrl?: string;
  readUrl?: string;
  verifyUrl?: string;
  message?: string;
};

const MODES: Array<{
  id: DemoMode;
  title: string;
  eyebrow: string;
  description: string;
  placeholder: string;
  endpoint: string;
  skill: string;
  value: string;
}> = [
  {
    id: 'transaction',
    title: 'Analyze Transaction',
    eyebrow: 'TX DEBUG',
    description: 'Paste a Solana transaction signature or describe a failed transaction. Mythos fetches read-only RPC evidence.',
    placeholder: 'Paste tx signature or describe the failure, e.g. "custom program error 0x1 after token transfer"...',
    endpoint: '/api/mythos/solana/analyze-transaction',
    skill: 'solana-tx-inspector',
    value: 'Best for support teams, RPC providers, wallets, and Solana app developers.',
  },
  {
    id: 'anchor',
    title: 'Debug Anchor Program',
    eyebrow: 'PROGRAM REVIEW',
    description: 'Paste an Anchor error, program ID, or repo context. Mythos checks program/account evidence when available.',
    placeholder: 'Paste Anchor error, logs, program ID, or a short repo/debug description...',
    endpoint: '/api/mythos/solana/debug-anchor',
    skill: 'forge-lsp + solana-anchor-schema-validator',
    value: 'Best for Solana devrel, audits, hackathon projects, and protocol engineering teams.',
  },
  {
    id: 'rpc',
    title: 'Explain Wallet/RPC Issue',
    eyebrow: 'RPC + WALLET',
    description: 'Describe a wallet, RPC, webhook, priority fee, or indexing issue. Mythos probes safe RPC status evidence.',
    placeholder: 'Describe the user-facing issue, RPC response, wallet behavior, or webhook problem...',
    endpoint: '/api/mythos/solana/explain-rpc',
    skill: 'solana-wallet-ecosystem-bridge',
    value: 'Best for infrastructure teams such as RPC providers, wallet teams, and ecosystem support.',
  },
];

const KILLER_POINTS = [
  'Solana-native debugging surface instead of generic chat.',
  'Helius or Solana RPC evidence stays server-side and redacted.',
  'Every approved analysis can become hash-addressable CongChain memory.',
  'Another agent can continue from the proof instead of restarting context.',
  'No wallet signing, funds movement, provider secrets, or hidden credentials.',
];

function short(value: string, length = 18) {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function statusClass(status: EvidenceItem['status']) {
  if (status === 'ready') return 'border-[#14F195]/18 bg-[#14F195]/[0.06] text-[#14F195]';
  if (status === 'blocked') return 'border-[#FF5C8A]/18 bg-[#FF5C8A]/[0.06] text-[#FF7AA2]';
  return 'border-[#FACC15]/18 bg-[#FACC15]/[0.06] text-[#FACC15]';
}

function buildLocalBrief(mode: typeof MODES[number], input: string, cluster: Cluster) {
  return [
    'Mythos Solana Developer Brief',
    `Mode: ${mode.title}`,
    `Cluster: ${cluster}`,
    `Governing skill: ${mode.skill}`,
    `Subject: ${input.trim() || `Demo request for ${mode.title}`}`,
    '',
    'Engine:',
    'Run real analysis to fetch server-side RPC/Helius evidence and generate a Mythos decision trace.',
    '',
    'Safety:',
    'Read-only RPC only. No wallet signing, no transaction submission, no private keys, no seed phrases, no automatic memory write.',
  ].join('\n');
}

export default function MythosSolanaDevConsole() {
  const [mode, setMode] = useState<DemoMode>('transaction');
  const [cluster, setCluster] = useState<Cluster>('mainnet');
  const [model, setModel] = useState('nvidia');
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [result, setResult] = useState<EngineResult | null>(null);
  const [saved, setSaved] = useState<SaveResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const active = MODES.find(item => item.id === mode) || MODES[0];
  const localBrief = useMemo(() => buildLocalBrief(active, input, cluster), [active, input, cluster]);
  const copyText = result ? result.memoryDraft.content : localBrief;

  async function runAnalysis() {
    setError('');
    setSaved(null);
    setLoading(true);
    try {
      const response = await fetch(active.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, cluster, model }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Mythos Solana engine failed.');
      }
      setResult(data as EngineResult);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Mythos Solana engine failed.');
    } finally {
      setLoading(false);
    }
  }

  async function copyReport() {
    await navigator.clipboard?.writeText(copyText).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function saveMemory() {
    if (!result || !apiKey.trim()) {
      setError('Paste a CongChain API key before saving memory.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const response = await fetch('/api/memory/write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(result.memoryDraft),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Memory write failed.');
      }
      setSaved(data as SaveResult);
      setApiKey('');
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Memory write failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#05050b] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a href="/mythos" className="inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white/80">
            <ArrowLeft className="h-4 w-4" />
            Back to Mythos
          </a>
          <div className="flex flex-wrap gap-2">
            <a href="/mythos/lab" className="inline-flex items-center gap-2 rounded-xl border border-[#76FF03]/20 bg-[#76FF03]/10 px-3 py-2 text-xs font-bold text-[#A7FF3D]">
              <TerminalSquare className="h-4 w-4" />
              Mythos Lab
            </a>
            <a href="/brain?view=agents&agent=mythos" className="inline-flex items-center gap-2 rounded-xl border border-[#14F195]/20 bg-[#14F195]/10 px-3 py-2 text-xs font-bold text-[#14F195]">
              <Brain className="h-4 w-4" />
              Memory Brain
            </a>
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-[#76FF03]/25 bg-[radial-gradient(circle_at_top_left,rgba(118,255,3,0.15),transparent_34%),linear-gradient(135deg,rgba(7,20,8,0.96),rgba(4,5,10,0.98))]">
          <div className="grid gap-6 p-5 lg:grid-cols-[220px_1fr] lg:p-7">
            <div className="flex items-center justify-center">
              <div className="h-44 w-44 overflow-hidden rounded-full border border-[#76FF03]/35 bg-black shadow-[0_0_60px_rgba(118,255,3,0.22)]">
                <img src={MYTHOS_AGENT_PROFILE.image} alt="" className="h-full w-full object-cover" />
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-[#76FF03]/24 bg-[#76FF03]/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#A7FF3D]">
                  Real Solana engine
                </span>
                <span className="rounded-full border border-[#5AD7FF]/20 bg-[#5AD7FF]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#7DE4FF]">
                  Helius-ready
                </span>
              </div>
              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
                Mythos for Solana Developers
              </h1>
              <p className="mt-4 max-w-4xl text-sm leading-6 text-white/62 sm:text-base">
                A focused console for transaction debugging, Anchor program review, wallet/RPC explanations, and hash-addressable CongChain memory.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ['Memory proof', short(MYTHOS_RUNTIME_PROOF.shortHash, 16)],
                  ['Runtime skills', `${MYTHOS_RUNTIME_PROOF.totalRuntimeSkillsEnabled} enabled`],
                  ['CongChain skills', `${MYTHOS_RUNTIME_PROOF.installedCongChainSkills} installed`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-black/26 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/34">{label}</p>
                    <p className="mt-1 text-sm font-bold text-white/78">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-2xl border border-[#76FF03]/18 bg-[#071008] p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Choose a Solana workflow</p>
            <div className="mt-4 grid gap-3">
              {MODES.map(item => {
                const selected = item.id === mode;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setMode(item.id);
                      setResult(null);
                      setSaved(null);
                      setError('');
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? 'border-[#76FF03]/35 bg-[#76FF03]/10'
                        : 'border-white/8 bg-black/24 hover:border-white/14 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#76FF03]">{item.eyebrow}</p>
                        <h2 className="mt-1 text-base font-black text-white">{item.title}</h2>
                      </div>
                      {selected ? <CheckCircle2 className="h-5 w-5 text-[#76FF03]" /> : <Wrench className="h-5 w-5 text-white/28" />}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/50">{item.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-black/24 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/34">Engine controls</p>
              <div className="mt-3 grid gap-3">
                <select
                  value={cluster}
                  onChange={event => setCluster(event.target.value as Cluster)}
                  className="h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none"
                >
                  <option value="mainnet">Mainnet RPC</option>
                  <option value="devnet">Devnet RPC</option>
                </select>
                <select
                  value={model}
                  onChange={event => setModel(event.target.value)}
                  className="h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none"
                >
                  <option value="nvidia">NVIDIA</option>
                  <option value="glm">GLM</option>
                  <option value="qwen">Qwen</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="gpt">GPT</option>
                  <option value="claude">Claude</option>
                </select>
              </div>
            </div>
          </aside>

          <div className="grid gap-4">
            <section className="rounded-2xl border border-[#5AD7FF]/18 bg-[radial-gradient(circle_at_top_right,rgba(90,215,255,0.10),transparent_30%),rgba(5,10,14,0.90)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7DE4FF]">{active.eyebrow}</p>
                  <h2 className="mt-1 text-2xl font-black">{active.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/52">{active.value}</p>
                </div>
                <span className="rounded-xl border border-[#14F195]/18 bg-[#14F195]/10 px-3 py-2 text-xs font-bold text-[#14F195]">
                  Skill: {active.skill}
                </span>
              </div>

              <textarea
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder={active.placeholder}
                className="mt-4 min-h-[128px] w-full resize-none rounded-2xl border border-white/10 bg-black/34 p-4 text-sm leading-6 text-white/78 outline-none transition placeholder:text-white/25 focus:border-[#76FF03]/35"
              />

              {error ? (
                <div className="mt-3 rounded-xl border border-[#FF5C8A]/20 bg-[#FF5C8A]/[0.06] p-3 text-sm text-[#FF9BB7]">
                  {error}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={runAnalysis}
                  disabled={loading}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#76FF03]/25 bg-[#76FF03]/12 px-4 text-sm font-bold text-[#A7FF3D] transition hover:bg-[#76FF03]/18 disabled:cursor-wait disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {loading ? 'Running engine' : 'Run real analysis'}
                </button>
                <button
                  type="button"
                  onClick={copyReport}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white/68 transition hover:bg-white/[0.07]"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copied' : 'Copy report'}
                </button>
                <a
                  href="/dashboard/keys"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#5AD7FF]/20 bg-[#5AD7FF]/10 px-4 text-sm font-bold text-[#7DE4FF] transition hover:bg-[#5AD7FF]/15"
                >
                  <KeyRound className="h-4 w-4" />
                  Create agent key
                </a>
              </div>
            </section>

            {result ? (
              <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
                <div className="rounded-2xl border border-white/8 bg-black/26 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/38">Mythos analysis</p>
                      <h3 className="mt-1 text-xl font-black">{result.subject}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-xl border border-[#14F195]/18 bg-[#14F195]/10 px-3 py-2 text-xs font-bold text-[#14F195]">
                        {result.observability.provider}
                      </span>
                      <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/62">
                        {result.observability.latencyMs}ms
                      </span>
                    </div>
                  </div>
                  <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/8 bg-[#030306] p-4 text-sm leading-6 text-white/72">
                    {result.analysis}
                  </pre>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {result.evidence.map(item => (
                      <div key={`${item.label}-${item.value}`} className="rounded-2xl border border-white/8 bg-black/24 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/34">{item.label}</p>
                          <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${statusClass(item.status)}`}>
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-2 break-words text-xs leading-5 text-white/58">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <aside className="grid gap-4">
                  <div className="rounded-2xl border border-[#14F195]/18 bg-[#14F195]/[0.035] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#14F195]">Cognitive trace</p>
                    {Object.entries(result.cognitiveTrace).map(([label, value]) => (
                      <div key={label} className="mt-3 rounded-xl border border-white/8 bg-black/20 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/34">{label}</p>
                        <p className="mt-1 text-xs leading-5 text-white/58">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-[#76FF03]/18 bg-[#071008] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Save as CongChain memory</p>
                    <p className="mt-2 text-xs leading-5 text-white/50">
                      Saving requires your CongChain agent key. The key is sent once to the server and is not displayed back.
                    </p>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={event => setApiKey(event.target.value)}
                      placeholder="cog_live_..."
                      className="mt-3 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-white/22"
                    />
                    <button
                      type="button"
                      onClick={saveMemory}
                      disabled={saving || !result}
                      className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#76FF03]/25 bg-[#76FF03]/12 px-4 text-sm font-bold text-[#A7FF3D] transition hover:bg-[#76FF03]/18 disabled:cursor-wait disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {saving ? 'Saving memory' : 'Save to CongChain'}
                    </button>
                    {saved?.hash ? (
                      <div className="mt-3 rounded-xl border border-[#14F195]/18 bg-[#14F195]/[0.06] p-3">
                        <p className="text-xs font-bold text-[#14F195]">Memory saved</p>
                        <p className="mt-1 break-all font-mono text-xs text-white/62">{saved.hash}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {saved.readUrl ? <a className="text-xs font-bold text-[#7DE4FF]" href={saved.readUrl}>Read</a> : null}
                          {saved.verifyUrl ? <a className="text-xs font-bold text-[#7DE4FF]" href={saved.verifyUrl}>Verify</a> : null}
                          {saved.proofUrl ? <a className="text-xs font-bold text-[#7DE4FF]" href={saved.proofUrl}>Proof</a> : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </aside>
              </section>
            ) : (
              <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
                <div className="rounded-2xl border border-white/8 bg-black/26 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-white/38">Before running</p>
                  <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl border border-white/8 bg-[#030306] p-4 text-xs leading-6 text-white/64">
                    {localBrief}
                  </pre>
                </div>

                <aside className="rounded-2xl border border-[#FACC15]/18 bg-[#FACC15]/[0.045] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FACC15]">Why Solana infra teams care</p>
                  <div className="mt-4 space-y-3">
                    {KILLER_POINTS.map(point => (
                      <div key={point} className="flex gap-3 rounded-xl border border-white/8 bg-black/22 p-3 text-xs leading-5 text-white/56">
                        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#14F195]" />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-[#FF5C8A]/14 bg-[#FF5C8A]/[0.04] p-3">
                    <div className="flex gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#FF7AA2]" />
                      <p className="text-xs leading-5 text-white/56">
                        Helius and model keys must stay in Railway/server environment variables. Never paste provider keys into this browser UI.
                      </p>
                    </div>
                  </div>
                </aside>
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
