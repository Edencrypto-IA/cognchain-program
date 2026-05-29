import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

type MetadataReviewInput = {
  proposalId?: unknown;
  name?: unknown;
  symbol?: unknown;
  description?: unknown;
  imagePrompt?: unknown;
  walletAddress?: unknown;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function isLikelySolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function makeMetadataHash(input: {
  proposalId: string;
  name: string;
  symbol: string;
  description: string;
  imagePrompt: string;
  walletAddress: string;
}) {
  return crypto.createHash('sha256').update(JSON.stringify({
    ...input,
    phase: 'pumpfun_metadata_review_v1',
  })).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rate = checkRateLimit(ip, '/api/mythos/pumpfun/metadata-review');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Muitas revisões de metadata foram solicitadas. Aguarde um pouco e tente novamente.' },
        { status: 429 }
      );
    }

    const body = await request.json() as MetadataReviewInput;
    const proposalId = clean(body.proposalId, 80);
    const name = clean(body.name, 42);
    const symbol = clean(body.symbol, 10).replace(/[^a-z0-9]/gi, '').toUpperCase();
    const description = clean(body.description, 360);
    const imagePrompt = clean(body.imagePrompt, 420);
    const walletAddress = clean(body.walletAddress, 64);

    const checks = [
      {
        id: 'proposal',
        label: 'Launch proposal',
        status: proposalId.startsWith('pump_') ? 'ready' : 'review',
        detail: proposalId.startsWith('pump_')
          ? `Proposal ${proposalId} is linked to this metadata packet.`
          : 'A Pump.fun proposal ID should be prepared before metadata review.',
      },
      {
        id: 'name_symbol',
        label: 'Name and ticker',
        status: name.length >= 3 && symbol.length >= 2 ? 'ready' : 'blocked',
        detail: name.length >= 3 && symbol.length >= 2
          ? `${name} (${symbol}) passes basic identity checks.`
          : 'Name and ticker are required before metadata can be uploaded in a future phase.',
      },
      {
        id: 'description',
        label: 'Description',
        status: description.length >= 32 ? 'ready' : 'review',
        detail: description.length >= 32
          ? 'Description is long enough for human review.'
          : 'Description should explain the meme, community, and risk boundary more clearly.',
      },
      {
        id: 'image',
        label: 'Visual prompt',
        status: imagePrompt.length >= 24 ? 'ready' : 'review',
        detail: imagePrompt.length >= 24
          ? 'Image prompt is ready for future manual upload or generation review.'
          : 'A logo/mascot prompt or reviewed image file is required before upload.',
      },
      {
        id: 'wallet',
        label: 'Wallet',
        status: isLikelySolanaAddress(walletAddress) ? 'ready' : 'blocked',
        detail: isLikelySolanaAddress(walletAddress)
          ? `Wallet ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)} is linked for future approval.`
          : 'A connected Phantom/Solflare public address is required before transaction preparation.',
      },
      {
        id: 'upload',
        label: 'Upload execution',
        status: 'blocked',
        detail: 'No IPFS, Arweave, Pump.fun, or third-party upload is performed by this endpoint.',
      },
    ] as const;

    const blocked = checks.filter(check => check.status === 'blocked').length;
    const review = checks.filter(check => check.status === 'review').length;
    const ready = checks.filter(check => check.status === 'ready').length;
    const metadataHash = makeMetadataHash({ proposalId, name, symbol, description, imagePrompt, walletAddress });

    return NextResponse.json({
      ok: true,
      metadataReview: {
        id: `meta_${metadataHash.slice(0, 24)}`,
        proposalId: proposalId || null,
        status: blocked > 0 ? 'blocked' : review > 0 ? 'needs_review' : 'ready_for_manual_upload',
        createdAt: new Date().toISOString(),
        platform: 'pump.fun',
        network: 'solana-mainnet-preview',
        metadataHash,
        token: {
          name,
          symbol,
          description,
          imagePrompt,
        },
        wallet: {
          address: walletAddress || null,
          ready: isLikelySolanaAddress(walletAddress),
        },
        upload: {
          performed: false,
          uri: null,
          storage: null,
          note: 'This is a review packet only. A future phase may upload metadata after explicit human approval.',
        },
        readiness: {
          ready,
          review,
          blocked,
        },
        checks,
        nextSteps: [
          'Human reviews token name, ticker, description, and visual identity.',
          'Human confirms no misleading brand, impersonation, hidden promise, or financial guarantee.',
          'Future upload step shows exact storage target and metadata JSON before upload.',
          'Only after upload exists can Mythos prepare an unsigned Pump.fun launch transaction preview.',
        ],
        blockedActions: [
          'No image or JSON metadata was uploaded.',
          'No mint address was created.',
          'No Pump.fun launch was opened.',
          'No wallet signature was requested.',
          'No first buy or fund movement happened.',
        ],
      },
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
