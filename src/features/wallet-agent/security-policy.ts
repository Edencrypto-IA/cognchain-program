import type {
  WalletAgentApprovalStep,
  WalletAgentIntentDraft,
  WalletAgentIntentType,
  WalletAgentSafetyResult,
} from './types';

export const WALLET_AGENT_SECURITY_PRINCIPLES = [
  'CONGCHAIN can interpret, prepare, simulate, schedule, and notify financial actions.',
  'CONGCHAIN must never move funds without an explicit wallet signature from the user.',
  'Every value-moving action must show a human-readable preview before any wallet request.',
  'Scheduled actions may be saved only after in-app confirmation and must still require wallet approval at execution time.',
  'Private payment features must protect metadata without hiding unsafe or non-compliant behavior.',
] as const;

export const VALUE_MOVING_INTENTS = [
  'BUY_TOKEN',
  'SELL_TOKEN',
  'SCHEDULE_PAYMENT',
  'PAYROLL_BATCH',
  'PRIVACY_PAYMENT',
] as const satisfies readonly WalletAgentIntentType[];

export const READ_ONLY_INTENTS = [
  'PRICE_ALERT',
  'RISK_CHECK',
] as const satisfies readonly WalletAgentIntentType[];

const REQUIRED_VALUE_MOVING_STEPS: WalletAgentApprovalStep[] = [
  'intent_preview',
  'user_confirmed_in_app',
  'wallet_signature_required',
];

const REQUIRED_READ_ONLY_STEPS: WalletAgentApprovalStep[] = [
  'intent_preview',
];

export function isValueMovingIntent(type: WalletAgentIntentType) {
  return VALUE_MOVING_INTENTS.includes(type as (typeof VALUE_MOVING_INTENTS)[number]);
}

export function getRequiredApprovalSteps(type: WalletAgentIntentType): WalletAgentApprovalStep[] {
  return isValueMovingIntent(type)
    ? REQUIRED_VALUE_MOVING_STEPS
    : REQUIRED_READ_ONLY_STEPS;
}

export function evaluateWalletAgentSafety(intent: WalletAgentIntentDraft): WalletAgentSafetyResult {
  if (intent.canAutoExecute !== false) {
    return {
      status: 'blocked',
      allowed: false,
      reason: 'Auto-execution is not allowed for wallet agent intents.',
      requiredSteps: getRequiredApprovalSteps(intent.type),
      warnings: ['The user must keep final custody and approval through their wallet.'],
    };
  }

  if (isValueMovingIntent(intent.type) && !intent.requiresWalletSignature) {
    return {
      status: 'blocked',
      allowed: false,
      reason: 'Value-moving intents must require a wallet signature.',
      requiredSteps: REQUIRED_VALUE_MOVING_STEPS,
      warnings: ['No transaction can be submitted without wallet approval.'],
    };
  }

  if (intent.riskLevel === 'blocked') {
    return {
      status: 'blocked',
      allowed: false,
      reason: 'The intent is blocked by risk policy.',
      requiredSteps: getRequiredApprovalSteps(intent.type),
      warnings: intent.warnings,
    };
  }

  if (intent.approvalStep === 'wallet_signature_required') {
    return {
      status: 'ready_for_wallet_signature',
      allowed: true,
      reason: 'The intent can be presented to the wallet for explicit user approval.',
      requiredSteps: getRequiredApprovalSteps(intent.type),
      warnings: intent.warnings,
    };
  }

  return {
    status: isValueMovingIntent(intent.type) ? 'needs_user_review' : 'draft_only',
    allowed: true,
    reason: 'The intent is safe to preview, but not safe to execute.',
    requiredSteps: getRequiredApprovalSteps(intent.type),
    warnings: intent.warnings,
  };
}

export function createSafeIntentDraft(
  input: Omit<
    WalletAgentIntentDraft,
    | 'id'
    | 'createdAt'
    | 'approvalStep'
    | 'requiresWalletSignature'
    | 'requiresInAppConfirmation'
    | 'canAutoExecute'
    | 'warnings'
  > & { warnings?: string[] }
): WalletAgentIntentDraft {
  const valueMoving = isValueMovingIntent(input.type);

  return {
    ...input,
    id: `wai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    approvalStep: 'intent_preview',
    requiresWalletSignature: valueMoving,
    requiresInAppConfirmation: valueMoving,
    canAutoExecute: false,
    warnings: input.warnings ?? [],
  };
}
