import type { Metadata } from 'next';
import { ForgeErrorBoundary } from '@/components/forge/forge-error-boundary';
import { ForgeWorkspace } from '@/features/forge';

export const metadata: Metadata = {
  title: 'CongChain Forge — AI Operating Workspace',
  description: 'Workspace Forge com streaming de modelo em tempo real para desenho de projetos Solana.',
};

export default function ForgePage() {
  return (
    <ForgeErrorBoundary>
      <ForgeWorkspace />
    </ForgeErrorBoundary>
  );
}
