import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 240_000;
const ALLOWED_ROOTS = ['app/', 'components/', 'lib/', 'hooks/', 'solana/', 'src/app/', 'src/components/', 'src/lib/', 'src/hooks/', 'src/solana/'];
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.rs']);

function normalizeInputPath(input: string): string {
  return input
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '');
}

function resolveForgePath(input: string): { relativePath: string; absolutePath: string } | null {
  const clean = normalizeInputPath(input);
  if (!clean || clean.includes('\0') || clean.includes('..') || clean.startsWith('/') || clean.length > 180) return null;
  if (!ALLOWED_ROOTS.some(prefix => clean.startsWith(prefix))) return null;

  const extension = path.extname(clean).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) return null;

  const relativePath = clean.startsWith('src/') ? clean : `src/${clean}`;
  const projectRoot = process.cwd();
  const absolutePath = path.resolve(projectRoot, relativePath);
  const srcRoot = path.resolve(projectRoot, 'src');
  if (absolutePath !== srcRoot && !absolutePath.startsWith(`${srcRoot}${path.sep}`)) return null;
  return { relativePath, absolutePath };
}

export async function GET(request: NextRequest) {
  const rawPath = request.nextUrl.searchParams.get('path');
  if (!rawPath) return NextResponse.json({ error: 'Missing path' }, { status: 400 });

  const target = resolveForgePath(rawPath);
  if (!target) return NextResponse.json({ error: 'Unsafe or unsupported Forge path' }, { status: 400 });

  const buffer = await readFile(target.absolutePath).catch(() => null);
  if (!buffer) return NextResponse.json({ error: 'File not found' }, { status: 404 });
  if (buffer.byteLength > MAX_FILE_BYTES) return NextResponse.json({ error: 'File is too large for context' }, { status: 413 });

  return NextResponse.json({
    path: target.relativePath,
    content: buffer.toString('utf8'),
  });
}
