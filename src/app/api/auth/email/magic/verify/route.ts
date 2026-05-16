import { NextRequest, NextResponse } from 'next/server';
import {
  USER_EMAIL_COOKIE,
  createVerifiedUserEmailSession,
  signUserEmailSession,
  toPublicUserEmailSession,
  verifyUserEmailMagicLinkToken,
} from '@/lib/user-email-auth';

function createVerifiedResponse(req: NextRequest, token: string | null, redirectPath?: string | null) {
  const link = verifyUserEmailMagicLinkToken(token);
  if (!link) {
    return NextResponse.json({ error: 'Link invalido ou expirado.' }, { status: 400 });
  }

  const session = createVerifiedUserEmailSession(link.email);
  const sessionToken = signUserEmailSession(session);

  if (redirectPath) {
    const redirectUrl = new URL(redirectPath.startsWith('/') ? redirectPath : '/', req.url);
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.set(USER_EMAIL_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(session.expiresAt),
      path: '/',
    });
    return res;
  }

  const res = NextResponse.json({
    ok: true,
    user: toPublicUserEmailSession(session),
    message: 'Email verificado por magic link.',
  });
  res.cookies.set(USER_EMAIL_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(session.expiresAt),
    path: '/',
  });
  return res;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const redirect = req.nextUrl.searchParams.get('redirect');
  return createVerifiedResponse(req, token, redirect);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return createVerifiedResponse(req, typeof body.token === 'string' ? body.token : null);
}
