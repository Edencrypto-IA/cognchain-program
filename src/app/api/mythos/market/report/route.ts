import { NextRequest, NextResponse } from 'next/server';
import { getMythosCryptoMarketReport } from '@/lib/market/crypto-report';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

function getIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
}

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(getIp(request), '/api/mythos/market/report');
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many Mythos market report requests. Try again soon.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  try {
    const report = await getMythosCryptoMarketReport();
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
