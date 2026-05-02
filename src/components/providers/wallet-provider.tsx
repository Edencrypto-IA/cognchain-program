'use client';

// Wallet adapter CSS — imported at runtime to avoid Turbopack NftJsonAsset build error
import '@solana/wallet-adapter-react-ui/styles.css';

import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
} from '@solana/wallet-adapter-wallets';

// Resolve proxy URL to absolute — ConnectionProvider requires a full URL
function getRpcEndpoint(): string {
  const raw = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || '/api/rpc';
  if (raw.startsWith('http')) return raw;
  if (typeof window !== 'undefined') return `${window.location.origin}${raw}`;
  return `http://localhost:3000${raw}`;
}

export default function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => getRpcEndpoint(), []);

  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new CoinbaseWalletAdapter(),
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
