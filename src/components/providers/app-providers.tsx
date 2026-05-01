'use client';

import dynamic from 'next/dynamic';

// Wallet adapter usa APIs do browser — carrega apenas no client
const SolanaWalletProvider = dynamic(
  () => import('./wallet-provider'),
  { ssr: false }
);

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SolanaWalletProvider>
      {children}
    </SolanaWalletProvider>
  );
}
