import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkRateLimit, validateHash, safeErrorMessage } from '@/lib/security';

// PoI threshold: 3 votes com score médio ≥ 7 → ancora on-chain automaticamente
const POI_MIN_VOTES = 3;
const POI_MIN_AVG   = 7;

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rate = checkRateLimit(ip, '/api/score');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const { hash, score } = body;

    const safeHash = validateHash(hash);

    if (
      score === undefined ||
      typeof score !== 'number' ||
      score < 1 || score > 10 ||
      !Number.isInteger(score)
    ) {
      return NextResponse.json({ error: 'Score must be an integer between 1 and 10' }, { status: 400 });
    }

    // Verify memory exists
    const memory = await db.memory.findUnique({ where: { hash: safeHash } });
    if (!memory) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }

    // Save insight vote
    await db.insightVote.create({
      data: { memoryHash: safeHash, score, voterIp: ip },
    });

    // Recalculate average across all votes
    const allVotes  = await db.insightVote.findMany({ where: { memoryHash: safeHash } });
    const voteCount = allVotes.length;
    const avgScore  = allVotes.reduce((s, v) => s + v.score, 0) / voteCount;

    await db.memory.update({
      where: { hash: safeHash },
      data: { score: parseFloat(avgScore.toFixed(1)) },
    });

    // ── Proof of Insight check ──────────────────────────────
    const alreadyAnchored = memory.verified || memory.poiTxHash;

    const poi: {
      unlocked: boolean;
      txHash: string | null;
      voteCount: number;
      avgScore: number;
      threshold: { minVotes: number; minAvg: number };
    } = {
      unlocked:  !!alreadyAnchored,
      txHash:    memory.poiTxHash || null,
      voteCount,
      avgScore:  parseFloat(avgScore.toFixed(1)),
      threshold: { minVotes: POI_MIN_VOTES, minAvg: POI_MIN_AVG },
    };

    if (!alreadyAnchored && voteCount >= POI_MIN_VOTES && avgScore >= POI_MIN_AVG) {
      // Consensus reached — anchor on Solana automatically
      try {
        const { storeOnSolana } = await import('@/services/blockchain');
        const result = await storeOnSolana(safeHash);

        if (result.success && result.txHash) {
          await db.memory.update({
            where: { hash: safeHash },
            data: { verified: true, poiTxHash: result.txHash },
          });
          poi.unlocked = true;
          poi.txHash   = result.txHash;
        }
      } catch {
        // Blockchain failure doesn't block the vote response
      }
    }

    return NextResponse.json({
      hash: safeHash,
      score: parseFloat(avgScore.toFixed(1)),
      voteCount,
      poi,
      message: poi.unlocked
        ? `✓ Proof of Insight! ${voteCount} votos, avg ${avgScore.toFixed(1)}/10 — ancorado na Solana.`
        : `Voto salvo. ${voteCount}/${POI_MIN_VOTES} votos, avg ${avgScore.toFixed(1)}/10 (precisa ≥${POI_MIN_AVG}).`,
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

// GET — status PoI de um hash
export async function GET(request: NextRequest) {
  try {
    const hash = request.nextUrl.searchParams.get('hash');
    if (!hash) return NextResponse.json({ error: 'hash required' }, { status: 400 });

    const memory = await db.memory.findFirst({ where: { hash: { startsWith: hash } } });
    if (!memory) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const votes = await db.insightVote.findMany({ where: { memoryHash: memory.hash } });
    const avgScore = votes.length > 0
      ? votes.reduce((s, v) => s + v.score, 0) / votes.length
      : 0;

    return NextResponse.json({
      hash: memory.hash,
      verified: memory.verified,
      poiTxHash: memory.poiTxHash,
      voteCount: votes.length,
      avgScore: parseFloat(avgScore.toFixed(1)),
      poiUnlocked: memory.verified || !!memory.poiTxHash,
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
