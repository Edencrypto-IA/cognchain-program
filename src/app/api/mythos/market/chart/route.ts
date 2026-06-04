import { NextRequest, NextResponse } from 'next/server';
import { getMythosTokenChart } from '@/lib/market/crypto-visuals';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

function getIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
}

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(getIp(request), '/api/mythos/market/chart');
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many Mythos chart requests. Try again soon.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  try {
    const symbol = request.nextUrl.searchParams.get('symbol') || request.nextUrl.searchParams.get('token') || '';
    const days = Number(request.nextUrl.searchParams.get('days') || 30);
    const chart = await getMythosTokenChart(symbol, days);
    return NextResponse.json(chart);
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
