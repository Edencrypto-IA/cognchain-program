'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  Coins,
  Copy,
  Gauge,
  KeyRound,
  Loader2,
  Radar,
  Save,
  ShieldCheck,
  TerminalSquare,
  Wallet,
  Wrench,
  Zap,
} from 'lucide-react';
import { MYTHOS_AGENT_PROFILE, MYTHOS_RUNTIME_PROOF } from '../mythos';

type DemoMode = 'transaction' | 'wallet' | 'token' | 'anchor' | 'rpc';
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
  risk: {
    level: 'safe' | 'low_data' | 'suspicious' | 'exploit_risk' | 'review';
    score: number;
    confidenceBps: number;
    memoryMatchBps: number;
    userLabel: string;
    summary: string;
    signals: string[];
    plainEnglish: string;
    nextSafeStep: string;
  };
  chainMonitor: {
    status: 'live' | 'degraded' | 'review';
    cluster: Cluster;
    provider: 'helius' | 'solana-rpc';
    slotLabel: string;
    blockHeightLabel: string;
    versionLabel: string;
  };
  memoryReplay: {
    pattern: string;
    previousMatches: number;
    likelyCause: string;
    confidenceBps: number;
  };
  patchExample?: string;
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

type InfoRow = {
  label: string;
  value: string;
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
    title: 'Explain Transaction',
    eyebrow: 'TX DEBUG',
    description: 'Paste a Solana transaction signature or describe a failed transaction. Mythos fetches read-only RPC evidence.',
    placeholder: 'Paste tx signature or describe the failure, e.g. "custom program error 0x1 after token transfer"...',
    endpoint: '/api/mythos/solana/analyze-transaction',
    skill: 'solana-tx-inspector',
    value: 'Best for support teams, RPC providers, wallets, and Solana app developers.',
  },
  {
    id: 'wallet',
    title: 'Wallet Intelligence',
    eyebrow: 'WALLET RISK',
    description: 'Paste a Phantom/Solflare wallet address. Mythos reviews balance, recent activity, token exposure, failures, and trade signals.',
    placeholder: 'Paste wallet address, e.g. a Phantom or Solflare public address...',
    endpoint: '/api/mythos/solana/analyze-wallet',
    skill: 'solana-wallet-intelligence',
    value: 'Best for user support, wallet trust review, token exposure checks, and activity profiling.',
  },
  {
    id: 'token',
    title: 'Token Risk Scanner',
    eyebrow: 'MINT SCAN',
    description: 'Paste a token mint address. Mythos checks supply, mint/freeze authority, holder concentration, and recent activity.',
    placeholder: 'Paste token mint address...',
    endpoint: '/api/mythos/solana/analyze-token',
    skill: 'solana-token-risk-scanner',
    value: 'Best for token due diligence, holder distribution review, authority checks, and rug-risk triage.',
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
  'Solana-native copilot surface instead of generic chat.',
  'Helius or Solana RPC evidence stays server-side and redacted.',
  'Every approved analysis can become hash-addressable CongChain memory.',
  'Another agent can continue from the proof instead of restarting context.',
  'No wallet signing, funds movement, provider secrets, or hidden credentials.',
  'Wallet and token reviews are risk intelligence only, never investment advice.',
];

const LIVE_LOGS = [
  '[PERCEPTION] Solana input classified',
  '[EVIDENCE] Read-only RPC proof collected',
  '[PREDICTION] Risk pattern compared with memory replay',
  '[MEMORY] Ready for CongChain hash if approved',
];

const CONTROL_LAYERS = [
  {
    title: 'Connect',
    copy: 'Paste a public transaction, wallet, token mint, Anchor log, or RPC issue. No private key or wallet signature is requested.',
  },
  {
    title: 'Analyze',
    copy: 'Mythos reads public chain evidence, provider status, program signals, token exposure, and memory patterns.',
  },
  {
    title: 'Explain',
    copy: 'The result is split into human explanation, Solana developer evidence, risk signals, and a next safe step.',
  },
  {
    title: 'Remember',
    copy: 'Only after review, the user can write a hash-addressable CongChain memory for future agents to reuse.',
  },
];

