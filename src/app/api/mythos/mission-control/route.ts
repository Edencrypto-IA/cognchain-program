import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeErrorMessage } from '@/lib/security';
import { computeIntelligenceScore, listAgents } from '@/services/agents';
import { getAgentSnapshots, getFiredAgents, getRecentRealEvents } from '@/app/api/office/shared';

export const dynamic = 'force-dynamic';

function normalizeScore(score: number | null | undefined) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(Number(score))));
}

function scoreLevel(score: number) {
  if (score >= 80) return 'Mestre';
  if (score >= 60) return 'Especialista';
  if (score >= 40) return 'Competente';
  if (score >= 20) return 'Aprendiz';
  return 'Nascente';
}

export async function GET() {
  try {
    const [agents, recentMemories] = await Promise.all([
      listAgents().catch(() => []),
      db.memory.findMany({
        take: 12,
        orderBy: { timestamp: 'desc' },
        select: {
          hash: true,
          content: true,
          model: true,
          score: true,
          verified: true,
          timestamp: true,
        },
      }).catch(() => []),
    ]);

    const mythosAgent = agents.find(agent => /mythos|mito/i.test(agent.name))
      || agents.find(agent => /mythos|agent-memory|solana/i.test(`${agent.goal} ${agent.systemPrompt}`))
      || agents[0]
      || null;

    const intelligence = mythosAgent
      ? await computeIntelligenceScore(mythosAgent.id).catch(() => null)
      : null;

    const activeOfficeAgents = getAgentSnapshots().filter(agent => agent.status !== 'fired');
    const firedOfficeAgents = getFiredAgents();
    const recentTasks = getRecentRealEvents(8);
    const verifiedMemories = recentMemories.filter(memory => memory.verified).length;
    const averageMemoryScore = recentMemories.length
      ? recentMemories.reduce((sum, memory) => sum + (memory.score || 0), 0) / recentMemories.length
      : 0;

    const fallbackScore = normalizeScore(
      (recentMemories.length * 4)
      + (averageMemoryScore * 4)
      + (activeOfficeAgents.length * 3)
      + (verifiedMemories * 2),
    );

    const total = intelligence?.total ?? fallbackScore;

    return NextResponse.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      safety: {
        readOnly: true,
        noWalletSignature: true,
        noTransactionSubmit: true,
        noFundsMovement: true,
      },
      mythos: {
        agentId: mythosAgent?.id ?? 'mythos-lab',
        name: mythosAgent?.name ?? 'Mythos',
        model: mythosAgent?.model ?? 'nvidia',
        goal: mythosAgent?.goal ?? 'Coordinate Solana, memory, launch, and artifact workflows with human approval.',
        intelligence: intelligence ?? {
          total,
          level: scoreLevel(total),
          breakdown: {
            memories: Math.min(recentMemories.length * 4, 40),
            quality: Math.min(Math.round(averageMemoryScore * 2), 20),
            decisions: Math.min(activeOfficeAgents.reduce((sum, agent) => sum + agent.tasksDone, 0), 20),
            onChain: Math.min(verifiedMemories * 4, 20),
          },
        },
      },
      office: {
        activeAgents: activeOfficeAgents,
        firedAgents: firedOfficeAgents,
        recentTasks,
        stats: {
          active: activeOfficeAgents.length,
          fired: firedOfficeAgents.length,
          tasks: activeOfficeAgents.reduce((sum, agent) => sum + agent.tasksDone, 0),
          memories: activeOfficeAgents.reduce((sum, agent) => sum + agent.memoryCount, 0) + recentMemories.length,
          solSpent: activeOfficeAgents.reduce((sum, agent) => sum + agent.solSpent, 0),
        },
      },
      memories: recentMemories.map(memory => ({
        hash: memory.hash,
        model: memory.model,
        score: memory.score,
        verified: memory.verified,
        timestamp: memory.timestamp,
        preview: memory.content.replace(/\s+/g, ' ').slice(0, 180),
      })),
      capabilities: [
        {
          id: 'market-intelligence',
          label: 'Market Intel',
          detail: 'Runs a read-only agent task using configured free model providers and external market data.',
          endpoint: '/api/office/run-task',
          safe: true,
        },
        {
          id: 'wallet-risk',
          label: 'Wallet Risk',
          detail: 'Runs a read-only Solana wallet risk task for a public address.',
          endpoint: '/api/office/run-task',
          safe: true,
        },
        {
          id: 'intent-review',
          label: 'Intent Review',
          detail: 'Keeps value-moving actions behind human approval, wallet signature, and separate submit gates.',
          safe: true,
        },
        {
          id: 'memory-inheritance',
          label: 'Memory Inheritance',
          detail: 'Uses verified CongChain memories as reusable context for future Mythos work.',
          safe: true,
        },
      ],
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: safeErrorMessage(error) }, { status: 500 });
  }
}
