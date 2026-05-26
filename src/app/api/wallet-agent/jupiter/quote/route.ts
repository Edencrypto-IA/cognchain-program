import { NextRequest, NextResponse } from 'next/server';
import { getJupiterQuote, JUPITER_KNOWN_TOKENS } from '@/lib/solana/jupiter';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

function getIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(getIp(request), '/api/wallet-agent/jupiter/quote');
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please slow down.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  try {
    const body = await request.json();
    const inputSymbol = String(body.inputSymbol || '').toUpperCase();
    const outputSymbol = String(body.outputSymbol || '').toUpperCase();
    const amountUi = Number(body.amountUi);
    const slippageBps = body.slippageBps === undefined ? undefined : Number(body.slippageBps);

    if (!JUPITER_KNOWN_TOKENS[inputSymbol] || !JUPITER_KNOWN_TOKENS[outputSymbol]) {
      return NextResponse.json(
        {
          error: 'Unsupported token for this safe quote phase.',
          supportedTokens: Object.keys(JUPITER_KNOWN_TOKENS),
        },
        { status: 400 }
      );
    }

    if (inputSymbol === outputSymbol) {
      return NextResponse.json({ error: 'Input and output token must be different.' }, { status: 400 });
    }

    if (!Number.isFinite(amountUi) || amountUi <= 0) {
      return NextResponse.json({ error: 'amountUi must be a positive number.' }, { status: 400 });
    }

    const quote = await getJupiterQuote({ inputSymbol, outputSymbol, amountUi, slippageBps });

    return NextResponse.json({
      ok: true,
      quote,
      safety: {
        readOnlyQuote: true,
        transactionPayloadCreated: false,
        walletSignatureRequested: false,
        submittedToSolana: false,
        canMoveFunds: false,
        note: 'This endpoint fetches a Jupiter quote only. It never creates a swap transaction, requests a wallet signature, or submits to Solana.',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
