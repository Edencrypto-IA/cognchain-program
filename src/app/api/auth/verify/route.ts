import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export function verifyAdminToken(token: string): boolean {
  const secret = process.env.ADMIN_SESSION_SECRET || 'fallback-secret';
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const lastColon = decoded.lastIndexOf(':');
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (sig !== expected) return false;
    // Check expiry (30 days)
    const ts = parseInt(payload.split(':')[1] ?? '0', 10);
    return Date.now() - ts < 30 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('cog_admin')?.value || req.headers.get('x-admin-token') || '';
  const valid = verifyAdminToken(token);
  return NextResponse.json({ admin: valid });
}
