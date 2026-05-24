import { callModel } from '@/services/ai';
import { Limits, ValidationError, validateModel } from '@/lib/security';

export type MythosSolanaMode = 'transaction' | 'anchor' | 'rpc';
export type MythosSolanaCluster = 'mainnet' | 'devnet';

type JsonRpcResponse<T> = {
  result?: T;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
};

export type MythosSolanaEvidenceItem = {
  label: string;
  value: string;
  status: 'ready' | 'review' | 'blocked';
};

export type MythosSolanaResult = {
  ok: true;
  mode: MythosSolanaMode;
  cluster: MythosSolanaCluster;
  subject: string;
  analysis: string;
  fallbackUsed: boolean;
  evidence: MythosSolanaEvidenceItem[];
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
    metadata: {
      source: 'mythos';
      contentType: 'mythos_task_result';
      agentId: string;
      agentName: string;
      skillName: string;
      origin: string;
      eventType: string;
      confidenceBps: number;
      importanceBps: number;
      runtime: Record<string, unknown>;
      runtimeEvent: Record<string, unknown>;
      safety: {
        containsSecrets: false;
        containsPrivateKeys: false;
        containsSignedPayloads: false;
        canMoveFunds: false;
        requiresHumanReview: true;
      };
    };
  };
  safety: {
    readOnlyRpc: true;
    storesSecrets: false;
    canMoveFunds: false;
    requiresHumanReview: true;
  };
};

type TransactionResult = {
  slot?: number;
  blockTime?: number | null;
  meta?: {
    err?: unknown;
    fee?: number;
    logMessages?: string[] | null;
    preTokenBalances?: unknown[];
    postTokenBalances?: unknown[];
    computeUnitsConsumed?: number;
  } | null;
  transaction?: {
    signatures?: string[];
    message?: {
      accountKeys?: Array<string | { pubkey?: string; signer?: boolean; writable?: boolean }>;
      instructions?: Array<Record<string, unknown>>;
    };
  };
};

type AccountInfoResult = {
  value?: {
    executable?: boolean;
    lamports?: number;
    owner?: string;
    data?: string[] | { parsed?: unknown; program?: string; space?: number };
  } | null;
};

const BASE58_LONG = /\b[1-9A-HJ-NP-Za-km-z]{32,88}\b/;
const BASE58_PUBKEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const SYSTEM_PROMPT = [
  'You are Mythos, CongChain Solana developer copilot.',
  'Use only the evidence provided by the server. Do not invent RPC facts.',
  'Write in clean English with short labeled sections. Do not use markdown tables.',
  'Explain what failed, why it likely failed, what evidence supports it, and the next safe step.',
  'Never request API keys, private keys, seed phrases, signed payloads, or wallet secrets.',
  'Never claim funds moved, wallet signatures happened, or memory was saved unless explicit evidence says so.',
].join(' ');

function normalizeCluster(value: unknown): MythosSolanaCluster {
  return value === 'devnet' ? 'devnet' : 'mainnet';
}

function cleanInput(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError('Input must be a string.');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError('Input cannot be empty.');
  }
  if (trimmed.length > Limits.MAX_PROMPT_LENGTH) {
    throw new ValidationError('Input is too long.');
  }
  if (/\b(cog_live_[a-f0-9]{16,}|private key|seed phrase|mnemonic|api_key\s*=|secret\s*=)/i.test(trimmed)) {
    throw new ValidationError('Input appears to contain secrets or private credentials.');
  }
  return trimmed;
}

function rpcProviderLabel(cluster: MythosSolanaCluster): 'helius' | 'solana-rpc' {
  if (cluster === 'mainnet' && (process.env.HELIUS_API_KEY || process.env.HELIUS_RPC_URL)) return 'helius';
  if (cluster === 'mainnet' && process.env.SOLANA_RPC_URL?.includes('helius')) return 'helius';
  return 'solana-rpc';
}

