import type {
  WalletAgentAlertDelivery,
  WalletAgentAlertDeliveryChannel,
  WalletAgentLocalNotificationDraft,
  WalletAgentLocalRule,
} from './types';

function createChannelDelivery(draft: WalletAgentLocalNotificationDraft): WalletAgentAlertDeliveryChannel[] {
  return draft.channels.map(channel => {
    if (channel === 'congchain_chat') {
      return {
        channel,
        status: 'ready',
        target: 'current_congchain_chat',
        reason: 'Chat delivery can be shown locally after explicit user action.',
      };
    }

    if (channel === 'email') {
      const ready = !!draft.emailAddress && draft.emailVerifiedLocally;
      return {
        channel,
        status: ready ? 'ready' : 'pending',
        target: ready ? draft.emailAddress : null,
        reason: ready
          ? 'Email target is locally valid. Real delivery still requires an explicit send step.'
          : 'Email delivery is pending a valid email target.',
      };
    }

    return {
      channel,
      status: draft.walletActionRequired ? 'pending' : 'blocked',
      target: null,
      reason: draft.walletActionRequired
        ? 'Wallet approval is a future manual step and cannot be requested by alert delivery.'
        : 'Wallet is not needed for notify-only alert delivery.',
    };
  });
}

export function createWalletAgentAlertDeliveryContract(
  draft: WalletAgentLocalNotificationDraft,
  rule: WalletAgentLocalRule,
  now = new Date()
): WalletAgentAlertDelivery {
  const channels = createChannelDelivery(draft);
  const canNotifyChat = channels.some(item => item.channel === 'congchain_chat' && item.status === 'ready');
  const canSendEmail = channels.some(item => item.channel === 'email' && item.status === 'ready');
  const canRequestWalletApproval = false;

  return {
    id: `waalert_${draft.id}_${now.getTime()}`,
    draftId: draft.id,
    ruleId: rule.id,
    status: 'draft',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    title: draft.title,
    message: draft.message,
    channels,
    safety: {
      canSendEmail,
      canNotifyChat,
      canRequestWalletApproval,
      canExecuteTransaction: false,
      canSchedule: false,
      notes: [
        'Alert delivery is not a transaction pipeline.',
        'Email delivery must be triggered by a future explicit user action.',
        'Wallet approval cannot be requested from an alert delivery contract.',
        'Scheduling remains disabled until a backend scheduler phase exists.',
      ],
    },
    blockedActions: [
      'Do not sign wallet transactions from alert delivery.',
      'Do not submit blockchain transactions from alert delivery.',
      'Do not schedule background jobs from this contract.',
      'Do not send external notifications without explicit user action.',
      `Rule remains ${rule.status.replaceAll('_', ' ')}.`,
    ],
  };
}
