import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';
import { getPumpfunBuilderConfig } from '@/lib/solana/pumpfun-builder-config';

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rate = checkRateLimit(ip, '/api/mythos/pumpfun/builder-readiness');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Muitas consultas de readiness Pump.fun foram solicitadas. Aguarde um pouco e tente novamente.' },
        { status: 429 }
      );
    }

    const config = getPumpfunBuilderConfig();
    const ready = config.gates.filter(gate => gate.status === 'ready').length;
    const review = config.gates.filter(gate => gate.status === 'review').length;
    const blocked = config.gates.filter(gate => gate.status === 'blocked').length;

    return NextResponse.json({
      ok: true,
      readiness: {
        status: config.transaction.unsignedBytesEnabled
          ? 'ready_for_unsigned_bytes'
          : blocked > 0
            ? 'blocked'
            : 'needs_review',
        provider: config.provider,
        program: {
          programIdConfigured: Boolean(config.program.programId),
          feeRecipientConfigured: Boolean(config.program.feeRecipient),
          globalAccountConfigured: Boolean(config.program.globalAccount),
          eventAuthorityConfigured: Boolean(config.program.eventAuthority),
          accountSchemaVersion: config.program.accountSchemaVersion,
          instructionLayoutHashConfigured: Boolean(config.program.instructionLayoutHash),
          accountSchemaVerified: config.program.accountSchemaVerified,
          instructionDiscriminatorVerified: config.program.instructionDiscriminatorVerified,
        },
        fees: config.fees,
        metadata: config.metadata,
        transaction: config.transaction,
        gates: config.gates,
        counts: { ready, review, blocked },
        safety: {
          canCreateUnsignedBytes: config.transaction.unsignedBytesEnabled,
          canOpenWalletSignature: false,
          canSubmitTransaction: false,
          canMoveFunds: false,
          note: 'Readiness is metadata-only. Signature and submission remain separate explicit user actions.',
        },
      },
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
