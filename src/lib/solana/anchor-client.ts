/**
 * CognChain — Anchor Client
 * Anchors verified responses on-chain via the CognChain Anchor program.
 */

import type { StructuredResponse } from '@/lib/grounding/types';
import { sha256 } from '@/lib/utils/hash';

const PROGRAM_ID = 'BgrtrSJ53Uhp69sS8JfD414M1kujdR5ruhHc9wRbhiEL';
const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

export interface AnchorWallet {
  publicKey: { toBytes(): Uint8Array; toString(): string };
  signTransaction<T>(tx: T): Promise<T>;
  signAllTransactions<T>(txs: T[]): Promise<T[]>;
}

export interface AnchorResult {
  success: boolean;
  signature?: string;
  error?: string;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Anchor a StructuredResponse on-chain via the CognChain program.
 * Returns { success: false } gracefully if wallet is not connected or RPC fails.
 */
export async function anchorResponse(
  data: StructuredResponse,
  wallet?: AnchorWallet,
): Promise<AnchorResult> {
  if (!wallet) {
    console.warn('[AnchorClient] wallet not connected — skipping on-chain anchor');
    return { success: false, error: 'wallet_not_connected' };
  }

  try {
    const { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } =
      await import('@solana/web3.js');

    const connection = new Connection(RPC_URL, 'confirmed');
    const programId = new PublicKey(PROGRAM_ID);
    const userPubkey = new PublicKey(wallet.publicKey.toString());

    // SHA-256 of the full response JSON
    const contentHash = hexToBytes(sha256(JSON.stringify(data)));
    const confidenceBps = Math.round(data.meta.avgConfidence * 100);
    const importanceBps = 9000;

    // Derive PDAs
    const [vaultPda] = await PublicKey.findProgramAddress(
      [Buffer.from('vault'), userPubkey.toBuffer()],
      programId,
    );
    const memoryId = Buffer.alloc(8);
    memoryId.writeBigUInt64LE(BigInt(Date.now()));

    const [memoryPda] = await PublicKey.findProgramAddress(
      [Buffer.from('memory'), vaultPda.toBuffer(), memoryId],
      programId,
    );

    // Encode instruction data: [discriminator(8)] + [contentHash(32)] + [confidenceBps(2)] + [importanceBps(2)]
    const discriminator = Buffer.from([0xd4, 0x3f, 0x8b, 0x1c, 0x2a, 0xe7, 0x90, 0x5f]);
    const confBytes = Buffer.alloc(2); confBytes.writeUInt16LE(confidenceBps);
    const impBytes = Buffer.alloc(2); impBytes.writeUInt16LE(importanceBps);
    const data_ = Buffer.concat([discriminator, Buffer.from(contentHash), confBytes, impBytes]);

    const ix = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: memoryPda, isSigner: false, isWritable: true },
        { pubkey: userPubkey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: data_,
    });

    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: userPubkey });
    tx.add(ix);

    const signed = await wallet.signTransaction(tx);
    const raw = signed.serialize();
    const signature = await connection.sendRawTransaction(raw, { skipPreflight: false });
    await connection.confirmTransaction(signature, 'confirmed');

    console.info(`[AnchorClient] anchored — sig: ${signature}`);
    return { success: true, signature };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AnchorClient] failed:', msg);
    return { success: false, error: msg };
  }
}

/*
Usage example:

import { anchorResponse } from '@/lib/solana/anchor-client';

const result = await anchorResponse(structuredResponse, connectedWallet);
if (result.success) {
  console.log('On-chain sig:', result.signature);
  // → 'On-chain sig: 4xK7...mQ2p'
}
*/
