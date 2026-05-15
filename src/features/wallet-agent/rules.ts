import type {
  WalletAgentCoreResult,
  WalletAgentIntentType,
  WalletAgentLocalRule,
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

export function saveWalletAgentLocalRule(result: WalletAgentCoreResult): WalletAgentLocalRule | null {
  const rule = createWalletAgentLocalRule(result);
  if (!rule) return null;

  upsertWalletAgentLocalRule(rule);
  return rule;
}
