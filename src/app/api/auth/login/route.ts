import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function makeToken(secret: string): string {
  const payload = `admin:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));

  const expectedUser = process.env.ADMIN_USERNAME || 'admin';
  const expectedHash = process.env.ADMIN_PASSWORD_HASH || '';
  const secret       = process.env.ADMIN_SESSION_SECRET || 'fallback-secret';

  if (!username || !password) {
    return NextResponse.json({ error: 'Credenciais obrigatórias' }, { status: 400 });
  }

  const inputHash = crypto.createHash('sha256').update(password).digest('hex');

  if (username !== expectedUser || inputHash !== expectedHash) {
    return NextResponse.json({ error: 'Usuário ou senha incorretos' }, { status: 401 });
  }

  const token = makeToken(secret);
  // 30 days
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const res = NextResponse.json({ ok: true, token });
  res.cookies.set('cog_admin', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires,
    path: '/',
  });
  return res;
}
