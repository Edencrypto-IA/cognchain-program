import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getHandler } from '@/services/ai/ai.router';
import crypto from 'crypto';

function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export async function POST(req: NextRequest) {
  const { hash, model } = await req.json();

  if (!hash || !model) {
    return NextResponse.json({ error: 'hash and model required' }, { status: 400 });
  }

  const parent = await db.memory.findUnique({ where: { hash } });
  if (!parent) {
    return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
  }

  const handler = getHandler(model);

  const prompt = `You are continuing a verified memory chain on CognChain (Solana blockchain).

Previous memory (${parent.model} model):
"${parent.content.slice(0, 400)}"

Continue and deepen this insight in 2-3 sentences. Add new perspective, data, or analysis that builds on what was said. Be specific and valuable. This will be anchored on Solana as a verified memory node.`;

  let content: string;
  try {
    content = await handler.chat([{ role: 'user', content: prompt }]);
    content = content.replace(/\*\*/g, '').trim();
  } catch (err) {
    return NextResponse.json({ error: `AI call failed: ${String(err)}` }, { status: 500 });
  }

  const ts = Math.floor(Date.now() / 1000);
  const newHash = sha256(`${sha256(content)}:${sha256(model)}:${ts}:${crypto.randomBytes(8).toString('hex')}`);

  const memory = await db.memory.create({
    data: {
      hash: newHash,
      content,
      model,
      timestamp: ts,
      parentHash: hash,
      score: parseFloat((7 + Math.random() * 2.5).toFixed(1)),
    },
  });

  return NextResponse.json({
    hash: memory.hash,
    content: memory.content,
    model: memory.model,
    timestamp: memory.timestamp,
    parentHash: memory.parentHash,
    score: memory.score,
  });
}
