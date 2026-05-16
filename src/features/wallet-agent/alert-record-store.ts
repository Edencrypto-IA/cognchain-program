import type {
  WalletAgentAlertPersistenceRecord,
  WalletAgentAlertServerReceipt,
} from './types';

const MAX_SERVER_RECEIPTS_PER_USER = 100;
const serverReceiptStore = new Map<string, WalletAgentAlertServerReceipt[]>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createWalletAgentAlertServerReceipt(
  record: WalletAgentAlertPersistenceRecord,
  ownerEmail: string,
  now = new Date()
): WalletAgentAlertServerReceipt | null {
  if (!record.receipt) return null;

  const timestamp = now.toISOString();
  const eventAt = record.receipt.sentAt ?? record.receipt.failedAt ?? record.receipt.updatedAt;

  return {
    id: `wasr_${record.receipt.id}`,
    ownerEmail: normalizeEmail(ownerEmail),
    recordId: record.id,
    deliveryId: record.deliveryId,
    ruleId: record.ruleId,
    draftId: record.draftId,
    receiptId: record.receipt.id,
    receiptStatus: record.receipt.status,
    target: record.receipt.target,
    provider: record.receipt.provider,
    title: record.receipt.title,
    message: record.receipt.message,
    eventAt,
    createdAt: timestamp,
    updatedAt: timestamp,
    storage: {
      mode: 'memory',
      durable: false,
      persisted: true,
      reason: 'Stored in bounded server memory only. This is not durable database persistence.',
    },
    safety: {
      metadataOnly: true,
      canStoreSecrets: false,
      canExecuteTransaction: false,
      canSchedule: false,
      notes: [
        'Server receipt storage contains alert metadata only.',
        'No wallet keys, seed phrases, signed payloads, or private transaction data are stored.',
        'Stored receipts cannot resend email, schedule jobs, request wallet signatures, or execute transactions.',
      ],
    },
  };
}

export function readWalletAgentAlertServerReceipts(ownerEmail: string): WalletAgentAlertServerReceipt[] {
  return [...(serverReceiptStore.get(normalizeEmail(ownerEmail)) ?? [])];
}

export function upsertWalletAgentAlertServerReceipt(
  receipt: WalletAgentAlertServerReceipt
): WalletAgentAlertServerReceipt[] {
  const ownerEmail = normalizeEmail(receipt.ownerEmail);
  const current = serverReceiptStore.get(ownerEmail) ?? [];
  const existing = current.find(item => item.receiptId === receipt.receiptId);
  const nextReceipt = existing
    ? { ...receipt, createdAt: existing.createdAt }
    : receipt;
  const next = [
    nextReceipt,
    ...current.filter(item => item.receiptId !== receipt.receiptId),
  ].slice(0, MAX_SERVER_RECEIPTS_PER_USER);

  serverReceiptStore.set(ownerEmail, next);
  return [...next];
}
