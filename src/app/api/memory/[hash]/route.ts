import { NextRequest, NextResponse } from 'next/server';
import { loadMemory, loadEvolutionChain } from '@/services/memory';
import { validateHash, safeErrorMessage } from '@/lib/security';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;

    // Validate hash format (64 hex chars)
    const safeHash = validateHash(hash);

    const { searchParams } = new URL(request.url);
    const includeChain = searchParams.get('chain') === 'true';

    if (includeChain) {
      const chain = await loadEvolutionChain(safeHash);
      if (chain.length === 0) {
        return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
      }
      return NextResponse.json({ chain });
    }

    const memory = await loadMemory(safeHash);
    if (!memory) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }

    return NextResponse.json({ memory });
  } catch (error: unknown) {
    const status = error instanceof Error && error.name === 'ValidationError' ? 400 : 500;
    return NextResponse.json({ error: safeErrorMessage(error) }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;
    const safeHash = validateHash(hash);
    await db.memory.delete({ where: { hash: safeHash } });
    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    const status = error instanceof Error && error.name === 'ValidationError' ? 400 : 500;
    return NextResponse.json({ error: safeErrorMessage(error) }, { status });
  }
}
