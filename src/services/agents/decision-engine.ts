/**
 * Decision Engine — Core of autonomous agent behavior
 * 
 * Evaluates conditions against memories and executes actions.
 * This is what makes CONGCHAIN agents "act" not just "remember".
 */

import { db } from '@/lib/db';
import { listMemories } from '../memory/memory.service';
import { executeTool } from './tools';
import { nowTimestamp, generateHash } from '../memory/hash.utils';
import type { DecisionRuleData, DecisionRecordData, Condition } from './agent.model';

/**
 * Evaluate a condition against a set of memories.
 */
function evaluateCondition(condition: Condition, memories: { content: string; hash: string; score: number | null | undefined; timestamp: number; model?: string }[]): { matched: boolean; evidence?: string } {
  switch (condition.type) {
    case 'memory_contains': {
      const keyword = (condition.value || '').toLowerCase();
      const match = memories.find(m => m.content.toLowerCase().includes(keyword));
      return { matched: !!match, evidence: match?.hash };
    }
    case 'memory_score_above': {
      const threshold = Number(condition.value) || 5;
      const match = memories.find(m => (m.score ?? 0) >= threshold);
      return { matched: !!match, evidence: match?.hash };
    }
    case 'memory_newer_than': {
      const hoursAgo = Number(condition.value) || 24;
      const cutoff = nowTimestamp() - (hoursAgo * 3600);
      const match = memories.find(m => m.timestamp > cutoff);
      return { matched: !!match, evidence: match?.hash };
    }
    case 'model_equals': {
      const targetModel = (condition.value || '').toLowerCase();
      const match = memories.find(m => (m.content.toLowerCase().includes('[') && m.content.toLowerCase().includes('model:')) ? false : m.content.toLowerCase().includes(targetModel));
      // Check the model field directly from memory metadata
      const modelMatch = memories.find(m => {
        // Extract model from memory content if stored as metadata
        const modelField = m.content.match(/\[model:\s*(\w+)\]/i);
        return modelField && modelField[1].toLowerCase() === targetModel;
      });
      // Also check by looking at memories that mention the model name in a structured way
      const directMatch = memories.find(m => m.model && m.model.toLowerCase() === targetModel);
      return { matched: !!directMatch || !!modelMatch, evidence: directMatch?.hash || modelMatch?.hash };
    }
    default:
      return { matched: false };
  }
}

/**
 * Run the decision engine for a specific agent.
 * Evaluates all active rules against recent memories and executes matching actions.
 */
export async function runDecisionEngine(agentId: string): Promise<DecisionRecordData[]> {
  // 1. Load agent's active rules
  const rules = await db.decisionRule.findMany({
    where: { agentId, isActive: true },
  });

  if (rules.length === 0) return [];

  // 2. Load recent memories
  const memories = await listMemories(20, 0);

  // 3. Evaluate each rule
  const results: DecisionRecordData[] = [];

  for (const rule of rules) {
    try {
      const condition: Condition = JSON.parse(rule.condition || '{}');
      const params = JSON.parse(rule.params || '{}');

      const { matched, evidence } = evaluateCondition(condition, memories as Array<{ content: string; hash: string; score: number | null | undefined; timestamp: number; model?: string }>);

      if (matched) {
        // 4. Execute the action via tool system
        const toolResult = await executeTool(rule.action, params, {
          agentId,
          memories: memories as Array<{ content: string; hash: string; score: number | null; timestamp: number; model?: string }>,
          evidence,
          ruleName: rule.name,
        });

        // 5. Save decision record
        const resultValue: 'success' | 'failure' = toolResult.success ? 'success' : 'failure';
        const record = await db.decisionRecord.create({
          data: {
            agentId,
            ruleId: rule.id,
            condition: rule.condition,
            action: rule.action,
            result: resultValue,
            evidence: evidence || null,
            output: toolResult.output ? toolResult.output.substring(0, 2000) : null,
            timestamp: nowTimestamp(),
          },
        });

        // 6. Update rule stats
        await db.decisionRule.update({
          where: { id: rule.id },
          data: {
            lastTriggered: nowTimestamp(),
            triggerCount: { increment: 1 },
          },
        });

        // 7. If tool produced a memory-worthy output, save it
        if (toolResult.memoryToSave) {
          try {
            const { saveMemory } = await import('../memory/memory.service');
            await saveMemory({
              content: `[Autonomous Decision: ${rule.name}] ${toolResult.memoryToSave}`,
              model: 'congchain',
            });
          } catch {
            // Memory save is best-effort
          }
        }

        results.push({
          id: record.id,
          agentId: record.agentId,
          ruleId: record.ruleId,
          condition: record.condition,
          action: record.action,
          result: record.result as 'success' | 'failure' | 'pending',
          evidence: record.evidence || undefined,
          output: record.output || undefined,
          txHash: record.txHash || undefined,
          timestamp: record.timestamp,
          createdAt: record.createdAt.toISOString(),
        });
      }
    } catch (error) {
      console.error(`[Decision Engine] Rule ${rule.id} error:`, error);
      // Save failure record
      const record = await db.decisionRecord.create({
        data: {
          agentId,
          ruleId: rule.id,
          condition: rule.condition,
          action: rule.action,
          result: 'failure' as const,
          output: String(error).substring(0, 500),
          timestamp: nowTimestamp(),
        },
      });
      results.push({
        id: record.id,
        agentId: record.agentId,
        ruleId: record.ruleId,
        condition: record.condition,
        action: record.action,
        result: record.result as 'success' | 'failure' | 'pending',
        output: record.output || undefined,
        timestamp: record.timestamp,
        createdAt: record.createdAt.toISOString(),
      });
    }
  }

  return results;
}

/**
 * Get decision history for an agent.
 */
export async function getDecisionHistory(agentId: string, limit = 50): Promise<DecisionRecordData[]> {
  const records = await db.decisionRecord.findMany({
    where: { agentId },
    orderBy: { timestamp: 'desc' },
    take: Math.min(limit, 100),
  });

  return records.map(r => ({
    id: r.id,
    agentId: r.agentId,
    ruleId: r.ruleId,
    condition: r.condition,
    action: r.action,
    result: r.result as 'success' | 'failure' | 'pending',
    evidence: r.evidence || undefined,
    output: r.output || undefined,
    txHash: r.txHash || undefined,
    timestamp: r.timestamp,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Get rules for an agent.
 */
export async function getAgentRules(agentId: string) {
  const rules = await db.decisionRule.findMany({
    where: { agentId },
    orderBy: { createdAt: 'desc' },
  });

  return rules.map(r => ({
    id: r.id,
    agentId: r.agentId,
    name: r.name,
    condition: r.condition,
    action: r.action,
    params: r.params,
    isActive: r.isActive,
    lastTriggered: r.lastTriggered,
    triggerCount: r.triggerCount,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}
