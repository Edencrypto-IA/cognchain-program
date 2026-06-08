import { NextRequest, NextResponse } from 'next/server';
import { parseMythosExternalDataCommand, runMythosExternalDataQuery } from '@/lib/mythos/external-data-query';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

function getIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
}

function dataQueryErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (
      message.startsWith('Use /') ||
      message.includes('Configure ') ||
      message.includes('Nao encontrei') ||
      message.includes('Provider returned HTTP')
    ) {
      return message;
    }
  }
  return safeErrorMessage(error);
}

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(getIp(request), '/api/mythos/data/query');
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many Mythos data requests. Try again soon.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  const command = request.nextUrl.searchParams.get('command') || '';
  const parsed = parseMythosExternalDataCommand(command);
  if (!parsed) {
    return NextResponse.json({ error: 'Comando de dados nao reconhecido.' }, { status: 400 });
  }

  try {
    const report = await runMythosExternalDataQuery(parsed.kind, parsed.query);
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: dataQueryErrorMessage(error) }, { status: 500 });
  }
}
