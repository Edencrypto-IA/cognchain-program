import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('cog_admin')?.value || req.headers.get('x-admin-token') || '';
  const valid = verifyAdminToken(token);
  return NextResponse.json({ admin: valid });
}
