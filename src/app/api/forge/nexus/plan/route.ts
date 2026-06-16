import { NextRequest, NextResponse } from 'next/server';
import { Limits } from '@/lib/security';
import { createForgeNexusPlan } from '@/lib/forge/nexus';
import type { ForgeFile } from '@/lib/forge/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isForgeFile(value: unknown): value is ForgeFile {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.path === 'string' && typeof item.language === 'string' && typeof item.contents === 'string';
}

export async function POST(req: NextRequest) {
  let body: { prompt?: unknown; files?: unknown };
  try {
    body = await req.json() as { prompt?: unknown; files?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }

  const files = Array.isArray(body.files)
    ? body.files.filter(isForgeFile).slice(0, 120)
    : [];

  // FORGE_UPGRADE: Nexus Fase 1 only creates a reviewable plan; it never edits files or runs commands.
  const plan = createForgeNexusPlan(body.prompt.slice(0, Limits.MAX_PROMPT_LENGTH), files);
  return NextResponse.json({ plan });
}
