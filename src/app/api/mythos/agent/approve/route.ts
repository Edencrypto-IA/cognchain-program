import { NextRequest, NextResponse } from 'next/server';
import { approveMythosProposal } from '@/lib/mythos/proposal-approval';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rate = checkRateLimit(ip, '/api/mythos/agent/approve');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many approvals. Wait a moment.' }, { status: 429 });
  }

  let body: { kind?: unknown; payload?: unknown };
  try {
    body = await request.json() as { kind?: unknown; payload?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.kind !== 'string' || !body.kind.trim()) {
    return NextResponse.json({ error: 'Missing kind' }, { status: 400 });
  }
  const payload = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
    ? body.payload as Record<string, unknown>
    : {};

  try {
    const result = await approveMythosProposal(body.kind, payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 });
  }
}
