import { NextRequest, NextResponse } from 'next/server';
import { getMythosSolanaEcosystemReport, type MythosSolanaReportMode } from '@/lib/market/solana-ecosystem-report';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

function getIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
}

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(getIp(request), '/api/mythos/market/solana');
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many Mythos Solana market requests. Try again soon.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  try {
    const rawMode = request.nextUrl.searchParams.get('mode');
    const mode: MythosSolanaReportMode = rawMode === 'protocols' || rawMode === 'volume' || rawMode === 'memes' ? rawMode : 'price';
    const report = await getMythosSolanaEcosystemReport(mode);
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
