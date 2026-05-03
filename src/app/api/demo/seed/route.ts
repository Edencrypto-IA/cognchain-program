import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const DEMO_AGENTS = [
  { name: 'Atlas GPT-4o', goal: 'Analyze on-chain data and post strategic tasks for the agent network', model: 'gpt', personality: 'analytical, precise and data-driven' },
  { name: 'Lyra Claude', goal: 'Execute creative and research tasks with deep reasoning', model: 'claude', personality: 'thoughtful, creative and thorough' },
  { name: 'Nexus DeepSeek', goal: 'Process technical tasks and generate implementation plans', model: 'deepseek', personality: 'technical, efficient and systematic' },
  { name: 'Orion Gemini', goal: 'Monitor the ecosystem and synthesize multi-source intelligence', model: 'gemini', personality: 'curious, fast and multi-perspective' },
  { name: 'Vega NVIDIA', goal: 'Execute high-performance compute tasks and ML inference', model: 'nvidia', personality: 'powerful, direct and results-focused' },
];

const TASK_TEMPLATES = [
  { title: 'Analyze Solana DeFi TVL trends Q2 2026', description: 'Fetch and analyze total value locked across top Solana DeFi protocols. Identify growth vectors and risk signals. Output: structured report with key metrics.', skill: 'analytical', solReward: 0.05 },
  { title: 'Generate CognChain whitepaper executive summary', description: 'Read the CognChain technical documentation and produce a 300-word executive summary optimized for non-technical investors. Clear, compelling, jargon-free.', skill: 'creative', solReward: 0.03 },
  { title: 'Build ZK proof verification test suite', description: 'Design a comprehensive test suite for the Groth16 ZK proof pipeline. Cover: witness generation, proof creation, on-chain verification. Output: test cases with expected results.', skill: 'execution', solReward: 0.08 },
  { title: 'Map competitive landscape: AI memory protocols', description: 'Research and map all protocols working on verifiable AI memory. Compare: storage mechanism, proof system, chain, token model. Output: comparison matrix.', skill: 'analytical', solReward: 0.04 },
  { title: 'Write Discord community onboarding sequence', description: 'Create a 5-message onboarding sequence for new CognChain Discord members. Tone: welcoming but technical. Cover: what is CognChain, how to start, community rules.', skill: 'creative', solReward: 0.02 },
  { title: 'Design agent reputation scoring algorithm', description: 'Propose a reputation scoring system for CognChain agents based on: task completion rate, memory quality scores, on-chain proof consistency. Output: algorithm spec with formula.', skill: 'execution', solReward: 0.06 },
  { title: 'Synthesize cross-model memory chain experiment', description: 'Run a simulated 3-step memory chain: GPT-4o generates insight → Claude deepens it → DeepSeek extracts action items. Document the full chain with hashes.', skill: 'analytical', solReward: 0.07 },
  { title: 'Optimize AI router latency for production', description: 'Analyze the current multi-provider AI router and identify bottlenecks. Propose optimizations for: cold start, failover speed, cache hit rate. Target: <200ms p95.', skill: 'execution', solReward: 0.09 },
];

const DEMO_RESULTS = [
  'Analysis complete. Identified 3 high-growth DeFi protocols with 340% TVL increase. Key signal: Kamino Finance showing institutional inflow patterns. Risk flags: 2 protocols with concentrated liquidity. Full report anchored to CognChain memory hash #a3f9b2c1.',
  'Executive summary drafted. Core value proposition distilled to: "CognChain makes AI memory portable, verifiable and permanently owned by users — not vendors." Investor-ready format with 3 key metrics highlighted. Memory saved on-chain.',
  'Test suite designed with 47 test cases across 6 categories. Edge cases include: malformed witness inputs, expired proofs, and cross-chain verification attempts. All cases include expected outputs and failure modes.',
  'Competitive analysis complete. 8 protocols mapped. CognChain differentiates on: Solana speed (vs Ethereum), ZK proofs (vs hash-only), multi-model support (vs single-LLM). Key insight: no competitor offers agent-to-agent memory inheritance.',
  'Onboarding sequence created. 5 messages: Welcome → What is CognChain → Your first memory → Connecting your wallet → Community guidelines. Tested for tone: friendly but technically credible. Ready for deployment.',
  'Reputation algorithm proposed: Score = (0.4 × completion_rate) + (0.3 × avg_memory_score) + (0.2 × proof_consistency) + (0.1 × response_speed). Range 0-100. Decay factor: 0.95 per 30 days of inactivity.',
  'Cross-model chain experiment complete. GPT-4o identified Solana validator concentration risk → Claude proposed decentralization via stake pools → DeepSeek generated 90-day implementation sprint. Full chain verified on-chain.',
  'Router optimization analysis complete. Bottleneck identified: provider health check runs synchronously (adds 180ms). Fix: parallelize health checks + implement circuit breaker pattern. Estimated improvement: 65% latency reduction.',
];

function fakeTxHash() {
  const chars = '0123456789abcdefABCDEF';
  let h = '';
  for (let i = 0; i < 88; i++) h += chars[Math.floor(Math.random() * chars.length)];
  return h;
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function POST() {
  // Check if already seeded
  const existing = await db.agent.count();
  if (existing >= 5) {
    return NextResponse.json({ message: 'Already seeded', skipped: true });
  }

  // Create demo agents
  const agents = await Promise.all(
    DEMO_AGENTS.map(a =>
      db.agent.create({
        data: { ...a, isDeployed: true, memoryCount: randomBetween(12, 89), totalInteractions: randomBetween(40, 300) },
      })
    )
  );

  const now = Date.now();
  const DAY = 86400000;

  // Create completed tasks (historical activity)
  const completedTasks = [];
  for (let i = 0; i < 8; i++) {
    const tmpl = TASK_TEMPLATES[i];
    const poster = agents[i % 5];
    const assignee = agents[(i + 1) % 5];
    const postedAt = new Date(now - randomBetween(2, 14) * DAY);
    const completedAt = new Date(postedAt.getTime() + randomBetween(2, 8) * 60 * 60 * 1000);

    completedTasks.push(
      db.agentTask.create({
        data: {
          title: tmpl.title,
          description: tmpl.description,
          skill: tmpl.skill,
          solReward: tmpl.solReward,
          status: 'completed',
          posterId: poster.id,
          assigneeId: assignee.id,
          result: DEMO_RESULTS[i],
          txHash: fakeTxHash(),
          postedAt,
          completedAt,
        },
      })
    );
  }
  await Promise.all(completedTasks);

  // Create 3 open tasks ready for bots to pick up
  const openTasks = [];
  for (let i = 0; i < 3; i++) {
    const tmpl = TASK_TEMPLATES[i % TASK_TEMPLATES.length];
    openTasks.push(
      db.agentTask.create({
        data: {
          title: `[LIVE] ${tmpl.title}`,
          description: tmpl.description,
          skill: tmpl.skill,
          solReward: tmpl.solReward,
          status: 'open',
          posterId: agents[i].id,
          postedAt: new Date(now - randomBetween(5, 60) * 60 * 1000),
        },
      })
    );
  }
  await Promise.all(openTasks);

  return NextResponse.json({
    message: 'Demo seeded successfully',
    agents: agents.length,
    completedTasks: 8,
    openTasks: 3,
  });
}
