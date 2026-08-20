/**
 * Mythos active memory — server orchestration.
 *
 * Retrieval: score recent verified CognChain memories against the task command
 * and inject the best ones as context. Persistence: after a task, save a
 * compact summary as a new verified-chain memory (parentHash = reused memory).
 * Never breaks the loop if the DB is unavailable.
 */

import { listMemories, saveMemory } from '@/services/memory';
import {
  MYTHOS_MEMORY_POOL,
  MYTHOS_MEMORY_RETRIEVAL_LIMIT,
  scoreMemoriesForQuery,
  type ScoredMemory,
} from './agentic-memory-core';

export {
  buildMemoryContextBlock,
  buildTaskMemoryContent,
  scoreMemoriesForQuery,
  MYTHOS_MEMORY_RETRIEVAL_LIMIT,
} from './agentic-memory-core';
export type { MythosMemoryRef, ScoredMemory } from './agentic-memory-core';

/** Server-side retrieval: score recent memories and return the top matches. */
export async function retrieveMythosMemories(query: string, limit = MYTHOS_MEMORY_RETRIEVAL_LIMIT): Promise<ScoredMemory[]> {
  try {
    const memories = await listMemories(MYTHOS_MEMORY_POOL, 0);
    const refs = memories
      .filter(memory => typeof memory.content === 'string' && memory.content.trim().length > 0)
      .map(memory => ({ hash: memory.hash, content: memory.content }));
    return scoreMemoriesForQuery(query, refs).slice(0, limit);
  } catch {
    // DB unavailable (e.g. local dev without Postgres) — the loop must not break.
    return [];
  }
}

/** Persist a task memory; returns the hash or null when the DB is unavailable. */
export async function saveTaskMemory(content: string, parentHash?: string): Promise<string | null> {
  try {
    const memory = await saveMemory({
      content: content.slice(0, 100_000),
      model: 'deepseek',
      parentHash: parentHash || null,
    });
    return memory.hash;
  } catch {
    return null;
  }
}
