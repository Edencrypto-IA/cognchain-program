import { createWalletAgentCore } from './core';
import { canConfirmWalletAgentIntent, confirmWalletAgentIntent } from './confirmation';
import { isValueMovingIntent } from './security-policy';
import type {
  WalletAgentCommandInput,
  WalletAgentCoreResult,
  WalletAgentIntentType,
} from './types';

export type MythosWalletCommandPhaseStatus = 'ready' | 'review' | 'blocked' | 'pending';

export type MythosWalletCommandRouteKind =
  | 'swap_quote'
  | 'sol_transfer'
  | 'scheduled_payment'
  | 'payroll_batch'
  | 'privacy_transfer'
  | 'read_only';

export type MythosWalletCommandPhase = {
  id: 'intent' | 'preview' | 'route' | 'signature' | 'submit' | 'memory';
  title: string;
  status: MythosWalletCommandPhaseStatus;
  detail: string;
};

export type MythosWalletCommandPlan = {
  ok: true;
  command: string;
  network: WalletAgentCommandInput['network'];
  intentType: WalletAgentIntentType;
  routeKind: MythosWalletCommandRouteKind;
  routeStatus: 'preview_only' | 'needs_wallet' | 'needs_fields' | 'devnet_ready' | 'blocked';
  jupiterQuoteRequest?: {
    inputSymbol: string;
    outputSymbol: string;
    amountUi: number;
    slippageBps: number;
    status: 'ready' | 'needs_more_details' | 'unsupported';
    reason: string;
  };
  walletAgent: WalletAgentCoreResult;
  confirmation: {
    allowed: boolean;
    reason: string;
    confirmationId?: string;
  };
  phases: MythosWalletCommandPhase[];
  walletActions: string[];
  blockedActions: string[];
  memoryCandidate: {
    title: string;
    content: string;
    metadata: Record<string, string | number | boolean | null>;
  };
  safety: {
    canAutoExecute: false;
    canMoveFundsWithoutWallet: false;
    canSignForUser: false;
    canSubmitMainnetAutomatically: false;
    walletSignatureRequiredForValue: boolean;
    notes: string[];
  };
};

const JUPITER_SAFE_SYMBOLS = ['SOL', 'USDC', 'USDT', 'JUP', 'BONK'];

function routeKindForIntent(type: WalletAgentIntentType): MythosWalletCommandRouteKind {
  if (type === 'BUY_TOKEN' || type === 'SELL_TOKEN') return 'swap_quote';
  if (type === 'SCHEDULE_PAYMENT') return 'scheduled_payment';
  if (type === 'PAYROLL_BATCH') return 'payroll_batch';
  if (type === 'PRIVACY_PAYMENT') return 'privacy_transfer';
  if (type === 'PRICE_ALERT' || type === 'RISK_CHECK') return 'read_only';
  return 'sol_transfer';
}

function routeStatusFor(result: WalletAgentCoreResult): MythosWalletCommandPlan['routeStatus'] {
  const proposal = result.draft.transactionProposal;

  if (!result.safety.allowed || result.draft.riskLevel === 'blocked') return 'blocked';
  if (!isValueMovingIntent(result.draft.type)) return 'preview_only';
  if (!result.draft.walletAddress) return 'needs_wallet';
  if (proposal?.missingFields.length) return 'needs_fields';
  if (result.draft.network === 'solana-devnet' && proposal?.kind === 'transfer_intent') return 'devnet_ready';

  return 'preview_only';
}

function extractSwapSymbols(command: string) {
  const upper = command.toUpperCase();
  const symbols = JUPITER_SAFE_SYMBOLS.filter(symbol => new RegExp(`\\b${symbol}\\b`).test(upper));
  const amountMatch = upper.match(/(\d+(?:[,.]\d+)?)\s*(SOL)\b/);

  if (symbols.length >= 2) {
    return {
      inputSymbol: symbols[0],
      outputSymbol: symbols[1],
      amountUi: amountMatch ? Number(amountMatch[1].replace(',', '.')) : undefined,
    };
  }

  if (symbols.length === 1 && symbols[0] !== 'SOL') {
    return {
      inputSymbol: 'SOL',
      outputSymbol: symbols[0],
      amountUi: amountMatch ? Number(amountMatch[1].replace(',', '.')) : undefined,
    };
  }

  if (/\bUSDC\b/.test(upper)) {
    return {
      inputSymbol: 'SOL',
      outputSymbol: 'USDC',
      amountUi: amountMatch ? Number(amountMatch[1].replace(',', '.')) : undefined,
    };
  }

  return null;
}

