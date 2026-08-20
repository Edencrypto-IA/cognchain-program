/**
 * Forge repo context search — server-side orchestration over repomap.ts.
 *
 * Builds a cached keyword index of the safe repo and returns the most relevant
 * files for a prompt, plus a compact repo map. Used by /api/forge/context/search
 * and injected automatically into the agentic loop when no @file files were
 * selected.
 */

import { readFile } from 'node:fs/promises';
import { listForgeFiles, type ForgeFileEntry } from './explorer';
import { resolveForgePath } from './paths';
import {
  buildRepoIndex,
  buildRepoMapLine,
  scorePromptAgainstIndex,
  tokenize,
  type RepoIndex,
} from './repomap';
import type { ForgeContextFile } from './context';

export const REPO_CONTEXT_CACHE_TTL_MS = 5 * 60_000;
export const REPO_CONTEXT_MAX_FILES = 6;
export const REPO_CONTEXT_FILE_CHARS = 24_000;

interface CacheEntry {
  index: RepoIndex;
  expiresAt: number;
}

let cache: CacheEntry | null = null;

export function clearRepoContextCache(): void {
  cache = null;
}

async function getRepoIndex(): Promise<RepoIndex> {
  if (cache && cache.expiresAt > Date.now()) return cache.index;

  const entries: ForgeFileEntry[] = await listForgeFiles();
  const index = await buildRepoIndex(entries, path => {
    const target = resolveForgePath(path);
    if (!target) return null;
    return readFile(target.absolutePath, 'utf8').catch(() => null) as Promise<string | null>;
  });

  cache = { index, expiresAt: Date.now() + REPO_CONTEXT_CACHE_TTL_MS };
  return index;
}

export interface ForgeContextSearchResult {
  map: string;
  files: Array<ForgeContextFile & { score: number }>;
  indexedFiles: number;
  elapsedMs: number;
}

export async function searchForgeContext(
  prompt: string,
  maxFiles: number = REPO_CONTEXT_MAX_FILES,
): Promise<ForgeContextSearchResult> {
  const startedAt = Date.now();
  const index = await getRepoIndex();
  const tokens = tokenize(prompt);
  const top = scorePromptAgainstIndex(tokens, index, maxFiles);

  const files: Array<ForgeContextFile & { score: number }> = [];
  for (const item of top) {
    const target = resolveForgePath(item.path);
    if (!target) continue;
    const content = await readFile(target.absolutePath, 'utf8').catch(() => null);
    if (!content) continue;
    files.push({
      path: target.relativePath,
      content: content.slice(0, REPO_CONTEXT_FILE_CHARS),
      score: item.score,
    });
  }

  return {
    map: buildRepoMapLine(index),
    files,
    indexedFiles: index.files.length,
    elapsedMs: Date.now() - startedAt,
  };
}
