import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

const MAX_MYTHOS_MEMORY_CONTENT = 30_000;

function clientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function resolveBaseUrl(request: NextRequest) {
  const configured = process.env.CONGCHAIN_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  try {
    const rate = checkRateLimit(clientIp(request), '/api/mythos/memory/write');
    if (!rate.allowed) {
      return NextResponse.json({
        error: 'Mythos memory write rate limit reached. Try again shortly.',
        resetAt: rate.resetAt,
      }, { status: 429 });
    }

    const apiKey = process.env.CONGCHAIN_API_KEY?.trim();
    if (!apiKey?.startsWith('cog_live_')) {
      return NextResponse.json({
        error: 'CONGCHAIN_API_KEY is not configured on the server. Add the cog_live key in Railway variables to let Mythos generate CongChain hashes.',
        code: 'missing_server_congchain_key',
      }, { status: 503 });
    }

    const body = await request.json();
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) {
      return NextResponse.json({ error: 'Memory content is required.' }, { status: 400 });
    }
    if (content.length > MAX_MYTHOS_MEMORY_CONTENT) {
      return NextResponse.json({
        error: `Memory content is too large for one Mythos record. Limit: ${MAX_MYTHOS_MEMORY_CONTENT} characters.`,
      }, { status: 413 });
    }

    const baseUrl = resolveBaseUrl(request);
    const response = await fetch(`${baseUrl}/api/memory/write`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        content,
        model: body.model || 'mythos',
        generateZkProof: true,
        metadata: {
          ...(body.metadata || {}),
          source: 'mythos',
          agentId: body.metadata?.agentId || process.env.CONGCHAIN_AGENT_ID || 'mythos-lab',
          agentName: body.metadata?.agentName || 'Mythos',
          origin: 'mythos-lab',
          proofMode: 'zk_requested',
          anchorMode: 'manual',
          safety: {
            ...(body.metadata?.safety || {}),
            containsSecrets: false,
            containsPrivateKeys: false,
            containsSignedPayloads: false,
            canMoveFunds: false,
            requiresHumanReview: true,
          },
        },
      }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
