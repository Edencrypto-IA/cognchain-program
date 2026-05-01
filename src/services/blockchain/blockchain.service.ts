import {
  Connection, Keypair, PublicKey,
  Transaction, TransactionInstruction,
} from '@solana/web3.js';
import { nowTimestamp } from '../memory/hash.utils';
import { CONGCHAIN_PROGRAM_ID } from './congchain.idl';

const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(CONGCHAIN_PROGRAM_ID);

// Discriminators: sha256("global:<ix_name>")[0..8]
const DISC_STORE  = Buffer.from([168, 103,  88, 240,  93, 185,  30, 235]);
const DISC_VERIFY = Buffer.from([ 56, 168,  84, 188, 107, 226,  32, 127]);

export interface BlockchainResult {
  success: boolean;
  txHash: string | null;
  network: string;
  timestamp: number;
  message: string;
  explorerUrl?: string;
  simulated?: boolean;
}

function loadServerKeypair(): Keypair {
  const key = process.env.SOLANA_PRIVATE_KEY;
  if (!key) throw new Error('SOLANA_PRIVATE_KEY not set in .env');
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(key)));
}

function hexToBytes(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

function getMemoryPDA(hashBytes: Buffer): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('memory'), hashBytes],
    PROGRAM_ID
  );
  return pda;
}

// Encode storeMemory args in Borsh layout: [hash: [u8;32]] + [model: string]
function encodeStoreMemory(hashBytes: Buffer, model: string): Buffer {
  const modelBuf  = Buffer.from(model, 'utf8');
  const lenBuf    = Buffer.alloc(4);
  lenBuf.writeUInt32LE(modelBuf.length, 0);
  return Buffer.concat([DISC_STORE, hashBytes, lenBuf, modelBuf]);
}

export async function storeOnSolana(memoryHash: string): Promise<BlockchainResult> {
  try {
    const payer     = loadServerKeypair();
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const hashBytes = hexToBytes(memoryHash);
    const memoryPDA = getMemoryPDA(hashBytes);

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: memoryPDA,           isSigner: false, isWritable: true  },
        { pubkey: payer.publicKey,     isSigner: true,  isWritable: true  },
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
      ],
      data: encodeStoreMemory(hashBytes, 'congchain'),
    });

    const tx = new Transaction().add(ix);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;
    tx.sign(payer);

    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

    const { verifyMemory: dbVerify } = await import('../memory/memory.service');
    await dbVerify(memoryHash).catch(() => {});

    return {
      success: true,
      txHash: sig,
      network: 'solana-devnet',
      timestamp: nowTimestamp(),
      message: `Hash "${memoryHash.slice(0, 16)}..." armazenado on-chain ✓`,
      explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
      simulated: false,
    };
  } catch (error) {
    console.error('[Blockchain] storeOnSolana failed:', error);
    return {
      success: false,
      txHash: null,
      network: 'solana-devnet',
      timestamp: nowTimestamp(),
      message: 'Falha ao armazenar on-chain. Memória salva localmente.',
      simulated: false,
    };
  }
}

export async function verifyOnChain(memoryHash: string): Promise<BlockchainResult> {
  try {
    const payer      = loadServerKeypair();
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const hashBytes  = hexToBytes(memoryHash);
    const memoryPDA  = getMemoryPDA(hashBytes);

    // Fetch PDA — if account exists, hash is on-chain
    const accountInfo = await connection.getAccountInfo(memoryPDA);
    if (!accountInfo) {
      return {
        success: false,
        txHash: null,
        network: 'solana-devnet',
        timestamp: nowTimestamp(),
        message: 'Hash não encontrado on-chain.',
        simulated: false,
      };
    }

    // Send verify instruction to record the check on-chain
    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: memoryPDA, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([DISC_VERIFY, hashBytes]),
    });

    const tx = new Transaction().add(ix);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;
    tx.sign(payer);

    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

    return {
      success: true,
      txHash: sig,
      network: 'solana-devnet',
      timestamp: nowTimestamp(),
      message: `Hash "${memoryHash.slice(0, 16)}..." verificado on-chain ✓`,
      explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
      simulated: false,
    };
  } catch (error) {
    console.error('[Blockchain] verifyOnChain failed:', error);
    return {
      success: false,
      txHash: null,
      network: 'solana-devnet',
      timestamp: nowTimestamp(),
      message: 'Verificação falhou. Rede indisponível.',
      simulated: false,
    };
  }
}
