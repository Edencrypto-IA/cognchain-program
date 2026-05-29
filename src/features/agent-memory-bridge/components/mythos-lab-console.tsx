'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletReadyState, type WalletName } from '@solana/wallet-adapter-base';
import {
  Activity,
  Brain,
  ChevronDown,
  Coins,
  Gauge,
  KeyRound,
  LogOut,
  Loader2,
  Network,
  Plus,
  Radar,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Trash2,
  Wallet,
} from 'lucide-react';
import { createMythosWalletCommandPlan } from '@/features/wallet-agent/mythos-wallet-command';
import type { MythosCryptoMarketReport } from '@/lib/market/crypto-report';
import type { MythosSolanaEcosystemReport, MythosSolanaReportMode } from '@/lib/market/solana-ecosystem-report';
import {
  MYTHOS_AGENT_PROFILE,
  MYTHOS_FEATURED_SKILLS,
} from '../mythos';
import type { MythosSkillRouteResult } from '../skill-router';

type MythosLabMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  htmlArtifact?: {
    title: string;
    html: string;
    model?: string;
  };
  cryptoReport?: MythosCryptoMarketReport;
  solanaReport?: MythosSolanaEcosystemReport;
  solanaAnalysis?: Record<string, unknown>;
  memecoinDraft?: MythosMemecoinDraft;
  memoryHash?: string;
  readUrl?: string;
  verifyUrl?: string;
  proofUrl?: string;
};

type MythosMemecoinDraft = {
  name: string;
  symbol: string;
  description: string;
  imagePrompt: string;
  initialBuySol: number;
  walletAddress?: string;
  walletReady: boolean;
  launchMode: 'preview_only' | 'launch_review_ready';
  readinessScore: number;
  estimatedCostSol: {
    minimum: number;
    maximum: number;
    label: string;
  };
  phases: Array<{
    title: string;
    status: 'ready' | 'review' | 'blocked' | 'pending';
    detail: string;
  }>;
  reviewChecklist: string[];
  blockedActions: string[];
  safetyNotes: string[];
};

type MythosCognitiveTrace = {
  perception?: string;
  memoryContext?: string;
  selectedSkill?: string;
  reasoningPath?: string;
  prediction?: string;
  decision?: string;
  confidence?: number;
  safetyBoundary?: string;
  nextHumanStep?: string;
};

type MythosLabSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  mode: 'demo' | 'connected';
  model: string;
  nvidiaModelRoute?: string;
  skillId: string;
  messages: MythosLabMessage[];
  lastTrace?: MythosCognitiveTrace;
  lastObservability?: MythosObservability;
  lastSkillRoute?: MythosSkillRouteResult;
};

type MythosObservability = {
  model?: string;
  modelLabel?: string;
  latencyMs?: number;
  traceSchema?: string;
  mode?: string;
  memoryHash?: string;
  savedAt?: string;
};

type MemoryWriteResponse = {
  hash?: string;
  readUrl?: string;
  verifyUrl?: string;
  proofUrl?: string;
  error?: string;
};

const STORAGE_KEY = 'congchain:mythos-lab:sessions:v1';

const TERMINAL_COMMANDS = [
  {
    command: '/analyze tx <signature>',
    detail: 'Explain a Solana transaction with evidence, risk, next step, and memory draft.',
  },
  {
    command: '/analyze wallet <address>',
    detail: 'Read a public wallet profile: balance, recent activity, failures, token exposure, and risk.',
  },
  {
    command: '/analyze token <mint>',
    detail: 'Review token metadata, holder/distribution context, listings, and safe-risk signals.',
  },
  {
    command: '/debug anchor <error or program context>',
    detail: 'Turn Anchor logs or program errors into cause, fix, and review checklist.',
  },
  {
    command: '/explain rpc <issue>',
    detail: 'Diagnose RPC, wallet, webhook, priority-fee, or indexing problems.',
  },
  {
    command: '/quote swap <amount> <token> to <token>',
    detail: 'Fetch a read-only Jupiter route quote. No swap transaction is created.',
  },
  {
    command: '/market report',
    detail: 'Generate a visual crypto market report with CoinGecko data, gainers, losers, trends, and opportunity watchlist.',
  },
  {
    command: '/solana report',
    detail: 'Show a clean SOL price report: market cap, 24h volume, ATH, supply, and safe context.',
  },
  {
    command: '/solana protocols',
    detail: 'Show the top 10 Solana DeFi protocols by TVL, excluding centralized exchanges.',
  },
  {
    command: '/solana volume',
    detail: 'Show the top Solana ecosystem assets by 24h trading volume.',
  },
  {
    command: '/solana memes',
    detail: 'Show the top Solana meme coins by market activity with high-risk framing.',
  },
  {
    command: '/create meme <name> symbol <ticker> buy <amount> SOL',
    detail: 'Create a safe Pump.fun-style memecoin launch draft. No mint, upload, signature, buy, or submission happens automatically.',
  },
  {
    command: '/plan <wallet command>',
    detail: 'Create the safe six-phase Wallet Agent plan for payments, swaps, schedules, and memory.',
  },
  {
    command: '/memory save last',
    detail: 'Save the last approved Mythos answer to CongChain when a full cog_live key is pasted.',
  },
  {
    command: '/artifact <visual request>',
    detail: 'Admin-only: ask Anthropic to generate a read-only HTML artifact preview. The Claude key stays on the server.',
  },
];

const MYTHOS_MODEL_OPTIONS = [
  {
    id: 'nvidia',
    label: 'NVIDIA',
    provider: 'NVIDIA NIM ROUTE',
    access: 'open',
    detail: 'NVIDIA key route for Nemotron plus NVIDIA-hosted open models. This can include non-NVIDIA model families served through NIM.',
  },
  {
    id: 'gpt',
    label: 'GPT PRO',
    provider: 'OPENAI PRO',
    access: 'pro',
    detail: 'Direct OpenAI paid API route for GPT-class reasoning, artifacts, and structured assistant work.',
  },
  {
    id: 'claude',
    label: 'Claude PRO',
    provider: 'ANTHROPIC PRO',
    access: 'pro',
    detail: 'Direct Anthropic paid API route for long-form analysis, careful planning, and admin HTML artifacts.',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    provider: 'GOOGLE API',
    access: 'open',
    detail: 'Google model route for multimodal-friendly reasoning and broad synthesis.',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek PRO',
    provider: 'DEEPSEEK PRO',
    access: 'pro',
    detail: 'Direct DeepSeek paid API route for code review, debugging, and technical reasoning.',
  },
  {
    id: 'glm',
    label: 'GLM',
    provider: 'FREE/API',
    access: 'open',
    detail: 'GLM route for multilingual reasoning and structured analysis.',
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    provider: 'FREE/API',
    access: 'open',
    detail: 'MiniMax route for fast conversational and lightweight drafting work.',
  },
  {
    id: 'qwen',
    label: 'Qwen',
    provider: 'FREE/API',
    access: 'open',
    detail: 'Qwen route for repository analysis, coding tasks, and long-context work.',
  },
];

const NVIDIA_MODEL_ROUTES = [
  {
    id: 'nemotron-super-120b',
    label: 'Nemotron Super 120B',
    shortLabel: 'Nemotron',
    provider: 'NVIDIA NIM',
    envModel: 'NVIDIA_MODEL_NEMOTRON_SUPER',
    detail: 'Default high-capacity route for agent loop, planning, and broad reasoning.',
  },
  {
    id: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    shortLabel: 'DeepSeek V4',
    provider: 'NVIDIA NIM',
    envModel: 'NVIDIA_MODEL_DEEPSEEK_V4',
    detail: 'Best for code review, debugging, protocol reasoning, and technical diagnosis.',
  },
  {
    id: 'seed-oss-36b',
    label: 'Seed OSS 36B',
    shortLabel: 'Seed OSS',
    provider: 'NVIDIA NIM',
    envModel: 'NVIDIA_MODEL_SEED',
    detail: 'General open-model route for fast drafting, synthesis, and balanced answers.',
  },
  {
    id: 'qwen35-122b',
    label: 'Qwen 3.5 122B',
    shortLabel: 'Qwen 122B',
    provider: 'NVIDIA NIM',
    envModel: 'NVIDIA_MODEL_QWEN35',
    detail: 'Strong route for repository analysis, long-context coding, and structured outputs.',
  },
  {
    id: 'kimi-k26',
    label: 'Kimi K2.6',
    shortLabel: 'Kimi K2.6',
    provider: 'NVIDIA NIM',
    envModel: 'NVIDIA_MODEL_KIMI',
    detail: 'Long-context route for large documents, research packets, and multi-file review.',
  },
  {
    id: 'mixtral-8x22b',
    label: 'Mixtral 8x22B',
    shortLabel: 'Mixtral',
    provider: 'NVIDIA NIM',
    envModel: 'NVIDIA_MODEL_MIXTRAL',
    detail: 'Mixture-of-experts route for flexible reasoning, writing, and planning.',
  },
  {
    id: 'mistral-large',
    label: 'Mistral Large 3',
    shortLabel: 'Mistral',
    provider: 'NVIDIA NIM',
    envModel: 'NVIDIA_MODEL_MISTRAL_LARGE',
    detail: 'Premium analysis and content route for clear, polished explanations.',
  },
  {
    id: 'gpt-oss-120b',
    label: 'GPT-OSS 120B',
    shortLabel: 'GPT-OSS',
    provider: 'NVIDIA NIM',
    envModel: 'NVIDIA_MODEL_GPT_OSS_120B',
    detail: 'Heavy open reasoning route for complex plans and verification-style answers.',
  },
  {
    id: 'gemma4-31b',
    label: 'Gemma 4 31B',
    shortLabel: 'Gemma 4',
    provider: 'NVIDIA NIM',
    envModel: 'NVIDIA_MODEL_GEMMA4',
    detail: 'Creative and multilingual-friendly route for product copy and explanations.',
  },
  {
    id: 'gemma3n-e2b',
    label: 'Gemma 3N E2B',
    shortLabel: 'Gemma 3N',
    provider: 'NVIDIA NIM',
    envModel: 'NVIDIA_MODEL_GEMMA3N_E2B',
    detail: 'Small, fast route for lightweight checks, summaries, and low-cost responses.',
  },
  {
    id: 'phi4-mini',
    label: 'Phi-4 Mini',
    shortLabel: 'Phi-4',
    provider: 'NVIDIA NIM',
    envModel: 'NVIDIA_MODEL_PHI4',
    detail: 'Very fast Microsoft route for quick intent checks and compact assistant replies.',
  },
];

