import { NextRequest, NextResponse } from 'next/server';
import { routeChat } from '@/services/ai';
import { saveMemory } from '@/services/memory';
import { checkRateLimit, sanitizeString, validateModel, Limits, safeErrorMessage } from '@/lib/security';
import type { ChatMessage } from '@/services/memory/memory.model';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting — compare is expensive (parallel AI calls)
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rate = checkRateLimit(ip, '/api/compare');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const { prompt, models } = body;

    const safePrompt = sanitizeString(prompt, Limits.MAX_PROMPT_LENGTH, 'Prompt');

    if (!models || !Array.isArray(models) || models.length === 0) {
      return NextResponse.json({ error: 'Models array is required' }, { status: 400 });
    }
    if (models.length > Limits.MAX_COMPARE_MODELS) {
      return NextResponse.json(
        { error: `Maximum ${Limits.MAX_COMPARE_MODELS} models per comparison` },
        { status: 400 }
      );
    }

    // Validate each model
    for (const m of models) {
      validateModel(m);
    }

    const results = await Promise.allSettled(
      models.map(async (model: string) => {
        const messages: ChatMessage[] = [{ role: 'user', content: safePrompt }];
        const response = await routeChat(model, messages);

        const memory = await saveMemory({
          content: `Q: ${safePrompt}\nA (${model}): ${response}`,
          model,
        });

        return {
          model,
          response,
          hash: memory.hash,
          timestamp: memory.timestamp,
        };
      })
    );

    const responses = results.map((r, idx) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        model: models[idx],
        response: null,
        error: r.reason instanceof Error ? r.reason.message : 'Erro ao processar modelo',
        hash: null,
        timestamp: null,
      };
    });

    return NextResponse.json({
      prompt: safePrompt,
      responses,
    });
  } catch (error: unknown) {
    const status = error instanceof Error && error.name === 'ValidationError' ? 400 : 500;
    return NextResponse.json({ error: safeErrorMessage(error) }, { status });
  }
}
