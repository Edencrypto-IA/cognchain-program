'use client';

import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  TrustWalletAdapter,
  MathWalletAdapter,
  TokenPocketWalletAdapter,
} from '@solana/wallet-adapter-wallets';

// Use Helius mainnet RPC (reliable, no CORS issues)
function getRpcEndpoint(): string {
  // NEXT_PUBLIC_ vars are embedded at build time
  const pub = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (pub?.startsWith('http')) return pub;
  // Fallback to Helius mainnet via server proxy (avoids exposing API key)
  if (typeof window !== 'undefined') return `${window.location.origin}/api/rpc`;
  return 'https://api.mainnet-beta.solana.com';
}

export default function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => getRpcEndpoint(), []);

  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new CoinbaseWalletAdapter(),
    new TrustWalletAdapter(),
    new MathWalletAdapter(),
    new TokenPocketWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
