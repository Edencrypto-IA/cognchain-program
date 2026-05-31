import { NextRequest, NextResponse } from 'next/server';
import { getMythosWalletIntelligence } from '@/lib/mythos/wallet-intelligence';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

function getIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
}

export async function GET(request: NextRequest) {
  const ip = getIp(request);
  const rate = checkRateLimit(ip, '/api/mythos/wallet/intelligence');
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many Mythos wallet intelligence requests. Try again soon.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  const address = request.nextUrl.searchParams.get('address')?.trim() || '';
  if (!address) {
    return NextResponse.json({ error: 'Missing wallet address.' }, { status: 400 });
  }

  try {
    const intelligence = await getMythosWalletIntelligence(address);
    return NextResponse.json({ intelligence });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 });
  }
}
