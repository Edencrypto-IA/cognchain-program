'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
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
  Paperclip,
  Plus,
  Radar,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Trash2,
  Wallet,
  X,
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
  attachments?: MythosLabAttachment[];
  htmlArtifact?: {
    title: string;
    html: string;
    model?: string;
  };
  cryptoReport?: MythosCryptoMarketReport;
  solanaReport?: MythosSolanaEcosystemReport;
  solanaAnalysis?: Record<string, unknown>;
  walletIntelligence?: MythosWalletIntelligence;
  walletIntelligenceError?: string;
  memecoinDraft?: MythosMemecoinDraft;
  memecoinProposal?: MythosPumpfunLaunchProposal;
  memecoinMetadataReview?: MythosPumpfunMetadataReview;
  memecoinUnsignedPreview?: MythosPumpfunUnsignedPreview;
  memecoinPayloadAudit?: MythosPumpfunPayloadAudit;
  memecoinUnsignedBuilder?: MythosPumpfunUnsignedBuilder;
  memecoinBuyBuilder?: MythosPumpfunBuyBuilder;
  memoryHash?: string;
  readUrl?: string;
  verifyUrl?: string;
  proofUrl?: string;
};

type MythosLabAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  kind: 'image' | 'text' | 'pdf' | 'other';
  text?: string;
  dataUrl?: string;
  note?: string;
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

type MythosWalletIntelligenceToken = {
  mint: string | null;
  symbol: string;
  name: string;
  amount: number | null;
  valueUsd: number | null;
  change24hPct: number | null;
  source: string;
};

type MythosWalletIntelligence = {
  address: string;
  fetchedAt: string;
  sources: string[];
  confidence: number;
  portfolio: {
    valueUsd: number | null;
    valueLabel: string;
    change24hPct: number | null;
    change24hLabel: string;
    changeMethod: 'weighted_current_holdings' | 'unavailable';
    estimateNote: string;
  };
  sol: {
    balance: number | null;
    priceUsd: number | null;
    valueUsd: number | null;
    change24hPct: number | null;
  };
  tokens: MythosWalletIntelligenceToken[];
  highlights: string[];
  recommendations: string[];
  unavailable: string[];
  safety: {
    readOnly: true;
    noSigning: true;
    noFundsMovement: true;
    disclaimer: string;
  };
};

type MythosPumpfunLaunchProposal = {
  id: string;
  status: 'blocked' | 'needs_review' | 'ready_for_future_signature';
  createdAt: string;
  network: string;
  platform: string;
  token: {
    name: string;
    symbol: string;
    description: string;
    imagePrompt: string;
  };
  wallet: {
    address: string | null;
    ready: boolean;
  };
  firstBuy: {
    amountSol: number;
    configured: boolean;
    slippageBps: number | null;
    priorityFeeLamports: number | null;
  };
  readiness: {
    ready: number;
    review: number;
    blocked: number;
  };
  checks: Array<{
    id: string;
    label: string;
    status: 'ready' | 'review' | 'pending' | 'blocked';
    detail: string;
  }>;
  futureExecution: string[];
  blockedActions: string[];
  unsignedTransaction: null;
};

type MythosPumpfunMetadataReview = {
  id: string;
  proposalId: string | null;
  status: 'blocked' | 'needs_review' | 'ready_for_manual_upload';
  createdAt: string;
  platform: string;
  network: string;
  metadataHash: string;
  token: {
    name: string;
    symbol: string;
    description: string;
    imagePrompt: string;
  };
  wallet: {
    address: string | null;
    ready: boolean;
  };
  upload: {
    performed: boolean;
    uri: string | null;
    storage: string | null;
    note: string;
  };
  readiness: {
    ready: number;
    review: number;
    blocked: number;
  };
  checks: Array<{
    id: string;
    label: string;
    status: 'ready' | 'review' | 'blocked';
    detail: string;
  }>;
  nextSteps: string[];
  blockedActions: string[];
};

type MythosPumpfunUnsignedPreview = {
  id: string;
  proposalId: string | null;
  metadataReviewId: string | null;
  status: 'blocked' | 'needs_review' | 'ready_for_wallet_signature_phase';
  createdAt: string;
  network: string;
  platform: string;
  previewHash: string;
  signer: {
    walletAddress: string | null;
    required: boolean;
    connected: boolean;
  };
  token: {
    name: string;
    symbol: string;
    metadataHash: string | null;
  };
  firstBuy: {
    amountSol: number;
    configured: boolean;
  };
  instructionPlan: string[];
  transaction: {
    serializedUnsignedPayload: null;
    wireReady: boolean;
    reason: string;
  };
  readiness: {
    ready: number;
    review: number;
    blocked: number;
  };
  gates: Array<{
    id: string;
    label: string;
    status: 'ready' | 'review' | 'pending' | 'blocked';
    detail: string;
  }>;
  blockedActions: string[];
};

type MythosPumpfunPayloadAudit = {
  id: string;
  status: 'blocked' | 'needs_review' | 'ready_for_payload_builder';
  createdAt: string;
  platform: string;
  network: string;
  payloadHash: string;
  unsignedPreviewId: string | null;
  proposalId: string | null;
  metadataReviewId: string | null;
  token: {
    name: string;
    symbol: string;
    metadataHash: string | null;
    metadataUri: string | null;
  };
  signer: {
    walletAddress: string | null;
    required: boolean;
  };
  economics: {
    firstBuySol: number;
    slippageBps: number;
    slippageLabel: string;
    priorityFeeLamports: number;
    feeQuoteLamports: number | null;
    rentEstimateLamports: number | null;
  };
  instructionAudit: Array<{
    label: string;
    status: 'ready' | 'review' | 'pending' | 'blocked';
    detail: string;
  }>;
  serializedUnsignedPayload: null;
  walletSignatureRequest: null;
  submission: null;
  gates: Array<{
    id: string;
    label: string;
    status: 'ready' | 'review' | 'pending' | 'blocked';
    detail: string;
  }>;
  readiness: {
    ready: number;
    review: number;
    blocked: number;
  };
  nextSteps: string[];
  blockedActions: string[];
};

type MythosPumpfunUnsignedBuilder = {
  id: string;
  status: 'blocked' | 'needs_review' | 'ready_for_audited_provider';
  createdAt: string;
  platform: string;
  network: string;
  builderMode: 'audit_gate';
  builderHash: string;
  payloadAuditId: string | null;
  payloadHash: string | null;
  provider: {
    configured: boolean;
    source: string | null;
    officialDocsVerified: boolean;
    reason: string;
  };
  token: {
    name: string;
    symbol: string;
    metadataUri: string | null;
  };
  signer: {
    walletAddress: string | null;
    required: boolean;
  };
  economics: {
    firstBuySol: number;
    slippageBps: number;
    priorityFeeLamports: number;
    feeQuoteLamports: number | null;
    rentEstimateLamports: number | null;
    totalEstimatedLamports: number | null;
  };
  programAudit: {
    programId: string | null;
    feeRecipient: string | null;
    globalAccount: string | null;
    eventAuthority: string | null;
    bondingCurve: string | null;
    associatedBondingCurve: string | null;
    accountSchemaVerified: boolean;
    instructionDiscriminatorVerified: boolean;
  };
  transaction: {
    serializedUnsignedPayload: string | null;
    messageBase64?: string | null;
    messageVersion: string | null;
    recentBlockhash: string | null;
    feePayer: string | null;
    requiredSigners?: string[];
    transactionHash?: string | null;
    wireReady: boolean;
    reason: string;
  };
  createAudit?: {
    discriminator: number[];
    accountOrder: string[];
    serverGeneratedSecrets: false;
    submitsTransaction: false;
    signsTransaction: false;
  } | null;
  gates: Array<{
    id: string;
    label: string;
    status: 'ready' | 'review' | 'blocked';
    detail: string;
  }>;
  readiness: {
    ready: number;
    review: number;
    blocked: number;
  };
  nextSteps: string[];
  blockedActions: string[];
};

type MythosPumpfunBuyBuilder = {
  id: string;
  status: 'blocked' | 'needs_review' | 'ready_for_wallet_signature';
  createdAt: string;
  platform: string;
  network: string;
  createBuilderId: string | null;
  createSignature: string | null;
  mint: string | null;
  signer: {
    walletAddress: string | null;
    required: boolean;
  };
  quote: {
    spendLamports: string | null;
    expectedTokensOut: string | null;
    minTokensOut: string | null;
    slippageBps: number;
    priorityFeeLamports: number;
    networkFeeLamports: number | null;
    totalKnownLamports: number | null;
    caveat: string;
  };
  bondingCurve: {
    virtualTokenReserves: string;
    virtualQuoteReserves: string;
    realTokenReserves: string;
    realQuoteReserves: string;
    tokenTotalSupply: string;
    complete: boolean;
    creator: string;
  } | null;
  transaction: {
    serializedUnsignedPayload: string | null;
    messageBase64: string | null;
    messageVersion: string | null;
    recentBlockhash: string | null;
    feePayer: string | null;
    requiredSigners: string[];
    transactionHash: string | null;
    wireReady: boolean;
    reason: string;
  };
  accounts: Record<string, string> | null;
  buyAudit: {
    discriminator: number[];
    accountOrder: string[];
    serverGeneratedSecrets: false;
    submitsTransaction: false;
    signsTransaction: false;
  } | null;
  gates: Array<{
    id: string;
    label: string;
    status: 'ready' | 'review' | 'blocked';
    detail: string;
  }>;
  readiness: {
    ready: number;
    review: number;
    blocked: number;
  };
  blockedActions: string[];
};

type MythosPumpfunSignedPayload = {
  signedAt: string;
  signedTransactionBase64: string;
  signedTransactionHash: string;
  signerCount: number;
  storedInBrowserMemory: true;
  submittedToSolana: false;
};

