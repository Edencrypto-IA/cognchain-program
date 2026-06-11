import type { ForgeAgent, ForgeBuildStep, ForgeFile, ForgeMemoryNode, ForgeTerminalLine } from './types';

export const FORGE_STORAGE_KEY = 'congchain_forge_session_v1';

export const forgeAgents: ForgeAgent[] = [
  {
    id: 'architect',
    name: 'Architect Agent',
    role: 'System design',
    accent: '#9945FF',
    status: 'idle',
    progress: 14,
    currentTask: 'Mapping project intent',
    logs: ['Waiting for a build prompt'],
  },
  {
    id: 'solana',
    name: 'Solana Agent',
    role: 'Programs and proofs',
    accent: '#14F195',
    status: 'idle',
    progress: 8,
    currentTask: 'Monitoring devnet patterns',
    logs: ['Proof layer on standby'],
  },
  {
    id: 'backend',
    name: 'Backend Agent',
    role: 'APIs and data',
    accent: '#38BDF8',
    status: 'idle',
    progress: 12,
    currentTask: 'Preparing service graph',
    logs: ['API sandbox initialized'],
  },
  {
    id: 'ui',
    name: 'UI Agent',
    role: 'Interface craft',
    accent: '#C084FC',
    status: 'idle',
    progress: 18,
    currentTask: 'Calibrating design system',
    logs: ['Visual language loaded'],
  },
  {
    id: 'security',
    name: 'Security Agent',
    role: 'Risk and audit',
    accent: '#F59E0B',
    status: 'idle',
    progress: 10,
    currentTask: 'Watching permissions',
    logs: ['Threat model ready'],
  },
];

export const initialTerminalLines: ForgeTerminalLine[] = [
  {
    id: 'boot-1',
    kind: 'system',
    source: 'Forge Kernel',
    text: 'CongChain Forge sandbox online. No production systems attached.',
    timestamp: 'now',
  },
  {
    id: 'boot-2',
    kind: 'shell',
    source: 'forge.os',
    text: 'agent mesh: architect, solana, backend, ui, security',
    timestamp: 'now',
  },
  {
    id: 'boot-3',
    kind: 'success',
    source: 'Memory Core',
    text: 'Session memory visualization ready for simulated build context.',
    timestamp: 'now',
  },
];

export const initialFiles: ForgeFile[] = [
  {
    path: 'app/page.tsx',
    language: 'tsx',
    status: 'queued',
    contents: `export default function App() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-sm text-emerald-300">PrivatePay on Solana</p>
        <h1 className="mt-4 text-5xl font-semibold">Private payments with verifiable receipts.</h1>
      </section>
    </main>
  );
}
`,
  },
  {
    path: 'components/private-payment-card.tsx',
    language: 'tsx',
    status: 'queued',
    contents: `export function PrivatePaymentCard() {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <p className="text-sm text-white/40">Encrypted transfer</p>
      <h2 className="mt-2 text-2xl font-semibold">Send SOL privately</h2>
    </section>
  );
}
`,
  },
  {
    path: 'lib/private-payment-intent.ts',
    language: 'ts',
    status: 'queued',
    contents: `export type PrivatePaymentIntent = {
  recipient: string;
  amountSol: number;
  memoHash: string;
};

export function createPrivatePaymentIntent(intent: PrivatePaymentIntent) {
  return {
    ...intent,
    network: 'solana-devnet',
    privacy: 'zk-receipt-ready',
  };
}
`,
  },
  {
    path: 'solana/private-payment-proof.ts',
    language: 'ts',
    status: 'queued',
    contents: `export function derivePrivateReceiptProof(paymentHash: string) {
  return {
    network: 'solana-devnet',
    paymentHash,
    proof: 'simulated-private-payment-proof',
  };
}
`,
  },
];

export const initialBuildSteps: ForgeBuildStep[] = [
  { id: 'intent', label: 'Parse product intent', status: 'pending', detail: 'Waiting for a user build request.', result: 'No intent captured yet.' },
  { id: 'plan', label: 'Coordinate agent plan', status: 'pending', detail: 'Architect, UI, backend, Solana, and security agents will coordinate.', result: 'No plan emitted yet.' },
  { id: 'files', label: 'Generate files', status: 'pending', detail: 'Generated files stay in Forge until reviewed.', result: 'No files generated yet.' },
  { id: 'verify', label: 'Run simulated checks', status: 'pending', detail: 'Safe checks can run without wallet signing or fund movement.', result: 'No checks run yet.' },
  { id: 'deploy', label: 'Prepare deploy capsule', status: 'pending', detail: 'Deployment is a capsule summary only until explicitly connected.', result: 'No deploy capsule prepared.' },
];

export const initialMemoryNodes: ForgeMemoryNode[] = [
  { id: 'm1', label: 'Prompt Intent', detail: 'No prompt submitted yet', confidence: 42 },
  { id: 'm2', label: 'Architecture Trace', detail: 'Awaiting agent plan', confidence: 36 },
  { id: 'm3', label: 'Proof Context', detail: 'Solana layer idle', confidence: 31 },
];

export const suggestedPrompts = [
  'Build a premium private payments page on Solana with encrypted receipts and ZK proof status',
  'Create an agent marketplace landing app with wallet-aware onboarding',
  'Generate a private memory vault interface with ZK proof status',
];

/** Default PrivatePay visual demo prompt (same as first suggested prompt). */
export const PRIVATE_PAY_DEMO_PROMPT = suggestedPrompts[0];
