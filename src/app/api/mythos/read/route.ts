import { NextRequest, NextResponse } from 'next/server';
import {
  extractWebUrls,
  formatWebReadContext,
  prepareWebMemoryRecords,
  readWebUrl,
  readWebUrls,
} from '@/lib/mythos/web-reader';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

function getIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(getIp(request), '/api/mythos/read');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many Mythos web reads. Try again shortly.' }, { status: 429 });
  }

  try {
    const url = new URL(request.url).searchParams.get('url') || '';
    if (!url.trim()) {
      return NextResponse.json({ error: 'Query parameter ?url= is required.' }, { status: 400 });
    }

    const result = await readWebUrl(url);
    if (!result.success) {
      return NextResponse.json({ ok: false, error: result.error, result }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      result,
      memoryRecords: prepareWebMemoryRecords([result]),
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(getIp(request), '/api/mythos/read');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many Mythos web reads. Try again shortly.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const url = typeof body.url === 'string' ? body.url : '';
    const urls = Array.isArray(body.urls) ? body.urls.filter((item: unknown): item is string => typeof item === 'string') : [];
    const text = typeof body.text === 'string' ? body.text : '';
    const targetUrls = url ? [url] : urls.length ? urls : extractWebUrls(text);

    if (!targetUrls.length) {
      return NextResponse.json({ error: 'Provide url, urls[], or text containing public URL(s).' }, { status: 400 });
    }

    const results = await readWebUrls(targetUrls);
    return NextResponse.json({
      ok: true,
      stats: {
        total: results.length,
        successful: results.filter(result => result.success).length,
        failed: results.filter(result => !result.success).length,
      },
      results,
      promptContext: formatWebReadContext(results),
      memoryRecords: prepareWebMemoryRecords(results),
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
