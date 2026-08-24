import { NextRequest, NextResponse } from 'next/server';
import {
  addMythosTask,
  ensureMythosScheduler,
  listMythosTasks,
  tickMythosTasks,
} from '@/lib/mythos/task-scheduler';
import type { MythosChannel } from '@/lib/mythos/notify';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';
import { verifyAdminToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAdmin(request: NextRequest): boolean {
  const token = request.cookies.get('cog_admin')?.value ?? '';
  return token ? verifyAdminToken(token) : false;
}

function getIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Admin required' }, { status: 401 });
  }
  const rate = checkRateLimit(getIp(request), '/api/mythos/tasks');
  if (!rate.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const tasks = listMythosTasks();
  return NextResponse.json({ tasks, channels: { telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN), whatsappConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID) } });
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Admin required' }, { status: 401 });
  }
  const rate = checkRateLimit(getIp(request), '/api/mythos/tasks');
  if (!rate.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  let body: { command?: unknown; intervalMinutes?: unknown; channel?: unknown; target?: unknown };
  try {
    body = await request.json() as { command?: unknown; intervalMinutes?: unknown; channel?: unknown; target?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const channel = body.channel === 'whatsapp' ? 'whatsapp' : 'telegram';
  const result = addMythosTask({
    command: typeof body.command === 'string' ? body.command : '',
    intervalMinutes: typeof body.intervalMinutes === 'number' ? body.intervalMinutes : 60,
    channel,
    target: typeof body.target === 'string' ? body.target : '',
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  ensureMythosScheduler();
  return NextResponse.json({ ok: true, task: result.task });
}

/** Roda as tarefas vencidas manualmente (útil para testar sem esperar o tick). */
export async function PUT(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Admin required' }, { status: 401 });
  }
  const rate = checkRateLimit(getIp(request), '/api/mythos/tasks');
  if (!rate.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  try {
    const ran = await tickMythosTasks();
    return NextResponse.json({ ok: true, ran });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
