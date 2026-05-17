import { NextRequest, NextResponse } from 'next/server';
import {
  deleteWalletAgentAlertServerHistory,
  getWalletAgentAlertHistoryRetentionPolicy,
  WALLET_AGENT_ALERT_HISTORY_DELETE_CONFIRMATION,
} from '@/features/wallet-agent/alert-record-store';
import { checkRateLimit } from '@/lib/security';
import { USER_EMAIL_COOKIE, verifyUserEmailToken } from '@/lib/user-email-auth';

function getClientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

function getVerifiedSession(req: NextRequest) {
  const session = verifyUserEmailToken(req.cookies.get(USER_EMAIL_COOKIE)?.value);
  if (!session) return { session: null, response: NextResponse.json({ error: 'Email identity necessaria.' }, { status: 401 }) };
  if (!session.verified) return { session: null, response: NextResponse.json({ error: 'Email identity precisa estar verificada por magic link.' }, { status: 403 }) };
  return { session, response: null };
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, '/api/wallet-agent/alert-records/history/delete');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em instantes.' }, { status: 429 });
  }

  const { session, response } = getVerifiedSession(req);
  if (!session) return response;

  const body = await req.json().catch(() => null);
  const confirmation = typeof body?.confirmation === 'string' ? body.confirmation.trim() : '';
  const requestedEmail = typeof body?.ownerEmail === 'string' ? body.ownerEmail.trim().toLowerCase() : '';
  const sessionEmail = session.email.toLowerCase();

  if (requestedEmail && requestedEmail !== sessionEmail) {
    return NextResponse.json({ error: 'Voce so pode apagar o historico do email verificado atual.' }, { status: 403 });
  }

  if (confirmation !== WALLET_AGENT_ALERT_HISTORY_DELETE_CONFIRMATION) {
    return NextResponse.json({
      error: 'Confirmacao obrigatoria para apagar historico de alertas.',
      requiredConfirmation: WALLET_AGENT_ALERT_HISTORY_DELETE_CONFIRMATION,
      retention: getWalletAgentAlertHistoryRetentionPolicy(),
      safety: {
        metadataOnly: true,
        canStoreSecrets: false,
        canExecuteTransaction: false,
        canSchedule: false,
      },
    }, { status: 400 });
  }

  const deletion = await deleteWalletAgentAlertServerHistory(session.email);
  return NextResponse.json({
    ok: true,
    deletion,
    retention: getWalletAgentAlertHistoryRetentionPolicy(),
    message: deletion.storage.durable
      ? 'Historico de alertas apagado do banco duravel para o email verificado.'
      : 'Historico de alertas apagado do armazenamento em memoria para o email verificado.',
  });
}
