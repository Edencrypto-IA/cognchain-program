import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-key-auth';
import { db } from '@/lib/db';
import { parseBridgeEnvelope } from '@/features/agent-memory-bridge/bridge';
import { safeErrorMessage } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiKey(request);
    if ('error' in auth) {
      const e = auth as { error: string; status: 401 | 429 };
      return NextResponse.json({ error: e.error }, { status: e.status });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 25), 1), 100);
    const source = searchParams.get('source')?.toLowerCase().trim();
    const agentId = searchParams.get('agentId')?.toLowerCase().trim();
    const clientPrefix = `agent:${auth.key.id}:`;

    const memories = await db.memory.findMany({
      where: {
        clientId: {
          startsWith: source
            ? `${clientPrefix}${source}:${agentId || ''}`
            : clientPrefix,
        },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        hash: true,
        content: true,
        model: true,
        timestamp: true,
        parentHash: true,
        score: true,
        verified: true,
        zkVerified: true,
        poiTxHash: true,
        clientId: true,
      },
    });

    return NextResponse.json({
      owner: auth.key.owner,
      count: memories.length,
      memories: memories.map(memory => {
        const bridge = parseBridgeEnvelope(memory.content);
        return {
          hash: memory.hash,
          content_hash: memory.hash,
          contentHash: memory.hash,
          memory_id: memory.hash,
          model: memory.model,
          timestamp: memory.timestamp,
          created_at: memory.timestamp,
          parentHash: memory.parentHash,
          score: memory.score,
          confidence_bps: Math.round((memory.score ?? 0.8) * 10000),
          importance_bps: Math.round((memory.score ?? 0.8) * 10000),
          verified: memory.verified,
          zkVerified: memory.zkVerified,
          on_chain: !!memory.poiTxHash,
          txHash: memory.poiTxHash,
          vault: memory.clientId,
          source: bridge?.source,
          agent: bridge?.agent,
          agentId: bridge?.agentId,
          contentType: bridge?.contentType,
          runId: bridge?.runId,
          content: bridge?.body || memory.content,
          readUrl: `/api/memory/${memory.hash}`,
          proofUrl: `/api/memory/${memory.hash}/proof`,
          verifyUrl: `/api/memory/verify/${memory.hash}`,
        };
      }),
    });
  } catch (error: unknown) {
    const status = error instanceof Error && error.name === 'ValidationError' ? 400 : 500;
    return NextResponse.json({ error: safeErrorMessage(error) }, { status });
  }
}
