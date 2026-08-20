import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { resolveForgePath } from '@/lib/forge/paths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CONTENT_LENGTH = 220_000;

type SaveBody = {
  path?: unknown;
  content?: unknown;
};

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
