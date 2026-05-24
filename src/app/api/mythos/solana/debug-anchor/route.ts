import { NextRequest, NextResponse } from 'next/server';
import { runMythosSolanaEngine } from '@/features/agent-memory-bridge/solana-dev-engine';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rate = checkRateLimit(ip, '/api/mythos/solana/debug-anchor');
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Too many Mythos Solana requests. Try again soon.' }, { status: 429 });
    }

    const body = await request.json();
    const result = await runMythosSolanaEngine({
      mode: 'anchor',
      input: body.input,
      cluster: body.cluster,
      model: body.model,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
