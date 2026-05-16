import type {
  WalletAgentCoreResult,
  WalletAgentIntentType,
  WalletAgentLocalNotificationDraft,
  WalletAgentLocalRule,
  WalletAgentLocalRuleReviewContext,
  WalletAgentLocalRuleSimulation,
  WalletAgentLocalRuleTrigger,
} from './types';

const WALLET_AGENT_RULES_KEY = 'congchain.walletAgent.localRules.v1';
const MAX_RULES = 40;

const RULE_ELIGIBLE_INTENTS = new Set<WalletAgentIntentType>([
  'SCHEDULE_PAYMENT',
  'PAYROLL_BATCH',
  'PRICE_ALERT',
  'RISK_CHECK',
]);

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function canCreateWalletAgentLocalRule(result: WalletAgentCoreResult) {
  return !!result.draft.internalConfirmation?.confirmed && RULE_ELIGIBLE_INTENTS.has(result.draft.type);
}

function createRuleTrigger(result: WalletAgentCoreResult): WalletAgentLocalRuleTrigger {
  const { draft } = result;
  const tokenSymbol = draft.entities.tokenSymbol ?? 'SOL';

  if (draft.type === 'SCHEDULE_PAYMENT') {
    return {
      kind: 'time',
      label: draft.entities.scheduledFor
        ? `Manual review at ${draft.entities.scheduledFor}`
        : 'Manual schedule review',
      scheduledFor: draft.entities.scheduledFor,
    };
  }

  if (draft.type === 'PAYROLL_BATCH') {
    return {
      kind: 'batch_review',
      label: draft.entities.scheduledFor
        ? `Payroll batch review at ${draft.entities.scheduledFor}`
        : 'Payroll batch review',
      scheduledFor: draft.entities.scheduledFor,
      employeeCount: draft.entities.employeeCount,
    };
  }

  if (draft.type === 'PRICE_ALERT') {
    return {
      kind: 'price',
      label: draft.entities.targetPriceUsd
        ? `${tokenSymbol} target around $${draft.entities.targetPriceUsd}`
        : `${tokenSymbol} price watch`,
      tokenSymbol,
      targetPriceUsd: draft.entities.targetPriceUsd,
    };
  }

  return {
    kind: 'risk',
    label: `${tokenSymbol} risk watch`,
    tokenSymbol,
  };
}

function createRuleAction(result: WalletAgentCoreResult): WalletAgentLocalRule['action'] {
  if (result.draft.requiresWalletSignature) {
    return {
      kind: 'prepare_for_manual_signature',
      label: 'Prepare context only. User must review and sign manually later.',
    };
  }

  return {
    kind: 'notify_only',
    label: 'Notify only. No transaction can be executed by this local rule.',
  };
}

