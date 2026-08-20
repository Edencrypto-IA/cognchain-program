/**
 * Forge explorer — shared repository listing used by /api/forge/files and the
 * repo-context engine. Only exposes safe product/code surfaces, never internal
 * API or deployment routes.
 */

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { FORGE_EXPLORER_ROOTS, FORGE_FILE_EXTENSIONS, inferLanguage } from './paths';

const MAX_FILES = 500;

export interface ForgeFileEntry {
  path: string;
  name: string;
  language: string;
  size: number;
}

function isAllowedForgePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const basename = path.basename(normalized).toLowerCase();
  const lowered = normalized.toLowerCase();

  if (lowered.startsWith('node_modules/')) return false;
  if (basename === '.env' || basename.startsWith('.env.')) return false;
  if (basename.endsWith('.lock') || basename.endsWith('.log')) return false;
  if (lowered.startsWith('src/app/api/')) return false;
  if (lowered.startsWith('src/app/agents/')) return false;
  if (basename.includes('route.ts')) return false;
  if (/(^|\/)(loop|rules|deploy)(\/|\.|-|_)/i.test(normalized)) return false;
  if (/(^|\/)[^/]*(loop|rules|deploy)[^/]*$/i.test(normalized)) return false;

  return FORGE_EXPLORER_ROOTS.some(root => {
    const safeRoot = `${root}/`.toLowerCase();
    return lowered.startsWith(safeRoot);
  });
}

async function listFiles(root: string, bucket: ForgeFileEntry[]): Promise<void> {
  if (bucket.length >= MAX_FILES) return;
  type DirEntry = { name: string; isDirectory(): boolean; isFile(): boolean };
  let entries: DirEntry[];
  try {
    entries = (await readdir(path.resolve(process.cwd(), root), { withFileTypes: true })) as unknown as DirEntry[];
  } catch {
    return;
  }

  for (const entry of entries) {
    if (bucket.length >= MAX_FILES) return;
    const entryName = entry.name;
    if (entryName.startsWith('.') || entryName === 'node_modules') continue;
    const relative = `${root}/${entryName}`.replace(/\\/g, '/');
    if (entry.isDirectory()) {
      await listFiles(relative, bucket);
      continue;
    }
    if (!entry.isFile() || !FORGE_FILE_EXTENSIONS.has(path.extname(entryName).toLowerCase())) continue;
    if (!isAllowedForgePath(relative)) continue;
    bucket.push({ path: relative, name: entryName, language: inferLanguage(relative), size: 0 });
  }
}

/** List safe repo files (capped). Returns paths relative to the project root. */
export async function listForgeFiles(): Promise<ForgeFileEntry[]> {
  const files: ForgeFileEntry[] = [];
  for (const root of FORGE_EXPLORER_ROOTS) {
    await listFiles(root, files);
  }
  return files;
}
