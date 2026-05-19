import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-key-auth';
import { safeErrorMessage, validateHash } from '@/lib/security';
import { saveMemory, saveMemoryZkBundle } from '@/services/memory';
import { generateZkForMemory } from '@/services/zk';
import { PLAN_LIMITS, trackMemorySaved } from '@/services/api-keys/api-key.service';
import {
  buildBridgeClientId,
  buildBridgeEnvelope,
  normalizeBridgeMetadata,
  normalizeBridgeModel,
  validateBridgeContent,
} from '@/features/agent-memory-bridge/bridge';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiKey(request);
    if ('error' in auth) {
      const e = auth as { error: string; status: 401 | 429 };
      return NextResponse.json({ error: e.error }, { status: e.status });
    }

    const limits = PLAN_LIMITS[auth.key.plan] ?? PLAN_LIMITS.free;
    if (limits.memoriesPerDay > 0 && auth.key.memoriesSaved >= limits.memoriesPerDay) {
      return NextResponse.json({
        error: `Memory limit reached for your plan (${limits.memoriesPerDay}/day).`,
      }, { status: 429 });
    }

    const body = await request.json();
    const content = validateBridgeContent(body.content);
    const metadata = normalizeBridgeMetadata(body.metadata);
    const model = normalizeBridgeModel(body.model, metadata.source);
    const parentHash = body.parentHash ? validateHash(body.parentHash) : null;
    const clientId = buildBridgeClientId({
      keyId: auth.key.id,
      source: metadata.source,
      agentId: metadata.agentId,
    });

    const memory = await saveMemory({
      content: buildBridgeEnvelope({
        content,
        owner: auth.key.owner,
        clientId,
        metadata,
      }),
      model,
      parentHash,
      clientId,
    });

    await trackMemorySaved(auth.key.id, Math.ceil(content.length / 3.5));

    const wantsZk = body.generateZkProof === true || metadata.proofMode === 'zk_requested';
    const zkResult = wantsZk ? await generateZkForMemory(memory) : null;
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
      content_hash: memory.hash,
      contentHash: memory.hash,
      memory_id: memory.hash,
      timestamp: memory.timestamp,
      created_at: memory.timestamp,
      message: 'Agent memory saved successfully',
      source: metadata.source,
      agentId: metadata.agentId,
      agentName: metadata.agentName,
      contentType: metadata.contentType,
      vault: clientId,
      owner: auth.key.owner,
      proofUrl: `/api/memory/${memory.hash}/proof`,
      readUrl: `/api/memory/${memory.hash}`,
      verifyUrl: `/api/memory/verify/${memory.hash}`,
      tx_signature: null,
      txSignature: null,
      on_chain: false,
      verified: memory.verified,
      zkEnabled: zkResult?.enabled || false,
      zkReason: zkResult && !zkResult.enabled ? zkResult.reason : undefined,
      zkPersisted,
      zkPersistReason,
      safety: metadata.safety,
    });
  } catch (error: unknown) {
    const status = error instanceof Error && error.name === 'ValidationError' ? 400 : 500;
    return NextResponse.json({ error: safeErrorMessage(error) }, { status });
  }
}
