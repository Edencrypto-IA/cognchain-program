import { NextResponse } from 'next/server';
import { loadMemory, loadMemoryZkBundle } from '@/services/memory';
import { parseBridgeEnvelope } from '@/features/agent-memory-bridge/bridge';
import { safeErrorMessage, validateHash } from '@/lib/security';
import { db } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  try {
    const { hash } = await params;
    const safeHash = validateHash(hash);
    const memory = await loadMemory(safeHash);
    if (!memory) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }

    const raw = await db.memory.findUnique({
      where: { hash: safeHash },
      select: { content: true, poiTxHash: true, clientId: true },
    });
    const bridge = raw?.content ? parseBridgeEnvelope(raw.content) : null;
    const zk = await loadMemoryZkBundle(safeHash);

    return NextResponse.json({
      hash: memory.hash,
      exists: true,
      verified: memory.verified,
      zkVerified: memory.zkVerified || !!zk,
      on_chain: !!raw?.poiTxHash,
      txHash: raw?.poiTxHash || null,
      timestamp: memory.timestamp,
      model: memory.model,
      vault: raw?.clientId || null,
      source: bridge?.source || null,
      agent: bridge?.agent || null,
      agentId: bridge?.agentId || null,
      contentType: bridge?.contentType || null,
      proofUrl: `/api/memory/${memory.hash}/proof`,
      readUrl: `/api/memory/${memory.hash}`,
      safety: {
        storesSecrets: false,
        storesPrivateKeys: false,
        storesSignedPayloads: false,
        canMoveFunds: false,
      },
    });
  } catch (error: unknown) {
    const status = error instanceof Error && error.name === 'ValidationError' ? 400 : 500;
    return NextResponse.json({ error: safeErrorMessage(error) }, { status });
  }
}
