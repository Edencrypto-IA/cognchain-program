import { NextRequest, NextResponse } from 'next/server';
import { Limits } from '@/lib/security';
import { searchForgeContext } from '@/lib/forge/context-search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { prompt?: unknown };
  try {
    body = await req.json() as { prompt?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }

  const result = await searchForgeContext(body.prompt.slice(0, Limits.MAX_PROMPT_LENGTH));
  return NextResponse.json(result);
}
