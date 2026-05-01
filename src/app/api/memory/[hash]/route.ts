import { NextRequest, NextResponse } from 'next/server';
import { loadMemory, loadEvolutionChain } from '@/services/memory';
import { validateHash, safeErrorMessage } from '@/lib/security';

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
