import type {
  WalletAgentCoreResult,
  WalletAgentHistoryEntry,
  WalletAgentHistoryStatus,
} from './types';

const WALLET_AGENT_HISTORY_KEY = 'congchain.walletAgent.intentHistory.v1';
const MAX_HISTORY_ITEMS = 30;

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function createWalletAgentHistoryEntry(
  result: WalletAgentCoreResult,
  status: WalletAgentHistoryStatus
): WalletAgentHistoryEntry {
  const { draft } = result;

  return {
    id: draft.id,
    status,
    type: draft.type,
    network: draft.network,
    summary: draft.summary,
    tokenSymbol: draft.entities.tokenSymbol,
    amountSol: draft.entities.amountSol,
    targetPriceUsd: draft.entities.targetPriceUsd,
    riskLevel: draft.riskLevel,
    createdAt: draft.createdAt,
    updatedAt: new Date().toISOString(),
    confirmationId: draft.internalConfirmation?.confirmationId,
    walletAddress: draft.walletSnapshot?.address ?? draft.walletAddress ?? null,
    walletSource: draft.walletSnapshot?.source,
    walletBalanceSol: draft.walletSnapshot?.balanceSol,
    transactionProposalStatus: draft.transactionProposal?.status,
    preparedTransactionStatus: draft.preparedTransaction?.status,
  };
}

export function readWalletAgentHistory(): WalletAgentHistoryEntry[] {
  if (!canUseLocalStorage()) return [];

  try {
    const raw = window.localStorage.getItem(WALLET_AGENT_HISTORY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is WalletAgentHistoryEntry => !!item && typeof item.id === 'string')
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

export function upsertWalletAgentHistory(entry: WalletAgentHistoryEntry): WalletAgentHistoryEntry[] {
  if (!canUseLocalStorage()) return [];

  const current = readWalletAgentHistory();
  const next = [
    entry,
    ...current.filter(item => item.id !== entry.id),
  ].slice(0, MAX_HISTORY_ITEMS);

  window.localStorage.setItem(WALLET_AGENT_HISTORY_KEY, JSON.stringify(next));
  return next;
}
