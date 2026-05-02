import { NextRequest, NextResponse } from 'next/server';
import { routeChat } from '@/services/ai';
import { saveMemory, chunkContent } from '@/services/memory';
import { checkRateLimit, validateModel, Limits, safeErrorMessage } from '@/lib/security';
import { getCachedResponse, cacheResponse, seedFAQCache } from '@/services/cache/response-cache';
import { extractRawKey, requireApiKey } from '@/lib/api-key-auth';

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

    if (hasApiKey) {
      // ── External agent — must have valid API key ──────────
      const auth = await requireApiKey(request);
      if ('error' in auth) {
        const e = auth as { error: string; status: number };
        return NextResponse.json({ error: e.error }, { status: e.status });
      }
      // External agents use their own AI keys via the same router,
      // but their usage is tracked against our budget — warn them clearly.
      // Future: allow agents to pass their own AI key in headers.
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
    const selectedModel = validateModel(model || 'gpt');

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

    const response = await routeChat(selectedModel, messages, previousModel);

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
    });
  } catch (error: unknown) {
    const status = error instanceof Error && error.name === 'ValidationError' ? 400 : 500;
    return NextResponse.json({ error: safeErrorMessage(error) }, { status });
  }
}
