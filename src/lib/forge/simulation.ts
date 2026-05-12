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
      agentTask: 'Analyzing product architecture',
      agentProgress: 28,
      buildStep: { id: 'intent', status: 'running' },
      terminal: { kind: 'system', source: 'Forge Kernel', text: `Intent received: "${shortPrompt.slice(0, 88)}"` },
      responseChunk: 'I am decomposing the request into architecture, UI, backend, Solana proof, and security tracks.\n\n',
      deployStatus: 'Planning',
    },
    {
      delay: 650,
      agent: 'ui',
      agentTask: 'Designing cinematic workspace',
      agentProgress: 36,
      terminal: { kind: 'agent', source: 'UI Agent', text: 'Building a dark glass interface with responsive preview surfaces.' },
      responseChunk: 'The UI Agent is shaping a premium interface with calm motion, clear hierarchy, and production-grade empty states.\n\n',
    },
    {
      delay: 1100,
      agent: 'backend',
      agentTask: 'Drafting API contracts',
      agentProgress: 44,
      buildStep: { id: 'plan', status: 'running' },
      terminal: { kind: 'shell', source: 'backend.exec', text: 'simulate: create route handlers, validation schema, service boundary' },
      responseChunk: 'Backend boundaries are being modeled as typed services, keeping external contracts stable.\n\n',
    },
    {
      delay: 1550,
      agent: 'solana',
      agentTask: 'Preparing memory proof path',
      agentProgress: 51,
      terminal: { kind: 'agent', source: 'Solana Agent', text: 'Deriving simulated proof capsule for future on-chain anchoring.' },
      memory: { id: 'm-proof', label: 'Proof Capsule', detail: 'Hash-ready memory handoff prepared', confidence: 81 },
      responseChunk: 'The Solana Agent is preparing a proof capsule so generated work can later be anchored without exposing private content.\n\n',
    },
    {
      delay: 2100,
      agent: 'architect',
      agentTask: 'Coordinating file graph',
      agentProgress: 68,
      buildStep: { id: 'files', status: 'running' },
      terminal: { kind: 'success', source: 'Architect Agent', text: 'File graph approved: app shell, runtime adapter, proof helper.' },
      file: {
        path: 'features/generated/agent-console.tsx',
        language: 'tsx',
        status: 'created',
        contents: `type ConsoleEvent = {
  source: string;
  message: string;
  verified: boolean;
};

export function AgentConsole({ events }: { events: ConsoleEvent[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 p-5">
      {events.map((event) => (
        <article key={event.source + event.message} className="py-3">
          <p className="text-xs text-emerald-300">{event.source}</p>
          <p className="mt-1 text-sm text-white/70">{event.message}</p>
        </article>
      ))}
    </section>
  );
}
`,
      },
      responseChunk: 'Files are now being generated in a sandboxed plan. Nothing is written to the real project from this MVP simulation.\n\n',
    },
    {
      delay: 2650,
      agent: 'security',
      agentTask: 'Checking unsafe execution paths',
      agentProgress: 72,
      terminal: { kind: 'warning', source: 'Security Agent', text: 'Real shell execution disabled in Forge Phase 1. Simulation only.' },
      responseChunk: 'Security confirms Phase 1 is visual-only: no real shell, no deploy mutation, no current CongChain APIs changed.\n\n',
    },
    {
      delay: 3250,
      agent: 'ui',
      agentTask: 'Rendering live preview',
      agentProgress: 86,
      terminal: { kind: 'shell', source: 'ui.build', text: 'simulate: compile preview shell, hydrate panels, stream code surface' },
      file: {
        path: 'app/generated-preview/page.tsx',
        language: 'tsx',
        status: 'created',
        contents: `export default function GeneratedPreview() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-10 lg:grid-cols-[1fr_360px]">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
          <p className="text-sm text-[#14F195]">Live AI build</p>
          <h1 className="mt-4 text-4xl font-semibold">A verified app is taking shape.</h1>
        </section>
      </div>
    </main>
  );
}
`,
      },
      buildStep: { id: 'verify', status: 'running' },
      responseChunk: 'The preview shell is ready, and the code viewer is tracking the generated files.\n\n',
    },
    {
      delay: 3900,
      agent: 'backend',
      agentTask: 'Packaging deploy capsule',
      agentProgress: 94,
      buildStep: { id: 'deploy', status: 'running' },
      terminal: { kind: 'agent', source: 'Backend Agent', text: 'Deploy capsule prepared for future Railway/Vercel adapter.' },
      deployStatus: 'Capsule ready',
      responseChunk: 'A deploy capsule is simulated and ready for a future real adapter.\n\n',
    },
    {
      delay: 4550,
      agent: 'security',
      agentTask: 'Final verification',
      agentProgress: 100,
      terminal: { kind: 'success', source: 'Forge Kernel', text: 'Simulation complete. Agent mesh returned a verified build plan.' },
      buildStep: { id: 'intent', status: 'complete' },
      responseChunk: 'Forge Phase 1 complete: a believable agentic build flow, generated code surfaces, memory visualization, and deploy state are now visible in one cinematic workspace.',
      deployStatus: 'Simulated deploy ready',
    },
  ];
}
