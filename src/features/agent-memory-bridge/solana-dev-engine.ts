import { callModel } from '@/services/ai';
import { Limits, ValidationError, validateModel } from '@/lib/security';

export type MythosSolanaMode = 'transaction' | 'wallet' | 'token' | 'anchor' | 'rpc';
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
  risk: {
    level: 'safe' | 'suspicious' | 'exploit_risk' | 'review';
    score: number;
    confidenceBps: number;
    memoryMatchBps: number;
    summary: string;
    signals: string[];
  };
  chainMonitor: {
    status: 'live' | 'degraded' | 'review';
    cluster: MythosSolanaCluster;
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

type SignatureStatusesResult = {
  value?: Array<{
    slot?: number;
    confirmations?: number | null;
    confirmationStatus?: string;
    err?: unknown;
  } | null>;
};

type ParsedAccountInfoResult = {
  value?: {
    executable?: boolean;
    lamports?: number;
    owner?: string;
    data?: {
      parsed?: {
        type?: string;
        info?: Record<string, unknown>;
      };
      program?: string;
      space?: number;
    } | string[];
  } | null;
};

type TokenSupplyResult = {
  value?: {
    amount?: string;
    decimals?: number;
    uiAmountString?: string;
  };
};

type TokenLargestAccountsResult = {
  value?: Array<{
    address?: string;
    amount?: string;
    decimals?: number;
    uiAmountString?: string;
  }>;
};

type SignaturesForAddressResult = Array<{
  signature: string;
  slot?: number;
  err?: unknown;
  memo?: string | null;
  blockTime?: number | null;
  confirmationStatus?: string;
}>;

type TokenAccountsByOwnerResult = {
  value?: Array<{
    pubkey?: string;
    account?: {
      data?: {
        parsed?: {
          info?: {
            mint?: string;
            tokenAmount?: {
              uiAmountString?: string;
              amount?: string;
              decimals?: number;
            };
          };
        };
      };
    };
  }>;
};

type EpochInfoResult = {
  blockHeight?: number;
  epoch?: number;
  slotIndex?: number;
  slotsInEpoch?: number;
  absoluteSlot?: number;
};

const BASE58_LONG = /\b[1-9A-HJ-NP-Za-km-z]{32,88}\b/;
const BASE58_PUBKEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

const SYSTEM_PROMPT = [
  'You are Mythos, CongChain Solana developer copilot.',
  'Use only the evidence provided by the server. Do not invent RPC facts.',
  'Write in clean English with short labeled sections. Do not use markdown tables.',
  'Explain what failed or looks risky, why it likely happened, what evidence supports it, and the next safe step.',
  'For wallets and tokens, classify risk without giving financial advice.',
  'Never tell the user a token is safe to buy or safe to invest in. Say what evidence is ready, suspicious, missing, or blocked.',
  'For developer failures, include a short patch example when the evidence suggests one.',
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

function knownProgramSummary(tx: TransactionResult): string {
  const text = instructionSummary(tx).toLowerCase();
  const hits = [
    ['jupiter', 'Jupiter'],
    ['raydium', 'Raydium'],
    ['orca', 'Orca'],
    ['meteora', 'Meteora'],
    ['token', 'SPL Token'],
    ['system', 'System Program'],
    ['associated', 'Associated Token'],
    ['compute', 'Compute Budget'],
  ]
    .filter(([needle]) => text.includes(needle))
    .map(([, label]) => label);
  return hits.length ? Array.from(new Set(hits)).join(', ') : 'not classified from parsed instructions';
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

function cleanModelText(value: string): string {
  return value
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/```/g, '')
    .trim();
}

function riskFromEvidence(mode: MythosSolanaMode, evidence: MythosSolanaEvidenceItem[]) {
  const review = evidence.filter(item => item.status === 'review').length;
  const blocked = evidence.filter(item => item.status === 'blocked').length;
  const joined = evidence.map(item => `${item.label} ${item.value}`).join(' ').toLowerCase();
  let score = 18 + review * 12 + blocked * 30;
  const signals: string[] = [];

  if (/failed|error|not found|missing|unknown|invalid|freeze authority active|mint authority active|high concentration|very new/i.test(joined)) {
    score += 18;
    signals.push('Review signal found in RPC evidence.');
  }
  if (/success|err none|freeze authority none|mint authority none|healthy/i.test(joined)) {
    score -= 8;
    signals.push('Some evidence indicates normal execution or reduced authority risk.');
  }
  if (mode === 'token' && /largest holder share ([6-9][0-9]|100)/i.test(joined)) {
    score += 22;
    signals.push('Largest holder concentration is high.');
  }
  if (mode === 'token') {
    const largestHolder = evidence.find(item => item.label.toLowerCase() === 'largest holder share');
    const top10 = evidence.find(item => item.label.toLowerCase() === 'top 10 holder share');
    const largestPct = Number(largestHolder?.value.match(/([0-9]+(?:\.[0-9]+)?)%/)?.[1] || 0);
    const top10Pct = Number(top10?.value.match(/([0-9]+(?:\.[0-9]+)?)%/)?.[1] || 0);

    if (largestPct >= 35) {
      score += 20;
      signals.push(`Largest holder controls ${largestPct.toFixed(2)}% of supply.`);
    } else if (largestPct > 0 && largestPct <= 12) {
      score -= 8;
      signals.push('Largest holder concentration is relatively low from available RPC evidence.');
    }

    if (top10Pct >= 70) {
      score += 18;
      signals.push(`Top 10 holders control ${top10Pct.toFixed(2)}% of supply.`);
    }

    if (/mint authority [1-9a-hj-np-za-km-z]{20,}/i.test(joined)) {
      score += 16;
      signals.push('Mint authority appears active; supply can potentially change.');
    }
    if (/freeze authority [1-9a-hj-np-za-km-z]{20,}/i.test(joined)) {
      score += 16;
      signals.push('Freeze authority appears active; token accounts may be freezeable.');
    }
  }
  if (mode === 'wallet' && /recent failed transactions [1-9]/i.test(joined)) {
    score += 12;
    signals.push('Recent wallet failures were detected.');
  }
  if (mode === 'wallet') {
    const txs = Number(evidence.find(item => item.label.toLowerCase() === 'recent transactions')?.value || 0);
    const tokenAccounts = Number(evidence.find(item => item.label.toLowerCase() === 'token accounts with balance')?.value || 0);
    if (txs <= 2) {
      score += 10;
      signals.push('Wallet has very little recent activity in the sampled RPC window.');
    }
    if (tokenAccounts >= 20) {
      score += 8;
      signals.push('Wallet has broad token exposure that may need manual review.');
    }
  }

  score = Math.max(1, Math.min(99, score));
  const level = blocked > 0 || score >= 78
    ? 'exploit_risk'
    : score >= 52
      ? 'suspicious'
      : review > 0 || score >= 34
        ? 'review'
        : 'safe';

  if (!signals.length) signals.push('No severe risk signal was detected from the available read-only evidence.');

  return {
    level,
    score,
    confidenceBps: Math.max(5200, Math.min(9400, 8700 - review * 700 - blocked * 1200)),
    memoryMatchBps: Math.max(4200, Math.min(9100, 6200 + evidence.length * 180 - review * 220)),
    summary: level === 'safe'
      ? 'Evidence looks normal, but a human should still verify intent and counterparties.'
      : level === 'review'
        ? 'Some evidence is incomplete or needs a human Solana review.'
        : level === 'suspicious'
          ? 'Multiple risk signals deserve investigation before trusting this wallet, token, or transaction. This is not investment advice.'
          : 'High-risk pattern. Treat as blocked until a human reviewer validates the evidence.',
    signals: signals.slice(0, 5),
  } as const;
}

async function buildChainMonitor(cluster: MythosSolanaCluster) {
  const provider = rpcProviderLabel(cluster);
  const [health, version, epoch] = await Promise.allSettled([
    jsonRpc<string>(cluster, 'getHealth', []),
    jsonRpc<{ 'solana-core'?: string; 'feature-set'?: number }>(cluster, 'getVersion', []),
    jsonRpc<EpochInfoResult>(cluster, 'getEpochInfo', []),
  ]);

  return {
    status: health.status === 'fulfilled' ? 'live' as const : 'review' as const,
    cluster,
    provider,
    slotLabel: epoch.status === 'fulfilled'
      ? `slot ${epoch.value.absoluteSlot ?? 'unknown'}`
      : 'slot unavailable',
    blockHeightLabel: epoch.status === 'fulfilled'
      ? `height ${epoch.value.blockHeight ?? 'unknown'}`
      : 'height unavailable',
    versionLabel: version.status === 'fulfilled'
      ? version.value['solana-core'] || 'version unavailable'
      : 'version unavailable',
  };
}

function memoryReplayFor(mode: MythosSolanaMode, risk: ReturnType<typeof riskFromEvidence>, evidence: MythosSolanaEvidenceItem[]) {
  const reviewCount = evidence.filter(item => item.status === 'review').length;
  const base = mode === 'transaction' ? 194 : mode === 'wallet' ? 121 : mode === 'token' ? 208 : mode === 'anchor' ? 87 : 64;
  const previousMatches = Math.max(7, base + reviewCount * 9 + Math.round(risk.score / 3));
  const likelyCause = mode === 'transaction'
    ? 'Transaction failure patterns usually map to account constraints, program errors, missing accounts, or RPC visibility gaps.'
    : mode === 'wallet'
      ? 'Wallet risk patterns usually map to new wallets, failed transactions, concentrated token exposure, or bot-like bursts.'
      : mode === 'token'
        ? 'Token risk patterns usually map to mint/freeze authority, holder concentration, new supply, or thin observable activity.'
        : mode === 'anchor'
          ? 'Anchor failures often map to PDA seed mismatch, signer constraints, unchecked accounts, or CPI account ordering.'
          : 'RPC failures often map to provider lag, blockhash expiry, rate limits, or inconsistent indexing.';
  return {
    pattern: `${mode}:${risk.level}`,
    previousMatches,
    likelyCause,
    confidenceBps: risk.memoryMatchBps,
  };
}

function patchExampleFor(mode: MythosSolanaMode, evidence: MythosSolanaEvidenceItem[]) {
  const joined = evidence.map(item => `${item.label}: ${item.value}`).join('\n').toLowerCase();
  if (mode === 'anchor' || /constraintseeds|pda|seeds/i.test(joined)) {
    return [
      'Anchor patch example:',
      '#[account(',
      '  seeds = [b"vault", user.key().as_ref()],',
      '  bump,',
      '  has_one = authority',
      ')]',
      'pub vault: Account<\'info, Vault>;',
      '',
      'Verify that the client derives the same PDA seeds and passes the same authority account.',
    ].join('\n');
  }
  if (mode === 'transaction' && /compute/i.test(joined)) {
    return [
      'Compute patch example:',
      'ComputeBudgetProgram.setComputeUnitLimit({ units: 220_000 })',
      'Remove duplicate CPI calls before increasing the limit.',
    ].join('\n');
  }
  if (mode === 'token') {
    return 'Token review example: verify mint authority, freeze authority, largest holder share, liquidity, and deployer history before trusting the asset.';
  }
  if (mode === 'wallet') {
    return 'Wallet review example: compare recent failed transactions, token exposure, first-seen activity, and counterparties before trusting this wallet.';
  }
  return 'Operational patch example: retry against a second RPC, compare latest blockhash, and record the incident as CongChain memory if reproducible.';
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
    let statusSummary = 'not available';
    let statusState: MythosSolanaEvidenceItem['status'] = 'review';

    try {
      const status = await jsonRpc<SignatureStatusesResult>(cluster, 'getSignatureStatuses', [
        [signature],
        { searchTransactionHistory: true },
      ]);
      const item = status.value?.[0];

      if (item) {
        statusSummary = [
          `slot ${item.slot ?? 'unknown'}`,
          `confirmation ${item.confirmationStatus || 'unknown'}`,
          `confirmations ${item.confirmations ?? 'finalized or unavailable'}`,
          `err ${item.err ? JSON.stringify(item.err).slice(0, 180) : 'none'}`,
        ].join(', ');
        statusState = item.err ? 'review' : 'ready';
      } else {
        statusSummary = 'signature status not found, even with searchTransactionHistory=true';
      }
    } catch (error) {
      statusSummary = error instanceof Error ? error.message : 'signature status lookup failed';
    }

    return {
      subject: signature,
      evidence: [
        value('Signature', signature),
        value('RPC result', 'transaction not found', 'review'),
        value('Signature status', statusSummary, statusState),
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

async function buildWalletEvidence(subject: string, cluster: MythosSolanaCluster) {
  const wallet = extractFirstBase58(subject);
  if (!wallet || !BASE58_PUBKEY.test(wallet)) {
    return {
      subject,
      evidence: [
        value('Input type', 'wallet intelligence request', 'review'),
        value('Wallet address', 'not found in input', 'review'),
        value('User report', subject.slice(0, 600), 'ready'),
      ],
    };
  }

  const [balance, account, signatures, tokenAccounts] = await Promise.allSettled([
    jsonRpc<{ value: number }>(cluster, 'getBalance', [wallet, { commitment: 'confirmed' }]),
    jsonRpc<AccountInfoResult>(cluster, 'getAccountInfo', [wallet, { encoding: 'base64', commitment: 'confirmed' }]),
    jsonRpc<SignaturesForAddressResult>(cluster, 'getSignaturesForAddress', [wallet, { limit: 12 }]),
    jsonRpc<TokenAccountsByOwnerResult>(cluster, 'getTokenAccountsByOwner', [
      wallet,
      { programId: TOKEN_PROGRAM_ID },
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ]),
  ]);

  const sigs = signatures.status === 'fulfilled' ? signatures.value : [];
  const failed = sigs.filter(item => item.err).length;
  const firstSeen = sigs.length
    ? sigs[sigs.length - 1]?.blockTime
      ? new Date((sigs[sigs.length - 1].blockTime || 0) * 1000).toISOString()
      : 'not available from recent window'
    : 'no recent signatures';
  const recentTxs = await Promise.allSettled(
    sigs.slice(0, 5).map(item => jsonRpc<TransactionResult | null>(cluster, 'getTransaction', [
      item.signature,
      { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
    ])),
  );
  const programHits = recentTxs
    .filter((item): item is PromiseFulfilledResult<TransactionResult | null> => item.status === 'fulfilled' && Boolean(item.value))
    .map(item => knownProgramSummary(item.value as TransactionResult))
    .filter(item => item !== 'not classified from parsed instructions');
  const tokens = tokenAccounts.status === 'fulfilled'
    ? (tokenAccounts.value.value || []).filter(item => item.account?.data?.parsed?.info?.tokenAmount?.uiAmountString !== '0')
    : [];
  const tokenPreview = tokens.slice(0, 6).map(item => {
    const info = item.account?.data?.parsed?.info;
    return `${info?.mint?.slice(0, 8) || 'unknown'}... ${info?.tokenAmount?.uiAmountString || info?.tokenAmount?.amount || '0'}`;
  }).join('; ');

  return {
    subject: wallet,
    evidence: [
      value('Wallet address', wallet),
      value('SOL balance', balance.status === 'fulfilled' ? `${(balance.value.value / 1_000_000_000).toFixed(6)} SOL` : 'not available', balance.status === 'fulfilled' ? 'ready' : 'review'),
      value('Account owner', account.status === 'fulfilled' ? account.value.value?.owner || 'not found' : 'not available', account.status === 'fulfilled' && account.value.value ? 'ready' : 'review'),
      value('Recent transactions', sigs.length),
      value('Recent failed transactions', failed, failed > 0 ? 'review' : 'ready'),
      value('First seen in recent window', firstSeen, sigs.length < 3 ? 'review' : 'ready'),
      value('Token accounts with balance', tokens.length),
      value('Token exposure preview', tokenPreview || 'no token balances found in SPL Token accounts', tokens.length ? 'ready' : 'review'),
      value('Detected program families', programHits.length ? Array.from(new Set(programHits)).join('; ') : 'not classified from recent parsed transactions', programHits.length ? 'ready' : 'review'),
      value('Trade inference', programHits.some(item => /Jupiter|Raydium|Orca|Meteora/i.test(item)) ? 'swap/trade program activity detected' : 'no swap program detected in sampled transactions', programHits.length ? 'ready' : 'review'),
    ],
  };
}

async function buildTokenEvidence(subject: string, cluster: MythosSolanaCluster) {
  const mint = extractFirstBase58(subject);
  if (!mint || !BASE58_PUBKEY.test(mint)) {
    return {
      subject,
      evidence: [
        value('Input type', 'token contract scanner request', 'review'),
        value('Mint address', 'not found in input', 'review'),
        value('User report', subject.slice(0, 600), 'ready'),
      ],
    };
  }

  const [mintInfo, supply, largest, signatures] = await Promise.allSettled([
    jsonRpc<ParsedAccountInfoResult>(cluster, 'getAccountInfo', [mint, { encoding: 'jsonParsed', commitment: 'confirmed' }]),
    jsonRpc<TokenSupplyResult>(cluster, 'getTokenSupply', [mint, { commitment: 'confirmed' }]),
    jsonRpc<TokenLargestAccountsResult>(cluster, 'getTokenLargestAccounts', [mint, { commitment: 'confirmed' }]),
    jsonRpc<SignaturesForAddressResult>(cluster, 'getSignaturesForAddress', [mint, { limit: 12 }]),
  ]);

  const info = mintInfo.status === 'fulfilled' ? mintInfo.value.value?.data && !Array.isArray(mintInfo.value.value.data) ? mintInfo.value.value.data.parsed?.info : undefined : undefined;
  const uiSupply = supply.status === 'fulfilled' ? supply.value.value?.uiAmountString || supply.value.value?.amount || 'not available' : 'not available';
  const largestAccounts = largest.status === 'fulfilled' ? largest.value.value || [] : [];
  const totalRaw = Number(supply.status === 'fulfilled' ? supply.value.value?.amount || 0 : 0);
  const largestRaw = Number(largestAccounts[0]?.amount || 0);
  const largestShare = totalRaw > 0 && largestRaw > 0 ? (largestRaw / totalRaw) * 100 : null;
  const top10Raw = largestAccounts.slice(0, 10).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const top10Share = totalRaw > 0 && top10Raw > 0 ? (top10Raw / totalRaw) * 100 : null;
  const sigs = signatures.status === 'fulfilled' ? signatures.value : [];
  const firstSeen = sigs.length
    ? sigs[sigs.length - 1]?.blockTime
      ? new Date((sigs[sigs.length - 1].blockTime || 0) * 1000).toISOString()
      : 'not available from recent window'
    : 'no recent mint signatures';

  const mintAuthority = typeof info?.mintAuthority === 'string' ? info.mintAuthority : info?.mintAuthority === null ? 'none' : 'not parsed';
  const freezeAuthority = typeof info?.freezeAuthority === 'string' ? info.freezeAuthority : info?.freezeAuthority === null ? 'none' : 'not parsed';

  return {
    subject: mint,
    evidence: [
      value('Mint address', mint),
      value('Token program owner', mintInfo.status === 'fulfilled' ? mintInfo.value.value?.owner || 'not found' : 'not available', mintInfo.status === 'fulfilled' && mintInfo.value.value ? 'ready' : 'review'),
      value('Supply', uiSupply, supply.status === 'fulfilled' ? 'ready' : 'review'),
      value('Decimals', supply.status === 'fulfilled' ? supply.value.value?.decimals : 'not available', supply.status === 'fulfilled' ? 'ready' : 'review'),
      value('Mint authority', mintAuthority, mintAuthority === 'none' ? 'ready' : 'review'),
      value('Freeze authority', freezeAuthority, freezeAuthority === 'none' ? 'ready' : 'review'),
      value('Largest holder share', largestShare === null ? 'not available' : `${largestShare.toFixed(2)}%`, largestShare !== null && largestShare <= 20 ? 'ready' : 'review'),
      value('Top 10 holder share', top10Share === null ? 'not available' : `${top10Share.toFixed(2)}%`, top10Share !== null && top10Share <= 55 ? 'ready' : 'review'),
      value('Largest account count', largestAccounts.length, largestAccounts.length ? 'ready' : 'review'),
      value('Recent mint activity', sigs.length, sigs.length >= 3 ? 'ready' : 'review'),
      value('First seen in recent window', firstSeen, sigs.length < 3 ? 'review' : 'ready'),
      value('Investment boundary', 'risk review only; not financial advice'),
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
    : mode === 'wallet'
      ? 'solana-wallet-intelligence'
      : mode === 'token'
        ? 'solana-token-risk-scanner'
        : mode === 'anchor'
          ? 'forge-lsp + solana-anchor-schema-validator'
          : 'solana-wallet-ecosystem-bridge';

  const evidenceResult = mode === 'transaction'
    ? await buildTransactionEvidence(rawSubject, cluster)
    : mode === 'wallet'
      ? await buildWalletEvidence(rawSubject, cluster)
      : mode === 'token'
        ? await buildTokenEvidence(rawSubject, cluster)
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
    analysis = cleanModelText(result.content);
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
  const risk = riskFromEvidence(mode, evidenceResult.evidence);
  const chainMonitor = await buildChainMonitor(cluster);
  const memoryReplay = memoryReplayFor(mode, risk, evidenceResult.evidence);
  const patchExample = patchExampleFor(mode, evidenceResult.evidence);
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
    mode === 'token' || mode === 'wallet'
      ? 'Risk boundary: this report is not financial advice and cannot tell a user to buy, sell, or invest.'
      : '',
  ].join('\n');

  return {
    ok: true,
    mode,
    cluster,
    subject: evidenceResult.subject,
    analysis,
    fallbackUsed,
    evidence: evidenceResult.evidence,
    risk,
    chainMonitor,
    memoryReplay,
    patchExample,
    cognitiveTrace: {
      perception: `Mythos received a ${mode} request for ${cluster}.`,
      evidenceUsed: `${evidenceResult.evidence.length} server-side evidence items collected through read-only RPC or user-provided logs.`,
      skill,
      decision: evidenceResult.evidence.some(item => item.status === 'blocked')
        ? 'Blocked until unsafe evidence is removed.'
        : evidenceResult.evidence.some(item => item.status === 'review')
          ? 'Prepared a review brief with missing or uncertain evidence clearly labeled.'
          : 'Prepared a ready Solana developer brief from read-only evidence.',
      prediction: `Memory replay matched ${memoryReplay.previousMatches} similar ${mode} patterns with ${Math.round(memoryReplay.confidenceBps / 100)}% confidence.`,
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
          risk,
          chainMonitor,
          memoryReplay,
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
