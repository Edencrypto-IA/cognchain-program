import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

type LaunchDraftInput = {
  name?: unknown;
  symbol?: unknown;
  description?: unknown;
  imagePrompt?: unknown;
  initialBuySol?: unknown;
  walletAddress?: unknown;
};

function asCleanString(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function asSolAmount(value: unknown) {
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
    const rate = checkRateLimit(ip, '/api/mythos/pumpfun/launch-proposal');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Muitas propostas de launch foram solicitadas. Aguarde um pouco e tente novamente.' },
        { status: 429 }
      );
    }

    const body = await request.json() as LaunchDraftInput;
    const name = asCleanString(body.name, 42);
    const symbol = asCleanString(body.symbol, 10).replace(/[^a-z0-9]/gi, '').toUpperCase();
    const description = asCleanString(body.description, 280);
    const imagePrompt = asCleanString(body.imagePrompt, 320);
    const initialBuySol = asSolAmount(body.initialBuySol);
    const walletAddress = asCleanString(body.walletAddress, 64);

    const checks = [
      {
        id: 'token_identity',
        label: 'Token identity',
        status: name.length >= 3 && symbol.length >= 2 ? 'ready' : 'review',
        detail: name.length >= 3 && symbol.length >= 2
          ? `${name} (${symbol}) is ready for human review.`
          : 'Name must have at least 3 characters and ticker at least 2 characters.',
      },
      {
        id: 'metadata',
        label: 'Metadata',
        status: description.length >= 24 && imagePrompt.length >= 18 ? 'ready' : 'review',
        detail: description.length >= 24 && imagePrompt.length >= 18
          ? 'Description and image prompt are present. No file has been uploaded.'
          : 'Description and image prompt need more detail before metadata upload.',
      },
      {
        id: 'wallet',
        label: 'Wallet',
        status: isLikelySolanaAddress(walletAddress) ? 'ready' : 'blocked',
        detail: isLikelySolanaAddress(walletAddress)
          ? `Wallet ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)} can review a future signature request.`
          : 'A valid Phantom/Solflare public address is required before a transaction can be prepared.',
      },
      {
        id: 'first_buy',
        label: 'First buy intent',
        status: initialBuySol > 0 ? 'review' : 'pending',
        detail: initialBuySol > 0
          ? `${initialBuySol} SOL first-buy intent detected. This proposal does not execute it.`
          : 'No first-buy SOL amount is set yet.',
      },
      {
        id: 'pumpfun_payload',
        label: 'Pump.fun payload',
        status: 'blocked',
        detail: 'No Pump.fun upload, mint, bonding curve transaction, buy transaction, or signed payload is created in this phase.',
      },
    ] as const;

    const blocked = checks.filter(check => check.status === 'blocked').length;
    const review = checks.filter(check => check.status === 'review' || check.status === 'pending').length;
    const ready = checks.filter(check => check.status === 'ready').length;
    const proposalStatus = blocked > 0
      ? 'blocked'
      : review > 0
        ? 'needs_review'
        : 'ready_for_future_signature';
    const canonical = JSON.stringify({
      name,
      symbol,
      description,
      imagePrompt,
      initialBuySol,
      walletAddress,
      proposalStatus,
      phase: 'pumpfun_launch_proposal_v1',
    });
    const proposalId = `pump_${crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 24)}`;

    return NextResponse.json({
      ok: true,
      proposal: {
        id: proposalId,
        status: proposalStatus,
        createdAt: new Date().toISOString(),
        network: 'solana-mainnet-preview',
        platform: 'pump.fun',
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
        firstBuy: {
          amountSol: initialBuySol,
          configured: initialBuySol > 0,
          slippageBps: null,
          priorityFeeLamports: null,
        },
        readiness: {
          ready,
          review,
          blocked,
        },
        checks,
        futureExecution: [
          'Upload reviewed image and metadata only after explicit user action.',
          'Build an unsigned Pump.fun transaction payload only after metadata exists.',
          'Show final name, ticker, mint, first buy, fees, slippage, and wallet before signature.',
          'Open Phantom/Solflare for explicit user signature.',
          'Submit only the signed payload after a separate user action.',
          'Save mint, signature, proposal ID, and receipt as CongChain memory only after review.',
        ],
        blockedActions: [
          'No token is created.',
          'No metadata is uploaded.',
          'No wallet signature is requested.',
          'No buy, sell, payment, schedule, or fund movement is executed.',
          'No private keys, seed phrases, signed payloads, or wallet secrets are stored.',
        ],
        unsignedTransaction: null,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
