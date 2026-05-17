import type {
  WalletAgentAlertHistoryStorageMode,
  WalletAgentAlertPersistenceRecord,
  WalletAgentAlertServerHistory,
  WalletAgentAlertServerReceipt,
} from './types';
import { db } from '@/lib/db';

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

function isDatabaseAdapterEnabled() {
  return process.env.WALLET_AGENT_ALERT_DATABASE_ADAPTER === 'enabled';
}

export function getWalletAgentAlertHistoryStorageConfig(): WalletAgentAlertHistoryStorageConfig {
  const requestedMode = getRequestedStorageMode();
  const databaseUrl = process.env.WALLET_AGENT_ALERTS_DATABASE_URL || process.env.DATABASE_URL;
  const databaseRequested = requestedMode === 'database';
  const databaseConfigured = databaseRequested && isPostgresUrl(databaseUrl);
  const databaseAdapterReady = databaseConfigured && isDatabaseAdapterEnabled();

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
    activeMode: databaseAdapterReady ? 'database' : 'memory',
    databaseRequested,
    databaseConfigured,
    databaseAdapterReady,
    durable: databaseAdapterReady,
    reason: databaseAdapterReady
      ? 'Database storage is configured and the Prisma adapter is enabled. Alert history is durable metadata storage.'
      : 'Database storage is configured, but the Prisma adapter is not enabled. Falling back to bounded memory.',
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

function createHistoryFromMetrics(input: {
  ownerEmail: string;
  total: number;
  sent: number;
  failed: number;
  uniqueTargets: number;
  providers: string[];
  latestEventAt: string | null;
  latestSentAt: string | null;
  latestFailedAt: string | null;
  recentReceipts: WalletAgentAlertServerReceipt[];
  storage: WalletAgentAlertServerHistory['storage'];
}): WalletAgentAlertServerHistory {
  return {
    ownerEmail: normalizeEmail(input.ownerEmail),
    total: input.total,
    sent: input.sent,
    failed: input.failed,
    uniqueTargets: input.uniqueTargets,
    providers: input.providers,
    latestEventAt: input.latestEventAt,
    latestSentAt: input.latestSentAt,
    latestFailedAt: input.latestFailedAt,
    recentReceipts: input.recentReceipts,
    storage: input.storage,
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

function createServerReceiptFromRecord(
  record: WalletAgentAlertPersistenceRecord,
  ownerEmail: string,
  storage: WalletAgentAlertServerReceipt['storage'],
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
    storage,
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

type WalletAgentAlertReceiptRow = {
  id: string;
  ownerEmail: string;
  recordId: string;
  deliveryId: string;
  ruleId: string;
  draftId: string;
  receiptId: string;
  receiptStatus: string;
  target: string;
  provider: string;
  title: string;
  message: string;
  eventAt: Date;
  storageMode: string;
  storageReason: string;
  safetyNotes: unknown;
  metadataOnly: boolean;
  canStoreSecrets: boolean;
  canExecuteTransaction: boolean;
  canSchedule: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toServerReceipt(row: WalletAgentAlertReceiptRow): WalletAgentAlertServerReceipt {
  const safetyNotes = Array.isArray(row.safetyNotes)
    ? row.safetyNotes.filter((note): note is string => typeof note === 'string')
    : [];

  return {
    id: row.id,
    ownerEmail: row.ownerEmail,
    recordId: row.recordId,
    deliveryId: row.deliveryId,
    ruleId: row.ruleId,
    draftId: row.draftId,
    receiptId: row.receiptId,
    receiptStatus: row.receiptStatus === 'failed' ? 'failed' : 'sent',
    target: row.target,
    provider: row.provider,
    title: row.title,
    message: row.message,
    eventAt: row.eventAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    storage: {
      mode: row.storageMode === 'database' ? 'database' : 'memory',
      durable: row.storageMode === 'database',
      persisted: true,
      reason: row.storageReason,
    },
    safety: {
      metadataOnly: true,
      canStoreSecrets: false,
      canExecuteTransaction: false,
      canSchedule: false,
      notes: safetyNotes.length > 0 ? safetyNotes : [
        'Database receipt storage contains alert metadata only.',
        'No wallet keys, seed phrases, signed payloads, or private transaction data are stored.',
        'Stored receipts cannot resend email, schedule jobs, request wallet signatures, or execute transactions.',
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
    return createServerReceiptFromRecord(record, ownerEmail, {
      mode: 'memory',
      durable: false,
      persisted: true,
      reason: 'Stored in bounded server memory only. This is not durable database persistence.',
    }, now);
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

const databaseAlertHistoryStorageAdapter: WalletAgentAlertHistoryStorageAdapter = {
  id: 'database',
  durable: true,
  createReceipt(
    record: WalletAgentAlertPersistenceRecord,
    ownerEmail: string,
    now = new Date()
  ) {
    return createServerReceiptFromRecord(record, ownerEmail, {
      mode: 'database',
      durable: true,
      persisted: true,
      reason: 'Stored in durable Postgres metadata storage through the Prisma adapter.',
    }, now);
  },
  async readReceipts(ownerEmail: string) {
    const rows = await db.walletAgentAlertReceipt.findMany({
      where: { ownerEmail: normalizeEmail(ownerEmail) },
      orderBy: { eventAt: 'desc' },
      take: MAX_SERVER_RECEIPTS_PER_USER,
    });

    return rows.map(toServerReceipt);
  },
  async upsertReceipt(receipt: WalletAgentAlertServerReceipt) {
    await db.walletAgentAlertReceipt.upsert({
      where: {
        ownerEmail_receiptId: {
          ownerEmail: normalizeEmail(receipt.ownerEmail),
          receiptId: receipt.receiptId,
        },
      },
      create: {
        id: receipt.id,
        ownerEmail: normalizeEmail(receipt.ownerEmail),
        recordId: receipt.recordId,
        deliveryId: receipt.deliveryId,
        ruleId: receipt.ruleId,
        draftId: receipt.draftId,
        receiptId: receipt.receiptId,
        receiptStatus: receipt.receiptStatus,
        target: receipt.target,
        provider: receipt.provider,
        title: receipt.title,
        message: receipt.message,
        eventAt: new Date(receipt.eventAt),
        storageMode: 'database',
        storageReason: receipt.storage.reason,
        safetyNotes: receipt.safety.notes,
        metadataOnly: true,
        canStoreSecrets: false,
        canExecuteTransaction: false,
        canSchedule: false,
        createdAt: new Date(receipt.createdAt),
      },
      update: {
        recordId: receipt.recordId,
        deliveryId: receipt.deliveryId,
        ruleId: receipt.ruleId,
        draftId: receipt.draftId,
        receiptStatus: receipt.receiptStatus,
        target: receipt.target,
        provider: receipt.provider,
        title: receipt.title,
        message: receipt.message,
        eventAt: new Date(receipt.eventAt),
        storageMode: 'database',
        storageReason: receipt.storage.reason,
        safetyNotes: receipt.safety.notes,
        metadataOnly: true,
        canStoreSecrets: false,
        canExecuteTransaction: false,
        canSchedule: false,
      },
    });

    return this.readReceipts(receipt.ownerEmail);
  },
  async createHistory(ownerEmail: string, limit = 20) {
    const normalizedEmail = normalizeEmail(ownerEmail);
    const safeLimit = Math.max(1, Math.min(limit, MAX_SERVER_RECEIPTS_PER_USER));
    const [
      recentRows,
      total,
      sent,
      failed,
      providerRows,
      targetRows,
      latestEvent,
      latestSent,
      latestFailed,
    ] = await Promise.all([
      db.walletAgentAlertReceipt.findMany({
        where: { ownerEmail: normalizedEmail },
        orderBy: { eventAt: 'desc' },
        take: safeLimit,
      }),
      db.walletAgentAlertReceipt.count({ where: { ownerEmail: normalizedEmail } }),
      db.walletAgentAlertReceipt.count({ where: { ownerEmail: normalizedEmail, receiptStatus: 'sent' } }),
      db.walletAgentAlertReceipt.count({ where: { ownerEmail: normalizedEmail, receiptStatus: 'failed' } }),
      db.walletAgentAlertReceipt.findMany({
        where: { ownerEmail: normalizedEmail },
        distinct: ['provider'],
        select: { provider: true },
        orderBy: { provider: 'asc' },
      }),
      db.walletAgentAlertReceipt.findMany({
        where: { ownerEmail: normalizedEmail },
        distinct: ['target'],
        select: { target: true },
      }),
      db.walletAgentAlertReceipt.findFirst({
        where: { ownerEmail: normalizedEmail },
        orderBy: { eventAt: 'desc' },
        select: { eventAt: true },
      }),
      db.walletAgentAlertReceipt.findFirst({
        where: { ownerEmail: normalizedEmail, receiptStatus: 'sent' },
        orderBy: { eventAt: 'desc' },
        select: { eventAt: true },
      }),
      db.walletAgentAlertReceipt.findFirst({
        where: { ownerEmail: normalizedEmail, receiptStatus: 'failed' },
        orderBy: { eventAt: 'desc' },
        select: { eventAt: true },
      }),
    ]);

    return createHistoryFromMetrics({
      ownerEmail: normalizedEmail,
      total,
      sent,
      failed,
      uniqueTargets: targetRows.length,
      providers: providerRows.map(row => row.provider).sort(),
      latestEventAt: latestEvent?.eventAt.toISOString() ?? null,
      latestSentAt: latestSent?.eventAt.toISOString() ?? null,
      latestFailedAt: latestFailed?.eventAt.toISOString() ?? null,
      recentReceipts: recentRows.map(toServerReceipt),
      storage: {
      mode: 'database',
      durable: true,
      reason: 'History is derived from durable Postgres metadata storage through the Prisma adapter.',
      },
    });
  },
};

export function getWalletAgentAlertHistoryStorageAdapter() {
  const config = getWalletAgentAlertHistoryStorageConfig();
  if (config.activeMode === 'memory') return memoryAlertHistoryStorageAdapter;

  return databaseAlertHistoryStorageAdapter;
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
