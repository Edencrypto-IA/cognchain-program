import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeErrorMessage } from '@/lib/security';
import { expireStaleIntents } from '@/services/blockchain/solana-tools';

// GET /api/agents/[id]/intents — list intents for this agent
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Expire stale intents before returning
    await expireStaleIntents().catch(() => {});

    const intents = await db.solanaIntent.findMany({
      where: { agentId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ intents });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

// POST /api/agents/[id]/intents — agent creates a new intent (server-side, called by the loop)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { type, description, fromToken, toToken, amount } = body;

    if (!type || !description || !fromToken || !amount) {
      return NextResponse.json({ error: 'type, description, fromToken, amount required' }, { status: 400 });
    }

    // Import tools lazily (avoids loading web3 at module-parse time in edge)
    const { createSwapIntent, createTransferIntent } = await import('@/services/blockchain/solana-tools');

    let result;
    if (type === 'swap') {
      if (!toToken) return NextResponse.json({ error: 'toToken required for swap' }, { status: 400 });
      result = await createSwapIntent(id, String(fromToken), String(toToken), Number(amount), String(description));
    } else if (type === 'transfer') {
      if (!toToken) return NextResponse.json({ error: 'toToken (destination address) required for transfer' }, { status: 400 });
      result = await createTransferIntent(id, String(toToken), Number(amount), String(description));
    } else {
      return NextResponse.json({ error: 'type must be "swap" or "transfer"' }, { status: 400 });
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 422 });
    }

    return NextResponse.json({ intentId: result.intentId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
