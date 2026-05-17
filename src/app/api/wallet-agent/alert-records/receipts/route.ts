import { NextRequest, NextResponse } from 'next/server';
import {
  createWalletAgentAlertServerReceipt,
  getWalletAgentAlertHistoryStorageConfig,
  readWalletAgentAlertServerReceipts,
  upsertWalletAgentAlertServerReceipt,
} from '@/features/wallet-agent/alert-record-store';
import type { WalletAgentAlertPersistenceRecord } from '@/features/wallet-agent';
import { checkRateLimit } from '@/lib/security';
import { USER_EMAIL_COOKIE, verifyUserEmailToken } from '@/lib/user-email-auth';

function getClientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

function isValidPersistenceRecord(value: unknown): value is WalletAgentAlertPersistenceRecord {
  const record = value as WalletAgentAlertPersistenceRecord;
  return !!record
    && typeof record.id === 'string'
    && typeof record.deliveryId === 'string'
    && typeof record.ruleId === 'string'
    && typeof record.draftId === 'string'
    && !!record.delivery
    && !!record.receipt
    && typeof record.receipt.id === 'string'
    && record.receipt.deliveryId === record.deliveryId
    && record.safety?.canStoreSecrets === false
    && record.safety?.canExecuteTransaction === false
    && record.safety?.canSchedule === false;
}

function getVerifiedSession(req: NextRequest) {
  const session = verifyUserEmailToken(req.cookies.get(USER_EMAIL_COOKIE)?.value);
  if (!session) return { session: null, response: NextResponse.json({ error: 'Email identity necessaria.' }, { status: 401 }) };
  if (!session.verified) return { session: null, response: NextResponse.json({ error: 'Email identity precisa estar verificada por magic link.' }, { status: 403 }) };
  return { session, response: null };
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, '/api/wallet-agent/alert-records/receipts');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em instantes.' }, { status: 429 });
  }

  const { session, response } = getVerifiedSession(req);
  if (!session) return response;

  const receipts = await readWalletAgentAlertServerReceipts(session.email);
  const storageConfig = getWalletAgentAlertHistoryStorageConfig();
  return NextResponse.json({
    ok: true,
    receipts,
    storage: {
      mode: storageConfig.activeMode,
      durable: storageConfig.durable,
      reason: storageConfig.reason,
    },
  });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, '/api/wallet-agent/alert-records/receipts');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em instantes.' }, { status: 429 });
  }

  const { session, response } = getVerifiedSession(req);
  if (!session) return response;

  const body = await req.json().catch(() => null);
  const record = body?.record;

  if (!isValidPersistenceRecord(record)) {
    return NextResponse.json({ error: 'Registro de persistencia invalido ou sem recibo.' }, { status: 400 });
  }

  if (record.userEmail && record.userEmail.toLowerCase() !== session.email.toLowerCase()) {
    return NextResponse.json({ error: 'Registro pertence a outro email.' }, { status: 403 });
  }

  const receipt = createWalletAgentAlertServerReceipt(record, session.email);
  if (!receipt) {
    return NextResponse.json({ error: 'Nao foi possivel criar recibo server-side.' }, { status: 400 });
  }

  const receipts = await upsertWalletAgentAlertServerReceipt(receipt);
  return NextResponse.json({
    ok: true,
    receipt,
    receipts,
    storage: receipt.storage,
    message: receipt.storage.durable
      ? 'Recibo server-side salvo em banco duravel.'
      : 'Recibo server-side salvo em memoria. Ainda nao e persistencia duravel de banco.',
  });
}
