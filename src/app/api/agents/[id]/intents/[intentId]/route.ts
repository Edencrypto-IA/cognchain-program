import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeErrorMessage } from '@/lib/security';
import { executeApprovedIntent } from '@/services/blockchain/solana-tools';
import { saveMemory } from '@/services/memory/memory.service';

type Params = { params: Promise<{ id: string; intentId: string }> };

// PUT /api/agents/[id]/intents/[intentId] — approve or reject
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id, intentId } = await params;
    const { action } = await req.json(); // "approve" | "reject"

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
    }

    const intent = await db.solanaIntent.findUnique({ where: { id: intentId } });
    if (!intent || intent.agentId !== id) {
      return NextResponse.json({ error: 'Intent not found' }, { status: 404 });
    }
    if (intent.status !== 'pending') {
      return NextResponse.json({ error: `Intent is already ${intent.status}` }, { status: 409 });
    }
    if (new Date() > intent.expiresAt) {
      await db.solanaIntent.update({ where: { id: intentId }, data: { status: 'expired' } });
      return NextResponse.json({ error: 'Intent expired' }, { status: 410 });
    }

    if (action === 'reject') {
      await db.solanaIntent.update({ where: { id: intentId }, data: { status: 'rejected' } });
      return NextResponse.json({ ok: true, status: 'rejected' });
    }

    // Approve → mark approved then execute
    await db.solanaIntent.update({ where: { id: intentId }, data: { status: 'approved' } });

    const result = await executeApprovedIntent(intentId);

    if (result.ok && result.txHash) {
      // Save execution as verified memory for the agent
      await saveMemory({
        content: [
          `[SOLANA EXECUTION — Agent ${id}]`,
          `Type: ${intent.type.toUpperCase()}`,
          `Action: ${intent.description}`,
          `Amount: ${intent.amount} ${intent.fromToken}`,
          intent.toToken ? `To: ${intent.toToken}` : '',
          `TX: ${result.txHash}`,
          `Network: devnet`,
        ].filter(Boolean).join('\n'),
        model: 'claude',
      }).catch(() => {});
    }

    return NextResponse.json({ ok: result.ok, txHash: result.txHash, error: result.error });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
