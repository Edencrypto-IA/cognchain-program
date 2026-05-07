import { db } from '@/lib/db';
import { generateHash, nowTimestamp } from './hash.utils';
import type { MemoryEntry, MemoryCreateInput } from './memory.model';
import type { ZkMvpBundle } from '@/services/zk';

function parseJson<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function mapMemory(memory: any): MemoryEntry {
  return {
    hash: memory.hash,
    content: memory.content,
    model: memory.model,
    timestamp: memory.timestamp,
    parentHash: memory.parentHash,
    score: memory.score,
    verified: memory.verified,
    zkVerified: memory.zkVerified,
    zkMode: memory.zkMode,
    zkProofVersion: memory.zkProofVersion,
    zkHashAlgo: memory.zkHashAlgo,
    zkGeneratedAt: memory.zkGeneratedAt,
    zkProof: parseJson(memory.zkProof),
    zkPublicSignals: parseJson(memory.zkPublicSignals),
  };
}

/**
 * Save a new memory entry to the database.
 * Generates a deterministic SHA-256 hash from content + model.
 * Uses upsert to prevent race condition on duplicate hash.
 */
export async function saveMemory(input: MemoryCreateInput): Promise<MemoryEntry> {
  const timestamp = nowTimestamp();
  const hash = generateHash(input.content, input.model);

  // Upsert prevents race condition — if another request created it first, we return existing
  const memory = await db.memory.upsert({
    where: { hash },
    create: {
      hash,
      content: input.content,
      model: input.model,
      timestamp,
      parentHash: input.parentHash || null,
      clientId: input.clientId ?? null,
      score: input.score ?? null,
      verified: false,
    },
    update: {}, // Don't overwrite existing data
  });

  return mapMemory(memory);
}

/**
 * Load a memory entry by its hash.
 */
export async function loadMemory(hash: string): Promise<MemoryEntry | null> {
  const memory = await db.memory.findUnique({ where: { hash } });
  if (!memory) return null;

  return mapMemory(memory);
}

/**
 * Load the full evolution chain for a memory (parent -> current -> children).
 * Includes cycle detection to prevent infinite loops.
 */
export async function loadEvolutionChain(hash: string): Promise<MemoryEntry[]> {
  const chain: MemoryEntry[] = [];
  const visited = new Set<string>();

  // Walk up to root parent (with cycle detection + depth limit)
  let currentHash = hash;
  const ancestors: MemoryEntry[] = [];
  const MAX_DEPTH = 50;
  let depth = 0;
  while (currentHash && !visited.has(currentHash) && depth < MAX_DEPTH) {
    visited.add(currentHash);
    depth++;
    const mem = await db.memory.findUnique({ where: { hash: currentHash } });
    if (!mem) break;
    ancestors.unshift(mapMemory(mem));
    currentHash = mem.parentHash || '';
  }

  chain.push(...ancestors);

  // Walk down to children (BFS with visited set for cycle detection)
  const childQueue = [hash];
  while (childQueue.length > 0) {
    const parent = childQueue.shift();
    if (!parent) break;
    if (visited.has(`child:${parent}`)) continue; // Prevent cycles in children
    visited.add(`child:${parent}`);

    const children = await db.memory.findMany({
      where: { parentHash: parent },
    });
    for (const child of children) {
      if (child.hash === hash) continue;
      chain.push(mapMemory(child));
      childQueue.push(child.hash);
    }
  }

  return chain;
}

/**
 * Update the score for a memory entry.
 */
export async function scoreMemory(hash: string, score: number): Promise<MemoryEntry | null> {
  const safeScore = Math.max(0, Math.min(10, Number(score) || 0));
  const memory = await db.memory.findUnique({ where: { hash } });
  if (!memory) return null;

  const updated = await db.memory.update({
    where: { hash },
    data: { score: safeScore },
  });

  return mapMemory(updated);
}

/**
 * Mark a memory as verified (on-chain).
 */
export async function verifyMemory(hash: string): Promise<MemoryEntry | null> {
  const memory = await db.memory.findUnique({ where: { hash } });
  if (!memory) return null;

  const updated = await db.memory.update({
    where: { hash },
    data: { verified: true },
  });

  return mapMemory(updated);
}

/**
 * List all memories with optional pagination.
 */
export async function listMemories(limit = 50, offset = 0): Promise<MemoryEntry[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100); // Clamp 1-100
  const safeOffset = Math.max(offset, 0);

  const memories = await db.memory.findMany({
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
    skip: safeOffset,
  });

  return memories.map(mapMemory);
}

export async function saveMemoryZkBundle(hash: string, bundle: ZkMvpBundle): Promise<void> {
  await db.memory.update({
    where: { hash },
    data: {
      zkProof: JSON.stringify(bundle.proof),
      zkPublicSignals: JSON.stringify(bundle.publicSignals),
      zkVerified: true,
      zkMode: bundle.proof.mode,
      zkProofVersion: bundle.publicSignals.proofVersion,
      zkHashAlgo: bundle.publicSignals.hashAlgo,
      zkGeneratedAt: bundle.proof.generatedAt,
    },
  });
}

export async function loadMemoryZkBundle(hash: string): Promise<ZkMvpBundle | null> {
  try {
    const memory = await db.memory.findUnique({
      where: { hash },
      select: { zkProof: true, zkPublicSignals: true },
    });
    if (!memory?.zkProof || !memory?.zkPublicSignals) return null;

    const proof = parseJson<ZkMvpBundle['proof']>(memory.zkProof);
    const publicSignals = parseJson<ZkMvpBundle['publicSignals']>(memory.zkPublicSignals);
    if (!proof || !publicSignals) return null;

    return { proof, publicSignals };
  } catch {
    // Backward compatibility: DB or Prisma client might not include ZK columns yet.
    return null;
  }
}
