import { NextRequest, NextResponse } from 'next/server';
import { storeOnSolana } from '@/services/blockchain';
import { checkRateLimit, validateHash, safeErrorMessage } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting — blockchain operations are expensive (airdrops)
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rate = checkRateLimit(ip, '/api/blockchain/store');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const { hash } = body;

    const safeHash = validateHash(hash);

    const result = await storeOnSolana(safeHash);

    return NextResponse.json({
      success: result.success,
      txHash: result.txHash,
      network: result.network,
      timestamp: result.timestamp,
      message: result.message,
      explorerUrl: result.explorerUrl,
      simulated: result.simulated,
    });
  } catch (error: unknown) {
    const status = error instanceof Error && error.name === 'ValidationError' ? 400 : 500;
    return NextResponse.json({ error: safeErrorMessage(error) }, { status });
  }
}
