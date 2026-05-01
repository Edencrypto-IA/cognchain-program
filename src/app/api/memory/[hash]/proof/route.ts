import { NextResponse } from 'next/server';
import { loadMemory, loadMemoryZkBundle, saveMemoryZkBundle } from '@/services/memory';
import { generateZkForMemory } from '@/services/zk';
import { safeErrorMessage, validateHash } from '@/lib/security';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;
    const safeHash = validateHash(hash);
    const storedBundle = await loadMemoryZkBundle(safeHash);
    if (storedBundle) {
      return NextResponse.json({
        hash: safeHash,
        zk: storedBundle,
        source: 'stored',
      });
    }

    const memory = await loadMemory(safeHash);

    if (!memory) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }

    const zkResult = await generateZkForMemory(memory);
    if (!zkResult.enabled || !zkResult.bundle) {
      return NextResponse.json(
        { error: zkResult.reason || 'ZK MVP disabled' },
        { status: 503 }
      );
    }

    let persisted = false;
    let persistReason: string | undefined;
    try {
      await saveMemoryZkBundle(memory.hash, zkResult.bundle);
      persisted = true;
    } catch (error: unknown) {
      persistReason = error instanceof Error ? error.message : 'Failed to persist ZK bundle';
    }

    return NextResponse.json({
      hash: memory.hash,
      zk: zkResult.bundle,
      source: 'generated',
      persisted,
      persistReason,
    });
  } catch (error: unknown) {
    const status = error instanceof Error && error.name === 'ValidationError' ? 400 : 500;
    return NextResponse.json({ error: safeErrorMessage(error) }, { status });
  }
}

