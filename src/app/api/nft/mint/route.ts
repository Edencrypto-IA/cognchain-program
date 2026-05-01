import { NextRequest, NextResponse } from 'next/server';
import { mintMemoryAsNFT } from '@/services/nft/nft.service';
import { checkRateLimit, validateHash, validateModel, sanitizeString, Limits, safeErrorMessage } from '@/lib/security';

/**
 * POST /api/nft/mint
 * Mint a verified memory as an NFT on Solana Devnet
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting — NFT minting is very expensive (0.5 SOL airdrop per call)
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rate = checkRateLimit(ip, '/api/nft/mint');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Max 3 mints per minute.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } }
      );
    }

    const { memoryHash, content, model, previousModel, score, timestamp, walletAddress } = await req.json();

    if (!memoryHash || !content) {
      return NextResponse.json({ error: 'memoryHash and content are required' }, { status: 400 });
    }

    // Validate hash format
    const safeHash = validateHash(memoryHash);

    // Validate content length
    const safeContent = sanitizeString(content, Limits.MAX_CONTENT_LENGTH, 'Content');

    // Validate model
    const safeModel = validateModel(model || 'congchain');

    // Validate previousModel if provided
    let safePrevModel: string | undefined;
    if (previousModel) {
      safePrevModel = validateModel(previousModel);
    }

    // Validate score if provided
    let safeScore: number | undefined;
    if (score !== undefined && score !== null) {
      if (typeof score !== 'number' || score < 0 || score > 10 || !Number.isInteger(score)) {
        return NextResponse.json({ error: 'Score must be an integer between 0 and 10' }, { status: 400 });
      }
      safeScore = score;
    }

    const result = await mintMemoryAsNFT({
      memoryHash: safeHash,
      content: safeContent,
      model: safeModel,
      previousModel: safePrevModel,
      score: safeScore,
      timestamp: timestamp || new Date().toISOString(),
      walletAddress: walletAddress || undefined,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const status = error instanceof Error && error.name === 'ValidationError' ? 400 : 500;
    return NextResponse.json({ error: safeErrorMessage(error) }, { status });
  }
}
