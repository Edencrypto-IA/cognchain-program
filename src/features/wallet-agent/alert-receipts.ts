import type {
  WalletAgentAlertDelivery,
  WalletAgentAlertDeliveryReceipt,
  WalletAgentAlertDeliveryReceiptStats,
} from './types';

const WALLET_AGENT_ALERT_RECEIPTS_KEY = 'congchain.walletAgent.alertReceipts.v1';
const MAX_ALERT_RECEIPTS = 50;

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getEmailTarget(delivery: WalletAgentAlertDelivery) {
  return delivery.channels.find(channel => channel.channel === 'email')?.target ?? null;
}

export function createWalletAgentAlertDeliveryReceipt(
  delivery: WalletAgentAlertDelivery,
  provider = 'resend',
  now = new Date()
): WalletAgentAlertDeliveryReceipt | null {
  if (delivery.status !== 'sent') return null;

  const target = getEmailTarget(delivery);
  if (!target) return null;

  return {
    id: `waer_${delivery.id}`,
    deliveryId: delivery.id,
    draftId: delivery.draftId,
    ruleId: delivery.ruleId,
    channel: 'email',
    provider,
    target,
    status: 'sent',
    title: delivery.title,
    message: delivery.message,
    sentAt: delivery.updatedAt,
    savedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    safetyNotes: [
      'Email was sent only after explicit user action.',
      'No wallet signature was requested.',
      'No transaction was prepared, signed, or submitted.',
      'No scheduler or background automation was created.',
    ],
  };
}

export function readWalletAgentAlertDeliveryReceipts(): WalletAgentAlertDeliveryReceipt[] {
  if (!canUseLocalStorage()) return [];

  try {
    const raw = window.localStorage.getItem(WALLET_AGENT_ALERT_RECEIPTS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is WalletAgentAlertDeliveryReceipt => (
        !!item
        && typeof item.id === 'string'
        && typeof item.deliveryId === 'string'
        && item.channel === 'email'
        && item.status === 'sent'
      ))
      .slice(0, MAX_ALERT_RECEIPTS);
  } catch {
    return [];
  }
}

export function summarizeWalletAgentAlertDeliveryReceipts(
  receipts: WalletAgentAlertDeliveryReceipt[]
): WalletAgentAlertDeliveryReceiptStats {
  const providers = Array.from(new Set(receipts.map(receipt => receipt.provider))).sort();
  const targets = new Set(receipts.map(receipt => receipt.target.toLowerCase()));
  const lastSentAt = receipts
    .map(receipt => receipt.sentAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  return {
    totalSent: receipts.length,
    uniqueTargets: targets.size,
    providers,
    lastSentAt,
  };
}

export function upsertWalletAgentAlertDeliveryReceipt(
  receipt: WalletAgentAlertDeliveryReceipt
): WalletAgentAlertDeliveryReceipt[] {
  if (!canUseLocalStorage()) return [];

  const current = readWalletAgentAlertDeliveryReceipts();
  const existing = current.find(item => item.deliveryId === receipt.deliveryId);
  const nextReceipt = existing
    ? { ...receipt, savedAt: existing.savedAt }
    : receipt;
  const next = [
    nextReceipt,
    ...current.filter(item => item.deliveryId !== receipt.deliveryId),
  ].slice(0, MAX_ALERT_RECEIPTS);

  window.localStorage.setItem(WALLET_AGENT_ALERT_RECEIPTS_KEY, JSON.stringify(next));
  return next;
}

export function saveWalletAgentAlertDeliveryReceipt(
  delivery: WalletAgentAlertDelivery,
  provider = 'resend'
): WalletAgentAlertDeliveryReceipt | null {
  const receipt = createWalletAgentAlertDeliveryReceipt(delivery, provider);
  if (!receipt) return null;

  upsertWalletAgentAlertDeliveryReceipt(receipt);
  return receipt;
}
