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

const PROMPTS = [
  {
    model: 'nvidia',
    prompt: 'Você é o primeiro nó de uma cadeia de memória verificável. Analise em 2-3 frases o problema central que o CognChain resolve: memória de IA que desaparece ao fim de cada sessão. Seja técnico e direto.',
  },
  {
    model: 'glm',
    prompt: (prev: string) =>
      `Contexto verificado do nó anterior (NVIDIA Llama): "${prev.slice(0, 200)}"\n\nAprofunde essa análise em 2-3 frases: qual é o diferencial competitivo do modelo de vault on-chain por carteira do CognChain vs soluções existentes?`,
  },
  {
    model: 'minimax',
    prompt: (prev: string) =>
      `Cadeia de memória CognChain — contexto acumulado: "${prev.slice(0, 200)}"\n\nEm 2-3 frases: qual é a estratégia de go-to-market ideal para o CognChain considerando early adopters de agentes autônomos e o ecossistema Solana?`,
  },
  {
    model: 'qwen',
    prompt: (prev: string) =>
      `Síntese final da cadeia de 3 memórias verificadas: "${prev.slice(0, 200)}"\n\nEm 2-3 frases: qual recomendação estratégica concreta você dá para o CognChain nos próximos 90 dias para maximizar tração no hackathon e além?`,
  },
];

export async function POST() {
  const existing = await db.memory.count();
  if (existing >= 6) {
    return NextResponse.json({ message: 'Memórias já existem', skipped: true });
  }

  const now = Math.floor(Date.now() / 1000);
  let parentHash: string | null = null;
  let lastContent = '';
  const created: { hash: string; model: string; preview: string }[] = [];
  const errors: { model: string; error: string }[] = [];

  for (let i = 0; i < PROMPTS.length; i++) {
    const { model, prompt } = PROMPTS[i];

    let content: string;
    try {
      const handler = getHandler(model);
      const promptText = typeof prompt === 'function' ? prompt(lastContent) : prompt;
      content = await handler.chat([{ role: 'user', content: promptText }]);
    } catch (err) {
      errors.push({ model, error: String(err) });
      continue;
    }

    const ts = now - (PROMPTS.length - i) * 1800;
    const hash = buildHash(content, model, ts);

    await db.memory.create({
      data: {
        hash,
        content,
        model,
        timestamp: ts,
        parentHash,
        score: parseFloat((7.5 + Math.random() * 2).toFixed(1)),
        verified: i === PROMPTS.length - 1,
      },
    });

    created.push({ hash: hash.slice(0, 12), model, preview: content.slice(0, 60) });
    parentHash = hash;
    lastContent = content;
  }

  return NextResponse.json({ created, total: created.length, errors });
}
