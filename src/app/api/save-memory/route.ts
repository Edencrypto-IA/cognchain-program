import { NextRequest, NextResponse } from 'next/server';
import { saveMemory, saveMemoryZkBundle } from '@/services/memory';
import { generateZkForMemory } from '@/services/zk';
import { checkRateLimit, sanitizeString, validateModel, Limits, safeErrorMessage } from '@/lib/security';
import { extractRawKey, requireApiKey } from '@/lib/api-key-auth';
import { trackMemorySaved, PLAN_LIMITS } from '@/services/api-keys/api-key.service';

export async function POST(request: NextRequest) {
  try {
    // ── API Key auth (external agents) ──────────────────────
    const hasApiKey = !!extractRawKey(request);
    let externalKeyId: string | null = null;

    if (hasApiKey) {
      const auth = await requireApiKey(request);
      if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
      // Check memory-per-day limit
      const limits = PLAN_LIMITS[auth.key.plan] ?? PLAN_LIMITS.free;
      if (limits.memoriesPerDay > 0 && auth.key.memoriesSaved >= limits.memoriesPerDay) {
        return NextResponse.json({
          error: `Memory limit reached for your plan (${limits.memoriesPerDay}/day). Upgrade at cognchain.xyz/pricing`,
        }, { status: 429 });
      }
      externalKeyId = auth.key.id;
    } else {
      // Internal: IP rate limiting
      const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
      const rate = checkRateLimit(ip, '/api/save-memory');
      if (!rate.allowed) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please slow down.' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } }
        );
      }
    }

    const body = await request.json();
    const { content, model, parentHash, generateZkProof } = body;

    const safeContent = sanitizeString(content, Limits.MAX_CONTENT_LENGTH, 'Content');
    const safeModel = validateModel(model);

    // Validate parentHash if provided
    if (parentHash) {
      const { validateHash } = await import('@/lib/security');
      validateHash(parentHash);
    }

    const memory = await saveMemory({
      content: safeContent,
      model: safeModel,
      parentHash: parentHash || null,
    });

    // Track memory usage for external API key
    if (externalKeyId) {
      await trackMemorySaved(externalKeyId, Math.ceil(safeContent.length / 3.5));
    }

    const zkResult = generateZkProof ? await generateZkForMemory(memory) : null;
    let zkPersisted = false;
    let zkPersistReason: string | undefined;
    if (zkResult?.enabled && zkResult.bundle) {
      try {
        await saveMemoryZkBundle(memory.hash, zkResult.bundle);
        zkPersisted = true;
      } catch (error: unknown) {
        zkPersistReason = error instanceof Error ? error.message : 'Failed to persist ZK bundle';
      }
    }

    return NextResponse.json({
      hash: memory.hash,
      timestamp: memory.timestamp,
      message: 'Memory saved successfully',
      zk: zkResult?.bundle || undefined,
      zkEnabled: zkResult?.enabled || false,
      zkReason: zkResult && !zkResult.enabled ? zkResult.reason : undefined,
      zkPersisted,
      zkPersistReason,
    });
  } catch (error: unknown) {
    const status = error instanceof Error && error.name === 'ValidationError' ? 400 : 500;
    return NextResponse.json({ error: safeErrorMessage(error) }, { status });
  }
}