function createJupiterQuoteRequest(
  command: string,
  result: WalletAgentCoreResult
): MythosWalletCommandPlan['jupiterQuoteRequest'] {
  if (routeKindForIntent(result.draft.type) !== 'swap_quote') return undefined;

  const parsed = extractSwapSymbols(command);
  if (!parsed) {
    return {
      inputSymbol: 'SOL',
      outputSymbol: result.draft.entities.tokenSymbol || 'UNKNOWN',
      amountUi: result.draft.entities.amountSol || 0,
      slippageBps: 50,
      status: 'needs_more_details',
      reason: 'Tell Mythos the exact input token, output token, and SOL amount before fetching a Jupiter quote.',
    };
  }

  if (!parsed.amountUi || !Number.isFinite(parsed.amountUi) || parsed.amountUi <= 0) {
    return {
      inputSymbol: parsed.inputSymbol,
      outputSymbol: parsed.outputSymbol,
      amountUi: 0,
      slippageBps: 50,
      status: 'needs_more_details',
      reason: 'A positive SOL amount is required before fetching a Jupiter quote.',
    };
  }

  if (!JUPITER_SAFE_SYMBOLS.includes(parsed.inputSymbol) || !JUPITER_SAFE_SYMBOLS.includes(parsed.outputSymbol)) {
    return {
      inputSymbol: parsed.inputSymbol,
      outputSymbol: parsed.outputSymbol,
      amountUi: parsed.amountUi,
      slippageBps: 50,
      status: 'unsupported',
      reason: 'This token is not enabled in the safe Jupiter quote allowlist yet.',
    };
  }

  return {
    inputSymbol: parsed.inputSymbol,
    outputSymbol: parsed.outputSymbol,
    amountUi: parsed.amountUi,
    slippageBps: 50,
    status: 'ready',
    reason: 'Safe read-only Jupiter quote can be fetched. No swap transaction will be created.',
  };
}

function statusFromRoute(routeStatus: MythosWalletCommandPlan['routeStatus']) {
  if (routeStatus === 'blocked') return 'blocked';
  if (routeStatus === 'devnet_ready') return 'ready';
  if (routeStatus === 'needs_fields' || routeStatus === 'needs_wallet') return 'review';
  return 'pending';
}

function buildPhases(result: WalletAgentCoreResult, routeStatus: MythosWalletCommandPlan['routeStatus']): MythosWalletCommandPhase[] {
  const valueMoving = isValueMovingIntent(result.draft.type);
  const proposal = result.draft.transactionProposal;
  const missing = proposal?.missingFields.join(', ') || 'none';
  const routeKind = routeKindForIntent(result.draft.type);

  return [
    {
      id: 'intent',
      title: '1. Command intent',
      status: 'ready',
      detail: `Mythos classified this as ${result.draft.type.toLowerCase().replaceAll('_', ' ')} with ${result.draft.riskLevel} initial risk.`,
    },
    {
      id: 'preview',
      title: '2. Secure preview',
      status: result.safety.allowed ? 'ready' : 'blocked',
      detail: result.preview.nextStep,
    },
    {
      id: 'route',
      title: routeKind === 'swap_quote' ? '3. Jupiter route contract' : '3. Transaction proposal',
      status: statusFromRoute(routeStatus),
      detail: routeKind === 'swap_quote'
        ? 'Swap commands are converted into a route/quote contract first. No Jupiter transaction payload is created until a future audited wallet phase.'
        : routeStatus === 'devnet_ready'
          ? 'Devnet SOL transfer can continue into the existing unsigned-transaction preparation path after review.'
          : `Proposal is audit-only right now. Missing fields: ${missing}.`,
    },
    {
      id: 'signature',
      title: '4. Phantom/Solflare signature',
      status: valueMoving ? 'pending' : 'blocked',
      detail: valueMoving
        ? 'The connected wallet must show the final transaction and the user must approve manually.'
        : 'Read-only analysis does not require a wallet signature.',
    },
    {
      id: 'submit',
      title: '5. Controlled submission',
      status: valueMoving ? 'pending' : 'blocked',
      detail: result.draft.network === 'solana-mainnet'
        ? 'Mainnet submission remains blocked in this phase. Mythos may explain and prepare review context only.'
        : 'Devnet submission can happen only after a signed transaction is produced by the wallet.',
    },
    {
      id: 'memory',
      title: '6. CongChain memory',
      status: 'pending',
      detail: 'After review, the command, evidence, wallet action, hash, and safety notes can be saved as metadata-only Mythos memory.',
    },
  ];
}

