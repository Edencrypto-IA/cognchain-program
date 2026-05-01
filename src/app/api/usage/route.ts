import { NextResponse } from 'next/server';
import { getUsageSummary } from '@/services/ai';

// GET /api/usage — token consumption and budget status per model
export async function GET() {
  const summary = getUsageSummary();

  const totalCostUSD = Object.values(summary)
    .reduce((sum, m) => sum + m.estimatedCostUSD, 0);

  const alerts = Object.entries(summary)
    .filter(([, m]) => m.budgetUSD > 0 && m.budgetUsedPct >= 80)
    .map(([model, m]) => ({
      model,
      message: `${model} at ${m.budgetUsedPct}% of $${m.budgetUSD} budget`,
      critical: m.budgetUsedPct >= 100,
    }));

  return NextResponse.json({
    models: summary,
    totalCostUSD: Math.round(totalCostUSD * 10000) / 10000,
    alerts,
    tip: totalCostUSD === 0
      ? 'No usage tracked yet. Make some AI calls first.'
      : alerts.length > 0
        ? 'Budget warnings detected — check alerts.'
        : 'All budgets healthy.',
  });
}
