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
    prompt: `You are the first node in a verifiable AI memory chain anchored on Solana blockchain.

Describe in 3 powerful sentences THE PROBLEM you solve:
- Every AI session ends and insights vanish forever into vendor silos
- No AI agent can prove what it learned, when, or from whom
- Brilliant cross-model research chains are lost — GPT-4o analyzes, Claude deepens, DeepSeek plans — but none of it persists verifiably

Be direct, technical, and impactful. This will be read by Solana hackathon judges.`,
  },
  {
    model: 'glm',
    prompt: (prev: string) => `You are the second node in a verifiable AI memory chain on Solana.

Previous memory (NVIDIA Llama — The Problem):
"${prev.slice(0, 300)}"

Now articulate THE SOLUTION in 3 sentences:
- CognChain crystallizes high-value AI outputs into compact, hash-committed memory records
- Each record is anchored permanently on Solana via Anchor program with ZK proof (Groth16)
- Users own their vault. Agents earn verifiable reputation. Memory becomes portable across any AI model.

Why Solana specifically: 400ms finality, $0.00025 per transaction, 65,000 TPS — the only chain fast and cheap enough for real-time AI memory anchoring at scale.`,
  },
  {
    model: 'minimax',
    prompt: (prev: string) => `You are the third node in a verifiable AI memory chain on Solana.

Chain context so far:
"${prev.slice(0, 300)}"

Now explain THE SOLANA ADVANTAGE over other blockchains for AI memory in 3 sentences:
- Ethereum L1: $15–50 per transaction, 12s finality — unusable for per-session AI memory
- Ethereum L2s: still centralized sequencers, no native ZK settlement, 2–7s latency
- Solana: sub-second finality, $0.00025/tx, Anchor framework with native ZK-ready accounts, Helius premium RPC — built for machine-speed transactions at AI scale

The AI memory economy requires thousands of micro-transactions per day. Only Solana makes this economically viable.`,
  },
  {
    model: 'qwen',
    prompt: (prev: string) => `You are the fourth and final node in a verifiable AI memory chain on Solana — the synthesis node.

Full chain context:
"${prev.slice(0, 400)}"

Now paint THE VISION in 3 sentences — what CognChain unlocks for the future:
- AI agents that inherit memories from previous sessions, building genuine long-term expertise verifiable by any third party
- A trustless agent economy where GPT-4o, Claude, DeepSeek, and Gemini collaborate on research chains — each contribution hashed, scored, and anchored — creating the first verifiable record of machine intelligence evolution
- The cognitive layer missing from Web3: not just DeFi and NFTs, but permanent, portable, provable AI cognition — owned by users, trusted by any agent, recorded forever on Solana

This is CognChain. The verifiable memory layer for AI. Built on Solana.`,
  },
];

export async function POST() {
  // Clear old demo memories and recreate
  await db.memory.deleteMany({
    where: {
      model: { in: ['nvidia', 'glm', 'minimax', 'qwen'] },
    },
  });

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
