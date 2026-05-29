import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

type UnsignedPreviewInput = {
  proposalId?: unknown;
  metadataReviewId?: unknown;
  metadataHash?: unknown;
  name?: unknown;
  symbol?: unknown;
  walletAddress?: unknown;
  initialBuySol?: unknown;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function solAmount(value: unknown) {
  const amount = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.replace(',', '.'))
      : 0;
  return Number.isFinite(amount) ? Math.max(0, Number(amount.toFixed(4))) : 0;
}

function isLikelySolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rate = checkRateLimit(ip, '/api/mythos/pumpfun/unsigned-preview');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Muitas prévias de transação foram solicitadas. Aguarde um pouco e tente novamente.' },
        { status: 429 }
      );
    }

    const body = await request.json() as UnsignedPreviewInput;
    const proposalId = clean(body.proposalId, 80);
    const metadataReviewId = clean(body.metadataReviewId, 80);
    const metadataHash = clean(body.metadataHash, 80);
    const name = clean(body.name, 42);
    const symbol = clean(body.symbol, 10).replace(/[^a-z0-9]/gi, '').toUpperCase();
    const walletAddress = clean(body.walletAddress, 64);
    const initialBuySol = solAmount(body.initialBuySol);

    const gates = [
      {
        id: 'proposal',
        label: 'Proposal packet',
        status: proposalId.startsWith('pump_') ? 'ready' : 'blocked',
        detail: proposalId.startsWith('pump_')
          ? `Proposal ${proposalId} is present.`
          : 'A reviewed Pump.fun proposal is required before transaction preview.',
      },
      {
        id: 'metadata',
        label: 'Metadata review',
        status: metadataReviewId.startsWith('meta_') && metadataHash.length >= 32 ? 'ready' : 'blocked',
        detail: metadataReviewId.startsWith('meta_') && metadataHash.length >= 32
          ? `Metadata review ${metadataReviewId} is linked.`
          : 'Metadata must be reviewed first. Upload URI is still intentionally missing in this phase.',
      },
      {
        id: 'wallet',
        label: 'Wallet origin',
        status: isLikelySolanaAddress(walletAddress) ? 'ready' : 'blocked',
        detail: isLikelySolanaAddress(walletAddress)
          ? `Future signer must be ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}.`
          : 'A valid connected wallet public address is required.',
      },
      {
        id: 'first_buy',
        label: 'First buy intent',
        status: initialBuySol > 0 ? 'review' : 'pending',
        detail: initialBuySol > 0
          ? `${initialBuySol} SOL first-buy intent will require explicit wallet review later.`
          : 'No first-buy amount is configured. Launch-only preview remains safer.',
      },
      {
        id: 'signature',
        label: 'Wallet signature',
        status: 'blocked',
        detail: 'No Phantom/Solflare signature request is opened by this endpoint.',
      },
      {
        id: 'submission',
        label: 'Network submission',
        status: 'blocked',
        detail: 'No transaction is submitted to Solana and no Pump.fun action is executed.',
      },
    ] as const;

    const blocked = gates.filter(gate => gate.status === 'blocked').length;
    const review = gates.filter(gate => gate.status === 'review' || gate.status === 'pending').length;
    const ready = gates.filter(gate => gate.status === 'ready').length;
    const canonical = JSON.stringify({
      proposalId,
      metadataReviewId,
      metadataHash,
      name,
      symbol,
      walletAddress,
      initialBuySol,
      phase: 'pumpfun_unsigned_preview_v1',
    });
    const previewHash = crypto.createHash('sha256').update(canonical).digest('hex');

    return NextResponse.json({
      ok: true,
      unsignedPreview: {
        id: `utx_${previewHash.slice(0, 24)}`,
        proposalId: proposalId || null,
        metadataReviewId: metadataReviewId || null,
        status: blocked > 0 ? 'blocked' : review > 0 ? 'needs_review' : 'ready_for_wallet_signature_phase',
        createdAt: new Date().toISOString(),
        network: 'solana-mainnet-preview',
        platform: 'pump.fun',
        previewHash,
        signer: {
          walletAddress: walletAddress || null,
          required: true,
          connected: isLikelySolanaAddress(walletAddress),
        },
        token: {
          name,
          symbol,
          metadataHash: metadataHash || null,
        },
        firstBuy: {
          amountSol: initialBuySol,
          configured: initialBuySol > 0,
        },
        instructionPlan: [
          'Create mint account on Solana mainnet only after future wallet approval.',
          'Create Pump.fun bonding curve launch instruction only after reviewed metadata upload URI exists.',
          initialBuySol > 0
            ? `Prepare optional first-buy instruction for ${initialBuySol} SOL after explicit user confirmation.`
            : 'Skip first-buy instruction unless the user explicitly adds an amount.',
          'Present fees, slippage, priority fee, mint, metadata URI, and wallet signer before opening Phantom/Solflare.',
        ],
        transaction: {
          serializedUnsignedPayload: null,
          wireReady: false,
          reason: 'Metadata upload URI, Pump.fun program payload, fee quote, and final wallet signature UX must be audited before a real unsigned transaction is serialized.',
        },
        readiness: {
          ready,
          review,
          blocked,
        },
        gates,
        blockedActions: [
          'No mint account is created.',
          'No Pump.fun transaction is serialized.',
          'No wallet signature modal is opened.',
          'No signed transaction is stored.',
          'No transaction is submitted.',
          'No token buy or fund movement occurs.',
        ],
      },
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
