/**
 * Autonomous Loop — The self-improving agent cycle
 *
 * Every iteration:
 *   1. Fetch top verified memories (ranked by PoI score)
 *   2. Inject memories as context → AI synthesizes insights
 *   3. Evaluate decision rules against memories
 *   4. Execute actions
 *   5. Save new synthesized memory (agent grows smarter)
 *   6. Anchor proof on Solana
 */

import { runDecisionEngine } from './decision-engine';
import { db } from '@/lib/db';
import { selectModelForTask, isBudgetExceeded, truncateToTokenBudget } from '../ai/token-economy';

export interface LoopStatus {
  isRunning: boolean;
  lastRun: number | null;
  nextRun: number | null;
  totalRuns: number;
  totalDecisions: number;
  agentId: string;
  lastInsight?: string;
}

const runningLoops = new Map<string, {
  intervalId: ReturnType<typeof setInterval>;
  lastRun: number | null;
  totalRuns: number;
  totalDecisions: number;
  lastInsight: string;
}>();

// ── Memory-aware synthesis ────────────────────────────────────
async function synthesizeWithMemories(agentId: string): Promise<{ content: string; hash: string } | null> {
  try {
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent) return null;

    // Fetch top 5 memories ranked by PoI score
    const topMemories = await db.memory.findMany({
      where: { score: { not: null } },
      orderBy: { score: 'desc' },
      take: 5,
    });

    if (topMemories.length === 0) return null;

    // Use cheapest capable model for autonomous synthesis (preserves budget)
    const loopModel = isBudgetExceeded(agent.model)
      ? selectModelForTask('autonomous')
      : selectModelForTask('autonomous', agent.model);

    const memoryContext = topMemories
      .map((m, i) =>
        // Truncate each memory to 150 chars to keep prompt small
        `[MEMORY ${i + 1}] ${m.model.toUpperCase()} • Q:${m.score}/10${m.verified ? ' ✓' : ''}\n${truncateToTokenBudget(m.content, 120)}`
      )
      .join('\n---\n');

    const { callModel } = await import('../ai');
    const result = await callModel({
      model: loopModel,
      messages: [{
        role: 'user',
        content:
          `You are operating autonomously. Based on your accumulated verified memories below, ` +
          `synthesize one key insight or action item relevant to your goal: "${agent.goal}".\n\n` +
          `Be specific, actionable, and concise (max 3 sentences).\n\n` +
          `--- VERIFIED MEMORIES ---\n${memoryContext}`,
      }],
      systemPrompt:
        `You are ${agent.name}, an autonomous AI agent. ` +
        `Goal: ${agent.goal}. ` +
        `Personality: ${agent.personality}. ` +
        `You continuously improve by synthesizing insights from your verified memory bank.`,
      agentName: agent.name,
      useContext: false,
    });

    // Save synthesis as a new verified memory (agent builds its own knowledge base)
    const { saveMemory } = await import('../memory/memory.service');
    const saved = await saveMemory({
      content: `[${agent.name.toUpperCase()} SYNTHESIS]\n${result.content}`,
      model: loopModel,
    });

    // Update agent interaction count
    await db.agent.update({
      where: { id: agentId },
      data: {
        totalInteractions: { increment: 1 },
        memoryCount: { increment: 1 },
      },
    });

    return { content: result.content, hash: saved.hash };
  } catch {
    return null;
  }
}

// ── Loop core ─────────────────────────────────────────────────
async function runCycle(agentId: string, state: { totalRuns: number; totalDecisions: number; lastInsight: string; lastRun: number | null }) {
  try {
    // 1. Memory-aware synthesis (agent learns from its own memories)
    const synthesis = await synthesizeWithMemories(agentId);
    if (synthesis) {
      state.lastInsight = synthesis.content;
      console.log(`[Loop] Agent ${agentId} synthesized: "${synthesis.content.slice(0, 60)}..."`);
    }

    // 2. Run decision rules against memories
    const decisions = await runDecisionEngine(agentId);
    state.lastRun = Date.now() / 1000;
    state.totalRuns++;
    state.totalDecisions += decisions.length;

    // 3. Anchor cycle proof on Solana if decisions were made
    if (decisions.length > 0 || synthesis) {
      try {
        const { storeOnSolana } = await import('../blockchain/blockchain.service');
        const { generateHash } = await import('../memory/hash.utils');
        const proofContent = [
          `CONGCHAIN Agent Cycle`,
          `Agent: ${agentId}`,
          `Run: ${state.totalRuns}`,
          `Decisions: ${decisions.length}`,
          `Synthesized: ${synthesis ? 'yes' : 'no'}`,
          `Timestamp: ${new Date().toISOString()}`,
          synthesis ? `Insight hash: ${synthesis.hash}` : '',
        ].filter(Boolean).join('\n');

        const proofHash = generateHash(proofContent, 'cycle-proof');
        const result = await storeOnSolana(proofHash);
        if (result.success) {
          console.log(`[Loop] Cycle proof anchored. TX: ${result.txHash?.slice(0, 12)}...`);
        }
      } catch { /* non-critical */ }
    }
  } catch (error) {
    console.error(`[Loop] Agent ${agentId} cycle error:`, error);
  }
}

// ── Public API ────────────────────────────────────────────────
export function startAutonomousLoop(agentId: string, intervalMs = 60_000): void {
  if (runningLoops.has(agentId)) stopAutonomousLoop(agentId);

  const state = {
    intervalId: null as unknown as ReturnType<typeof setInterval>,
    lastRun: null as number | null,
    totalRuns: 0,
    totalDecisions: 0,
    lastInsight: '',
  };

  state.intervalId = setInterval(() => runCycle(agentId, state), intervalMs);
  runningLoops.set(agentId, state);
  console.log(`[Loop] Started agent ${agentId} (${intervalMs / 1000}s interval)`);
}

export function stopAutonomousLoop(agentId: string): boolean {
  const state = runningLoops.get(agentId);
  if (!state) return false;
  clearInterval(state.intervalId);
  runningLoops.delete(agentId);
  return true;
}

export function getLoopStatus(agentId: string): LoopStatus {
  const state = runningLoops.get(agentId);
  return {
    isRunning: !!state,
    lastRun: state?.lastRun || null,
    nextRun: state ? (state.lastRun || 0) + 60 : null,
    totalRuns: state?.totalRuns || 0,
    totalDecisions: state?.totalDecisions || 0,
    lastInsight: state?.lastInsight || '',
    agentId,
  };
}

export async function triggerLoopOnce(agentId: string) {
  const state = { totalRuns: 0, totalDecisions: 0, lastInsight: '', lastRun: null as number | null };
  await runCycle(agentId, state);
  return {
    agentId,
    decisions: state.totalDecisions,
    insight: state.lastInsight,
    timestamp: Date.now() / 1000,
  };
}

export function getAllLoopStatuses(): LoopStatus[] {
  return Array.from(runningLoops.keys()).map(agentId => getLoopStatus(agentId));
}
