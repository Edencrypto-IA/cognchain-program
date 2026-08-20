import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { resolveForgePath } from '@/lib/forge/paths';
import { saveMemory } from '@/services/memory';
import { checkRateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MEMORY_CONTENT = 90_000;

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rate = checkRateLimit(ip, '/api/forge/memory/save');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests. Wait a moment.' }, { status: 429 });
  }

  let body: { path?: unknown };
  try {
    body = await request.json() as { path?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body.path !== 'string' || !body.path.trim()) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 });
  }

  const target = resolveForgePath(body.path);
  if (!target || !target.relativePath.startsWith('src/forge-uploads/')) {
    return NextResponse.json({ error: 'Somente arquivos de upload podem virar memória' }, { status: 400 });
  }

  const buffer = await readFile(target.absolutePath).catch(() => null);
  if (!buffer) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const content = buffer.toString('utf8');
  const truncated = content.length > MAX_MEMORY_CONTENT;
  const safe = content.slice(0, MAX_MEMORY_CONTENT);

  try {
    const memory = await saveMemory({
      content: `[FORGE_UPLOAD] ${target.relativePath}\n\n${safe}`,
      model: 'deepseek',
    });
    return NextResponse.json({
      hash: memory.hash,
      path: target.relativePath,
      size: buffer.length,
      truncated,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Não foi possível salvar a memória (banco indisponível?). Configure o Postgres (DATABASE_URL).' },
      { status: 500 },
    );
  }
}
