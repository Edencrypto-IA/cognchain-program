import type {
  WalletAgentAlertDelivery,
  WalletAgentAlertDeliveryReceipt,
  WalletAgentAlertPersistenceRecord,
} from './types';
import { getWalletAgentAlertHistoryStorageConfig } from './alert-record-store';

type AlertRecordUser = {
  email: string;
  verified: boolean;
} | null;

type CreateAlertRecordInput = {
  delivery: WalletAgentAlertDelivery;
  receipt?: WalletAgentAlertDeliveryReceipt | null;
  user?: AlertRecordUser;
  now?: Date;
};

export function isWalletAgentAlertPersistenceBackendConfigured() {
  return getWalletAgentAlertHistoryStorageConfig().databaseConfigured;
}

export function createWalletAgentAlertPersistenceRecordContract({
  delivery,
  receipt = null,
  user = null,
  now = new Date(),
}: CreateAlertRecordInput): WalletAgentAlertPersistenceRecord {
  const backendConfigured = isWalletAgentAlertPersistenceBackendConfigured();
  const storageConfig = getWalletAgentAlertHistoryStorageConfig();
  const timestamp = now.toISOString();
  const canPersistMetadata = !!user?.email && user.verified && backendConfigured;

  return {
    id: `waar_${delivery.id}_${now.getTime()}`,
    deliveryId: delivery.id,
    ruleId: delivery.ruleId,
    draftId: delivery.draftId,
    userEmail: user?.email ?? null,
    userVerified: !!user?.verified,
    status: canPersistMetadata ? 'prepared' : 'blocked',
    createdAt: timestamp,
    updatedAt: timestamp,
    delivery,
    receipt,
    persistence: {
      mode: backendConfigured ? 'database' : 'contract_only',
      persisted: false,
      backendConfigured,
      reason: backendConfigured
        ? storageConfig.reason
        : 'Persistence backend is not configured. This phase returns a safe contract only.',
    },
    safety: {
      canPersistMetadata,
      canStoreSecrets: false,
      canExecuteTransaction: false,
      canSchedule: false,
      notes: [
        'Alert persistence records are metadata only.',
        'No private keys, seed phrases, signed payloads, or wallet secrets may be stored.',
        'Persistence cannot trigger email delivery, scheduling, wallet approval, or transactions.',
        user?.email
          ? 'User email identity is attached as metadata for future account-owned history.'
          : 'No user email identity was attached to this record.',
      ],
    },
    blockedActions: [
      'Do not store private keys, seed phrases, or signed transaction payloads.',
      'Do not execute wallet actions from persistence.',
      'Do not schedule background jobs from persistence.',
      'Do not resend email from a persisted record.',
      'Do not treat contract_only responses as durable backend storage.',
    ],
  };
}
