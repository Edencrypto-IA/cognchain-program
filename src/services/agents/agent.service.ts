// ============================================================
// Agent Service — CRUD + runtime for CONGCHAIN agents
// ============================================================

import { db } from '@/lib/db';
import type { AgentConfig, AgentRuntime } from './agent.model';

/**
 * Create a new agent configuration.
 */
export async function createAgent(config: AgentConfig): Promise<AgentRuntime> {
  const agent = await db.agent.create({
    data: {
      name: config.name,
      goal: config.goal,
      personality: config.personality,
      model: config.model,
      tools: JSON.stringify(config.tools || []),
      template: config.template || null,
      systemPrompt: config.systemPrompt || null,
    },
  });

  return mapToRuntime(agent);
}

/**
 * Get all agents.
 */
export async function listAgents(): Promise<AgentRuntime[]> {
  const agents = await db.agent.findMany({
    orderBy: { updatedAt: 'desc' },
  });
  return agents.map(mapToRuntime);
}

/**
 * Get a single agent by ID.
 */
export async function getAgent(id: string): Promise<AgentRuntime | null> {
  const agent = await db.agent.findUnique({ where: { id } });
  if (!agent) return null;
  return mapToRuntime(agent);
}

/**
 * Update an existing agent.
 */
export async function updateAgent(id: string, config: Partial<AgentConfig>): Promise<AgentRuntime | null> {
  const agent = await db.agent.findUnique({ where: { id } });
  if (!agent) return null;

  const updated = await db.agent.update({
    where: { id },
    data: {
      ...(config.name !== undefined && { name: config.name }),
      ...(config.goal !== undefined && { goal: config.goal }),
      ...(config.personality !== undefined && { personality: config.personality }),
      ...(config.model !== undefined && { model: config.model }),
      ...(config.tools !== undefined && { tools: JSON.stringify(config.tools) }),
      ...(config.template !== undefined && { template: config.template }),
      ...(config.systemPrompt !== undefined && { systemPrompt: config.systemPrompt }),
    },
  });

  return mapToRuntime(updated);
}

/**
 * Delete an agent.
 */
export async function deleteAgent(id: string): Promise<boolean> {
  try {
    await db.agent.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Mark agent as deployed.
 */
export async function markDeployed(id: string, target: string, config: Record<string, unknown>): Promise<AgentRuntime | null> {
  const agent = await db.agent.update({
    where: { id },
    data: {
      isDeployed: true,
      deployTarget: target,
      deployConfig: JSON.stringify(config),
    },
  });
  return mapToRuntime(agent);
}

/**
 * Increment agent interaction counter.
 */
export async function incrementInteraction(id: string): Promise<void> {
  await db.agent.update({
    where: { id },
    data: { totalInteractions: { increment: 1 } },
  });
}

/**
 * Increment agent memory count — called when a memory is saved for this agent.
 */
export async function incrementMemory(id: string): Promise<void> {
  await db.agent.update({
    where: { id },
    data: { memoryCount: { increment: 1 } },
  });
}

/**
 * Build system prompt for an agent.
 */
export function buildAgentSystemPrompt(agent: AgentRuntime): string {
  if (agent.systemPrompt) return agent.systemPrompt;

  const toolsList = agent.tools.length > 0
    ? `Ferramentas disponiveis: ${agent.tools.join(', ')}.`
    : '';

  return `Voce e o agente "${agent.name}" do CONGCHAIN — Verifiable AI Memory Layer.
OBJETIVO: ${agent.goal}
PERSONALIDADE: ${agent.personality}
${toolsList}
Regra: Quando relevante, mencione que suas memorias sao verificaveis na blockchain Solana.`;
}

// ============================================================
// Intelligence Score — composite metric of agent growth
// Memory quality 40% + Decision activity 20% + Engagement 20% + On-chain ratio 20%
// ============================================================

export interface IntelligenceScore {
  total: number;  // 0-100
  level: 'Nascente' | 'Aprendiz' | 'Competente' | 'Especialista' | 'Mestre';
  breakdown: { memories: number; quality: number; decisions: number; onChain: number };
}

export async function computeIntelligenceScore(agentId: string, loopDecisions = 0): Promise<IntelligenceScore> {
  const [agent, memories] = await Promise.all([
    db.agent.findUnique({ where: { id: agentId } }),
    db.memory.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);

  if (!agent) return { total: 0, level: 'Nascente', breakdown: { memories: 0, quality: 0, decisions: 0, onChain: 0 } };

  const totalMem  = memories.length;
  const scored    = memories.filter(m => m.score !== null);
  const verified  = memories.filter(m => m.verified).length;
  const avgScore  = scored.length > 0 ? scored.reduce((s, m) => s + (m.score || 0), 0) / scored.length : 0;

  const memPct  = Math.min(totalMem * 4, 40);
  const qualPct = (avgScore / 10) * 20;
  const decPct  = Math.min((agent.totalInteractions + loopDecisions) * 0.5, 20);
  const chainPct = totalMem > 0 ? (verified / totalMem) * 20 : 0;

  const total = Math.min(Math.round(memPct + qualPct + decPct + chainPct), 100);

  const level: IntelligenceScore['level'] =
    total >= 80 ? 'Mestre' :
    total >= 60 ? 'Especialista' :
    total >= 40 ? 'Competente' :
    total >= 20 ? 'Aprendiz' : 'Nascente';

  return {
    total,
    level,
    breakdown: {
      memories:  Math.round(memPct),
      quality:   Math.round(qualPct),
      decisions: Math.round(decPct),
      onChain:   Math.round(chainPct),
    },
  };
}

// ============================================================
// Memory Inheritance — seed new agent with verified memories
// ============================================================

export async function buildInheritedContext(memoryHashes: string[]): Promise<string> {
  if (!memoryHashes.length) return '';

  const memories = await db.memory.findMany({
    where: { hash: { in: memoryHashes } },
    orderBy: { score: 'desc' },
  });

  if (!memories.length) return '';

  const context = memories
    .map((m, i) => `[INHERITED MEMORY ${i + 1}] [${m.model.toUpperCase()} • Score ${m.score ?? 'N/A'}/10${m.verified ? ' • ✓ On-chain' : ''}]\n${m.content.slice(0, 400)}`)
    .join('\n\n');

  return `\n\n--- FOUNDATIONAL KNOWLEDGE (inherited from verified memories) ---\n${context}\n--- END INHERITED KNOWLEDGE ---`;
}

// ============================================================
// Helpers
// ============================================================

function mapToRuntime(agent: any): AgentRuntime {
  let tools: string[] = [];
  try {
    const parsed = JSON.parse(agent.tools || '[]');
    tools = Array.isArray(parsed) ? parsed : [];
  } catch {
    tools = [];
  }

  return {
    id: agent.id,
    name: agent.name,
    goal: agent.goal,
    personality: agent.personality,
    model: agent.model,
    tools,
    systemPrompt: agent.systemPrompt || '',
    isDeployed: agent.isDeployed,
    deployTarget: agent.deployTarget,
    memoryCount: agent.memoryCount,
    totalInteractions: agent.totalInteractions,
    createdAt: agent.createdAt?.toISOString() || new Date().toISOString(),
  };
}
