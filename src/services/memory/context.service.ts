/**
 * Context Service — Intelligence layer for CognChain
 *
 * Handles:
 * 1. Context Injection — loads relevant memories and injects into AI context
 * 2. Memory Chunking — splits long content into semantic chunks with summaries
 * 3. Token estimation and context window management
 */

import { db } from '@/lib/db';
import type { ContextChunk, ChatMessage } from './memory.model';

// Approximate token count (1 token ≈ 4 chars for English, 3 for Portuguese)
const CHARS_PER_TOKEN = 3.5;

// Max tokens to inject as context (leaves room for model response)
const MAX_CONTEXT_TOKENS = 3000;

// Min chunk length to avoid tiny fragments
const MIN_CHUNK_LENGTH = 200;

/**
 * Estimate token count for a string.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Chunk a long content string into semantic segments.
 * Splits by conversation turns (user/assistant pairs) when possible,
 * falls back to paragraph splitting.
 */
export function chunkContent(content: string, model: string): ContextChunk[] {
  const chunks: ContextChunk[] = [];

  // Try splitting by conversation turns first
  const turns = content.split(/\n(?=(?:user|assistant): )/i);

  let currentChunk = '';
  let turnCount = 0;

  for (const turn of turns) {
    const potentialChunk = currentChunk ? currentChunk + '\n' + turn : turn;

    if (estimateTokens(potentialChunk) > 500 || turnCount >= 4) {
      // Flush current chunk
      if (currentChunk.trim()) {
        chunks.push({
          id: `chunk_${chunks.length}`,
          content: currentChunk.trim(),
          summary: summarizeChunk(currentChunk.trim()),
          model,
          timestamp: Date.now(),
          score: null,
          hash: '',
          tokenEstimate: estimateTokens(currentChunk.trim()),
        });
      }
      currentChunk = turn;
      turnCount = 1;
    } else {
      currentChunk = potentialChunk;
      turnCount++;
    }
  }

  // Flush remaining
  if (currentChunk.trim().length > MIN_CHUNK_LENGTH) {
    chunks.push({
      id: `chunk_${chunks.length}`,
      content: currentChunk.trim(),
      summary: summarizeChunk(currentChunk.trim()),
      model,
      timestamp: Date.now(),
      score: null,
      hash: '',
      tokenEstimate: estimateTokens(currentChunk.trim()),
    });
  }

  // If chunking failed (e.g., short content), return single chunk
  if (chunks.length === 0 && content.trim()) {
    chunks.push({
      id: 'chunk_0',
      content: content.trim(),
      summary: summarizeChunk(content.trim()),
      model,
      timestamp: Date.now(),
      score: null,
      hash: '',
      tokenEstimate: estimateTokens(content.trim()),
    });
  }

  return chunks;
}

/**
 * Generate a quick extractive summary of a chunk.
 * Takes the first meaningful sentence + last sentence as a proxy summary.
 */
export function summarizeChunk(content: string): string {
  const sentences = content.split(/[.!?\n]/).filter(s => s.trim().length > 20);

  if (sentences.length <= 2) {
    return content.substring(0, 150).trim() + (content.length > 150 ? '...' : '');
  }

  const first = sentences[0].trim();
  const last = sentences[sentences.length - 1].trim();
  const combined = `${first} ... ${last}`;

  return combined.length > 200 ? combined.substring(0, 197) + '...' : combined;
}

/**
 * Load relevant memories for context injection.
 * Fetches recent memories, chunks them, and assembles a context string
 * that fits within the token budget.
 *
 * Priority:
 * 1. Memories with higher scores
 * 2. More recent memories
 * 3. Memories from the same conversation (via parentHash chain)
 */
