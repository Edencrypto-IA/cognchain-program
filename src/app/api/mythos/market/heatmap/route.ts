import { NextRequest, NextResponse } from 'next/server';
import { getMythosMarketHeatmap } from '@/lib/market/crypto-visuals';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

function getIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
}

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(getIp(request), '/api/mythos/market/heatmap');
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many Mythos heatmap requests. Try again soon.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  try {
    const heatmap = await getMythosMarketHeatmap();
    return NextResponse.json(heatmap);
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
