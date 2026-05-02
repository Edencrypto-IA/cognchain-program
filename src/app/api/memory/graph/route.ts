import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const memories = await db.memory.findMany({
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
    },
    orderBy: { timestamp: 'asc' },
  });

  const nodes = memories.map((m) => ({
    id: m.hash,
    label: m.content.slice(0, 60).replace(/\n/g, ' '),
    model: m.model,
    timestamp: m.timestamp,
    score: m.score ?? 0,
    verified: m.verified,
    zkVerified: m.zkVerified,
    onChain: !!m.poiTxHash,
    hash: m.hash,
  }));

  const links: { source: string; target: string }[] = [];
  const hashSet = new Set(memories.map((m) => m.hash));

  for (const m of memories) {
    if (m.parentHash && hashSet.has(m.parentHash)) {
      links.push({ source: m.parentHash, target: m.hash });
    }
  }

  return NextResponse.json({ nodes, links });
}
