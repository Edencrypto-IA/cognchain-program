import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { loadMemory, loadMemoryZkBundle, saveMemoryZkBundle } from '@/services/memory';
import { buildRealSnarkBundle, buildZkBundle, isZkMvpEnabled, zkMvpMode } from '@/services/zk';
import { safeErrorMessage, sanitizeString, validateHash, validateModel } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    if (!isZkMvpEnabled()) {
      return NextResponse.json(
        { error: 'ZK MVP disabled. Set ZK_MVP_ENABLED=true.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { hash, content, model, timestamp, nonce, forceRegenerate } = body as {
      hash?: string;
      content?: string;
      model?: string;
      timestamp?: number;
      nonce?: string;
      forceRegenerate?: boolean;
    };

    if (hash) {
      const safeHash = validateHash(hash);
      if (!forceRegenerate) {
        const storedBundle = await loadMemoryZkBundle(safeHash);
        if (storedBundle) {
          return NextResponse.json({ hash: safeHash, zk: storedBundle, source: 'stored' });
        }
      }
      const memory = await loadMemory(safeHash);
      if (!memory) {
        return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
      }
      const bundle = buildZkBundle({
        content: memory.content,
        model: memory.model,
        timestamp: memory.timestamp,
        nonce: memory.hash.slice(0, 16),
      });
      const finalBundle =
        zkMvpMode() === 'real'
          ? await buildRealSnarkBundle({
              content: memory.content,
              model: memory.model,
              timestamp: memory.timestamp,
              nonce: memory.hash.slice(0, 16),
            })
          : bundle;
      let persisted = false;
      let persistReason: string | undefined;
      try {
        await saveMemoryZkBundle(memory.hash, finalBundle);
        persisted = true;
      } catch (error: unknown) {
        persistReason = error instanceof Error ? error.message : 'Failed to persist ZK bundle';
      }
      return NextResponse.json({
        hash: memory.hash,
        zk: finalBundle,
        source: 'generated',
        persisted,
        persistReason,
      });
    }

    const safeContent = sanitizeString(content, 100_000, 'content');
    const safeModel = validateModel(model);
    const safeTimestamp =
      typeof timestamp === 'number' && Number.isFinite(timestamp)
        ? Math.floor(timestamp)
        : Math.floor(Date.now() / 1000);
    const safeNonce = sanitizeString(nonce || crypto.randomUUID(), 128, 'nonce');

    const witness = {
      content: safeContent,
      model: safeModel,
      timestamp: safeTimestamp,
      nonce: safeNonce,
    };
    const bundle = zkMvpMode() === 'real' ? await buildRealSnarkBundle(witness) : buildZkBundle(witness);

    return NextResponse.json({ zk: bundle });
  } catch (error: unknown) {
    const status = error instanceof Error && error.name === 'ValidationError' ? 400 : 500;
    return NextResponse.json({ error: safeErrorMessage(error) }, { status });
  }
}

