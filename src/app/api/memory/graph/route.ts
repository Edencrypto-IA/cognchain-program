import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

function modelKey(model: string) {
  const keys = ['gpt', 'claude', 'nvidia', 'gemini', 'deepseek', 'glm', 'minimax', 'qwen'];
  return keys.find(k => model.toLowerCase().includes(k)) ?? 'other';
}

export async function GET() {
  const memories = await db.memory.findMany({
    select: {
      hash: true, content: true, model: true, timestamp: true,
      parentHash: true, score: true, verified: true, zkVerified: true, poiTxHash: true,
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

  const links: { source: string; target: string; type: string; strength: number }[] = [];
  const hashSet = new Set(memories.map(m => m.hash));
  const linkedPairs = new Set<string>();

  const addLink = (src: string, tgt: string, type: string, strength: number) => {
    const key = [src, tgt].sort().join(':');
    if (linkedPairs.has(key)) return;
    linkedPairs.add(key);
    links.push({ source: src, target: tgt, type, strength });
  };

  // 1. Parent-child chain (strongest)
  for (const m of memories) {
    if (m.parentHash && hashSet.has(m.parentHash)) {
      addLink(m.parentHash, m.hash, 'chain', 1.0);
    }
  }

  // 2. Same model — connect all memories of same model in order (cluster effect)
  const byModel = new Map<string, typeof memories>();
  for (const m of memories) {
    const k = modelKey(m.model);
    if (!byModel.has(k)) byModel.set(k, []);
    byModel.get(k)!.push(m);
  }
  for (const group of byModel.values()) {
    for (let i = 0; i < group.length - 1; i++) {
      addLink(group[i].hash, group[i + 1].hash, 'model', 0.6);
    }
  }

  // 3. Temporal proximity (24h window, cross-model)
  const WINDOW = 86400;
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      if (memories[j].timestamp - memories[i].timestamp > WINDOW) break;
      if (modelKey(memories[i].model) !== modelKey(memories[j].model)) {
        addLink(memories[i].hash, memories[j].hash, 'temporal', 0.3);
      }
    }
  }

  // 4. Cross-model bridge: connect last of each model to first of next model chronologically
  const modelOrder = [...byModel.entries()].sort((a, b) =>
    (a[1][0]?.timestamp ?? 0) - (b[1][0]?.timestamp ?? 0)
  );
  for (let i = 0; i < modelOrder.length - 1; i++) {
    const lastA = modelOrder[i][1].at(-1);
    const firstB = modelOrder[i + 1][1][0];
    if (lastA && firstB) addLink(lastA.hash, firstB.hash, 'bridge', 0.4);
  }

  // 5. Fallback — ensure no isolated nodes
  for (let i = 0; i < memories.length - 1; i++) {
    addLink(memories[i].hash, memories[i + 1].hash, 'temporal', 0.2);
  }

  return NextResponse.json({ nodes, links });
}
