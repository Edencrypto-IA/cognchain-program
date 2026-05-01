import { NextResponse } from 'next/server';
import { getSolanaSnapshot } from '@/services/blockchain/solana-tools';
import { safeErrorMessage } from '@/lib/security';

// GET /api/agents/solana-snapshot — real-time wallet + price data (read-only)
export async function GET() {
  try {
    const snapshot = await getSolanaSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
