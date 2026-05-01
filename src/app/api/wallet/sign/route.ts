import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, validatePublicKey, safeErrorMessage } from '@/lib/security';

/**
 * POST /api/wallet/sign
 * Verify a signed message from the wallet.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rate = checkRateLimit(ip, '/api/wallet/sign');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } }
      );
    }

    const { publicKey, message, signature } = await req.json();

    if (!publicKey || !message || !signature) {
      return NextResponse.json({ error: 'Missing fields: publicKey, message, and signature are required' }, { status: 400 });
    }

    const safePubKey = validatePublicKey(publicKey);

    // Validate message and signature inputs
    if (typeof message !== 'string' || message.length === 0 || message.length > 1000) {
      return NextResponse.json({ error: 'Message must be a non-empty string (max 1000 chars)' }, { status: 400 });
    }
    if (typeof signature !== 'string' || signature.length === 0) {
      return NextResponse.json({ error: 'Signature is required' }, { status: 400 });
    }

    // Validate base64 format
    const sigBuffer = Buffer.from(signature, 'base64');
    if (sigBuffer.length !== 64) {
      return NextResponse.json({ error: 'Invalid signature length — must be 64 bytes (Ed25519)' }, { status: 400 });
    }

    const nacl = await import('tweetnacl');
    const { PublicKey } = await import('@solana/web3.js');

    const pubKeyBytes = new PublicKey(safePubKey).toBytes();
    const sigBytes = Buffer.from(signature, 'base64');
    const msgBytes = new TextEncoder().encode(message);

    const isValid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);

    return NextResponse.json({
      success: true,
      verified: isValid,
      message: isValid ? 'Signature verified' : 'Invalid signature — wallet ownership not proven',
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
