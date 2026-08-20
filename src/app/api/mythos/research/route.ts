import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';
import { runMythosResearch, type MythosResearchPlatform } from '@/lib/mythos/research-adapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function parsePlatform(value: unknown): MythosResearchPlatform | undefined {
  if (value === 'web' || value === 'github' || value === 'youtube' || value === 'reddit' || value === 'twitter') return value;
  return undefined;
}

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(getIp(request), '/api/mythos/research');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many Mythos research requests. Try again shortly.' }, { status: 429 });
  }

  try {
    const params = new URL(request.url).searchParams;
    const query = params.get('q') || params.get('query') || '';
    const platform = parsePlatform(params.get('platform'));
    if (!query.trim()) {
      return NextResponse.json({ error: 'Query parameter ?q= is required.' }, { status: 400 });
    }

    const report = await runMythosResearch(query, platform);
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(getIp(request), '/api/mythos/research');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many Mythos research requests. Try again shortly.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({})) as { query?: unknown; prompt?: unknown; platform?: unknown };
    const query = typeof body.query === 'string' ? body.query : typeof body.prompt === 'string' ? body.prompt : '';
    const platform = parsePlatform(body.platform);
    if (!query.trim()) {
      return NextResponse.json({ error: 'Provide query or prompt.' }, { status: 400 });
    }

    const report = await runMythosResearch(query, platform);
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
