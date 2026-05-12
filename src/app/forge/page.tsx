import type { Metadata } from 'next';
import { ForgeErrorBoundary } from '@/components/forge/forge-error-boundary';
import { ForgeWorkspace } from '@/features/forge';

export const metadata: Metadata = {
  title: 'CongChain Forge — AI Operating Workspace',
  description: 'A sandboxed cinematic AI agent workspace for simulated software generation.',
};

export default function ForgePage() {
  return (
    <ForgeErrorBoundary>
      <ForgeWorkspace />
    </ForgeErrorBoundary>
  );
}
