import type {
  WalletAgentCoreResult,
  WalletAgentDevnetReceipt,
} from './types';

const WALLET_AGENT_RECEIPTS_KEY = 'congchain.walletAgent.devnetReceipts.v1';
const MAX_RECEIPTS = 50;

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function createWalletAgentDevnetReceipt(
  result: WalletAgentCoreResult,
  now = new Date()
): WalletAgentDevnetReceipt | null {
  const { draft } = result;
  const submitted = draft.submittedTransaction;

  if (!submitted || submitted.network !== 'solana-devnet') return null;

  return {
    id: `war_${submitted.signature}`,
    intentId: draft.id,
    type: draft.type,
    network: 'solana-devnet',
    walletAddress: draft.walletAddress ?? null,
    recipientAddress: draft.preparedTransaction?.toAddress ?? draft.entities.recipientAddress,
    amountSol: draft.preparedTransaction?.amountSol ?? draft.entities.amountSol,
    signature: submitted.signature,
    explorerUrl: submitted.explorerUrl,
    confirmationStatus: submitted.confirmationStatus,
    submittedAt: submitted.submittedAt,
    confirmedAt: submitted.confirmedAt,
    slot: submitted.slot,
    savedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    summary: draft.summary,
  };
}

export function readWalletAgentDevnetReceipts(): WalletAgentDevnetReceipt[] {
  if (!canUseLocalStorage()) return [];

  try {
    const raw = window.localStorage.getItem(WALLET_AGENT_RECEIPTS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is WalletAgentDevnetReceipt => !!item && typeof item.signature === 'string')
      .slice(0, MAX_RECEIPTS);
  } catch {
    return [];
  }
}

export function upsertWalletAgentDevnetReceipt(receipt: WalletAgentDevnetReceipt): WalletAgentDevnetReceipt[] {
  if (!canUseLocalStorage()) return [];

  const current = readWalletAgentDevnetReceipts();
  const existing = current.find(item => item.signature === receipt.signature);
  const nextReceipt = existing
    ? { ...receipt, savedAt: existing.savedAt }
    : receipt;
  const next = [
    nextReceipt,
    ...current.filter(item => item.signature !== receipt.signature),
  ].slice(0, MAX_RECEIPTS);

  window.localStorage.setItem(WALLET_AGENT_RECEIPTS_KEY, JSON.stringify(next));
  return next;
}

export function saveWalletAgentDevnetReceipt(result: WalletAgentCoreResult): WalletAgentDevnetReceipt | null {
  const receipt = createWalletAgentDevnetReceipt(result);
  if (!receipt) return null;

  upsertWalletAgentDevnetReceipt(receipt);
  return receipt;
}
