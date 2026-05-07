'use client';

import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

// Helius mainnet via server proxy (hides API key from browser)
function getRpcEndpoint(): string {
  if (typeof window !== 'undefined') return `${window.location.origin}/api/rpc`;
  return 'https://api.mainnet-beta.solana.com';
}

export default function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => getRpcEndpoint(), []);

  // v0.15+: pass [] to rely on Wallet Standard auto-detection (Phantom, Backpack, OKX, etc.)
  // Keep PhantomWalletAdapter + SolflareWalletAdapter as fallback for older versions
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
