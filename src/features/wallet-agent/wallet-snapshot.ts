import { LAMPORTS_PER_SOL, PublicKey, type Connection } from '@solana/web3.js';
import type { WalletAgentWalletSnapshot } from './types';

const DEVNET_WALLET_STORAGE_KEY = 'congchain_devnet_wallet_v1';

type StoredDevnetWallet = {
  publicKey?: string;
  balance?: number;
};

function readStoredDevnetWallet(): StoredDevnetWallet | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(DEVNET_WALLET_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredDevnetWallet;
    if (!parsed?.publicKey) return null;

    return parsed;
  } catch {
    return null;
  }
}

export async function readWalletAgentWalletSnapshot(
  connection: Connection,
  adapterPublicKey?: PublicKey | null
): Promise<WalletAgentWalletSnapshot | null> {
  const readAt = new Date().toISOString();

  if (adapterPublicKey) {
    try {
      const lamports = await connection.getBalance(adapterPublicKey, 'confirmed');

      return {
        address: adapterPublicKey.toString(),
        network: 'solana-devnet',
        balanceSol: lamports / LAMPORTS_PER_SOL,
        source: 'wallet-adapter',
        readAt,
      };
    } catch {
      return {
        address: adapterPublicKey.toString(),
        network: 'solana-devnet',
        balanceSol: null,
        source: 'wallet-adapter',
        readAt,
      };
    }
  }

  const stored = readStoredDevnetWallet();
  if (!stored?.publicKey) return null;

  try {
    const publicKey = new PublicKey(stored.publicKey);
    const lamports = await connection.getBalance(publicKey, 'confirmed');

    return {
      address: stored.publicKey,
      network: 'solana-devnet',
      balanceSol: lamports / LAMPORTS_PER_SOL,
      source: 'devnet-sandbox',
      readAt,
    };
  } catch {
    return {
      address: stored.publicKey,
      network: 'solana-devnet',
      balanceSol: typeof stored.balance === 'number' ? stored.balance : null,
      source: 'devnet-sandbox',
      readAt,
    };
  }
}