const MYTHOS_WALLET_OPTIONS = [
  {
    key: 'phantom',
    name: 'Phantom',
    description: 'Primary Solana browser/mobile wallet for future Mythos approvals.',
    installUrl: 'https://phantom.app/download',
    mobileUrl: (url: string, ref: string) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(ref)}`,
  },
  {
    key: 'solflare',
    name: 'Solflare',
    description: 'Solana wallet for explicit review, signing, and future launch approval.',
    installUrl: 'https://solflare.com/download',
    mobileUrl: (url: string, ref: string) => `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(ref)}`,
  },
];

function isMobileBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function getModelOption(model?: string) {
  const normalized = (model || '').toLowerCase();
  return MYTHOS_MODEL_OPTIONS.find(option =>
    option.id.toLowerCase() === normalized || option.label.toLowerCase() === normalized
  ) || MYTHOS_MODEL_OPTIONS[0];
}

function getNvidiaModelRoute(routeId?: string) {
  const normalized = (routeId || '').toLowerCase();
  return NVIDIA_MODEL_ROUTES.find(route => route.id === normalized) || NVIDIA_MODEL_ROUTES[0];
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function shortHash(value?: string, size = 12) {
  if (!value) return 'not saved';
  return value.length > size ? `${value.slice(0, size)}...` : value;
}

function cleanTerminalText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/```[\s\S]*?```/g, match => match.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, ''))
    .replace(/(^|\s)\*\*([^*\n]+)\*\*/g, '$1$2')
    .replace(/(^|\s)__([^_\n]+)__/g, '$1$2')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2')
    .replace(/(^|\s)_([^_\n]+)_/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function terminalSection(title: string, body: string | string[]) {
  const content = Array.isArray(body) ? body.filter(Boolean).join('\n') : body;
  return `${title}\n${content || 'No data available.'}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = 'not available') {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getRecord(value: unknown, key: string) {
  return isRecord(value) && isRecord(value[key]) ? value[key] as Record<string, unknown> : {};
}

function getArray(value: unknown, key: string) {
  return isRecord(value) && Array.isArray(value[key]) ? value[key] as unknown[] : [];
}

function formatEvidenceItems(evidence: unknown[]) {
  if (evidence.length === 0) return 'No evidence cards returned.';
  return evidence
    .slice(0, 10)
    .map(item => {
      if (!isRecord(item)) return '';
      return `- ${asString(item.label, 'Evidence')}: ${asString(item.value)} (${asString(item.status, 'review')})`;
    })
    .filter(Boolean)
    .join('\n');
}

function getEvidenceItems(data: Record<string, unknown>) {
  return getArray(data, 'evidence').filter(isRecord) as Record<string, unknown>[];
}

function findEvidence(data: Record<string, unknown>, label: string) {
  const target = label.toLowerCase();
  return getEvidenceItems(data).find(item => asString(item.label, '').toLowerCase() === target);
}

function evidenceValue(data: Record<string, unknown>, label: string, fallback = 'not available') {
  return asString(findEvidence(data, label)?.value, fallback);
}

function evidenceStatus(data: Record<string, unknown>, label: string) {
  const status = asString(findEvidence(data, label)?.status, 'review');
  return status === 'ready' || status === 'blocked' ? status : 'review';
}

function splitEvidencePreview(value: string, limit = 8) {
  if (!value || /not available|none|unavailable|no token/i.test(value)) return [];
  return value
    .split(/[;,]\s*/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function solanaRiskTone(level: string) {
  if (level === 'safe') return 'border-[#14F195]/24 bg-[#14F195]/[0.08] text-[#14F195]';
  if (level === 'low_data') return 'border-[#5AD7FF]/24 bg-[#5AD7FF]/[0.08] text-[#7DE4FF]';
  if (level === 'suspicious') return 'border-[#FACC15]/24 bg-[#FACC15]/[0.08] text-[#FACC15]';
  if (level === 'exploit_risk') return 'border-[#FF5C8A]/24 bg-[#FF5C8A]/[0.08] text-[#FF7AA2]';
  return 'border-white/10 bg-white/[0.045] text-white/72';
}

function evidenceTone(status: string) {
  if (status === 'ready') return 'border-[#14F195]/16 bg-[#14F195]/[0.055]';
  if (status === 'blocked') return 'border-[#FF5C8A]/16 bg-[#FF5C8A]/[0.055]';
  return 'border-[#FACC15]/16 bg-[#FACC15]/[0.045]';
}

function statusPill(status: string) {
  if (status === 'ready') return 'border-[#14F195]/18 bg-[#14F195]/[0.08] text-[#14F195]';
  if (status === 'blocked') return 'border-[#FF5C8A]/18 bg-[#FF5C8A]/[0.08] text-[#FF7AA2]';
  return 'border-[#FACC15]/18 bg-[#FACC15]/[0.08] text-[#FACC15]';
}

function SolanaMetricCard({
  icon: Icon,
  label,
  value,
  note,
  status,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  note?: string;
  status: string;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${evidenceTone(status)}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/24 text-[#A7FF3D]">
          <Icon className="h-4 w-4" />
        </span>
        <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${statusPill(status)}`}>
          {status}
        </span>
      </div>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-white/38">{label}</p>
      <p className="mt-2 break-words text-xl font-black leading-tight text-white [overflow-wrap:anywhere]">{value}</p>
      {note ? <p className="mt-2 text-xs leading-5 text-white/50">{note}</p> : null}
    </div>
  );
}

function SolanaPillList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/22 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7DE4FF]">{title}</p>
      {items.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map(item => (
            <span key={item} className="max-w-full break-words rounded-full border border-[#5AD7FF]/18 bg-[#5AD7FF]/[0.06] px-3 py-2 text-xs font-bold leading-4 text-[#7DE4FF] [overflow-wrap:anywhere]">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-white/8 bg-black/24 p-3 text-xs leading-5 text-white/48">{empty}</p>
      )}
    </div>
  );
}

function MythosSolanaAnalysisCard({ data }: { data: Record<string, unknown> }) {
  const mode = asString(data.mode, 'solana');
  const risk = getRecord(data, 'risk');
  const monitor = getRecord(data, 'chainMonitor');
  const trace = getRecord(data, 'cognitiveTrace');
  const memoryReplay = getRecord(data, 'memoryReplay');
  const riskLevel = asString(risk.level, 'review');
  const score = asNumber(risk.score);
  const subject = asString(data.subject, 'provided input');
  const tokens = splitEvidencePreview(evidenceValue(data, 'Token exposure preview'), 8);
  const programs = splitEvidencePreview(evidenceValue(data, 'Detected program families').replaceAll(',', ';'), 6);

  const walletMetrics = [
    { icon: Wallet, label: 'SOL balance', value: evidenceValue(data, 'SOL balance'), note: 'Native SOL visible in this public account.', status: evidenceStatus(data, 'SOL balance') },
    { icon: Coins, label: 'Portfolio value', value: evidenceValue(data, 'Portfolio value'), note: 'Provider estimate when Solscan/Helius portfolio data is available.', status: evidenceStatus(data, 'Portfolio value') },
    { icon: Activity, label: 'Recent activity', value: evidenceValue(data, 'Recent transactions'), note: `Failed transactions: ${evidenceValue(data, 'Recent failed transactions')}`, status: evidenceStatus(data, 'Recent transactions') },
    { icon: Gauge, label: 'Failure rate', value: evidenceValue(data, 'Failure rate'), note: 'High failure rates can mean bad routes, bots, or wallet friction.', status: evidenceStatus(data, 'Failure rate') },
    { icon: ShieldCheck, label: 'Account owner', value: shortHash(evidenceValue(data, 'Account owner'), 24), note: 'System Program is normal for regular wallets.', status: evidenceStatus(data, 'Account owner') },
    { icon: Radar, label: 'Activity temperature', value: evidenceValue(data, 'Activity temperature'), note: evidenceValue(data, 'Wallet profile'), status: evidenceStatus(data, 'Activity temperature') },
  ];

  const genericMetrics = getEvidenceItems(data).slice(0, 8).map((item, index) => ({
    icon: [Activity, ShieldCheck, Gauge, Coins][index % 4],
    label: asString(item.label, 'Evidence'),
    value: asString(item.value),
    status: asString(item.status, 'review'),
  }));

  const metrics = mode === 'wallet' ? walletMetrics : genericMetrics;
  const title = mode === 'wallet'
    ? 'Wallet intelligence cockpit'
    : mode === 'token'
      ? 'Token intelligence cockpit'
      : mode === 'transaction'
        ? 'Transaction intelligence cockpit'
        : 'Solana intelligence cockpit';

  return (
    <div className="mt-4 overflow-hidden rounded-3xl border border-[#14F195]/22 bg-[radial-gradient(circle_at_top_left,rgba(20,241,149,0.14),transparent_34%),linear-gradient(135deg,rgba(3,18,11,0.96),rgba(3,5,9,0.98))] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#14F195]">{title}</p>
          <h4 className="mt-2 break-words text-2xl font-black text-white [overflow-wrap:anywhere]">{shortHash(subject, 34)}</h4>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">
            Mythos turns public Solana evidence into a beginner-readable report: what happened, what it means, what is risky, and what to review next.
          </p>
        </div>
        <div className={`rounded-2xl border p-4 text-right ${solanaRiskTone(riskLevel)}`}>
          <p className="text-[10px] font-black uppercase tracking-[0.14em]">Threat level</p>
          <p className="mt-1 text-4xl font-black">{score}</p>
          <p className="text-xs font-black uppercase">{riskLevel.replaceAll('_', ' ')}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map(item => <SolanaMetricCard key={item.label} {...item} />)}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-2xl border border-white/8 bg-black/24 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A7FF3D]">Plain-English readout</p>
          <h5 className="mt-2 text-xl font-black text-white">{asString(risk.userLabel, 'Review required')}</h5>
          <p className="mt-3 text-sm leading-6 text-white/64">{asString(risk.plainEnglish, asString(risk.summary, 'Mythos reviewed public on-chain evidence.'))}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[#14F195]/12 bg-[#14F195]/[0.04] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#14F195]">What Mythos knows</p>
              <p className="mt-2 text-xs leading-5 text-white/58">{asString(trace.evidenceUsed, 'Public chain evidence was reviewed.')}</p>
            </div>
            <div className="rounded-xl border border-[#FACC15]/12 bg-[#FACC15]/[0.04] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FACC15]">What it cannot know</p>
              <p className="mt-2 text-xs leading-5 text-white/58">Private keys, seed phrases, off-chain identity, user intent, hidden wallet UI, or ownership of this address.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-2xl border border-[#5AD7FF]/16 bg-[#5AD7FF]/[0.045] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7DE4FF]">Best next step</p>
            <p className="mt-2 text-sm leading-6 text-white/62">{asString(risk.nextSafeStep, asString(trace.nextHumanStep, 'Review manually before saving memory.'))}</p>
          </div>
          <div className="rounded-2xl border border-[#A855F7]/16 bg-[#A855F7]/[0.045] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#C084FC]">Memory replay</p>
            <p className="mt-2 text-sm leading-6 text-white/62">{asString(memoryReplay.likelyCause, 'No reusable pattern found yet.')}</p>
          </div>
        </div>
      </div>

      {mode === 'wallet' ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <SolanaPillList title="Token exposure preview" empty="No token balances were returned by the sampled providers." items={tokens} />
          <SolanaPillList title="Detected program families" empty="No program family could be classified from recent parsed transactions." items={programs} />
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <SolanaMetricCard icon={Network} label="Provider" value={asString(monitor.provider, 'solana-rpc')} note={asString(monitor.slotLabel, 'slot unavailable')} status="ready" />
        <SolanaMetricCard icon={Brain} label="Confidence" value={`${Math.round(asNumber(risk.confidenceBps) / 100)}%`} note="Evidence-bound confidence, not certainty." status="ready" />
        <SolanaMetricCard icon={KeyRound} label="Memory match" value={`${Math.round(asNumber(risk.memoryMatchBps) / 100)}%`} note={`${asNumber(memoryReplay.previousMatches)} similar patterns`} status="review" />
      </div>
    </div>
  );
}

function formatMythosSolanaResponse(data: Record<string, unknown>) {
  const risk = getRecord(data, 'risk');
  const monitor = getRecord(data, 'chainMonitor');
  const trace = getRecord(data, 'cognitiveTrace');
  const memoryReplay = getRecord(data, 'memoryReplay');
  const observability = getRecord(data, 'observability');
  const evidence = getArray(data, 'evidence');

  return cleanTerminalText([
    terminalSection('Intent', `${asString(data.mode, 'solana')} analysis for ${asString(data.subject, 'provided input')}`),
    terminalSection('Plain-English readout', [
      asString(risk.userLabel, 'Review required'),
      asString(risk.plainEnglish, asString(risk.summary, 'Mythos reviewed public on-chain evidence.')),
    ]),
    terminalSection('Evidence', formatEvidenceItems(evidence)),
    terminalSection('Risk', [
      `Threat level: ${asNumber(risk.score)} / 100`,
      `Label: ${asString(risk.level, 'review')}`,
      `AI confidence: ${Math.round(asNumber(risk.confidenceBps) / 100)}%`,
      `Memory match: ${Math.round(asNumber(risk.memoryMatchBps) / 100)}%`,
      `Signals: ${getArray(risk, 'signals').map(signal => asString(signal)).join('; ') || 'none'}`,
    ]),
    terminalSection('Decision', asString(trace.decision, asString(data.analysis, 'Review the evidence before acting.'))),
    terminalSection('Next safe step', asString(risk.nextSafeStep, asString(trace.nextHumanStep, 'Review manually before saving memory.'))),
    terminalSection('Memory replay', [
      `Pattern: ${asString(memoryReplay.pattern, 'no pattern')}`,
      `Similar memories: ${asNumber(memoryReplay.previousMatches)}`,
      `Likely cause: ${asString(memoryReplay.likelyCause, 'not available')}`,
    ]),
    terminalSection('Observability', [
      `Provider: ${asString(observability.provider, asString(monitor.provider, 'server'))}`,
      `Cluster: ${asString(monitor.cluster, 'mainnet')}`,
      `Slot: ${asString(monitor.slotLabel, 'not available')}`,
      `Latency: ${asString(observability.latencyMs, 'not available')} ms`,
    ]),
    terminalSection('Safety boundary', [
      'Read-only public chain intelligence.',
      'No private keys, seed phrases, signatures, or wallet secrets are requested.',
      'No buy, sell, payment, swap, or submission is executed from this terminal.',
    ]),
  ].join('\n\n'));
}

function parseQuoteCommand(content: string) {
  const match = content.match(/^\/quote\s+swap\s+(\d+(?:[.,]\d+)?)\s+([a-z0-9]+)\s+(?:to|for)\s+([a-z0-9]+)$/i);
  if (!match) return null;
  return {
    amountUi: Number(match[1].replace(',', '.')),
    inputSymbol: match[2].toUpperCase(),
    outputSymbol: match[3].toUpperCase(),
  };
}

function cleanTokenName(value: string) {
  return value
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 42);
}

function inferMemecoinName(content: string) {
  const explicit = content.match(/(?:name|nome|called|chamada|chamado)\s+["']?([a-z0-9][a-z0-9\s-]{1,42})["']?/i);
  if (explicit?.[1]) return cleanTokenName(explicit[1]);

  const slash = content.match(/^\/create\s+(?:meme|memecoin)\s+(.+)$/i);
  if (slash?.[1]) {
    const beforeKeyword = slash[1].split(/\b(symbol|ticker|buy|comprar|compra|description|descricao|descri[cç][aã]o|image|imagem)\b/i)[0];
    const cleaned = cleanTokenName(beforeKeyword);
    if (cleaned) return cleaned;
  }

  const portuguese = content.match(/crie\s+(?:uma\s+)?(?:meme\s*coin|memecoin|token)\s+(?:chamada|com\s+nome)?\s*["']?([a-z0-9][a-z0-9\s-]{1,42})["']?/i);
  if (portuguese?.[1]) return cleanTokenName(portuguese[1]);

  return 'Untitled Meme';
}

function inferMemecoinSymbol(content: string, name: string) {
  const explicit = content.match(/(?:symbol|ticker|simbolo|s[ií]mbolo)\s+\$?([a-z0-9]{2,10})\b/i);
  if (explicit?.[1]) return explicit[1].toUpperCase().slice(0, 10);

  const dollar = content.match(/\$([a-z0-9]{2,10})\b/i);
  if (dollar?.[1]) return dollar[1].toUpperCase().slice(0, 10);

  const compact = name.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return (compact || 'MEME').slice(0, 6);
}

function inferMemecoinDescription(content: string, name: string) {
  const explicit = content.match(/(?:description|descri[cç][aã]o|bio)\s*[:=-]?\s*["']?([^"'\n]{8,180})/i);
  if (explicit?.[1]) return explicit[1].trim();
  return `${name} is a community meme token draft prepared by Mythos for human review before any wallet signature or launch action.`;
}

function inferMemecoinImagePrompt(content: string, name: string) {
  const explicit = content.match(/(?:image|imagem|logo|foto)\s*[:=-]?\s*["']?([^"'\n]{8,180})/i);
  if (explicit?.[1]) return explicit[1].trim();
  return `Premium green-black Solana meme coin logo for ${name}, bold mascot, high contrast, clean circular icon, no text.`;
}

function parseMemecoinDraft(content: string, walletAddress?: string): MythosMemecoinDraft | null {
  const lower = content.toLowerCase();
  const isCommand = /^\/create\s+(?:meme|memecoin)\b/i.test(content.trim());
  const isNatural = /\b(crie|criar|create|launch|lancar|lan[cç]ar)\b/i.test(content) && /\b(memecoin|meme\s*coin|meme|pump\.?fun|pump fun)\b/i.test(content);
  if (!isCommand && !isNatural) return null;

  const name = inferMemecoinName(content);
  const symbol = inferMemecoinSymbol(content, name);
  const amountMatch = lower.match(/(\d+(?:[,.]\d+)?)\s*sol\b/);
  const initialBuySol = amountMatch ? Number(amountMatch[1].replace(',', '.')) : 0;
  const description = inferMemecoinDescription(content, name);
  const imagePrompt = inferMemecoinImagePrompt(content, name);
  const walletReady = Boolean(walletAddress);
  const hasName = name !== 'Untitled Meme';
  const hasFirstBuy = initialBuySol > 0;
  const readinessScore = [
    hasName,
    symbol.length >= 2,
    description.length >= 24,
    imagePrompt.length >= 18,
    walletReady,
    hasFirstBuy,
  ].filter(Boolean).length * 14 + (walletReady && hasFirstBuy ? 16 : 0);
  const minimumCost = Number((0.02 + Math.max(initialBuySol, 0)).toFixed(4));
  const maximumCost = Number((0.08 + Math.max(initialBuySol, 0)).toFixed(4));

  return {
    name,
    symbol,
    description,
    imagePrompt,
    initialBuySol,
    walletAddress,
    walletReady,
    launchMode: walletReady && hasName ? 'launch_review_ready' : 'preview_only',
    readinessScore: Math.min(readinessScore, 100),
    estimatedCostSol: {
      minimum: minimumCost,
      maximum: maximumCost,
      label: `${minimumCost}-${maximumCost} SOL estimated review range`,
    },
    phases: [
      {
        title: '1. Token identity',
        status: hasName ? 'ready' : 'review',
        detail: `Name ${name} and ticker ${symbol} are drafted for review.`,
      },
      {
        title: '2. Visual metadata',
        status: 'review',
        detail: 'Image prompt and description are prepared, but no file is uploaded to IPFS or Pump.fun yet.',
      },
      {
        title: '3. Wallet readiness',
        status: walletReady ? 'ready' : 'review',
        detail: walletReady
          ? `Wallet ${walletAddress?.slice(0, 4)}...${walletAddress?.slice(-4)} is connected for future approval.`
          : 'Connect Phantom or Solflare before any future launch transaction can be prepared.',
      },
      {
        title: '4. First buy intent',
        status: hasFirstBuy ? 'review' : 'pending',
        detail: hasFirstBuy
          ? `User requested a first buy intent of ${initialBuySol} SOL. This is not executed.`
          : 'No first-buy SOL amount was detected yet.',
      },
      {
        title: '5. Pump.fun transaction',
        status: 'blocked',
        detail: 'No mint, bonding curve transaction, metadata upload, or buy transaction is created in this phase.',
      },
      {
        title: '6. Wallet signature',
        status: 'pending',
        detail: 'A future phase must show the final transaction in Phantom/Solflare and require explicit user approval.',
      },
    ],
    reviewChecklist: [
      'Confirm token name, ticker, and description are final.',
      'Confirm the image/logo file is owned by the creator and safe to publish.',
      'Confirm launch wallet, network, SOL balance, priority fee, and first-buy amount.',
      'Confirm Pump.fun terms, irreversible launch behavior, bonding curve mechanics, and slippage.',
      'Confirm Mythos shows a final transaction preview before Phantom/Solflare signature.',
      'Save the launch brief as CongChain memory only after human review.',
    ],
    blockedActions: [
      'Mythos cannot upload metadata to Pump.fun automatically in this phase.',
      'Mythos cannot create or mint a token automatically.',
      'Mythos cannot make the first buy without a visible wallet transaction.',
      'Mythos cannot store private keys, seed phrases, signed payloads, or hidden transaction data.',
    ],
    safetyNotes: [
      'This is a launch draft, not a live token.',
      'The user keeps custody. Phantom/Solflare approval is required before any value movement.',
      'Memecoin creation is high risk and can lose all funds. Mythos must explain fees, slippage, and irreversible actions before signing.',
    ],
  };
}

function isMemecoinLaunchRequest(content: string) {
  return Boolean(parseMemecoinDraft(content));
}

function formatMemecoinDraftResponse(draft: MythosMemecoinDraft) {
  return cleanTerminalText([
    terminalSection('Intent', `Prepare a Pump.fun-style memecoin launch draft for ${draft.name} (${draft.symbol}).`),
    terminalSection('Launch readiness', [
      `Mode: ${draft.launchMode === 'launch_review_ready' ? 'launch review ready' : 'preview only'}`,
      `Readiness score: ${draft.readinessScore}/100`,
      `Estimated review range: ${draft.estimatedCostSol.label}`,
    ]),
    terminalSection('Launch fields', [
      `Name: ${draft.name}`,
      `Ticker: ${draft.symbol}`,
      `Description: ${draft.description}`,
      `Image prompt: ${draft.imagePrompt}`,
      `First buy intent: ${draft.initialBuySol > 0 ? `${draft.initialBuySol} SOL` : 'not set'}`,
      `Wallet: ${draft.walletReady ? draft.walletAddress : 'not connected'}`,
    ]),
    terminalSection('Execution ladder', draft.phases.map(phase => `- ${phase.title}: ${phase.status} - ${phase.detail}`)),
    terminalSection('Human review checklist', draft.reviewChecklist.map(item => `- ${item}`)),
    terminalSection('Blocked actions', draft.blockedActions.map(action => `- ${action}`)),
    terminalSection('Next safe step', draft.walletReady
      ? 'Press Arm launch review to create a local approval packet. A future executor must still require Phantom/Solflare signature.'
      : 'Connect Phantom or Solflare, then review the launch brief again before any transaction preparation.'),
    terminalSection('Safety boundary', draft.safetyNotes.map(note => `- ${note}`)),
  ].join('\n\n'));
}

function formatMemecoinLaunchReviewResponse(draft: MythosMemecoinDraft) {
  return cleanTerminalText([
    terminalSection('Intent', `Arm a local launch review packet for ${draft.name} (${draft.symbol}).`),
    terminalSection('Decision', 'Launch review is armed locally. Mythos still did not upload metadata, mint, sign, submit, or buy.'),
    terminalSection('Approval gates', [
      'Gate 1: Wallet connected and visible to the user.',
      'Gate 2: Metadata and image reviewed by the user.',
      'Gate 3: Pump.fun transaction payload generated by a future audited executor.',
      'Gate 4: Phantom/Solflare opens a visible signature request.',
      'Gate 5: User signs manually after reviewing fees, first buy, and irreversible launch behavior.',
      'Gate 6: Submission and hash are shown, then saved as CongChain memory only after user approval.',
    ]),
    terminalSection('Launch packet', [
      `Name: ${draft.name}`,
      `Ticker: ${draft.symbol}`,
      `Wallet: ${draft.walletAddress || 'not connected'}`,
      `First buy intent: ${draft.initialBuySol > 0 ? `${draft.initialBuySol} SOL` : 'not set'}`,
      `Estimated review range: ${draft.estimatedCostSol.label}`,
      `Readiness: ${draft.readinessScore}/100`,
    ]),
    terminalSection('Blocked actions', draft.blockedActions.map(action => `- ${action}`)),
    terminalSection('Next safe step', 'Build the audited Pump.fun executor route only after we confirm metadata upload rules, payload format, slippage, wallet signature UX, and failure rollback states.'),
  ].join('\n\n'));
}

function memecoinLaunchBrief(draft: MythosMemecoinDraft) {
  return cleanTerminalText([
    `MYTHOS MEMECOIN LAUNCH BRIEF`,
    `Name: ${draft.name}`,
    `Ticker: ${draft.symbol}`,
    `Description: ${draft.description}`,
    `Image prompt: ${draft.imagePrompt}`,
    `Wallet: ${draft.walletAddress || 'not connected'}`,
    `First buy intent: ${draft.initialBuySol > 0 ? `${draft.initialBuySol} SOL` : 'not set'}`,
    `Readiness: ${draft.readinessScore}/100`,
    `Estimated review range: ${draft.estimatedCostSol.label}`,
    ``,
    `Review checklist:`,
    ...draft.reviewChecklist.map(item => `- ${item}`),
    ``,
    `Safety boundary:`,
    ...draft.safetyNotes.map(note => `- ${note}`),
  ].join('\n'));
}

function formatJupiterQuoteResponse(data: Record<string, unknown>) {
  const quote = getRecord(data, 'quote');
  const safety = getRecord(data, 'safety');
  return cleanTerminalText([
    terminalSection('Intent', `Read-only Jupiter quote: ${asString(quote.amountUi)} ${asString(quote.inputSymbol)} to ${asString(quote.outputSymbol)}`),
    terminalSection('Route evidence', [
      `Input mint: ${asString(quote.inputMint)}`,
      `Output mint: ${asString(quote.outputMint)}`,
      `Output raw amount: ${asString(quote.outAmountRaw)}`,
      `Minimum output raw: ${asString(quote.otherAmountThresholdRaw)}`,
      `Route legs: ${asNumber(quote.routePlanCount)}`,
      `Price impact: ${asString(quote.priceImpactPct, 'not reported')}`,
      `Context slot: ${asString(quote.contextSlot)}`,
    ]),
    terminalSection('Decision', 'Quote is ready for human review. It is not a transaction.'),
    terminalSection('Next safe step', 'If the route looks acceptable, continue only through a future audited wallet-signature flow.'),
    terminalSection('Safety boundary', [
      asString(safety.note, 'Read-only quote only.'),
      `Transaction payload created: ${asString(safety.transactionPayloadCreated, 'false')}`,
      `Wallet signature requested: ${asString(safety.walletSignatureRequested, 'false')}`,
      `Submitted to Solana: ${asString(safety.submittedToSolana, 'false')}`,
    ]),
  ].join('\n\n'));
}

function formatWalletPlanResponse(command: string) {
  const plan = createMythosWalletCommandPlan({
    prompt: command,
    network: 'solana-mainnet',
  });
  return cleanTerminalText([
    terminalSection('Intent', `${plan.intentType} / ${plan.routeKind}`),
    terminalSection('Route status', [
      `Status: ${plan.routeStatus}`,
      `Confirmation allowed: ${plan.confirmation.allowed}`,
      `Reason: ${plan.confirmation.reason}`,
      plan.jupiterQuoteRequest
        ? `Jupiter quote: ${plan.jupiterQuoteRequest.status} - ${plan.jupiterQuoteRequest.reason}`
        : 'Jupiter quote: not required for this command',
    ]),
    terminalSection('Execution ladder', plan.phases.map(phase => `- ${phase.title}: ${phase.status} - ${phase.detail}`)),
    terminalSection('Wallet actions required', plan.walletActions.map(action => `- ${action}`)),
    terminalSection('Blocked actions', plan.blockedActions.map(action => `- ${action}`)),
    terminalSection('Memory candidate', [
      plan.memoryCandidate.title,
      plan.memoryCandidate.content,
    ]),
    terminalSection('Safety boundary', plan.safety.notes.map(note => `- ${note}`)),
  ].join('\n\n'));
}

function helpResponse() {
  return cleanTerminalText([
    'Mythos Command Terminal',
    'Use slash commands for the same Solana, Wallet Agent, Jupiter, and CongChain memory logic from one place.',
    '',
    ...TERMINAL_COMMANDS.map(item => `${item.command}\n${item.detail}\n`),
    'Examples',
    '/analyze tx 5ycrKxWCw4Px...',
    '/analyze wallet 2snAwv3rui3kcjBZbwN2uigN7yYTNnhEsZh6k5ZAg1Vs',
    '/analyze token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    '/market report',
    '/solana report',
    '/solana protocols',
    '/solana volume',
    '/solana memes',
    '/create meme Anubis Dog symbol ADOG buy 0.1 SOL image neon anubis dog mascot',
    '/quote swap 0.1 SOL to USDC',
    '/plan pay 0.05 SOL to <wallet>',
    '',
    'Safety',
    'Commands explain, prepare, quote, and save reviewed memory. They do not sign, submit, buy, sell, pay, schedule, or move funds automatically.',
  ].join('\n'));
}

function isMarketReportRequest(content: string) {
  return /^\/(?:market|crypto)\s+report$/i.test(content.trim()) ||
    /\b(relatorio|relatório|report|market|mercado|oportunidades)\b/i.test(content) &&
    /\b(crypto|cripto|bitcoin|solana|altcoin|tokens?)\b/i.test(content);
}

function isSolanaEcosystemRequest(content: string) {
  const normalized = content.trim().toLowerCase();
  if (/^\/solana\s+(report|price|preco|preço|protocols|protocolos|volume|memes?)$/.test(normalized)) return true;
  if (/^\/sol\s+(report|price|preco|preço|protocols|protocolos|volume|memes?)$/.test(normalized)) return true;
  const asksSolana = /\b(sol|solana)\b/i.test(content);
  const asksPrice = /\b(price|preco|preço|cotacao|cotação|valor)\b/i.test(content);
  const asksProtocols = /\b(protocol|protocolo|protocolos|protocols|tvl|defi)\b/i.test(content);
  const asksVolume = /\b(volume|liquidez|liquidity)\b/i.test(content);
  const asksMemes = /\b(meme|memes|memecoin|memecoins)\b/i.test(content);
  const asksTop = /\b(top|maiores|principais|10|dez)\b/i.test(content);
  return asksSolana && ((asksPrice && !asksProtocols && !asksVolume && !asksMemes) || (asksProtocols && asksTop) || (asksVolume && asksTop) || (asksMemes && asksTop));
}

function solanaReportModeFor(content: string): MythosSolanaReportMode {
  const normalized = content.trim().toLowerCase();
  if (/\b(memes?|memecoin|memecoins)\b/.test(normalized)) return 'memes';
  if (/\b(volume|liquidez|liquidity)\b/.test(normalized)) return 'volume';
  if (/\b(protocols?|protocolos?|protocolo|tvl|defi)\b/.test(normalized)) return 'protocols';
  return 'price';
}

function formatMarketReportText(report: MythosCryptoMarketReport) {
  return cleanTerminalText([
    terminalSection('Intent', 'Crypto market intelligence report'),
    terminalSection('Market pulse', [
      `Sentiment: ${report.sentiment.replace('_', '-')}`,
      `Market cap: ${report.global.marketCapLabel}`,
      `BTC dominance: ${report.global.btcDominanceLabel}`,
      `24h volume: ${report.global.volume24hLabel}`,
    ]),
    terminalSection('Opportunity watchlist', report.opportunities.slice(0, 5).map(item =>
      `- ${item.coin.symbol}: ${item.conviction} conviction, risk ${item.riskLevel}/100. ${item.thesis}`
    )),
    terminalSection('Decision', report.executiveSummary),
    terminalSection('Next safe step', 'Use Mythos token, wallet, and transaction analysis before making any real decision. This report is a watchlist, not a buy/sell instruction.'),
    terminalSection('Safety boundary', [
      'Read-only public market data.',
      'No trading, wallet signature, or fund movement.',
      'Not financial advice.',
    ]),
  ].join('\n\n'));
}

function formatSolanaReportText(report: MythosSolanaEcosystemReport) {
  const list = report.mode === 'memes'
    ? (report.assets?.memeLeaders ?? []).map((asset, index) => `${index + 1}. ${asset.symbol} - ${asset.volume24hLabel} 24h volume (${asset.change24hLabel})`)
    : report.mode === 'volume'
      ? (report.assets?.volumeLeaders ?? []).map((asset, index) => `${index + 1}. ${asset.symbol} - ${asset.volume24hLabel} 24h volume (${asset.change24hLabel})`)
      : report.mode === 'protocols'
        ? report.defi.topProtocols.map((protocol, index) => `${index + 1}. ${protocol.name} - ${protocol.tvlLabel} TVL (${protocol.category})`)
        : [
            `SOL price: ${report.price.label}`,
            `24h move: ${report.price.change24hLabel}`,
            `Market cap: ${report.price.marketCapLabel}`,
            `24h volume: ${report.price.volume24hLabel}`,
            `ATH: ${report.price.athLabel}`,
          ];

  return cleanTerminalText([
    terminalSection('Intent', `Solana ${report.mode} intelligence report`),
    terminalSection('SOL market readout', [
      `SOL price: ${report.price.label}`,
      `24h move: ${report.price.change24hLabel}`,
      `Market cap: ${report.price.marketCapLabel}`,
      `24h volume: ${report.price.volume24hLabel}`,
      `ATH: ${report.price.athLabel}`,
    ]),
    terminalSection(report.mode === 'protocols' ? 'Top Solana protocols' : report.mode === 'volume' ? 'Top Solana volume leaders' : report.mode === 'memes' ? 'Top Solana memes' : 'SOL price context', list),
    terminalSection('Decision', report.readout.headline),
    terminalSection('Plain English', report.readout.plainEnglish),
    terminalSection('Next safe step', report.readout.nextSafeStep),
    terminalSection('Safety boundary', [
      'Read-only CoinGecko and DeFiLlama market intelligence.',
      'Not financial advice.',
      'No wallet connection, signature, swap, payment, or fund movement.',
    ]),
  ].join('\n\n'));
}

function trendClass(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'text-white/52';
  return value >= 0 ? 'text-[#76FF03]' : 'text-[#FF5C7A]';
}

function barWidth(value: number, max: number) {
  if (!max || !Number.isFinite(max)) return '6%';
  return `${Math.max(6, Math.min(100, (value / max) * 100))}%`;
}

function CoinRow({ coin, index, mode }: { coin: MythosCryptoCoin | SolanaAssetSummary; index: number; mode: 'gain' | 'loss' | 'trend' | 'volume' | 'meme' }) {
  const change = 'change7d' in coin && mode !== 'volume' && mode !== 'meme' ? coin.change7d : coin.change24h;
  const changeLabel = 'change7d' in coin && mode !== 'volume' && mode !== 'meme'
    ? `${coin.change7d !== null && coin.change7d !== undefined ? coin.change7d.toFixed(2) : '0.00'}%`
    : coin.change24hLabel;
  const valueLabel = 'volume24hLabel' in coin ? coin.volume24hLabel : coin.price ? `$${coin.price.toLocaleString('en-US', { maximumSignificantDigits: 4 })}` : 'trending';

  return (
    <div className="grid grid-cols-[34px_1fr_auto] items-center gap-3 border-b border-white/8 py-3 last:border-b-0">
      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/8">
        {coin.image ? <img src={coin.image} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] font-black text-white/52">#{index + 1}</span>}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-black uppercase text-white">{coin.symbol}</p>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-0.5 text-[9px] font-bold text-white/38">
            #{coin.rank || index + 1}
          </span>
        </div>
        <p className="truncate text-[11px] text-white/42">{coin.name}</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-black text-white">{valueLabel}</p>
        <p className={`text-[11px] font-black ${trendClass(change)}`}>{mode === 'trend' ? 'trending' : changeLabel}</p>
      </div>
    </div>
  );
}

function MythosCryptoReportCard({ report }: { report: MythosCryptoMarketReport }) {
  return (
    <div className="mt-2 overflow-hidden rounded-[28px] border border-[#76FF03]/22 bg-[radial-gradient(circle_at_top_left,rgba(118,255,3,0.18),transparent_34%),linear-gradient(180deg,rgba(11,38,5,0.92),rgba(1,8,3,0.96))] p-5 shadow-[0_0_50px_rgba(118,255,3,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#76FF03]">Mythos Market Intelligence</p>
          <h3 className="mt-2 text-2xl font-black text-white">Crypto market report</h3>
          <p className="mt-1 text-xs text-white/52">Data via {report.source.replace(/_/g, ' + ')} - {new Date(report.generatedAt).toLocaleString()}</p>
        </div>
        <span className="rounded-2xl border border-yellow-300/30 bg-yellow-300/10 px-4 py-3 text-sm font-black capitalize text-yellow-200">
          {report.sentiment.replace('_', ' ')}
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Market cap', report.global.marketCapLabel],
          ['BTC dominance', report.global.btcDominanceLabel],
          ['24h volume', report.global.volume24hLabel],
          ['Active assets', report.global.activeCryptos?.toLocaleString('en-US') || 'unavailable'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-black/28 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
            <p className="mt-3 text-xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#76FF03]/18 bg-black/24 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#76FF03]">Top gainers - 7d</p>
          <div className="mt-3">{report.gainers.slice(0, 5).map((coin, index) => <CoinRow key={coin.id} coin={coin} index={index} mode="gain" />)}</div>
        </div>
        <div className="rounded-2xl border border-[#FF5C7A]/18 bg-black/24 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF5C7A]">Weak names - 7d</p>
          <div className="mt-3">{report.losers.slice(0, 5).map((coin, index) => <CoinRow key={coin.id} coin={coin} index={index} mode="loss" />)}</div>
        </div>
        <div className="rounded-2xl border border-[#7DE4FF]/18 bg-black/24 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7DE4FF]">Trending attention</p>
          <div className="mt-3">{report.trending.slice(0, 5).map((coin, index) => <CoinRow key={coin.id} coin={coin} index={index} mode="trend" />)}</div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/24 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Mythos readout</p>
        <p className="mt-2 text-sm leading-6 text-white/72">{report.executiveSummary}</p>
      </div>
    </div>
  );
}

function MythosSolanaReportCard({ report }: { report: MythosSolanaEcosystemReport }) {
  const protocols = report.defi.topProtocols;
  const maxTvl = Math.max(...protocols.map(protocol => protocol.tvlUsd), 1);
  const assetList = report.mode === 'memes' ? report.assets.memeLeaders : report.assets.volumeLeaders;
  const heading = report.mode === 'protocols'
    ? 'SOL price + top protocols'
    : report.mode === 'volume'
      ? 'Solana volume leaders'
      : report.mode === 'memes'
        ? 'Solana meme radar'
        : 'SOL market pulse';

  return (
    <div className="mt-2 overflow-hidden rounded-[28px] border border-[#76FF03]/22 bg-[radial-gradient(circle_at_top_left,rgba(118,255,3,0.18),transparent_34%),linear-gradient(180deg,rgba(3,36,21,0.92),rgba(1,8,3,0.96))] p-5 shadow-[0_0_50px_rgba(118,255,3,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#14F195]">Solana intelligence</p>
          <h3 className="mt-2 text-2xl font-black text-white">{heading}</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/52">{report.readout.plainEnglish}</p>
        </div>
        <span className={`rounded-2xl border px-4 py-3 text-sm font-black capitalize ${
          report.readout.sentiment === 'bullish'
            ? 'border-[#76FF03]/30 bg-[#76FF03]/10 text-[#A7FF3D]'
            : report.readout.sentiment === 'risk_off'
              ? 'border-[#FF5C7A]/30 bg-[#FF5C7A]/10 text-[#FF8DA3]'
              : 'border-yellow-300/30 bg-yellow-300/10 text-yellow-200'
        }`}>
          {report.readout.sentiment.replace('_', ' ')}
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['SOL / USD', report.price.label, `Rank #${report.price.rank || '-'}`],
          ['24h move', report.price.change24hLabel, 'spot momentum'],
          ['Market cap', report.price.marketCapLabel, 'SOL network value'],
          ['24h volume', report.price.volume24hLabel, 'spot market activity'],
          ['Solana DeFi TVL', report.defi.totalTvlLabel, `${report.defi.protocolCount} protocols sampled`],
        ].map(([label, value, detail]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-black/28 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
            <p className={`mt-3 text-xl font-black ${label === '24h move' ? trendClass(report.price.change24h) : 'text-white'}`}>{value}</p>
            <p className="mt-1 text-[11px] text-white/36">{detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-[#76FF03]/18 bg-black/24 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#76FF03]">
            {report.mode === 'protocols' || report.mode === 'price' ? 'Top 10 protocols by TVL' : report.mode === 'volume' ? 'Top Solana assets by volume' : 'Top Solana memes'}
          </p>
          <div className="mt-4 grid gap-3">
            {(report.mode === 'protocols' || report.mode === 'price') ? protocols.slice(0, 10).map((protocol, index) => (
              <div key={`${protocol.name}-${index}`} className="rounded-2xl border border-white/8 bg-black/26 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/8 text-[10px] font-black text-white/48">#{index + 1}</span>
                      <p className="truncate text-sm font-black text-white">{protocol.name}</p>
                      <span className="rounded-full border border-[#76FF03]/18 bg-[#76FF03]/8 px-2 py-0.5 text-[9px] font-bold uppercase text-[#A7FF3D]">{protocol.category}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-white/38">1d {protocol.change1d?.toFixed(2) ?? '0.00'}% - 7d {protocol.change7d?.toFixed(2) ?? '0.00'}%</p>
                  </div>
                  <p className="shrink-0 text-sm font-black text-white">{protocol.tvlLabel}</p>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full bg-[#76FF03]" style={{ width: barWidth(protocol.tvlUsd, maxTvl) }} />
                </div>
              </div>
            )) : assetList.slice(0, 10).map((asset, index) => (
              <CoinRow key={asset.id} coin={asset} index={index} mode={report.mode === 'memes' ? 'meme' : 'volume'} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#14F195]/18 bg-[#052519]/62 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#14F195]">Mythos readout</p>
          <h4 className="mt-4 text-xl font-black text-white">{report.readout.headline}</h4>
          <p className="mt-4 text-sm leading-6 text-white/66">{report.readout.nextSafeStep}</p>
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/24 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/36">Safety</p>
            <p className="mt-2 text-xs leading-5 text-white/54">Read-only market intelligence. No wallet connection, signature, swap, payment, or fund movement.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MythosMemecoinDraftCard({
  draft,
  onConnectWallet,
  onArmLaunchReview,
  onCopyLaunchBrief,
}: {
  draft: MythosMemecoinDraft;
  onConnectWallet: () => void;
  onArmLaunchReview: (draft: MythosMemecoinDraft) => void;
  onCopyLaunchBrief: (draft: MythosMemecoinDraft) => void;
}) {
  const [editableDraft, setEditableDraft] = useState(draft);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [logoFileName, setLogoFileName] = useState('');

  useEffect(() => {
    setEditableDraft(draft);
    setLogoPreviewUrl('');
    setLogoFileName('');
  }, [draft]);

  function normalizeSymbol(value: string) {
    const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    return normalized || 'MEME';
  }

  function recomputeDraft(next: MythosMemecoinDraft): MythosMemecoinDraft {
    const name = next.name.trim() || 'Untitled Meme';
    const symbol = normalizeSymbol(next.symbol);
    const description = next.description.trim() || `${name} is a community meme token draft prepared by Mythos for human review.`;
    const imagePrompt = next.imagePrompt.trim() || `Premium green-black Solana meme coin logo for ${name}, bold mascot, clean circular icon.`;
    const initialBuySol = Number.isFinite(next.initialBuySol) ? Math.max(next.initialBuySol, 0) : 0;
    const walletReady = Boolean(next.walletAddress);
    const hasName = name !== 'Untitled Meme';
    const hasFirstBuy = initialBuySol > 0;
    const readinessScore = Math.min([
      hasName,
      symbol.length >= 2,
      description.length >= 24,
      imagePrompt.length >= 18,
      walletReady,
      hasFirstBuy,
    ].filter(Boolean).length * 14 + (walletReady && hasFirstBuy ? 16 : 0), 100);
    const minimumCost = Number((0.02 + initialBuySol).toFixed(4));
    const maximumCost = Number((0.08 + initialBuySol).toFixed(4));

    return {
      ...next,
      name,
      symbol,
      description,
      imagePrompt,
      initialBuySol,
      launchMode: walletReady && hasName ? 'launch_review_ready' : 'preview_only',
      readinessScore,
      estimatedCostSol: {
        minimum: minimumCost,
        maximum: maximumCost,
        label: `${minimumCost}-${maximumCost} SOL estimated review range`,
      },
      phases: [
        {
          title: '1. Token identity',
          status: hasName ? 'ready' : 'review',
          detail: `Name ${name} and ticker ${symbol} are editable and ready for human review.`,
        },
        {
          title: '2. Visual metadata',
          status: logoFileName || imagePrompt ? 'review' : 'pending',
          detail: logoFileName
            ? `Local logo preview selected: ${logoFileName}. It is not uploaded yet.`
            : 'Image prompt is prepared, but no file is uploaded to IPFS or Pump.fun yet.',
        },
        {
          title: '3. Wallet readiness',
          status: walletReady ? 'ready' : 'review',
          detail: walletReady
            ? `Wallet ${next.walletAddress?.slice(0, 4)}...${next.walletAddress?.slice(-4)} is connected for future approval.`
            : 'Connect Phantom or Solflare before any future launch transaction can be prepared.',
        },
        {
          title: '4. First buy intent',
          status: hasFirstBuy ? 'review' : 'pending',
          detail: hasFirstBuy
            ? `User requested a first buy intent of ${initialBuySol} SOL. This is not executed.`
            : 'No first-buy SOL amount is set yet.',
        },
        {
          title: '5. Pump.fun transaction',
          status: 'blocked',
          detail: 'No mint, bonding curve transaction, metadata upload, or buy transaction is created in this phase.',
        },
        {
          title: '6. Wallet signature',
          status: 'pending',
          detail: 'A future phase must show the final transaction in Phantom/Solflare and require explicit user approval.',
        },
      ],
    };
  }

  function updateEditableDraft(patch: Partial<MythosMemecoinDraft>) {
    setEditableDraft(current => recomputeDraft({ ...current, ...patch }));
  }

  function handleLogoChange(file?: File) {
    if (!file) return;
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoPreviewUrl(URL.createObjectURL(file));
    setLogoFileName(file.name);
  }

  const statusTone = editableDraft.walletReady ? 'Ready for review' : 'Wallet needed';
  const readinessLabel = editableDraft.launchMode === 'launch_review_ready' ? 'Launch review ready' : 'Preview only';
  const compactSymbol = editableDraft.symbol.length > 7 ? `${editableDraft.symbol.slice(0, 7)}...` : editableDraft.symbol;

  return (
    <div className="mt-4 overflow-hidden rounded-[28px] border border-[#76FF03]/24 bg-[linear-gradient(135deg,rgba(9,43,4,0.92),rgba(1,8,3,0.98))] p-5 shadow-[0_0_46px_rgba(118,255,3,0.055)]">
      <div className="flex flex-col gap-5 xl:flex-row">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#76FF03]/24 bg-[#76FF03]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#A7FF3D]">
              Memecoin Studio
            </span>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
              editableDraft.walletReady
                ? 'border-[#14F195]/24 bg-[#14F195]/10 text-[#8CFFD2]'
                : 'border-[#FFD166]/24 bg-[#FFD166]/10 text-[#FFE08A]'
            }`}>
              {statusTone}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[170px_minmax(0,1fr)]">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[32px] border border-[#76FF03]/26 bg-[radial-gradient(circle_at_50%_34%,rgba(118,255,3,0.22),transparent_42%),rgba(0,0,0,0.68)]">
              {logoPreviewUrl ? (
                <img src={logoPreviewUrl} alt={`${editableDraft.name} local logo preview`} className="h-full w-full object-cover" />
              ) : (
              <div className="text-center">
                <Coins className="mx-auto h-9 w-9 text-[#A7FF3D]" />
                  <p className="mt-3 max-w-[132px] break-words text-xl font-black uppercase tracking-[0.12em] text-white">${compactSymbol}</p>
              </div>
              )}
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/36">Launch draft</p>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_150px]">
                <label className="block">
                  <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/34">Meme name</span>
                  <input
                    value={editableDraft.name}
                    onChange={event => updateEditableDraft({ name: event.target.value })}
                    className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/34 px-4 text-sm font-bold text-white outline-none transition placeholder:text-white/24 focus:border-[#76FF03]/42"
                    placeholder="Example: Green Zeus"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/34">Ticker</span>
                  <input
                    value={editableDraft.symbol}
                    onChange={event => updateEditableDraft({ symbol: event.target.value })}
                    className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/34 px-4 font-mono text-sm font-black uppercase text-[#A7FF3D] outline-none transition placeholder:text-white/24 focus:border-[#76FF03]/42"
                    placeholder="ZEUS"
                  />
                </label>
              </div>
              <label className="mt-3 block">
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/34">Description</span>
                <textarea
                  value={editableDraft.description}
                  onChange={event => updateEditableDraft({ description: event.target.value })}
                  className="mt-2 min-h-[82px] w-full resize-none rounded-2xl border border-white/10 bg-black/34 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/24 focus:border-[#76FF03]/42"
                  placeholder="Explain the meme, community, visual identity, and launch intent."
                />
              </label>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/34 p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/34">Ticker</p>
                  <p className="mt-2 break-all font-mono text-base font-black text-[#A7FF3D]">${editableDraft.symbol}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/34 p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/34">First buy</p>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editableDraft.initialBuySol || ''}
                    onChange={event => updateEditableDraft({ initialBuySol: Number(event.target.value) })}
                    className="mt-2 h-9 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-black text-white outline-none focus:border-[#76FF03]/42"
                    placeholder="0.00 SOL"
                  />
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/34 p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/34">Mode</p>
                  <p className="mt-2 text-lg font-black text-white">{readinessLabel}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7DE4FF]">Image brief</p>
              <textarea
                value={editableDraft.imagePrompt}
                onChange={event => updateEditableDraft({ imagePrompt: event.target.value })}
                className="mt-3 min-h-[102px] w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/24 focus:border-[#7DE4FF]/40"
                placeholder="Describe mascot/logo style for the meme image."
              />
              <label className="mt-3 inline-flex h-10 cursor-pointer items-center justify-center rounded-2xl border border-[#7DE4FF]/18 bg-[#7DE4FF]/8 px-4 text-xs font-black uppercase tracking-[0.12em] text-[#9AEAFF] transition hover:bg-[#7DE4FF]/13">
                Select local logo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={event => handleLogoChange(event.target.files?.[0])}
                />
              </label>
              {logoFileName ? (
                <p className="mt-2 break-all text-[11px] leading-4 text-white/42">Local preview only: {logoFileName}. No upload happened.</p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-[#76FF03]/18 bg-[#76FF03]/[0.045] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Launch readiness</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-4xl font-black text-white">{editableDraft.readinessScore}</p>
                <p className="pb-1 text-xs font-black uppercase tracking-[0.12em] text-white/38">/100</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full bg-[#76FF03]" style={{ width: `${editableDraft.readinessScore}%` }} />
              </div>
              <p className="mt-3 text-xs leading-5 text-white/52">{editableDraft.estimatedCostSol.label}. This is an estimate for review only, not a quote.</p>
            </div>
          </div>
        </div>

        <div className="w-full rounded-3xl border border-white/10 bg-black/36 p-4 xl:w-[360px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Wallet</p>
              <p className="mt-1 text-sm font-black text-white">{editableDraft.walletReady ? 'Connected' : 'Not connected'}</p>
            </div>
            <Wallet className={editableDraft.walletReady ? 'h-5 w-5 text-[#14F195]' : 'h-5 w-5 text-[#FFD166]'} />
          </div>
          <p className="mt-3 break-all rounded-2xl border border-white/8 bg-white/[0.035] p-3 font-mono text-xs text-white/48">
            {editableDraft.walletAddress || 'Connect Phantom or Solflare before transaction preparation.'}
          </p>
          {!editableDraft.walletReady ? (
            <button
              type="button"
              onClick={onConnectWallet}
              className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-2xl border border-[#14F195]/22 bg-[#14F195]/10 text-xs font-black uppercase tracking-[0.12em] text-[#8CFFD2] transition hover:bg-[#14F195]/16"
            >
              Connect Phantom / Solflare
            </button>
          ) : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <button
              type="button"
              onClick={() => onCopyLaunchBrief(editableDraft)}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.045] text-xs font-black uppercase tracking-[0.12em] text-white/68 transition hover:bg-white/[0.07]"
            >
              Copy launch brief
            </button>
            <button
              type="button"
              onClick={() => onArmLaunchReview(editableDraft)}
              disabled={!editableDraft.walletReady}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-[#76FF03]/22 bg-[#76FF03]/12 text-xs font-black uppercase tracking-[0.12em] text-[#B8FF5C] transition hover:bg-[#76FF03]/18 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.035] disabled:text-white/30"
            >
              Arm launch review
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {editableDraft.phases.map((phase, index) => (
              <div key={`${phase.title}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-white">{phase.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                    phase.status === 'ready'
                      ? 'bg-[#14F195]/12 text-[#8CFFD2]'
                      : phase.status === 'blocked'
                        ? 'bg-[#FF5C7A]/12 text-[#FF8FAB]'
                        : 'bg-[#FFD166]/12 text-[#FFE08A]'
                  }`}>
                    {phase.status}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-white/48">{phase.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-[#FF5C7A]/16 bg-[#FF5C7A]/6 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF8FAB]">Blocked until future signature phase</p>
            <p className="mt-2 text-xs leading-5 text-white/54">No mint, Pump.fun upload, first buy, or Solana submission is executed from this preview.</p>
          </div>
          <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/36">Human review checklist</p>
            <ul className="mt-3 space-y-2 text-[11px] leading-4 text-white/48">
              {editableDraft.reviewChecklist.slice(0, 4).map(item => <li key={item}>- {item}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function makeSession(): MythosLabSession {
  const createdAt = nowIso();
  return {
    id: createId('mythos_session'),
    title: 'Welcome to Mythos',
    createdAt,
    updatedAt: createdAt,
    mode: 'demo',
    model: 'nvidia',
    nvidiaModelRoute: getNvidiaModelRoute().id,
    skillId: MYTHOS_FEATURED_SKILLS[0]?.id || 'congchain-memory',
    messages: [
      {
        id: createId('msg'),
        role: 'system',
        createdAt,
        content:
          'Mythos Lab is ready. Choose a skill, send a task, review the cognitive trace, then save only approved output as CongChain memory.',
      },
    ],
  };
}

function safeLoadSessions(): MythosLabSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]') as MythosLabSession[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

export default function MythosLabConsole() {
  const profile = MYTHOS_AGENT_PROFILE;
  const { publicKey, connected, disconnect, wallet, wallets, select, connecting } = useWallet();
  const [sessions, setSessions] = useState<MythosLabSession[]>([]);
  const [activeId, setActiveId] = useState('');
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [pendingSaveMessageId, setPendingSaveMessageId] = useState('');
  const [savingMemoryId, setSavingMemoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [walletConnectError, setWalletConnectError] = useState('');
  const [proAccessOpen, setProAccessOpen] = useState(false);
  const [pendingProModelId, setPendingProModelId] = useState('');
  const [proAccessUser, setProAccessUser] = useState('');
  const [proAccessPassword, setProAccessPassword] = useState('');
  const [proAccessUnlocked, setProAccessUnlocked] = useState(false);
  const [proAccessLoading, setProAccessLoading] = useState(false);
  const [proAccessError, setProAccessError] = useState('');

  useEffect(() => {
    const loaded = safeLoadSessions();
    const initial = loaded.length > 0 ? loaded : [makeSession()];
    setSessions(initial);
    setActiveId(initial[0]?.id || '');
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkProAccess() {
      try {
        const response = await fetch('/api/mythos/pro-access', { cache: 'no-store' });
        const data = await response.json();
        if (!cancelled) setProAccessUnlocked(Boolean(data.unlocked));
      } catch {
        if (!cancelled) setProAccessUnlocked(false);
      }
    }

    void checkProAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 8)));
    }
  }, [sessions]);

  const activeSession = sessions.find(session => session.id === activeId) || sessions[0];
  const selectedSkill =
    MYTHOS_FEATURED_SKILLS.find(skill => skill.id === activeSession?.skillId) ||
    MYTHOS_FEATURED_SKILLS[0];
  const assistantMessages = activeSession?.messages.filter(message => message.role === 'assistant') || [];
  const lastAssistant = assistantMessages[assistantMessages.length - 1];
  const currentModel = getModelOption(activeSession?.model);
  const currentNvidiaRoute = getNvidiaModelRoute(activeSession?.nvidiaModelRoute);
  const currentModelButtonLabel = currentModel.id === 'nvidia'
    ? `NVIDIA · ${currentNvidiaRoute.shortLabel}`
    : currentModel.label;
  const connectedAddress = publicKey?.toString() || '';
  const walletShortAddress = connectedAddress ? `${connectedAddress.slice(0, 4)}...${connectedAddress.slice(-4)}` : '';

  const memoryPayload = useMemo(() => ({
    content: lastAssistant?.content || '',
    model: 'mythos',
    metadata: {
      source: 'mythos',
      contentType: 'mythos_lab_response',
      agentId: 'mythos-lab',
      agentName: 'Mythos',
      namespace: profile.identity.namespace,
      selectedSkill: selectedSkill?.name,
      skillPath: selectedSkill?.path,
      sessionId: activeSession?.id,
      skillRoute: activeSession?.lastSkillRoute,
      cognitiveTrace: activeSession?.lastTrace,
      observability: activeSession?.lastObservability,
      origin: 'mythos-lab',
      safety: {
        containsSecrets: false,
        containsPrivateKeys: false,
        containsSignedPayloads: false,
        canMoveFunds: false,
        requiresHumanReview: true,
      },
    },
  }), [activeSession?.id, activeSession?.lastObservability, activeSession?.lastSkillRoute, activeSession?.lastTrace, lastAssistant?.content, profile.identity.namespace, selectedSkill?.name, selectedSkill?.path]);

  function updateActive(updater: (session: MythosLabSession) => MythosLabSession) {
    setSessions(current => current.map(session => session.id === activeSession?.id ? updater(session) : session));
  }

  function startSession() {
    const session = makeSession();
    setSessions(current => [session, ...current].slice(0, 8));
    setActiveId(session.id);
    setInput('');
    setNotice('');
    setPendingSaveMessageId('');
  }

  function deleteSession(sessionId: string) {
    setSessions(current => {
      const remaining = current.filter(session => session.id !== sessionId);
      const next = remaining.length > 0 ? remaining : [makeSession()];
      if (sessionId === activeId) setActiveId(next[0]?.id || '');
      return next;
    });
    setPendingSaveMessageId('');
    setNotice('');
  }

  function clearHistory() {
    const session = makeSession();
    setSessions([session]);
    setActiveId(session.id);
    setInput('');
    setNotice('');
    setPendingSaveMessageId('');
  }

  function selectModel(modelId: string) {
    const model = getModelOption(modelId);
    if (model.access === 'pro' && !proAccessUnlocked) {
      setPendingProModelId(model.id);
      setProAccessOpen(true);
      setModelMenuOpen(false);
      setProAccessError('');
      setNotice(`${model.label} requires Mythos PRO access before it can be selected.`);
      return;
    }

    updateActive(session => ({
      ...session,
      model: model.id,
      nvidiaModelRoute: model.id === 'nvidia' ? (session.nvidiaModelRoute || getNvidiaModelRoute().id) : session.nvidiaModelRoute,
      updatedAt: nowIso(),
    }));
    setModelMenuOpen(false);
    setNotice(`Mythos model route set to ${model.label}. Server availability still depends on configured provider keys.`);
  }

  function selectNvidiaRoute(routeId: string) {
    const route = getNvidiaModelRoute(routeId);
    updateActive(session => ({
      ...session,
      model: 'nvidia',
      nvidiaModelRoute: route.id,
      updatedAt: nowIso(),
    }));
    setModelMenuOpen(false);
    setNotice(`NVIDIA route set to ${route.label}. Mythos will use this allowlisted backend model when the NVIDIA route is selected.`);
  }

  async function submitProAccess() {
    setProAccessLoading(true);
    setProAccessError('');

    try {
      const response = await fetch('/api/mythos/pro-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: proAccessUser,
          password: proAccessPassword,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.unlocked) {
        throw new Error(data.error || 'Mythos PRO access was rejected.');
      }

      setProAccessUnlocked(true);
      setProAccessOpen(false);
      setProAccessPassword('');
      const nextModel = getModelOption(pendingProModelId || 'gpt');
      updateActive(session => ({
        ...session,
        model: nextModel.id,
        updatedAt: nowIso(),
      }));
      setPendingProModelId('');
      setNotice(`Mythos PRO route unlocked. Model route set to ${nextModel.label}.`);
    } catch (error) {
      setProAccessError(error instanceof Error ? error.message : 'Mythos PRO access failed.');
    } finally {
      setProAccessLoading(false);
    }
  }

  async function handleWalletAction() {
    if (connected) {
      await disconnect();
      setNotice('Wallet disconnected from Mythos Lab. No transaction was signed or submitted.');
      setWalletMenuOpen(false);
      return;
    }
    setWalletConnectError('');
    setWalletMenuOpen(open => !open);
  }

  function openWalletFallback(option: typeof MYTHOS_WALLET_OPTIONS[number]) {
    if (typeof window === 'undefined') return;
    const currentUrl = window.location.href;
    const ref = window.location.origin;
    window.location.href = isMobileBrowser()
      ? option.mobileUrl(currentUrl, ref)
      : option.installUrl;
  }

  async function connectMythosWallet(option: typeof MYTHOS_WALLET_OPTIONS[number]) {
    setWalletConnectError('');
    setConnectingWallet(option.key);

    const candidate = wallets.find(item =>
      item.adapter.name.toLowerCase().includes(option.name.toLowerCase())
    );

    if (!candidate) {
      openWalletFallback(option);
      setConnectingWallet(null);
      return;
    }

    const readyState = candidate.adapter.readyState;
    const canConnect =
      readyState === WalletReadyState.Installed ||
      readyState === WalletReadyState.Loadable;

    if (!canConnect && !isMobileBrowser()) {
      openWalletFallback(option);
      setConnectingWallet(null);
      return;
    }

    try {
      select(candidate.adapter.name as WalletName);
      await Promise.race([
        candidate.adapter.connected ? Promise.resolve() : candidate.adapter.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('wallet_timeout')), 15_000)),
      ]);
      setWalletMenuOpen(false);
      setNotice(`${option.name} connected to Mythos Lab. No transaction was signed or submitted.`);
    } catch (error) {
      if (isMobileBrowser()) {
        openWalletFallback(option);
      } else {
        setWalletConnectError(
          error instanceof Error && error.message === 'wallet_timeout'
            ? `${option.name} opened but did not finish connecting. Unlock the wallet and approve the connection.`
            : `${option.name} did not respond. Check that the extension is installed and unlocked.`
        );
      }
    } finally {
      setConnectingWallet(null);
    }
  }

  async function copyMemecoinLaunchBrief(draft: MythosMemecoinDraft) {
    try {
      await navigator.clipboard.writeText(memecoinLaunchBrief(draft));
      setNotice('Memecoin launch brief copied locally. No token was created and no wallet action was requested.');
    } catch {
      setNotice('Could not copy the launch brief from this browser.');
    }
  }

  function armMemecoinLaunchReview(draft: MythosMemecoinDraft) {
    if (!draft.walletReady) {
      setNotice('Connect Phantom or Solflare before arming launch review. No wallet signature was requested.');
      return;
    }

    const started = Date.now();
    const assistantMessage: MythosLabMessage = {
      id: createId('msg'),
      role: 'assistant',
      createdAt: nowIso(),
      content: formatMemecoinLaunchReviewResponse(draft),
    };

    updateActive(session => ({
      ...session,
      messages: [...session.messages, assistantMessage],
      lastTrace: {
        perception: `Launch review armed for ${draft.name} (${draft.symbol}).`,
        memoryContext: 'The launch packet uses the visible draft and connected public wallet address only.',
        selectedSkill: 'Mythos Memecoin Studio - launch review',
        reasoningPath: 'Mythos checked token identity, metadata readiness, wallet readiness, first-buy intent, blocked actions, and required approval gates.',
        prediction: 'The next implementation stage should build an audited Pump.fun executor that prepares a visible transaction payload but still requires wallet signature.',
        decision: 'Arm the local review packet and keep mint/upload/buy/submission blocked.',
        confidence: draft.readinessScore,
        safetyBoundary: 'No metadata upload, no mint, no signature request, no first buy, no Solana submission.',
        nextHumanStep: 'Review the packet, save it as memory if approved, then build the audited executor route.',
      },
      lastObservability: {
        model: session.model,
        modelLabel: 'Mythos Memecoin Studio launch review',
        latencyMs: Date.now() - started,
        mode: session.mode,
        traceSchema: 'mythos-memecoin-launch-review/v1',
      },
      updatedAt: nowIso(),
    }));
    setNotice('Launch review armed locally. Mythos still did not create, upload, sign, submit, buy, or move funds.');
  }

  function markMessageSaved(messageId: string, data: MemoryWriteResponse) {
    updateActive(session => ({
      ...session,
      messages: session.messages.map(message => message.id === messageId
        ? {
          ...message,
          memoryHash: data.hash,
          readUrl: data.readUrl,
          verifyUrl: data.verifyUrl,
          proofUrl: data.proofUrl,
        }
        : message),
      lastObservability: {
        ...session.lastObservability,
        memoryHash: data.hash,
        savedAt: nowIso(),
      },
      updatedAt: nowIso(),
    }));
  }

  async function saveMessageAsMemory(message: MythosLabMessage) {
    if (!message.content) return;
    if (!apiKey.trim().startsWith('cog_live_')) {
      setPendingSaveMessageId(message.id);
      setNotice('Paste a full CongChain key under this Mythos answer, then save. The key is sent once and never displayed back.');
      return;
    }

    setSavingMemoryId(message.id);
    setNotice('');
    try {
      const response = await fetch(profile.endpoints.writeMemory, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...memoryPayload,
          content: message.content,
          metadata: {
            ...memoryPayload.metadata,
            messageId: message.id,
            messageCreatedAt: message.createdAt,
          },
        }),
      });
      const data = await response.json() as MemoryWriteResponse;
      if (!response.ok) throw new Error(data.error || 'Could not save Mythos memory.');
      markMessageSaved(message.id, data);
      setPendingSaveMessageId('');
      setNotice(`Memory saved to Mythos vault: ${shortHash(data.hash, 18)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save Mythos memory.');
    } finally {
      setSavingMemoryId('');
    }
  }

  async function routeSkillForPrompt(content: string) {
    const response = await fetch('/api/mythos/skill-router', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: content,
        currentSkillId: selectedSkill?.id,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Mythos could not route this skill.');
    return data as MythosSkillRouteResult;
  }

  async function runTerminalCommand(content: string, nextMessages: MythosLabMessage[], started: number) {
    const command = content.trim();
    const lower = command.toLowerCase();

    function appendTerminalResponse(responseContent: string, extra?: {
      trace?: MythosCognitiveTrace;
      observability?: MythosObservability;
      htmlArtifact?: MythosLabMessage['htmlArtifact'];
      solanaAnalysis?: Record<string, unknown>;
      memecoinDraft?: MythosMemecoinDraft;
    }) {
      const assistantMessage: MythosLabMessage = {
        id: createId('msg'),
        role: 'assistant',
        createdAt: nowIso(),
        content: cleanTerminalText(responseContent),
        htmlArtifact: extra?.htmlArtifact,
        solanaAnalysis: extra?.solanaAnalysis,
        memecoinDraft: extra?.memecoinDraft,
      };
      updateActive(session => ({
        ...session,
        messages: [...nextMessages, assistantMessage],
        lastTrace: extra?.trace || session.lastTrace,
        lastObservability: {
          ...session.lastObservability,
          ...extra?.observability,
          latencyMs: extra?.observability?.latencyMs ?? Date.now() - started,
        },
        updatedAt: nowIso(),
      }));
    }

    if (lower === '/help' || lower === '/commands') {
      appendTerminalResponse(helpResponse(), {
        trace: {
          perception: 'User asked for the command surface.',
          selectedSkill: 'Mythos Command Terminal',
          decision: 'Show the available safe commands and execution boundaries.',
          prediction: 'User can now run Solana, Wallet Agent, Jupiter, and memory commands from one place.',
          safetyBoundary: 'Help is local and cannot execute transactions.',
          nextHumanStep: 'Choose one command and paste public on-chain data only.',
        },
        observability: {
          model: activeSession.model,
          modelLabel: activeSession.model,
          mode: activeSession.mode,
          traceSchema: 'mythos-command-terminal/v1',
          latencyMs: Date.now() - started,
        },
      });
      return;
    }

    if (lower.startsWith('/artifact ')) {
      const prompt = command.slice('/artifact '.length).trim();
      if (!prompt) {
        appendTerminalResponse([
          terminalSection('Intent', 'Generate a Mythos HTML artifact'),
          terminalSection('Decision', 'Blocked because no artifact request was provided.'),
          terminalSection('Next safe step', 'Try: /artifact create a compact SOL price dashboard'),
        ].join('\n\n'));
        return;
      }

      const response = await fetch('/api/mythos/html-artifact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (!response.ok || !isRecord(data)) {
        throw new Error(isRecord(data) ? asString(data.error, 'Mythos artifact request failed.') : 'Mythos artifact request failed.');
      }
      const artifact = getRecord(data, 'artifact');
      appendTerminalResponse([
        terminalSection('Intent', 'Generate a read-only Mythos HTML artifact'),
        terminalSection('Decision', asString(data.text, 'Artifact generated for admin review.')),
        terminalSection('Safety boundary', [
          'Admin-only route.',
          'ANTHROPIC_API_KEY stays on the server.',
          'Artifact iframe is sandboxed and cannot sign, buy, sell, pay, schedule, or move funds.',
        ]),
      ].join('\n\n'), {
        htmlArtifact: asString(artifact.html, '') ? {
          title: asString(artifact.title, 'Mythos Artifact'),
          html: asString(artifact.html, ''),
          model: asString(data.model, 'anthropic'),
        } : undefined,
        trace: {
          perception: 'Admin requested a visual HTML artifact.',
          selectedSkill: 'Mythos HTML Artifact Renderer',
          decision: 'Generate and sandbox a read-only preview.',
          prediction: 'The artifact can become a polished Mythos interface pattern after human review.',
          safetyBoundary: 'Admin-only, server-side Anthropic key, sandboxed preview, no execution authority.',
          nextHumanStep: 'Review the preview and copy HTML only if it is safe for productization.',
        },
        observability: {
          model: asString(data.model, 'anthropic'),
          modelLabel: 'Anthropic HTML artifact renderer',
          mode: activeSession.mode,
          traceSchema: 'mythos-html-artifact/v1',
          latencyMs: Date.now() - started,
        },
      });
      return;
    }

    if (isMarketReportRequest(command)) {
      const response = await fetch('/api/mythos/market/report', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      if (!response.ok || !isRecord(data)) {
        throw new Error(isRecord(data) ? asString(data.error, 'Mythos market report failed.') : 'Mythos market report failed.');
      }
      const report = data as MythosCryptoMarketReport;
      const assistantMessage: MythosLabMessage = {
        id: createId('msg'),
        role: 'assistant',
        createdAt: nowIso(),
        content: formatMarketReportText(report),
        cryptoReport: report,
      };
      updateActive(session => ({
        ...session,
        messages: [...nextMessages, assistantMessage],
        lastTrace: {
          perception: 'User requested a crypto market report.',
          memoryContext: 'No private portfolio or wallet memory was used automatically.',
          selectedSkill: 'Mythos Market Intelligence',
          reasoningPath: 'CoinGecko global, top market, trending, and selected opportunity datasets were fetched server-side.',
          prediction: 'User may use the watchlist to choose deeper token or wallet analysis next.',
          decision: 'Return a visual report and clearly mark it as read-only market intelligence.',
          confidence: 82,
          safetyBoundary: 'No financial advice and no trade execution.',
          nextHumanStep: 'Pick one token or wallet and run a focused Mythos analysis before acting.',
        },
        lastObservability: {
          model: activeSession.model,
          modelLabel: 'CoinGecko + Mythos report renderer',
          latencyMs: Date.now() - started,
          mode: activeSession.mode,
          traceSchema: 'mythos-market-report/v1',
        },
        updatedAt: nowIso(),
      }));
      return;
    }

    if (isSolanaEcosystemRequest(command)) {
      const mode = solanaReportModeFor(command);
      const response = await fetch(`/api/mythos/market/solana?mode=${mode}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      if (!response.ok || !isRecord(data)) {
        throw new Error(isRecord(data) ? asString(data.error, 'Mythos Solana ecosystem report failed.') : 'Mythos Solana ecosystem report failed.');
      }
      const report = data as MythosSolanaEcosystemReport;
      const assistantMessage: MythosLabMessage = {
        id: createId('msg'),
        role: 'assistant',
        createdAt: nowIso(),
        content: formatSolanaReportText(report),
        solanaReport: report,
      };
      updateActive(session => ({
        ...session,
        messages: [...nextMessages, assistantMessage],
        lastTrace: {
          perception: `User requested a Solana ${mode} market report.`,
          memoryContext: 'No private wallet memory was used. This uses public market and DeFi data only.',
          selectedSkill: 'Solana Ecosystem Intelligence',
          reasoningPath: 'CoinGecko and DeFiLlama public data were fetched server-side and rendered as a read-only Mythos report.',
          prediction: 'User can pick one protocol for deeper token, wallet, or transaction analysis.',
          decision: 'Render a beginner-friendly Solana ecosystem card with safety boundaries.',
          confidence: 84,
          safetyBoundary: 'Read-only market intelligence. Not financial advice.',
          nextHumanStep: 'Choose one protocol or token and run a focused Mythos analysis before acting.',
        },
        lastObservability: {
          model: activeSession.model,
          modelLabel: 'CoinGecko + DeFiLlama + Mythos renderer',
          latencyMs: Date.now() - started,
          mode: activeSession.mode,
          traceSchema: 'mythos-solana-ecosystem/v1',
        },
        updatedAt: nowIso(),
      }));
      return;
    }

    const memecoinDraft = parseMemecoinDraft(command, connectedAddress);
    if (memecoinDraft) {
      appendTerminalResponse(formatMemecoinDraftResponse(memecoinDraft), {
        memecoinDraft,
        trace: {
          perception: `User requested a memecoin launch draft for ${memecoinDraft.name}.`,
          memoryContext: 'No private wallet memory was used. The draft only uses the visible prompt and connected public wallet address when available.',
          selectedSkill: 'Mythos Memecoin Studio',
          reasoningPath: 'Mythos extracted token identity, ticker, description, image prompt, first-buy intent, wallet readiness, and blocked execution boundaries.',
          prediction: 'The safest next state is a human-reviewed launch brief before any Pump.fun metadata, mint, buy, or wallet transaction is prepared.',
          decision: 'Render a preview-only launch card and block automatic execution.',
          confidence: memecoinDraft.name === 'Untitled Meme' ? 62 : 78,
          safetyBoundary: 'No mint, upload, signature, buy, sell, or fund movement. Future value movement requires Phantom/Solflare approval.',
          nextHumanStep: memecoinDraft.walletReady
            ? 'Review the brief and confirm image/metadata before the future transaction phase.'
            : 'Connect Phantom or Solflare, then review the brief again.',
        },
        observability: {
          model: activeSession.model,
          modelLabel: 'Mythos Memecoin Studio preview renderer',
          latencyMs: Date.now() - started,
          mode: activeSession.mode,
          traceSchema: 'mythos-memecoin-draft/v1',
        },
      });
      return;
    }

    if (lower === '/memory save last') {
      if (!lastAssistant?.content) {
        appendTerminalResponse([
          terminalSection('Intent', 'Save last Mythos answer as CongChain memory'),
          terminalSection('Decision', 'Blocked because there is no assistant answer to save yet.'),
          terminalSection('Next safe step', 'Run a command or ask Mythos a question first, then type /memory save last.'),
        ].join('\n\n'));
        return;
      }
      if (!apiKey.trim().startsWith('cog_live_')) {
        setPendingSaveMessageId(lastAssistant.id);
        appendTerminalResponse([
          terminalSection('Intent', 'Save last Mythos answer as CongChain memory'),
          terminalSection('Decision', 'Blocked until a full CongChain key is pasted under the Mythos answer.'),
          terminalSection('Safety boundary', 'The terminal never guesses keys and never stores secrets in output.'),
        ].join('\n\n'));
        return;
      }

      const response = await fetch(profile.endpoints.writeMemory, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(memoryPayload),
      });
      const data = await response.json() as MemoryWriteResponse;
      if (!response.ok) throw new Error(data.error || 'Could not save Mythos memory.');
      markMessageSaved(lastAssistant.id, data);
      updateActive(session => ({
        ...session,
        lastObservability: {
          ...session.lastObservability,
          memoryHash: data.hash,
          savedAt: nowIso(),
          latencyMs: Date.now() - started,
        },
        updatedAt: nowIso(),
      }));
      appendTerminalResponse([
        terminalSection('Intent', 'Save last Mythos answer as CongChain memory'),
        terminalSection('Decision', `Memory saved to the isolated Mythos vault: ${shortHash(data.hash, 18)}`),
        terminalSection('Next safe step', data.hash ? `/api/memory/${data.hash}` : 'Open the Memory Brain to review the saved record.'),
        terminalSection('Safety boundary', 'Only metadata-approved Mythos content was sent. No secrets, private keys, signed payloads, or fund actions.'),
      ].join('\n\n'), {
        observability: {
          memoryHash: data.hash,
          savedAt: nowIso(),
          model: activeSession.model,
          modelLabel: activeSession.model,
          mode: activeSession.mode,
          traceSchema: 'mythos-memory-command/v1',
          latencyMs: Date.now() - started,
        },
      });
      return;
    }

    const quoteRequest = parseQuoteCommand(command);
    if (quoteRequest) {
      const response = await fetch('/api/wallet-agent/jupiter/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...quoteRequest, slippageBps: 50 }),
      });
      const data = await response.json();
      if (!response.ok || !isRecord(data)) throw new Error(isRecord(data) ? asString(data.error, 'Jupiter quote failed.') : 'Jupiter quote failed.');
      appendTerminalResponse(formatJupiterQuoteResponse(data), {
        trace: {
          perception: `User requested a read-only Jupiter quote for ${quoteRequest.amountUi} ${quoteRequest.inputSymbol} to ${quoteRequest.outputSymbol}.`,
          selectedSkill: 'Jupiter safe quote contract',
          decision: 'Return quote context only, without creating a swap transaction.',
          prediction: 'If the user proceeds later, a separate audited wallet-signature phase is required.',
          safetyBoundary: 'No swap payload, no wallet signature, no submission.',
          nextHumanStep: 'Review the quote and continue only through a visible wallet approval path in a future phase.',
        },
        observability: {
          model: activeSession.model,
          modelLabel: activeSession.model,
          mode: activeSession.mode,
          traceSchema: 'mythos-jupiter-command/v1',
          latencyMs: Date.now() - started,
        },
      });
      return;
    }

    if (lower.startsWith('/plan ')) {
      const planCommand = command.slice('/plan '.length).trim();
      appendTerminalResponse(formatWalletPlanResponse(planCommand), {
        trace: {
          perception: 'User requested a Wallet Agent command plan.',
          selectedSkill: 'Wallet Agent safety planner',
          decision: 'Create an auditable six-phase plan and block automatic execution.',
          prediction: 'Value-moving work will require explicit wallet approval in a separate phase.',
          safetyBoundary: 'No signing, no mainnet submission, no fund movement.',
          nextHumanStep: 'Review the route status, missing fields, and blocked actions.',
        },
        observability: {
          model: activeSession.model,
          modelLabel: activeSession.model,
          mode: activeSession.mode,
          traceSchema: 'mythos-wallet-plan-command/v1',
          latencyMs: Date.now() - started,
        },
      });
      return;
    }

    const solanaCommand = [
      { pattern: /^\/analyze\s+tx\s+(.+)$/i, endpoint: '/api/mythos/solana/analyze-transaction', mode: 'transaction' },
      { pattern: /^\/analyze\s+wallet\s+(.+)$/i, endpoint: '/api/mythos/solana/analyze-wallet', mode: 'wallet' },
      { pattern: /^\/analyze\s+token\s+(.+)$/i, endpoint: '/api/mythos/solana/analyze-token', mode: 'token' },
      { pattern: /^\/debug\s+anchor\s+([\s\S]+)$/i, endpoint: '/api/mythos/solana/debug-anchor', mode: 'anchor' },
      { pattern: /^\/explain\s+rpc\s+([\s\S]+)$/i, endpoint: '/api/mythos/solana/explain-rpc', mode: 'rpc' },
    ].map(item => ({ ...item, match: command.match(item.pattern) })).find(item => item.match);

    if (solanaCommand?.match) {
      const subject = solanaCommand.match[1].trim();
      const response = await fetch(solanaCommand.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: subject,
          cluster: 'mainnet',
          model: activeSession.model,
        }),
      });
      const data = await response.json();
      if (!response.ok || !isRecord(data)) throw new Error(isRecord(data) ? asString(data.error, 'Mythos Solana command failed.') : 'Mythos Solana command failed.');
      const trace = getRecord(data, 'cognitiveTrace');
      const observability = getRecord(data, 'observability');
      appendTerminalResponse(formatMythosSolanaResponse(data), {
        solanaAnalysis: data,
        trace: {
          perception: asString(trace.perception, `User requested ${solanaCommand.mode} analysis.`),
          memoryContext: asString(getRecord(data, 'memoryReplay').likelyCause, 'Memory replay is evidence-bound.'),
          selectedSkill: asString(trace.skill, `Solana ${solanaCommand.mode} intelligence`),
          reasoningPath: asString(trace.evidenceUsed, 'Public chain evidence was reviewed.'),
          prediction: asString(trace.prediction, 'Manual review remains required.'),
          decision: asString(trace.decision, 'Review the evidence before acting.'),
          confidence: asNumber(getRecord(data, 'risk').confidenceBps) / 100,
          safetyBoundary: asString(trace.safetyBoundary, 'Read-only analysis only.'),
          nextHumanStep: asString(trace.nextHumanStep, 'Review manually before saving memory.'),
        },
        observability: {
          model: asString(observability.model, activeSession.model),
          modelLabel: asString(observability.modelLabel, activeSession.model),
          latencyMs: asNumber(observability.latencyMs, Date.now() - started),
          mode: activeSession.mode,
          traceSchema: 'mythos-solana-command/v1',
        },
      });
      return;
    }

    appendTerminalResponse([
      terminalSection('Intent', 'Unknown command'),
      terminalSection('Decision', 'Mythos did not recognize this terminal command.'),
      terminalSection('Next safe step', 'Type /help to see supported commands, or send a normal message without a slash for skill-routed chat.'),
      terminalSection('Safety boundary', 'Unknown commands are not executed.'),
    ].join('\n\n'));
  }

  async function sendMessage(prompt?: string) {
    if (!activeSession || loading) return;
    const content = (prompt || input).trim();
    if (!content) return;

    const createdAt = nowIso();
    const userMessage: MythosLabMessage = {
      id: createId('msg'),
      role: 'user',
      content,
      createdAt,
    };
    const nextMessages = [...activeSession.messages, userMessage];
    updateActive(session => ({
      ...session,
      title: session.messages.filter(message => message.role === 'user').length === 0
        ? content.slice(0, 42)
        : session.title,
      messages: nextMessages,
      updatedAt: createdAt,
    }));
    setInput('');
    setLoading(true);
    setNotice('');

    const started = Date.now();
    try {
      if (content.startsWith('/') || isMarketReportRequest(content) || isSolanaEcosystemRequest(content) || isMemecoinLaunchRequest(content)) {
        await runTerminalCommand(content, nextMessages, started);
        return;
      }

      const route = await routeSkillForPrompt(content);
      const routedSkill =
        MYTHOS_FEATURED_SKILLS.find(skill => skill.id === route.selectedSkill.id) ||
        selectedSkill;
      updateActive(session => ({
        ...session,
        skillId: route.selectedSkill.id,
        lastSkillRoute: route,
        updatedAt: nowIso(),
      }));

      const response = await fetch('/api/mythos/test-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: activeSession.model,
          nvidiaModelRoute: activeSession.model === 'nvidia' ? (activeSession.nvidiaModelRoute || getNvidiaModelRoute().id) : undefined,
          mode: activeSession.mode,
          selectedSkill: routedSkill?.name,
          skillPath: routedSkill?.path,
          messages: nextMessages
            .filter(message => message.role !== 'system')
            .map(message => ({ role: message.role, content: message.content })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Mythos Lab request failed.');

      const assistantMessage: MythosLabMessage = {
        id: createId('msg'),
        role: 'assistant',
        createdAt: nowIso(),
        content: cleanTerminalText(data.response || 'Mythos returned an empty response.'),
      };
      const latencyMs = Date.now() - started;
      updateActive(session => ({
        ...session,
        messages: [...session.messages, assistantMessage],
        lastTrace: data.cognitiveTrace,
        lastObservability: {
          model: data.model,
          modelLabel: data.modelLabel,
          latencyMs,
          traceSchema: data.cognitiveTraceSchema,
          mode: data.mode,
          memoryHash: session.lastObservability?.memoryHash,
          savedAt: session.lastObservability?.savedAt,
        },
        updatedAt: nowIso(),
      }));
    } catch (error) {
      updateActive(session => ({
        ...session,
        messages: [
          ...session.messages,
          {
            id: createId('msg'),
            role: 'system',
            createdAt: nowIso(),
            content: error instanceof Error ? error.message : 'Could not reach Mythos Lab right now.',
          },
        ],
        updatedAt: nowIso(),
      }));
    } finally {
      setLoading(false);
    }
  }

  if (!activeSession) {
    return <main className="min-h-screen bg-black text-white" />;
  }

  const visibleMessages = activeSession.messages.filter(message => message.role !== 'system');
  const hasConversation = visibleMessages.length > 0;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen w-full overflow-hidden bg-[#020402] lg:flex-row">
        <aside className="relative hidden w-[320px] shrink-0 flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(4,10,4,0.98),rgba(0,0,0,0.98))] p-6 lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_4%,rgba(118,255,3,0.06),transparent_28%)]" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-[#76FF03]/35 bg-black shadow-[0_0_32px_rgba(118,255,3,0.28)]">
                <img src={profile.image} alt="" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-xl font-black uppercase tracking-[0.32em] text-[#A7FF3D]">Mythos</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">The 1st autonomous external agent</p>
              </div>
            </div>
            <button
              type="button"
              onClick={startSession}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#76FF03]/20 bg-white/[0.035] text-[#A7FF3D] transition hover:bg-[#76FF03]/10"
              aria-label="New Mythos conversation"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mt-10 border-t border-white/10 pt-5">
            <button
              type="button"
              onClick={startSession}
              className="inline-flex h-14 w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.065] px-4 text-sm font-semibold text-white/88 transition hover:border-[#76FF03]/25 hover:bg-[#76FF03]/10"
            >
              <TerminalSquare className="h-5 w-5 text-white/80" />
              New Conversation
            </button>
          </div>

          <div className="relative mt-10">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-white/45">Today</p>
              <button
                type="button"
                onClick={clearHistory}
                className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/32 transition hover:text-[#A7FF3D]"
              >
                Clear
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              {sessions.map(session => (
                <div key={session.id} className="group flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveId(session.id)}
                    className={`min-w-0 flex-1 rounded-xl px-1 py-2 text-left text-sm transition ${
                      session.id === activeId ? 'text-white' : 'text-white/58 hover:text-white/80'
                    }`}
                  >
                    <span className="line-clamp-1">{session.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSession(session.id)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/22 opacity-0 transition hover:bg-white/8 hover:text-[#FF5C7A] group-hover:opacity-100"
                    aria-label={`Delete ${session.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-auto">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 overflow-hidden rounded-full border border-[#76FF03]/26 bg-black">
                  <img src={profile.image} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">Mythos</p>
                  <p className="flex items-center gap-2 text-xs text-white/55">
                    <span className="h-2 w-2 rounded-full bg-[#76FF03]" />
                    ONLINE
                  </p>
                </div>
                <span className="text-white/55">›</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_52%_18%,rgba(118,255,3,0.045),transparent_30%),linear-gradient(180deg,rgba(2,5,2,0.99),rgba(0,0,0,1))]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(118,255,3,0.025),transparent_22%),radial-gradient(circle_at_70%_10%,rgba(118,255,3,0.018),transparent_20%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,rgba(118,255,3,0.025),transparent)]" />

          <header className="relative flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <a href="/mythos" className="text-xs text-white/45 transition hover:text-white/80">Back to Mythos</a>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setModelMenuOpen(open => !open)}
                  className="hidden h-10 items-center gap-2 rounded-full border border-[#76FF03]/16 bg-[#76FF03]/8 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#A7FF3D] transition hover:bg-[#76FF03]/13 sm:inline-flex"
                  aria-expanded={modelMenuOpen}
                  aria-label="Choose Mythos model route"
                >
                  {currentModelButtonLabel}
                  <ChevronDown className={`h-3.5 w-3.5 transition ${modelMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {modelMenuOpen ? (
                  <div className="absolute right-0 z-30 mt-3 w-[320px] overflow-hidden rounded-2xl border border-[#76FF03]/18 bg-[#030803]/95 p-2 shadow-[0_20px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                    <div className="px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Mythos model route</p>
                      <p className="mt-1 text-[11px] leading-4 text-white/42">Choose the responder profile. Provider keys still stay server-side.</p>
                    </div>
                    <div className="max-h-[360px] overflow-y-auto pr-1">
                      {MYTHOS_MODEL_OPTIONS.map(option => (
                        <div key={option.id}>
                          <button
                            type="button"
                            onClick={() => selectModel(option.id)}
                            className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                              option.id === currentModel.id
                                ? 'border border-[#76FF03]/24 bg-[#76FF03]/10'
                                : 'border border-transparent hover:bg-white/[0.055]'
                            }`}
                          >
                            <span className="flex items-center justify-between gap-3">
                              <span className="text-sm font-black text-white">{option.label}</span>
                              <span className="flex items-center gap-1.5">
                                {option.access === 'pro' ? (
                                  <span className="rounded-full border border-[#FFD166]/18 bg-[#FFD166]/10 px-2 py-0.5 text-[9px] font-bold uppercase text-[#FFE08A]">
                                    PRO
                                  </span>
                                ) : null}
                                <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-0.5 text-[9px] font-bold uppercase text-white/40">{option.provider}</span>
                              </span>
                            </span>
                            <span className="mt-1 block text-[11px] leading-4 text-white/45">{option.detail}</span>
                          </button>
                          {option.id === 'nvidia' ? (
                            <div className="mb-2 ml-3 mt-2 grid gap-1.5 border-l border-[#76FF03]/14 pl-2">
                              <p className="px-2 text-[9px] font-black uppercase tracking-[0.16em] text-[#A7FF3D]/70">
                                NVIDIA model router
                              </p>
                              {NVIDIA_MODEL_ROUTES.map(route => (
                                <button
                                  key={route.id}
                                  type="button"
                                  onClick={() => selectNvidiaRoute(route.id)}
                                  className={`rounded-xl border px-2.5 py-2 text-left transition ${
                                    currentModel.id === 'nvidia' && currentNvidiaRoute.id === route.id
                                      ? 'border-[#76FF03]/28 bg-[#76FF03]/12'
                                      : 'border-white/8 bg-white/[0.025] hover:border-[#76FF03]/18 hover:bg-[#76FF03]/7'
                                  }`}
                                >
                                  <span className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-black text-white">{route.label}</span>
                                    <span className="rounded-full border border-white/8 bg-white/[0.035] px-2 py-0.5 text-[8px] font-bold uppercase text-white/36">
                                      {route.provider}
                                    </span>
                                  </span>
                                  <span className="mt-1 block text-[10px] leading-4 text-white/42">{route.detail}</span>
                                  <span className="mt-1 block text-[9px] font-mono text-[#A7FF3D]/52">{route.envModel}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              {proAccessOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/68 px-4 backdrop-blur-sm">
                  <div className="w-full max-w-[420px] rounded-[28px] border border-[#FFD166]/22 bg-[#050704]/96 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.68)]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFE08A]">Mythos PRO access</p>
                        <h3 className="mt-2 text-2xl font-black text-white">
                          Unlock {getModelOption(pendingProModelId || 'gpt').label}
                        </h3>
                        <p className="mt-2 text-xs leading-5 text-white/50">
                          Paid provider routes are admin-gated. The server verifies access and keeps provider keys private.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setProAccessOpen(false);
                          setProAccessPassword('');
                          setProAccessError('');
                        }}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-white/55 transition hover:bg-white/[0.08]"
                      >
                        Close
                      </button>
                    </div>
                    <div className="mt-5 space-y-3">
                      <label className="block">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">Login</span>
                        <input
                          value={proAccessUser}
                          onChange={event => setProAccessUser(event.target.value)}
                          className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/42 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#FFD166]/45"
                          placeholder="mythos"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">Password</span>
                        <input
                          type="password"
                          value={proAccessPassword}
                          onChange={event => setProAccessPassword(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') void submitProAccess();
                          }}
                          className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/42 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#FFD166]/45"
                          placeholder="Server-side access password"
                        />
                      </label>
                      {proAccessError ? (
                        <p className="rounded-2xl border border-[#FF5C7A]/18 bg-[#FF5C7A]/10 p-3 text-xs leading-5 text-[#FFB0BF]">{proAccessError}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void submitProAccess()}
                      disabled={proAccessLoading}
                      className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[#FFD166]/24 bg-[#FFD166]/12 text-xs font-black uppercase tracking-[0.14em] text-[#FFE08A] transition hover:bg-[#FFD166]/18 disabled:opacity-55"
                    >
                      {proAccessLoading ? 'Checking...' : 'Unlock PRO route'}
                    </button>
                    <p className="mt-3 text-[11px] leading-4 text-white/36">
                      Configure Railway with MYTHOS_PRO_ACCESS_USER and MYTHOS_PRO_ACCESS_PASSWORD. No provider key or password is rendered in the browser.
                    </p>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleWalletAction}
                disabled={connecting || !!connectingWallet}
                className="hidden h-10 items-center gap-2 rounded-full border border-[#14F195]/18 bg-[#14F195]/8 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#8CFFD2] transition hover:bg-[#14F195]/13 disabled:opacity-50 md:inline-flex"
                title={connected ? 'Disconnect wallet from Mythos Lab' : 'Connect Phantom or Solflare to Mythos Lab'}
              >
                {connected && wallet?.adapter.icon ? (
                  <img src={wallet.adapter.icon} alt="" className="h-4 w-4 rounded-full" />
                ) : (
                  <Wallet className="h-4 w-4" />
                )}
                {connected ? `${wallet?.adapter.name || 'Wallet'} ${walletShortAddress}` : connectingWallet ? 'Connecting...' : 'Connect Wallet'}
                {connected ? <LogOut className="h-3.5 w-3.5" /> : <ChevronDown className={`h-3.5 w-3.5 transition ${walletMenuOpen ? 'rotate-180' : ''}`} />}
              </button>
              {walletMenuOpen && !connected ? (
                <div className="absolute right-[104px] top-14 z-40 w-[330px] overflow-hidden rounded-2xl border border-[#14F195]/18 bg-[#030908]/96 p-2 shadow-[0_20px_70px_rgba(0,0,0,0.58)] backdrop-blur-xl">
                  <div className="px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8CFFD2]">Connect wallet</p>
                    <p className="mt-1 text-[11px] leading-4 text-white/42">Phantom or Solflare opens directly. Mythos cannot sign or move funds without your visible approval.</p>
                  </div>
                  <div className="space-y-2">
                    {MYTHOS_WALLET_OPTIONS.map(option => {
                      const candidate = wallets.find(item => item.adapter.name.toLowerCase().includes(option.name.toLowerCase()));
                      const installed = candidate?.adapter.readyState === WalletReadyState.Installed || candidate?.adapter.readyState === WalletReadyState.Loadable;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => connectMythosWallet(option)}
                          disabled={!!connectingWallet}
                          className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-3 text-left transition hover:border-[#14F195]/22 hover:bg-[#14F195]/8 disabled:opacity-50"
                        >
                          <span>
                            <span className="block text-sm font-black text-white">{option.name}</span>
                            <span className="mt-1 block text-[11px] leading-4 text-white/45">{option.description}</span>
                          </span>
                          <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[9px] font-black uppercase text-white/42">
                            {connectingWallet === option.key ? 'opening' : installed ? 'ready' : 'install'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {walletConnectError ? (
                    <p className="mt-3 rounded-xl border border-[#FF5C7A]/18 bg-[#FF5C7A]/8 p-3 text-[11px] leading-4 text-[#FF9AB1]">{walletConnectError}</p>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => sendMessage('/help')}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-[#76FF03]/24 bg-[#76FF03]/10 px-4 text-xs font-black text-[#A7FF3D] transition hover:bg-[#76FF03]/16 disabled:opacity-50"
              >
                <TerminalSquare className="h-4 w-4" />
                Commands
              </button>
            </div>
          </header>

          <div className="relative flex flex-1 flex-col overflow-y-auto px-4 pb-4 sm:px-6">
            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
              <div className={`flex flex-1 flex-col ${hasConversation ? 'justify-start pt-6' : 'justify-center'}`}>
                {!hasConversation ? (
                  <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
                    <img
                      src="/agents/mythos-terminal.png"
                      alt="Mythos, the first autonomous external agent"
                      className="w-full max-w-[720px] object-contain opacity-95 drop-shadow-[0_0_42px_rgba(118,255,3,0.11)]"
                    />
                    <p className="-mt-4 text-[11px] font-black uppercase tracking-[0.34em] text-white/42 sm:-mt-8">
                      Developed by <span className="text-[#A7FF3D]">CongChain</span>
                    </p>
                  </div>
                ) : (
                  <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 pb-6">
                    {visibleMessages.map(message => (
                      <div
                        key={message.id}
                        className={`max-w-[92%] rounded-[22px] border px-5 py-4 text-sm leading-6 backdrop-blur ${
                          message.role === 'user'
                            ? 'ml-auto border-[#76FF03]/24 bg-[#0b2204]/72 text-white'
                            : 'mr-auto border-white/10 bg-black/44 text-white/78'
                        }`}
                      >
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/32">
                          {message.role === 'user' ? 'You' : 'Mythos'}
                        </p>
                        {message.cryptoReport ? <MythosCryptoReportCard report={message.cryptoReport} /> : null}
                        {message.solanaReport ? <MythosSolanaReportCard report={message.solanaReport} /> : null}
                        {message.solanaAnalysis ? <MythosSolanaAnalysisCard data={message.solanaAnalysis} /> : null}
                        {message.memecoinDraft ? (
                          <MythosMemecoinDraftCard
                            draft={message.memecoinDraft}
                            onConnectWallet={handleWalletAction}
                            onArmLaunchReview={armMemecoinLaunchReview}
                            onCopyLaunchBrief={copyMemecoinLaunchBrief}
                          />
                        ) : null}
                        {!message.cryptoReport && !message.solanaReport && !message.solanaAnalysis && !message.memecoinDraft ? (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        ) : null}
                        {message.htmlArtifact ? (
                          <div className="mt-4 overflow-hidden rounded-2xl border border-[#76FF03]/18 bg-black/70">
                            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.035] px-4 py-3">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A7FF3D]">HTML artifact</p>
                                <p className="mt-1 text-xs text-white/52">{message.htmlArtifact.title}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(message.htmlArtifact?.html || '')}
                                className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[11px] font-bold text-white/62 transition hover:border-[#76FF03]/24 hover:text-[#A7FF3D]"
                              >
                                Copy HTML
                              </button>
                            </div>
                            <iframe
                              title={message.htmlArtifact.title}
                              sandbox="allow-scripts"
                              srcDoc={message.htmlArtifact.html}
                              className="h-[520px] w-full border-0 bg-black"
                            />
                          </div>
                        ) : null}
                        {message.role === 'assistant' ? (
                          <div className="mt-4 border-t border-white/8 pt-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => saveMessageAsMemory(message)}
                                disabled={savingMemoryId === message.id}
                                className="inline-flex h-8 items-center gap-2 rounded-full border border-[#76FF03]/18 bg-[#76FF03]/8 px-3 text-[11px] font-bold text-[#A7FF3D] transition hover:bg-[#76FF03]/14 disabled:opacity-50"
                              >
                                {savingMemoryId === message.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                {message.memoryHash ? 'Saved' : 'Save'}
                              </button>
                              {message.memoryHash ? (
                                <>
                                  <span className="rounded-full border border-white/8 bg-white/[0.035] px-3 py-1 text-[11px] font-mono text-white/48">
                                    {shortHash(message.memoryHash, 18)}
                                  </span>
                                  {message.readUrl ? <a className="text-[11px] font-bold text-[#7DE4FF]" href={message.readUrl}>Read</a> : null}
                                  {message.verifyUrl ? <a className="text-[11px] font-bold text-[#7DE4FF]" href={message.verifyUrl}>Verify</a> : null}
                                  {message.proofUrl ? <a className="text-[11px] font-bold text-[#7DE4FF]" href={message.proofUrl}>Proof</a> : null}
                                </>
                              ) : null}
                            </div>
                            {pendingSaveMessageId === message.id && !message.memoryHash ? (
                              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <input
                                  type="password"
                                  value={apiKey}
                                  onChange={event => setApiKey(event.target.value)}
                                  placeholder="cog_live_..."
                                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-[#76FF03]/35"
                                />
                                <button
                                  type="button"
                                  onClick={() => saveMessageAsMemory(message)}
                                  disabled={savingMemoryId === message.id}
                                  className="rounded-xl border border-[#76FF03]/18 bg-[#76FF03]/10 px-4 py-2 text-xs font-bold text-[#A7FF3D] transition hover:bg-[#76FF03]/15 disabled:opacity-50"
                                >
                                  Confirm save
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {loading && (
                      <div className="mr-auto inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm text-white/55">
                        <Loader2 className="h-4 w-4 animate-spin text-[#76FF03]" />
                        Mythos is processing the command...
                      </div>
                    )}
                  </div>
                )}
              </div>

              <footer className="sticky bottom-0 pb-4 pt-3">
                <div className="mx-auto w-full max-w-3xl">
                  <div className="rounded-[28px] border border-[#76FF03]/28 bg-black/62 p-4 shadow-[0_0_34px_rgba(118,255,3,0.045)] backdrop-blur-xl">
                    <textarea
                      value={input}
                      onChange={event => setInput(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          sendMessage();
                        }
                      }}
                      rows={3}
                      placeholder="Message Mythos..."
                      className="w-full resize-none bg-transparent px-2 text-base leading-7 text-white outline-none placeholder:text-white/34"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
                        aria-label="Attach context"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || loading}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/85 text-black transition hover:bg-[#A7FF3D] disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="Send message to Mythos"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                    {[
                      ['Analyze', Activity],
                      ['Research', Network],
                      ['Reason', Brain],
                      ['Create', Sparkles],
                      ['Commands', TerminalSquare],
                    ].map(([label, Icon]) => (
                      <button
                        key={String(label)}
                        type="button"
                        onClick={() => label === 'Commands' ? sendMessage('/help') : setInput(String(label).toLowerCase())}
                        disabled={loading}
                        className="inline-flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-black/34 px-5 text-sm text-white/74 transition hover:border-[#76FF03]/25 hover:bg-[#76FF03]/10 hover:text-white disabled:opacity-50"
                      >
                        <Icon className="h-4 w-4 text-[#A7FF3D]" />
                        {String(label)}
                      </button>
                    ))}
                  </div>

                  {notice ? (
                    <p className="mt-4 text-center text-xs text-white/45">{notice}</p>
                  ) : null}
                  <p className="mt-8 text-center text-xs text-white/34">
                    Mythos can make mistakes. Verify important information.
                  </p>
                </div>
              </footer>
            </div>
          </div>

          <button
            type="button"
            onClick={() => sendMessage('/help')}
            className="absolute bottom-5 right-5 hidden h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/50 text-xl text-white/70 transition hover:border-[#76FF03]/25 hover:text-[#A7FF3D] sm:inline-flex"
            aria-label="Show Mythos commands"
          >
            ?
          </button>
        </section>
      </div>
    </main>
  );
}