function commandSummary(result: WalletAgentCoreResult) {
  const token = result.draft.entities.tokenSymbol || 'token';
  const amount = result.draft.entities.amountSol ? `${result.draft.entities.amountSol} SOL` : 'amount pending';
  const recipient = result.draft.entities.recipientAddress || 'recipient pending';

  if (result.draft.type === 'BUY_TOKEN') return `Prepare a reviewed swap route to buy ${token}.`;
  if (result.draft.type === 'SELL_TOKEN') return `Prepare a reviewed swap route to sell ${token}.`;
  if (result.draft.type === 'SCHEDULE_PAYMENT') return `Prepare a scheduled payment of ${amount} to ${recipient}.`;
  if (result.draft.type === 'PAYROLL_BATCH') return `Prepare payroll review for ${result.draft.entities.employeeCount || 'unknown'} people.`;
  if (result.draft.type === 'PRIVACY_PAYMENT') return `Prepare a privacy-preserving payment review for ${amount} to ${recipient}.`;
  if (result.draft.type === 'PRICE_ALERT') return `Prepare a read-only price alert for ${token}.`;
  return `Prepare a read-only risk review for ${token}.`;
}

export function createMythosWalletCommandPlan(input: WalletAgentCommandInput): MythosWalletCommandPlan {
  const walletAgent = createWalletAgentCore({
    ...input,
    network: input.network ?? 'solana-mainnet',
  });
  const confirmationCheck = canConfirmWalletAgentIntent(walletAgent);
  const confirmed = confirmationCheck.allowed ? confirmWalletAgentIntent(walletAgent) : walletAgent;
  const routeStatus = routeStatusFor(confirmed);
  const routeKind = routeKindForIntent(confirmed.draft.type);
  const valueMoving = isValueMovingIntent(confirmed.draft.type);
  const jupiterQuoteRequest = createJupiterQuoteRequest(input.prompt, confirmed);

  return {
    ok: true,
    command: input.prompt,
    network: confirmed.draft.network,
    intentType: confirmed.draft.type,
    routeKind,
    routeStatus,
    jupiterQuoteRequest,
    walletAgent: confirmed,
    confirmation: {
      allowed: confirmationCheck.allowed,
      reason: confirmationCheck.reason,
      confirmationId: confirmed.draft.internalConfirmation?.confirmationId,
    },
    phases: buildPhases(confirmed, routeStatus),
    walletActions: valueMoving
      ? [
          'Review token, amount, recipient, network, fees, and slippage in plain language.',
          'Confirm the intent inside CongChain before any wallet window opens.',
          'Approve or reject the final transaction inside Phantom or Solflare.',
          'Check the transaction hash and Explorer result after any controlled submission.',
        ]
      : [
          'Review the read-only evidence.',
          'Save only useful context as CongChain memory after human review.',
        ],
    blockedActions: [
      'Mythos cannot sign with a wallet key.',
      'Mythos cannot submit mainnet transactions automatically.',
      'Mythos cannot buy, sell, pay, schedule, or move funds without visible wallet approval.',
      'Mythos cannot store private keys, seed phrases, signed payloads, or hidden transaction data.',
    ],
    memoryCandidate: {
      title: `Mythos wallet command: ${confirmed.draft.type}`,
      content: [
        commandSummary(confirmed),
        `Network: ${confirmed.draft.network}`,
        `Route: ${routeKind}`,
        `Route status: ${routeStatus}`,
        `Safety: wallet signature required for value movement; auto-execution disabled.`,
      ].join('\n'),
      metadata: {
        source: 'mythos-wallet-command',
        intentType: confirmed.draft.type,
        network: confirmed.draft.network,
        routeKind,
        routeStatus,
        walletAddress: confirmed.draft.walletAddress || null,
        requiresWalletSignature: confirmed.draft.requiresWalletSignature,
        canAutoExecute: false,
      },
    },
    safety: {
      canAutoExecute: false,
      canMoveFundsWithoutWallet: false,
      canSignForUser: false,
      canSubmitMainnetAutomatically: false,
      walletSignatureRequiredForValue: valueMoving,
      notes: [
        'This planner is an audit and preview layer.',
        'Mainnet value movement remains blocked until future audited wallet-signature and submission phases.',
        'Devnet transfer preparation must reuse the existing Wallet Agent transaction path.',
      ],
    },
  };
}
