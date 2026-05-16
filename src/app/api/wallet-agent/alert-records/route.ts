import { NextRequest, NextResponse } from 'next/server';
import {
  createWalletAgentAlertPersistenceRecordContract,
} from '@/features/wallet-agent/alert-records';
import type {
  WalletAgentAlertDelivery,
  WalletAgentAlertDeliveryReceipt,
} from '@/features/wallet-agent';
import { checkRateLimit } from '@/lib/security';
import { USER_EMAIL_COOKIE, verifyUserEmailToken } from '@/lib/user-email-auth';

function getClientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

function isValidDelivery(value: unknown): value is WalletAgentAlertDelivery {
  const delivery = value as WalletAgentAlertDelivery;
  return !!delivery
    && typeof delivery.id === 'string'
    && typeof delivery.draftId === 'string'
    && typeof delivery.ruleId === 'string'
    && typeof delivery.status === 'string'
    && typeof delivery.title === 'string'
    && typeof delivery.message === 'string'
    && Array.isArray(delivery.channels)
    && !!delivery.safety
    && delivery.safety.canExecuteTransaction === false
    && delivery.safety.canSchedule === false;
}

function isValidReceipt(value: unknown): value is WalletAgentAlertDeliveryReceipt {
  if (value === null || value === undefined) return false;

  const receipt = value as WalletAgentAlertDeliveryReceipt;
  return !!receipt
    && typeof receipt.id === 'string'
    && typeof receipt.deliveryId === 'string'
    && typeof receipt.ruleId === 'string'
    && typeof receipt.draftId === 'string'
    && receipt.channel === 'email'
    && (receipt.status === 'sent' || receipt.status === 'failed')
    && typeof receipt.target === 'string';
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, '/api/wallet-agent/alert-records');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em instantes.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const delivery = body?.delivery;
  const receipt = body?.receipt;

  if (!isValidDelivery(delivery)) {
    return NextResponse.json({ error: 'Contrato de entrega invalido.' }, { status: 400 });
  }

  if (receipt !== undefined && receipt !== null && !isValidReceipt(receipt)) {
    return NextResponse.json({ error: 'Recibo de alerta invalido.' }, { status: 400 });
  }

  if (isValidReceipt(receipt) && receipt.deliveryId !== delivery.id) {
    return NextResponse.json({ error: 'Recibo nao pertence ao contrato de entrega.' }, { status: 400 });
  }

  const session = verifyUserEmailToken(req.cookies.get(USER_EMAIL_COOKIE)?.value);
  const record = createWalletAgentAlertPersistenceRecordContract({
    delivery,
    receipt: isValidReceipt(receipt) ? receipt : null,
    user: session ? { email: session.email, verified: session.verified } : null,
  });

  return NextResponse.json({
    ok: true,
    record,
    mode: record.persistence.mode,
    persisted: false,
    message: 'Contrato de persistencia preparado. Nenhum banco, scheduler, wallet ou transacao foi acionado nesta fase.',
  });
}
