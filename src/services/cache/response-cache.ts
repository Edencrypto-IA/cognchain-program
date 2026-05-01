/**
 * Response Cache — serve repeated questions from DB, zero API cost.
 *
 * Flow:
 *   1. Normalize question → SHA-256 hash (exact match)
 *   2. If miss → fuzzy hash of first 6 significant words (loose match)
 *   3. If miss → call AI → store in cache → return
 *
 * Not cached: personal questions ("meu", "minha", "I", "my"),
 *             very short inputs, or when memory context is injected.
 */

import { db } from '@/lib/db';
import { createHash } from 'crypto';
import { estimateTokens } from '@/services/ai';

// ── Helpers ───────────────────────────────────────────────────

const STOP_WORDS = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'no', 'na', 'em', 'e', 'é', 'que', 'the', 'a', 'an', 'is', 'of', 'in', 'it', 'to', 'and', 'what', 'how', 'why', 'can', 'i', 'eu', 'my', 'meu', 'minha', 'você', 'me']);

function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .trim()
    .replace(/[?!.,;:'"()\[\]{}]/g, '')
    .replace(/\s+/g, ' ');
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function exactHash(question: string): string {
  return sha256(normalizeQuestion(question));
}

function fuzzyHash(question: string): string {
  const words = normalizeQuestion(question)
    .split(' ')
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 6);
  return sha256(words.join(' '));
}

/** Returns true if this question should NOT be cached (personal, context-heavy). */
function shouldSkipCache(question: string): boolean {
  const q = question.toLowerCase();
  // Personal pronouns or references to "me/my/their session"
  if (/\b(meu|minha|meus|minhas|meu |my |our |our|i |eu |nossa|nosso|me |nos )\b/i.test(q)) return true;
  // Very short
  if (question.trim().length < 12) return true;
  // Contains code or very dynamic content
  if (/```|function |SELECT |INSERT |UPDATE /i.test(question)) return true;
  return false;
}

// ── Cache TTL: 30 days for generated, null for seeded ────────
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

// ── Public API ────────────────────────────────────────────────

export interface CacheHit {
  answer: string;
  fromCache: true;
  hits: number;
  tokensSaved: number;
}

export async function getCachedResponse(question: string): Promise<CacheHit | null> {
  if (shouldSkipCache(question)) return null;

  // 1. Exact match
  const exact = await db.responseCache.findUnique({
    where: { questionHash: exactHash(question) },
  });
  if (exact) {
    // Check expiry (seeded entries never expire)
    if (!exact.seeded && exact.expiresAt && exact.expiresAt < new Date()) {
      await db.responseCache.delete({ where: { id: exact.id } });
      return null;
    }
    await db.responseCache.update({
      where: { id: exact.id },
      data: { hits: { increment: 1 }, tokensSaved: { increment: estimateTokens(exact.answer) } },
    });
    return { answer: exact.answer, fromCache: true, hits: exact.hits + 1, tokensSaved: exact.tokensSaved + estimateTokens(exact.answer) };
  }

  // 2. Fuzzy match
  const fh = fuzzyHash(question);
  const fuzzy = await db.responseCache.findFirst({
    where: { fuzzyHash: fh },
    orderBy: { hits: 'desc' },
  });
  if (fuzzy) {
    if (!fuzzy.seeded && fuzzy.expiresAt && fuzzy.expiresAt < new Date()) return null;
    await db.responseCache.update({
      where: { id: fuzzy.id },
      data: { hits: { increment: 1 }, tokensSaved: { increment: estimateTokens(fuzzy.answer) } },
    });
    return { answer: fuzzy.answer, fromCache: true, hits: fuzzy.hits + 1, tokensSaved: fuzzy.tokensSaved + estimateTokens(fuzzy.answer) };
  }

  return null;
}

export async function cacheResponse(
  question: string,
  answer: string,
  model: string,
  permanent = false,
): Promise<void> {
  if (shouldSkipCache(question)) return;

  const qHash = exactHash(question);
  const fHash = fuzzyHash(question);
  const expiresAt = permanent ? null : new Date(Date.now() + TTL_MS);

  await db.responseCache.upsert({
    where: { questionHash: qHash },
    create: {
      questionHash: qHash,
      fuzzyHash: fHash,
      question: question.slice(0, 500),
      answer,
      model,
      expiresAt,
      seeded: false,
    },
    update: {
      answer,
      model,
      fuzzyHash: fHash,
      expiresAt: permanent ? null : expiresAt,
    },
  });
}

export async function getCacheStats() {
  const [total, seeded, topHits] = await Promise.all([
    db.responseCache.aggregate({ _sum: { hits: 1, tokensSaved: 1 }, _count: true }),
    db.responseCache.count({ where: { seeded: true } }),
    db.responseCache.findMany({ orderBy: { hits: 'desc' }, take: 5, select: { question: true, hits: true, tokensSaved: true, model: true } }),
  ]);
  return {
    totalEntries:  total._count,
    seededEntries: seeded,
    totalHits:     total._sum.hits     ?? 0,
    totalTokensSaved: total._sum.tokensSaved ?? 0,
    estimatedSavingsUSD: ((total._sum.tokensSaved ?? 0) * 0.0000027).toFixed(4),
    topQuestions:  topHits,
  };
}

// ── FAQ Seeder — run once at startup ─────────────────────────

const FAQ: Array<{ q: string; a: string }> = [
  // PT
  { q: 'o que é cognchain', a: 'CognChain é a camada de memória verificável para sistemas de IA, construída na Solana. Em vez de perder contexto quando uma sessão termina, os outputs de alto valor são ancorados on-chain como registros imutáveis. O usuário é dono do vault de memória, e qualquer agente pode acessar com permissão.' },
  { q: 'o que é congchain', a: 'CognChain é a camada de memória verificável para sistemas de IA, construída na Solana. Em vez de perder contexto quando uma sessão termina, os outputs de alto valor são ancorados on-chain como registros imutáveis. O usuário é dono do vault de memória, e qualquer agente pode acessar com permissão.' },
  { q: 'como funciona', a: 'O CognChain funciona em 4 etapas: (1) O agente de IA gera um output valioso. (2) O sistema extrai, classifica e faz o hash do conteúdo off-chain. (3) O hash, pontuação e metadados são ancorados na Solana como um SolanaMemoryRecord. (4) Qualquer agente autorizado pode buscar essas memórias em sessões futuras, construindo conhecimento acumulado ao longo do tempo.' },
  { q: 'como funciona o cognchain', a: 'O CognChain funciona em 4 etapas: (1) O agente de IA gera um output valioso. (2) O sistema extrai, classifica e faz o hash do conteúdo off-chain. (3) O hash, pontuação e metadados são ancorados na Solana como um SolanaMemoryRecord. (4) Qualquer agente autorizado pode buscar essas memórias em sessões futuras, construindo conhecimento acumulado ao longo do tempo.' },
  { q: 'o que é proof of insight', a: 'O Proof of Insight (PoI) é o mecanismo de validação humana do CognChain. Quando uma memória recebe 3 votos com média ≥ 7/10, ela é automaticamente ancorada na blockchain Solana. Isso garante que apenas insights de qualidade real se tornam memórias verificáveis permanentes.' },
  { q: 'o que é poi', a: 'O Proof of Insight (PoI) é o mecanismo de validação humana do CognChain. Quando uma memória recebe 3 votos com média ≥ 7/10, ela é automaticamente ancorada na blockchain Solana.' },
  { q: 'qual a diferença do cognchain para outros projetos', a: 'Diferente de soluções como Mem0 (centralizado, sem ownership) ou Arweave (armazenamento puro, sem qualidade ou permissões), o CognChain combina: ownership via carteira Solana, sistema de qualidade (PoI), privacidade ZK (Groth16), agentes autônomos com loop de aprendizado, e economia agente-a-agente. É a única solução que trata a memória de IA como um ativo portátil e verificável.' },
  { q: 'quanto custa usar', a: 'Cada registro de memória custa aproximadamente 0,0011 SOL como depósito único de rent-exempt (~$0,09). 100 registros custam ~0,11 SOL. Não há taxas recorrentes — o depósito é pago uma vez e a memória persiste indefinidamente na Solana.' },
  { q: 'o que é zk proof', a: 'ZK Proof (Zero-Knowledge Proof) no CognChain permite provar que uma memória é de qualidade e de autoria correta sem revelar o conteúdo. Usamos Groth16 (Circom + snarkjs). Ideal para domínios sensíveis como médico, jurídico e financeiro onde o conteúdo não pode ser exposto.' },
  { q: 'como conectar a carteira', a: 'Clique em "Conectar Carteira" na barra lateral. O CognChain suporta Phantom, Solflare e Coinbase Wallet via Solana Wallet Adapter padrão. Sua chave privada nunca sai da extensão — o app só lê a chave pública e o saldo.' },
  { q: 'o que é o loop autonomo', a: 'O Loop Autônomo é o ciclo de auto-aprendizado dos agentes CognChain. A cada ciclo: (1) busca as memórias com maior PoI score, (2) passa para o modelo de IA sintetizar um novo insight, (3) salva a síntese como nova memória, (4) ancora a prova do ciclo na Solana. O agente fica mais inteligente a cada iteração.' },
  { q: 'o que e o agente solana sage', a: 'O Solana Sage é um agente autônomo que monitora a carteira Solana em tempo real. Ele lê saldo, preços de tokens via CoinGecko e transações recentes. Quando identifica uma oportunidade, cria uma "intent" que precisa da sua aprovação antes de executar — segurança em 7 camadas garante que nada acontece sem sua confirmação.' },
  // EN
  { q: 'what is cognchain', a: 'CognChain is the verifiable memory layer for AI systems, built on Solana. Instead of losing context when a session ends, high-value AI outputs are anchored on-chain as immutable records. The user owns the memory vault, and any authorized agent can access it across sessions.' },
  { q: 'how does cognchain work', a: 'CognChain works in 4 steps: (1) An AI agent produces a valuable output. (2) The system extracts, scores, and hashes the content off-chain. (3) The hash, score, and metadata are anchored on Solana as a SolanaMemoryRecord. (4) Any authorized agent can retrieve these memories in future sessions, building cumulative verifiable knowledge.' },
  { q: 'what is proof of insight', a: 'Proof of Insight (PoI) is CognChain\'s human validation mechanism. When a memory receives 3 votes with an average ≥ 7/10, it is automatically anchored on the Solana blockchain. This ensures only genuinely high-quality insights become permanent verifiable memories.' },
  { q: 'how much does it cost', a: 'Each memory record costs approximately 0.0011 SOL as a one-time rent-exempt deposit (~$0.09). 100 records cost ~0.11 SOL. There are no recurring fees — the deposit is paid once and the memory persists indefinitely on Solana.' },
  { q: 'is it safe to connect my wallet', a: 'Yes. The Solana Wallet Adapter standard ensures your private key never leaves your browser extension. CognChain only reads your public key and balance. No transaction is ever executed without your explicit approval via the Intent Queue — all agent-proposed actions require you to click Approve.' },
  { q: 'what models are supported', a: 'CognChain supports 5 AI models: GPT-4o (OpenAI), Claude Opus 4.7 (Anthropic), NVIDIA Llama 3.3-70B (free), Gemini 2.0 Flash Lite (Google), and DeepSeek V3. You can switch models mid-conversation and all memories are cross-model portable.' },
];

let seeded = false;

export async function seedFAQCache(): Promise<void> {
  if (seeded) return;
  seeded = true;

  for (const { q, a } of FAQ) {
    const qHash = exactHash(q);
    const fHash = fuzzyHash(q);
    await db.responseCache.upsert({
      where: { questionHash: qHash },
      create: {
        questionHash: qHash,
        fuzzyHash: fHash,
        question: q,
        answer: a,
        model: 'seeded',
        seeded: true,
        expiresAt: null,
      },
      update: { answer: a, fuzzyHash: fHash, seeded: true, expiresAt: null },
    });
  }

  console.log(`[Cache] Seeded ${FAQ.length} FAQ entries.`);
}
