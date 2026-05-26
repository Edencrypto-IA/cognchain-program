/**
 * GET /api/solscan
 *
 * Server-side proxy for the Solscan Pro API. Keeps SOLSCAN_API_KEY
 * out of the browser while exposing common Solscan queries to the
 * frontend.
 *
 * Query parameters:
 *   type     Required. One of: account, portfolio, transactions,
 *            token-meta, token-holders, transaction, snapshot
 *   address  Required for account/portfolio/transactions/token-*/snapshot
 *   tx       Required for type=transaction
 *   page     Optional. Page number (default 1)
 *   pageSize Optional. Results per page (default 10)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAccountDetail,
  getAccountPortfolio,
  getAccountTransactions,
  getAccountSnapshot,
  getTokenMeta,
  getTokenHolders,
  getTransactionDetail,
  SolscanError,
} from '@/lib/solana/solscan';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

const VALID_TYPES = new Set([
  'account',
  'portfolio',
  'transactions',
  'token-meta',
  'token-holders',
  'transaction',
  'snapshot',
]);

export async function GET(request: NextRequest) {
  // Rate limiting
  const ip =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const rate = checkRateLimit(ip, '/api/solscan');
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please slow down.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type') ?? '';
  const address = searchParams.get('address') ?? '';
  const tx = searchParams.get('tx') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(
    40,
    Math.max(1, Number(searchParams.get('pageSize') ?? '10')),
  );

  // Validate type
  if (!VALID_TYPES.has(type)) {
    return NextResponse.json(
      {
        error: `Invalid type. Must be one of: ${[...VALID_TYPES].join(', ')}`,
      },
      { status: 400 },
    );
  }

  // Validate required params per type
  const needsAddress = type !== 'transaction';
  const needsTx = type === 'transaction';

  if (needsAddress && !address) {
    return NextResponse.json(
      { error: 'Missing required query parameter: address' },
      { status: 400 },
    );
  }
  if (needsTx && !tx) {
    return NextResponse.json(
      { error: 'Missing required query parameter: tx' },
      { status: 400 },
    );
  }

  try {
    switch (type) {
      case 'account': {
        const data = await getAccountDetail(address);
        return NextResponse.json(data);
      }

      case 'portfolio': {
        const data = await getAccountPortfolio(address);
        return NextResponse.json(data);
      }

      case 'transactions': {
        const data = await getAccountTransactions(address, page, pageSize);
        return NextResponse.json(data);
      }

      case 'token-meta': {
        const data = await getTokenMeta(address);
        return NextResponse.json(data);
      }

      case 'token-holders': {
        const data = await getTokenHolders(address, page, pageSize);
        return NextResponse.json(data);
      }

      case 'transaction': {
        const data = await getTransactionDetail(tx);
        return NextResponse.json(data);
      }

      case 'snapshot': {
        const data = await getAccountSnapshot(address);
        return NextResponse.json(data);
      }

      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof SolscanError) {
      // Surface Solscan-specific status codes (e.g. 401 for missing key, 404 for not found)
      const status = error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json(
      { error: safeErrorMessage(error) },
      { status: 500 },
    );
  }
}
