import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/security';
import {
  USER_EMAIL_COOKIE,
  createUserEmailSession,
  normalizeUserEmail,
  signUserEmailSession,
  toPublicUserEmailSession,
} from '@/lib/user-email-auth';

function getClientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, '/api/auth/email/start');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em instantes.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = normalizeUserEmail(body.email);

  if (!email) {
    return NextResponse.json({ error: 'Informe um email valido.' }, { status: 400 });
  }

  const session = createUserEmailSession(email);
  const token = signUserEmailSession(session);
  const res = NextResponse.json({
    ok: true,
    user: toPublicUserEmailSession(session),
    delivery: 'local_identity_only',
    message: 'Email conectado como identidade local. Nenhum email foi enviado nesta fase.',
  });

  res.cookies.set(USER_EMAIL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(session.expiresAt),
    path: '/',
  });

  return res;
}