export function createWalletAgentLocalRule(
  result: WalletAgentCoreResult,
  now = new Date()
): WalletAgentLocalRule | null {
  if (!canCreateWalletAgentLocalRule(result)) return null;

  const { draft } = result;
  const timestamp = now.toISOString();

  return {
    id: `warule_${draft.id}`,
    intentId: draft.id,
    type: draft.type,
    status: 'manual_review',
    network: draft.network,
    walletAddress: draft.walletSnapshot?.address ?? draft.walletAddress ?? null,
    summary: draft.summary,
    trigger: createRuleTrigger(result),
    action: createRuleAction(result),
    safety: {
      canAutoExecute: false,
      requiresWalletSignature: draft.requiresWalletSignature,
      notes: [
        'Local rule only. It does not run a background scheduler.',
        'No transaction can be signed or submitted without a future explicit wallet approval.',
        'Mainnet execution remains disabled for this phase.',
      ],
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    confirmationId: draft.internalConfirmation?.confirmationId,
  };
}

export function readWalletAgentLocalRules(): WalletAgentLocalRule[] {
  if (!canUseLocalStorage()) return [];

  try {
    const raw = window.localStorage.getItem(WALLET_AGENT_RULES_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is WalletAgentLocalRule => !!item && typeof item.id === 'string')
      .slice(0, MAX_RULES);
  } catch {
    return [];
  }
}

export function upsertWalletAgentLocalRule(rule: WalletAgentLocalRule): WalletAgentLocalRule[] {
  if (!canUseLocalStorage()) return [];

  const current = readWalletAgentLocalRules();
  const existing = current.find(item => item.id === rule.id);
  const nextRule = existing
    ? { ...rule, createdAt: existing.createdAt }
    : rule;
  const next = [
    nextRule,
    ...current.filter(item => item.id !== rule.id),
  ].slice(0, MAX_RULES);

  window.localStorage.setItem(WALLET_AGENT_RULES_KEY, JSON.stringify(next));
  return next;
}

export function setWalletAgentLocalRuleStatus(
  ruleId: string,
  status: WalletAgentLocalRule['status'],
  now = new Date()
): WalletAgentLocalRule[] {
  if (!canUseLocalStorage()) return [];

  const current = readWalletAgentLocalRules();
  const next = current.map(rule => rule.id === ruleId
    ? { ...rule, status, updatedAt: now.toISOString() }
    : rule
  );

  window.localStorage.setItem(WALLET_AGENT_RULES_KEY, JSON.stringify(next));
  return next;
}

export function removeWalletAgentLocalRule(ruleId: string): WalletAgentLocalRule[] {
  if (!canUseLocalStorage()) return [];

  const next = readWalletAgentLocalRules().filter(rule => rule.id !== ruleId);
  window.localStorage.setItem(WALLET_AGENT_RULES_KEY, JSON.stringify(next));
  return next;
}

export function createWalletAgentRuleReviewContext(
  rule: WalletAgentLocalRule,
  now = new Date()
): WalletAgentLocalRuleReviewContext {
  const valueAction = rule.safety.requiresWalletSignature;

  return {
    ruleId: rule.id,
    title: `${rule.type.replaceAll('_', ' ')} review context`,
    status: rule.status,
    triggerLabel: rule.trigger.label,
    actionLabel: rule.action.label,
    operatorSummary: [
      rule.summary,
      `Trigger: ${rule.trigger.label}.`,
      `Action mode: ${rule.action.kind.replaceAll('_', ' ')}.`,
      rule.walletAddress ? `Wallet: ${rule.walletAddress}.` : 'Wallet: not connected.',
    ].join(' '),
    requiredReview: [
      'Confirm that the user still wants this rule active.',
      'Check that the trigger data is still correct and current.',
      valueAction
        ? 'Require a fresh wallet review and signature before any value-moving action.'
        : 'Confirm this remains notify-only before using it for an operational update.',
      rule.status === 'paused'
        ? 'Reactivate the rule only if the user explicitly chooses to continue watching it.'
        : 'Keep the rule in manual review until the user approves a future step.',
    ],
    blockedActions: [
      'Do not sign from this context.',
      'Do not submit a transaction from this context.',
      'Do not run a background scheduler from this context.',
      'Do not treat this local rule as a backend automation job.',
    ],
    safetyNotes: rule.safety.notes,
    generatedAt: now.toISOString(),
  };
}

export function simulateWalletAgentLocalRule(
  rule: WalletAgentLocalRule,
  now = new Date()
): WalletAgentLocalRuleSimulation {
  const blockedActions = [
    'No wallet signature can be requested by this simulation.',
    'No transaction can be prepared or submitted by this simulation.',
    'No background job or notification is scheduled by this simulation.',
  ];

  if (rule.status === 'paused') {
    return {
      ruleId: rule.id,
      status: 'paused',
      title: 'Rule is paused',
      summary: 'This rule is stored locally but currently paused. It would not be considered for any future manual review until reactivated.',
      observations: [
        `Trigger retained: ${rule.trigger.label}`,
        'User must reactivate the rule before using it operationally.',
      ],
      nextManualStep: 'Reactivate the rule only if the user still wants to monitor it.',
      blockedActions,
      simulatedAt: now.toISOString(),
    };
  }

  if (rule.trigger.kind === 'price' && !rule.trigger.targetPriceUsd) {
    return {
      ruleId: rule.id,
      status: 'needs_more_data',
      title: 'Price target is incomplete',
      summary: 'The rule can be reviewed, but it does not include a target price yet.',
      observations: [
        `Token watch: ${rule.trigger.tokenSymbol ?? 'unknown token'}`,
        'A real market check would require a target price and a trusted data source.',
      ],
      nextManualStep: 'Ask the user for the target price before connecting live market evaluation.',
      blockedActions,
      simulatedAt: now.toISOString(),
    };
  }

  if ((rule.trigger.kind === 'time' || rule.trigger.kind === 'batch_review') && !rule.trigger.scheduledFor) {
    return {
      ruleId: rule.id,
      status: 'needs_more_data',
      title: 'Schedule is incomplete',
      summary: 'The rule needs a date and time before it can become useful for future reminders.',
      observations: [
        `Trigger type: ${rule.trigger.kind.replaceAll('_', ' ')}`,
        'No local or backend scheduler is active in this phase.',
      ],
      nextManualStep: 'Ask the user for the exact date, time, and timezone.',
      blockedActions,
      simulatedAt: now.toISOString(),
    };
  }

  return {
    ruleId: rule.id,
    status: 'manual_review_required',
    title: 'Manual review would be required',
    summary: 'The rule has enough local context to be reviewed, but it still cannot execute anything by itself.',
    observations: [
      `Trigger: ${rule.trigger.label}`,
      `Action mode: ${rule.action.kind.replaceAll('_', ' ')}`,
      rule.safety.requiresWalletSignature
        ? 'A fresh wallet signature would be required before any value-moving action.'
        : 'This remains a notify-only rule unless a future phase connects notifications.',
    ],
    nextManualStep: rule.safety.requiresWalletSignature
      ? 'Open a fresh review flow and require explicit wallet approval.'
      : 'Use this as a local reminder context for the next user-facing update.',
    blockedActions,
    simulatedAt: now.toISOString(),
  };
}

export function createWalletAgentLocalNotificationDraft(
  rule: WalletAgentLocalRule,
  now = new Date()
): WalletAgentLocalNotificationDraft {
  const walletActionRequired = rule.safety.requiresWalletSignature;
  const channels: WalletAgentLocalNotificationDraft['channels'] = walletActionRequired
    ? ['congchain_chat', 'wallet']
    : ['congchain_chat'];

  return {
    id: `wanotif_${rule.id}_${now.getTime()}`,
    ruleId: rule.id,
    status: 'draft_only',
    channels,
    title: rule.status === 'paused'
      ? 'Regra pausada: sem alerta ativo'
      : `Alerta preparado: ${rule.type.replaceAll('_', ' ')}`,
    message: rule.status === 'paused'
      ? `A regra "${rule.trigger.label}" esta pausada. A CONGCHAIN nao avisaria nada ate voce reativar.`
      : `A CONGCHAIN avisaria no chat quando a regra "${rule.trigger.label}" precisar de revisao manual.${walletActionRequired ? ' Se houver acao de valor, a carteira seria usada apenas para uma aprovacao futura e explicita.' : ''}`,
    walletActionRequired,
    deliveryPlan: [
      'Mostrar primeiro no chat CongChain.',
      walletActionRequired
        ? 'Abrir solicitacao de carteira somente se o usuario escolher revisar e assinar no futuro.'
        : 'Nao abrir carteira para regra somente leitura.',
      'Nao enviar para Telegram, email, browser push ou qualquer canal externo.',
    ],
    blockedActions: [
      'Do not send this draft automatically.',
      'Do not request a wallet signature from this draft.',
      'Do not submit transactions from this draft.',
      'Do not use any notification channel outside CongChain chat and wallet approval.',
    ],
    createdAt: now.toISOString(),
  };
}

export function saveWalletAgentLocalRule(result: WalletAgentCoreResult): WalletAgentLocalRule | null {
  const rule = createWalletAgentLocalRule(result);
  if (!rule) return null;

  upsertWalletAgentLocalRule(rule);
  return rule;
}
