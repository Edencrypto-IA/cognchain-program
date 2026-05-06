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

  const WELCOME_PATTERNS = [
    /^(assistant:\s*)?(olá|ola)[\s!].*sou o (congchain|cognchain)/i,
    /^(assistant:\s*)?novo inicio/i,
    /^assistant:\s*novo/i,
  ];

  const nodes = memories
    .filter(m => !WELCOME_PATTERNS.some(p => p.test(m.content.trim())))
    .map((m) => ({
    id: m.hash,
    label: m.content
      .replace(/^(assistant:|user:|Q:|A:)\s*/i, '')
      .replace(/^#+\s*/, '')
      .replace(/\*\*/g, '')
      .replace(/\n/g, ' ')
      .trim()
      .slice(0, 60),
    model: m.model,
    timestamp: m.timestamp,
    score: m.score ?? 0,
    verified: m.verified,
    zkVerified: m.zkVerified,
    onChain: !!m.poiTxHash,
    hash: m.hash,
  }));

  const links: { source: string; target: string; type: string; strength: number }[] = [];
  const hashSet = new Set(nodes.map(n => n.hash));
  const linkedPairs = new Set<string>();

  const addLink = (src: string, tgt: string, type: string, strength: number) => {
    const key = [src, tgt].sort().join(':');
    if (linkedPairs.has(key)) return;
    linkedPairs.add(key);
    links.push({ source: src, target: tgt, type, strength });
  };

  // Use only filtered node hashes for link building
  const filteredMems = memories.filter(m => hashSet.has(m.hash));

  // 1. Parent-child chain (strongest)
  for (const m of filteredMems) {
    if (m.parentHash && hashSet.has(m.parentHash)) {
      addLink(m.parentHash, m.hash, 'chain', 1.0);
    }
  }

  // 2. Same model — connect all memories of same model in order (cluster effect)
  const byModel = new Map<string, typeof filteredMems>();
  for (const m of filteredMems) {
    const k = modelKey(m.model);
    if (!byModel.has(k)) byModel.set(k, []);
    byModel.get(k)!.push(m);
  }
  for (const group of byModel.values()) {
    for (let i = 0; i < group.length - 1; i++) {
      addLink(group[i].hash, group[i + 1].hash, 'model', 0.6);
    }
  }

  // 3. Temporal proximity — max 2 cross-model links per node (prevents O(n²) link explosion)
  const WINDOW = 86400;
  const temporalLinksPerNode = new Map<string, number>();
  for (let i = 0; i < filteredMems.length; i++) {
    let added = 0;
    for (let j = i + 1; j < filteredMems.length && added < 2; j++) {
      if (filteredMems[j].timestamp - filteredMems[i].timestamp > WINDOW) break;
      if (modelKey(filteredMems[i].model) !== modelKey(filteredMems[j].model)) {
        const jCount = temporalLinksPerNode.get(filteredMems[j].hash) ?? 0;
        if (jCount < 2) {
          addLink(filteredMems[i].hash, filteredMems[j].hash, 'temporal', 0.3);
          temporalLinksPerNode.set(filteredMems[i].hash, (temporalLinksPerNode.get(filteredMems[i].hash) ?? 0) + 1);
          temporalLinksPerNode.set(filteredMems[j].hash, jCount + 1);
          added++;
        }
      }
    }
  }

  // 4. Cross-model bridge: connect last of each model to first of next model
  const modelOrder = [...byModel.entries()].sort((a, b) =>
    (a[1][0]?.timestamp ?? 0) - (b[1][0]?.timestamp ?? 0)
  );
  for (let i = 0; i < modelOrder.length - 1; i++) {
    const lastA = modelOrder[i][1].at(-1);
    const firstB = modelOrder[i + 1][1][0];
    if (lastA && firstB) addLink(lastA.hash, firstB.hash, 'bridge', 0.4);
  }

  // 5. Fallback — connect isolated nodes only (sequential, not all pairs)
  for (let i = 0; i < filteredMems.length - 1; i++) {
    const degree = links.filter(l => l.source === filteredMems[i].hash || l.target === filteredMems[i].hash).length;
    if (degree === 0) addLink(filteredMems[i].hash, filteredMems[i + 1].hash, 'temporal', 0.2);
  }

  return NextResponse.json({ nodes, links });
}