function rpcUrl(cluster: MythosSolanaCluster): string {
  if (cluster === 'devnet') {
    return process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com';
  }

  if (process.env.HELIUS_RPC_URL) return process.env.HELIUS_RPC_URL;
  if (process.env.SOLANA_RPC_URL) return process.env.SOLANA_RPC_URL;
  if (process.env.HELIUS_API_KEY) {
    return `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  }
  return 'https://api.mainnet-beta.solana.com';
}

async function jsonRpc<T>(cluster: MythosSolanaCluster, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl(cluster), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'mythos-solana-dev',
      method,
      params,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });

  const data = await response.json() as JsonRpcResponse<T>;
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `RPC ${method} failed`);
  }
  return data.result as T;
}

function value(label: string, input: unknown, status: MythosSolanaEvidenceItem['status'] = 'ready'): MythosSolanaEvidenceItem {
  const rendered = input === undefined || input === null || input === ''
    ? 'not available'
    : String(input);
  return { label, value: rendered, status };
}

function extractFirstBase58(input: string): string | null {
  return input.match(BASE58_LONG)?.[0] || null;
}

function normalizeLogs(logs: string[] | null | undefined): string[] {
  return (logs || []).slice(0, 14).map(line => line.slice(0, 220));
}

function instructionSummary(tx: TransactionResult): string {
  const instructions = tx.transaction?.message?.instructions || [];
  if (!instructions.length) return 'not available';

  return instructions.slice(0, 8).map((instruction, index) => {
    const program = typeof instruction.program === 'string'
      ? instruction.program
      : typeof instruction.programId === 'string'
        ? instruction.programId
        : typeof instruction.programIdIndex === 'number'
          ? `program index ${instruction.programIdIndex}`
          : 'unknown program';
    const type = typeof instruction.parsed === 'object' && instruction.parsed
      ? (instruction.parsed as Record<string, unknown>).type
      : undefined;
    return `${index + 1}. ${program}${type ? `/${String(type)}` : ''}`;
  }).join('; ');
}

function computeHint(logs: string[]): string {
  const joined = logs.join(' ');
  const match = joined.match(/consumed\s+([0-9]+)\s+of\s+([0-9]+)\s+compute units/i);
  if (match) return `${match[1]} of ${match[2]} compute units`;
  return 'not reported';
}

function fallbackAnalysis(input: {
  mode: MythosSolanaMode;
  subject: string;
  evidence: MythosSolanaEvidenceItem[];
  skill: string;
}) {
  const reviewItems = input.evidence.filter(item => item.status !== 'ready');
  const lines = [
    'Perception:',
    `Mythos reviewed the ${input.mode} request using ${input.skill}.`,
    '',
    'Evidence:',
    ...input.evidence.slice(0, 8).map(item => `${item.label}: ${item.value}`),
    '',
    'Decision:',
    reviewItems.length
      ? 'The request needs human review because some evidence was missing or returned a review state.'
      : 'The server collected enough read-only evidence to prepare a safe debugging brief.',
    '',
    'Next step:',
    'Review the evidence, then save the approved summary as CongChain memory if this should become reusable context.',
  ];
  return lines.join('\n');
}

async function modelAnalysis(input: {
  model: string;
  mode: MythosSolanaMode;
  subject: string;
  evidence: MythosSolanaEvidenceItem[];
  skill: string;
}) {
  const evidenceText = input.evidence
    .map(item => `${item.label}: ${item.value} (${item.status})`)
    .join('\n');
  const result = await callModel({
    model: input.model,
    useContext: false,
    agentName: 'Mythos',
    systemPrompt: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        `Mode: ${input.mode}`,
        `Skill: ${input.skill}`,
        `Subject: ${input.subject}`,
        'Evidence:',
        evidenceText,
        '',
        'Return a concise Solana developer analysis with these labels: Perception, Evidence, Likely cause, Decision, Next safe step, CongChain memory note.',
      ].join('\n'),
    }],
  });
  return result;
}

async function buildTransactionEvidence(subject: string, cluster: MythosSolanaCluster) {
  const signature = extractFirstBase58(subject);
  if (!signature) {
    return {
      subject,
      evidence: [
        value('Input type', 'free-text failure report', 'review'),
        value('Signature', 'not found in input', 'review'),
        value('User report', subject.slice(0, 600), 'ready'),
      ],
    };
  }

  const tx = await jsonRpc<TransactionResult | null>(cluster, 'getTransaction', [
    signature,
    { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
  ]);

  if (!tx) {
    return {
      subject: signature,
      evidence: [
        value('Signature', signature),
        value('RPC result', 'transaction not found', 'review'),
        value('Cluster', cluster, 'review'),
      ],
    };
  }

  const logs = normalizeLogs(tx.meta?.logMessages);
  const err = tx.meta?.err ? JSON.stringify(tx.meta.err).slice(0, 300) : 'none';
  const blockTime = tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : 'not available';
  const accounts = tx.transaction?.message?.accountKeys?.length || 0;

  return {
    subject: signature,
    evidence: [
      value('Signature', signature),
      value('Status', tx.meta?.err ? 'failed' : 'success', tx.meta?.err ? 'review' : 'ready'),
      value('Error', err, tx.meta?.err ? 'review' : 'ready'),
      value('Slot', tx.slot),
      value('Block time', blockTime),
      value('Fee lamports', tx.meta?.fee),
      value('Account keys', accounts),
      value('Instructions', instructionSummary(tx)),
      value('Compute units', tx.meta?.computeUnitsConsumed || computeHint(logs)),
      value('Token balance records', `${tx.meta?.preTokenBalances?.length || 0} pre / ${tx.meta?.postTokenBalances?.length || 0} post`),
      value('Log sample', logs.length ? logs.join(' | ') : 'not available', logs.length ? 'ready' : 'review'),
    ],
  };
}

async function buildAnchorEvidence(subject: string, cluster: MythosSolanaCluster) {
  const maybeProgram = extractFirstBase58(subject);
  const evidence: MythosSolanaEvidenceItem[] = [
    value('Input type', maybeProgram ? 'program id or account plus notes' : 'free-text Anchor/debug report'),
    value('Debug report', subject.slice(0, 700)),
  ];

  if (maybeProgram && BASE58_PUBKEY.test(maybeProgram)) {
    try {
      const account = await jsonRpc<AccountInfoResult>(cluster, 'getAccountInfo', [
        maybeProgram,
        { encoding: 'base64', commitment: 'confirmed' },
      ]);
      const info = account.value;
      evidence.unshift(value('Program/account', maybeProgram));
      evidence.push(value('Executable', info?.executable === true ? 'true' : 'false', info?.executable ? 'ready' : 'review'));
      evidence.push(value('Owner', info?.owner || 'not found', info?.owner ? 'ready' : 'review'));
      evidence.push(value('Lamports', info?.lamports ?? 'not found', info ? 'ready' : 'review'));
      evidence.push(value('Data shape', Array.isArray(info?.data) ? 'base64 account data' : 'parsed account data'));
    } catch (error) {
      evidence.push(value('RPC account lookup', error instanceof Error ? error.message : 'failed', 'review'));
    }
  } else {
    evidence.push(value('Program/account', 'not found in input', 'review'));
  }

  return { subject: maybeProgram || subject.slice(0, 120), evidence };
}

async function buildRpcEvidence(subject: string, cluster: MythosSolanaCluster) {
  const evidence: MythosSolanaEvidenceItem[] = [
    value('Issue report', subject.slice(0, 700)),
    value('Cluster', cluster),
  ];

  const checks = await Promise.allSettled([
    jsonRpc<string>(cluster, 'getHealth', []),
    jsonRpc<{ 'solana-core'?: string; 'feature-set'?: number }>(cluster, 'getVersion', []),
    jsonRpc<{ blockHeight?: number; epoch?: number; slotIndex?: number; slotsInEpoch?: number }>(cluster, 'getEpochInfo', []),
    jsonRpc<{ value?: { blockhash?: string; lastValidBlockHeight?: number } }>(cluster, 'getLatestBlockhash', [{ commitment: 'confirmed' }]),
  ]);

  const [health, version, epoch, blockhash] = checks;
  evidence.push(value('RPC health', health.status === 'fulfilled' ? health.value : 'failed', health.status === 'fulfilled' ? 'ready' : 'review'));
  evidence.push(value('Solana version', version.status === 'fulfilled' ? version.value['solana-core'] : 'not available', version.status === 'fulfilled' ? 'ready' : 'review'));
  evidence.push(value('Epoch/height', epoch.status === 'fulfilled' ? `epoch ${epoch.value.epoch}, block height ${epoch.value.blockHeight}` : 'not available', epoch.status === 'fulfilled' ? 'ready' : 'review'));
  evidence.push(value('Latest blockhash', blockhash.status === 'fulfilled' ? `${blockhash.value.value?.blockhash?.slice(0, 16)}..., valid until ${blockhash.value.value?.lastValidBlockHeight}` : 'not available', blockhash.status === 'fulfilled' ? 'ready' : 'review'));

  return { subject: subject.slice(0, 120), evidence };
}

export async function runMythosSolanaEngine(input: {
  mode: MythosSolanaMode;
  cluster?: unknown;
  model?: unknown;
  input: unknown;
}): Promise<MythosSolanaResult> {
  const startedAt = Date.now();
  const mode = input.mode;
  const cluster = normalizeCluster(input.cluster);
  const model = validateModel(input.model || 'nvidia');
  const rawSubject = cleanInput(input.input);
  const skill = mode === 'transaction'
    ? 'solana-tx-inspector'
    : mode === 'anchor'
      ? 'forge-lsp + solana-anchor-schema-validator'
      : 'solana-wallet-ecosystem-bridge';

  const evidenceResult = mode === 'transaction'
    ? await buildTransactionEvidence(rawSubject, cluster)
    : mode === 'anchor'
      ? await buildAnchorEvidence(rawSubject, cluster)
      : await buildRpcEvidence(rawSubject, cluster);

  let analysis = '';
  let modelLabel = model;
  let fallbackUsed = false;

  try {
    const result = await modelAnalysis({
      model,
      mode,
      subject: evidenceResult.subject,
      evidence: evidenceResult.evidence,
      skill,
    });
    analysis = result.content;
    modelLabel = result.modelLabel;
  } catch {
    fallbackUsed = true;
    analysis = fallbackAnalysis({
      mode,
      subject: evidenceResult.subject,
      evidence: evidenceResult.evidence,
      skill,
    });
  }

  const provider = rpcProviderLabel(cluster);
  const timestamp = new Date().toISOString();
  const latencyMs = Date.now() - startedAt;
  const evidenceSummary = evidenceResult.evidence
    .slice(0, 8)
    .map(item => `${item.label}: ${item.value}`)
    .join('\n');

  const content = [
    'Mythos Solana Developer Analysis',
    `Mode: ${mode}`,
    `Cluster: ${cluster}`,
    `Subject: ${evidenceResult.subject}`,
    `Skill: ${skill}`,
    `Provider: ${provider}`,
    `Generated: ${timestamp}`,
    '',
    'Analysis:',
    analysis,
    '',
    'Evidence:',
    evidenceSummary,
    '',
    'Safety: read-only RPC evidence; no wallet signature, no private key, no seed phrase, no signed payload, no fund movement.',
  ].join('\n');

  return {
    ok: true,
    mode,
    cluster,
    subject: evidenceResult.subject,
    analysis,
    fallbackUsed,
    evidence: evidenceResult.evidence,
    cognitiveTrace: {
      perception: `Mythos received a ${mode} request for ${cluster}.`,
      evidenceUsed: `${evidenceResult.evidence.length} server-side evidence items collected through read-only RPC or user-provided logs.`,
      skill,
      decision: evidenceResult.evidence.some(item => item.status === 'blocked')
        ? 'Blocked until unsafe evidence is removed.'
        : evidenceResult.evidence.some(item => item.status === 'review')
          ? 'Prepared a review brief with missing or uncertain evidence clearly labeled.'
          : 'Prepared a ready Solana developer brief from read-only evidence.',
      prediction: 'If saved, another agent can continue from the CongChain memory hash instead of restarting from raw logs.',
      safetyBoundary: 'No signing, no submission, no wallet approval, no private credentials, and no automatic memory write.',
      nextHumanStep: 'Review the analysis, then use Save to CongChain only if this summary should become durable agent memory.',
    },
    observability: {
      provider,
      rpcConfigured: provider === 'helius' || Boolean(process.env.SOLANA_RPC_URL || process.env.SOLANA_DEVNET_RPC_URL),
      model,
      modelLabel,
      latencyMs,
      timestamp,
    },
    memoryDraft: {
      content,
      model: 'mythos',
      metadata: {
        source: 'mythos',
        contentType: 'mythos_task_result',
        agentId: 'mythos-solana-dev',
        agentName: 'Mythos',
        skillName: skill,
        origin: '/mythos/solana',
        eventType: 'solana_developer_analysis',
        confidenceBps: fallbackUsed ? 6800 : 7800,
        importanceBps: 7600,
        runtime: {
          mode,
          cluster,
          provider,
          model,
          modelLabel,
          fallbackUsed,
          latencyMs,
        },
        runtimeEvent: {
          subject: evidenceResult.subject,
          evidenceCount: evidenceResult.evidence.length,
          reviewItems: evidenceResult.evidence.filter(item => item.status === 'review').length,
        },
        safety: {
          containsSecrets: false,
          containsPrivateKeys: false,
          containsSignedPayloads: false,
          canMoveFunds: false,
          requiresHumanReview: true,
        },
      },
    },
    safety: {
      readOnlyRpc: true,
      storesSecrets: false,
      canMoveFunds: false,
      requiresHumanReview: true,
    },
  };
}
