import { isValueMovingIntent } from './security-policy';
import type {
  WalletAgentIntentDraft,
  WalletAgentIntentType,
  WalletAgentTransactionProposal,
} from './types';

const ESTIMATED_DEVNET_FEE_SOL = 0.000005;

function getProposalKind(type: WalletAgentIntentType): WalletAgentTransactionProposal['kind'] {
  if (type === 'BUY_TOKEN' || type === 'SELL_TOKEN') return 'swap_intent';
  if (type === 'PAYROLL_BATCH') return 'payroll_intent';
  if (type === 'PRIVACY_PAYMENT') return 'privacy_transfer_intent';
  return 'transfer_intent';
}

function getMissingFields(draft: WalletAgentIntentDraft) {
  const missing: string[] = [];

  if (!draft.walletAddress) missing.push('wallet');

  if (draft.type === 'BUY_TOKEN' || draft.type === 'SELL_TOKEN') {
    if (!draft.entities.tokenSymbol) missing.push('token');
    if (!draft.entities.amountSol && !draft.entities.targetPriceUsd) missing.push('amount_or_condition');
  }

  if (draft.type === 'SCHEDULE_PAYMENT' || draft.type === 'PRIVACY_PAYMENT') {
    if (!draft.entities.recipientAddress) missing.push('recipient');
    if (!draft.entities.amountSol) missing.push('amount');
  }

  if (draft.type === 'SCHEDULE_PAYMENT' && !draft.entities.scheduledFor) {
    missing.push('schedule');
  }

  if (draft.type === 'PAYROLL_BATCH') {
    if (!draft.entities.employeeCount) missing.push('employee_count');
    if (!draft.entities.amountSol) missing.push('payroll_budget');
  }

  return missing;
}

export function createWalletAgentTransactionProposal(
  draft: WalletAgentIntentDraft,
  now = new Date()
): WalletAgentTransactionProposal | null {
  if (!isValueMovingIntent(draft.type) || !draft.walletAddress) return null;

  const missingFields = getMissingFields(draft);
  const blockedByRisk = draft.riskLevel === 'blocked';
  const status: WalletAgentTransactionProposal['status'] = blockedByRisk
    ? 'blocked'
    : missingFields.length > 0
      ? 'needs_more_details'
      : 'ready_for_wallet_signature';

  return {
    id: `wat_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    status,
    kind: getProposalKind(draft.type),
    network: draft.network,
    fromAddress: draft.walletAddress,
    createdAt: now.toISOString(),
    summary: draft.summary,
    estimatedFeeSol: ESTIMATED_DEVNET_FEE_SOL,
    requiredWalletAction: status === 'ready_for_wallet_signature'
      ? 'A wallet ainda precisa abrir uma assinatura explicita antes de qualquer envio.'
      : 'Complete os campos faltantes antes de preparar uma assinatura.',
    missingFields,
    checks: [
      {
        label: 'Carteira de origem',
        status: draft.walletAddress ? 'pass' : 'missing',
        detail: draft.walletAddress ? draft.walletAddress : 'Nenhuma carteira conectada.',
      },
      {
        label: 'Rede',
        status: draft.network === 'solana-devnet' ? 'pass' : 'review',
        detail: draft.network === 'solana-devnet'
          ? 'Solana Devnet selecionada para testes seguros.'
          : 'Mainnet exige revisao extra antes da assinatura.',
      },
      {
        label: 'Campos essenciais',
        status: missingFields.length === 0 ? 'pass' : 'missing',
        detail: missingFields.length === 0
          ? 'Token, valor e demais parametros minimos estao presentes.'
          : `Faltando: ${missingFields.join(', ')}.`,
      },
      {
        label: 'Payload assinavel',
        status: 'blocked',
        detail: 'Payload real ainda nao e criado nesta fase. A proposta e somente auditavel.',
      },
    ],
    unsignedPayloadStatus: 'not_created',
  };
}
