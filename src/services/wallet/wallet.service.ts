// ============================================================
// Wallet Service — Phantom / Solflare detection + utilities
// Client-side only — these functions interact with browser wallets
// ============================================================

interface PhantomProvider {
  isPhantom: boolean;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>;
  signAndSendTransaction(tx: unknown): Promise<{ signature: string }>;
  publicKey?: { toString(): string };
}

type PhantomWindow = Window & { solana?: PhantomProvider };

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  balance: number | null;
}

/**
 * Check if Phantom wallet is installed
 */
export function isPhantomInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as PhantomWindow).solana?.isPhantom;
}

/**
 * Get the Phantom wallet provider
 */
export function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === 'undefined') return null;
  const provider = (window as PhantomWindow).solana;
  if (!provider?.isPhantom) return null;
  return provider;
}

/**
 * Connect to Phantom wallet
 */
export async function connectPhantom(): Promise<{ publicKey: string } | null> {
  const provider = getPhantomProvider();
  if (!provider) return null;

  try {
    const resp = await provider.connect();
    return { publicKey: resp.publicKey.toString() };
  } catch (err) {
    console.error('[Wallet] Connection failed:', err);
    return null;
  }
}

/**
 * Disconnect from Phantom wallet
 */
export async function disconnectPhantom(): Promise<void> {
  const provider = getPhantomProvider();
  if (provider) {
    await provider.disconnect();
  }
}

/**
 * Get SOL balance for a public key on devnet
 */
export async function getSolBalance(publicKey: string): Promise<number> {
  try {
    const { Connection, PublicKey } = await import('@solana/web3.js');
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const pubKey = new PublicKey(publicKey);
    const balance = await connection.getBalance(pubKey);
    return balance / 1e9; // lamports to SOL
  } catch {
    return 0;
  }
}

/**
 * Sign a message with the connected wallet
 * Returns base58 signature
 */
export async function signMessage(message: string): Promise<string | null> {
  const provider = getPhantomProvider();
  if (!provider) return null;

  try {
    const encoded = new TextEncoder().encode(message);
    const { signature } = await provider.signMessage(encoded);
    return Buffer.from(signature).toString('base64');
  } catch (err) {
    console.error('[Wallet] Sign failed:', err);
    return null;
  }
}

/**
 * Sign a transaction (for NFT minting etc.)
 */
export async function signAndSendTransaction(serializedTx: string): Promise<string | null> {
  const provider = getPhantomProvider();
  if (!provider) return null;

  try {
    const { Transaction } = await import('@solana/web3.js');
    const txBuf = Buffer.from(serializedTx, 'base64');
    const tx = Transaction.from(txBuf);
    const { signature } = await provider.signAndSendTransaction(tx);
    return signature;
  } catch (err) {
    console.error('[Wallet] signAndSend failed:', err);
    return null;
  }
}

/**
 * Truncate public key for display: 7XsK1...9fQ2
 */
export function truncateAddress(address: string): string {
  if (address.length <= 11) return address;
  return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
}

/**
 * Deep link to install Phantom
 */
export const PHANTOM_INSTALL_URL = 'https://phantom.app/download';
