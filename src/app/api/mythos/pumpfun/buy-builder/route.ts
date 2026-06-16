import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { PumpfunBuyUnsignedResult } from '@/lib/solana/pumpfun-unsigned-serializer';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';
import { getPumpfunBuilderConfig } from '@/lib/solana/pumpfun-builder-config';
import { buildPumpfunBuyUnsignedTransaction } from '@/lib/solana/pumpfun-unsigned-serializer';

type BuyBuilderInput = {
  createBuilderId?: unknown;
  createSignature?: unknown;
  mint?: unknown;
  walletAddress?: unknown;
  spendSol?: unknown;
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
  return Number.isFinite(parsed) ? Math.max(0, Number(parsed.toFixed(6))) : fallback;
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

function gate(
  id: string,
  label: string,
  status: 'ready' | 'review' | 'blocked',
  detail: string
) {
  return { id, label, status, detail };
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rate = checkRateLimit(ip, '/api/mythos/pumpfun/buy-builder');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Muitas preparacoes de Pump.fun buy foram solicitadas. Aguarde um pouco e tente novamente.' },
        { status: 429 }
      );
    }

    const body = await request.json() as BuyBuilderInput;
    const createBuilderId = clean(body.createBuilderId, 80);
    const createSignature = clean(body.createSignature, 120);
    const mint = clean(body.mint, 64);
    const walletAddress = clean(body.walletAddress, 64);
    const spendSol = amount(body.spendSol);
    const slippageBps = integer(body.slippageBps, 500, 50, 3000);
    const priorityFeeLamports = integer(body.priorityFeeLamports, 0, 0, 10_000_000);
    const builderConfig = getPumpfunBuilderConfig();

    const gates = [
      gate(
        'create_submitted',
        'Create submitted',
        createSignature.length >= 64 ? 'ready' : 'blocked',
        createSignature.length >= 64
          ? `Create signature ${createSignature.slice(0, 8)}...${createSignature.slice(-6)} is linked.`
          : 'Submit and confirm the create transaction before preparing buy.'
      ),
      gate(
        'mint',
        'Mint',
        isLikelySolanaAddress(mint) ? 'ready' : 'blocked',
        isLikelySolanaAddress(mint) ? 'Mint public key is valid.' : 'A valid created mint public key is required.'
      ),
      gate(
        'wallet_signer',
        'Wallet signer',
        isLikelySolanaAddress(walletAddress) ? 'ready' : 'blocked',
        isLikelySolanaAddress(walletAddress)
          ? `Buy signer must be ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}.`
          : 'A connected Phantom/Solflare public key is required.'
      ),
      gate(
        'spend',
        'Spend amount',
        spendSol > 0 && spendSol <= 1 ? 'review' : 'blocked',
        spendSol > 0 && spendSol <= 1
          ? `${spendSol} SOL buy intent requires explicit wallet signature and separate submit.`
          : 'Buy amount must be greater than 0 and capped at 1 SOL for this guarded phase.'
      ),
      gate(
        'serializer',
        'Unsigned buy serializer',
        builderConfig.transaction.unsignedBytesEnabled ? 'ready' : 'blocked',
        builderConfig.transaction.unsignedBytesEnabled
          ? 'Server-side unsigned serializer gates are enabled.'
          : 'Enable server_unsigned readiness before buy bytes can be generated.'
      ),
    ];

    const initialBlocked = gates.filter(item => item.status === 'blocked').length;
    let builderError = '';
    let unsignedBuy: PumpfunBuyUnsignedResult | null = null;
    if (initialBlocked === 0) {
      try {
        unsignedBuy = await buildPumpfunBuyUnsignedTransaction({
          mint,
          walletAddress,
          spendSol,
          slippageBps,
          priorityFeeLamports,
        }, builderConfig);
      } catch (error) {
        builderError = error instanceof Error ? error.message : 'Could not prepare Pump.fun buy transaction.';
      }
    }
    const finalGates = builderError
      ? [...gates, gate('bonding_curve_quote', 'Bonding curve quote', 'blocked', builderError)]
      : gates;
    const blocked = finalGates.filter(item => item.status === 'blocked').length;
    const review = finalGates.filter(item => item.status === 'review').length;
    const canonical = JSON.stringify({
      createBuilderId,
      createSignature,
      mint,
      walletAddress,
      spendSol,
      slippageBps,
      priorityFeeLamports,
      phase: 'pumpfun_buy_builder_v1',
    });
    const buyHash = crypto.createHash('sha256').update(canonical).digest('hex');

    return NextResponse.json({
      ok: true,
      buyBuilder: {
        id: `buy_${buyHash.slice(0, 24)}`,
        status: unsignedBuy ? 'ready_for_wallet_signature' : blocked > 0 ? 'blocked' : 'needs_review',
        createdAt: new Date().toISOString(),
        platform: 'pump.fun',
        network: 'solana-mainnet-preview',
        createBuilderId: createBuilderId || null,
        createSignature: createSignature || null,
        mint: mint || null,
        signer: {
          walletAddress: walletAddress || null,
          required: true,
        },
        quote: unsignedBuy?.quote ?? {
          spendLamports: null,
          expectedTokensOut: null,
          minTokensOut: null,
          slippageBps,
          priorityFeeLamports,
          networkFeeLamports: null,
          totalKnownLamports: null,
          caveat: 'Quote is not available until create is confirmed and bonding curve account exists.',
        },
        bondingCurve: unsignedBuy?.bondingCurve ?? null,
        transaction: {
          serializedUnsignedPayload: unsignedBuy?.serializedUnsignedPayload ?? null,
          messageBase64: unsignedBuy?.messageBase64 ?? null,
          messageVersion: unsignedBuy ? 'v0' : null,
          recentBlockhash: unsignedBuy?.recentBlockhash ?? null,
          feePayer: walletAddress || null,
          requiredSigners: unsignedBuy ? [walletAddress] : [],
          transactionHash: unsignedBuy?.transactionHash ?? null,
          wireReady: Boolean(unsignedBuy),
          reason: unsignedBuy
            ? 'Unsigned buy transaction bytes were serialized for human review. Wallet signature and submission remain separate explicit user actions.'
            : 'Buy bytes are blocked until create signature, mint, wallet signer, spend amount, and bonding curve quote are ready.',
        },
        accounts: unsignedBuy?.accounts ?? null,
        buyAudit: unsignedBuy?.audit ?? null,
        gates: finalGates,
        readiness: {
          ready: finalGates.filter(item => item.status === 'ready').length,
          review,
          blocked,
        },
        blockedActions: unsignedBuy
          ? [
            'Unsigned Pump.fun buy transaction bytes were prepared for review only.',
            'No wallet signature modal was opened by the server.',
            'No signed buy transaction was stored server-side.',
            'No buy transaction was submitted.',
          ]
          : [
            'No Pump.fun buy transaction bytes were created.',
            'No wallet signature modal was opened.',
            'No signed buy transaction was stored.',
            'No buy transaction was submitted.',
          ],
      },
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
