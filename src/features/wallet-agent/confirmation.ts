import { isValueMovingIntent } from './security-policy';
import { createWalletAgentTransactionProposal } from './transaction-proposal';
import type {
  WalletAgentApprovalStep,
  WalletAgentCoreResult,
  WalletAgentInternalConfirmation,
} from './types';

export function canConfirmWalletAgentIntent(result: WalletAgentCoreResult) {
  const valueMoving = isValueMovingIntent(result.draft.type);

  if (!result.safety.allowed) {
    return {
      allowed: false,
      reason: 'Esta intencao esta bloqueada pela politica de seguranca.',
    };
  }

  if (result.draft.riskLevel === 'blocked') {
    return {
      allowed: false,
      reason: 'O risco esta bloqueado e nao pode ser confirmado.',
    };
  }

  if (valueMoving && !result.draft.walletAddress) {
    return {
      allowed: false,
      reason: 'Conecte uma carteira antes de confirmar uma acao que pode mover valor.',
    };
  }

  return {
    allowed: true,
    reason: valueMoving
      ? 'Confirmacao interna pronta. A proxima etapa ainda exige assinatura explicita na wallet.'
      : 'Analise confirmada. Nenhuma assinatura e necessaria para este fluxo somente leitura.',
  };
}

export function confirmWalletAgentIntent(
  result: WalletAgentCoreResult,
  now = new Date()
): WalletAgentCoreResult {
  const confirmationCheck = canConfirmWalletAgentIntent(result);

  if (!confirmationCheck.allowed) {
    return result;
  }

  const nextApprovalStep: WalletAgentApprovalStep = isValueMovingIntent(result.draft.type)
    ? 'wallet_signature_required'
    : 'user_confirmed_in_app';
  const confirmation: WalletAgentInternalConfirmation = {
    confirmed: true,
    confirmedAt: now.toISOString(),
    confirmationId: `wac_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    nextApprovalStep,
  };
  const draft = {
    ...result.draft,
    approvalStep: nextApprovalStep,
    internalConfirmation: confirmation,
  };
  const transactionProposal = createWalletAgentTransactionProposal(draft, now);
  const proposalReady = transactionProposal?.status === 'ready_for_wallet_signature';

  return {
    ...result,
    draft: {
      ...draft,
      transactionProposal,
    },
    safety: {
      ...result.safety,
      status: proposalReady
        ? 'ready_for_wallet_signature'
        : result.safety.status,
      reason: proposalReady
        ? confirmationCheck.reason
        : transactionProposal
          ? 'Confirmacao interna registrada. A proposta ainda precisa de dados completos antes da assinatura.'
          : confirmationCheck.reason,
    },
    review: {
      ...result.review,
      subtitle: confirmationCheck.reason,
      items: result.review.items.map(item => item.label === 'Parser'
        ? item
        : item),
      requiredBeforeExecution: result.review.requiredBeforeExecution.map(item =>
        item.includes('Pedir confirmacao interna')
          ? 'Confirmacao interna registrada. Ainda falta assinatura explicita da wallet.'
          : item
      ),
    },
  };
}