function short(value: string, length = 18) {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function statusClass(status: EvidenceItem['status']) {
  if (status === 'ready') return 'border-[#14F195]/18 bg-[#14F195]/[0.06] text-[#14F195]';
  if (status === 'blocked') return 'border-[#FF5C8A]/18 bg-[#FF5C8A]/[0.06] text-[#FF7AA2]';
  return 'border-[#FACC15]/18 bg-[#FACC15]/[0.06] text-[#FACC15]';
}

function riskClass(level: EngineResult['risk']['level']) {
  if (level === 'safe') return 'border-[#14F195]/24 bg-[#14F195]/[0.08] text-[#14F195]';
  if (level === 'low_data') return 'border-[#5AD7FF]/24 bg-[#5AD7FF]/[0.08] text-[#7DE4FF]';
  if (level === 'review') return 'border-[#FACC15]/24 bg-[#FACC15]/[0.08] text-[#FACC15]';
  if (level === 'suspicious') return 'border-[#FF8A3D]/24 bg-[#FF8A3D]/[0.08] text-[#FFB36D]';
  return 'border-[#FF5C8A]/24 bg-[#FF5C8A]/[0.08] text-[#FF7AA2]';
}

function riskLabel(level: EngineResult['risk']['level']) {
  if (level === 'safe') return 'SAFE';
  if (level === 'low_data') return 'LOW DATA';
  if (level === 'review') return 'REVIEW';
  if (level === 'suspicious') return 'SUSPICIOUS';
  return 'EXPLOIT RISK';
}

function walletMeaning(result: EngineResult) {
  if (result.mode !== 'wallet') return null;
  if (result.risk.level === 'low_data') {
    return {
      title: 'This wallet is mostly blank',
      tone: 'border-[#5AD7FF]/18 bg-[#5AD7FF]/[0.055] text-[#7DE4FF]',
      copy:
        'For a normal user, this means Mythos found almost no public history: no SOL, no token balances, and no recent transactions. That is not an exploit signal by itself. It is simply not enough evidence to trust or profile the wallet yet.',
    };
  }
  if (result.risk.level === 'safe') {
    return {
      title: 'No obvious wallet danger from sampled data',
      tone: 'border-[#14F195]/18 bg-[#14F195]/[0.055] text-[#14F195]',
      copy:
        'Mythos found enough normal public evidence to avoid a warning label. Still verify the address source before sending funds or linking it to an account.',
    };
  }
  if (result.risk.level === 'suspicious' || result.risk.level === 'exploit_risk') {
    return {
      title: 'Wallet needs careful review',
      tone: 'border-[#FF8A3D]/18 bg-[#FF8A3D]/[0.055] text-[#FFB36D]',
      copy:
        'Mythos saw signals that deserve human review, such as failures, broad token exposure, unusual program activity, or incomplete RPC evidence. Do not treat this as a buy/sell decision.',
    };
  }
  return {
    title: 'Wallet review is incomplete',
    tone: 'border-[#FACC15]/18 bg-[#FACC15]/[0.055] text-[#FACC15]',
    copy:
      'Some public evidence is missing or uncertain. Verify the address, network, and recent activity in a trusted explorer before relying on the result.',
  };
}

function evidenceValue(result: EngineResult, label: string) {
  return result.evidence.find(item => item.label.toLowerCase() === label.toLowerCase())?.value || 'not available';
}

function evidenceStatus(result: EngineResult, label: string): EvidenceItem['status'] {
  return result.evidence.find(item => item.label.toLowerCase() === label.toLowerCase())?.status || 'review';
}

function cleanModelText(value: string) {
  return value
    .replace(/\*\*/g, '')
    .replace(/^\s*[-*]\s+/gm, '- ')
    .trim();
}

function modeExplainer(result: EngineResult) {
  if (result.mode === 'transaction') {
    return {
      title: 'Transaction readout',
      subtitle: evidenceValue(result, 'Failure class'),
      primary: 'What happened',
      primaryValue: evidenceValue(result, 'User impact'),
      secondary: 'Programs involved',
      secondaryValue: evidenceValue(result, 'Program families'),
      action: result.risk.nextSafeStep,
    };
  }

  if (result.mode === 'wallet') {
    return {
      title: 'Wallet readout',
      subtitle: evidenceValue(result, 'Wallet profile'),
      primary: 'Public activity',
      primaryValue: evidenceValue(result, 'Wallet digest'),
      secondary: 'Token exposure',
      secondaryValue: evidenceValue(result, 'Token diversity'),
      action: result.risk.nextSafeStep,
    };
  }

  if (result.mode === 'token') {
    return {
      title: 'Token readout',
      subtitle: evidenceValue(result, 'Market listing verdict'),
      primary: 'Authority check',
      primaryValue: evidenceValue(result, 'Token security verdict'),
      secondary: 'Holder distribution',
      secondaryValue: evidenceValue(result, 'Distribution verdict'),
      action: 'Review authority, holder concentration, market listing, and liquidity before trusting the token operationally.',
    };
  }

  return {
    title: 'Developer readout',
    subtitle: result.risk.userLabel,
    primary: 'Evidence state',
    primaryValue: result.risk.summary,
    secondary: 'Skill used',
    secondaryValue: result.cognitiveTrace.skill,
    action: result.risk.nextSafeStep,
  };
}

function sourceStack(result: EngineResult) {
  const sourceLabels = result.mode === 'token'
    ? ['Market data source', 'CoinMarketCap listing', 'Distribution source']
    : result.mode === 'wallet'
      ? ['RPC source', 'Solscan status', 'Token evidence source']
      : ['Transaction source', 'Solscan transaction status', 'Program families'];

  return sourceLabels.map(label => ({
    label,
    value: evidenceValue(result, label),
    status: evidenceStatus(result, label),
  }));
}

function humanReadout(result: EngineResult) {
  if (result.mode === 'transaction') {
    const status = evidenceValue(result, 'Status');
    const impact = evidenceValue(result, 'User impact');
    return {
      title: status === 'success' ? 'This transaction appears confirmed' : 'This transaction needs review',
      body: status === 'success'
        ? `For a normal user, this means the transaction was found on ${result.cluster} and the chain reported a successful status. ${impact}`
        : `For a normal user, this means Mythos found a problem or missing evidence before treating this transaction as reliable. ${impact}`,
      cannotKnow: 'Mythos cannot know the user intent, off-chain agreement, hidden app UI, private keys, or whether the user meant to approve this exact action.',
    };
  }

  if (result.mode === 'wallet') {
    return {
      title: result.risk.userLabel,
      body: result.risk.plainEnglish,
      cannotKnow: 'Mythos cannot prove who owns this wallet, cannot see private keys or seed phrases, and cannot tell whether the wallet owner intends to trade, hold, or transfer.',
    };
  }

  if (result.mode === 'token') {
    return {
      title: evidenceValue(result, 'Market listing verdict'),
      body: `For a normal user, this token review checks public evidence: supply, authorities, holder concentration, listing metadata, market data, and recent mint activity. ${result.risk.summary}`,
      cannotKnow: 'Mythos cannot prove future price, team intent, private liquidity agreements, undisclosed market makers, or whether buying this token is safe.',
    };
  }

  return {
    title: result.risk.userLabel,
    body: result.risk.plainEnglish,
    cannotKnow: 'Mythos only uses visible evidence and user-provided context. It cannot inspect private repos, private logs, secrets, or hidden infrastructure.',
  };
}

function developerReadout(result: EngineResult): InfoRow[] {
  if (result.mode === 'transaction') {
    return [
      { label: 'Failure class', value: evidenceValue(result, 'Failure class') },
      { label: 'Program families', value: evidenceValue(result, 'Program families') },
      { label: 'Compute profile', value: evidenceValue(result, 'Compute profile') },
      { label: 'Instruction path', value: evidenceValue(result, 'Instructions') },
    ];
  }

  if (result.mode === 'wallet') {
    return [
      { label: 'Account owner', value: evidenceValue(result, 'Account owner') },
      { label: 'Failure rate', value: evidenceValue(result, 'Failure rate') },
      { label: 'Program families', value: evidenceValue(result, 'Detected program families') },
      { label: 'Trade inference', value: evidenceValue(result, 'Trade inference') },
    ];
  }

  if (result.mode === 'token') {
    return [
      { label: 'Token program owner', value: evidenceValue(result, 'Token program owner') },
      { label: 'Authority verdict', value: evidenceValue(result, 'Token security verdict') },
      { label: 'Holder distribution', value: evidenceValue(result, 'Distribution verdict') },
      { label: 'Market pairs', value: evidenceValue(result, 'CMC market pairs') },
    ];
  }

  return [
    { label: 'Skill', value: result.cognitiveTrace.skill },
    { label: 'Evidence used', value: result.cognitiveTrace.evidenceUsed },
    { label: 'Decision', value: result.cognitiveTrace.decision },
    { label: 'Safety boundary', value: result.cognitiveTrace.safetyBoundary },
  ];
}

function memoryReplayRows(result: EngineResult): InfoRow[] {
  return [
    { label: 'Pattern', value: result.memoryReplay.pattern },
    { label: 'Previous cases', value: `${result.memoryReplay.previousMatches} similar patterns` },
    { label: 'Match confidence', value: `${Math.round(result.memoryReplay.confidenceBps / 100)}%` },
    { label: 'Likely cause', value: result.memoryReplay.likelyCause },
    { label: 'Replay action', value: 'Save the report only after human review so future Mythos runs can compare against this evidence.' },
  ];
}

function proofRows(result: EngineResult, saved: SaveResult | null): InfoRow[] {
  return [
    { label: 'Model', value: result.observability.modelLabel || result.observability.model },
    { label: 'Provider', value: result.observability.provider },
    { label: 'Latency', value: `${result.observability.latencyMs}ms` },
    { label: 'Evidence items', value: String(result.evidence.length) },
    { label: 'Memory status', value: saved?.hash ? 'saved to CongChain' : 'draft only' },
    { label: 'Memory hash', value: saved?.hash ? short(saved.hash, 24) : 'not saved yet' },
    { label: 'Read URL', value: saved?.readUrl || 'available after save' },
    { label: 'Verify URL', value: saved?.verifyUrl || 'available after save' },
    { label: 'Proof URL', value: saved?.proofUrl || 'available after save' },
  ];
}

function liveMonitorRows(result: EngineResult): InfoRow[] {
  return [
    { label: 'Cluster', value: result.chainMonitor.cluster },
    { label: 'Provider', value: result.chainMonitor.provider },
    { label: 'Slot', value: result.chainMonitor.slotLabel },
    { label: 'Block height', value: result.chainMonitor.blockHeightLabel },
    { label: 'Version', value: result.chainMonitor.versionLabel },
    { label: 'Runtime', value: result.chainMonitor.status },
  ];
}

function decisionRows(result: EngineResult): InfoRow[] {
  return [
    { label: 'User control', value: 'No wallet signature, transaction submission, or fund movement happened in this analysis.' },
    { label: 'Evidence quality', value: `${result.evidence.filter(item => item.status === 'ready').length}/${result.evidence.length} evidence cards are ready.` },
    { label: 'Review trigger', value: result.risk.signals[0] || result.risk.summary },
    { label: 'Human decision', value: result.risk.nextSafeStep },
  ];
}

function buildHandoffReport(result: EngineResult, saved: SaveResult | null) {
  const readyCount = result.evidence.filter(item => item.status === 'ready').length;
  const reviewCount = result.evidence.filter(item => item.status === 'review').length;
  const blockedCount = result.evidence.filter(item => item.status === 'blocked').length;

  return [
    'Mythos Solana Intelligence Report',
    `Subject: ${result.subject}`,
    `Mode: ${result.mode}`,
    `Cluster: ${result.cluster}`,
    `Risk: ${riskLabel(result.risk.level)} (${result.risk.score}/100)`,
    `AI confidence: ${Math.round(result.risk.confidenceBps / 100)}%`,
    `Memory match: ${Math.round(result.risk.memoryMatchBps / 100)}%`,
    '',
    'Plain-language explanation:',
    cleanModelText(humanReadout(result).body),
    '',
    'Developer evidence:',
    ...developerReadout(result).map(item => `- ${item.label}: ${item.value}`),
    '',
    'Evidence status:',
    `- Ready: ${readyCount}`,
    `- Review: ${reviewCount}`,
    `- Blocked: ${blockedCount}`,
    '',
    'Memory replay:',
    ...memoryReplayRows(result).map(item => `- ${item.label}: ${item.value}`),
    '',
    'Runtime proof:',
    ...proofRows(result, saved).map(item => `- ${item.label}: ${item.value}`),
    '',
    'Safety boundary:',
    '- Read-only public chain intelligence only.',
    '- No wallet signature requested.',
    '- No transaction submitted.',
    '- No buy, sell, pay, schedule, or fund movement.',
    '- Not financial advice.',
  ].join('\n');
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
  const copyText = result ? buildHandoffReport(result, saved) : localBrief;
  const walletExplainer = result ? walletMeaning(result) : null;
  const resultExplainer = result ? modeExplainer(result) : null;
  const resultSources = result ? sourceStack(result) : [];
  const resultHumanReadout = result ? humanReadout(result) : null;
  const resultDeveloperReadout = result ? developerReadout(result) : [];
  const resultReplayRows = result ? memoryReplayRows(result) : [];
  const resultProofRows = result ? proofRows(result, saved) : [];
  const resultLiveRows = result ? liveMonitorRows(result) : [];
  const resultDecisionRows = result ? decisionRows(result) : [];

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
    <main className="min-h-screen overflow-x-hidden bg-[#05050b] text-white">
      <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
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
          <div className="grid min-w-0 gap-6 p-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:p-7">
            <div className="flex items-center justify-center">
              <div className="h-44 w-44 overflow-hidden rounded-full border border-[#76FF03]/35 bg-black shadow-[0_0_60px_rgba(118,255,3,0.22)]">
                <img src={MYTHOS_AGENT_PROFILE.image} alt="" className="h-full w-full object-cover" />
              </div>
            </div>
            <div className="flex min-w-0 flex-col justify-center">
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
                AI-native observability for Solana builders: transaction debugging, wallet intelligence, token risk, Anchor review, RPC triage, and hash-addressable CongChain memory.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ['Scanning', 'Solana Mainnet'],
                  ['Learning from', `${MYTHOS_RUNTIME_PROOF.installedCongChainSkills} CongChain skills`],
                  ['Memory proof', short(MYTHOS_RUNTIME_PROOF.shortHash, 16)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-black/26 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/34">{label}</p>
                    <p className="mt-1 break-words text-sm font-bold text-white/78 [overflow-wrap:anywhere]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-[#14F195]/18 bg-[radial-gradient(circle_at_left,rgba(20,241,149,0.10),transparent_28%),rgba(3,12,9,0.86)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#14F195]">Mythos status</p>
                <h2 className="mt-1 text-2xl font-black">Scanning Solana. Learning from verifiable memory.</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-xl border border-[#14F195]/20 bg-[#14F195]/10 px-3 py-2 text-xs font-black text-[#14F195]">
                <Activity className="h-4 w-4" />
                LIVE COPILOT
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {LIVE_LOGS.map(item => (
                <div key={item} className="rounded-xl border border-white/8 bg-black/20 p-3 font-mono text-[11px] leading-5 text-white/55">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[#76FF03]/18 bg-[#071008] p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Threat system</p>
            <div className="mt-3 grid gap-2 text-xs">
              <div className="rounded-xl border border-[#14F195]/18 bg-[#14F195]/[0.05] p-3 text-[#14F195]">SAFE: normal evidence</div>
              <div className="rounded-xl border border-[#5AD7FF]/18 bg-[#5AD7FF]/[0.05] p-3 text-[#7DE4FF]">LOW DATA: too little history</div>
              <div className="rounded-xl border border-[#FACC15]/18 bg-[#FACC15]/[0.05] p-3 text-[#FACC15]">REVIEW: incomplete or uncertain</div>
              <div className="rounded-xl border border-[#FF5C8A]/18 bg-[#FF5C8A]/[0.05] p-3 text-[#FF7AA2]">EXPLOIT RISK: blocked until human review</div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#76FF03]/20 bg-[radial-gradient(circle_at_center,rgba(118,255,3,0.09),transparent_32%),linear-gradient(135deg,rgba(4,10,5,0.92),rgba(4,5,10,0.96))] p-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Wallets can sign. Mythos helps them understand.</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Information first. Signature second. Control always stays with the user.</h2>
              <p className="mt-3 text-sm leading-6 text-white/58">
                This Solana surface is designed as an intelligence layer beside Phantom, Solflare, explorers, and RPC providers. It explains public evidence before a human decides what to trust.
              </p>
              <div className="mt-4 rounded-2xl border border-[#14F195]/14 bg-[#14F195]/[0.045] p-4">
                <p className="text-sm font-black text-[#14F195]">CognChain never accesses wallet keys, never signs for the user, and never controls funds.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {CONTROL_LAYERS.map((item, index) => (
                <div key={item.title} className="rounded-2xl border border-white/8 bg-black/24 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#76FF03]/24 bg-[#76FF03]/10 text-xs font-black text-[#A7FF3D]">
                      {index + 1}
                    </span>
                    <h3 className="text-base font-black text-white">{item.title}</h3>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-white/56">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
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
                      {selected ? <CheckCircle2 className="h-5 w-5 text-[#76FF03]" /> : item.id === 'wallet' ? <Wallet className="h-5 w-5 text-white/28" /> : item.id === 'token' ? <Coins className="h-5 w-5 text-white/28" /> : <Wrench className="h-5 w-5 text-white/28" />}
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

            <div className="mt-4 rounded-2xl border border-[#FACC15]/18 bg-[#FACC15]/[0.045] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FACC15]">Risk boundary</p>
              <p className="mt-2 text-xs leading-5 text-white/56">
                Wallet and token scans explain public on-chain evidence. Mythos does not tell users to buy, sell, invest, or trust a token.
              </p>
            </div>
          </aside>

          <div className="grid min-w-0 gap-4">
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
                  {copied ? 'Copied' : 'Copy handoff report'}
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
              <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="min-w-0 rounded-2xl border border-white/8 bg-black/26 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/38">Mythos analysis</p>
                      <h3 className="mt-1 break-words text-xl font-black [overflow-wrap:anywhere]">{result.subject}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-xl border border-[#14F195]/18 bg-[#14F195]/10 px-3 py-2 text-xs font-bold text-[#14F195]">
                        {result.observability.provider}
                      </span>
                      <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/62">
                        {result.observability.latencyMs}ms
                      </span>
                      <span className={`rounded-xl border px-3 py-2 text-xs font-black ${riskClass(result.risk.level)}`}>
                        {riskLabel(result.risk.level)}
                      </span>
                    </div>
                  </div>

                  {resultExplainer ? (
                    <div className="mt-4 rounded-2xl border border-[#76FF03]/20 bg-[radial-gradient(circle_at_top_left,rgba(118,255,3,0.12),transparent_34%),rgba(5,16,8,0.72)] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A7FF3D]">{resultExplainer.title}</p>
                          <h4 className="mt-1 text-xl font-black text-white">{resultExplainer.subtitle}</h4>
                        </div>
                        <div className={`rounded-2xl border px-4 py-3 text-right ${riskClass(result.risk.level)}`}>
                          <p className="text-[10px] font-black uppercase tracking-[0.12em]">Risk score</p>
                          <p className="mt-1 text-3xl font-black">{result.risk.score}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        {[
                          [resultExplainer.primary, resultExplainer.primaryValue],
                          [resultExplainer.secondary, resultExplainer.secondaryValue],
                          ['Human next step', resultExplainer.action],
                        ].map(([label, text]) => (
                          <div key={label} className="rounded-xl border border-white/8 bg-black/24 p-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/38">{label}</p>
                            <p className="mt-2 break-words text-xs leading-5 text-white/66 [overflow-wrap:anywhere]">{text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {resultSources.map(item => (
                      <div key={item.label} className="rounded-2xl border border-white/8 bg-black/22 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/34">{item.label}</p>
                          <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${statusClass(item.status)}`}>
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-2 break-words text-xs leading-5 text-white/62 [overflow-wrap:anywhere]">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {resultHumanReadout ? (
                    <div className="mt-4 rounded-2xl border border-[#5AD7FF]/18 bg-[radial-gradient(circle_at_top_left,rgba(90,215,255,0.09),transparent_34%),rgba(4,12,18,0.72)] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7DE4FF]">Human explanation</p>
                          <h4 className="mt-1 text-lg font-black text-white">{resultHumanReadout.title}</h4>
                        </div>
                        <span className="rounded-full border border-[#5AD7FF]/18 bg-[#5AD7FF]/10 px-3 py-1 text-[10px] font-black uppercase text-[#7DE4FF]">
                          plain language
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        {[
                          ['What this means', resultHumanReadout.body],
                          ['What Mythos cannot know', resultHumanReadout.cannotKnow],
                          ['Best next step', result.risk.nextSafeStep],
                        ].map(([label, text]) => (
                          <div key={label} className="rounded-xl border border-white/8 bg-black/24 p-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/38">{label}</p>
                            <p className="mt-2 text-xs leading-5 text-white/64">{text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-2xl border border-[#A855F7]/18 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.10),transparent_32%),rgba(12,6,20,0.62)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#C084FC]">Solana developer view</p>
                        <h4 className="mt-1 text-lg font-black text-white">Debuggable evidence, not generic AI prose</h4>
                      </div>
                      <span className="rounded-full border border-[#A855F7]/18 bg-[#A855F7]/10 px-3 py-1 text-[10px] font-black uppercase text-[#C084FC]">
                        dev mode
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {resultDeveloperReadout.map(({ label, value }) => (
                        <div key={label} className="rounded-xl border border-white/8 bg-black/24 p-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/38">{label}</p>
                          <p className="mt-2 break-words font-mono text-xs leading-5 text-white/64 [overflow-wrap:anywhere]">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <pre className="mt-4 max-w-full whitespace-pre-wrap break-words rounded-2xl border border-white/8 bg-[#030306] p-4 text-sm leading-6 text-white/72 [overflow-wrap:anywhere]">
                    {cleanModelText(result.analysis)}
                  </pre>

                  {walletExplainer ? (
                    <div className={`mt-4 rounded-2xl border p-4 ${walletExplainer.tone}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-80">Wallet readout</p>
                          <h4 className="mt-1 text-lg font-black text-white">{walletExplainer.title}</h4>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${riskClass(result.risk.level)}`}>
                          {result.risk.userLabel}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-white/68">{walletExplainer.copy}</p>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {[
                          ['What Mythos knows', result.risk.plainEnglish],
                          ['What it does not know', 'Mythos cannot see private keys, seed phrases, off-chain identity, intent, or whether this address belongs to the user.'],
                          ['Best next step', result.risk.nextSafeStep],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-xl border border-white/8 bg-black/24 p-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/38">{label}</p>
                            <p className="mt-2 text-xs leading-5 text-white/62">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {(result.mode === 'wallet' || result.mode === 'token') ? (
                    <div className="mt-4 rounded-2xl border border-[#FACC15]/18 bg-[#FACC15]/[0.045] p-4">
                      <div className="flex gap-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#FACC15]" />
                        <p className="text-xs leading-5 text-white/58">
                          This is public on-chain risk intelligence only. It is not financial advice, not a buy/sell signal, and not proof that an asset is safe.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className={`rounded-2xl border p-4 ${riskClass(result.risk.level)}`}>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em]">Threat level</p>
                      <p className="mt-2 text-3xl font-black">{result.risk.score}</p>
                      <p className="mt-1 text-xs font-bold">{riskLabel(result.risk.level)}</p>
                    </div>
                    <div className="rounded-2xl border border-[#5AD7FF]/18 bg-[#5AD7FF]/[0.05] p-4 text-[#7DE4FF]">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em]">AI confidence</p>
                      <p className="mt-2 text-3xl font-black">{Math.round(result.risk.confidenceBps / 100)}%</p>
                      <p className="mt-1 text-xs font-bold">evidence-bound</p>
                    </div>
                    <div className="rounded-2xl border border-[#A855F7]/18 bg-[#A855F7]/[0.05] p-4 text-[#C084FC]">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em]">Memory match</p>
                      <p className="mt-2 text-3xl font-black">{Math.round(result.risk.memoryMatchBps / 100)}%</p>
                      <p className="mt-1 text-xs font-bold">{result.memoryReplay.previousMatches} similar patterns</p>
                    </div>
                  </div>

                  <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                    {result.evidence.map(item => (
                      <div key={`${item.label}-${item.value}`} className="min-w-0 rounded-2xl border border-white/8 bg-black/24 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/34">{item.label}</p>
                          <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${statusClass(item.status)}`}>
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-2 break-words text-xs leading-5 text-white/58 [overflow-wrap:anywhere]">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-[#76FF03]/18 bg-[radial-gradient(circle_at_top_left,rgba(118,255,3,0.08),transparent_32%),rgba(5,14,8,0.72)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A7FF3D]">Decision checklist</p>
                        <h4 className="mt-1 text-lg font-black text-white">What a human should verify before acting</h4>
                      </div>
                      <span className="rounded-full border border-[#76FF03]/18 bg-[#76FF03]/10 px-3 py-1 text-[10px] font-black uppercase text-[#A7FF3D]">
                        human controlled
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {resultDecisionRows.map(({ label, value }) => (
                        <div key={label} className="rounded-xl border border-white/8 bg-black/24 p-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/38">{label}</p>
                          <p className="mt-2 text-xs leading-5 text-white/64">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <aside className="grid min-w-0 gap-4">
                  <div className="rounded-2xl border border-[#76FF03]/18 bg-[#071008] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Live chain monitor</p>
                    <p className="mt-2 text-xs leading-5 text-white/50">
                      Mythos checks live chain context before explaining. This is read-only infrastructure telemetry, not a background monitor.
                    </p>
                    <div className="mt-3 grid gap-2 text-xs leading-5 text-white/58">
                      {resultLiveRows.map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/20 p-3">
                          <span>{label}</span>
                          <strong className="break-words text-right text-white/78 [overflow-wrap:anywhere]">{value}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 rounded-xl border border-[#14F195]/12 bg-[#14F195]/[0.04] p-3 font-mono text-[11px] leading-5 text-[#14F195]/80">
                      [LIVE] evidence captured at {new Date(result.observability.timestamp).toLocaleString()}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#A855F7]/18 bg-[#A855F7]/[0.045] p-4">
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#C084FC]">
                      <Radar className="h-4 w-4" />
                      Memory replay
                    </p>
                    <div className="mt-3 grid gap-2">
                      {resultReplayRows.map(({ label, value }) => (
                        <div key={label} className="rounded-xl border border-white/8 bg-black/20 p-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/34">{label}</p>
                          <p className="mt-1 break-words text-xs leading-5 text-white/62 [overflow-wrap:anywhere]">{value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 rounded-xl border border-white/8 bg-black/20 p-3 text-xs leading-5 text-white/50">
                      Replay is currently derived from bounded CongChain pattern metadata. Saving this analysis makes future comparisons more useful.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#5AD7FF]/18 bg-[#5AD7FF]/[0.04] p-4">
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#7DE4FF]">
                      <ShieldCheck className="h-4 w-4" />
                      Runtime proof
                    </p>
                    <div className="mt-3 grid gap-2">
                      {resultProofRows.map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/20 p-3 text-xs leading-5 text-white/58">
                          <span>{label}</span>
                          <strong className="break-words text-right text-white/78 [overflow-wrap:anywhere]">{value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#FACC15]/18 bg-[#FACC15]/[0.045] p-4">
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#FACC15]">
                      <Gauge className="h-4 w-4" />
                      Risk signals
                    </p>
                    <p className="mt-2 text-xs leading-5 text-white/56">{result.risk.summary}</p>
                    <div className="mt-3 grid gap-2">
                      {result.risk.signals.map(signal => (
                        <div key={signal} className="rounded-xl border border-white/8 bg-black/20 p-3 text-xs leading-5 text-white/58">
                          {signal}
                        </div>
                      ))}
                    </div>
                  </div>

                  {result.patchExample ? (
                    <div className="rounded-2xl border border-[#5AD7FF]/18 bg-[#5AD7FF]/[0.045] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7DE4FF]">Suggested fix / review</p>
                      <pre className="mt-3 max-w-full whitespace-pre-wrap break-words rounded-xl border border-white/8 bg-black/24 p-3 text-xs leading-5 text-white/62 [overflow-wrap:anywhere]">
                        {result.patchExample}
                      </pre>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-[#14F195]/18 bg-[#14F195]/[0.035] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#14F195]">Cognitive trace</p>
                    {Object.entries(result.cognitiveTrace).map(([label, value]) => (
                      <div key={label} className="mt-3 rounded-xl border border-white/8 bg-black/20 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/34">{label}</p>
                        <p className="mt-1 break-words text-xs leading-5 text-white/58 [overflow-wrap:anywhere]">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="min-w-0 rounded-2xl border border-[#76FF03]/18 bg-[#071008] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Save as CongChain memory</p>
                    <p className="mt-2 text-xs leading-5 text-white/50">
                      Write this reviewed analysis into the Mythos vault as hash-addressable CongChain memory. The key is sent once to the server and is not displayed back.
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
                      {saving ? 'Saving memory' : 'Write verified memory'}
                    </button>
                    {saved?.hash ? (
                      <div className="mt-3 rounded-xl border border-[#14F195]/18 bg-[#14F195]/[0.06] p-3">
                        <p className="text-xs font-bold text-[#14F195]">Hash-addressable memory created</p>
                        <p className="mt-1 break-all font-mono text-xs text-white/62 [overflow-wrap:anywhere]">{saved.hash}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {saved.readUrl ? <a className="text-xs font-bold text-[#7DE4FF]" href={saved.readUrl}>Read</a> : null}
                          {saved.verifyUrl ? <a className="text-xs font-bold text-[#7DE4FF]" href={saved.verifyUrl}>Verify</a> : null}
                          {saved.proofUrl ? <a className="text-xs font-bold text-[#7DE4FF]" href={saved.proofUrl}>Proof</a> : null}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-white/8 bg-black/20 p-3 text-xs leading-5 text-white/46">
                        No memory has been written yet. Run the analysis, review the evidence, then write only reports worth reusing.
                      </div>
                    )}
                  </div>
                </aside>
              </section>
            ) : (
              <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="min-w-0 rounded-2xl border border-white/8 bg-black/26 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-white/38">Before running</p>
                  <pre className="mt-4 max-h-[420px] max-w-full overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/8 bg-[#030306] p-4 text-xs leading-6 text-white/64 [overflow-wrap:anywhere]">
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
