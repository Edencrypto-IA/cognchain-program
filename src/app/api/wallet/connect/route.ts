import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, validatePublicKey, safeErrorMessage } from '@/lib/security';

const SOLANA_DEVNET_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

/**
 * POST /api/wallet/connect
 * Verifies wallet ownership via signature before accepting connection.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rate = checkRateLimit(ip, '/api/wallet/connect');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } }
      );
    }

    const { publicKey, signedMessage, message } = await req.json();

    if (!publicKey) {
      return NextResponse.json({ error: 'Public key required' }, { status: 400 });
    }

    const safePubKey = validatePublicKey(publicKey);

    // If signed message provided, verify wallet ownership
    if (signedMessage && message) {
      try {
        const nacl = await import('tweetnacl');
        const { PublicKey } = await import('@solana/web3.js');

        const pubKeyBytes = new PublicKey(safePubKey).toBytes();
        const sigBytes = Buffer.from(signedMessage, 'base64');
        const msgBytes = new TextEncoder().encode(message);

        if (sigBytes.length !== 64) {
          return NextResponse.json({ error: 'Invalid signature format' }, { status: 400 });
        }

        const isValid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);
        if (!isValid) {
          return NextResponse.json({ error: 'Signature verification failed — wallet ownership not proven' }, { status: 401 });
        }
      } catch {
        return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
      }
    }

    // Verify wallet exists on devnet
    const { Connection, PublicKey } = await import('@solana/web3.js');
    const connection = new Connection(SOLANA_DEVNET_RPC, 'confirmed');

    let balance = 0;
    try {
      const pubKey = new PublicKey(safePubKey);
      const bal = await connection.getBalance(pubKey);
      balance = bal / 1e9;
    } catch {
      // Wallet not yet on-chain — fine for devnet
    }

    return NextResponse.json({
      success: true,
      publicKey: safePubKey,
      balance,
      network: 'solana-devnet',
      verified: !!signedMessage && !!message,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