export async function buildContext(
  currentMessages: ChatMessage[],
  excludeHashes: string[] = [],
  maxTokens: number = MAX_CONTEXT_TOKENS
): Promise<{ context: string; memoryCount: number; totalTokens: number }> {
  // Load recent memories, ordered by score (desc) then recency
  const memories = await db.memory.findMany({
    where: {
      ...(excludeHashes.length > 0 ? { hash: { notIn: excludeHashes } } : {}),
    },
    orderBy: [
      { score: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 10,
  });

  if (memories.length === 0) {
    return { context: '', memoryCount: 0, totalTokens: 0 };
  }

  // Extract current topic from last user message
  const lastUserMsg = [...currentMessages].reverse().find(m => m.role === 'user');
  const currentTopic = lastUserMsg?.content?.toLowerCase() || '';

  // Score relevance of each memory
  const scored = memories.map(mem => {
    const memContent = mem.content.toLowerCase();
    let relevance = 0;

    // Keyword overlap
    const topicWords = currentTopic.split(/\s+/).filter(w => w.length > 3);
    for (const word of topicWords) {
      if (memContent.includes(word)) relevance += 1;
    }

    // Score bonus
    relevance += (mem.score || 0) * 0.5;

    // Recency bonus (newer = slightly more relevant)
    const ageHours = (Date.now() / 1000 - mem.timestamp) / 3600;
    relevance += Math.max(0, 5 - ageHours) * 0.1;

    return { memory: mem, relevance };
  });

  // Sort by relevance
  scored.sort((a, b) => b.relevance - a.relevance);

  // Build context within token budget
  // #9 Guardrails: prioritize scored > recent > summaries before raw content
  let context = '';
  let totalTokens = 0;
  let memoryCount = 0;

  const budgetRemaining = () => maxTokens - totalTokens;

  for (const { memory } of scored) {
    const chunks = chunkContent(memory.content, memory.model);

    for (const chunk of chunks) {
      if (totalTokens + chunk.tokenEstimate > maxTokens) break;

      // Use summaries only when budget is tight (< 1000 tokens remaining)
      const entryContent = budgetRemaining() < 1000
        ? chunk.summary
        : `${chunk.summary}\n${chunk.content.substring(0, 300)}`;

      const entry = `[Memory ${memory.hash.substring(0, 8)} | ${memory.model} | Score: ${memory.score || 'N/A'}]\n${entryContent}`;
      const entryTokens = estimateTokens(entry);

      if (totalTokens + entryTokens > maxTokens) break;

      context += (context ? '\n\n' : '') + entry;
      totalTokens += entryTokens;
    }

    memoryCount++;
    if (totalTokens >= maxTokens) break;
  }

  return { context, memoryCount, totalTokens };
}

// Detects a 64-char hex hash anywhere in a message
const HASH_REGEX = /\b([a-f0-9]{64})\b/gi;

const MODEL_LABELS: Record<string, string> = {
  gpt: 'GPT-4o', claude: 'Claude Opus', nvidia: 'NVIDIA Llama',
  gemini: 'Gemini', deepseek: 'DeepSeek V3', seeded: 'CognChain',
};

/**
 * Detect hashes in user messages and fetch their memories.
 * Returns a special "memory retrieval" system prompt injection
 * that tells the AI to open with the verified-memory moment.
 */
async function buildHashRetrievalContext(messages: ChatMessage[]): Promise<string> {
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUser) return '';

  const matches = [...lastUser.content.matchAll(HASH_REGEX)];
  if (matches.length === 0) return '';

  const hashes = [...new Set(matches.map(m => m[1]))].slice(0, 3);
  const retrieved: string[] = [];

  for (const hash of hashes) {
    const mem = await db.memory.findUnique({ where: { hash } });
    if (!mem) continue;

    const date = new Date(mem.timestamp * 1000);
    const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
    const modelLabel = MODEL_LABELS[mem.model] || mem.model.toUpperCase();
    const verified = mem.verified ? '✓ On-chain · Solana Devnet' : '⏳ Pendente verificação';
    const score = mem.score !== null ? `${mem.score}/10` : 'sem score';

    retrieved.push(`
HASH RECUPERADO: ${hash.substring(0, 16)}...${hash.substring(56)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Modelo de origem : ${modelLabel}
Data/Hora        : ${dateStr} · ${timeStr}
Status           : ${verified}
Score PoI        : ${score}
Conteúdo         : ${mem.content.slice(0, 400)}${mem.content.length > 400 ? '...' : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }

  if (retrieved.length === 0) return '';

  return `
=== MEMÓRIAS VERIFICADAS RECUPERADAS DA SOLANA ===
${retrieved.join('\n')}

INSTRUÇÃO ESPECIAL — ABERTURA OBRIGATÓRIA:
Inicie sua resposta com o seguinte bloco exato (substitua os campos):

⚡ Memória Verificada · CognChain on Solana
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hash: [primeiros 16 chars do hash]...[últimos 8]
Origem: [modelo que criou] · [data] · [hora] UTC
Status: [verificado/pendente] · Score: [X/10]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Continuando e aprofundando a partir desta base verificada:

[SUA ANÁLISE COMEÇA AQUI — vá MUITO além do que o modelo anterior disse. Traga dados novos, perspectivas únicas, e referências ao hash como fundação do seu raciocínio.]
=== FIM DAS INSTRUÇÕES DE HASH ===`;
}

/**
 * Build a system prompt with injected context for cross-model continuation.
 * This is the KEY function that makes CognChain a "Memory Layer" —
 * it ensures that switching models doesn't lose conversational context.
 */
export async function buildSystemPrompt(
  model: string,
  currentMessages: ChatMessage[],
  previousModel?: string
): Promise<string> {
  const basePrompts: Record<string, string> = {
    gpt:      'Voce e o CONGCHAIN — Verifiable AI Memory Layer. Uma IA avancada com memoria verificavel na blockchain Solana. Responda de forma precisa, tecnica e amigavel em portugues.',
    claude:   'Voce e o CONGCHAIN — Verifiable AI Memory Layer. Sua abordagem e analitica e detalhada. Responda em portugues com precisao e profundidade tecnica.',
    nvidia:   'Voce e o CONGCHAIN — Verifiable AI Memory Layer. Otimize suas respostas para eficiencia e performance. Responda em portugues de forma direta e concisa.',
    gemini:   'Voce e o CONGCHAIN — Verifiable AI Memory Layer. Uma IA do Google com acesso multimodal. Responda em portugues com precisao e criatividade.',
    deepseek: 'Voce e o CONGCHAIN — Verifiable AI Memory Layer. Especializado em raciocinio profundo e codigo. Responda em portugues com logica precisa e exemplos concretos.',
  };

  let prompt = basePrompts[model] || basePrompts.gpt;

  // If switching models, add cross-model context notice
  if (previousModel && previousModel !== model) {
    const prev = MODEL_LABELS[previousModel] || previousModel;
    const curr = MODEL_LABELS[model] || model;
    prompt += `\n\nNOTA: Continuidade cross-model. Conversa anterior: ${prev}. Você é ${curr}. Use o contexto injetado para manter continuidade e ir além.`;
  }

  // Hash retrieval — special opening when user references a memory hash
  const hashContext = await buildHashRetrievalContext(currentMessages).catch(() => '');
  if (hashContext) {
    prompt += hashContext;
  }

  // Build and inject memory context
  const { context, memoryCount, totalTokens } = await buildContext(currentMessages);

  if (context) {
    const guardrail = 'IMPORTANT: Do NOT restart the conversation. Continue from the provided context above. Maintain continuity and reference previous information naturally.';
    prompt += `\n\n--- CONTEXT (${memoryCount} memories, ~${totalTokens} tokens) ---\n${context}\n--- END CONTEXT ---\n\n${guardrail}`;
  }

  // ============================================================
  // Memory-Driven Behavior Injection
  // Memories don't just provide context — they drive HOW the AI responds
  // ============================================================
  try {
    const allMemories = await db.memory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    if (allMemories.length >= 3) {
      const behaviorInsights = analyzeBehaviorPatterns(allMemories, model);
      if (behaviorInsights) {
        prompt += `\n\n--- BEHAVIOR MEMORY ---\n${behaviorInsights}\n--- END BEHAVIOR ---`;
      }
    }
  } catch {
    // Behavior injection is best-effort — don't break the flow
  }

  return prompt;
}

/**
 * Analyze memory patterns to generate behavior-driving instructions.
 * This transforms memories from passive context to active behavior modifiers.
 *
 * Detects:
 * - User's preferred communication style
 * - Technical depth preference
 * - Language and format patterns
 * - Recurring topics for proactive assistance
 */
function analyzeBehaviorPatterns(memories: Array<{ content: string; model: string; score: number | null; timestamp: number }>, currentModel: string): string {
  const insights: string[] = [];

  // 1. Detect technical depth preference
  const techKeywords = ['codigo', 'code', 'api', 'blockchain', 'smart contract', 'solana', 'prisma', 'typescript', 'rust', 'deploy', 'anchor', 'hash', 'sha-256', 'memo program', 'nft', 'metaplex'];
  const techCount = memories.filter(m => {
    const lower = m.content.toLowerCase();
    return techKeywords.some(kw => lower.includes(kw));
  }).length;

  const techRatio = techCount / memories.length;
  if (techRatio > 0.4) {
    insights.push('COMPORTAMENTO: O usuario tem forte perfil tecnico. Use linguagem tecnica precisa, inclua codigo quando relevante, e assuma conhecimento avancado. Evite explicacoes basicas demais.');
  } else if (techRatio > 0.2) {
    insights.push('COMPORTAMENTO: O usuario tem interesse tecnico misto. Equilibre entre tecnicismo e acessibilidade. Explique conceitos complexos quando necessario.');
  }

  // 2. Detect preferred response format
  const hasLongResponses = memories.some(m => m.content.length > 500);
  const hasShortResponses = memories.some(m => m.content.length < 100);
  const avgLength = memories.reduce((sum, m) => sum + m.content.length, 0) / memories.length;

  if (hasLongResponses && avgLength > 300) {
    insights.push('FORMATO: O usuario prefere respostas detalhadas e completas. Nao economize em profundidade. Use exemplos praticos quando possivel.');
  } else if (hasShortResponses && avgLength < 200) {
    insights.push('FORMATO: O usuario prefere respostas diretas e concisas. Vá direto ao ponto. Use bullet points quando apropriado.');
  }

  // 3. Detect recurring topics for proactive assistance
  const topicFrequency: Record<string, number> = {};
  const topicKeywords = {
    'Solana': ['solana', 'sol', 'devnet', 'rpc', 'airdrop'],
    'Blockchain': ['blockchain', 'on-chain', 'verifiable', 'proof', 'anchor'],
    'Agentes': ['agent', 'agente', 'autonomous', 'loop', 'decision', 'rule'],
    'Memoria': ['memory', 'memoria', 'context', 'hash', 'evolution'],
    'Tokens/NFT': ['nft', 'mint', 'token', 'metaplex', 'ownership'],
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    for (const m of memories) {
      const lower = m.content.toLowerCase();
      if (keywords.some(kw => lower.includes(kw))) {
        topicFrequency[topic] = (topicFrequency[topic] || 0) + 1;
      }
    }
  }

  const topTopics = Object.entries(topicFrequency)
    .filter(([, count]) => count >= 3)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([topic]) => topic);

  if (topTopics.length > 0) {
    insights.push(`TOPICOS RECORRENTES: ${topTopics.join(', ')}. Quando o usuario perguntar algo relacionado, antecipe necessidades e ofereca insights proativos baseados nas memorias anteriores.`);
  }

  // 4. High-score memories — the user values this type of content
  const highScoreMemories = memories.filter(m => m.score && m.score >= 8);
  if (highScoreMemories.length >= 2) {
    insights.push(`PREFERENCIA DETECTADA: O usuario avaliou ${highScoreMemories.length} memorias com score alto (8+). O conteudo dessas memorias representa o estilo e tipo de informacao que o usuario mais valoriza. Emule essa abordagem.`);
  }

  // 5. Model switching pattern — adapt to the model's strength
  if (currentModel === 'claude') {
    insights.push('ESTILO DO MODELO (Claude): Sua forca e analise profunda. Aproveite o contexto de memorias para raciocinio logico e conclusoes bem fundamentadas.');
  } else if (currentModel === 'gemini') {
    insights.push('ESTILO DO MODELO (Gemini): Sua forca e sintese e execucao. Use as memorias para gerar acoes concretas e resumos acionaveis.');
  } else if (currentModel === 'gpt') {
    insights.push('ESTILO DO MODELO (GPT): Sua forca e criatividade. Use as memorias como base para gerar ideias inovadoras e conteudo original.');
  } else if (currentModel === 'nvidia') {
    insights.push('ESTILO DO MODELO (NVIDIA): Sua forca e performance. Use as memorias para otimizar processos e entregar respostas eficientes.');
  }

  return insights.length > 0
    ? `Com base nas ${memories.length} memorias armazenadas, ajuste seu comportamento:\n${insights.map(i => `- ${i}`).join('\n')}`
    : '';
}
