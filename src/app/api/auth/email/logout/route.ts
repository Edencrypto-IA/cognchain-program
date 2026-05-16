import { NextResponse } from 'next/server';
import { USER_EMAIL_COOKIE } from '@/lib/user-email-auth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(USER_EMAIL_COOKIE, '', {
    maxAge: 0,
    path: '/',
  });
  return res;
}
