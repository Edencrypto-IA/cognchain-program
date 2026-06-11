import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CONTENT_LENGTH = 220_000;
const ALLOWED_ROOTS = ['app/', 'components/', 'lib/', 'hooks/', 'solana/', 'src/app/', 'src/components/', 'src/lib/', 'src/hooks/', 'src/solana/'];
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.rs']);

type SaveBody = {
  path?: unknown;
  content?: unknown;
};

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

export async function POST(request: NextRequest) {
  let body: SaveBody;
  try {
    body = await request.json() as SaveBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.path !== 'string' || typeof body.content !== 'string') {
    return NextResponse.json({ error: 'Missing path or content' }, { status: 400 });
  }
  if (body.content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: 'File content is too large' }, { status: 413 });
  }

  const target = resolveForgePath(body.path);
  if (!target) {
    return NextResponse.json({ error: 'Unsafe or unsupported Forge path' }, { status: 400 });
  }

  await mkdir(path.dirname(target.absolutePath), { recursive: true });
  await writeFile(target.absolutePath, body.content, 'utf8');

  return NextResponse.json({
    ok: true,
    path: target.relativePath,
    bytes: Buffer.byteLength(body.content, 'utf8'),
  });
}
