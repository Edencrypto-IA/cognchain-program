import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, safeErrorMessage, validatePublicKey } from '@/lib/security';

const DEVNET_RPC = 'https://api.devnet.solana.com';
const AIRDROP_SOL = 1;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rate = checkRateLimit(ip, '/api/wallet/airdrop');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Airdrop limit exceeded. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } }
      );
    }

    const { publicKey } = await req.json();
    const safePublicKey = validatePublicKey(publicKey);
    const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');

    const connection = new Connection(DEVNET_RPC, 'confirmed');
    const wallet = new PublicKey(safePublicKey);
    const signature = await connection.requestAirdrop(wallet, AIRDROP_SOL * LAMPORTS_PER_SOL);

    const latest = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction({ signature, ...latest }, 'confirmed');

    const balance = await connection.getBalance(wallet, 'confirmed');

    return NextResponse.json({
      success: true,
      network: 'solana-devnet',
      amount: AIRDROP_SOL,
      signature,
      balance: balance / LAMPORTS_PER_SOL,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
