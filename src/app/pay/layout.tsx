import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CONGCHAIN Pay — Solana API Payments',
  description: 'Pay for any API in SOL. Results saved as verifiable memory on Solana.',
};

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
