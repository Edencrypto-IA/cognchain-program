/**
 * Mythos agent metrics — in-memory cost accounting for the agentic loop.
 * Purpose: publish real "cost per task" numbers (the efficiency play).
 */

export interface MythosTaskMetric {
  id: string;
  command: string;
  intent: string;
  mode: 'function-calling' | 'deterministic';
  toolCalls: number;
  approvedCount: number;
  inputChars: number;
  outputChars: number;
  estimatedCostUSD: number;
  tools: Record<string, number>;
  createdAt: number;
}

// DeepSeek pricing per 1M tokens (USD) — used for estimates.
export const DEEPSEEK_INPUT_USD_PER_1M = 0.27;
export const DEEPSEEK_OUTPUT_USD_PER_1M = 1.10;
export const CHARS_PER_TOKEN = 4;

export function estimateDeepSeekCostUSD(inputChars: number, outputChars: number): number {
  const inputTokens = Math.max(0, inputChars) / CHARS_PER_TOKEN;
  const outputTokens = Math.max(0, outputChars) / CHARS_PER_TOKEN;
  return (
    (inputTokens * DEEPSEEK_INPUT_USD_PER_1M + outputTokens * DEEPSEEK_OUTPUT_USD_PER_1M) /
    1_000_000
  );
}

export function formatCostUSD(value: number): string {
  if (value <= 0) return 'R$ 0,00';
  if (value < 0.01) return `R$ ${(value * 5.5).toFixed(4)} (US$ ${value.toFixed(6)})`;
  return `R$ ${(value * 5.5).toFixed(3)} (US$ ${value.toFixed(4)})`;
}

const MAX_STORE = 500;
const store: MythosTaskMetric[] = [];

export function recordMythosTask(
  metric: Omit<MythosTaskMetric, 'id' | 'createdAt' | 'estimatedCostUSD'>,
): MythosTaskMetric {
  const entry: MythosTaskMetric = {
    ...metric,
    id: `task_${Date.now().toString(36)}_${store.length}`,
    estimatedCostUSD: estimateDeepSeekCostUSD(metric.inputChars, metric.outputChars),
    createdAt: Date.now(),
  };
  store.unshift(entry);
  if (store.length > MAX_STORE) store.length = MAX_STORE;
  return entry;
}

export interface MythosAgentStats {
  totalTasks: number;
  totalCostUSD: number;
  totalCostBRL: number;
  avgCostPerTaskUSD: number;
  avgCostPerTaskBRL: number;
  inputChars: number;
  outputChars: number;
  modes: Record<string, number>;
  intents: Record<string, number>;
  tools: Record<string, number>;
  approvedProposals: number;
  lastTaskAt: number | null;
}

export function getMythosAgentStats(): MythosAgentStats {
  const totalCostUSD = store.reduce((sum, task) => sum + task.estimatedCostUSD, 0);
  const totals = {
    inputChars: store.reduce((sum, task) => sum + task.inputChars, 0),
    outputChars: store.reduce((sum, task) => sum + task.outputChars, 0),
    approvedProposals: store.reduce((sum, task) => sum + task.approvedCount, 0),
  };
  const modes: Record<string, number> = {};
  const intents: Record<string, number> = {};
  const tools: Record<string, number> = {};
  for (const task of store) {
    modes[task.mode] = (modes[task.mode] ?? 0) + 1;
    intents[task.intent] = (intents[task.intent] ?? 0) + 1;
    for (const [tool, count] of Object.entries(task.tools)) {
      tools[tool] = (tools[tool] ?? 0) + count;
    }
  }

  const count = store.length;
  const avgCostUSD = count ? totalCostUSD / count : 0;
  return {
    totalTasks: count,
    totalCostUSD: Math.round(totalCostUSD * 1_000_000) / 1_000_000,
    totalCostBRL: Math.round(totalCostUSD * 5.5 * 1000) / 1000,
    avgCostPerTaskUSD: Math.round(avgCostUSD * 1_000_000) / 1_000_000,
    avgCostPerTaskBRL: Math.round(avgCostUSD * 5.5 * 1000) / 1000,
    inputChars: totals.inputChars,
    outputChars: totals.outputChars,
    modes,
    intents,
    tools,
    approvedProposals: totals.approvedProposals,
    lastTaskAt: store[0]?.createdAt ?? null,
  };
}

export function getMythosTaskCount(): number {
  return store.length;
}

/** Test helper: reset the in-memory store. */
export function resetMythosMetricsForTest(): void {
  store.length = 0;
}
