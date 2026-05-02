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

  const links: { source: string; target: string; type: string }[] = [];
  const hashSet = new Set(memories.map((m) => m.hash));
  const linkedTargets = new Set<string>();

  // Parent-child links (explicit evolution chain)
  for (const m of memories) {
    if (m.parentHash && hashSet.has(m.parentHash)) {
      links.push({ source: m.parentHash, target: m.hash, type: 'chain' });
      linkedTargets.add(m.hash);
    }
  }

  // Temporal links: connect sequential memories within 24h window
  // (only if they don't already have a parent-child link)
  const WINDOW_SECS = 86400; // 24h
  for (let i = 0; i < memories.length - 1; i++) {
    const a = memories[i];
    const b = memories[i + 1];
    if (!linkedTargets.has(b.hash) && b.timestamp - a.timestamp <= WINDOW_SECS) {
      links.push({ source: a.hash, target: b.hash, type: 'temporal' });
      linkedTargets.add(b.hash);
    }
  }

  // Fallback: if still isolated nodes, chain them chronologically
  for (let i = 0; i < memories.length - 1; i++) {
    const a = memories[i];
    const b = memories[i + 1];
    if (!linkedTargets.has(b.hash)) {
      links.push({ source: a.hash, target: b.hash, type: 'temporal' });
    }
  }

  return NextResponse.json({ nodes, links });
}
