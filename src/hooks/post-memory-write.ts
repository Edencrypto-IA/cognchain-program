import { validateHash } from '@/lib/security';
import { storeOnSolana } from '@/services/blockchain';
import type { HookEvent } from './hook-manager';

export async function postMemoryWriteAnchorHook(event: HookEvent): Promise<void> {
  if (event.type !== 'post-memory-write') return;

  const safeHash = validateHash(event.payload.hash);
  const result = await storeOnSolana(safeHash);
  if (!result.success) {
    console.warn('[PostMemoryWriteHook] Memory anchor failed', {
      hash: safeHash,
      source: event.payload.source,
      message: result.message,
    });
    return;
  }

  console.info('[PostMemoryWriteHook] Memory anchored on-chain', {
    hash: safeHash,
    txHash: result.txHash,
    network: result.network,
  });
}
