import { NextRequest, NextResponse } from 'next/server';
import { routeWithDeepSeek } from '@/lib/mythos/deepseek-orchestrator';
import { checkRateLimit, Limits, safeErrorMessage } from '@/lib/security';

type DeepSeekRouteBody = {
  command?: unknown;
  prompt?: unknown;
  forceRemote?: unknown;
};

function getIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const rate = checkRateLimit(getIp(request), '/api/mythos/deepseek/route');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many DeepSeek route requests. Wait a moment and try again.' },
        { status: 429 }
      );
    }

    const body = await request.json() as DeepSeekRouteBody;
    const rawCommand = typeof body.command === 'string'
      ? body.command
      : typeof body.prompt === 'string'
        ? body.prompt
        : '';
    const command = rawCommand.trim().slice(0, Limits.MAX_PROMPT_LENGTH);
    if (!command) {
      return NextResponse.json({ error: 'command is required' }, { status: 400 });
    }

    const decision = await routeWithDeepSeek(command, { forceRemote: body.forceRemote === true });
    return NextResponse.json({
      ...decision,
      securityBoundary: 'Read-only router. No wallet signature, transaction submit, buy, sell, swap, PIX, payment, or fund movement is executed.',
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 });
  }
}
