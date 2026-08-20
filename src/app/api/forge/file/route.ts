import { readFile } from 'node:fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { resolveForgePath } from '@/lib/forge/paths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 240_000;

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
