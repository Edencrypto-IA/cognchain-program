/**
 * Token Economy — Smart routing + budget protection
 *
 * Goal: minimize cost without degrading quality.
 * Rule: use the cheapest model that can do the job well.
 *
 * Monthly budget caps (configurable via env):
 *   BUDGET_CLAUDE_USD  default $5   — deep analysis only
 *   BUDGET_GPT_USD     default $10  — creative + general
 *   BUDGET_GEMINI_USD  default $5   — bulk + summaries
 *   BUDGET_DEEPSEEK_USD default $5  — code + reasoning
 *   NVIDIA: free tier, no cap
 */

// ── Pricing per 1M tokens (USD) ───────────────────────────────
const PRICING: Record<string, { input: number; output: number; maxTokens: number }> = {
  claude:   { input: 15.00, output: 75.00, maxTokens: 1024 },
  gpt:      { input: 2.50,  output: 10.00, maxTokens: 1024 },
  gemini:   { input: 0.075, output: 0.30,  maxTokens: 512  },
  deepseek: { input: 0.27,  output: 1.10,  maxTokens: 1024 },
  nvidia:   { input: 0,     output: 0,     maxTokens: 1024 },
};

// ── Monthly budget caps (USD) ─────────────────────────────────
const BUDGETS: Record<string, number> = {
  claude:   Number(process.env.BUDGET_CLAUDE_USD)   || 5,
  gpt:      Number(process.env.BUDGET_GPT_USD)      || 10,
  gemini:   Number(process.env.BUDGET_GEMINI_USD)   || 5,
  deepseek: Number(process.env.BUDGET_DEEPSEEK_USD) || 5,
  nvidia:   Infinity,
};

// ── In-memory usage tracker (resets on server restart) ───────
// For production: persist to DB or Redis
const usage: Record<string, { inputTokens: number; outputTokens: number }> = {
  claude: { inputTokens: 0, outputTokens: 0 },
  gpt:    { inputTokens: 0, outputTokens: 0 },
  gemini: { inputTokens: 0, outputTokens: 0 },
  deepseek: { inputTokens: 0, outputTokens: 0 },
  nvidia: { inputTokens: 0, outputTokens: 0 },
};

export function estimateCostUSD(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export function trackUsage(model: string, inputTokens: number, outputTokens: number): void {
  if (!usage[model]) usage[model] = { inputTokens: 0, outputTokens: 0 };
  usage[model].inputTokens  += inputTokens;
  usage[model].outputTokens += outputTokens;
}

export function getUsageSummary(): Record<string, { inputTokens: number; outputTokens: number; estimatedCostUSD: number; budgetUSD: number; budgetUsedPct: number }> {
  return Object.fromEntries(
    Object.entries(usage).map(([model, u]) => {
      const cost = estimateCostUSD(model, u.inputTokens, u.outputTokens);
      const budget = BUDGETS[model] ?? Infinity;
      return [model, {
        ...u,
        estimatedCostUSD: Math.round(cost * 10000) / 10000,
        budgetUSD: budget === Infinity ? -1 : budget,
        budgetUsedPct: budget === Infinity ? 0 : Math.round((cost / budget) * 100),
      }];
    })
  );
}

export function isBudgetExceeded(model: string): boolean {
  const u = usage[model];
  if (!u) return false;
  const cost = estimateCostUSD(model, u.inputTokens, u.outputTokens);
  return cost >= (BUDGETS[model] ?? Infinity);
}

export function getMaxTokens(model: string): number {
  return PRICING[model]?.maxTokens ?? 512;
}

// ── Smart task classifier ─────────────────────────────────────

export type TaskType =
  | 'simple'       // short reply, FAQ, greeting
  | 'creative'     // writing, brainstorm, content
  | 'code'         // code generation, debugging, technical
  | 'analytical'   // deep reasoning, legal, medical, research
  | 'bulk'         // summaries, scoring, batch processing
  | 'autonomous';  // agent loop synthesis

/**
 * Classify a message into a task type to select the right model.
 * Heuristics — fast, no AI call required.
 */
export function classifyTask(message: string): TaskType {
  const m = message.toLowerCase().trim();
  const len = m.length;

  // Very short or greeting → simple
  if (len < 60 || /^(oi|olá|hello|hi|hey|bom dia|boa tarde|tudo bem)/i.test(m)) return 'simple';

  // Code signals
  if (/```|function |const |class |import |def |SELECT |FROM |WHERE |async |await |\.ts|\.js|\.py|\.rs|bug|erro|error|debug|compile|deploy|git |npm |bun |cargo|anchor/i.test(m)) return 'code';

  // Analytical signals
  if (/analise|analyze|research|pesquisa|juridic|legal|medical|médic|contrato|contract|compliance|audit|profund|detail|explique|explain|compare|versus|diferença/i.test(m)) return 'analytical';

  // Creative signals
  if (/crie|create|escreva|write|redija|draft|gere|generate|ideia|idea|brainstorm|campanha|campaign|marketing|slogan|historia|story/i.test(m)) return 'creative';

  // Bulk / summary signals
  if (/resumo|summary|sumarize|classify|score|rate|avalie|evaluate|lista|list|batch/i.test(m)) return 'bulk';

  // Medium length → code or creative based on content
  if (len < 200) return 'simple';

  return 'creative'; // default
}

/**
 * Select the best (cheapest) model for a given task type.
 * Falls back to a cheaper model if budget is exceeded.
 */
export function selectModelForTask(taskType: TaskType, preferredModel?: string): string {
  // If user explicitly chose a model and budget allows, respect it
  if (preferredModel && !isBudgetExceeded(preferredModel)) {
    return preferredModel;
  }

  const candidates: Record<TaskType, string[]> = {
    simple:     ['nvidia', 'deepseek', 'gemini', 'gpt'],
    creative:   ['gpt',    'deepseek', 'gemini', 'nvidia'],
    code:       ['deepseek', 'nvidia', 'gpt', 'gemini'],
    analytical: ['claude', 'gpt', 'deepseek', 'gemini'],
    bulk:       ['gemini', 'nvidia', 'deepseek', 'gpt'],
    autonomous: ['nvidia', 'deepseek', 'gemini', 'gpt'],
  };

  const ordered = candidates[taskType] ?? ['deepseek'];
  for (const model of ordered) {
    if (!isBudgetExceeded(model)) return model;
  }

  return 'nvidia'; // last resort: always free
}

/**
 * Estimate tokens from text (rough: 1 token ≈ 4 chars in English, 2 in PT/ZH)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

/**
 * Truncate content to fit a token budget.
 * Returns the truncated string.
 */
export function truncateToTokenBudget(text: string, maxTokens: number): string {
  const maxChars = Math.floor(maxTokens * 3.5);
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + '...';
}
