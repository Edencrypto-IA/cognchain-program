import { NextRequest, NextResponse } from 'next/server';
import { validateWithDeepSeek } from '@/lib/mythos/deepseek-orchestrator';
import { checkRateLimit, Limits, safeErrorMessage } from '@/lib/security';

type DeepSeekValidateBody = {
  userQuery?: unknown;
  query?: unknown;
  response?: unknown;
  expectedSource?: unknown;
};

function getIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const rate = checkRateLimit(getIp(request), '/api/mythos/deepseek/validate');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many DeepSeek validation requests. Wait a moment and try again.' },
        { status: 429 }
      );
    }

    const body = await request.json() as DeepSeekValidateBody;
    const userQuery = (typeof body.userQuery === 'string' ? body.userQuery : typeof body.query === 'string' ? body.query : '')
      .trim()
      .slice(0, Limits.MAX_PROMPT_LENGTH);
    const response = (typeof body.response === 'string' ? body.response : '')
      .trim()
      .slice(0, Limits.MAX_CONTENT_LENGTH);
    const expectedSource = typeof body.expectedSource === 'string'
      ? body.expectedSource.trim().slice(0, 240)
      : undefined;

    if (!userQuery || !response) {
      return NextResponse.json({ error: 'userQuery and response are required' }, { status: 400 });
    }

    const validation = await validateWithDeepSeek({ userQuery, response, expectedSource });
    return NextResponse.json({
      ...validation,
      securityBoundary: 'Validation only. No wallet signature, transaction submit, buy, sell, swap, PIX, payment, or fund movement is executed.',
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 });
  }
}
