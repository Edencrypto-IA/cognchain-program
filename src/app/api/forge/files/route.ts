import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOTS = ['src/app', 'src/components', 'src/lib', 'src/hooks', 'src/solana'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.rs']);
const MAX_FILES = 500;

type ForgeFileEntry = {
  path: string;
  name: string;
};

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
    bucket.push({ path: relative, name: entry.name });
  }
}

export async function GET() {
  const files: ForgeFileEntry[] = [];
  for (const root of ROOTS) {
    await listFiles(root, files);
  }
  return NextResponse.json({ files });
}
