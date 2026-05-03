import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function buildHash(content: string, model: string, ts: number) {
  return sha256(`${sha256(content)}:${sha256(model)}:${ts}:${Math.random()}`);
}

const CHAIN = [
  {
    model: 'nvidia',
    content: 'CognChain resolve o problema central de memória em IA: cada sessão termina e os insights desaparecem. Arquitetura proposta: vault on-chain + hash commitment + ZK proof. Base sólida para construir reputação de agentes.',
  },
  {
    model: 'glm',
    content: 'Aprofundando a análise anterior: o modelo de vault por carteira é o diferencial competitivo. Nenhum protocolo atual combina portabilidade cross-model com âncora Solana. Oportunidade de mercado: $2.1B em AI memory management até 2027.',
  },
  {
    model: 'minimax',
    content: 'Avaliação de mercado baseada nos hashes anteriores: early adopters são devs de agentes autônomos. Estratégia de go-to-market: MCP Server como entry point técnico + marketplace agent-to-agent como network effect. Prioridade: hackathons Solana.',
  },
  {
    model: 'qwen',
    content: 'Recomendação estratégica final da cadeia: lançar SDK público + documentação em Q2 2026. Focar em 3 verticais: trading bots com memória verificável, research agents com histórico auditável, e copilots empresariais com compliance on-chain.',
  },
];

export async function POST() {
  const existing = await db.memory.count();
  if (existing >= 8) {
    return NextResponse.json({ message: 'Memórias demo já existem', skipped: true });
  }

  const now = Math.floor(Date.now() / 1000);
  let parentHash: string | null = null;
  const created = [];

  for (let i = 0; i < CHAIN.length; i++) {
    const { model, content } = CHAIN[i];
    const ts = now - (CHAIN.length - i) * 3600;
    const hash = buildHash(content, model, ts);

    await db.memory.create({
      data: {
        hash,
        content,
        model,
        timestamp: ts,
        parentHash,
        score: 7 + Math.random() * 2.5,
        verified: i === CHAIN.length - 1,
      },
    });

    created.push({ hash: hash.slice(0, 12), model });
    parentHash = hash;
  }

  return NextResponse.json({ created, total: created.length });
}
