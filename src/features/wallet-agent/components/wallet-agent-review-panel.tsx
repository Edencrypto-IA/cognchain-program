'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Eye,
  FileCheck2,
  LockKeyhole,
  Mail,
  PauseCircle,
  PlayCircle,
  Send,
  ShieldCheck,
  Trash2,
  Wallet,
  Zap,
  X,
} from 'lucide-react';
import type {
  WalletAgentAlertDelivery,
  WalletAgentAlertDeliveryReceipt,
  WalletAgentAlertHistoryAuditEvent,
  WalletAgentAlertHistoryExportBundle,
  WalletAgentAlertPersistenceRecord,
  WalletAgentAlertServerHistory,
  WalletAgentAlertServerReceipt,
  WalletAgentCoreResult,
  WalletAgentDevnetReceipt,
  WalletAgentHistoryEntry,
  WalletAgentLocalNotificationDraft,
  WalletAgentLocalNotificationPreferences,
  WalletAgentLocalRule,
  WalletAgentLocalRuleReviewContext,
  WalletAgentLocalRuleSimulation,
  WalletAgentReviewItem,
} from '../types';
import { canConfirmWalletAgentIntent } from '../confirmation';
import {
  readWalletAgentAlertDeliveryReceipts,
  saveWalletAgentAlertDeliveryFailureReceipt,
  saveWalletAgentAlertDeliveryReceipt,
  summarizeWalletAgentAlertDeliveryReceipts,
} from '../alert-receipts';
import { readWalletAgentDevnetReceipts } from '../receipts';
import {
  createWalletAgentLocalNotificationDraft,
  createWalletAgentRuleReviewContext,
  isWalletAgentNotificationEmailValid,
  readWalletAgentLocalRules,
  readWalletAgentNotificationPreferences,
  removeWalletAgentLocalRule,
  saveWalletAgentNotificationPreferences,
  setWalletAgentLocalRuleStatus,
  simulateWalletAgentLocalRule,
} from '../rules';

type WalletAgentReviewPanelProps = {
  result: WalletAgentCoreResult;
  onClose: () => void;
  onConfirm: (result: WalletAgentCoreResult) => void;
  onPrepareTransaction?: (result: WalletAgentCoreResult) => void;
  onSignTransaction?: (result: WalletAgentCoreResult) => void;
  onSubmitTransaction?: (result: WalletAgentCoreResult) => void;
  onConfirmTransaction?: (result: WalletAgentCoreResult) => void;
  onSendNotificationDraft?: (draft: WalletAgentLocalNotificationDraft, rule: WalletAgentLocalRule) => void;
  history?: WalletAgentHistoryEntry[];
};

const STATUS_STYLES: Record<WalletAgentReviewItem['status'], { label: string; className: string }> = {
  ready: {
    label: 'pronto',
    className: 'border-[#14F195]/22 bg-[#14F195]/10 text-[#14F195]',
  },
  missing: {
    label: 'faltando',
    className: 'border-[#FF5C7A]/24 bg-[#FF5C7A]/10 text-[#FF8A9E]',
  },
  review: {
    label: 'revisar',
    className: 'border-[#F5A524]/24 bg-[#F5A524]/10 text-[#F5A524]',
  },
};