type MythosPumpfunSubmittedPayload = {
  submittedAt: string;
  signature: string;
  confirmed: boolean;
  submittedFromBrowser: true;
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
    command: '/wallet intelligence',
    detail: 'Open a real read-only financial snapshot for the connected wallet. No signing or fund movement.',
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
    command: '/criar html <pedido> ou /artifact <visual request>',
    detail: 'Admin-only: generate a read-only HTML preview. The model key stays on the server and NVIDIA free-tier is preferred.',
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

function parseHtmlArtifactPrompt(command: string) {
  const trimmed = command.trim();
  const patterns = [
    /^\/artifact\s+(.+)$/i,
    /^\/criar\s+(?:html|site|pagina|p[aá]gina|landing(?:\s+page)?)\s+(.+)$/i,
    /^\/create\s+(?:html|site|website|page|landing(?:\s+page)?)\s+(.+)$/i,
    /^\/gerar\s+(?:html|site|pagina|p[aá]gina|landing(?:\s+page)?)\s+(.+)$/i,
    /^\/generate\s+(?:html|site|website|page|landing(?:\s+page)?)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }

  return '';
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

function updateMemecoinDraftWallet(draft: MythosMemecoinDraft, walletAddress: string): MythosMemecoinDraft {
  const walletReady = Boolean(walletAddress);
  const hasName = draft.name !== 'Untitled Meme';
  const hasFirstBuy = draft.initialBuySol > 0;
  const readinessScore = Math.min([
    hasName,
    draft.symbol.length >= 2,
    draft.description.length >= 24,
    draft.imagePrompt.length >= 18,
    walletReady,
    hasFirstBuy,
  ].filter(Boolean).length * 14 + (walletReady && hasFirstBuy ? 16 : 0), 100);

  return {
    ...draft,
    walletAddress: walletAddress || undefined,
    walletReady,
    launchMode: walletReady && hasName ? 'launch_review_ready' : 'preview_only',
    readinessScore,
    phases: draft.phases.map(phase => phase.title === '3. Wallet readiness'
      ? {
        ...phase,
        status: walletReady ? 'ready' : 'review',
        detail: walletReady
          ? `Wallet ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)} is connected for future approval.`
          : 'Connect Phantom or Solflare before any future launch transaction can be prepared.',
      }
      : phase),
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

function formatPumpfunProposalResponse(proposal: MythosPumpfunLaunchProposal) {
  return cleanTerminalText([
    terminalSection('Intent', `Prepare audited Pump.fun proposal ${proposal.id}.`),
    terminalSection('Proposal status', [
      `Status: ${proposal.status}`,
      `Network: ${proposal.network}`,
      `Platform: ${proposal.platform}`,
      `Ready: ${proposal.readiness.ready}`,
      `Review: ${proposal.readiness.review}`,
      `Blocked: ${proposal.readiness.blocked}`,
    ]),
    terminalSection('Token draft', [
      `Name: ${proposal.token.name}`,
      `Ticker: ${proposal.token.symbol}`,
      `Description: ${proposal.token.description}`,
      `Image prompt: ${proposal.token.imagePrompt}`,
    ]),
    terminalSection('Wallet and first buy', [
      `Wallet: ${proposal.wallet.address || 'not connected'}`,
      `First buy intent: ${proposal.firstBuy.configured ? `${proposal.firstBuy.amountSol} SOL` : 'not set'}`,
      `Unsigned transaction: ${proposal.unsignedTransaction === null ? 'not created' : 'created'}`,
    ]),
    terminalSection('Execution boundary', proposal.blockedActions.map(action => `- ${action}`)),
    terminalSection('Next safe step', 'Review this proposal. The next phase may prepare metadata/upload rules, but wallet signature and submission must remain separate visible user actions.'),
  ].join('\n\n'));
}

function formatPumpfunMetadataReviewResponse(review: MythosPumpfunMetadataReview) {
  return cleanTerminalText([
    terminalSection('Intent', `Prepare metadata review packet ${review.id}.`),
    terminalSection('Metadata status', [
      `Status: ${review.status}`,
      `Proposal: ${review.proposalId || 'not linked'}`,
      `Metadata hash: ${review.metadataHash}`,
      `Upload performed: ${review.upload.performed ? 'yes' : 'no'}`,
      `Upload URI: ${review.upload.uri || 'not created'}`,
    ]),
    terminalSection('Token metadata', [
      `Name: ${review.token.name}`,
      `Ticker: ${review.token.symbol}`,
      `Description: ${review.token.description}`,
      `Image prompt: ${review.token.imagePrompt}`,
    ]),
    terminalSection('Review gates', review.checks.map(check => `- ${check.label}: ${check.status} - ${check.detail}`)),
    terminalSection('Blocked actions', review.blockedActions.map(action => `- ${action}`)),
    terminalSection('Next safe step', 'After human review, prepare an unsigned transaction preview. It must still avoid wallet signatures, uploads, buys, or submission.'),
  ].join('\n\n'));
}

function formatPumpfunUnsignedPreviewResponse(preview: MythosPumpfunUnsignedPreview) {
  return cleanTerminalText([
    terminalSection('Intent', `Prepare unsigned transaction preview ${preview.id}.`),
    terminalSection('Preview status', [
      `Status: ${preview.status}`,
      `Network: ${preview.network}`,
      `Proposal: ${preview.proposalId || 'not linked'}`,
      `Metadata review: ${preview.metadataReviewId || 'not linked'}`,
      `Preview hash: ${preview.previewHash}`,
    ]),
    terminalSection('Signer and token', [
      `Required signer: ${preview.signer.walletAddress || 'not connected'}`,
      `Token: ${preview.token.name} (${preview.token.symbol})`,
      `Metadata hash: ${preview.token.metadataHash || 'not ready'}`,
      `First buy intent: ${preview.firstBuy.configured ? `${preview.firstBuy.amountSol} SOL` : 'not set'}`,
    ]),
    terminalSection('Instruction plan', preview.instructionPlan.map(step => `- ${step}`)),
    terminalSection('Transaction payload', [
      `Wire ready: ${preview.transaction.wireReady ? 'yes' : 'no'}`,
      `Serialized unsigned payload: ${preview.transaction.serializedUnsignedPayload || 'not created'}`,
      `Reason: ${preview.transaction.reason}`,
    ]),
    terminalSection('Blocked actions', preview.blockedActions.map(action => `- ${action}`)),
    terminalSection('Next safe step', 'Next phase must audit Pump.fun payload construction and only then open Phantom/Solflare for explicit signature.'),
  ].join('\n\n'));
}

function formatPumpfunPayloadAuditResponse(audit: MythosPumpfunPayloadAudit) {
  return cleanTerminalText([
    terminalSection('Intent', `Audit Pump.fun payload readiness ${audit.id}.`),
    terminalSection('Payload status', [
      `Status: ${audit.status}`,
      `Payload hash: ${audit.payloadHash}`,
      `Unsigned preview: ${audit.unsignedPreviewId || 'not linked'}`,
      `Serialized unsigned payload: ${audit.serializedUnsignedPayload || 'not created'}`,
      `Wallet signature request: ${audit.walletSignatureRequest || 'not opened'}`,
    ]),
    terminalSection('Token and metadata', [
      `Token: ${audit.token.name} (${audit.token.symbol})`,
      `Metadata hash: ${audit.token.metadataHash || 'not ready'}`,
      `Metadata URI: ${audit.token.metadataUri || 'not supplied'}`,
    ]),
    terminalSection('Economics', [
      `First buy intent: ${audit.economics.firstBuySol > 0 ? `${audit.economics.firstBuySol} SOL` : 'not set'}`,
      `Slippage: ${audit.economics.slippageLabel}`,
      `Priority fee: ${audit.economics.priorityFeeLamports} lamports`,
      `Fee quote: ${audit.economics.feeQuoteLamports ?? 'not quoted'}`,
      `Rent estimate: ${audit.economics.rentEstimateLamports ?? 'not estimated'}`,
    ]),
    terminalSection('Instruction audit', audit.instructionAudit.map(item => `- ${item.label}: ${item.status} - ${item.detail}`)),
    terminalSection('Blocked actions', audit.blockedActions.map(action => `- ${action}`)),
    terminalSection('Next safe step', 'Audit the official Pump.fun SDK/program payload path before generating real unsigned transaction bytes.'),
  ].join('\n\n'));
}

function formatPumpfunUnsignedBuilderResponse(builder: MythosPumpfunUnsignedBuilder) {
  return cleanTerminalText([
    terminalSection('Intent', `Prepare Pump.fun unsigned builder gate ${builder.id}.`),
    terminalSection('Builder status', [
      `Status: ${builder.status}`,
      `Mode: ${builder.builderMode}`,
      `Builder hash: ${builder.builderHash}`,
      `Payload audit: ${builder.payloadAuditId || 'not linked'}`,
      `Provider configured: ${builder.provider.configured ? 'yes' : 'no'}`,
      `Official docs verified: ${builder.provider.officialDocsVerified ? 'yes' : 'no'}`,
    ]),
    terminalSection('Token and signer', [
      `Token: ${builder.token.name} (${builder.token.symbol})`,
      `Metadata URI: ${builder.token.metadataUri || 'not supplied'}`,
      `Wallet signer: ${builder.signer.walletAddress || 'not connected'}`,
      `First buy intent: ${builder.economics.firstBuySol > 0 ? `${builder.economics.firstBuySol} SOL` : 'not set'}`,
    ]),
    terminalSection('Program audit', [
      `Program ID: ${builder.programAudit.programId || 'not configured'}`,
      `Account schema verified: ${builder.programAudit.accountSchemaVerified ? 'yes' : 'no'}`,
      `Instruction discriminator verified: ${builder.programAudit.instructionDiscriminatorVerified ? 'yes' : 'no'}`,
      `Fee quote: ${builder.economics.feeQuoteLamports ?? 'not quoted'}`,
      `Rent estimate: ${builder.economics.rentEstimateLamports ?? 'not estimated'}`,
    ]),
    terminalSection('Transaction payload', [
      `Wire ready: ${builder.transaction.wireReady ? 'yes' : 'no'}`,
      `Serialized unsigned payload: ${builder.transaction.serializedUnsignedPayload || 'not created'}`,
      `Reason: ${builder.transaction.reason}`,
    ]),
    terminalSection('Blocked actions', builder.blockedActions.map(action => `- ${action}`)),
    terminalSection('Next safe step', 'Configure an official audited Pump.fun builder provider, then quote fees/rent before any unsigned transaction bytes are created.'),
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
    ? (report.assets?.memeLeaders ?? []).map((asset, index) => `${index + 1}. ${asset.symbol} - ${asset.priceLabel} live price, ${asset.marketCapLabel} market cap, ${asset.volume24hLabel} 24h volume (${asset.change24hLabel})`)
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

function formatWalletIntelligenceText(intelligence: MythosWalletIntelligence) {
  return cleanTerminalText([
    terminalSection('Intent', `Read-only wallet financial intelligence for ${intelligence.address}`),
    terminalSection('Portfolio snapshot', [
      `Estimated value: ${intelligence.portfolio.valueLabel}`,
      `24h estimate: ${intelligence.portfolio.change24hLabel}`,
      `SOL: ${intelligence.sol.balance === null ? 'unavailable' : `${intelligence.sol.balance.toFixed(4)} SOL`}`,
      `Data confidence: ${intelligence.confidence}/100`,
    ]),
    terminalSection('Method', intelligence.portfolio.estimateNote),
    terminalSection('Mythos notes', intelligence.recommendations.map(item => `- ${item}`)),
    terminalSection('Sources', intelligence.sources.map(item => `- ${item}`)),
    terminalSection('Safety boundary', [
      intelligence.safety.disclaimer,
      'No wallet signature was requested.',
      'No transaction was created or submitted.',
    ]),
  ].join('\n\n'));
}

function isWalletIntelligenceCommand(content: string) {
  const normalized = content.trim().toLowerCase();
  return /^\/wallet\s+(intelligence|intel|finance|financial|snapshot|portfolio)$/.test(normalized) ||
    /^\/carteira\s+(inteligencia|inteligência|financeira|snapshot|portfolio|portfólio)$/.test(normalized);
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
  const valueLabel = 'volume24hLabel' in coin
    ? mode === 'meme'
      ? coin.priceLabel
      : coin.volume24hLabel
    : coin.price
      ? `$${coin.price.toLocaleString('en-US', { maximumSignificantDigits: 4 })}`
      : 'trending';
  const detailLabel = 'volume24hLabel' in coin
    ? mode === 'meme'
      ? `MCap ${coin.marketCapLabel} | Vol ${coin.volume24hLabel}`
      : '24h volume'
    : coin.name;

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
        <p className="truncate text-[11px] text-white/42">{detailLabel}</p>
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
  onCopyLaunchBrief,
  onSimpleLaunch,
}: {
  draft: MythosMemecoinDraft;
  onConnectWallet: () => void;
  onCopyLaunchBrief: (draft: MythosMemecoinDraft) => void;
  onSimpleLaunch: (draft: MythosMemecoinDraft) => void;
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
          status: hasName && walletReady && hasFirstBuy ? 'ready' : 'pending',
          detail: hasName && walletReady && hasFirstBuy
            ? 'Ready for Mythos to prepare the launch package behind one action.'
            : 'Complete name, wallet, and first buy amount before Mythos prepares the launch package.',
        },
        {
          title: '6. Wallet signature',
          status: 'pending',
          detail: 'Phantom/Solflare approval appears only after the final transaction preview is ready.',
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

  function completeWithMythos() {
    const seeds = [
      ['Neon Penguin', 'NPENG', 'A sharp green-black Solana meme built around a neon penguin mascot, fast community jokes, and transparent launch review.'],
      ['Zeus Cat', 'ZCAT', 'A lightning-charged Solana meme with a mythic cat mascot, playful culture, and creator-owned visual identity.'],
      ['Mito Frog', 'MITO', 'A CongChain-native meme concept with a bright green frog mascot, Mythos lore, and a clean community-first launch story.'],
      ['Orbit Dog', 'ODOG', 'A space-dog Solana meme with premium black-green branding, simple lore, and a safe human-reviewed launch path.'],
    ];
    const [name, symbol, description] = seeds[Math.floor(Math.random() * seeds.length)];
    const nextName = editableDraft.name === 'Untitled Meme' ? name : editableDraft.name;
    const nextSymbol = editableDraft.symbol === 'UNTITL' || editableDraft.symbol === 'MEME' ? symbol : editableDraft.symbol;

    updateEditableDraft({
      name: nextName,
      symbol: nextSymbol,
      description: editableDraft.description.length < 24 ? description : editableDraft.description,
      imagePrompt: editableDraft.imagePrompt.length < 24
        ? `Premium green-black Solana meme logo for ${nextName}, bold mascot, clean circular icon, high contrast, launch-ready branding.`
        : editableDraft.imagePrompt,
      initialBuySol: editableDraft.initialBuySol > 0 ? editableDraft.initialBuySol : 0.01,
    });
  }

  const statusTone = editableDraft.walletReady ? 'Ready for review' : 'Wallet needed';
  const readinessLabel = editableDraft.launchMode === 'launch_review_ready' ? 'Launch review ready' : 'Preview only';
  const compactSymbol = editableDraft.symbol.length > 7 ? `${editableDraft.symbol.slice(0, 7)}...` : editableDraft.symbol;

  return (
    <div className="mt-4 overflow-hidden rounded-[28px] border border-[#76FF03]/24 bg-[linear-gradient(135deg,rgba(9,43,4,0.92),rgba(1,8,3,0.98))] p-4 shadow-[0_0_46px_rgba(118,255,3,0.055)] sm:p-5">
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_348px] 2xl:items-start">
        <div className="min-w-0">
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

          <div className="mt-5 grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)] 2xl:grid-cols-[170px_minmax(0,1fr)]">
            <div className="flex h-[150px] items-center justify-center overflow-hidden rounded-[26px] border border-[#76FF03]/26 bg-[radial-gradient(circle_at_50%_34%,rgba(118,255,3,0.22),transparent_42%),rgba(0,0,0,0.68)] 2xl:aspect-square 2xl:h-auto 2xl:rounded-[32px]">
              {logoPreviewUrl ? (
                <img src={logoPreviewUrl} alt={`${editableDraft.name} local logo preview`} className="h-full w-full object-cover" />
              ) : (
              <div className="text-center">
                <Coins className="mx-auto h-9 w-9 text-[#A7FF3D]" />
                  <p className="mx-auto mt-3 max-w-[132px] break-words text-lg font-black uppercase tracking-[0.08em] text-white sm:text-xl">${compactSymbol}</p>
              </div>
              )}
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/36">Launch draft</p>
              <div className="mt-3 grid gap-3 2xl:grid-cols-[1fr_150px]">
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
                  <p className="mt-2 break-all font-mono text-sm font-black leading-5 text-[#A7FF3D] sm:text-base">${editableDraft.symbol}</p>
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
                  <p className="mt-2 text-sm font-black leading-5 text-white sm:text-base">{readinessLabel}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 2xl:grid-cols-[1.15fr_0.85fr]">
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

        <div className="min-w-0 rounded-3xl border border-white/10 bg-black/36 p-4">
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
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-2xl border border-[#14F195]/22 bg-[#14F195]/10 px-3 py-2 text-center text-[11px] font-black uppercase leading-4 tracking-[0.08em] text-[#8CFFD2] transition hover:bg-[#14F195]/16"
            >
              Connect Phantom / Solflare
            </button>
          ) : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-3 2xl:grid-cols-1">
            <button
              type="button"
              onClick={() => onCopyLaunchBrief(editableDraft)}
              className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.045] px-3 py-2 text-center text-[11px] font-black uppercase leading-4 tracking-[0.08em] text-white/68 transition hover:bg-white/[0.07]"
            >
              Copy launch brief
            </button>
            <button
              type="button"
              onClick={completeWithMythos}
              className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-[#76FF03]/22 bg-[#76FF03]/12 px-3 py-2 text-center text-[11px] font-black uppercase leading-4 tracking-[0.08em] text-[#B8FF5C] transition hover:bg-[#76FF03]/18 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.035] disabled:text-white/30"
            >
              Mythos complete
            </button>
            <button
              type="button"
              onClick={() => onSimpleLaunch(editableDraft)}
              className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-[#7DE4FF]/20 bg-[#7DE4FF]/9 px-3 py-2 text-center text-[11px] font-black uppercase leading-4 tracking-[0.08em] text-[#9AEAFF] transition hover:bg-[#7DE4FF]/14"
            >
              Generate and launch
            </button>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
            {editableDraft.phases.map((phase, index) => (
              <div key={`${phase.title}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 text-xs font-black leading-4 text-white">{phase.title}</p>
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

          <div className="mt-5 rounded-2xl border border-[#14F195]/14 bg-[#14F195]/[0.055] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8CFFD2]">Simple launch path</p>
            <p className="mt-2 text-xs leading-5 text-white/54">Mythos prepares the technical package after Generate and launch. You still approve the final transaction visibly in Phantom/Solflare.</p>
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

function pctTone(value: number | null) {
  if (value === null) return 'text-white/46';
  return value >= 0 ? 'text-[#8CFFD2]' : 'text-[#FF8FAB]';
}

function MythosWalletIntelligenceCard({
  intelligence,
  loading,
  error,
  onRefresh,
}: {
  intelligence: MythosWalletIntelligence | null;
  loading: boolean;
  error: string;
  onRefresh?: () => void;
}) {
  if (!intelligence && !loading && !error) return null;

  return (
    <div className="mb-4 overflow-hidden rounded-[24px] border border-[#14F195]/18 bg-[linear-gradient(135deg,rgba(4,28,20,0.82),rgba(1,8,3,0.96))] p-4 shadow-[0_0_38px_rgba(20,241,149,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8CFFD2]">Wallet Financial Intelligence</p>
          <h3 className="mt-2 text-xl font-black text-white">
            {loading && !intelligence ? 'Reading real wallet data...' : intelligence?.portfolio.valueLabel || 'Wallet data unavailable'}
          </h3>
          <p className="mt-1 break-all text-xs leading-5 text-white/48">
            {intelligence?.address || 'Mythos only reports values returned by live data providers.'}
          </p>
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[#14F195]/18 bg-[#14F195]/8 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#8CFFD2] transition hover:bg-[#14F195]/13 disabled:opacity-50"
          >
            <Radar className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-[#FF5C7A]/18 bg-[#FF5C7A]/8 p-3 text-xs leading-5 text-[#FFB0BF]">{error}</p>
      ) : null}

      {intelligence ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-black/28 p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/34">24h estimate</p>
              <p className={`mt-2 text-2xl font-black ${pctTone(intelligence.portfolio.change24hPct)}`}>{intelligence.portfolio.change24hLabel}</p>
              <p className="mt-1 text-[11px] leading-4 text-white/42">Current holdings, not cost-basis PnL.</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/28 p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/34">SOL</p>
              <p className="mt-2 text-lg font-black text-white">{intelligence.sol.balance === null ? 'unavailable' : `${intelligence.sol.balance.toFixed(4)} SOL`}</p>
              <p className={`mt-1 text-xs font-bold ${pctTone(intelligence.sol.change24hPct)}`}>SOL 24h {intelligence.sol.change24hPct === null ? 'unavailable' : `${intelligence.sol.change24hPct >= 0 ? '+' : ''}${intelligence.sol.change24hPct.toFixed(2)}%`}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/28 p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/34">Data confidence</p>
              <p className="mt-2 text-2xl font-black text-white">{intelligence.confidence}/100</p>
              <p className="mt-1 text-[11px] leading-4 text-white/42">{new Date(intelligence.fetchedAt).toLocaleString()}</p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/38">Tracked positions</p>
              <div className="mt-3 space-y-2">
                {intelligence.tokens.slice(0, 5).map(token => (
                  <div key={`${token.mint}-${token.symbol}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/20 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">{token.symbol}</p>
                      <p className="truncate text-[11px] text-white/38">{token.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-white">{token.valueUsd === null ? 'n/a' : `$${token.valueUsd.toFixed(token.valueUsd >= 100 ? 0 : 2)}`}</p>
                      <p className={`text-[11px] font-bold ${pctTone(token.change24hPct)}`}>{token.change24hPct === null ? '24h n/a' : `${token.change24hPct >= 0 ? '+' : ''}${token.change24hPct.toFixed(2)}%`}</p>
                    </div>
                  </div>
                ))}
                {!intelligence.tokens.length ? (
                  <p className="rounded-xl border border-white/6 bg-black/20 p-3 text-xs leading-5 text-white/46">No priced SPL token positions returned by the provider.</p>
                ) : null}
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/38">Mythos notes</p>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-white/54">
                {intelligence.highlights.slice(0, 4).map(item => <li key={item}>- {item}</li>)}
                {intelligence.recommendations.slice(0, 2).map(item => <li key={item}>- {item}</li>)}
              </ul>
              {intelligence.unavailable.length ? (
                <p className="mt-3 rounded-xl border border-[#FFD166]/16 bg-[#FFD166]/8 p-3 text-[11px] leading-4 text-[#FFE08A]">
                  {intelligence.unavailable[0]}
                </p>
              ) : null}
            </div>
          </div>

          <p className="mt-3 text-[11px] leading-4 text-white/36">
            Sources: {intelligence.sources.join(' | ')}. {intelligence.portfolio.estimateNote}
          </p>
        </>
      ) : null}
    </div>
  );
}

function MythosPumpfunProposalCard({
  proposal,
  onPrepareMetadataReview,
}: {
  proposal: MythosPumpfunLaunchProposal;
  onPrepareMetadataReview: (proposal: MythosPumpfunLaunchProposal) => void;
}) {
  const statusLabel = proposal.status.replace(/_/g, ' ');
  const statusClass = proposal.status === 'ready_for_future_signature'
    ? 'border-[#14F195]/24 bg-[#14F195]/10 text-[#8CFFD2]'
    : proposal.status === 'blocked'
      ? 'border-[#FF5C7A]/24 bg-[#FF5C7A]/10 text-[#FF9AB1]'
      : 'border-[#FFD166]/24 bg-[#FFD166]/10 text-[#FFE08A]';

  return (
    <div className="mt-4 overflow-hidden rounded-[28px] border border-[#7DE4FF]/20 bg-[linear-gradient(135deg,rgba(1,28,34,0.9),rgba(1,8,3,0.98))] p-5 shadow-[0_0_42px_rgba(125,228,255,0.045)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7DE4FF]">Pump.fun Launch Proposal</p>
          <h4 className="mt-2 text-2xl font-black text-white">{proposal.token.name} <span className="text-[#A7FF3D]">${proposal.token.symbol}</span></h4>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">Audited proposal packet only. Mythos has not uploaded metadata, created a mint, requested a wallet signature, submitted a transaction, or bought tokens.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {[
          ['Proposal ID', proposal.id],
          ['Network', proposal.network],
          ['Wallet', proposal.wallet.address ? `${proposal.wallet.address.slice(0, 4)}...${proposal.wallet.address.slice(-4)}` : 'missing'],
          ['First buy', proposal.firstBuy.configured ? `${proposal.firstBuy.amountSol} SOL` : 'not set'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-black/34 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/34">{label}</p>
            <p className="mt-2 break-words text-sm font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Validation gates</p>
          <div className="mt-3 space-y-2">
            {proposal.checks.map(check => (
              <div key={check.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-white">{check.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                    check.status === 'ready'
                      ? 'bg-[#14F195]/12 text-[#8CFFD2]'
                      : check.status === 'blocked'
                        ? 'bg-[#FF5C7A]/12 text-[#FF8FAB]'
                        : 'bg-[#FFD166]/12 text-[#FFE08A]'
                  }`}>
                    {check.status}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-white/48">{check.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#FFD166]/16 bg-[#FFD166]/7 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFE08A]">Future execution ladder</p>
          <ol className="mt-3 space-y-2 text-xs leading-5 text-white/58">
            {proposal.futureExecution.map((step, index) => (
              <li key={step} className="flex gap-2">
                <span className="font-black text-[#FFE08A]">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-2xl border border-[#FF5C7A]/16 bg-black/28 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FF9AB1]">Unsigned transaction</p>
            <p className="mt-2 text-xs leading-5 text-white/54">Not created in this phase. This keeps the flow safe until metadata rules, Pump.fun payload format, slippage, and wallet UX are audited.</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#7DE4FF]/14 bg-[#7DE4FF]/[0.045] p-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9AEAFF]">Next safe phase</p>
          <p className="mt-1 text-sm leading-6 text-white/58">Prepare metadata review. This creates a hash-addressable packet only; it does not upload to IPFS, Arweave, or Pump.fun.</p>
        </div>
        <button
          type="button"
          onClick={() => onPrepareMetadataReview(proposal)}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#7DE4FF]/20 bg-[#7DE4FF]/10 px-4 text-xs font-black uppercase tracking-[0.12em] text-[#9AEAFF] transition hover:bg-[#7DE4FF]/15"
        >
          Prepare metadata review
        </button>
      </div>
    </div>
  );
}

function MythosPumpfunMetadataReviewCard({
  review,
  onPrepareUnsignedPreview,
}: {
  review: MythosPumpfunMetadataReview;
  onPrepareUnsignedPreview: (review: MythosPumpfunMetadataReview) => void;
}) {
  const statusClass = review.status === 'ready_for_manual_upload'
    ? 'border-[#14F195]/24 bg-[#14F195]/10 text-[#8CFFD2]'
    : review.status === 'blocked'
      ? 'border-[#FF5C7A]/24 bg-[#FF5C7A]/10 text-[#FF9AB1]'
      : 'border-[#FFD166]/24 bg-[#FFD166]/10 text-[#FFE08A]';

  return (
    <div className="mt-4 overflow-hidden rounded-[28px] border border-[#A7FF3D]/20 bg-[linear-gradient(135deg,rgba(17,41,4,0.9),rgba(1,8,3,0.98))] p-5 shadow-[0_0_42px_rgba(167,255,61,0.045)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Pump.fun Metadata Review</p>
          <h4 className="mt-2 text-2xl font-black text-white">{review.token.name} <span className="text-[#A7FF3D]">${review.token.symbol}</span></h4>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">Metadata packet is hashed for review. No image, JSON, IPFS, Arweave, or Pump.fun upload happened.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass}`}>
          {review.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {[
          ['Metadata ID', review.id],
          ['Proposal', review.proposalId || 'not linked'],
          ['Upload URI', review.upload.uri || 'not created'],
          ['Wallet', review.wallet.address ? `${review.wallet.address.slice(0, 4)}...${review.wallet.address.slice(-4)}` : 'missing'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-black/34 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/34">{label}</p>
            <p className="mt-2 break-words text-sm font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Metadata gates</p>
          <div className="mt-3 space-y-2">
            {review.checks.map(check => (
              <div key={check.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-white">{check.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                    check.status === 'ready'
                      ? 'bg-[#14F195]/12 text-[#8CFFD2]'
                      : check.status === 'blocked'
                        ? 'bg-[#FF5C7A]/12 text-[#FF8FAB]'
                        : 'bg-[#FFD166]/12 text-[#FFE08A]'
                  }`}>
                    {check.status}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-white/48">{check.detail}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[#7DE4FF]/16 bg-[#7DE4FF]/7 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9AEAFF]">Hash and next steps</p>
          <p className="mt-3 break-all rounded-2xl border border-white/8 bg-black/28 p-3 font-mono text-xs text-white/62">{review.metadataHash}</p>
          <ol className="mt-3 space-y-2 text-xs leading-5 text-white/58">
            {review.nextSteps.map((step, index) => (
              <li key={step} className="flex gap-2">
                <span className="font-black text-[#9AEAFF]">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => onPrepareUnsignedPreview(review)}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[#A7FF3D]/22 bg-[#A7FF3D]/10 text-xs font-black uppercase tracking-[0.12em] text-[#B8FF5C] transition hover:bg-[#A7FF3D]/15"
          >
            Prepare unsigned preview
          </button>
        </div>
      </div>
    </div>
  );
}

function MythosPumpfunUnsignedPreviewCard({
  preview,
  onAuditPayload,
}: {
  preview: MythosPumpfunUnsignedPreview;
  defaultMetadataUri: string;
  onAuditPayload: (preview: MythosPumpfunUnsignedPreview, options: {
    metadataUri: string;
    slippageBps: number;
    priorityFeeLamports: number;
  }) => void;
}) {
  const [metadataUri, setMetadataUri] = useState(defaultMetadataUri);
  const [slippageBps, setSlippageBps] = useState(500);
  const [priorityFeeLamports, setPriorityFeeLamports] = useState(0);

  useEffect(() => {
    setMetadataUri(defaultMetadataUri);
  }, [defaultMetadataUri]);
  const statusClass = preview.status === 'ready_for_wallet_signature_phase'
    ? 'border-[#14F195]/24 bg-[#14F195]/10 text-[#8CFFD2]'
    : preview.status === 'blocked'
      ? 'border-[#FF5C7A]/24 bg-[#FF5C7A]/10 text-[#FF9AB1]'
      : 'border-[#FFD166]/24 bg-[#FFD166]/10 text-[#FFE08A]';

  return (
    <div className="mt-4 overflow-hidden rounded-[28px] border border-[#FFD166]/20 bg-[linear-gradient(135deg,rgba(38,27,4,0.88),rgba(1,8,3,0.98))] p-5 shadow-[0_0_42px_rgba(255,209,102,0.045)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFE08A]">Unsigned Transaction Preview</p>
          <h4 className="mt-2 text-2xl font-black text-white">{preview.token.name} <span className="text-[#A7FF3D]">${preview.token.symbol}</span></h4>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">This is an instruction plan, not a serialized transaction. Phantom/Solflare was not opened and no transaction was submitted.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass}`}>
          {preview.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {[
          ['Preview ID', preview.id],
          ['Signer', preview.signer.walletAddress ? `${preview.signer.walletAddress.slice(0, 4)}...${preview.signer.walletAddress.slice(-4)}` : 'missing'],
          ['Wire ready', preview.transaction.wireReady ? 'yes' : 'no'],
          ['First buy', preview.firstBuy.configured ? `${preview.firstBuy.amountSol} SOL` : 'not set'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-black/34 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/34">{label}</p>
            <p className="mt-2 break-words text-sm font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFE08A]">Instruction plan</p>
          <ol className="mt-3 space-y-2 text-xs leading-5 text-white/58">
            {preview.instructionPlan.map((step, index) => (
              <li key={step} className="flex gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <span className="font-black text-[#FFE08A]">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-2xl border border-[#FF5C7A]/16 bg-[#FF5C7A]/7 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF9AB1]">Still blocked</p>
          <p className="mt-3 text-xs leading-5 text-white/58">{preview.transaction.reason}</p>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-white/56">
            {preview.blockedActions.map(action => <li key={action}>- {action}</li>)}
          </ul>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[#7DE4FF]/16 bg-[#7DE4FF]/[0.045] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9AEAFF]">Payload audit inputs</p>
        <p className="mt-2 text-xs leading-5 text-white/50">Mythos prefilled a server-side HTTPS metadata preview so you can test the flow. Replace it with IPFS/Arweave before any real public launch.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_140px_170px]">
          <label className="block">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/34">Metadata URI</span>
            <input
              value={metadataUri}
              onChange={event => setMetadataUri(event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/34 px-4 font-mono text-xs text-white outline-none transition placeholder:text-white/24 focus:border-[#7DE4FF]/42"
              placeholder="ipfs://... or https://..."
            />
          </label>
          <label className="block">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/34">Slippage bps</span>
            <input
              type="number"
              min="50"
              max="3000"
              step="50"
              value={slippageBps}
              onChange={event => setSlippageBps(Number(event.target.value))}
              className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/34 px-4 text-sm font-black text-white outline-none transition placeholder:text-white/24 focus:border-[#7DE4FF]/42"
            />
          </label>
          <label className="block">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/34">Priority fee</span>
            <input
              type="number"
              min="0"
              step="1000"
              value={priorityFeeLamports}
              onChange={event => setPriorityFeeLamports(Number(event.target.value))}
              className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/34 px-4 text-sm font-black text-white outline-none transition placeholder:text-white/24 focus:border-[#7DE4FF]/42"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => onAuditPayload(preview, { metadataUri, slippageBps, priorityFeeLamports })}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl border border-[#A7FF3D]/22 bg-[#A7FF3D]/10 px-4 text-xs font-black uppercase tracking-[0.12em] text-[#B8FF5C] transition hover:bg-[#A7FF3D]/15"
        >
          Audit Pump.fun payload
        </button>
      </div>
    </div>
  );
}

function MythosPumpfunPayloadAuditCard({
  audit,
  onPrepareUnsignedBuilder,
}: {
  audit: MythosPumpfunPayloadAudit;
  onPrepareUnsignedBuilder: (audit: MythosPumpfunPayloadAudit) => void;
}) {
  const statusClass = audit.status === 'ready_for_payload_builder'
    ? 'border-[#14F195]/24 bg-[#14F195]/10 text-[#8CFFD2]'
    : audit.status === 'blocked'
      ? 'border-[#FF5C7A]/24 bg-[#FF5C7A]/10 text-[#FF9AB1]'
      : 'border-[#FFD166]/24 bg-[#FFD166]/10 text-[#FFE08A]';

  return (
    <div className="mt-4 overflow-hidden rounded-[28px] border border-[#7DE4FF]/20 bg-[linear-gradient(135deg,rgba(1,24,27,0.92),rgba(1,8,3,0.98))] p-5 shadow-[0_0_42px_rgba(125,228,255,0.045)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9AEAFF]">Pump.fun Payload Audit</p>
          <h4 className="mt-2 text-2xl font-black text-white">{audit.token.name} <span className="text-[#A7FF3D]">${audit.token.symbol}</span></h4>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">Mythos audited payload readiness without touching Pump.fun, Phantom, Solflare, or Solana submission.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass}`}>
          {audit.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {[
          ['Payload ID', audit.id],
          ['Metadata URI', audit.token.metadataUri || 'missing'],
          ['Slippage', audit.economics.slippageLabel],
          ['Priority fee', `${audit.economics.priorityFeeLamports} lamports`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-black/34 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/34">{label}</p>
            <p className="mt-2 break-words text-sm font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9AEAFF]">Instruction audit</p>
          <div className="mt-3 space-y-2">
            {audit.instructionAudit.map(item => (
              <div key={item.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-white">{item.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                    item.status === 'ready'
                      ? 'bg-[#14F195]/12 text-[#8CFFD2]'
                      : item.status === 'blocked'
                        ? 'bg-[#FF5C7A]/12 text-[#FF8FAB]'
                        : 'bg-[#FFD166]/12 text-[#FFE08A]'
                  }`}>
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-white/48">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[#FF5C7A]/16 bg-[#FF5C7A]/7 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF9AB1]">Execution remains blocked</p>
          <p className="mt-3 break-all rounded-2xl border border-white/8 bg-black/28 p-3 font-mono text-xs text-white/62">{audit.payloadHash}</p>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-white/56">
            {audit.blockedActions.map(action => <li key={action}>- {action}</li>)}
          </ul>
          <button
            type="button"
            onClick={() => onPrepareUnsignedBuilder(audit)}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[#A7FF3D]/22 bg-[#A7FF3D]/10 px-4 text-xs font-black uppercase tracking-[0.12em] text-[#B8FF5C] transition hover:bg-[#A7FF3D]/15"
          >
            Prepare unsigned builder gate
          </button>
        </div>
      </div>
    </div>
  );
}

function MythosPumpfunUnsignedBuilderCard({
  builder,
  signedPayload,
  submittedPayload,
  buySpendSol,
  submitConfirmation,
  submitting,
  onSignCreate,
  onBuySpendChange,
  onPrepareBuy,
  onSubmitConfirmationChange,
  onSubmitSignedCreate,
}: {
  builder: MythosPumpfunUnsignedBuilder;
  signedPayload?: MythosPumpfunSignedPayload;
  submittedPayload?: MythosPumpfunSubmittedPayload;
  buySpendSol: string;
  submitConfirmation: string;
  submitting: boolean;
  onSignCreate: (builder: MythosPumpfunUnsignedBuilder) => void;
  onBuySpendChange: (builderId: string, value: string) => void;
  onPrepareBuy: (builder: MythosPumpfunUnsignedBuilder, submitted: MythosPumpfunSubmittedPayload) => void;
  onSubmitConfirmationChange: (builderId: string, value: string) => void;
  onSubmitSignedCreate: (builder: MythosPumpfunUnsignedBuilder) => void;
}) {
  const blockedGates = builder.gates.filter(item => item.status === 'blocked');
  const statusClass = builder.status === 'ready_for_audited_provider'
    ? 'border-[#14F195]/24 bg-[#14F195]/10 text-[#8CFFD2]'
    : builder.status === 'blocked'
      ? 'border-[#FF5C7A]/24 bg-[#FF5C7A]/10 text-[#FF9AB1]'
      : 'border-[#FFD166]/24 bg-[#FFD166]/10 text-[#FFE08A]';

  return (
    <div className="mt-4 overflow-hidden rounded-[28px] border border-[#A7FF3D]/20 bg-[radial-gradient(circle_at_20%_0%,rgba(118,255,3,0.12),transparent_30%),linear-gradient(135deg,rgba(4,22,0,0.94),rgba(0,0,0,0.98))] p-5 shadow-[0_0_46px_rgba(118,255,3,0.055)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Unsigned Builder Gate</p>
          <h4 className="mt-2 text-2xl font-black text-white">{builder.token.name} <span className="text-[#A7FF3D]">${builder.token.symbol}</span></h4>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
            {builder.transaction.wireReady
              ? 'Create-only transaction bytes are ready for explicit wallet review. Initial buy remains a separate quote, signature, and submit phase after create confirmation.'
              : 'Mythos prepared the builder review, but create bytes are still blocked until the remaining serialization gates are ready.'}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass}`}>
          {builder.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {[
          ['Builder ID', builder.id],
          ['Provider', builder.provider.configured ? builder.provider.source || 'configured' : 'not configured'],
          ['Wire ready', builder.transaction.wireReady ? 'yes' : 'no'],
          ['Fee quote', builder.economics.feeQuoteLamports === null ? 'not quoted' : `${builder.economics.feeQuoteLamports} lamports`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-black/34 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/34">{label}</p>
            <p className="mt-2 break-words text-sm font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Serialization gates</p>
          <div className="mt-3 space-y-2">
            {builder.gates.map(item => (
              <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-white">{item.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                    item.status === 'ready'
                      ? 'bg-[#14F195]/12 text-[#8CFFD2]'
                      : item.status === 'blocked'
                        ? 'bg-[#FF5C7A]/12 text-[#FF8FAB]'
                        : 'bg-[#FFD166]/12 text-[#FFE08A]'
                  }`}>
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-white/48">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-[#7DE4FF]/16 bg-[#7DE4FF]/[0.045] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9AEAFF]">Program audit</p>
            <div className="mt-3 space-y-2 font-mono text-[11px] leading-5 text-white/58">
              <p className="break-all">program: {builder.programAudit.programId || 'not configured'}</p>
              <p className="break-all">schema: {builder.programAudit.accountSchemaVerified ? 'verified' : 'not verified'}</p>
              <p className="break-all">discriminator: {builder.programAudit.instructionDiscriminatorVerified ? 'verified' : 'not verified'}</p>
              <p className="break-all">metadata: {builder.token.metadataUri || 'missing'}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-[#FF5C7A]/16 bg-[#FF5C7A]/7 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF9AB1]">Still no execution</p>
            <p className="mt-3 text-xs leading-5 text-white/58">{builder.transaction.reason}</p>
            {blockedGates.length ? (
              <div className="mt-3 rounded-2xl border border-white/8 bg-black/28 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FFE08A]">Blocking gates</p>
                <ul className="mt-2 space-y-2 text-[11px] leading-4 text-white/56">
                  {blockedGates.slice(0, 4).map(gate => <li key={gate.id}>- {gate.label}: {gate.detail}</li>)}
                </ul>
              </div>
            ) : null}
            <ul className="mt-3 space-y-2 text-xs leading-5 text-white/56">
              {builder.blockedActions.slice(0, 4).map(action => <li key={action}>- {action}</li>)}
            </ul>
            {builder.transaction.wireReady ? (
              <div className="mt-4 rounded-2xl border border-[#FFD166]/18 bg-[#FFD166]/10 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FFE08A]">Wallet signature gate</p>
                <p className="mt-2 text-[11px] leading-4 text-white/52">
                  Signing stays in browser memory. Mythos will not submit this transaction from this step.
                </p>
                {signedPayload ? (
                  <div className="mt-3 rounded-xl border border-[#14F195]/16 bg-[#14F195]/8 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8CFFD2]">Signed locally</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-white/58">{signedPayload.signedTransactionHash}</p>
                    <p className="mt-1 text-[11px] text-white/42">Submitted to Solana: {submittedPayload ? 'true' : 'false'}</p>
                    {submittedPayload ? (
                      <div className="mt-3 rounded-xl border border-[#7DE4FF]/18 bg-[#7DE4FF]/10 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9AEAFF]">Submitted</p>
                        <p className="mt-1 break-all font-mono text-[11px] text-white/62">{submittedPayload.signature}</p>
                        <p className="mt-1 text-[11px] text-white/42">Confirmed: {submittedPayload.confirmed ? 'yes' : 'pending'}</p>
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/28 p-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FFE08A]">Initial buy</p>
                          <input
                            value={buySpendSol}
                            onChange={event => onBuySpendChange(builder.id, event.target.value)}
                            className="mt-3 h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-xs font-black text-white outline-none placeholder:text-white/20 focus:border-[#FFD166]/35"
                            placeholder="0.01"
                          />
                          <button
                            type="button"
                            onClick={() => onPrepareBuy(builder, submittedPayload)}
                            className="mt-3 inline-flex min-h-10 w-full min-w-0 items-center justify-center whitespace-normal rounded-2xl border border-[#7DE4FF]/24 bg-[#7DE4FF]/12 px-4 py-2 text-center text-[11px] font-black uppercase leading-4 tracking-[0.08em] text-[#9AEAFF] transition hover:bg-[#7DE4FF]/18"
                          >
                            Prepare buy quote
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-[#FF5C7A]/18 bg-[#FF5C7A]/10 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FF9AB1]">Separate submit gate</p>
                        <p className="mt-1 text-[11px] leading-4 text-white/50">
                          Type SUBMIT to send the signed transaction from this browser. This can create the token on Solana.
                        </p>
                        <input
                          value={submitConfirmation}
                          onChange={event => onSubmitConfirmationChange(builder.id, event.target.value)}
                          className="mt-3 h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-xs font-black uppercase tracking-[0.12em] text-white outline-none placeholder:text-white/20 focus:border-[#FF5C7A]/35"
                          placeholder="SUBMIT"
                        />
                        <button
                          type="button"
                          onClick={() => onSubmitSignedCreate(builder)}
                          disabled={submitConfirmation.trim().toUpperCase() !== 'SUBMIT' || submitting}
                          className="mt-3 inline-flex min-h-10 w-full min-w-0 items-center justify-center whitespace-normal rounded-2xl border border-[#FF5C7A]/26 bg-[#FF5C7A]/13 px-4 py-2 text-center text-[11px] font-black uppercase leading-4 tracking-[0.08em] text-[#FFB0BF] transition hover:bg-[#FF5C7A]/18 disabled:opacity-45"
                        >
                          {submitting ? 'Submitting...' : 'Submit signed create'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSignCreate(builder)}
                    className="mt-3 inline-flex min-h-10 w-full min-w-0 items-center justify-center whitespace-normal rounded-2xl border border-[#FFD166]/24 bg-[#FFD166]/12 px-4 py-2 text-center text-[11px] font-black uppercase leading-4 tracking-[0.08em] text-[#FFE08A] transition hover:bg-[#FFD166]/18"
                  >
                    Sign create payload
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function MythosPumpfunBuyBuilderCard({
  buy,
  signedPayload,
  submittedPayload,
  submitConfirmation,
  submitting,
  onSignBuy,
  onSubmitConfirmationChange,
  onSubmitSignedBuy,
}: {
  buy: MythosPumpfunBuyBuilder;
  signedPayload?: MythosPumpfunSignedPayload;
  submittedPayload?: MythosPumpfunSubmittedPayload;
  submitConfirmation: string;
  submitting: boolean;
  onSignBuy: (buy: MythosPumpfunBuyBuilder) => void;
  onSubmitConfirmationChange: (builderId: string, value: string) => void;
  onSubmitSignedBuy: (buy: MythosPumpfunBuyBuilder) => void;
}) {
  const statusClass = buy.status === 'ready_for_wallet_signature'
    ? 'border-[#14F195]/24 bg-[#14F195]/10 text-[#8CFFD2]'
    : buy.status === 'blocked'
      ? 'border-[#FF5C7A]/24 bg-[#FF5C7A]/10 text-[#FF9AB1]'
      : 'border-[#FFD166]/24 bg-[#FFD166]/10 text-[#FFE08A]';

  return (
    <div className="mt-4 overflow-hidden rounded-[28px] border border-[#7DE4FF]/20 bg-[radial-gradient(circle_at_20%_0%,rgba(125,228,255,0.12),transparent_30%),linear-gradient(135deg,rgba(0,16,28,0.94),rgba(0,0,0,0.98))] p-5 shadow-[0_0_46px_rgba(125,228,255,0.055)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9AEAFF]">Pump.fun Buy Gate</p>
          <h4 className="mt-2 text-2xl font-black text-white">Initial buy review</h4>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
            Buy is separate from create. Mythos quotes the current bonding curve, prepares unsigned bytes, and still requires wallet signature plus a separate submit confirmation.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass}`}>
          {buy.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {[
          ['Spend', buy.quote.spendLamports ? `${Number(buy.quote.spendLamports) / 1_000_000_000} SOL` : 'not quoted'],
          ['Min tokens', buy.quote.minTokensOut || 'not quoted'],
          ['Slippage', `${buy.quote.slippageBps / 100}%`],
          ['Wire ready', buy.transaction.wireReady ? 'yes' : 'no'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-black/34 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/34">{label}</p>
            <p className="mt-2 break-words text-sm font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9AEAFF]">Buy gates</p>
          <div className="mt-3 space-y-2">
            {buy.gates.map(item => (
              <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-white">{item.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                    item.status === 'ready'
                      ? 'bg-[#14F195]/12 text-[#8CFFD2]'
                      : item.status === 'blocked'
                        ? 'bg-[#FF5C7A]/12 text-[#FF8FAB]'
                        : 'bg-[#FFD166]/12 text-[#FFE08A]'
                  }`}>
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-white/48">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#FFD166]/16 bg-[#FFD166]/8 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFE08A]">Quote caveat</p>
            <p className="mt-3 text-xs leading-5 text-white/58">{buy.quote.caveat}</p>
          </div>
          <div className="rounded-2xl border border-[#FF5C7A]/16 bg-[#FF5C7A]/7 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF9AB1]">Buy execution</p>
            <p className="mt-3 text-xs leading-5 text-white/58">{buy.transaction.reason}</p>
            {buy.transaction.wireReady ? (
              <div className="mt-4 rounded-2xl border border-[#FFD166]/18 bg-[#FFD166]/10 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FFE08A]">Wallet signature gate</p>
                {signedPayload ? (
                  <div className="mt-3 rounded-xl border border-[#14F195]/16 bg-[#14F195]/8 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8CFFD2]">Buy signed locally</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-white/58">{signedPayload.signedTransactionHash}</p>
                    <p className="mt-1 text-[11px] text-white/42">Submitted to Solana: {submittedPayload ? 'true' : 'false'}</p>
                    {submittedPayload ? (
                      <div className="mt-3 rounded-xl border border-[#7DE4FF]/18 bg-[#7DE4FF]/10 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9AEAFF]">Buy submitted</p>
                        <p className="mt-1 break-all font-mono text-[11px] text-white/62">{submittedPayload.signature}</p>
                        <p className="mt-1 text-[11px] text-white/42">Confirmed: {submittedPayload.confirmed ? 'yes' : 'pending'}</p>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-[#FF5C7A]/18 bg-[#FF5C7A]/10 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FF9AB1]">Separate submit gate</p>
                        <input
                          value={submitConfirmation}
                          onChange={event => onSubmitConfirmationChange(buy.id, event.target.value)}
                          className="mt-3 h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-xs font-black uppercase tracking-[0.12em] text-white outline-none placeholder:text-white/20 focus:border-[#FF5C7A]/35"
                          placeholder="SUBMIT"
                        />
                        <button
                          type="button"
                          onClick={() => onSubmitSignedBuy(buy)}
                          disabled={submitConfirmation.trim().toUpperCase() !== 'SUBMIT' || submitting}
                          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-2xl border border-[#FF5C7A]/26 bg-[#FF5C7A]/13 px-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#FFB0BF] transition hover:bg-[#FF5C7A]/18 disabled:opacity-45"
                        >
                          {submitting ? 'Submitting...' : 'Submit signed buy'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSignBuy(buy)}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-2xl border border-[#FFD166]/24 bg-[#FFD166]/12 px-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#FFE08A] transition hover:bg-[#FFD166]/18"
                  >
                    Sign buy payload
                  </button>
                )}
              </div>
            ) : null}
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

function base64ToBytes(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function makePumpfunMetadataPreviewUrl(input: {
  name: string;
  symbol: string;
  description?: string;
  imagePrompt?: string;
  hash?: string | null;
}) {
  const params = new URLSearchParams({
    name: input.name,
    symbol: input.symbol,
    description: input.description || '',
    imagePrompt: input.imagePrompt || '',
    hash: input.hash || '',
  });

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/mythos/pumpfun/metadata-preview?${params.toString()}`;
  }

  return `/api/mythos/pumpfun/metadata-preview?${params.toString()}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

function isTextLikeFile(file: File) {
  const name = file.name.toLowerCase();
  return file.type.startsWith('text/') ||
    /\.(txt|md|csv|json|log|xml|html|css|js|jsx|ts|tsx|py|rs|go|sol|toml|yaml|yml|env)$/i.test(name);
}

async function extractPdfText(file: File) {
  const buffer = await file.arrayBuffer();
  const raw = new TextDecoder('latin1').decode(buffer);
  const fragments = [...raw.matchAll(/\(([^()]{8,400})\)/g)]
    .map(match => match[1])
    .join(' ')
    .replace(/\\[nrtd]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return fragments.slice(0, 16_000);
}

async function readMythosAttachment(file: File): Promise<MythosLabAttachment> {
  const base = {
    id: createId('att'),
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
  };

  if (file.type.startsWith('image/')) {
    return {
      ...base,
      kind: 'image',
      dataUrl: await fileToDataUrl(file),
      note: 'Image attached for visual analysis when the selected model route supports vision.',
    };
  }

  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const text = await extractPdfText(file);
    return {
      ...base,
      kind: 'pdf',
      text,
      note: text
        ? 'PDF text was extracted with a basic browser parser. Verify against the original file for critical use.'
        : 'PDF attached, but no readable text was extracted by the browser parser.',
    };
  }

  if (isTextLikeFile(file)) {
    const text = (await file.text()).slice(0, 20_000);
    return {
      ...base,
      kind: 'text',
      text,
      note: text.length >= 20_000 ? 'Text was truncated to 20,000 characters for safe analysis.' : 'Text extracted in browser.',
    };
  }

  return {
    ...base,
    kind: 'other',
    note: 'File metadata attached. This type is not readable yet; convert to text, image, or PDF for deeper analysis.',
  };
}

function formatAttachmentContext(attachments: MythosLabAttachment[]) {
  if (!attachments.length) return '';

  return [
    'Attached file context:',
    ...attachments.map((attachment, index) => [
      `File ${index + 1}: ${attachment.name}`,
      `Type: ${attachment.type}`,
      `Kind: ${attachment.kind}`,
      `Size: ${attachment.size} bytes`,
      attachment.note ? `Note: ${attachment.note}` : '',
      attachment.text ? `Extracted text:\n${attachment.text}` : '',
      attachment.kind === 'image' ? 'Image data was attached for multimodal routes; if this model cannot see images, say that clearly.' : '',
    ].filter(Boolean).join('\n')),
  ].join('\n\n');
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export default function MythosLabConsole() {
  const profile = MYTHOS_AGENT_PROFILE;
  const { connection } = useConnection();
  const { publicKey, connected, disconnect, wallet, wallets, select, connect, connecting, signTransaction } = useWallet();
  const [sessions, setSessions] = useState<MythosLabSession[]>([]);
  const [activeId, setActiveId] = useState('');
  const [input, setInput] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<MythosLabAttachment[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [pendingSaveMessageId, setPendingSaveMessageId] = useState('');
  const [savingMemoryId, setSavingMemoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [pendingWalletName, setPendingWalletName] = useState<WalletName | null>(null);
  const [walletConnectError, setWalletConnectError] = useState('');
  const [proAccessOpen, setProAccessOpen] = useState(false);
  const [pendingProModelId, setPendingProModelId] = useState('');
  const [proAccessUser, setProAccessUser] = useState('');
  const [proAccessPassword, setProAccessPassword] = useState('');
  const [proAccessUnlocked, setProAccessUnlocked] = useState(false);
  const [proAccessLoading, setProAccessLoading] = useState(false);
  const [proAccessError, setProAccessError] = useState('');
  const [pumpfunMintSecrets, setPumpfunMintSecrets] = useState<Record<string, number[]>>({});
  const [pumpfunSignedPayloads, setPumpfunSignedPayloads] = useState<Record<string, MythosPumpfunSignedPayload>>({});
  const [pumpfunSubmitConfirmations, setPumpfunSubmitConfirmations] = useState<Record<string, string>>({});
  const [pumpfunSubmittedPayloads, setPumpfunSubmittedPayloads] = useState<Record<string, MythosPumpfunSubmittedPayload>>({});
  const [pumpfunSubmittingIds, setPumpfunSubmittingIds] = useState<Record<string, boolean>>({});
  const [pumpfunBuySpendSol, setPumpfunBuySpendSol] = useState<Record<string, string>>({});

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

  useEffect(() => {
    if (!pendingWalletName || !wallet || wallet.adapter.name !== pendingWalletName || connected) return;
    let cancelled = false;

    async function finishWalletConnection() {
      try {
        await Promise.race([
          connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('wallet_timeout')), 15_000)),
        ]);
        if (!cancelled) {
          setWalletMenuOpen(false);
          setWalletConnectError('');
          setNotice(`${pendingWalletName} connected to Mythos Lab. No transaction was signed or submitted.`);
        }
      } catch (error) {
        if (!cancelled) {
          setWalletConnectError(
            error instanceof Error && error.message === 'wallet_timeout'
              ? `${pendingWalletName} opened but did not finish connecting. Unlock the wallet and approve the connection.`
              : `${pendingWalletName} did not respond. Check that the extension is installed and unlocked.`
          );
        }
      } finally {
        if (!cancelled) {
          setConnectingWallet(null);
          setPendingWalletName(null);
        }
      }
    }

    void finishWalletConnection();

    return () => {
      cancelled = true;
    };
  }, [connect, connected, pendingWalletName, wallet]);

  useEffect(() => {
    if (!connected || !pendingWalletName) return;
    setWalletMenuOpen(false);
    setWalletConnectError('');
    setConnectingWallet(null);
    setPendingWalletName(null);
  }, [connected, pendingWalletName]);

  useEffect(() => {
    if (!connectedAddress) return;
    setSessions(current => current.map(session => ({
      ...session,
      messages: session.messages.map(message => message.memecoinDraft
        ? {
          ...message,
          memecoinDraft: updateMemecoinDraftWallet(message.memecoinDraft, connectedAddress),
        }
        : message),
    })));
  }, [connectedAddress]);

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
    setPendingAttachments([]);
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
    setPendingAttachments([]);
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
      setPendingWalletName(null);
      setConnectingWallet(null);
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
      const walletName = candidate.adapter.name as WalletName;
      setPendingWalletName(walletName);
      select(walletName);
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
      if (!pendingWalletName) setConnectingWallet(null);
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

  async function preparePumpfunLaunchProposal(draft: MythosMemecoinDraft) {
    const started = Date.now();
    try {
      const response = await fetch('/api/mythos/pumpfun/launch-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          symbol: draft.symbol,
          description: draft.description,
          imagePrompt: draft.imagePrompt,
          initialBuySol: draft.initialBuySol,
          walletAddress: draft.walletAddress,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.proposal) {
        throw new Error(data?.error || 'Could not prepare Pump.fun launch proposal.');
      }

      const proposal = data.proposal as MythosPumpfunLaunchProposal;
      const assistantMessage: MythosLabMessage = {
        id: createId('msg'),
        role: 'assistant',
        createdAt: nowIso(),
        content: formatPumpfunProposalResponse(proposal),
        memecoinProposal: proposal,
      };

      updateActive(session => ({
        ...session,
        messages: [...session.messages, assistantMessage],
        lastTrace: {
          perception: `Pump.fun proposal prepared for ${proposal.token.name} (${proposal.token.symbol}).`,
          memoryContext: 'The proposal uses only visible draft fields and the connected public wallet address.',
          selectedSkill: 'Mythos Memecoin Studio - Pump.fun proposal',
          reasoningPath: 'Mythos validated token identity, metadata, wallet readiness, first-buy intent, and blocked execution boundaries.',
          prediction: 'A future phase can prepare metadata upload rules, then an unsigned transaction payload, while preserving explicit wallet signature.',
          decision: `Return proposal ${proposal.id} with status ${proposal.status} and no unsigned transaction.`,
          confidence: proposal.status === 'blocked' ? 68 : proposal.status === 'needs_review' ? 78 : 86,
          safetyBoundary: 'No metadata upload, no mint, no transaction payload, no wallet signature, no buy, no submission.',
          nextHumanStep: 'Fix any review or blocked gates, then decide whether this proposal should become CongChain memory.',
        },
        lastObservability: {
          model: session.model,
          modelLabel: 'Mythos Pump.fun proposal engine',
          latencyMs: Date.now() - started,
          mode: session.mode,
          traceSchema: 'mythos-pumpfun-launch-proposal/v1',
        },
        updatedAt: nowIso(),
      }));
      setNotice(`Pump.fun proposal prepared: ${proposal.id}. No token, upload, signature, buy, or submission occurred.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not prepare Pump.fun launch proposal.');
    }
  }

  async function preparePumpfunMetadataReview(proposal: MythosPumpfunLaunchProposal) {
    const started = Date.now();
    try {
      const response = await fetch('/api/mythos/pumpfun/metadata-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: proposal.id,
          name: proposal.token.name,
          symbol: proposal.token.symbol,
          description: proposal.token.description,
          imagePrompt: proposal.token.imagePrompt,
          walletAddress: proposal.wallet.address,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.metadataReview) {
        throw new Error(data?.error || 'Could not prepare Pump.fun metadata review.');
      }

      const metadataReview = data.metadataReview as MythosPumpfunMetadataReview;
      const assistantMessage: MythosLabMessage = {
        id: createId('msg'),
        role: 'assistant',
        createdAt: nowIso(),
        content: formatPumpfunMetadataReviewResponse(metadataReview),
        memecoinMetadataReview: metadataReview,
      };

      updateActive(session => ({
        ...session,
        messages: [...session.messages, assistantMessage],
        lastTrace: {
          perception: `Metadata review prepared for ${metadataReview.token.name} (${metadataReview.token.symbol}).`,
          memoryContext: 'The metadata packet is hash-addressable and uses only visible launch proposal fields.',
          selectedSkill: 'Mythos Memecoin Studio - metadata review',
          reasoningPath: 'Mythos checked proposal linkage, token identity, description quality, visual prompt, wallet readiness, and upload boundary.',
          prediction: 'A future upload step can show the exact JSON and storage target before any upload action.',
          decision: `Return metadata review ${metadataReview.id} with status ${metadataReview.status}; keep upload blocked.`,
          confidence: metadataReview.status === 'blocked' ? 66 : metadataReview.status === 'needs_review' ? 78 : 88,
          safetyBoundary: 'No image upload, no JSON upload, no IPFS/Arweave/Pump.fun call, no signature, no buy, no submission.',
          nextHumanStep: 'Review metadata text and visual identity. Then prepare unsigned transaction preview only as an instruction plan.',
        },
        lastObservability: {
          model: session.model,
          modelLabel: 'Mythos Pump.fun metadata review engine',
          latencyMs: Date.now() - started,
          mode: session.mode,
          traceSchema: 'mythos-pumpfun-metadata-review/v1',
        },
        updatedAt: nowIso(),
      }));
      setNotice(`Metadata review prepared: ${metadataReview.id}. No metadata upload occurred.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not prepare Pump.fun metadata review.');
    }
  }

  async function preparePumpfunUnsignedPreview(metadataReview: MythosPumpfunMetadataReview) {
    const started = Date.now();
    try {
      const relatedProposal = activeSession.messages
        .map(message => message.memecoinProposal)
        .find(proposal => proposal?.id === metadataReview.proposalId);
      const response = await fetch('/api/mythos/pumpfun/unsigned-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: metadataReview.proposalId,
          metadataReviewId: metadataReview.id,
          metadataHash: metadataReview.metadataHash,
          name: metadataReview.token.name,
          symbol: metadataReview.token.symbol,
          walletAddress: metadataReview.wallet.address,
          initialBuySol: relatedProposal?.firstBuy.amountSol || 0,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.unsignedPreview) {
        throw new Error(data?.error || 'Could not prepare Pump.fun unsigned preview.');
      }

      const unsignedPreview = data.unsignedPreview as MythosPumpfunUnsignedPreview;
      const assistantMessage: MythosLabMessage = {
        id: createId('msg'),
        role: 'assistant',
        createdAt: nowIso(),
        content: formatPumpfunUnsignedPreviewResponse(unsignedPreview),
        memecoinUnsignedPreview: unsignedPreview,
      };

      updateActive(session => ({
        ...session,
        messages: [...session.messages, assistantMessage],
        lastTrace: {
          perception: `Unsigned transaction preview prepared for ${unsignedPreview.token.name} (${unsignedPreview.token.symbol}).`,
          memoryContext: 'The preview links proposal, metadata review, wallet signer, and first-buy intent without creating a wire payload.',
          selectedSkill: 'Mythos Memecoin Studio - unsigned preview',
          reasoningPath: 'Mythos checked proposal ID, metadata review hash, signer wallet, first-buy intent, signature boundary, and submission boundary.',
          prediction: 'The next safe implementation can construct a real unsigned Pump.fun payload only after payload format, fee quote, metadata URI, and wallet UX are audited.',
          decision: `Return unsigned preview ${unsignedPreview.id}; keep serialized transaction null.`,
          confidence: unsignedPreview.status === 'blocked' ? 64 : unsignedPreview.status === 'needs_review' ? 78 : 86,
          safetyBoundary: 'No serialized transaction, no wallet signature modal, no signed payload, no Solana submission, no token buy.',
          nextHumanStep: 'Audit Pump.fun payload construction before enabling any real unsigned transaction serialization.',
        },
        lastObservability: {
          model: session.model,
          modelLabel: 'Mythos Pump.fun unsigned preview engine',
          latencyMs: Date.now() - started,
          mode: session.mode,
          traceSchema: 'mythos-pumpfun-unsigned-preview/v1',
        },
        updatedAt: nowIso(),
      }));
      setNotice(`Unsigned preview prepared: ${unsignedPreview.id}. No wallet signature or transaction payload was created.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not prepare Pump.fun unsigned preview.');
    }
  }

  async function auditPumpfunPayload(
    preview: MythosPumpfunUnsignedPreview,
    options: { metadataUri: string; slippageBps: number; priorityFeeLamports: number }
  ) {
    const started = Date.now();
    try {
      const response = await fetch('/api/mythos/pumpfun/payload-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unsignedPreviewId: preview.id,
          proposalId: preview.proposalId,
          metadataReviewId: preview.metadataReviewId,
          metadataHash: preview.token.metadataHash,
          metadataUri: options.metadataUri,
          name: preview.token.name,
          symbol: preview.token.symbol,
          walletAddress: preview.signer.walletAddress,
          firstBuySol: preview.firstBuy.amountSol,
          slippageBps: options.slippageBps,
          priorityFeeLamports: options.priorityFeeLamports,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.payloadAudit) {
        throw new Error(data?.error || 'Could not audit Pump.fun payload readiness.');
      }

      const payloadAudit = data.payloadAudit as MythosPumpfunPayloadAudit;
      const assistantMessage: MythosLabMessage = {
        id: createId('msg'),
        role: 'assistant',
        createdAt: nowIso(),
        content: formatPumpfunPayloadAuditResponse(payloadAudit),
        memecoinPayloadAudit: payloadAudit,
      };

      updateActive(session => ({
        ...session,
        messages: [...session.messages, assistantMessage],
        lastTrace: {
          perception: `Pump.fun payload audit prepared for ${payloadAudit.token.name} (${payloadAudit.token.symbol}).`,
          memoryContext: 'The audit links metadata URI, signer, slippage, priority fee, proposal, and unsigned preview without creating transaction bytes.',
          selectedSkill: 'Mythos Memecoin Studio - payload audit',
          reasoningPath: 'Mythos checked metadata URI shape, signer wallet, slippage, priority fee, program payload boundary, wallet signature boundary, and submission boundary.',
          prediction: 'A future payload builder can serialize transaction bytes only after Pump.fun SDK/program account requirements are audited.',
          decision: `Return payload audit ${payloadAudit.id}; keep serialized payload null.`,
          confidence: payloadAudit.status === 'blocked' ? 62 : payloadAudit.status === 'needs_review' ? 78 : 88,
          safetyBoundary: 'No Pump.fun API/SDK call, no account metas, no instruction bytes, no unsigned transaction payload, no signature, no submission, no fund movement.',
          nextHumanStep: 'Audit official Pump.fun payload construction and fee quote before enabling transaction serialization.',
        },
        lastObservability: {
          model: session.model,
          modelLabel: 'Mythos Pump.fun payload audit engine',
          latencyMs: Date.now() - started,
          mode: session.mode,
          traceSchema: 'mythos-pumpfun-payload-audit/v1',
        },
        updatedAt: nowIso(),
      }));
      setNotice(`Pump.fun payload audit prepared: ${payloadAudit.id}. No transaction bytes, signature, or submission were created.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not audit Pump.fun payload readiness.');
    }
  }

  async function preparePumpfunUnsignedBuilder(audit: MythosPumpfunPayloadAudit) {
    const started = Date.now();
    try {
      const { Keypair } = await import('@solana/web3.js');
      const mintKeypair = Keypair.generate();
      const mintPublicKey = mintKeypair.publicKey.toBase58();
      const response = await fetch('/api/mythos/pumpfun/unsigned-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payloadAuditId: audit.id,
          payloadHash: audit.payloadHash,
          metadataUri: audit.token.metadataUri,
          name: audit.token.name,
          symbol: audit.token.symbol,
          walletAddress: audit.signer.walletAddress,
          mintPublicKey,
          firstBuySol: 0,
          slippageBps: audit.economics.slippageBps,
          priorityFeeLamports: audit.economics.priorityFeeLamports,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.unsignedBuilder) {
        throw new Error(data?.error || 'Could not prepare Pump.fun unsigned builder gate.');
      }

      const unsignedBuilder = data.unsignedBuilder as MythosPumpfunUnsignedBuilder;
      if (unsignedBuilder.transaction.wireReady) {
        setPumpfunMintSecrets(current => ({
          ...current,
          [unsignedBuilder.id]: Array.from(mintKeypair.secretKey),
        }));
      }
      if (audit.economics.firstBuySol > 0) {
        setPumpfunBuySpendSol(current => ({
          ...current,
          [unsignedBuilder.id]: String(audit.economics.firstBuySol),
        }));
      }
      const assistantMessage: MythosLabMessage = {
        id: createId('msg'),
        role: 'assistant',
        createdAt: nowIso(),
        content: formatPumpfunUnsignedBuilderResponse(unsignedBuilder),
        memecoinUnsignedBuilder: unsignedBuilder,
      };

      updateActive(session => ({
        ...session,
        messages: [...session.messages, assistantMessage],
        lastTrace: {
          perception: `Unsigned builder gate prepared for ${unsignedBuilder.token.name} (${unsignedBuilder.token.symbol}).`,
          memoryContext: 'The gate records payload hash, metadata URI, signer, locally generated mint public key, fee/slippage intent, and Pump.fun account requirements. Create bytes are create-only; first buy is separated.',
          selectedSkill: 'Mythos Memecoin Studio - unsigned builder gate',
          reasoningPath: 'Mythos refused third-party builders, refused guessed Program IDs, and required official account schema plus fee/rent quote before bytes.',
          prediction: 'Once wallet signing UX is reviewed, this unsigned create payload can become the handoff point for explicit mint + wallet signatures.',
          decision: `Return builder gate ${unsignedBuilder.id}; wireReady=${unsignedBuilder.transaction.wireReady}.`,
          confidence: unsignedBuilder.status === 'blocked' ? 74 : unsignedBuilder.status === 'needs_review' ? 84 : 92,
          safetyBoundary: 'No Pump.fun third-party builder call, no server-side mint secret, no wallet signature, no signed payload, no submission, no fund movement.',
          nextHumanStep: 'Review the unsigned payload, then build a separate explicit wallet-signing handoff.',
        },
        lastObservability: {
          model: session.model,
          modelLabel: 'Mythos Pump.fun unsigned builder gate',
          latencyMs: Date.now() - started,
          mode: session.mode,
          traceSchema: 'mythos-pumpfun-unsigned-builder-gate/v1',
        },
        updatedAt: nowIso(),
      }));
      setNotice(unsignedBuilder.transaction.wireReady
        ? `Unsigned Pump.fun create-only payload prepared: ${unsignedBuilder.id}. Initial buy is queued for the separate buy phase; no signature or submission occurred.`
        : `Unsigned builder gate prepared: ${unsignedBuilder.id}. Real transaction bytes remain blocked until official audit gates are ready.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not prepare Pump.fun unsigned builder gate.');
    }
  }

  async function simplePumpfunLaunch(draft: MythosMemecoinDraft) {
    const started = Date.now();
    try {
      if (!draft.walletReady || !draft.walletAddress) {
        throw new Error('Connect Phantom or Solflare before Mythos prepares the Pump.fun launch.');
      }
      if (!draft.initialBuySol || draft.initialBuySol <= 0) {
        throw new Error('Choose the initial buy amount before launching. Mythos will not choose that value for you.');
      }

      setNotice('Mythos is generating the memecoin launch package...');

      const proposalResponse = await fetch('/api/mythos/pumpfun/launch-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          symbol: draft.symbol,
          description: draft.description,
          imagePrompt: draft.imagePrompt,
          initialBuySol: draft.initialBuySol,
          walletAddress: draft.walletAddress,
        }),
      });
      const proposalData = await proposalResponse.json();
      if (!proposalResponse.ok || !proposalData?.proposal) {
        throw new Error(proposalData?.error || 'Could not prepare Pump.fun proposal.');
      }
      const proposal = proposalData.proposal as MythosPumpfunLaunchProposal;

      const metadataResponse = await fetch('/api/mythos/pumpfun/metadata-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: proposal.id,
          name: proposal.token.name,
          symbol: proposal.token.symbol,
          description: proposal.token.description,
          imagePrompt: proposal.token.imagePrompt,
          walletAddress: proposal.wallet.address,
        }),
      });
      const metadataData = await metadataResponse.json();
      if (!metadataResponse.ok || !metadataData?.metadataReview) {
        throw new Error(metadataData?.error || 'Could not prepare metadata review.');
      }
      const metadataReview = metadataData.metadataReview as MythosPumpfunMetadataReview;

      const previewResponse = await fetch('/api/mythos/pumpfun/unsigned-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: metadataReview.proposalId,
          metadataReviewId: metadataReview.id,
          metadataHash: metadataReview.metadataHash,
          name: metadataReview.token.name,
          symbol: metadataReview.token.symbol,
          walletAddress: metadataReview.wallet.address,
          initialBuySol: proposal.firstBuy.amountSol,
        }),
      });
      const previewData = await previewResponse.json();
      if (!previewResponse.ok || !previewData?.unsignedPreview) {
        throw new Error(previewData?.error || 'Could not prepare unsigned preview.');
      }
      const preview = previewData.unsignedPreview as MythosPumpfunUnsignedPreview;
      const metadataUri = makePumpfunMetadataPreviewUrl({
        name: proposal.token.name,
        symbol: proposal.token.symbol,
        description: proposal.token.description,
        imagePrompt: proposal.token.imagePrompt,
        hash: metadataReview.metadataHash,
      });

      const auditResponse = await fetch('/api/mythos/pumpfun/payload-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unsignedPreviewId: preview.id,
          proposalId: preview.proposalId,
          metadataReviewId: preview.metadataReviewId,
          metadataHash: preview.token.metadataHash,
          metadataUri,
          name: preview.token.name,
          symbol: preview.token.symbol,
          walletAddress: preview.signer.walletAddress,
          firstBuySol: preview.firstBuy.amountSol,
          slippageBps: 500,
          priorityFeeLamports: 0,
        }),
      });
      const auditData = await auditResponse.json();
      if (!auditResponse.ok || !auditData?.payloadAudit) {
        throw new Error(auditData?.error || 'Could not audit Pump.fun payload.');
      }
      const payloadAudit = auditData.payloadAudit as MythosPumpfunPayloadAudit;

      const { Keypair } = await import('@solana/web3.js');
      const mintKeypair = Keypair.generate();
      const mintPublicKey = mintKeypair.publicKey.toBase58();
      const builderResponse = await fetch('/api/mythos/pumpfun/unsigned-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payloadAuditId: payloadAudit.id,
          payloadHash: payloadAudit.payloadHash,
          metadataUri: payloadAudit.token.metadataUri,
          name: payloadAudit.token.name,
          symbol: payloadAudit.token.symbol,
          walletAddress: payloadAudit.signer.walletAddress,
          mintPublicKey,
          firstBuySol: 0,
          slippageBps: payloadAudit.economics.slippageBps,
          priorityFeeLamports: payloadAudit.economics.priorityFeeLamports,
        }),
      });
      const builderData = await builderResponse.json();
      if (!builderResponse.ok || !builderData?.unsignedBuilder) {
        throw new Error(builderData?.error || 'Could not prepare Pump.fun builder.');
      }
      const unsignedBuilder = builderData.unsignedBuilder as MythosPumpfunUnsignedBuilder;

      if (unsignedBuilder.transaction.wireReady) {
        setPumpfunMintSecrets(current => ({
          ...current,
          [unsignedBuilder.id]: Array.from(mintKeypair.secretKey),
        }));
      }
      setPumpfunBuySpendSol(current => ({
        ...current,
        [unsignedBuilder.id]: String(draft.initialBuySol),
      }));

      const assistantMessage: MythosLabMessage = {
        id: createId('msg'),
        role: 'assistant',
        createdAt: nowIso(),
        content: cleanTerminalText([
          terminalSection('Intent', `Simple Pump.fun launch package for ${unsignedBuilder.token.name} (${unsignedBuilder.token.symbol}).`),
          terminalSection('Decision', unsignedBuilder.transaction.wireReady
            ? 'Create-only transaction is ready for Phantom/Solflare signature. Initial buy is queued for the next separate buy quote after create submit.'
            : 'Launch package was generated, but one or more builder gates still block transaction bytes.'),
          terminalSection('User-controlled fields', [
            `Name: ${draft.name}`,
            `Ticker: ${draft.symbol}`,
            `Initial buy: ${draft.initialBuySol} SOL`,
            `Wallet: ${draft.walletAddress}`,
          ]),
          terminalSection('Safety boundary', [
            'Mythos generated and prepared the launch package.',
            'Mythos did not sign.',
            'Mythos did not submit.',
            'Mythos did not buy.',
            'Only Phantom/Solflare approval can continue.',
          ]),
        ].join('\n\n')),
        memecoinUnsignedBuilder: unsignedBuilder,
      };

      updateActive(session => ({
        ...session,
        messages: [...session.messages, assistantMessage],
        lastTrace: {
          perception: `User requested simple Pump.fun launch for ${draft.name} (${draft.symbol}).`,
          memoryContext: 'Mythos used the visible user-edited draft, connected wallet address, and user-selected initial buy amount.',
          selectedSkill: 'Mythos Memecoin Studio - simple launch copilot',
          reasoningPath: 'Mythos prepared proposal, metadata review, unsigned preview, payload audit, and create-only builder behind one user action.',
          prediction: 'The next user-visible step is wallet signature if the builder is wire-ready; otherwise the blocking gates explain what remains.',
          decision: `Return final create builder ${unsignedBuilder.id}; wireReady=${unsignedBuilder.transaction.wireReady}.`,
          confidence: unsignedBuilder.transaction.wireReady ? 91 : 76,
          safetyBoundary: 'No automatic signature, no submit, no buy, no hidden fund movement.',
          nextHumanStep: unsignedBuilder.transaction.wireReady
            ? 'Review the final card and sign in Phantom/Solflare only if intentional.'
            : 'Review the visible blocking gates before retrying.',
        },
        lastObservability: {
          model: session.model,
          modelLabel: 'Mythos Pump.fun simple launch',
          latencyMs: Date.now() - started,
          mode: session.mode,
          traceSchema: 'mythos-pumpfun-simple-launch/v1',
        },
        updatedAt: nowIso(),
      }));
      setNotice(unsignedBuilder.transaction.wireReady
        ? 'Launch package ready. Review the final card and sign create in Phantom/Solflare if you want to continue.'
        : 'Launch package generated, but the final card shows the blocking gates.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not generate Pump.fun launch package.');
    }
  }

  async function signPumpfunCreatePayload(builder: MythosPumpfunUnsignedBuilder) {
    try {
      if (!builder.transaction.wireReady || !builder.transaction.serializedUnsignedPayload) {
        throw new Error('Unsigned Pump.fun create payload is not wire-ready.');
      }
      if (!connected || !publicKey || !signTransaction) {
        throw new Error('Connect Phantom or Solflare before signing the reviewed create payload.');
      }
      const mintSecret = pumpfunMintSecrets[builder.id];
      if (!mintSecret) {
        throw new Error('Mint keypair is not available in browser memory. Prepare the unsigned builder gate again.');
      }

      const { Keypair, VersionedTransaction } = await import('@solana/web3.js');
      const transaction = VersionedTransaction.deserialize(base64ToBytes(builder.transaction.serializedUnsignedPayload));
      const mintKeypair = Keypair.fromSecretKey(Uint8Array.from(mintSecret));
      transaction.sign([mintKeypair]);
      const walletSigned = await signTransaction(transaction);
      const signedBytes = walletSigned.serialize();
      const signedTransactionHash = await sha256Hex(signedBytes);

      setPumpfunSignedPayloads(current => ({
        ...current,
        [builder.id]: {
          signedAt: nowIso(),
          signedTransactionBase64: bytesToBase64(signedBytes),
          signedTransactionHash,
          signerCount: walletSigned.signatures.length,
          storedInBrowserMemory: true,
          submittedToSolana: false,
        },
      }));
      setNotice(`Pump.fun create payload signed in browser memory: ${signedTransactionHash.slice(0, 12)}... No transaction was submitted.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not sign Pump.fun create payload.');
    }
  }

  async function submitPumpfunSignedCreate(builder: MythosPumpfunUnsignedBuilder) {
    const confirmation = pumpfunSubmitConfirmations[builder.id]?.trim().toUpperCase();
    try {
      if (confirmation !== 'SUBMIT') {
        throw new Error('Type SUBMIT before sending the signed Pump.fun create transaction.');
      }
      const signedPayload = pumpfunSignedPayloads[builder.id];
      if (!signedPayload?.signedTransactionBase64) {
        throw new Error('Signed transaction is not available in browser memory.');
      }
      setPumpfunSubmittingIds(current => ({ ...current, [builder.id]: true }));
      const raw = base64ToBytes(signedPayload.signedTransactionBase64);
      const signature = await connection.sendRawTransaction(raw, {
        skipPreflight: false,
        maxRetries: 3,
      });

      let confirmed = false;
      try {
        const latest = await connection.getLatestBlockhash('confirmed');
        const result = await connection.confirmTransaction({
          signature,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        }, 'confirmed');
        confirmed = !result.value.err;
      } catch {
        confirmed = false;
      }

      setPumpfunSubmittedPayloads(current => ({
        ...current,
        [builder.id]: {
          submittedAt: nowIso(),
          signature,
          confirmed,
          submittedFromBrowser: true,
        },
      }));
      setNotice(`Pump.fun create transaction submitted from browser: ${signature}. Confirmation: ${confirmed ? 'confirmed' : 'pending'}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not submit Pump.fun create transaction.');
    } finally {
      setPumpfunSubmittingIds(current => ({ ...current, [builder.id]: false }));
    }
  }

  async function preparePumpfunBuyBuilder(builder: MythosPumpfunUnsignedBuilder, submitted: MythosPumpfunSubmittedPayload) {
    const started = Date.now();
    try {
      const spendSol = Number((pumpfunBuySpendSol[builder.id] || '0.01').replace(',', '.'));
      const mint = builder.programAudit.bondingCurve ? builder.transaction.requiredSigners?.[1] : null;
      const response = await fetch('/api/mythos/pumpfun/buy-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createBuilderId: builder.id,
          createSignature: submitted.signature,
          mint: mint || builder.transaction.requiredSigners?.[1],
          walletAddress: builder.signer.walletAddress,
          spendSol,
          slippageBps: builder.economics.slippageBps,
          priorityFeeLamports: builder.economics.priorityFeeLamports,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.buyBuilder) {
        throw new Error(data?.error || 'Could not prepare Pump.fun buy builder.');
      }
      const buyBuilder = data.buyBuilder as MythosPumpfunBuyBuilder;
      const assistantMessage: MythosLabMessage = {
        id: createId('msg'),
        role: 'assistant',
        createdAt: nowIso(),
        content: `Pump.fun buy builder ${buyBuilder.id} prepared.\nStatus: ${buyBuilder.status}\nWire ready: ${buyBuilder.transaction.wireReady ? 'yes' : 'no'}\nSpend lamports: ${buyBuilder.quote.spendLamports || 'not quoted'}\nMin tokens out: ${buyBuilder.quote.minTokensOut || 'not quoted'}\nSubmitted to Solana: false`,
        memecoinBuyBuilder: buyBuilder,
      };
      updateActive(session => ({
        ...session,
        messages: [...session.messages, assistantMessage],
        lastTrace: {
          perception: `Pump.fun buy builder prepared for mint ${buyBuilder.mint || 'unknown'}.`,
          memoryContext: 'Buy is separate from create and uses the submitted create signature plus current bonding curve quote.',
          selectedSkill: 'Mythos Memecoin Studio - buy builder',
          reasoningPath: 'Mythos required create submission, mint, wallet signer, spend cap, bonding curve quote, unsigned bytes, wallet signature, and separate submit.',
          prediction: 'The user can sign and submit the buy only after reviewing spend, min tokens out, slippage, and quote caveat.',
          decision: `Return buy builder ${buyBuilder.id}; wireReady=${buyBuilder.transaction.wireReady}.`,
          confidence: buyBuilder.status === 'blocked' ? 66 : buyBuilder.status === 'needs_review' ? 82 : 91,
          safetyBoundary: 'No server-side wallet signature, no signed buy stored server-side, no buy submitted automatically.',
          nextHumanStep: 'Review quote, sign buy payload, then use the separate submit gate if intentional.',
        },
        lastObservability: {
          model: session.model,
          modelLabel: 'Mythos Pump.fun buy builder',
          latencyMs: Date.now() - started,
          mode: session.mode,
          traceSchema: 'mythos-pumpfun-buy-builder/v1',
        },
        updatedAt: nowIso(),
      }));
      setNotice(`Pump.fun buy builder prepared: ${buyBuilder.id}. No buy signature or submit occurred.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not prepare Pump.fun buy builder.');
    }
  }

  async function signPumpfunBuyPayload(buy: MythosPumpfunBuyBuilder) {
    try {
      if (!buy.transaction.wireReady || !buy.transaction.serializedUnsignedPayload) {
        throw new Error('Unsigned Pump.fun buy payload is not wire-ready.');
      }
      if (!connected || !publicKey || !signTransaction) {
        throw new Error('Connect Phantom or Solflare before signing the reviewed buy payload.');
      }
      const { VersionedTransaction } = await import('@solana/web3.js');
      const transaction = VersionedTransaction.deserialize(base64ToBytes(buy.transaction.serializedUnsignedPayload));
      const walletSigned = await signTransaction(transaction);
      const signedBytes = walletSigned.serialize();
      const signedTransactionHash = await sha256Hex(signedBytes);
      setPumpfunSignedPayloads(current => ({
        ...current,
        [buy.id]: {
          signedAt: nowIso(),
          signedTransactionBase64: bytesToBase64(signedBytes),
          signedTransactionHash,
          signerCount: walletSigned.signatures.length,
          storedInBrowserMemory: true,
          submittedToSolana: false,
        },
      }));
      setNotice(`Pump.fun buy payload signed in browser memory: ${signedTransactionHash.slice(0, 12)}... No buy was submitted.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not sign Pump.fun buy payload.');
    }
  }

  async function submitPumpfunSignedBuy(buy: MythosPumpfunBuyBuilder) {
    const confirmation = pumpfunSubmitConfirmations[buy.id]?.trim().toUpperCase();
    try {
      if (confirmation !== 'SUBMIT') {
        throw new Error('Type SUBMIT before sending the signed Pump.fun buy transaction.');
      }
      const signedPayload = pumpfunSignedPayloads[buy.id];
      if (!signedPayload?.signedTransactionBase64) {
        throw new Error('Signed buy transaction is not available in browser memory.');
      }
      setPumpfunSubmittingIds(current => ({ ...current, [buy.id]: true }));
      const signature = await connection.sendRawTransaction(base64ToBytes(signedPayload.signedTransactionBase64), {
        skipPreflight: false,
        maxRetries: 3,
      });
      let confirmed = false;
      try {
        const latest = await connection.getLatestBlockhash('confirmed');
        const result = await connection.confirmTransaction({
          signature,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        }, 'confirmed');
        confirmed = !result.value.err;
      } catch {
        confirmed = false;
      }
      setPumpfunSubmittedPayloads(current => ({
        ...current,
        [buy.id]: {
          submittedAt: nowIso(),
          signature,
          confirmed,
          submittedFromBrowser: true,
        },
      }));
      setNotice(`Pump.fun buy transaction submitted from browser: ${signature}. Confirmation: ${confirmed ? 'confirmed' : 'pending'}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not submit Pump.fun buy transaction.');
    } finally {
      setPumpfunSubmittingIds(current => ({ ...current, [buy.id]: false }));
    }
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

  async function attachFiles(files: FileList | null) {
    if (!files?.length) return;

    const incoming = Array.from(files).slice(0, Math.max(0, 4 - pendingAttachments.length));
    if (!incoming.length) {
      setNotice('Mythos aceita ate 4 anexos por mensagem.');
      return;
    }

    try {
      const oversized = incoming.find(file => file.size > 8 * 1024 * 1024);
      if (oversized) {
        setNotice(`${oversized.name} passa de 8 MB. Use um arquivo menor para analise.`);
        return;
      }

      const parsed = await Promise.all(incoming.map(readMythosAttachment));
      setPendingAttachments(current => [...current, ...parsed].slice(0, 4));
      setNotice(`${parsed.length} arquivo(s) anexado(s). Envie a mensagem para o Mythos analisar.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Nao foi possivel ler o arquivo anexado.');
    }
  }

  async function runTerminalCommand(content: string, nextMessages: MythosLabMessage[], started: number) {
    const command = content.trim();
    const lower = command.toLowerCase();

    function appendTerminalResponse(responseContent: string, extra?: {
      trace?: MythosCognitiveTrace;
      observability?: MythosObservability;
      htmlArtifact?: MythosLabMessage['htmlArtifact'];
      solanaAnalysis?: Record<string, unknown>;
      walletIntelligence?: MythosWalletIntelligence;
      walletIntelligenceError?: string;
      memecoinDraft?: MythosMemecoinDraft;
    }) {
      const assistantMessage: MythosLabMessage = {
        id: createId('msg'),
        role: 'assistant',
        createdAt: nowIso(),
        content: cleanTerminalText(responseContent),
        htmlArtifact: extra?.htmlArtifact,
        solanaAnalysis: extra?.solanaAnalysis,
        walletIntelligence: extra?.walletIntelligence,
        walletIntelligenceError: extra?.walletIntelligenceError,
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

    if (isWalletIntelligenceCommand(command)) {
      if (!connectedAddress) {
        appendTerminalResponse([
          terminalSection('Intent', 'Open wallet financial intelligence'),
          terminalSection('Decision', 'Blocked because no Phantom or Solflare wallet is connected.'),
          terminalSection('Next safe step', 'Connect a wallet, then run /wallet intelligence again.'),
          terminalSection('Safety boundary', 'This command is read-only and never signs, submits, buys, sells, or moves funds.'),
        ].join('\n\n'), {
          trace: {
            perception: 'User requested wallet intelligence without a connected wallet.',
            selectedSkill: 'Mythos Wallet Financial Intelligence',
            decision: 'Block until a public wallet address is available.',
            prediction: 'After connection, Mythos can fetch a read-only portfolio snapshot.',
            safetyBoundary: 'No wallet signature or fund movement.',
            nextHumanStep: 'Connect Phantom or Solflare and rerun the command.',
          },
        });
        return;
      }

      const response = await fetch(`/api/mythos/wallet/intelligence?address=${encodeURIComponent(connectedAddress)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data?.intelligence) {
        const error = data?.error || 'Could not load wallet intelligence.';
        appendTerminalResponse([
          terminalSection('Intent', 'Open wallet financial intelligence'),
          terminalSection('Decision', `Provider returned no usable portfolio snapshot: ${error}`),
          terminalSection('Next safe step', 'Check SOLSCAN_API_KEY on Railway or try again later.'),
          terminalSection('Safety boundary', 'No wallet signature or fund movement occurred.'),
        ].join('\n\n'), {
          walletIntelligenceError: error,
        });
        return;
      }

      const intelligence = data.intelligence as MythosWalletIntelligence;
      appendTerminalResponse(formatWalletIntelligenceText(intelligence), {
        walletIntelligence: intelligence,
        trace: {
          perception: `User requested wallet financial intelligence for ${connectedAddress}.`,
          memoryContext: 'Only the connected public wallet address was used. No private key, signature, or hidden wallet data was accessed.',
          selectedSkill: 'Mythos Wallet Financial Intelligence',
          reasoningPath: 'Mythos fetched server-side Solscan/CoinGecko data and rendered only source-backed values or unavailable fields.',
          prediction: 'User can inspect portfolio movement and decide whether to run deeper token or liquidity analysis.',
          decision: 'Return a read-only wallet intelligence card.',
          confidence: intelligence.confidence,
          safetyBoundary: 'Read-only. No signing, transaction creation, submission, buying, selling, or fund movement.',
          nextHumanStep: 'Review the sources and use token-specific analysis before any wallet action.',
        },
        observability: {
          model: activeSession.model,
          modelLabel: 'Solscan + CoinGecko wallet intelligence',
          latencyMs: Date.now() - started,
          mode: activeSession.mode,
          traceSchema: 'mythos-wallet-intelligence/v1',
        },
      });
      return;
    }

    const htmlArtifactPrompt = parseHtmlArtifactPrompt(command);
    if (htmlArtifactPrompt) {
      const prompt = htmlArtifactPrompt;
      if (!prompt) {
        appendTerminalResponse([
          terminalSection('Intent', 'Generate a Mythos HTML artifact'),
          terminalSection('Decision', 'Blocked because no artifact request was provided.'),
          terminalSection('Next safe step', 'Try: /criar html landing page do meu token'),
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
          'Provider API keys stay on the server.',
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
          safetyBoundary: 'Admin-only, server-side model key, sandboxed preview, no execution authority.',
          nextHumanStep: 'Review the preview and copy HTML only if it is safe for productization.',
        },
        observability: {
          model: asString(data.model, 'artifact-provider'),
          modelLabel: `${asString(data.provider, 'provider')} HTML artifact renderer`,
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
    const attachments = prompt ? [] : pendingAttachments;
    const content = (prompt || input).trim() || (attachments.length ? 'Analise os arquivos anexados.' : '');
    if (!content) return;
    const attachmentContext = formatAttachmentContext(attachments);
    const contentForModel = attachmentContext ? `${content}\n\n${attachmentContext}` : content;

    const createdAt = nowIso();
    const userMessage: MythosLabMessage = {
      id: createId('msg'),
      role: 'user',
      content,
      createdAt,
      attachments,
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
    setPendingAttachments([]);
    setLoading(true);
    setNotice('');

    const started = Date.now();
    try {
      if (content.startsWith('/') || isMarketReportRequest(content) || isSolanaEcosystemRequest(content) || isMemecoinLaunchRequest(content)) {
        await runTerminalCommand(content, nextMessages, started);
        return;
      }

      const route = await routeSkillForPrompt(contentForModel);
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
            .map(message => ({
              role: message.role,
              content: message.attachments?.length
                ? `${message.content}\n\n${formatAttachmentContext(message.attachments)}`
                : message.content,
              attachments: message.attachments,
            })),
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
                        {message.attachments?.length ? (
                          <div className="mb-3 grid gap-2 sm:grid-cols-2">
                            {message.attachments.map(attachment => (
                              <div key={attachment.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/28 p-3">
                                {attachment.kind === 'image' && attachment.dataUrl ? (
                                  <img src={attachment.dataUrl} alt={attachment.name} className="mb-3 h-32 w-full rounded-xl object-cover" />
                                ) : null}
                                <p className="truncate text-xs font-black text-white">{attachment.name}</p>
                                <p className="mt-1 text-[11px] text-white/42">{attachment.kind} - {(attachment.size / 1024).toFixed(1)} KB</p>
                                {attachment.note ? <p className="mt-2 text-[11px] leading-4 text-white/45">{attachment.note}</p> : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {message.cryptoReport ? <MythosCryptoReportCard report={message.cryptoReport} /> : null}
                        {message.solanaReport ? <MythosSolanaReportCard report={message.solanaReport} /> : null}
                        {message.solanaAnalysis ? <MythosSolanaAnalysisCard data={message.solanaAnalysis} /> : null}
                        {message.walletIntelligence || message.walletIntelligenceError ? (
                          <MythosWalletIntelligenceCard
                            intelligence={message.walletIntelligence || null}
                            loading={false}
                            error={message.walletIntelligenceError || ''}
                          />
                        ) : null}
                        {message.memecoinDraft ? (
                          <MythosMemecoinDraftCard
                            draft={message.memecoinDraft}
                            onConnectWallet={handleWalletAction}
                            onCopyLaunchBrief={copyMemecoinLaunchBrief}
                            onSimpleLaunch={simplePumpfunLaunch}
                          />
                        ) : null}
                        {message.memecoinProposal ? (
                          <MythosPumpfunProposalCard
                            proposal={message.memecoinProposal}
                            onPrepareMetadataReview={preparePumpfunMetadataReview}
                          />
                        ) : null}
                        {message.memecoinMetadataReview ? (
                          <MythosPumpfunMetadataReviewCard
                            review={message.memecoinMetadataReview}
                            onPrepareUnsignedPreview={preparePumpfunUnsignedPreview}
                          />
                        ) : null}
                        {message.memecoinUnsignedPreview ? (
                          <MythosPumpfunUnsignedPreviewCard
                            preview={message.memecoinUnsignedPreview}
                            defaultMetadataUri={makePumpfunMetadataPreviewUrl({
                              name: message.memecoinUnsignedPreview.token.name,
                              symbol: message.memecoinUnsignedPreview.token.symbol,
                              hash: message.memecoinUnsignedPreview.token.metadataHash,
                            })}
                            onAuditPayload={auditPumpfunPayload}
                          />
                        ) : null}
                        {message.memecoinPayloadAudit ? (
                          <MythosPumpfunPayloadAuditCard
                            audit={message.memecoinPayloadAudit}
                            onPrepareUnsignedBuilder={preparePumpfunUnsignedBuilder}
                          />
                        ) : null}
                        {message.memecoinUnsignedBuilder ? (
                          <MythosPumpfunUnsignedBuilderCard
                            builder={message.memecoinUnsignedBuilder}
                            signedPayload={pumpfunSignedPayloads[message.memecoinUnsignedBuilder.id]}
                            submittedPayload={pumpfunSubmittedPayloads[message.memecoinUnsignedBuilder.id]}
                            buySpendSol={pumpfunBuySpendSol[message.memecoinUnsignedBuilder.id] || '0.01'}
                            submitConfirmation={pumpfunSubmitConfirmations[message.memecoinUnsignedBuilder.id] || ''}
                            submitting={Boolean(pumpfunSubmittingIds[message.memecoinUnsignedBuilder.id])}
                            onSignCreate={signPumpfunCreatePayload}
                            onBuySpendChange={(builderId, value) => setPumpfunBuySpendSol(current => ({ ...current, [builderId]: value }))}
                            onPrepareBuy={preparePumpfunBuyBuilder}
                            onSubmitConfirmationChange={(builderId, value) => setPumpfunSubmitConfirmations(current => ({ ...current, [builderId]: value }))}
                            onSubmitSignedCreate={submitPumpfunSignedCreate}
                          />
                        ) : null}
                        {message.memecoinBuyBuilder ? (
                          <MythosPumpfunBuyBuilderCard
                            buy={message.memecoinBuyBuilder}
                            signedPayload={pumpfunSignedPayloads[message.memecoinBuyBuilder.id]}
                            submittedPayload={pumpfunSubmittedPayloads[message.memecoinBuyBuilder.id]}
                            submitConfirmation={pumpfunSubmitConfirmations[message.memecoinBuyBuilder.id] || ''}
                            submitting={Boolean(pumpfunSubmittingIds[message.memecoinBuyBuilder.id])}
                            onSignBuy={signPumpfunBuyPayload}
                            onSubmitConfirmationChange={(builderId, value) => setPumpfunSubmitConfirmations(current => ({ ...current, [builderId]: value }))}
                            onSubmitSignedBuy={submitPumpfunSignedBuy}
                          />
                        ) : null}
                        {!message.cryptoReport
                          && !message.solanaReport
                          && !message.solanaAnalysis
                          && !message.memecoinDraft
                          && !message.memecoinProposal
                          && !message.memecoinMetadataReview
                          && !message.memecoinUnsignedPreview
                          && !message.memecoinPayloadAudit
                          && !message.memecoinUnsignedBuilder
                          && !message.memecoinBuyBuilder ? (
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
                    {pendingAttachments.length ? (
                      <div className="mb-3 grid gap-2 sm:grid-cols-2">
                        {pendingAttachments.map(attachment => (
                          <div key={attachment.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-2">
                            {attachment.kind === 'image' && attachment.dataUrl ? (
                              <img src={attachment.dataUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#76FF03]/18 bg-[#76FF03]/8">
                                <Paperclip className="h-4 w-4 text-[#A7FF3D]" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-black text-white">{attachment.name}</p>
                              <p className="text-[11px] text-white/42">{attachment.kind} - {(attachment.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPendingAttachments(current => current.filter(item => item.id !== attachment.id))}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
                              aria-label={`Remove ${attachment.name}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
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
                      <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Attach file for analysis">
                        <Paperclip className="h-4 w-4" />
                        <input
                          type="file"
                          multiple
                          accept="image/*,.pdf,.txt,.md,.csv,.json,.log,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.rs,.go,.sol,.toml,.yaml,.yml"
                          className="hidden"
                          onChange={event => {
                            void attachFiles(event.target.files);
                            event.currentTarget.value = '';
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => sendMessage()}
                        disabled={(!input.trim() && pendingAttachments.length === 0) || loading}
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
