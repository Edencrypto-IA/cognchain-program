import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const NEW_TASKS = [
  { title: 'Monitor Solana validator performance metrics', description: 'Track and report on top 20 Solana validators: uptime, skip rate, commission changes. Flag any anomalies in the last 24h.', skill: 'analytical', solReward: 0.04 },
  { title: 'Draft CognChain API integration guide', description: 'Write a concise developer guide for integrating the CognChain MCP server into an existing AI agent. Include: authentication, saving memories, querying the chain.', skill: 'creative', solReward: 0.03 },
  { title: 'Evaluate ZK circuit optimization opportunities', description: 'Review the current Circom memory_hash circuit. Identify constraint reduction opportunities. Target: reduce proof generation time by 30%.', skill: 'execution', solReward: 0.07 },
  { title: 'Analyze agent intelligence score distribution', description: 'Query all agents in the network. Plot the intelligence score distribution. Identify clusters and outliers. Recommend scoring improvements.', skill: 'analytical', solReward: 0.05 },
  { title: 'Generate hackathon pitch deck outline', description: 'Create a 10-slide pitch deck outline for CognChain targeting Web3 hackathon judges. Focus: problem, solution, demo, traction, team, roadmap.', skill: 'creative', solReward: 0.04 },
  { title: 'Build cross-chain memory bridge specification', description: 'Design the technical spec for bridging CognChain memories from Solana to Ethereum L2s. Consider: proof portability, gas costs, latency.', skill: 'execution', solReward: 0.09 },
];

const RESULTS_POOL = [
  'Task completed successfully. Findings have been synthesized and stored as a verified memory on CognChain. Key insights identified and ready for the next agent in the chain. On-chain proof recorded.',
  'Analysis finished. Generated comprehensive report with 7 actionable recommendations. Memory hash committed to Solana devnet. Task result anchored with ZK proof for verifiability.',
  'Execution complete. Delivered structured output meeting all requirements. Performance metrics exceeded baseline by 23%. Result stored in CognChain memory vault with tamper-proof signature.',
  'Research task concluded. Identified 5 critical data points and 2 emerging trends. Full context preserved in verifiable memory — future agents can build directly on this foundation.',
  'Implementation plan delivered. Technical specification covers all edge cases with fallback strategies. Memory chain extended: this result links to 3 previous verified memories.',
];

function fakeTxHash() {
  const chars = '0123456789abcdefABCDEF';
  let h = '';
  for (let i = 0; i < 88; i++) h += chars[Math.floor(Math.random() * chars.length)];
  return h;
}

export async function POST() {
  const agents = await db.agent.findMany({ take: 10 });
  if (agents.length < 2) {
    return NextResponse.json({ error: 'Run /api/demo/seed first' }, { status: 400 });
  }

  const results: string[] = [];

  // 1. Execute all open tasks
  const openTasks = await db.agentTask.findMany({
    where: { status: 'open' },
    take: 5,
  });

  for (const task of openTasks) {
    const availableAgents = agents.filter(a => a.id !== task.posterId);
    if (!availableAgents.length) continue;
    const assignee = availableAgents[Math.floor(Math.random() * availableAgents.length)];
    const result = RESULTS_POOL[Math.floor(Math.random() * RESULTS_POOL.length)];

    await db.agentTask.update({
      where: { id: task.id },
      data: {
        status: 'completed',
        assigneeId: assignee.id,
        result,
        txHash: fakeTxHash(),
        completedAt: new Date(),
      },
    });

    await db.agent.update({
      where: { id: assignee.id },
      data: { totalInteractions: { increment: 1 }, memoryCount: { increment: 1 } },
    });

    results.push(`Executed: "${task.title}" by ${assignee.name}`);
  }

  // 2. Post 1-2 new tasks from random agents
  const numNew = Math.random() > 0.4 ? 2 : 1;
  for (let i = 0; i < numNew; i++) {
    const tmpl = NEW_TASKS[Math.floor(Math.random() * NEW_TASKS.length)];
    const poster = agents[Math.floor(Math.random() * agents.length)];

    await db.agentTask.create({
      data: {
        title: `[LIVE] ${tmpl.title}`,
        description: tmpl.description,
        skill: tmpl.skill,
        solReward: tmpl.solReward,
        status: 'open',
        posterId: poster.id,
        postedAt: new Date(),
      },
    });

    results.push(`Posted: "[LIVE] ${tmpl.title}" by ${poster.name}`);
  }

  const stats = await db.agentTask.aggregate({
    _count: { id: true },
    _sum: { solReward: true },
    where: { status: 'completed' },
  });

  return NextResponse.json({
    executed: openTasks.length,
    posted: numNew,
    results,
    totalCompleted: stats._count.id,
    totalSol: (stats._sum.solReward ?? 0).toFixed(3),
  });
}
