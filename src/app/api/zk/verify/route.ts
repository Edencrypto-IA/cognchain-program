import { NextRequest, NextResponse } from 'next/server';
import { verifyZkBundle } from '@/services/zk';
import type { ZkMvpBundle } from '@/services/zk';
import { safeErrorMessage } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const bundle = body?.zk as ZkMvpBundle | undefined;

    if (!bundle || !bundle.publicSignals || !bundle.proof) {
      return NextResponse.json({ error: 'Invalid payload. Expected { zk: { publicSignals, proof } }' }, { status: 400 });
    }

    const valid = await verifyZkBundle(bundle);
    return NextResponse.json({
      valid,
      memoryHash: bundle.publicSignals.memoryHash,
      proofVersion: bundle.publicSignals.proofVersion,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

