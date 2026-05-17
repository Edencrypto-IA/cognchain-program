import { NextRequest, NextResponse } from 'next/server';
import { createWalletAgentAlertHistoryExportBundle } from '@/features/wallet-agent/alert-record-store';
import { checkRateLimit } from '@/lib/security';
import { USER_EMAIL_COOKIE, verifyUserEmailToken } from '@/lib/user-email-auth';

function getClientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, '/api/wallet-agent/alert-records/history/export');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em instantes.' }, { status: 429 });
  }

  const session = verifyUserEmailToken(req.cookies.get(USER_EMAIL_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Email identity necessaria.' }, { status: 401 });
  }

  if (!session.verified) {
    return NextResponse.json({ error: 'Email identity precisa estar verificada por magic link.' }, { status: 403 });
  }

  const bundle = await createWalletAgentAlertHistoryExportBundle(session.email);
  return NextResponse.json({
    ok: true,
    bundle,
    contentType: 'application/json',
    message: 'Exportacao de historico de alertas pronta. O arquivo contem apenas metadata segura da conta verificada.',
  });
}
