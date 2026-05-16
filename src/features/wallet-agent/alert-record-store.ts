import type {
  WalletAgentAlertPersistenceRecord,
  WalletAgentAlertServerHistory,
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

function latest(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => !!value)
    .sort()
    .at(-1) ?? null;
}

export function createWalletAgentAlertServerHistory(
  ownerEmail: string,
  limit = 20
): WalletAgentAlertServerHistory {
  const normalizedEmail = normalizeEmail(ownerEmail);
  const receipts = readWalletAgentAlertServerReceipts(normalizedEmail);
  const providers = Array.from(new Set(receipts.map(receipt => receipt.provider))).sort();
  const targets = new Set(receipts.map(receipt => receipt.target.toLowerCase()));
  const sentReceipts = receipts.filter(receipt => receipt.receiptStatus === 'sent');
  const failedReceipts = receipts.filter(receipt => receipt.receiptStatus === 'failed');

  return {
    ownerEmail: normalizedEmail,
    total: receipts.length,
    sent: sentReceipts.length,
    failed: failedReceipts.length,
    uniqueTargets: targets.size,
    providers,
    latestEventAt: latest(receipts.map(receipt => receipt.eventAt)),
    latestSentAt: latest(sentReceipts.map(receipt => receipt.eventAt)),
    latestFailedAt: latest(failedReceipts.map(receipt => receipt.eventAt)),
    recentReceipts: receipts.slice(0, Math.max(1, Math.min(limit, MAX_SERVER_RECEIPTS_PER_USER))),
    storage: {
      mode: 'memory',
      durable: false,
      reason: 'History is derived from bounded server memory only. This is not durable database history.',
    },
    safety: {
      metadataOnly: true,
      canStoreSecrets: false,
      canExecuteTransaction: false,
      canSchedule: false,
      notes: [
        'Alert history is a read-only summary of metadata receipts.',
        'No wallet secrets, seed phrases, signed payloads, or private transaction data are returned.',
        'History cannot resend email, schedule jobs, request wallet signatures, or execute transactions.',
      ],
    },
  };
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
