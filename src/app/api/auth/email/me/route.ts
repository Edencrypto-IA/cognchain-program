import { NextRequest, NextResponse } from 'next/server';
import { USER_EMAIL_COOKIE, toPublicUserEmailSession, verifyUserEmailToken } from '@/lib/user-email-auth';

export async function GET(req: NextRequest) {
  const session = verifyUserEmailToken(req.cookies.get(USER_EMAIL_COOKIE)?.value);

  return NextResponse.json({
    authenticated: !!session,
    user: session ? toPublicUserEmailSession(session) : null,
  });
}