function ReviewItem({ item }: { item: WalletAgentReviewItem }) {
  const status = STATUS_STYLES[item.status];

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34">{item.label}</p>
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${status.className}`}>
          {status.label}
        </span>
      </div>
      <p className="break-words text-sm leading-relaxed text-white/72">{item.value}</p>
    </div>
  );
}

function TransactionJourney({ result }: { result: WalletAgentCoreResult }) {
  const { draft } = result;
  const finalized = draft.submittedTransaction?.confirmationStatus === 'finalized';
  const confirmed = finalized || draft.submittedTransaction?.confirmationStatus === 'confirmed';
  const journey = [
    {
      label: 'Intencao',
      detail: 'Comando entendido',
      done: true,
      active: !draft.internalConfirmation,
    },
    {
      label: 'Revisao',
      detail: 'Confirmacao no app',
      done: !!draft.internalConfirmation,
      active: !!draft.internalConfirmation && !draft.transactionProposal,
    },
    {
      label: 'Proposta',
      detail: draft.transactionProposal?.status.replaceAll('_', ' ') ?? 'Aguardando',
      done: !!draft.transactionProposal,
      active: !!draft.transactionProposal && !draft.preparedTransaction,
    },
    {
      label: 'Preparada',
      detail: draft.preparedTransaction ? 'Payload sem assinatura' : 'Aguardando',
      done: !!draft.preparedTransaction,
      active: !!draft.preparedTransaction && !draft.signedTransaction,
    },
    {
      label: 'Assinada',
      detail: draft.signedTransaction ? 'Wallet aprovou' : 'Aguardando wallet',
      done: !!draft.signedTransaction,
      active: !!draft.signedTransaction && !draft.submittedTransaction,
    },
    {
      label: 'Devnet',
      detail: draft.submittedTransaction?.confirmationStatus ?? 'Nao enviada',
      done: !!draft.submittedTransaction,
      active: !!draft.submittedTransaction && !confirmed,
    },
    {
      label: 'Final',
      detail: finalized ? 'Finalizada' : confirmed ? 'Confirmada' : 'Pendente',
      done: confirmed,
      active: confirmed,
    },
  ];

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.045] via-white/[0.02] to-[#00D1FF]/[0.035] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/48">Transaction Journey</p>
          <p className="mt-1 text-sm leading-relaxed text-white/48">Cada etapa exige uma acao visivel do usuario.</p>
        </div>
        <span className="rounded-full border border-[#14F195]/18 bg-[#14F195]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#14F195]">
          Devnet only
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
        {journey.map((step, index) => (
          <div
            key={step.label}
            className={`relative rounded-2xl border p-3 transition-colors ${
              step.done
                ? 'border-[#14F195]/18 bg-[#14F195]/[0.07]'
                : step.active
                  ? 'border-[#5AD7FF]/24 bg-[#5AD7FF]/[0.07]'
                  : 'border-white/[0.06] bg-black/18'
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold ${
                step.done
                  ? 'border-[#14F195]/25 bg-[#14F195]/12 text-[#14F195]'
                  : step.active
                    ? 'border-[#5AD7FF]/25 bg-[#5AD7FF]/12 text-[#7DE3FF]'
                    : 'border-white/[0.08] bg-white/[0.03] text-white/34'
              }`}>
                {step.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
              </span>
              {step.active && !step.done && <span className="h-1.5 w-1.5 rounded-full bg-[#5AD7FF] shadow-[0_0_14px_rgba(90,215,255,0.9)]" />}
            </div>
            <p className="text-xs font-semibold text-white/72">{step.label}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/38">{step.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildTransactionSummary(result: WalletAgentCoreResult) {
  const { draft } = result;
  const submitted = draft.submittedTransaction;
  const prepared = draft.preparedTransaction;

  return [
    'CONGCHAIN Wallet Agent Transaction Summary',
    '',
    `Intent: ${draft.type}`,
    `Network: ${draft.network}`,
    `Wallet: ${draft.walletAddress ?? 'not connected'}`,
    `Recipient: ${prepared?.toAddress ?? draft.entities.recipientAddress ?? 'not provided'}`,
    `Amount: ${prepared?.amountSol ?? draft.entities.amountSol ?? 'not provided'} SOL`,
    `Risk: ${draft.riskLevel}`,
    `Proposal: ${draft.transactionProposal?.status ?? 'not created'}`,
    `Prepared: ${draft.preparedTransaction?.status ?? 'not prepared'}`,
    `Signed: ${draft.signedTransaction?.status ?? 'not signed'}`,
    `Submitted: ${submitted?.status ?? 'not submitted'}`,
    `Confirmation: ${submitted?.confirmationStatus ?? 'not checked'}`,
    submitted?.signature ? `Signature: ${submitted.signature}` : null,
    submitted?.explorerUrl ? `Explorer: ${submitted.explorerUrl}` : null,
    submitted?.slot ? `Slot: ${submitted.slot}` : null,
    '',
    'Safety: no mainnet action in this flow. Every value-moving stage requires visible user approval.',
  ].filter(Boolean).join('\n');
}

function formatReceiptDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function shortenSignature(signature: string) {
  return `${signature.slice(0, 8)}...${signature.slice(-8)}`;
}

function buildReceiptSummary(receipt: WalletAgentDevnetReceipt) {
  return [
    'CONGCHAIN Devnet Transaction Receipt',
    '',
    `Receipt ID: ${receipt.id}`,
    `Intent ID: ${receipt.intentId}`,
    `Type: ${receipt.type}`,
    `Network: ${receipt.network}`,
    `Wallet: ${receipt.walletAddress ?? 'not connected'}`,
    `Recipient: ${receipt.recipientAddress ?? 'not provided'}`,
    `Amount: ${receipt.amountSol ?? 'not provided'} SOL`,
    `Signature: ${receipt.signature}`,
    `Status: ${receipt.confirmationStatus}`,
    receipt.slot ? `Slot: ${receipt.slot}` : null,
    `Submitted at: ${receipt.submittedAt}`,
    receipt.confirmedAt ? `Confirmed at: ${receipt.confirmedAt}` : null,
    `Saved locally at: ${receipt.savedAt}`,
    `Updated locally at: ${receipt.updatedAt}`,
    `Explorer: ${receipt.explorerUrl}`,
    '',
    `Summary: ${receipt.summary}`,
    '',
    'Safety: local browser receipt only. No private keys, seed phrases, or signed payloads are stored.',
  ].filter(Boolean).join('\n');
}

function buildRuleSummary(rule: WalletAgentLocalRule) {
  return [
    'CONGCHAIN Wallet Agent Local Rule',
    '',
    `Rule ID: ${rule.id}`,
    `Intent ID: ${rule.intentId}`,
    `Type: ${rule.type}`,
    `Status: ${rule.status}`,
    `Network: ${rule.network}`,
    `Wallet: ${rule.walletAddress ?? 'not connected'}`,
    `Trigger: ${rule.trigger.label}`,
    `Trigger kind: ${rule.trigger.kind}`,
    `Action: ${rule.action.label}`,
    `Action kind: ${rule.action.kind}`,
    `Requires wallet signature: ${rule.safety.requiresWalletSignature ? 'yes' : 'no'}`,
    `Can auto execute: ${rule.safety.canAutoExecute ? 'yes' : 'no'}`,
    rule.confirmationId ? `Confirmation ID: ${rule.confirmationId}` : null,
    `Created at: ${rule.createdAt}`,
    `Updated at: ${rule.updatedAt}`,
    '',
    `Summary: ${rule.summary}`,
    '',
    'Safety: local manual-review rule only. It cannot sign, submit, buy, sell, or pay by itself.',
  ].filter(Boolean).join('\n');
}

function buildRuleReviewContextSummary(context: WalletAgentLocalRuleReviewContext) {
  return [
    'CONGCHAIN Wallet Agent Rule Review Context',
    '',
    `Rule ID: ${context.ruleId}`,
    `Title: ${context.title}`,
    `Status: ${context.status}`,
    `Trigger: ${context.triggerLabel}`,
    `Action: ${context.actionLabel}`,
    `Generated at: ${context.generatedAt}`,
    '',
    'Operator summary:',
    context.operatorSummary,
    '',
    'Required review:',
    ...context.requiredReview.map(item => `- ${item}`),
    '',
    'Blocked actions:',
    ...context.blockedActions.map(item => `- ${item}`),
    '',
    'Safety notes:',
    ...context.safetyNotes.map(item => `- ${item}`),
  ].join('\n');
}

function buildRuleSimulationSummary(simulation: WalletAgentLocalRuleSimulation) {
  return [
    'CONGCHAIN Wallet Agent Rule Simulation',
    '',
    `Rule ID: ${simulation.ruleId}`,
    `Status: ${simulation.status}`,
    `Title: ${simulation.title}`,
    `Simulated at: ${simulation.simulatedAt}`,
    '',
    'Summary:',
    simulation.summary,
    '',
    'Observations:',
    ...simulation.observations.map(item => `- ${item}`),
    '',
    `Next manual step: ${simulation.nextManualStep}`,
    '',
    'Blocked actions:',
    ...simulation.blockedActions.map(item => `- ${item}`),
  ].join('\n');
}

function buildNotificationDraftSummary(draft: WalletAgentLocalNotificationDraft) {
  return [
    'CONGCHAIN Wallet Agent Notification Draft',
    '',
    `Draft ID: ${draft.id}`,
    `Rule ID: ${draft.ruleId}`,
    `Status: ${draft.status}`,
    `Channels: ${draft.channels.join(', ')}`,
    `Email: ${draft.emailVerifiedLocally ? draft.emailAddress : 'pending local verification'}`,
    `Email source: ${draft.emailSource ?? 'none'}`,
    `Email session verified: ${draft.emailSessionVerified ? 'yes' : 'no'}`,
    `Wallet action required: ${draft.walletActionRequired ? 'yes' : 'no'}`,
    `Created at: ${draft.createdAt}`,
    '',
    `Title: ${draft.title}`,
    '',
    'Message:',
    draft.message,
    '',
    'Delivery plan:',
    ...draft.deliveryPlan.map(item => `- ${item}`),
    '',
    'Blocked actions:',
    ...draft.blockedActions.map(item => `- ${item}`),
  ].join('\n');
}

function buildAlertDeliveryReceiptSummary(receipt: WalletAgentAlertDeliveryReceipt) {
  return [
    'CONGCHAIN Wallet Agent Alert Email Receipt',
    '',
    `Receipt ID: ${receipt.id}`,
    `Delivery ID: ${receipt.deliveryId}`,
    `Rule ID: ${receipt.ruleId}`,
    `Draft ID: ${receipt.draftId}`,
    `Channel: ${receipt.channel}`,
    `Provider: ${receipt.provider}`,
    `Target: ${receipt.target}`,
    `Status: ${receipt.status}`,
    receipt.sentAt ? `Sent at: ${receipt.sentAt}` : null,
    receipt.failedAt ? `Failed at: ${receipt.failedAt}` : null,
    receipt.failureReason ? `Failure reason: ${receipt.failureReason}` : null,
    `Saved locally at: ${receipt.savedAt}`,
    '',
    `Title: ${receipt.title}`,
    '',
    'Message:',
    receipt.message,
    '',
    'Safety notes:',
    ...receipt.safetyNotes.map(item => `- ${item}`),
  ].filter(Boolean).join('\n');
}

function buildServerAlertReceiptSummary(receipt: WalletAgentAlertServerReceipt) {
  return [
    'CONGCHAIN Wallet Agent Account Alert Receipt',
    '',
    `Server receipt ID: ${receipt.id}`,
    `Local receipt ID: ${receipt.receiptId}`,
    `Record ID: ${receipt.recordId}`,
    `Delivery ID: ${receipt.deliveryId}`,
    `Rule ID: ${receipt.ruleId}`,
    `Draft ID: ${receipt.draftId}`,
    `Owner email: ${receipt.ownerEmail}`,
    `Provider: ${receipt.provider}`,
    `Target: ${receipt.target}`,
    `Status: ${receipt.receiptStatus}`,
    `Event at: ${receipt.eventAt}`,
    `Stored at: ${receipt.createdAt}`,
    '',
    `Title: ${receipt.title}`,
    '',
    'Message:',
    receipt.message,
    '',
    `Storage: ${receipt.storage.reason}`,
    '',
    'Safety notes:',
    ...receipt.safety.notes.map(item => `- ${item}`),
  ].join('\n');
}

function buildLocalAlertHistorySummary(
  receipts: WalletAgentAlertDeliveryReceipt[],
  stats: ReturnType<typeof summarizeWalletAgentAlertDeliveryReceipts>
) {
  return [
    'CONGCHAIN Wallet Agent Local Alert History',
    '',
    'Source: local browser receipts',
    `Generated at: ${new Date().toISOString()}`,
    `Sent: ${stats.totalSent}`,
    `Failed: ${stats.totalFailed}`,
    `Unique targets: ${stats.uniqueTargets}`,
    `Providers: ${stats.providers.join(', ') || 'n/a'}`,
    stats.lastSentAt ? `Latest sent: ${stats.lastSentAt}` : null,
    stats.lastFailedAt ? `Latest failure: ${stats.lastFailedAt}` : null,
    '',
    'Recent receipts:',
    ...receipts.slice(0, 5).map((receipt, index) => [
      `${index + 1}. ${receipt.title}`,
      `   Receipt ID: ${receipt.id}`,
      `   Target: ${receipt.target}`,
      `   Provider: ${receipt.provider}`,
      `   Status: ${receipt.status}`,
      receipt.sentAt ? `   Sent at: ${receipt.sentAt}` : null,
      receipt.failedAt ? `   Failed at: ${receipt.failedAt}` : null,
      receipt.failureReason ? `   Failure reason: ${receipt.failureReason}` : null,
    ].filter(Boolean).join('\n')),
    '',
    'Safety: local receipt history is metadata-only. It cannot resend email, schedule jobs, request wallet signatures, or execute transactions.',
  ].filter(Boolean).join('\n');
}

function buildServerAlertHistorySummary(history: WalletAgentAlertServerHistory) {
  return [
    'CONGCHAIN Wallet Agent Account Alert History',
    '',
    `Owner email: ${history.ownerEmail}`,
    `Generated at: ${new Date().toISOString()}`,
    `Storage: ${history.storage.reason}`,
    `Total: ${history.total}`,
    `Sent: ${history.sent}`,
    `Failed: ${history.failed}`,
    `Unique targets: ${history.uniqueTargets}`,
    `Providers: ${history.providers.join(', ') || 'n/a'}`,
    history.latestSentAt ? `Latest sent: ${history.latestSentAt}` : null,
    history.latestFailedAt ? `Latest failure: ${history.latestFailedAt}` : null,
    '',
    'Recent account receipts:',
    ...history.recentReceipts.slice(0, 5).map((receipt, index) => [
      `${index + 1}. ${receipt.title}`,
      `   Server receipt ID: ${receipt.id}`,
      `   Local receipt ID: ${receipt.receiptId}`,
      `   Target: ${receipt.target}`,
      `   Provider: ${receipt.provider}`,
      `   Status: ${receipt.receiptStatus}`,
      `   Event at: ${receipt.eventAt}`,
    ].join('\n')),
    '',
    'Safety notes:',
    ...history.safety.notes.map(item => `- ${item}`),
  ].filter(Boolean).join('\n');
}

function createAlertHistoryExportFilename(source: 'account' | 'local', extension: 'json' | 'txt' = 'txt') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `congchain-wallet-agent-${source}-alert-history-${timestamp}.${extension}`;
}

function downloadTextFile(content: string, filename: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

const ALERT_HISTORY_DELETE_CONFIRMATION = 'DELETE ALERT HISTORY';

function getAuditEventLabel(event: WalletAgentAlertHistoryAuditEvent) {
  if (event.action === 'delete_history_completed') return 'Historico apagado';
  return 'Tentativa bloqueada';
}

function getAuditEventClass(event: WalletAgentAlertHistoryAuditEvent) {
  if (event.status === 'completed') {
    return 'border-[#14F195]/16 bg-[#14F195]/[0.055] text-[#14F195]';
  }

  return 'border-[#FF5C7A]/16 bg-[#FF5C7A]/[0.055] text-[#FF8A9E]';
}

function getAlertHistorySyncState(history: WalletAgentAlertServerHistory | null) {
  if (!history) {
    return {
      source: 'local',
      title: 'Local fallback',
      detail: 'Dados deste navegador. Verifique seu email para ativar historico da conta.',
      persistence: 'localStorage',
      identity: 'sem conta verificada',
      className: 'border-[#F5A524]/16 bg-[#F5A524]/[0.055] text-[#F5A524]',
    };
  }

  if (history.storage.durable) {
    return {
      source: 'database',
      title: 'Banco duravel',
      detail: 'Historico conectado a conta verificada e salvo em backend duravel.',
      persistence: 'duravel',
      identity: history.ownerEmail,
      className: 'border-[#14F195]/18 bg-[#14F195]/[0.07] text-[#14F195]',
    };
  }

  return {
    source: 'server-memory',
    title: 'Conta verificada',
    detail: 'Historico vinculado ao email, mas ainda em memoria do servidor.',
    persistence: 'memoria servidor',
    identity: history.ownerEmail,
    className: 'border-[#00D1FF]/16 bg-[#00D1FF]/[0.06] text-[#7DE3FF]',
  };
}

function getAlertHistoryHealthItems(
  history: WalletAgentAlertServerHistory | null,
  auditEvents: WalletAgentAlertHistoryAuditEvent[]
) {
  if (!history) {
    return [
      { label: 'Identidade', value: 'local only', tone: 'warn' },
      { label: 'Export', value: 'TXT local', tone: 'info' },
      { label: 'Delecao', value: 'n/a', tone: 'muted' },
      { label: 'Auditoria', value: 'n/a', tone: 'muted' },
    ] as const;
  }

  return [
    {
      label: 'Persistencia',
      value: history.storage.durable ? 'duravel' : 'memoria',
      tone: history.storage.durable ? 'ok' : 'info',
    },
    {
      label: 'Retencao',
      value: `${history.retention.retentionDays} dias`,
      tone: 'info',
    },
    {
      label: 'Export',
      value: 'JSON conta',
      tone: 'ok',
    },
    {
      label: 'Auditoria',
      value: `${auditEvents.length} recentes`,
      tone: auditEvents.length > 0 ? 'ok' : 'muted',
    },
  ] as const;
}

function getAlertHistoryHealthClass(tone: 'ok' | 'info' | 'warn' | 'muted') {
  if (tone === 'ok') return 'border-[#14F195]/16 bg-[#14F195]/[0.055] text-[#14F195]';
  if (tone === 'info') return 'border-[#00D1FF]/16 bg-[#00D1FF]/[0.055] text-[#7DE3FF]';
  if (tone === 'warn') return 'border-[#F5A524]/16 bg-[#F5A524]/[0.055] text-[#F5A524]';
  return 'border-white/[0.07] bg-white/[0.025] text-white/42';
}

function formatNotificationChannel(channel: WalletAgentLocalNotificationDraft['channels'][number]) {
  if (channel === 'congchain_chat') return 'chat CongChain';
  if (channel === 'email') return 'email';
  return 'carteira';
}

function getNotificationEmailStatus(preferences: WalletAgentLocalNotificationPreferences) {
  if (preferences.emailSource === 'cog_user' && preferences.emailSessionVerified) return 'conta verificada';
  if (preferences.emailSource === 'cog_user') return 'conta conectada';
  if (preferences.emailVerifiedLocally) return 'validado local';
  return 'pendente';
}

function getNotificationEmailStatusClass(preferences: WalletAgentLocalNotificationPreferences) {
  if (preferences.emailSource === 'cog_user' && preferences.emailSessionVerified) {
    return 'border-[#14F195]/18 bg-[#14F195]/10 text-[#14F195]';
  }

  if (preferences.emailVerifiedLocally) {
    return 'border-[#00D1FF]/18 bg-[#00D1FF]/10 text-[#7DE3FF]';
  }

  return 'border-[#F5A524]/18 bg-[#F5A524]/10 text-[#F5A524]';
}

function getRuleStatusClassName(status: WalletAgentLocalRule['status']) {
  if (status === 'paused') {
    return 'border-[#F5A524]/22 bg-[#F5A524]/10 text-[#F5A524]';
  }

  return 'border-[#9945FF]/20 bg-[#9945FF]/10 text-[#C4B5FD]';
}

function DevnetReceiptsHistory({ refreshKey }: { refreshKey: string }) {
  const [receipts, setReceipts] = useState<WalletAgentDevnetReceipt[]>([]);
  const [copiedReceiptId, setCopiedReceiptId] = useState<string | null>(null);

  useEffect(() => {
    setReceipts(readWalletAgentDevnetReceipts());
  }, [refreshKey]);

  function copyReceipt(receipt: WalletAgentDevnetReceipt) {
    navigator.clipboard?.writeText(buildReceiptSummary(receipt)).then(() => {
      setCopiedReceiptId(receipt.id);
      window.setTimeout(() => setCopiedReceiptId(null), 1600);
    }).catch(() => {});
  }

  return (
    <div className="rounded-2xl border border-[#14F195]/14 bg-[#14F195]/[0.035] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-4 w-4 text-[#14F195]" />
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#14F195]/85">Recibos Devnet salvos</p>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-black/24 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/40">
          local
        </span>
      </div>

      {receipts.length === 0 ? (
        <p className="text-sm leading-relaxed text-white/38">
          Nenhum recibo Devnet salvo neste navegador ainda. Depois do envio, ele aparece aqui automaticamente.
        </p>
      ) : (
        <div className="space-y-2.5">
          {receipts.slice(0, 5).map(receipt => (
            <div key={receipt.id} className="rounded-xl border border-white/[0.07] bg-black/24 p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white/68">{receipt.type.replaceAll('_', ' ')}</p>
                  <p className="mt-1 font-mono text-[11px] text-[#14F195]/80">{shortenSignature(receipt.signature)}</p>
                </div>
                <span className="shrink-0 rounded-full border border-[#14F195]/18 bg-[#14F195]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#14F195]">
                  {receipt.confirmationStatus}
                </span>
              </div>

              <div className="grid gap-2 text-[11px] leading-relaxed text-white/42 sm:grid-cols-2">
                <p>Valor: {receipt.amountSol ?? 'n/a'} SOL</p>
                <p>Salvo: {formatReceiptDate(receipt.savedAt)}</p>
                <p className="truncate">Destino: {receipt.recipientAddress ?? 'n/a'}</p>
                <p>{receipt.slot ? `Slot: ${receipt.slot}` : 'Slot: aguardando'}</p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyReceipt(receipt)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[11px] font-semibold text-white/56 transition-colors hover:bg-white/[0.06] hover:text-white/82"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copiedReceiptId === receipt.id ? 'Recibo copiado' : 'Copiar recibo'}
                </button>
                <a
                  href={receipt.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#14F195]/14 bg-[#14F195]/[0.08] px-3 py-1.5 text-[11px] font-semibold text-[#14F195] transition-colors hover:bg-[#14F195]/12 hover:text-[#8FFFE0]"
                >
                  Ver Explorer
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AlertDeliveryReceiptsHistory({ refreshKey }: { refreshKey: string }) {
  const [receipts, setReceipts] = useState<WalletAgentAlertDeliveryReceipt[]>([]);
  const [serverHistory, setServerHistory] = useState<WalletAgentAlertServerHistory | null>(null);
  const [copiedReceiptId, setCopiedReceiptId] = useState<string | null>(null);
  const [copiedHistory, setCopiedHistory] = useState(false);
  const [exportedHistory, setExportedHistory] = useState(false);
  const [exportingHistory, setExportingHistory] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingHistory, setDeletingHistory] = useState(false);
  const [deletedHistory, setDeletedHistory] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<WalletAgentAlertHistoryAuditEvent[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);
  const localStats = useMemo(() => summarizeWalletAgentAlertDeliveryReceipts(receipts), [receipts]);
  const stats = serverHistory ? {
    totalSent: serverHistory.sent,
    totalFailed: serverHistory.failed,
    uniqueTargets: serverHistory.uniqueTargets,
    providers: serverHistory.providers,
    lastSentAt: serverHistory.latestSentAt,
    lastFailedAt: serverHistory.latestFailedAt,
  } : localStats;
  const serverReceipts = serverHistory?.recentReceipts ?? [];
  const syncState = getAlertHistorySyncState(serverHistory);
  const healthItems = getAlertHistoryHealthItems(serverHistory, auditEvents);

  useEffect(() => {
    let cancelled = false;

    setReceipts(readWalletAgentAlertDeliveryReceipts());

    fetch('/api/wallet-agent/alert-records/history?limit=3')
      .then(async response => {
        if (!response.ok) {
          if (!cancelled) setServerHistory(null);
          return;
        }

        const data = await response.json();
        if (!cancelled) {
          setServerHistory(data?.history ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setServerHistory(null);
      });

    fetch('/api/wallet-agent/alert-records/history/audit?limit=4')
      .then(async response => {
        if (!response.ok) {
          if (!cancelled) setAuditEvents([]);
          return;
        }

        const data = await response.json();
        if (!cancelled) {
          setAuditEvents(Array.isArray(data?.events) ? data.events : []);
          setAuditError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuditEvents([]);
          setAuditError('Nao foi possivel carregar a auditoria da conta.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function copyReceipt(receipt: WalletAgentAlertDeliveryReceipt) {
    navigator.clipboard?.writeText(buildAlertDeliveryReceiptSummary(receipt)).then(() => {
      setCopiedReceiptId(receipt.id);
      window.setTimeout(() => setCopiedReceiptId(null), 1600);
    }).catch(() => {});
  }

  function copyServerReceipt(receipt: WalletAgentAlertServerReceipt) {
    navigator.clipboard?.writeText(buildServerAlertReceiptSummary(receipt)).then(() => {
      setCopiedReceiptId(receipt.id);
      window.setTimeout(() => setCopiedReceiptId(null), 1600);
    }).catch(() => {});
  }

  function copyHistorySummary() {
    const summary = serverHistory
      ? buildServerAlertHistorySummary(serverHistory)
      : buildLocalAlertHistorySummary(receipts, localStats);

    navigator.clipboard?.writeText(summary).then(() => {
      setCopiedHistory(true);
      window.setTimeout(() => setCopiedHistory(false), 1600);
    }).catch(() => {});
  }

  async function exportHistorySummary() {
    setExportError(null);

    if (!serverHistory) {
      const summary = buildLocalAlertHistorySummary(receipts, localStats);
      downloadTextFile(summary, createAlertHistoryExportFilename('local'));
      setExportedHistory(true);
      window.setTimeout(() => setExportedHistory(false), 1600);
      return;
    }

    setExportingHistory(true);
    try {
      const response = await fetch('/api/wallet-agent/alert-records/history/export');
      const data = await response.json().catch(() => null);
      const bundle = data?.bundle as WalletAgentAlertHistoryExportBundle | undefined;

      if (!response.ok || !bundle) {
        throw new Error(data?.error || 'Nao foi possivel exportar o historico da conta.');
      }

      downloadTextFile(
        JSON.stringify(bundle, null, 2),
        createAlertHistoryExportFilename('account', 'json'),
        'application/json;charset=utf-8'
      );
      setExportedHistory(true);
      window.setTimeout(() => setExportedHistory(false), 1600);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Nao foi possivel exportar o historico da conta.');
    } finally {
      setExportingHistory(false);
    }
  }

  async function deleteAccountHistory() {
    if (!serverHistory || deleteConfirmation.trim() !== ALERT_HISTORY_DELETE_CONFIRMATION) return;

    setDeleteError(null);
    setDeletingHistory(true);
    try {
      const response = await fetch('/api/wallet-agent/alert-records/history/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerEmail: serverHistory.ownerEmail,
          confirmation: ALERT_HISTORY_DELETE_CONFIRMATION,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'Nao foi possivel apagar o historico da conta.');
      }

      if (data?.auditEvent) {
        setAuditEvents(current => [data.auditEvent as WalletAgentAlertHistoryAuditEvent, ...current].slice(0, 4));
      }

      setServerHistory({
        ...serverHistory,
        total: 0,
        sent: 0,
        failed: 0,
        uniqueTargets: 0,
        providers: [],
        latestEventAt: null,
        latestSentAt: null,
        latestFailedAt: null,
        recentReceipts: [],
      });
      setDeleteConfirmation('');
      setDeletedHistory(true);
      window.setTimeout(() => setDeletedHistory(false), 2200);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Nao foi possivel apagar o historico da conta.');
    } finally {
      setDeletingHistory(false);
    }
  }

  const hasReceipts = serverHistory ? serverReceipts.length > 0 : receipts.length > 0;
  const canDeleteAccountHistory = !!serverHistory
    && serverHistory.total > 0
    && deleteConfirmation.trim() === ALERT_HISTORY_DELETE_CONFIRMATION
    && !deletingHistory;

  return (
    <div className="mb-3 rounded-2xl border border-[#00D1FF]/12 bg-[#00D1FF]/[0.035] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-[#7DE3FF]" />
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7DE3FF]/85">Emails de alerta</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasReceipts && (
            <>
              <button
                type="button"
                onClick={copyHistorySummary}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#00D1FF]/14 bg-[#00D1FF]/[0.06] px-2.5 py-1 text-[10px] font-semibold text-[#7DE3FF]/80 transition-colors hover:bg-[#00D1FF]/10 hover:text-[#B7F3FF]"
              >
                <Copy className="h-3 w-3" />
                {copiedHistory ? 'Historico copiado' : 'Copiar historico'}
              </button>
              <button
                type="button"
                onClick={exportHistorySummary}
                disabled={exportingHistory}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#14F195]/14 bg-[#14F195]/[0.06] px-2.5 py-1 text-[10px] font-semibold text-[#14F195]/80 transition-colors hover:bg-[#14F195]/10 hover:text-[#8FFFE0]"
              >
                <Download className="h-3 w-3" />
                {exportingHistory ? 'Exportando...' : exportedHistory ? 'Exportado' : serverHistory ? 'Exportar JSON' : 'Exportar'}
              </button>
            </>
          )}
          <span className="rounded-full border border-white/[0.08] bg-black/24 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/40">
            {serverHistory ? 'conta' : 'local'}
          </span>
        </div>
      </div>

      <div className={`mb-3 rounded-2xl border p-3 ${syncState.className}`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]">{syncState.title}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-white/42">{syncState.detail}</p>
          </div>
          <span className="rounded-full border border-white/[0.08] bg-black/24 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/48">
            {syncState.source}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.07] bg-black/20 p-2">
            <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/26">Origem</p>
            <p className="mt-1 truncate text-[10px] font-semibold text-white/62">{serverHistory ? 'conta verificada' : 'navegador local'}</p>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-black/20 p-2">
            <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/26">Persistencia</p>
            <p className="mt-1 truncate text-[10px] font-semibold text-white/62">{syncState.persistence}</p>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-black/20 p-2">
            <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/26">Identidade</p>
            <p className="mt-1 truncate text-[10px] font-semibold text-white/62">{syncState.identity}</p>
          </div>
        </div>
      </div>

      <div className="mb-3 rounded-2xl border border-white/[0.07] bg-black/22 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-[#14F195]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/48">Saude do historico</p>
          </div>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/38">
            metadata-only
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          {healthItems.map(item => (
            <div key={item.label} className={`rounded-xl border p-2 ${getAlertHistoryHealthClass(item.tone)}`}>
              <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/34">{item.label}</p>
              <p className="mt-1 truncate text-[10px] font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-white/34">
          Esta camada organiza historico, exportacao, delecao e auditoria sem permissao para assinar, enviar, comprar, vender ou pagar.
        </p>
      </div>

      {exportError && (
        <div className="mb-3 rounded-2xl border border-[#FF5C7A]/18 bg-[#FF5C7A]/[0.055] p-3">
          <p className="text-[11px] leading-relaxed text-[#FF8A9E]">{exportError}</p>
        </div>
      )}

      {serverHistory && (
        <div className="mb-3 rounded-2xl border border-[#FF5C7A]/12 bg-[#FF5C7A]/[0.035] p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF8A9E]/85">Controle de dados da conta</p>
              <p className="mt-1 text-[10px] leading-relaxed text-white/42">
                Apaga apenas metadata de alertas deste email. Nao remove carteira, regras, recibos locais ou transacoes.
              </p>
            </div>
            <span className="rounded-full border border-[#FF5C7A]/18 bg-[#FF5C7A]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#FF8A9E]">
              {serverHistory.total} registros
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={deleteConfirmation}
              onChange={event => setDeleteConfirmation(event.target.value)}
              placeholder={ALERT_HISTORY_DELETE_CONFIRMATION}
              className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-black/28 px-3 py-2 text-[11px] font-semibold text-white/70 outline-none transition-colors placeholder:text-white/24 focus:border-[#FF5C7A]/35"
              disabled={deletingHistory || serverHistory.total === 0}
            />
            <button
              type="button"
              onClick={deleteAccountHistory}
              disabled={!canDeleteAccountHistory}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#FF5C7A]/18 bg-[#FF5C7A]/10 px-3 py-2 text-[10px] font-semibold text-[#FF8A9E] transition-colors hover:bg-[#FF5C7A]/14 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.025] disabled:text-white/26"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deletingHistory ? 'Apagando...' : deletedHistory ? 'Historico apagado' : 'Apagar historico'}
            </button>
          </div>

          {deleteError && (
            <p className="mt-2 text-[10px] leading-relaxed text-[#FF8A9E]">{deleteError}</p>
          )}
          {deletedHistory && !deleteError && (
            <p className="mt-2 text-[10px] leading-relaxed text-[#14F195]">
              Historico da conta apagado. A auditoria metadata-only registrou essa acao.
            </p>
          )}
        </div>
      )}

      {serverHistory && (
        <div className="mb-3 rounded-2xl border border-white/[0.07] bg-black/22 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/48">Auditoria da conta</p>
              <p className="mt-1 text-[10px] leading-relaxed text-white/36">
                Eventos metadata-only de exportacao/delecao. Nao inclui IP, carteira, payload assinado ou dados privados.
              </p>
            </div>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/38">
              {auditEvents.length} eventos
            </span>
          </div>

          {auditError ? (
            <p className="text-[10px] leading-relaxed text-[#FF8A9E]">{auditError}</p>
          ) : auditEvents.length === 0 ? (
            <p className="text-[10px] leading-relaxed text-white/34">Nenhum evento de auditoria recente nesta sessao.</p>
          ) : (
            <div className="space-y-2">
              {auditEvents.slice(0, 4).map(event => (
                <div key={event.id} className={`rounded-xl border p-2.5 ${getAuditEventClass(event)}`}>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">{getAuditEventLabel(event)}</p>
                    <span className="rounded-full border border-white/[0.08] bg-black/20 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/46">
                      {event.status}
                    </span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-white/44">{event.reason}</p>
                  <div className="mt-2 grid gap-1 text-[9px] leading-relaxed text-white/34 sm:grid-cols-2">
                    <p>{formatReceiptDate(event.createdAt)}</p>
                    <p>{event.storageMode ? `Storage: ${event.storageMode}` : 'Storage: n/a'}</p>
                    {typeof event.deletedCount === 'number' && <p>Registros apagados: {event.deletedCount}</p>}
                    <p className="truncate">Evento: {event.id}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!hasReceipts ? (
        <p className="text-[11px] leading-relaxed text-white/38">
          Nenhum email de alerta registrado ainda.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-white/[0.07] bg-black/22 p-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">Enviados</p>
              <p className="mt-1 text-sm font-semibold text-white/78">{stats.totalSent}</p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-black/22 p-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">Falhas</p>
              <p className="mt-1 text-sm font-semibold text-white/78">{stats.totalFailed}</p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-black/22 p-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">Destinos</p>
              <p className="mt-1 text-sm font-semibold text-white/78">{stats.uniqueTargets}</p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-black/22 p-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">Provider</p>
              <p className="mt-1 truncate text-sm font-semibold text-white/78">{stats.providers.join(', ') || 'n/a'}</p>
            </div>
          </div>
          {serverHistory ? (
            serverReceipts.map(receipt => (
              <div key={receipt.id} className="rounded-xl border border-white/[0.07] bg-black/22 p-2.5">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-white/68">{receipt.title}</p>
                    <p className="mt-1 truncate text-[10px] text-white/38">{receipt.target}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                    receipt.receiptStatus === 'sent'
                      ? 'border-[#14F195]/18 bg-[#14F195]/10 text-[#14F195]'
                      : 'border-[#FF5C7A]/18 bg-[#FF5C7A]/10 text-[#FF8A9E]'
                  }`}>
                    {receipt.receiptStatus}
                  </span>
                </div>
                <div className="grid gap-1 text-[10px] leading-relaxed text-white/38 sm:grid-cols-2">
                  <p>Provider: {receipt.provider}</p>
                  <p>{receipt.receiptStatus === 'sent' ? 'Enviado' : 'Falhou'}: {formatReceiptDate(receipt.eventAt)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyServerReceipt(receipt)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-semibold text-white/56 transition-colors hover:bg-white/[0.06] hover:text-white/82"
                >
                  <Copy className="h-3 w-3" />
                  {copiedReceiptId === receipt.id ? 'Recibo copiado' : 'Copiar recibo'}
                </button>
              </div>
            ))
          ) : (
            receipts.slice(0, 3).map(receipt => (
              <div key={receipt.id} className="rounded-xl border border-white/[0.07] bg-black/22 p-2.5">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-white/68">{receipt.title}</p>
                    <p className="mt-1 truncate text-[10px] text-white/38">{receipt.target}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                    receipt.status === 'sent'
                      ? 'border-[#14F195]/18 bg-[#14F195]/10 text-[#14F195]'
                      : 'border-[#FF5C7A]/18 bg-[#FF5C7A]/10 text-[#FF8A9E]'
                  }`}>
                    {receipt.status}
                  </span>
                </div>
                <div className="grid gap-1 text-[10px] leading-relaxed text-white/38 sm:grid-cols-2">
                  <p>Provider: {receipt.provider}</p>
                  <p>
                    {receipt.status === 'sent' && receipt.sentAt
                      ? `Enviado: ${formatReceiptDate(receipt.sentAt)}`
                      : `Falhou: ${receipt.failedAt ? formatReceiptDate(receipt.failedAt) : 'n/a'}`}
                  </p>
                </div>
                {receipt.failureReason && (
                  <p className="mt-1 text-[10px] leading-relaxed text-[#FF8A9E]/75">
                    {receipt.failureReason}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => copyReceipt(receipt)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-semibold text-white/56 transition-colors hover:bg-white/[0.06] hover:text-white/82"
                >
                  <Copy className="h-3 w-3" />
                  {copiedReceiptId === receipt.id ? 'Recibo copiado' : 'Copiar recibo'}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function LocalRulesHistory({
  refreshKey,
  onSendNotificationDraft,
}: {
  refreshKey: string;
  onSendNotificationDraft?: (draft: WalletAgentLocalNotificationDraft, rule: WalletAgentLocalRule) => void;
}) {
  const [rules, setRules] = useState<WalletAgentLocalRule[]>([]);
  const [copiedRuleId, setCopiedRuleId] = useState<string | null>(null);
  const [activeContext, setActiveContext] = useState<WalletAgentLocalRuleReviewContext | null>(null);
  const [copiedContextId, setCopiedContextId] = useState<string | null>(null);
  const [activeSimulation, setActiveSimulation] = useState<WalletAgentLocalRuleSimulation | null>(null);
  const [copiedSimulationId, setCopiedSimulationId] = useState<string | null>(null);
  const [activeNotificationDraft, setActiveNotificationDraft] = useState<WalletAgentLocalNotificationDraft | null>(null);
  const [copiedNotificationId, setCopiedNotificationId] = useState<string | null>(null);
  const [sentNotificationId, setSentNotificationId] = useState<string | null>(null);
  const [activeAlertDelivery, setActiveAlertDelivery] = useState<WalletAgentAlertDelivery | null>(null);
  const [alertDeliveryLoading, setAlertDeliveryLoading] = useState(false);
  const [alertDeliveryError, setAlertDeliveryError] = useState('');
  const [emailSendLoading, setEmailSendLoading] = useState(false);
  const [emailSendMessage, setEmailSendMessage] = useState('');
  const [alertReceiptsRefreshKey, setAlertReceiptsRefreshKey] = useState('initial');
  const [activeAlertRecord, setActiveAlertRecord] = useState<WalletAgentAlertPersistenceRecord | null>(null);
  const [alertRecordMessage, setAlertRecordMessage] = useState('');
  const [notificationPreferences, setNotificationPreferences] = useState<WalletAgentLocalNotificationPreferences>(() => (
    readWalletAgentNotificationPreferences()
  ));
  const [emailInput, setEmailInput] = useState(() => readWalletAgentNotificationPreferences().emailAddress ?? '');

  useEffect(() => {
    setRules(readWalletAgentLocalRules());
    const preferences = readWalletAgentNotificationPreferences();
    setNotificationPreferences(preferences);
    setEmailInput(preferences.emailAddress ?? '');
    setActiveContext(null);
    setActiveSimulation(null);
    setActiveNotificationDraft(null);
    setActiveAlertDelivery(null);
    setAlertDeliveryError('');
    setEmailSendMessage('');
    setActiveAlertRecord(null);
    setAlertRecordMessage('');
    setSentNotificationId(null);
  }, [refreshKey]);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/email/me')
      .then(response => response.json())
      .then(data => {
        if (cancelled || !data?.authenticated || !data.user?.email) return;

        const next = saveWalletAgentNotificationPreferences({
          emailAddress: data.user.email,
          emailPrepared: true,
          emailSource: 'cog_user',
          emailSessionVerified: !!data.user.verified,
        });
        setNotificationPreferences(next);
        setEmailInput(next.emailAddress ?? '');
        setActiveNotificationDraft(null);
        setActiveAlertDelivery(null);
        setEmailSendMessage('');
        setActiveAlertRecord(null);
        setAlertRecordMessage('');
        setSentNotificationId(null);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  function copyRule(rule: WalletAgentLocalRule) {
    navigator.clipboard?.writeText(buildRuleSummary(rule)).then(() => {
      setCopiedRuleId(rule.id);
      window.setTimeout(() => setCopiedRuleId(null), 1600);
    }).catch(() => {});
  }

  function toggleRuleStatus(rule: WalletAgentLocalRule) {
    const nextStatus = rule.status === 'paused' ? 'manual_review' : 'paused';
    setRules(setWalletAgentLocalRuleStatus(rule.id, nextStatus));
  }

  function removeRule(rule: WalletAgentLocalRule) {
    setRules(removeWalletAgentLocalRule(rule.id));
    setActiveContext(current => current?.ruleId === rule.id ? null : current);
    setActiveSimulation(current => current?.ruleId === rule.id ? null : current);
    setActiveNotificationDraft(current => current?.ruleId === rule.id ? null : current);
    setActiveAlertDelivery(current => current?.ruleId === rule.id ? null : current);
    setEmailSendMessage('');
    setActiveAlertRecord(null);
    setAlertRecordMessage('');
  }

  function showReviewContext(rule: WalletAgentLocalRule) {
    setActiveContext(current => current?.ruleId === rule.id
      ? null
      : createWalletAgentRuleReviewContext(rule)
    );
  }

  function copyReviewContext(context: WalletAgentLocalRuleReviewContext) {
    navigator.clipboard?.writeText(buildRuleReviewContextSummary(context)).then(() => {
      setCopiedContextId(context.ruleId);
      window.setTimeout(() => setCopiedContextId(null), 1600);
    }).catch(() => {});
  }

  function simulateRule(rule: WalletAgentLocalRule) {
    setActiveSimulation(simulateWalletAgentLocalRule(rule));
  }

  function copySimulation(simulation: WalletAgentLocalRuleSimulation) {
    navigator.clipboard?.writeText(buildRuleSimulationSummary(simulation)).then(() => {
      setCopiedSimulationId(simulation.ruleId);
      window.setTimeout(() => setCopiedSimulationId(null), 1600);
    }).catch(() => {});
  }

  function prepareNotificationDraft(rule: WalletAgentLocalRule) {
    setActiveNotificationDraft(createWalletAgentLocalNotificationDraft(rule, new Date(), notificationPreferences));
    setActiveAlertDelivery(null);
    setAlertDeliveryError('');
    setEmailSendMessage('');
    setActiveAlertRecord(null);
    setAlertRecordMessage('');
    setSentNotificationId(null);
  }

  function updateNotificationPreference(
    key: keyof Pick<WalletAgentLocalNotificationPreferences, 'chatEnabled' | 'emailPrepared' | 'walletApprovalEnabled'>,
    value: boolean
  ) {
    const next = saveWalletAgentNotificationPreferences({ [key]: value });
    setNotificationPreferences(next);
    setActiveNotificationDraft(null);
    setActiveAlertDelivery(null);
    setAlertDeliveryError('');
    setEmailSendMessage('');
    setActiveAlertRecord(null);
    setAlertRecordMessage('');
    setSentNotificationId(null);
  }

  function saveNotificationEmail() {
    const normalized = emailInput.trim();
    if (normalized && !isWalletAgentNotificationEmailValid(normalized)) return;

    const next = saveWalletAgentNotificationPreferences({
      emailAddress: normalized || null,
      emailPrepared: normalized ? notificationPreferences.emailPrepared : false,
      emailSource: normalized ? 'manual' : null,
      emailSessionVerified: false,
    });
    setNotificationPreferences(next);
    setEmailInput(next.emailAddress ?? '');
    setActiveNotificationDraft(null);
    setActiveAlertDelivery(null);
    setAlertDeliveryError('');
    setEmailSendMessage('');
    setActiveAlertRecord(null);
    setAlertRecordMessage('');
    setSentNotificationId(null);
  }

  function copyNotificationDraft(draft: WalletAgentLocalNotificationDraft) {
    navigator.clipboard?.writeText(buildNotificationDraftSummary(draft)).then(() => {
      setCopiedNotificationId(draft.id);
      window.setTimeout(() => setCopiedNotificationId(null), 1600);
    }).catch(() => {});
  }

  function sendNotificationDraftToChat(draft: WalletAgentLocalNotificationDraft, rule: WalletAgentLocalRule) {
    if (!onSendNotificationDraft) return;

    onSendNotificationDraft(draft, rule);
    setSentNotificationId(draft.id);
  }

  async function createAlertDelivery(draft: WalletAgentLocalNotificationDraft, rule: WalletAgentLocalRule) {
    setAlertDeliveryLoading(true);
    setAlertDeliveryError('');
    setEmailSendMessage('');
    setActiveAlertRecord(null);
    setAlertRecordMessage('');

    try {
      const response = await fetch('/api/wallet-agent/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft, rule }),
      });
      const data = await response.json();

      if (!response.ok || !data?.delivery) {
        setAlertDeliveryError(data?.error || 'Nao foi possivel criar a entrega segura.');
        return;
      }

      setActiveAlertDelivery(data.delivery);
    } catch {
      setAlertDeliveryError('Nao foi possivel criar a entrega segura agora.');
    } finally {
      setAlertDeliveryLoading(false);
    }
  }

  async function prepareAccountAlertRecord(
    delivery: WalletAgentAlertDelivery,
    receipt: WalletAgentAlertDeliveryReceipt | null
  ) {
    setAlertRecordMessage('');

    try {
      const response = await fetch('/api/wallet-agent/alert-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery, receipt }),
      });
      const data = await response.json();

      if (!response.ok || !data?.record) {
        setAlertRecordMessage(data?.error || 'Nao foi possivel preparar o historico da conta.');
        return;
      }

      setActiveAlertRecord(data.record);
      let nextMessage = data?.message || 'Contrato de historico da conta preparado.';

      if (receipt && data.record.userVerified) {
        const serverResponse = await fetch('/api/wallet-agent/alert-records/receipts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ record: data.record }),
        });
        const serverData = await serverResponse.json();

        if (serverResponse.ok && serverData?.receipt) {
          setAlertReceiptsRefreshKey(serverData.receipt.updatedAt || String(Date.now()));
          nextMessage = serverData?.message || 'Recibo da conta salvo em memoria do servidor.';
        } else if (serverResponse.status !== 401 && serverResponse.status !== 403) {
          nextMessage = serverData?.error || nextMessage;
        }
      }

      setAlertRecordMessage(nextMessage);
    } catch {
      setAlertRecordMessage('Nao foi possivel preparar o historico da conta agora.');
    }
  }

  async function sendAlertEmail(delivery: WalletAgentAlertDelivery) {
    setEmailSendLoading(true);
    setEmailSendMessage('');

    try {
      const response = await fetch('/api/wallet-agent/alerts/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery }),
      });
      const data = await response.json();

      if (!response.ok || !data?.delivery) {
        const errorMessage = data?.error || 'Nao foi possivel enviar o email agora.';
        const receipt = saveWalletAgentAlertDeliveryFailureReceipt(delivery, errorMessage, data?.provider || 'resend');
        if (receipt) setAlertReceiptsRefreshKey(receipt.updatedAt);
        await prepareAccountAlertRecord(delivery, receipt);
        setEmailSendMessage(errorMessage);
        return;
      }

      setActiveAlertDelivery(data.delivery);
      const receipt = saveWalletAgentAlertDeliveryReceipt(data.delivery, data?.provider || 'resend');
      if (receipt) setAlertReceiptsRefreshKey(receipt.updatedAt);
      await prepareAccountAlertRecord(data.delivery, receipt);
      setEmailSendMessage(data?.message || 'Email enviado manualmente.');
    } catch {
      setEmailSendMessage('Nao foi possivel enviar o email agora.');
    } finally {
      setEmailSendLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#9945FF]/16 bg-[#9945FF]/[0.045] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[#B58CFF]" />
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C4B5FD]/85">Regras locais salvas</p>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-black/24 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/40">
          manual
        </span>
      </div>

      <div className="mb-3 rounded-2xl border border-[#00D1FF]/12 bg-black/20 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-[#7DE3FF]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/46">Preferencias de alerta</p>
          </div>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/34">
            local only
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => updateNotificationPreference('chatEnabled', !notificationPreferences.chatEnabled)}
            className={`rounded-xl border px-3 py-2 text-left transition-colors ${notificationPreferences.chatEnabled ? 'border-[#14F195]/18 bg-[#14F195]/[0.07]' : 'border-white/[0.07] bg-white/[0.025]'}`}
          >
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/68">
              <Send className="h-3.5 w-3.5" />
              Chat
            </span>
            <span className="mt-1 block text-[10px] leading-relaxed text-white/38">
              {notificationPreferences.chatEnabled ? 'Mensagem local no CongChain.' : 'Oculto do rascunho.'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => updateNotificationPreference('emailPrepared', !notificationPreferences.emailPrepared)}
            className={`rounded-xl border px-3 py-2 text-left transition-colors ${notificationPreferences.emailPrepared ? 'border-[#00D1FF]/18 bg-[#00D1FF]/[0.07]' : 'border-white/[0.07] bg-white/[0.025]'}`}
          >
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/68">
              <Mail className="h-3.5 w-3.5" />
              Email
            </span>
            <span className="mt-1 block text-[10px] leading-relaxed text-white/38">
              {notificationPreferences.emailPrepared ? 'Preparado para email verificado.' : 'Email desativado.'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => updateNotificationPreference('walletApprovalEnabled', !notificationPreferences.walletApprovalEnabled)}
            className={`rounded-xl border px-3 py-2 text-left transition-colors ${notificationPreferences.walletApprovalEnabled ? 'border-[#9945FF]/20 bg-[#9945FF]/[0.08]' : 'border-white/[0.07] bg-white/[0.025]'}`}
          >
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/68">
              <Wallet className="h-3.5 w-3.5" />
              Wallet
            </span>
            <span className="mt-1 block text-[10px] leading-relaxed text-white/38">
              {notificationPreferences.walletApprovalEnabled ? 'Aprovacao futura mantida.' : 'Aprovacao oculta do alerta.'}
            </span>
          </button>
        </div>
        <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/22 p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
              <Mail className="h-3.5 w-3.5 text-[#7DE3FF]" />
              Email para alertas
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${getNotificationEmailStatusClass(notificationPreferences)}`}>
              {getNotificationEmailStatus(notificationPreferences)}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={emailInput}
              onChange={event => setEmailInput(event.target.value)}
              onBlur={saveNotificationEmail}
              placeholder="seu@email.com"
              inputMode="email"
              className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 text-xs text-white/72 outline-none transition-colors placeholder:text-white/26 focus:border-[#00D1FF]/28"
            />
            <button
              type="button"
              onClick={saveNotificationEmail}
              disabled={!!emailInput.trim() && !isWalletAgentNotificationEmailValid(emailInput)}
              className="rounded-xl border border-[#00D1FF]/16 bg-[#00D1FF]/[0.06] px-3 py-2 text-[11px] font-semibold text-[#7DE3FF] transition-colors hover:bg-[#00D1FF]/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Salvar email
            </button>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-white/34">
            {emailInput.trim() && !isWalletAgentNotificationEmailValid(emailInput)
                ? 'Formato invalido. Use um email como nome@dominio.com.'
              : notificationPreferences.emailSource === 'cog_user'
                ? `Usando email da conta: ${notificationPreferences.emailAddress}${notificationPreferences.emailSessionVerified ? ' (verificado por magic link).' : ' (sessao local).' }`
                : notificationPreferences.emailVerifiedLocally
                  ? `Rascunhos podem mencionar ${notificationPreferences.emailAddress}. Envio real ainda nao existe.`
                : 'Informe um email para os rascunhos mostrarem o destino futuro.'}
          </p>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-white/32">
          Preferencias ficam neste navegador. Nenhum email, push ou assinatura e disparado automaticamente.
        </p>
      </div>

      <AlertDeliveryReceiptsHistory refreshKey={alertReceiptsRefreshKey} />

      {rules.length === 0 ? (
        <p className="text-sm leading-relaxed text-white/38">
          Nenhuma regra local salva ainda. Confirme um alerta, agendamento, payroll ou checagem de risco para criar uma regra de revisao manual.
        </p>
      ) : (
        <div className="space-y-2.5">
          {rules.slice(0, 5).map(rule => (
            <div key={rule.id} className="rounded-xl border border-white/[0.07] bg-black/24 p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white/68">{rule.type.replaceAll('_', ' ')}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/42">{rule.trigger.label}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${getRuleStatusClassName(rule.status)}`}>
                  {rule.status.replaceAll('_', ' ')}
                </span>
              </div>

              <div className="grid gap-2 text-[11px] leading-relaxed text-white/42 sm:grid-cols-2">
                <p>Acao: {rule.action.kind.replaceAll('_', ' ')}</p>
                <p>Criada: {formatReceiptDate(rule.createdAt)}</p>
                <p className="truncate">Carteira: {rule.walletAddress ?? 'n/a'}</p>
                <p>Assinatura futura: {rule.safety.requiresWalletSignature ? 'sim' : 'nao'}</p>
              </div>

              <div className="mt-3 rounded-xl border border-[#F5A524]/14 bg-[#F5A524]/[0.045] p-3">
                <p className="text-[11px] leading-relaxed text-white/46">
                  Esta regra nao executa automaticamente. Ela apenas guarda contexto para uma revisao manual futura.
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyRule(rule)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[11px] font-semibold text-white/56 transition-colors hover:bg-white/[0.06] hover:text-white/82"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copiedRuleId === rule.id ? 'Regra copiada' : 'Copiar regra'}
                </button>
                <button
                  type="button"
                  onClick={() => showReviewContext(rule)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#5AD7FF]/16 bg-[#5AD7FF]/[0.06] px-3 py-1.5 text-[11px] font-semibold text-[#7DE3FF] transition-colors hover:bg-[#5AD7FF]/10"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {activeContext?.ruleId === rule.id ? 'Ocultar contexto' : 'Contexto'}
                </button>
                <button
                  type="button"
                  onClick={() => simulateRule(rule)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#14F195]/16 bg-[#14F195]/[0.06] px-3 py-1.5 text-[11px] font-semibold text-[#14F195] transition-colors hover:bg-[#14F195]/10"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Simular agora
                </button>
                <button
                  type="button"
                  onClick={() => prepareNotificationDraft(rule)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#00D1FF]/16 bg-[#00D1FF]/[0.06] px-3 py-1.5 text-[11px] font-semibold text-[#7DE3FF] transition-colors hover:bg-[#00D1FF]/10"
                >
                  <Bell className="h-3.5 w-3.5" />
                  Preparar alerta
                </button>
                <button
                  type="button"
                  onClick={() => toggleRuleStatus(rule)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#F5A524]/16 bg-[#F5A524]/[0.06] px-3 py-1.5 text-[11px] font-semibold text-[#F5A524] transition-colors hover:bg-[#F5A524]/10"
                >
                  {rule.status === 'paused' ? <PlayCircle className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5" />}
                  {rule.status === 'paused' ? 'Reativar' : 'Pausar'}
                </button>
                <button
                  type="button"
                  onClick={() => removeRule(rule)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#FF5C7A]/16 bg-[#FF5C7A]/[0.055] px-3 py-1.5 text-[11px] font-semibold text-[#FF8A9E] transition-colors hover:bg-[#FF5C7A]/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover
                </button>
              </div>

              {activeContext?.ruleId === rule.id && (
                <div className="mt-3 rounded-2xl border border-[#5AD7FF]/16 bg-[#5AD7FF]/[0.045] p-3">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7DE3FF]/85">Contexto de revisao</p>
                      <p className="mt-1 text-xs leading-relaxed text-white/54">{activeContext.operatorSummary}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyReviewContext(activeContext)}
                      className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-semibold text-white/56 transition-colors hover:bg-white/[0.06] hover:text-white/82"
                    >
                      {copiedContextId === activeContext.ruleId ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/34">Revisar antes de agir</p>
                      <div className="space-y-1.5">
                        {activeContext.requiredReview.map(item => (
                          <p key={item} className="text-[11px] leading-relaxed text-white/48">- {item}</p>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#FF5C7A]/14 bg-[#FF5C7A]/[0.04] p-2.5">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#FF8A9E]/80">Bloqueado nesta fase</p>
                      <div className="space-y-1.5">
                        {activeContext.blockedActions.map(item => (
                          <p key={item} className="text-[11px] leading-relaxed text-white/46">- {item}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSimulation?.ruleId === rule.id && (
                <div className="mt-3 rounded-2xl border border-[#14F195]/16 bg-[#14F195]/[0.045] p-3">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#14F195]/85">Simulacao local</p>
                      <p className="mt-1 text-xs font-semibold text-white/68">{activeSimulation.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-white/48">{activeSimulation.summary}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-[#14F195]/18 bg-[#14F195]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#14F195]">
                      {activeSimulation.status.replaceAll('_', ' ')}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/34">Observacoes</p>
                      <div className="space-y-1.5">
                        {activeSimulation.observations.map(item => (
                          <p key={item} className="text-[11px] leading-relaxed text-white/48">- {item}</p>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-black/20 p-2.5">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/34">Proximo passo manual</p>
                      <p className="text-[11px] leading-relaxed text-white/50">{activeSimulation.nextManualStep}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => copySimulation(activeSimulation)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[11px] font-semibold text-white/56 transition-colors hover:bg-white/[0.06] hover:text-white/82"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copiedSimulationId === activeSimulation.ruleId ? 'Simulacao copiada' : 'Copiar simulacao'}
                  </button>
                </div>
              )}

              {activeNotificationDraft?.ruleId === rule.id && (
                <div className="mt-3 rounded-2xl border border-[#00D1FF]/16 bg-[#00D1FF]/[0.045] p-3">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7DE3FF]/85">Rascunho de alerta</p>
                      <p className="mt-1 text-xs font-semibold text-white/68">{activeNotificationDraft.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-white/48">{activeNotificationDraft.message}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-[#00D1FF]/18 bg-[#00D1FF]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#7DE3FF]">
                      draft only
                    </span>
                  </div>

                  <div className="grid gap-2 text-[11px] leading-relaxed text-white/46 sm:grid-cols-2">
                    <p>Canais: {activeNotificationDraft.channels.map(formatNotificationChannel).join(' + ')}</p>
                    <p>Email: {activeNotificationDraft.emailVerifiedLocally ? activeNotificationDraft.emailAddress : 'pendente de verificacao local'}</p>
                    <p>Carteira: {activeNotificationDraft.walletActionRequired ? 'aprovacao futura' : 'nao precisa'}</p>
                  </div>

                  <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/20 p-2.5">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/34">Plano de entrega</p>
                    <div className="space-y-1.5">
                      {activeNotificationDraft.deliveryPlan.map(item => (
                        <p key={item} className="text-[11px] leading-relaxed text-white/48">- {item}</p>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyNotificationDraft(activeNotificationDraft)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[11px] font-semibold text-white/56 transition-colors hover:bg-white/[0.06] hover:text-white/82"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copiedNotificationId === activeNotificationDraft.id ? 'Alerta copiado' : 'Copiar alerta'}
                  </button>
                  {onSendNotificationDraft && (
                    <button
                      type="button"
                      onClick={() => sendNotificationDraftToChat(activeNotificationDraft, rule)}
                      className="ml-2 mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#00D1FF]/16 bg-[#00D1FF]/[0.06] px-3 py-1.5 text-[11px] font-semibold text-[#7DE3FF] transition-colors hover:bg-[#00D1FF]/10"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {sentNotificationId === activeNotificationDraft.id ? 'Enviado ao chat' : 'Enviar ao chat'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => createAlertDelivery(activeNotificationDraft, rule)}
                    disabled={alertDeliveryLoading}
                    className="ml-2 mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#14F195]/16 bg-[#14F195]/[0.06] px-3 py-1.5 text-[11px] font-semibold text-[#14F195] transition-colors hover:bg-[#14F195]/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {alertDeliveryLoading ? 'Criando...' : 'Criar entrega segura'}
                  </button>
                  {alertDeliveryError && (
                    <p className="mt-2 text-[11px] leading-relaxed text-[#FF8A9E]/80">{alertDeliveryError}</p>
                  )}
                  {activeAlertDelivery?.draftId === activeNotificationDraft.id && (
                    <div className="mt-3 rounded-2xl border border-[#14F195]/16 bg-[#14F195]/[0.045] p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#14F195]/85">Contrato de entrega</p>
                        <span className="rounded-full border border-[#14F195]/18 bg-[#14F195]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#14F195]">
                          {activeAlertDelivery.status}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {activeAlertDelivery.channels.map(channel => (
                          <p key={channel.channel} className="text-[11px] leading-relaxed text-white/48">
                            - {formatNotificationChannel(channel.channel)}: {channel.status} {channel.target ? `(${channel.target})` : ''} - {channel.reason}
                          </p>
                        ))}
                      </div>
                      <div className="mt-2 rounded-xl border border-white/[0.07] bg-black/20 p-2.5">
                        <p className="text-[11px] leading-relaxed text-white/46">
                          Seguro: sem scheduler, sem assinatura de wallet e sem transacao. Email real so dispara por clique manual.
                        </p>
                      </div>
                      {activeAlertDelivery.safety.canSendEmail ? (
                        <button
                          type="button"
                          onClick={() => sendAlertEmail(activeAlertDelivery)}
                          disabled={emailSendLoading || activeAlertDelivery.status === 'sent'}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#00D1FF]/16 bg-[#00D1FF]/[0.06] px-3 py-1.5 text-[11px] font-semibold text-[#7DE3FF] transition-colors hover:bg-[#00D1FF]/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {activeAlertDelivery.status === 'sent'
                            ? 'Email enviado'
                            : emailSendLoading
                              ? 'Enviando...'
                              : 'Enviar email agora'}
                        </button>
                      ) : (
                        <p className="mt-2 text-[11px] leading-relaxed text-[#F5A524]/80">
                          Email ainda nao esta pronto. Conecte ou valide um email antes de enviar.
                        </p>
                      )}
                      {emailSendMessage && (
                        <p className={`mt-2 text-[11px] leading-relaxed ${activeAlertDelivery.status === 'sent' ? 'text-[#14F195]/82' : 'text-[#F5A524]/82'}`}>
                          {emailSendMessage}
                        </p>
                      )}
                      {(activeAlertRecord || alertRecordMessage) && (
                        <div className="mt-3 rounded-xl border border-[#9945FF]/14 bg-[#9945FF]/[0.045] p-2.5">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C4B5FD]/85">
                              Historico da conta
                            </p>
                            {activeAlertRecord && (
                              <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/42">
                                {activeAlertRecord.persistence.mode}
                              </span>
                            )}
                          </div>
                          {activeAlertRecord && (
                            <div className="grid gap-1 text-[11px] leading-relaxed text-white/46 sm:grid-cols-2">
                              <p>Status: {activeAlertRecord.status}</p>
                              <p>Email: {activeAlertRecord.userEmail ?? 'sem conta conectada'}</p>
                              <p>Verificado: {activeAlertRecord.userVerified ? 'sim' : 'nao'}</p>
                              <p>Persistido: {activeAlertRecord.persistence.persisted ? 'sim' : 'nao'}</p>
                            </div>
                          )}
                          {alertRecordMessage && (
                            <p className="mt-2 text-[11px] leading-relaxed text-white/42">{alertRecordMessage}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WalletAgentReviewPanel({
  result,
  onClose,
  onConfirm,
  onPrepareTransaction,
  onSignTransaction,
  onSubmitTransaction,
  onConfirmTransaction,
  onSendNotificationDraft,
  history = [],
}: WalletAgentReviewPanelProps) {
  const { draft, safety, review } = result;
  const valueMoving = draft.requiresWalletSignature;
  const confirmationCheck = canConfirmWalletAgentIntent(result);
  const confirmed = !!draft.internalConfirmation?.confirmed;
  const proposal = draft.transactionProposal;
  const preparedTransaction = draft.preparedTransaction;
  const signedTransaction = draft.signedTransaction;
  const submittedTransaction = draft.submittedTransaction;
  const receiptsRefreshKey = `${submittedTransaction?.signature ?? 'none'}:${submittedTransaction?.confirmationStatus ?? 'none'}:${submittedTransaction?.slot ?? 'none'}`;
  const rulesRefreshKey = `${draft.id}:${draft.internalConfirmation?.confirmationId ?? 'none'}:${draft.type}`;
  const canPrepareTransaction = !!proposal
    && proposal.status === 'ready_for_wallet_signature'
    && !preparedTransaction
    && !!onPrepareTransaction;
  const canSignTransaction = !!preparedTransaction
    && !signedTransaction
    && !!onSignTransaction;
  const canSubmitTransaction = !!signedTransaction
    && !submittedTransaction
    && !!onSubmitTransaction;
  const canConfirmTransaction = !!submittedTransaction
    && submittedTransaction.confirmationStatus !== 'finalized'
    && submittedTransaction.confirmationStatus !== 'error'
    && !!onConfirmTransaction;
  const [summaryCopied, setSummaryCopied] = useState(false);
  const transactionSummary = useMemo(() => buildTransactionSummary(result), [result]);

  function copyTransactionSummary() {
    navigator.clipboard?.writeText(transactionSummary).then(() => {
      setSummaryCopied(true);
      window.setTimeout(() => setSummaryCopied(false), 1600);
    }).catch(() => {});
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/72 px-3 py-4 backdrop-blur-xl">
      <section className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-white/[0.09] bg-[#07070d]/98 shadow-[0_36px_140px_rgba(0,0,0,0.68)]">
        <div className="border-b border-white/[0.07] bg-gradient-to-r from-[#14F195]/10 via-[#00D1FF]/6 to-[#9945FF]/12 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#14F195]/22 bg-[#14F195]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#14F195]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Wallet Agent Review
                </span>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/46">
                  {review.intentLabel}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-white/92 sm:text-2xl">{review.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/50">{review.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/[0.08] bg-white/[0.04] p-2 text-white/42 transition-colors hover:bg-white/[0.08] hover:text-white/80"
              aria-label="Fechar revisao"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(92vh-118px)] overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              {valueMoving && <TransactionJourney result={result} />}

              <div className="grid gap-3 sm:grid-cols-2">
                {review.items.map(item => (
                  <ReviewItem key={item.label} item={item} />
                ))}
              </div>

              {draft.warnings.length > 0 && (
                <div className="rounded-2xl border border-[#F5A524]/18 bg-[#F5A524]/[0.055] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[#F5A524]" />
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F5A524]/85">Avisos de seguranca</p>
                  </div>
                  <div className="space-y-2">
                    {draft.warnings.map(warning => (
                      <p key={warning} className="text-sm leading-relaxed text-white/58">{warning}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {confirmed && (
                <div className="rounded-2xl border border-[#14F195]/20 bg-[#14F195]/[0.07] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#14F195]" />
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#14F195]/85">Confirmacao interna registrada</p>
                  </div>
                  <p className="text-sm leading-relaxed text-white/62">
                    ID {draft.internalConfirmation?.confirmationId}. Esta confirmacao nao assina nem envia transacao.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-[#14F195]/16 bg-[#14F195]/[0.045] p-4">
                <div className="mb-3 flex items-center gap-2">
                  {valueMoving ? <Wallet className="h-4 w-4 text-[#14F195]" /> : <LockKeyhole className="h-4 w-4 text-[#14F195]" />}
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#14F195]/85">{review.custodyLabel}</p>
                </div>
                <p className="text-sm leading-relaxed text-white/62">{safety.reason}</p>
              </div>

              {proposal && (
                <div className="rounded-2xl border border-[#00D1FF]/16 bg-[#00D1FF]/[0.045] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-[#00D1FF]" />
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#00D1FF]/85">Proposta de transacao</p>
                    </div>
                    <span className="rounded-full border border-white/[0.08] bg-black/24 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/46">
                      {proposal.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-white/62">{proposal.summary}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/[0.06] bg-black/18 p-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Tipo</p>
                      <p className="mt-1 text-xs font-semibold text-white/66">{proposal.kind.replaceAll('_', ' ')}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-black/18 p-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Taxa estimada</p>
                      <p className="mt-1 text-xs font-semibold text-white/66">{proposal.estimatedFeeSol.toFixed(6)} SOL</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {proposal.checks.map(check => (
                      <div key={check.label} className="rounded-xl border border-white/[0.06] bg-black/18 p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-white/64">{check.label}</p>
                          <span className="text-[10px] uppercase tracking-[0.12em] text-white/34">{check.status}</span>
                        </div>
                        <p className="text-xs leading-relaxed text-white/42">{check.detail}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-white/42">{proposal.requiredWalletAction}</p>
                </div>
              )}

              {preparedTransaction && (
                <div className="rounded-2xl border border-[#14F195]/18 bg-[#14F195]/[0.055] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4 text-[#14F195]" />
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#14F195]/85">Transacao Devnet preparada</p>
                    </div>
                    <span className="rounded-full border border-[#14F195]/18 bg-[#14F195]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#14F195]">
                      sem assinatura
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/[0.06] bg-black/18 p-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Destino</p>
                      <p className="mt-1 break-words text-xs font-semibold text-white/66">{preparedTransaction.toAddress}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-black/18 p-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Valor</p>
                      <p className="mt-1 text-xs font-semibold text-white/66">{preparedTransaction.amountSol} SOL</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-white/42">
                    Payload criado localmente com blockhash recente. Nada foi assinado ou enviado para a rede.
                  </p>
                </div>
              )}

              {signedTransaction && (
                <div className="rounded-2xl border border-[#9945FF]/18 bg-[#9945FF]/[0.06] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-[#B58CFF]" />
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B58CFF]/85">Assinada pela wallet</p>
                    </div>
                    <span className="rounded-full border border-[#9945FF]/18 bg-[#9945FF]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#C4B5FD]">
                      nao enviada
                    </span>
                  </div>
                  <p className="break-words text-xs leading-relaxed text-white/48">
                    Signer: {signedTransaction.signerAddress}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-white/42">
                    A assinatura foi aprovada na wallet, mas a transacao ainda nao foi transmitida para a rede.
                  </p>
                </div>
              )}

              {submittedTransaction && (
                <div className="rounded-2xl border border-[#14F195]/20 bg-[#14F195]/[0.07] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#14F195]" />
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#14F195]/85">Enviada para Devnet</p>
                    </div>
                    <span className="rounded-full border border-[#14F195]/18 bg-[#14F195]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#14F195]">
                      submitted
                    </span>
                  </div>
                  <p className="break-words text-xs leading-relaxed text-white/50">
                    Signature: {submittedTransaction.signature}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-white/44">
                    Status: {submittedTransaction.confirmationStatus}
                    {submittedTransaction.slot ? ` | Slot: ${submittedTransaction.slot}` : ''}
                  </p>
                  {submittedTransaction.errorMessage && (
                    <p className="mt-2 break-words text-xs leading-relaxed text-[#FF8A9E]">
                      {submittedTransaction.errorMessage}
                    </p>
                  )}
                  <a
                    href={submittedTransaction.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-xs font-semibold text-[#14F195] hover:text-[#8FFFE0]"
                  >
                    Ver no Solana Explorer →
                  </a>
                </div>
              )}

              <div className="rounded-2xl border border-white/[0.07] bg-black/24 p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-white/42">Obrigatorio antes de executar</p>
                <div className="space-y-2.5">
                  {review.requiredBeforeExecution.map(item => (
                    <div key={item} className="flex gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#14F195]/80" />
                      <p className="text-sm leading-relaxed text-white/56">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#FF5C7A]/16 bg-[#FF5C7A]/[0.045] p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#FF8A9E]/85">Nunca permitido</p>
                <div className="space-y-2.5">
                  {review.blockedActions.map(item => (
                    <div key={item} className="flex gap-2.5">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8A9E]/80" />
                      <p className="text-sm leading-relaxed text-white/54">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#9945FF]" />
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/48">Portao de confirmacao</p>
                </div>
                <p className="mb-3 text-sm leading-relaxed text-white/52">{confirmationCheck.reason}</p>
                <button
                  type="button"
                  onClick={() => onConfirm(result)}
                  disabled={!confirmationCheck.allowed || confirmed}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#14F195]/22 bg-[#14F195]/10 px-4 py-3 text-sm font-semibold text-[#14F195] transition-colors hover:bg-[#14F195]/15 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.025] disabled:text-white/28"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {confirmed ? 'Confirmado no app' : 'Confirmar intencao no app'}
                </button>
                {canPrepareTransaction && (
                  <button
                    type="button"
                    onClick={() => onPrepareTransaction(result)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#00D1FF]/22 bg-[#00D1FF]/10 px-4 py-3 text-sm font-semibold text-[#7DE3FF] transition-colors hover:bg-[#00D1FF]/15"
                  >
                    <Send className="h-4 w-4" />
                    Preparar transacao Devnet
                  </button>
                )}
                {canSignTransaction && (
                  <button
                    type="button"
                    onClick={() => onSignTransaction(result)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#9945FF]/24 bg-[#9945FF]/12 px-4 py-3 text-sm font-semibold text-[#C4B5FD] transition-colors hover:bg-[#9945FF]/18"
                  >
                    <Wallet className="h-4 w-4" />
                    Assinar na wallet
                  </button>
                )}
                {canSubmitTransaction && (
                  <button
                    type="button"
                    onClick={() => onSubmitTransaction(result)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#14F195]/24 bg-[#14F195]/12 px-4 py-3 text-sm font-semibold text-[#14F195] transition-colors hover:bg-[#14F195]/18"
                  >
                    <Send className="h-4 w-4" />
                    Enviar para Devnet
                  </button>
                )}
                {canConfirmTransaction && (
                  <button
                    type="button"
                    onClick={() => onConfirmTransaction(result)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#5AD7FF]/24 bg-[#5AD7FF]/10 px-4 py-3 text-sm font-semibold text-[#7DE3FF] transition-colors hover:bg-[#5AD7FF]/15"
                  >
                    <Clock3 className="h-4 w-4" />
                    Verificar confirmacao
                  </button>
                )}
                {valueMoving && (
                  <button
                    type="button"
                    onClick={copyTransactionSummary}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm font-semibold text-white/62 transition-colors hover:bg-white/[0.06] hover:text-white/82"
                  >
                    <Copy className="h-4 w-4" />
                    {summaryCopied ? 'Resumo copiado' : 'Copiar resumo da transacao'}
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-black/24 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-[#5AD7FF]" />
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">Historico local</p>
                </div>
                {history.length === 0 ? (
                  <p className="text-sm leading-relaxed text-white/38">Nenhuma intencao anterior registrada neste navegador.</p>
                ) : (
                  <div className="space-y-2.5">
                    {history.slice(0, 4).map(item => (
                      <div key={item.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-semibold text-white/62">{item.type.replaceAll('_', ' ')}</p>
                          <span className="shrink-0 rounded-full border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-[9px] text-white/38">
                            {item.status}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-white/38">{item.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DevnetReceiptsHistory refreshKey={receiptsRefreshKey} />

              <LocalRulesHistory
                refreshKey={rulesRefreshKey}
                onSendNotificationDraft={onSendNotificationDraft}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
