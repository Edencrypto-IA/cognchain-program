import { NextRequest, NextResponse } from 'next/server';
import { routeChat } from '@/services/ai';
import { saveMemory, chunkContent } from '@/services/memory';
import { checkRateLimit, validateModel, Limits, safeErrorMessage, MODEL_TIER } from '@/lib/security';
import { needsGrounding, groundQuery } from '@/lib/grounding';
import { getCachedResponse, cacheResponse, seedFAQCache } from '@/services/cache/response-cache';
import { extractRawKey, requireApiKey } from '@/lib/api-key-auth';
import { verifyAdminToken } from '@/app/api/auth/verify/route';

// Seed FAQ on first request
let faqSeeded = false;
async function ensureSeeded() {
  if (faqSeeded) return;
  faqSeeded = true;
  await seedFAQCache().catch(() => {});
}

export async function POST(request: NextRequest) {
  try {
    const hasApiKey = !!extractRawKey(request);

    // ── Admin cookie check ────────────────────────────────────
    const adminToken = request.cookies.get('cog_admin')?.value || '';
    const isAdmin = adminToken ? verifyAdminToken(adminToken) : false;

    let userPlan: 'free' | 'pro' = isAdmin ? 'pro' : 'free';

    if (hasApiKey) {
      // ── External agent — must have valid API key ──────────
      const auth = await requireApiKey(request);
      if ('error' in auth) {
        const e = auth as { error: string; status: number };
        return NextResponse.json({ error: e.error }, { status: e.status });
      }
      userPlan = (auth.key.plan === 'pro' || auth.key.plan === 'enterprise') ? 'pro' : 'free';
    } else {
      // ── Internal app — IP rate limiting ──────────────────
      const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
      const rate = checkRateLimit(ip, '/api/chat');
      if (!rate.allowed) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please slow down.' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } }
        );
      }
      // Check for pro key passed in body (browser users who have a pro key)
      const bodyPeek = await request.clone().json().catch(() => ({}));
      const inlineKey = bodyPeek?.proKey as string | undefined;
      if (inlineKey?.startsWith('cog_')) {
        const { validateApiKey } = await import('@/services/api-keys/api-key.service');
        const key = await validateApiKey(inlineKey).catch(() => null);
        if (key && (key.plan === 'pro' || key.plan === 'enterprise')) userPlan = 'pro';
      }
    }

    const body = await request.json();
    const { messages, model, saveResponse, previousModel } = body;

    // Validate messages array
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }
    if (messages.length > Limits.MAX_MESSAGES_ARRAY) {
      return NextResponse.json(
        { error: `Messages array exceeds maximum of ${Limits.MAX_MESSAGES_ARRAY}` },
        { status: 400 }
      );
    }

    // Validate each message
    for (const m of messages) {
      if (!m.role || !m.content || typeof m.content !== 'string') {
        return NextResponse.json({ error: 'Each message must have role and content fields' }, { status: 400 });
      }
      if (m.content.length > Limits.MAX_PROMPT_LENGTH) {
        return NextResponse.json(
          { error: `Message content exceeds maximum of ${Limits.MAX_PROMPT_LENGTH} characters` },
          { status: 400 }
        );
      }
    }

    // Validate model
    const selectedModel = validateModel(model || 'nvidia');

    // ── Tier enforcement ──────────────────────────────────────
    if (MODEL_TIER(selectedModel) === 'pro' && userPlan === 'free') {
      return NextResponse.json({
        error: 'PRO_REQUIRED',
        message: 'Este modelo requer o plano Pro. Acesse /dashboard/keys para obter sua chave Pro por $5/mês.',
        upgradeUrl: '/dashboard/keys',
        model: selectedModel,
      }, { status: 402 });
    }

    // Validate previousModel if provided
    if (previousModel) {
      validateModel(previousModel);
    }

    // ── Cache lookup — serve instantly, zero API cost ─────────
    await ensureSeeded();
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    const cached = lastUserMessage ? await getCachedResponse(lastUserMessage.content) : null;

    if (cached) {
      return NextResponse.json({
        response:    cached.answer,
        model:       selectedModel,
        fromCache:   true,
        cacheHits:   cached.hits,
        tokensSaved: cached.tokensSaved,
        memoryHash:  null,
      });
    }

    // ── Grounding Engine — inject verified data + return structured response ─
    let groundingPrefix = '';
    let structuredResponse: import('@/lib/grounding/types').StructuredResponse | null = null;
    if (lastUserMessage && needsGrounding(lastUserMessage.content)) {
      // 8s total budget — never block the chat
      const grounded = await Promise.race([
        groundQuery(lastUserMessage.content),
        new Promise<null>(r => setTimeout(() => r(null), 8000)),
      ]).catch(() => null);
      if (grounded && 'response' in grounded) {
        groundingPrefix = grounded.markdown
          ? `[Dados verificados]\n${grounded.markdown}\n\n`
          : '';
        structuredResponse = grounded.response;
      }
    }

    const augmentedMessages = groundingPrefix && lastUserMessage
      ? messages.map(m =>
          m === lastUserMessage
            ? { ...m, content: groundingPrefix + m.content }
            : m
        )
      : messages;

    const response = await routeChat(selectedModel, augmentedMessages, previousModel);

    // ── Store in cache for future requests ────────────────────
    if (lastUserMessage) {
      await cacheResponse(lastUserMessage.content, response, selectedModel).catch(() => {});
    }

    let memoryHash: string | null = null;
    let chunkCount = 0;
    if (saveResponse) {
      const fullContent = messages.map(m => `${m.role}: ${m.content}`).join('\n') + `\nassistant: ${response}`;
      const memory = await saveMemory({
        content: fullContent.substring(0, Limits.MAX_CONTENT_LENGTH),
        model: selectedModel,
      });
      memoryHash = memory.hash;

      const chunks = chunkContent(fullContent, selectedModel);
      chunkCount = chunks.length;
    }

    return NextResponse.json({
      response,
      model: selectedModel,
      memoryHash,
      chunkCount: chunkCount || undefined,
      structuredResponse: structuredResponse ?? undefined,
    });
  } catch (error: unknown) {
    const status = error instanceof Error && error.name === 'ValidationError' ? 400 : 500;
    return NextResponse.json({ error: safeErrorMessage(error) }, { status });
  }
}
