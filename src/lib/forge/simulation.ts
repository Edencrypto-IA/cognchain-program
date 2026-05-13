import type { ForgeAgentId, ForgeBuildStep, ForgeFile, ForgeMemoryNode, ForgeTerminalLine } from './types';

export interface ForgeSimulationEvent {
  delay: number;
  agent?: ForgeAgentId;
  agentTask?: string;
  agentProgress?: number;
  terminal?: Omit<ForgeTerminalLine, 'id' | 'timestamp'>;
  responseChunk?: string;
  file?: ForgeFile;
  buildStep?: { id: ForgeBuildStep['id']; status: ForgeBuildStep['status'] };
  memory?: ForgeMemoryNode;
  deployStatus?: string;
}

export function nowLabel() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function forgeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createForgeEvents(prompt: string): ForgeSimulationEvent[] {
  const shortPrompt = prompt.trim() || 'Create a verifiable AI application';

  return [
    {
      delay: 120,
      agent: 'architect',
      agentTask: 'Mapping PrivatePay architecture',
      agentProgress: 28,
      buildStep: { id: 'intent', status: 'running' },
      terminal: { kind: 'system', source: 'Forge Kernel', text: `Intent received: "${shortPrompt.slice(0, 88)}"` },
      responseChunk: 'I am decomposing PrivatePay into product surface, encrypted payment intent, Solana proof path, and security review.\n\n',
      deployStatus: 'Planning',
    },
    {
      delay: 650,
      agent: 'ui',
      agentTask: 'Designing private payment hero',
      agentProgress: 36,
      terminal: { kind: 'agent', source: 'UI Agent', text: 'Creating private payment page: hero, encrypted transfer card, trust badges.' },
      file: {
        path: 'components/private-payment-card.tsx',
        language: 'tsx',
        status: 'modified',
        contents: `type PrivatePaymentCardProps = {
  recipient: string;
  amountSol: number;
  proofStatus: 'draft' | 'encrypted' | 'verified';
};

export function PrivatePaymentCard({ recipient, amountSol, proofStatus }: PrivatePaymentCardProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/30">
      <p className="text-xs uppercase tracking-[0.22em] text-emerald-300/70">Encrypted transfer</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">Send SOL privately</h2>
      <dl className="mt-6 grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <dt className="text-xs text-white/35">Recipient</dt>
          <dd className="mt-1 font-mono text-sm text-white/75">{recipient}</dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <dt className="text-xs text-white/35">Amount</dt>
          <dd className="mt-1 text-xl font-semibold text-emerald-300">{amountSol} SOL</dd>
        </div>
      </dl>
      <p className="mt-5 text-sm text-white/45">Proof status: {proofStatus}</p>
    </section>
  );
}
`,
      },
      responseChunk: 'The UI Agent is shaping a premium private payment surface with a hero, transfer intent card, and proof status modules.\n\n',
    },
    {
      delay: 1100,
      agent: 'backend',
      agentTask: 'Drafting payment intent API',
      agentProgress: 44,
      buildStep: { id: 'plan', status: 'running' },
      terminal: { kind: 'shell', source: 'backend.exec', text: 'simulate: create /api/private-pay/intent with schema validation and receipt hash' },
      file: {
        path: 'app/api/private-pay/intent/route.ts',
        language: 'ts',
        status: 'created',
        contents: `import { NextResponse } from 'next/server';
import { createPrivatePaymentIntent } from '@/lib/private-payment-intent';

export async function POST(request: Request) {
  const body = await request.json();
  const intent = createPrivatePaymentIntent({
    recipient: body.recipient,
    amountSol: Number(body.amountSol),
    memoHash: body.memoHash,
  });

  return NextResponse.json({
    ok: true,
    intent,
    receipt: 'simulated-private-receipt',
  });
}
`,
      },
      responseChunk: 'Backend boundaries are being modeled as typed payment intent services, keeping private receipt generation separate from UI state.\n\n',
    },
    {
      delay: 1550,
      agent: 'solana',
      agentTask: 'Preparing Solana receipt proof',
      agentProgress: 51,
      terminal: { kind: 'agent', source: 'Solana Agent', text: 'Deriving ZK-ready receipt: amount hidden, receiver hash visible, Solana anchor prepared.' },
      memory: { id: 'm-proof', label: 'Private Receipt', detail: 'Payment proof capsule ready for Solana anchoring', confidence: 86 },
      file: {
        path: 'solana/private-payment-proof.ts',
        language: 'ts',
        status: 'modified',
        contents: `export type PrivateReceiptProof = {
  paymentHash: string;
  recipientCommitment: string;
  amountCommitment: string;
  network: 'solana-devnet';
};

export function derivePrivateReceiptProof(paymentHash: string): PrivateReceiptProof {
  return {
    paymentHash,
    recipientCommitment: 'recipient:sha256:simulated',
    amountCommitment: 'amount:pedersen:simulated',
    network: 'solana-devnet',
  };
}
`,
      },
      responseChunk: 'The Solana Agent is preparing a receipt proof so the transaction can be verified without exposing private payment details.\n\n',
    },
    {
      delay: 2100,
      agent: 'architect',
      agentTask: 'Coordinating payment file graph',
      agentProgress: 68,
      buildStep: { id: 'files', status: 'running' },
      terminal: { kind: 'success', source: 'Architect Agent', text: 'File graph approved: page shell, payment card, intent route, proof helper.' },
      file: {
        path: 'app/page.tsx',
        language: 'tsx',
        status: 'modified',
        contents: `import { PrivatePaymentCard } from '@/components/private-payment-card';

export default function PrivatePayPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-16 lg:grid-cols-[1fr_420px]">
        <div>
          <p className="text-sm font-medium text-emerald-300">PrivatePay on Solana</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight">
            Private payments with verifiable receipts.
          </h1>
          <p className="mt-5 max-w-xl text-white/50">
            Send SOL with encrypted metadata, generate a receipt proof, and anchor integrity to Solana.
          </p>
        </div>
        <PrivatePaymentCard recipient="7xP4...9kL2" amountSol={2.4} proofStatus="encrypted" />
      </section>
    </main>
  );
}
`,
      },
      responseChunk: 'Files are now being generated for a concrete private payments product. Nothing is written to production from this MVP simulation.\n\n',
    },
    {
      delay: 2650,
      agent: 'security',
      agentTask: 'Reviewing privacy and signing risk',
      agentProgress: 72,
      terminal: { kind: 'warning', source: 'Security Agent', text: 'Checking: no plaintext memo in UI, no private key handling, no production shell execution.' },
      responseChunk: 'Security confirms the design keeps sensitive memo data out of the public UI and keeps Phase 1 visual-only.\n\n',
    },
    {
      delay: 3250,
      agent: 'ui',
      agentTask: 'Rendering PrivatePay preview',
      agentProgress: 86,
      terminal: { kind: 'shell', source: 'ui.build', text: 'simulate: compile PrivatePay page, hydrate payment form, animate proof rail' },
      file: {
        path: 'components/proof-status-rail.tsx',
        language: 'tsx',
        status: 'created',
        contents: `const steps = ['Intent encrypted', 'Receipt derived', 'Solana anchor ready'];

export function ProofStatusRail() {
  return (
    <ol className="grid gap-3">
      {steps.map((step) => (
        <li key={step} className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-3 text-sm text-white/70">
          {step}
        </li>
      ))}
    </ol>
  );
}
`,
      },
      buildStep: { id: 'verify', status: 'running' },
      responseChunk: 'The preview is now rendering a real PrivatePay surface: encrypted transfer card, receipt status, and Solana proof rail.\n\n',
    },
    {
      delay: 3900,
      agent: 'backend',
      agentTask: 'Packaging PrivatePay deploy capsule',
      agentProgress: 94,
      buildStep: { id: 'deploy', status: 'running' },
      terminal: { kind: 'agent', source: 'Backend Agent', text: 'Deploy capsule prepared: static page, payment intent API, Solana proof helper.' },
      deployStatus: 'PrivatePay capsule',
      responseChunk: 'A PrivatePay deploy capsule is simulated and ready for a future Vercel/Railway adapter.\n\n',
    },
    {
      delay: 4550,
      agent: 'security',
      agentTask: 'Final privacy verification',
      agentProgress: 100,
      terminal: { kind: 'success', source: 'Forge Kernel', text: 'PrivatePay simulation complete. Preview, files, API contract, and proof helper are aligned.' },
      buildStep: { id: 'intent', status: 'complete' },
      responseChunk: 'Forge Phase 1 complete: PrivatePay now has a polished preview, typed files, a simulated API contract, and a Solana receipt proof path.',
      deployStatus: 'PrivatePay ready',
    },
  ];
}
