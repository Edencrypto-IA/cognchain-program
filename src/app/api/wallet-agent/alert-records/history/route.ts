import { NextRequest, NextResponse } from 'next/server';
import { createWalletAgentAlertServerHistory } from '@/features/wallet-agent/alert-record-store';
import { checkRateLimit } from '@/lib/security';
import { USER_EMAIL_COOKIE, verifyUserEmailToken } from '@/lib/user-email-auth';

function getClientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

function getLimit(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('limit');
  if (!raw) return 20;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(parsed, 50));
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, '/api/wallet-agent/alert-records/history');
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

  const history = createWalletAgentAlertServerHistory(session.email, getLimit(req));
  return NextResponse.json({
    ok: true,
    history,
    mode: 'read_only',
    message: 'Historico de alertas carregado em modo memoria. Ainda nao e banco duravel.',
  });
}
