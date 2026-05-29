import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

type PayloadAuditInput = {
  unsignedPreviewId?: unknown;
  proposalId?: unknown;
  metadataReviewId?: unknown;
  metadataHash?: unknown;
  metadataUri?: unknown;
  name?: unknown;
  symbol?: unknown;
  walletAddress?: unknown;
  firstBuySol?: unknown;
  slippageBps?: unknown;
  priorityFeeLamports?: unknown;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function amount(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.replace(',', '.'))
      : fallback;
  return Number.isFinite(parsed) ? Math.max(0, Number(parsed.toFixed(4))) : fallback;
}

function integer(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function isLikelySolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function isLikelyMetadataUri(value: string) {
  return /^(ipfs:\/\/|ar:\/\/|https:\/\/)/i.test(value) && value.length <= 240;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rate = checkRateLimit(ip, '/api/mythos/pumpfun/payload-audit');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Muitas auditorias de payload foram solicitadas. Aguarde um pouco e tente novamente.' },
        { status: 429 }
      );
    }

    const body = await request.json() as PayloadAuditInput;
    const unsignedPreviewId = clean(body.unsignedPreviewId, 80);
    const proposalId = clean(body.proposalId, 80);
    const metadataReviewId = clean(body.metadataReviewId, 80);
    const metadataHash = clean(body.metadataHash, 80);
    const metadataUri = clean(body.metadataUri, 240);
    const name = clean(body.name, 42);
    const symbol = clean(body.symbol, 10).replace(/[^a-z0-9]/gi, '').toUpperCase();
    const walletAddress = clean(body.walletAddress, 64);
    const firstBuySol = amount(body.firstBuySol);
    const slippageBps = integer(body.slippageBps, 500, 50, 3000);
    const priorityFeeLamports = integer(body.priorityFeeLamports, 0, 0, 10_000_000);

    const gates = [
      {
        id: 'unsigned_preview',
        label: 'Unsigned preview',
        status: unsignedPreviewId.startsWith('utx_') ? 'ready' : 'blocked',
        detail: unsignedPreviewId.startsWith('utx_')
          ? `Preview ${unsignedPreviewId} is linked.`
          : 'An unsigned transaction preview must exist before payload audit.',
      },
      {
        id: 'metadata_uri',
        label: 'Metadata URI',
        status: isLikelyMetadataUri(metadataUri) ? 'ready' : 'blocked',
        detail: isLikelyMetadataUri(metadataUri)
          ? 'Metadata URI shape is acceptable for review. Mythos did not upload it.'
          : 'Provide an reviewed ipfs://, ar://, or https:// metadata URI before transaction serialization.',
      },
      {
        id: 'wallet',
        label: 'Wallet signer',
        status: isLikelySolanaAddress(walletAddress) ? 'ready' : 'blocked',
        detail: isLikelySolanaAddress(walletAddress)
          ? `Future signer must match ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}.`
          : 'A valid Phantom/Solflare public address is required.',
      },
      {
        id: 'slippage',
        label: 'Slippage',
        status: slippageBps <= 1000 ? 'ready' : 'review',
        detail: `${slippageBps / 100}% slippage is configured for future review.`,
      },
      {
        id: 'priority_fee',
        label: 'Priority fee',
        status: priorityFeeLamports <= 2_000_000 ? 'ready' : 'review',
        detail: `${priorityFeeLamports} lamports priority fee is configured for future review.`,
      },
      {
        id: 'program_payload',
        label: 'Pump.fun program payload',
        status: 'blocked',
        detail: 'Program IDs, account metas, curve accounts, fee recipients, and serialized instruction bytes are not generated in this phase.',
      },
      {
        id: 'wallet_signature',
        label: 'Wallet signature',
        status: 'blocked',
        detail: 'No Phantom/Solflare signature request is opened.',
      },
    ] as const;

    const blocked = gates.filter(gate => gate.status === 'blocked').length;
    const review = gates.filter(gate => gate.status === 'review').length;
    const ready = gates.filter(gate => gate.status === 'ready').length;
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify({
      unsignedPreviewId,
      proposalId,
      metadataReviewId,
      metadataHash,
      metadataUri,
      name,
      symbol,
      walletAddress,
      firstBuySol,
      slippageBps,
      priorityFeeLamports,
      phase: 'pumpfun_payload_audit_v1',
    })).digest('hex');

    return NextResponse.json({
      ok: true,
      payloadAudit: {
        id: `payload_${payloadHash.slice(0, 24)}`,
        status: blocked > 0 ? 'blocked' : review > 0 ? 'needs_review' : 'ready_for_payload_builder',
        createdAt: new Date().toISOString(),
        platform: 'pump.fun',
        network: 'solana-mainnet-preview',
        payloadHash,
        unsignedPreviewId: unsignedPreviewId || null,
        proposalId: proposalId || null,
        metadataReviewId: metadataReviewId || null,
        token: {
          name,
          symbol,
          metadataHash: metadataHash || null,
          metadataUri: metadataUri || null,
        },
        signer: {
          walletAddress: walletAddress || null,
          required: true,
        },
        economics: {
          firstBuySol,
          slippageBps,
          slippageLabel: `${slippageBps / 100}%`,
          priorityFeeLamports,
          feeQuoteLamports: null,
          rentEstimateLamports: null,
        },
        instructionAudit: [
          {
            label: 'Metadata account / URI',
            status: isLikelyMetadataUri(metadataUri) ? 'ready' : 'blocked',
            detail: metadataUri || 'No metadata URI supplied.',
          },
          {
            label: 'Create/mint authority',
            status: isLikelySolanaAddress(walletAddress) ? 'ready' : 'blocked',
            detail: 'Future payload must make the connected wallet the visible signer.',
          },
          {
            label: 'Bonding curve accounts',
            status: 'blocked',
            detail: 'Not derived here. Requires audited Pump.fun SDK/program integration.',
          },
          {
            label: 'First buy instruction',
            status: firstBuySol > 0 ? 'review' : 'pending',
            detail: firstBuySol > 0
              ? `${firstBuySol} SOL intent must be displayed in Phantom/Solflare before signature.`
              : 'No first buy requested.',
          },
          {
            label: 'Serialized transaction',
            status: 'blocked',
            detail: 'No transaction bytes were created.',
          },
        ],
        serializedUnsignedPayload: null,
        walletSignatureRequest: null,
        submission: null,
        gates,
        readiness: {
          ready,
          review,
          blocked,
        },
        nextSteps: [
          'Audit official Pump.fun payload construction path and program/account requirements.',
          'Add fee quote and rent estimate before any wallet prompt.',
          'Serialize unsigned transaction only after metadata URI, wallet signer, slippage, and fees are visible.',
          'Open Phantom/Solflare only from a separate explicit user action.',
          'Submit only after signature and a second explicit user action.',
        ],
        blockedActions: [
          'No Pump.fun SDK/API call was made.',
          'No account metas or instruction bytes were generated.',
          'No unsigned transaction payload was serialized.',
          'No wallet signature was requested.',
          'No signed payload was stored.',
          'No transaction was submitted.',
          'No SOL or token movement occurred.',
        ],
      },
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
