import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// FORGE_UPGRADE: Explorer only exposes safe product/code surfaces, never internal API or deployment routes.
const ROOTS = [
  'src/app',
  'src/components',
  'src/lib',
  'src/hooks',
  'src/solana',
  'src/skills',
  'src/store',
  'src/trigger',
  'src/security',
];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.rs']);
const MAX_FILES = 500;

type ForgeFileEntry = {
  path: string;
  name: string;
  language: string;
  size: number;
};

function inferLanguage(filePath: string): string {
  if (filePath.endsWith('.tsx')) return 'tsx';
  if (filePath.endsWith('.ts')) return 'ts';
  if (filePath.endsWith('.json')) return 'json';
  if (filePath.endsWith('.md')) return 'md';
  if (filePath.endsWith('.css')) return 'css';
  if (filePath.endsWith('.rs')) return 'rs';
  return 'txt';
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

  return ROOTS.some(root => {
    const safeRoot = `${root}/`.toLowerCase();
    return lowered.startsWith(safeRoot);
  });
}

async function listFiles(root: string, bucket: ForgeFileEntry[]): Promise<void> {
  if (bucket.length >= MAX_FILES) return;
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(path.resolve(process.cwd(), root), { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (bucket.length >= MAX_FILES) return;
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const relative = `${root}/${entry.name}`.replace(/\\/g, '/');
    if (entry.isDirectory()) {
      await listFiles(relative, bucket);
      continue;
    }
    if (!entry.isFile() || !EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    if (!isAllowedForgePath(relative)) continue;
    bucket.push({ path: relative, name: entry.name, language: inferLanguage(relative), size: 0 });
  }
}

export async function GET() {
  const files: ForgeFileEntry[] = [];
  for (const root of ROOTS) {
    await listFiles(root, files);
  }
  return NextResponse.json({ files });
}
