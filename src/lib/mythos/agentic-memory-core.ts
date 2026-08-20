/**
 * Mythos active memory core — pure scoring/formatting. Dependency-free (only
 * the Forge repo-map tokenizer), so it is unit-testable without a server.
 * Server orchestration (retrieve/save) lives in agentic-memory.ts.
 */

import { tokenize } from '../forge/repomap';

export interface MythosMemoryRef {
  hash: string;
  content: string;
}

export interface ScoredMemory extends MythosMemoryRef {
  score: number;
}

export const MYTHOS_MEMORY_RETRIEVAL_LIMIT = 4;
export const MYTHOS_MEMORY_POOL = 100;
export const MYTHOS_MEMORY_CONTENT_MAX = 600;

/** Pure scoring: how relevant is each memory to the query? */
export function scoreMemoriesForQuery(query: string, memories: MythosMemoryRef[]): ScoredMemory[] {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return memories.slice(0, MYTHOS_MEMORY_RETRIEVAL_LIMIT).map(m => ({ ...m, score: 0 }));

  return memories
    .map(memory => {
      const contentTokens = tokenize(memory.content);
      const contentLower = memory.content.toLowerCase();
      let score = 0;
      for (const token of queryTokens) {
        if (contentTokens.includes(token)) score += 2;
        if (contentLower.includes(token)) score += 1;
      }
      return { ...memory, score };
    })
    .filter(memory => memory.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MYTHOS_MEMORY_RETRIEVAL_LIMIT);
}

/** Format retrieved memories for injection into the agent system prompt. */
export function buildMemoryContextBlock(memories: ScoredMemory[]): string {
  if (!memories.length) return '';
  const lines = memories.map(memory => {
    const content = memory.content.slice(0, MYTHOS_MEMORY_CONTENT_MAX).replace(/\s+/g, ' ').trim();
    return `- [${memory.hash.slice(0, 12)}] ${content}`;
  });
  return `Memorias verificadas de tarefas anteriores relevantes:\n${lines.join('\n')}`;
}

export interface TaskMemoryInput {
  command: string;
  intent: string;
  summary: string;
  toolCalls: number;
  costUSD: number;
  reusedHashes: string[];
}

/** Build the compact memory content persisted after a task. */
export function buildTaskMemoryContent(input: TaskMemoryInput): string {
  return [
    `[MYTHOS_TASK] ${input.intent}`,
    `Comando: ${input.command.slice(0, 200)}`,
    `Resumo: ${input.summary.slice(0, 500)}`,
    `Ferramentas: ${input.toolCalls} · Custo estimado: US$ ${input.costUSD.toFixed(6)}`,
    input.reusedHashes.length ? `Reusou: ${input.reusedHashes.join(', ')}` : '',
  ].filter(Boolean).join('\n');
}
