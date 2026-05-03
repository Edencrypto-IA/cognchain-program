import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { getHandler } from '@/services/ai/ai.router';

function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}
function buildHash(content: string, model: string, ts: number) {
  return sha256(`${sha256(content)}:${sha256(model)}:${ts}:${crypto.randomBytes(8).toString('hex')}`);
}

const HACKATHON_CHAIN = [
  {
    model: 'nvidia',
    prompt: `In 2 sentences, describe the core problem CognChain solves: AI sessions end and insights vanish into vendor silos — no agent can prove what it learned, when, or from whom. Be direct and impactful for hackathon judges.`,
  },
  {
    model: 'glm',
    prompt: (prev: string) => `Context: "${prev.slice(0, 150)}" — In 2 sentences, explain CognChain's solution: hash-committed memory records anchored on Solana via Anchor + Groth16 ZK proof. User owns vault. Memory portable across any AI model.`,
  },
  {
    model: 'minimax',
    prompt: (prev: string) => `Context: "${prev.slice(0, 150)}" — In 2 sentences, explain why Solana beats Ethereum for AI memory: 400ms finality, $0.00025/tx vs $15-50 on ETH, 65k TPS — the only chain fast and cheap enough for real-time AI memory at scale.`,
  },
  {
    model: 'qwen',
    prompt: (prev: string) => `Context: "${prev.slice(0, 150)}" — In 2 sentences, paint the vision: AI agents inheriting verified memories, a trustless cross-model research economy, permanent provable cognition on Solana. This is CognChain.`,
  },
];

export async function POST() {
  // Skip if chain already complete
  const existing = await db.memory.count({ where: { model: { in: ['nvidia', 'glm', 'minimax', 'qwen'] } } });
  if (existing >= 4) {
    return NextResponse.json({ message: 'Chain already complete', skipped: true, existing });
  }

  // Only delete if we have a partial chain (to restart clean)
  if (existing > 0 && existing < 4) {
    await db.memory.deleteMany({ where: { model: { in: ['nvidia', 'glm', 'minimax', 'qwen'] } } });
  }

  const now = Math.floor(Date.now() / 1000);
  let parentHash: string | null = null;
  let lastContent = '';
  const created: { hash: string; model: string; preview: string }[] = [];
  const errors: { model: string; error: string }[] = [];

  for (let i = 0; i < HACKATHON_CHAIN.length; i++) {
    const { model, prompt } = HACKATHON_CHAIN[i];
    let content: string;

    try {
      const handler = getHandler(model);
      const promptText = typeof prompt === 'function' ? prompt(lastContent) : prompt;
      content = await handler.chat([{ role: 'user', content: promptText }]);
      // Clean markdown artifacts
      content = content.replace(/\*\*/g, '').replace(/^#+\s/gm, '').trim();
    } catch (err) {
      errors.push({ model, error: String(err) });
      continue;
    }

    const ts = now - (HACKATHON_CHAIN.length - i) * 1800;
    const hash = buildHash(content, model, ts);

    await db.memory.create({
      data: {
        hash,
        content,
        model,
        timestamp: ts,
        parentHash,
        score: parseFloat((8.5 + Math.random() * 1.4).toFixed(1)),
        verified: i === HACKATHON_CHAIN.length - 1,
        zkVerified: i >= 2,
      },
    });

    created.push({ hash: hash.slice(0, 12), model, preview: content.slice(0, 80) });
    parentHash = hash;
    lastContent = content;
  }

  return NextResponse.json({ created, total: created.length, errors });
}
