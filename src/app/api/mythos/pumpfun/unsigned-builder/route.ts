import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';
import { getPumpfunBuilderConfig } from '@/lib/solana/pumpfun-builder-config';
import { buildPumpfunCreateUnsignedTransaction } from '@/lib/solana/pumpfun-unsigned-serializer';

type UnsignedBuilderInput = {
  payloadAuditId?: unknown;
  payloadHash?: unknown;
  metadataUri?: unknown;
  name?: unknown;
  symbol?: unknown;
  walletAddress?: unknown;
  mintPublicKey?: unknown;
  firstBuySol?: unknown;
  slippageBps?: unknown;
  priorityFeeLamports?: unknown;
  programId?: unknown;
  feeRecipient?: unknown;
  globalAccount?: unknown;
  eventAuthority?: unknown;
  bondingCurve?: unknown;
  associatedBondingCurve?: unknown;
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
    const rate = checkRateLimit(ip, '/api/mythos/pumpfun/unsigned-builder');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Muitas preparacoes de unsigned builder foram solicitadas. Aguarde um pouco e tente novamente.' },
        { status: 429 }
      );
    }

    const body = await request.json() as UnsignedBuilderInput;
    const payloadAuditId = clean(body.payloadAuditId, 80);
    const payloadHash = clean(body.payloadHash, 80);
    const metadataUri = clean(body.metadataUri, 240);
    const name = clean(body.name, 42);
    const symbol = clean(body.symbol, 10).replace(/[^a-z0-9]/gi, '').toUpperCase();
    const walletAddress = clean(body.walletAddress, 64);
    const mintPublicKey = clean(body.mintPublicKey, 64);
    const firstBuySol = amount(body.firstBuySol);
    const slippageBps = integer(body.slippageBps, 500, 50, 3000);
    const priorityFeeLamports = integer(body.priorityFeeLamports, 0, 0, 10_000_000);
    const builderConfig = getPumpfunBuilderConfig();
    const programId = builderConfig.program.programId || clean(body.programId, 64);
    const feeRecipient = builderConfig.program.feeRecipient || clean(body.feeRecipient, 64);
    const globalAccount = builderConfig.program.globalAccount || clean(body.globalAccount, 64);
    const eventAuthority = builderConfig.program.eventAuthority || clean(body.eventAuthority, 64);
    const bondingCurve = clean(body.bondingCurve, 64);
    const associatedBondingCurve = clean(body.associatedBondingCurve, 64);

    const accountInputs = [
      ['program_id', 'Pump.fun program ID', programId],
      ['fee_recipient', 'Fee recipient', feeRecipient],
      ['global_account', 'Global account', globalAccount],
      ['event_authority', 'Event authority', eventAuthority],
      ['mint_public_key', 'Mint public key', mintPublicKey],
    ] as const;

    const accountGates = accountInputs.map(([id, label, value]) => gate(
      id,
      label,
      value && isLikelySolanaAddress(value) ? 'review' : 'blocked',
      value && isLikelySolanaAddress(value)
        ? `${label} was supplied, but must be verified against an official Pump.fun source before serialization.`
        : `${label} is not configured. Mythos will not infer or scrape this account.`
    ));

    const gates = [
      gate(
        'payload_audit',
        'Payload audit',
        payloadAuditId.startsWith('payload_') && payloadHash.length >= 32 ? 'ready' : 'blocked',
        payloadAuditId.startsWith('payload_') && payloadHash.length >= 32
          ? `Payload audit ${payloadAuditId} is linked.`
          : 'A completed Mythos payload audit is required before unsigned builder review.'
      ),
      gate(
        'metadata_uri',
        'Final metadata URI',
        isLikelyMetadataUri(metadataUri) ? 'ready' : 'blocked',
        isLikelyMetadataUri(metadataUri)
          ? 'Metadata URI is present for future transaction metadata.'
          : 'Final metadata URI must be ipfs://, ar://, or https:// and human-reviewed.'
      ),
      gate(
        'wallet_signer',
        'Wallet signer',
        isLikelySolanaAddress(walletAddress) ? 'ready' : 'blocked',
        isLikelySolanaAddress(walletAddress)
          ? `Future fee payer/signature origin must be ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}.`
          : 'A connected Phantom/Solflare public key is required.'
      ),
      gate(
        'first_buy',
        'First buy intent',
        firstBuySol > 0 ? 'blocked' : 'ready',
        firstBuySol > 0
          ? `${firstBuySol} SOL buy intent is intentionally blocked in the create serializer. Buy must be quoted and built in a separate future transaction.`
          : 'No first buy is configured, so the serializer can prepare create-only bytes when every other gate is ready.'
      ),
      gate(
        'slippage',
        'Slippage and priority fee',
        slippageBps <= 1000 && priorityFeeLamports <= 2_000_000 ? 'ready' : 'review',
        `${slippageBps / 100}% slippage and ${priorityFeeLamports} lamports priority fee must be visible before wallet signing.`
      ),
      ...accountGates,
      gate(
        'official_builder_provider',
        'Official builder provider',
        builderConfig.provider.configured ? 'ready' : 'blocked',
        builderConfig.provider.configured
          ? builderConfig.provider.reason
          : 'No official audited Pump.fun builder provider is configured server-side. Third-party transaction builders are intentionally rejected here.'
      ),
      gate(
        'fee_rent_quote',
        'Fee and rent quote',
        builderConfig.fees.quoteProviderConfigured && builderConfig.fees.rentQuoteConfigured ? 'ready' : 'blocked',
        builderConfig.fees.quoteProviderConfigured && builderConfig.fees.rentQuoteConfigured
          ? 'Fee and rent quote providers are configured, but bytes still require serializer readiness.'
          : 'Create account rent, mint costs, platform fees, and priority fee quote must be fetched from an audited path before bytes exist.'
      ),
      gate(
        'metadata_upload_provider',
        'Metadata upload provider',
        builderConfig.metadata.uploadProviderConfigured ? 'ready' : 'blocked',
        builderConfig.metadata.uploadProviderConfigured
          ? 'Server-side metadata upload provider is configured.'
          : 'A server-side upload provider must return the final metadata URI before launch bytes.'
      ),
      gate(
        'local_serializer',
        'Local serializer',
        builderConfig.transaction.localSerializerImplemented ? 'ready' : 'blocked',
        builderConfig.transaction.localSerializerImplemented
          ? 'Local VersionedTransaction serializer is reviewed and available for create-only unsigned bytes.'
          : 'Local VersionedTransaction serializer remains disabled until the official Pump.fun account contract is implemented and reviewed.'
      ),
    ];

    const ready = gates.filter(item => item.status === 'ready').length;
    const review = gates.filter(item => item.status === 'review').length;
    const blocked = gates.filter(item => item.status === 'blocked').length;
    const canonical = JSON.stringify({
      payloadAuditId,
      payloadHash,
      metadataUri,
      name,
      symbol,
      walletAddress,
      mintPublicKey,
      firstBuySol,
      slippageBps,
      priorityFeeLamports,
      programId,
      feeRecipient,
      globalAccount,
      eventAuthority,
      bondingCurve,
      associatedBondingCurve,
      phase: 'pumpfun_unsigned_builder_gate_v1',
    });
    const builderHash = crypto.createHash('sha256').update(canonical).digest('hex');
    const unsignedCreate = builderConfig.transaction.unsignedBytesEnabled && blocked === 0
      ? await buildPumpfunCreateUnsignedTransaction({
        name,
        symbol,
        metadataUri,
        walletAddress,
        mintPublicKey,
        priorityFeeLamports,
      }, builderConfig)
      : null;
    const blockedActions = unsignedCreate
      ? [
        'Unsigned Pump.fun create transaction bytes were prepared for review only.',
        'No server-side private key was generated or stored.',
        'No wallet signature modal was opened.',
        'No signed transaction was stored.',
        'No transaction was submitted.',
        'No token launch or first buy occurred.',
      ]
      : [
        'No third-party Pump.fun transaction builder was called.',
        'No Program ID or account meta was guessed.',
        'No unsigned transaction bytes were created.',
        'No wallet signature modal was opened.',
        'No signed transaction was stored.',
        'No transaction was submitted.',
        'No token launch or first buy occurred.',
      ];

    return NextResponse.json({
      ok: true,
      unsignedBuilder: {
        id: `builder_${builderHash.slice(0, 24)}`,
        status: blocked > 0 ? 'blocked' : review > 0 ? 'needs_review' : 'ready_for_audited_provider',
        createdAt: new Date().toISOString(),
        platform: 'pump.fun',
        network: 'solana-mainnet-preview',
        builderMode: 'audit_gate',
        builderHash,
        payloadAuditId: payloadAuditId || null,
        payloadHash: payloadHash || null,
        provider: {
          configured: builderConfig.provider.configured,
          source: builderConfig.provider.source,
          officialDocsVerified: builderConfig.provider.officialDocsVerified,
          reason: builderConfig.provider.reason,
        },
        token: {
          name,
          symbol,
          metadataUri: metadataUri || null,
        },
        signer: {
          walletAddress: walletAddress || null,
          required: true,
        },
        economics: {
          firstBuySol,
          slippageBps,
          priorityFeeLamports,
          feeQuoteLamports: unsignedCreate?.quote.networkFeeLamports ?? null,
          rentEstimateLamports: unsignedCreate
            ? (unsignedCreate.quote.mintRentLamports ?? 0) + (unsignedCreate.quote.tokenAccountRentLamports ?? 0)
            : null,
          totalEstimatedLamports: unsignedCreate?.quote.totalKnownLamports ?? null,
        },
        programAudit: {
          programId: unsignedCreate?.accounts.program || programId || null,
          feeRecipient: feeRecipient || null,
          globalAccount: unsignedCreate?.accounts.global || globalAccount || null,
          eventAuthority: unsignedCreate?.accounts.eventAuthority || eventAuthority || null,
          bondingCurve: unsignedCreate?.accounts.bondingCurve || bondingCurve || null,
          associatedBondingCurve: unsignedCreate?.accounts.associatedBondingCurve || associatedBondingCurve || null,
          accountSchemaVerified: builderConfig.program.accountSchemaVerified,
          instructionDiscriminatorVerified: builderConfig.program.instructionDiscriminatorVerified,
        },
        transaction: {
          serializedUnsignedPayload: unsignedCreate?.serializedUnsignedPayload ?? null,
          messageBase64: unsignedCreate?.messageBase64 ?? null,
          messageVersion: unsignedCreate ? 'v0' : null,
          recentBlockhash: unsignedCreate?.recentBlockhash ?? null,
          feePayer: walletAddress || null,
          requiredSigners: unsignedCreate?.requiredSigners ?? [],
          transactionHash: unsignedCreate?.transactionHash ?? null,
          wireReady: Boolean(unsignedCreate),
          reason: unsignedCreate
            ? 'Unsigned create transaction bytes were serialized for human review. Wallet signature and submission remain separate explicit user actions.'
            : builderConfig.transaction.unsignedBytesEnabled
              ? 'Configuration is ready, but create-only serialization still needs all request gates including mint public key and zero first buy.'
            : 'Unsigned transaction bytes are blocked until official program IDs, account metas, instruction layout, fee/rent quote, and metadata URI are audited.',
        },
        createAudit: unsignedCreate?.audit ?? null,
        configuredReadiness: {
          providerMode: builderConfig.provider.mode,
          accountSchemaVersion: builderConfig.program.accountSchemaVersion,
          instructionLayoutHashConfigured: Boolean(builderConfig.program.instructionLayoutHash),
          metadataUploadProviderConfigured: builderConfig.metadata.uploadProviderConfigured,
          unsignedBytesEnabled: builderConfig.transaction.unsignedBytesEnabled,
        },
        gates,
        readiness: {
          ready,
          review,
          blocked,
        },
        nextSteps: [
          'Pin official Pump.fun program IDs and account schema in server-side configuration.',
          'Add a metadata upload provider that returns a final immutable URI.',
          'Fetch rent, platform fee, priority fee, and slippage quote before transaction bytes are generated.',
          'Serialize an unsigned VersionedTransaction only after every gate is ready or explicitly reviewed.',
          'Open Phantom/Solflare from a separate user click and show all values before signature.',
        ],
        blockedActions,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
