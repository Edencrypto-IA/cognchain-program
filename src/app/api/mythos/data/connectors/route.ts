import { NextRequest, NextResponse } from 'next/server';
import { getMythosExternalConnectorReadiness } from '@/lib/mythos/external-data-connectors';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

function getIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
}

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(getIp(request), '/api/mythos/data/connectors');
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many Mythos connector readiness requests. Try again soon.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  try {
    return NextResponse.json(getMythosExternalConnectorReadiness());
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
