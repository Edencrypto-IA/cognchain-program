import { NextRequest, NextResponse } from 'next/server';
import { runDecisionEngine, getDecisionHistory } from '@/services/agents/decision-engine';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

// GET — Decision history
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);

    const history = await getDecisionHistory(id, limit);
    return NextResponse.json({ decisions: history });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

// POST — Trigger decision engine manually
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rate = checkRateLimit(ip, '/api/agents/decisions');
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const results = await runDecisionEngine(id);
    return NextResponse.json({
      decisions: results.length,
      results,
      timestamp: Date.now() / 1000,
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
