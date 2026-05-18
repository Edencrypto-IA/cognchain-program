import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, safeErrorMessage, validatePublicKey } from '@/lib/security';

const DEVNET_RPC = process.env.SOLANA_DEVNET_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const AIRDROP_SOL = normalizeAirdropAmount(process.env.SOLANA_DEVNET_AIRDROP_SOL);
const DEVNET_EXPLORER_CLUSTER = 'devnet';

function normalizeAirdropAmount(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0.5;
  return Math.min(parsed, 1);
}

function describeAirdropError(error: unknown): string {
  const message = safeErrorMessage(error);
  const lower = message.toLowerCase();

  if (lower.includes('429') || lower.includes('too many') || lower.includes('rate limit')) {
    return 'Faucet da Solana Devnet limitou os airdrops agora. Tente novamente em alguns minutos ou use um RPC Devnet dedicado.';
  }

  if (lower.includes('airdrop') || lower.includes('faucet') || lower.includes('insufficient')) {
    return 'Faucet da Solana Devnet nao respondeu com SOL de teste agora. A carteira continua valida; tente novamente mais tarde.';
  }

  if (lower.includes('blockhash') || lower.includes('confirm')) {
    return 'Airdrop enviado, mas a confirmacao da Devnet nao finalizou a tempo. Confira o saldo novamente em alguns segundos.';
  }

  return message || 'Nao foi possivel solicitar airdrop Devnet agora.';
}

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
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=${DEVNET_EXPLORER_CLUSTER}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: describeAirdropError(error),
        network: 'solana-devnet',
        retryable: true,
      },
      { status: 503 },
    );
  }
}
