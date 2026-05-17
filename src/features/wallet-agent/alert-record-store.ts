import type {
  WalletAgentAlertHistoryStorageMode,
  WalletAgentAlertPersistenceRecord,
  WalletAgentAlertServerHistory,
  WalletAgentAlertServerReceipt,
} from './types';

const MAX_SERVER_RECEIPTS_PER_USER = 100;
const serverReceiptStore = new Map<string, WalletAgentAlertServerReceipt[]>();

export type WalletAgentAlertHistoryStorageConfig = {
  requestedMode: WalletAgentAlertHistoryStorageMode;
  activeMode: WalletAgentAlertHistoryStorageMode;
  databaseRequested: boolean;
  databaseConfigured: boolean;
  databaseAdapterReady: boolean;
  durable: boolean;
  reason: string;
};

export type WalletAgentAlertHistoryStorageAdapter = {
  id: WalletAgentAlertHistoryStorageMode;
  durable: boolean;
  createReceipt: (
    record: WalletAgentAlertPersistenceRecord,
    ownerEmail: string,
    now?: Date
  ) => WalletAgentAlertServerReceipt | null;
  readReceipts: (ownerEmail: string) => Promise<WalletAgentAlertServerReceipt[]>;
  upsertReceipt: (receipt: WalletAgentAlertServerReceipt) => Promise<WalletAgentAlertServerReceipt[]>;
  createHistory: (ownerEmail: string, limit?: number) => Promise<WalletAgentAlertServerHistory>;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isPostgresUrl(value: string | undefined) {
  return !!value && (value.startsWith('postgresql://') || value.startsWith('postgres://'));
}

function getRequestedStorageMode(): WalletAgentAlertHistoryStorageMode {
  return process.env.WALLET_AGENT_ALERT_HISTORY_STORAGE === 'database'
    || process.env.WALLET_AGENT_ALERT_PERSISTENCE === 'enabled'
    || !!process.env.WALLET_AGENT_ALERTS_DATABASE_URL
    ? 'database'
    : 'memory';
}

export function getWalletAgentAlertHistoryStorageConfig(): WalletAgentAlertHistoryStorageConfig {
  const requestedMode = getRequestedStorageMode();
  const databaseUrl = process.env.WALLET_AGENT_ALERTS_DATABASE_URL || process.env.DATABASE_URL;
  const databaseRequested = requestedMode === 'database';
  const databaseConfigured = databaseRequested && isPostgresUrl(databaseUrl);
  const databaseAdapterReady = false;

  if (!databaseRequested) {
    return {
      requestedMode,
      activeMode: 'memory',
      databaseRequested,
      databaseConfigured: false,
      databaseAdapterReady,
      durable: false,
      reason: 'Database storage was not requested. Wallet Agent alert history is using bounded memory.',
    };
  }

  if (!databaseConfigured) {
    return {
      requestedMode,
      activeMode: 'memory',
      databaseRequested,
      databaseConfigured,
      databaseAdapterReady,
      durable: false,
      reason: 'Database storage was requested, but no valid Postgres URL is configured. Falling back to bounded memory.',
    };
  }

  return {
    requestedMode,
    activeMode: 'memory',
    databaseRequested,
    databaseConfigured,
    databaseAdapterReady,
    durable: false,
    reason: 'Database storage is configured, but the Prisma adapter is not enabled in this phase. Falling back to bounded memory.',
  };
}

function latest(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => !!value)
    .sort()
    .at(-1) ?? null;
}

function createHistoryFromReceipts(
  ownerEmail: string,
  receipts: WalletAgentAlertServerReceipt[],
  limit: number,
  storage: WalletAgentAlertServerHistory['storage']
): WalletAgentAlertServerHistory {
  const normalizedEmail = normalizeEmail(ownerEmail);
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
    storage,
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

const memoryAlertHistoryStorageAdapter: WalletAgentAlertHistoryStorageAdapter = {
  id: 'memory',
  durable: false,
  createReceipt(
    record: WalletAgentAlertPersistenceRecord,
    ownerEmail: string,
    now = new Date()
  ) {
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
  },
  async readReceipts(ownerEmail: string) {
    return [...(serverReceiptStore.get(normalizeEmail(ownerEmail)) ?? [])];
  },
  async upsertReceipt(receipt: WalletAgentAlertServerReceipt) {
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
  },
  async createHistory(ownerEmail: string, limit = 20) {
    const receipts = await this.readReceipts(ownerEmail);

    return createHistoryFromReceipts(ownerEmail, receipts, limit, {
      mode: 'memory',
      durable: false,
      reason: 'History is derived from bounded server memory only. This is not durable database history.',
    });
  },
};

export function getWalletAgentAlertHistoryStorageAdapter() {
  const config = getWalletAgentAlertHistoryStorageConfig();
  if (config.activeMode === 'memory') return memoryAlertHistoryStorageAdapter;

  return memoryAlertHistoryStorageAdapter;
}

export function createWalletAgentAlertServerReceipt(
  record: WalletAgentAlertPersistenceRecord,
  ownerEmail: string,
  now = new Date()
): WalletAgentAlertServerReceipt | null {
  return getWalletAgentAlertHistoryStorageAdapter().createReceipt(record, ownerEmail, now);
}

export async function readWalletAgentAlertServerReceipts(
  ownerEmail: string
): Promise<WalletAgentAlertServerReceipt[]> {
  return getWalletAgentAlertHistoryStorageAdapter().readReceipts(ownerEmail);
}

export async function createWalletAgentAlertServerHistory(
  ownerEmail: string,
  limit = 20
): Promise<WalletAgentAlertServerHistory> {
  return getWalletAgentAlertHistoryStorageAdapter().createHistory(ownerEmail, limit);
}

export async function upsertWalletAgentAlertServerReceipt(
  receipt: WalletAgentAlertServerReceipt
): Promise<WalletAgentAlertServerReceipt[]> {
  return getWalletAgentAlertHistoryStorageAdapter().upsertReceipt(receipt);
}
