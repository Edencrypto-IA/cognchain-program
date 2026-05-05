/**
 * CognChain — Fact Decomposer
 * Breaks a natural-language query into individual verifiable facts using AI.
 */

export interface RouterConfig {
  provider: 'gpt' | 'claude' | 'nvidia' | 'gemini' | 'deepseek' | 'glm' | 'minimax' | 'qwen';
  model?: string;
}

const DECOMPOSE_PROMPT = `Você é o Decomposer do CognChain. Decomponha a pergunta do usuário em FATOS VERIFICÁVEIS INDIVIDUAIS. Cada fato deve ser uma afirmação testável com entidade + atributo mensurável + valor esperado.

Regras:
- "Top X" / "maiores" → fatos de ranking (posição + métrica)
- "vs" / "compare" → fatos comparativos (A > B, A < B, A = B)
- "como fazer" / "tutorial" → fatos de processo (passo N requer X)
- "quando" / "histórico" → fatos temporais (em DATA, EVENTO ocorreu)
- "quanto custa" / "preço" → fatos numéricos (ENTIDADE custa VALOR)

Responda APENAS em JSON válido:
{"facts": ["fato 1", "fato 2", "fato 3"]}`;

type JsonWithFacts = { facts: unknown[] };

function isJsonWithFacts(obj: unknown): obj is JsonWithFacts {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return Array.isArray(o.facts);
}

function parseFactsFromText(text: string): string[] {
  // Attempt 1: direct JSON parse
  try {
    const parsed: unknown = JSON.parse(text.trim());
    if (isJsonWithFacts(parsed)) {
      return parsed.facts.filter((f): f is string => typeof f === 'string');
    }
  } catch { /* continue */ }

  // Attempt 2: extract with regex
  const match = text.match(/"facts"\s*:\s*\[([\s\S]*?)\]/);
  if (match?.[1]) {
    try {
      const inner: unknown = JSON.parse(`[${match[1]}]`);
      if (Array.isArray(inner)) {
        return inner.filter((f): f is string => typeof f === 'string');
      }
    } catch { /* continue */ }
  }

  return [];
}

function isMeasurableFact(fact: string): boolean {
  const words = fact.trim().split(/\s+/);
  if (words.length < 5) return false;
  // Must contain at least one measurable keyword or proper noun
  const measurable = /\d|preço|price|valor|market|cap|tvl|volume|rank|maior|menor|mais|menos|top|%|\$|sol|btc|eth|token/i;
  return measurable.test(fact);
}

/**
 * Decompose a query into individual verifiable facts using the configured AI.
 * Falls back to [query] if decomposition fails.
 */
export async function decomposeQuery(
  query: string,
  modelConfig: RouterConfig,
): Promise<string[]> {
  try {
    const { getHandler } = await import('@/services/ai/ai.router');
    const handler = getHandler(modelConfig.provider);

    const raw = await handler.chat(
      [{ role: 'user', content: query }],
      DECOMPOSE_PROMPT,
    );

    const parsed = parseFactsFromText(raw);

    const valid = parsed
      .filter(isMeasurableFact)
      .slice(0, 8); // max 8 facts

    return valid.length > 0 ? valid : [query];
  } catch (err) {
    console.warn('[Decomposer] failed:', err);
    return [query];
  }
}

/*
Usage example:

import { decomposeQuery } from '@/lib/grounding/decomposer';

const facts = await decomposeQuery(
  'Quais são os top 3 tokens do ecossistema Solana por market cap?',
  { provider: 'nvidia' }
);
// → [
//     'Solana (SOL) é o token nativo da blockchain Solana com maior market cap',
//     'Raydium (RAY) é o token DEX com maior volume na Solana',
//     'BONK é o meme token com maior market cap na Solana'
//   ]
*/
