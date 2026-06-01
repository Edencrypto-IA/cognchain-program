import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/app/api/auth/verify/route';

const COOKIE_NAME = 'mythos_pro_access';
const TOKEN_SUBJECT = 'mythos-pro-route';
const MAX_AGE_SECONDS = 60 * 60 * 8;

function getSecret() {
  return (
    process.env.MYTHOS_PRO_ACCESS_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.USER_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    'local-mythos-pro-secret'
  );
}

function signToken(subject: string) {
  return createHmac('sha256', getSecret()).update(subject).digest('hex');
}

function isValidToken(value?: string) {
  if (!value) return false;
  const expected = signToken(TOKEN_SUBJECT);
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function GET(request: NextRequest) {
  const configured = Boolean(process.env.MYTHOS_PRO_ACCESS_PASSWORD);
  const adminToken = request.cookies.get('cog_admin')?.value || request.headers.get('x-admin-token') || '';
  const adminUnlocked = adminToken ? verifyAdminToken(adminToken) : false;
  const unlocked = adminUnlocked || (configured && isValidToken(request.cookies.get(COOKIE_NAME)?.value));

  return NextResponse.json({
    ok: true,
    configured,
    unlocked,
    adminUnlocked,
  });
}

export async function POST(request: NextRequest) {
  const configuredUser = process.env.MYTHOS_PRO_ACCESS_USER || 'mythos';
  const configuredPassword = process.env.MYTHOS_PRO_ACCESS_PASSWORD;

  if (!configuredPassword) {
    return NextResponse.json(
      {
        ok: false,
        error: 'MYTHOS_PRO_ACCESS_PASSWORD is not configured on the server.',
      },
      { status: 503 },
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const username = String(body.username || '').trim();
  const password = String(body.password || '');

  if (username !== configuredUser || password !== configuredPassword) {
    return NextResponse.json({ ok: false, error: 'Invalid Mythos PRO access credentials.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, unlocked: true });
  response.cookies.set({
    name: COOKIE_NAME,
    value: signToken(TOKEN_SUBJECT),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_SECONDS,
    path: '/',
  });

  return response;
}
