import { NextRequest, NextResponse } from 'next/server';
import { removeMythosTask } from '@/lib/mythos/task-scheduler';
import { checkRateLimit } from '@/lib/security';
import { verifyAdminToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = request.cookies.get('cog_admin')?.value ?? '';
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Admin required' }, { status: 401 });
  }
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rate = checkRateLimit(ip, '/api/mythos/tasks');
  if (!rate.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const { id } = await context.params;
  const removed = removeMythosTask(id);
  if (!removed) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
