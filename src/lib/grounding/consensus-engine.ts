import type { FactSource, ConsensusResult } from './types';

function numericValue(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[$,%]/g, ''));
    return isNaN(n) ? null : n;
  }
  return null;
}

function withinTolerance(a: number, b: number, pct: number): boolean {
  if (a === 0 && b === 0) return true;
  const avg = (Math.abs(a) + Math.abs(b)) / 2;
  return Math.abs(a - b) / avg <= pct;
}

/** Cross-reference sources and determine consensus level */
export function calculateConsensus(sources: readonly FactSource[]): ConsensusResult {
  if (sources.length === 0) return { type: 'weak', agreedValue: null };
  if (sources.length === 1) return { type: 'weak', agreedValue: sources[0].rawValue };

  const nums = sources.map(s => numericValue(s.rawValue)).filter((n): n is number => n !== null);

  if (nums.length >= 2) {
    // Group numbers within ±2% tolerance
    const groups: number[][] = [];
    for (const n of nums) {
      const g = groups.find(gr => withinTolerance(gr[0], n, 0.02));
      if (g) g.push(n);
      else groups.push([n]);
    }

    const largest = groups.sort((a, b) => b.length - a.length)[0];
    const agreedValue = largest.reduce((s, n) => s + n, 0) / largest.length;

    if (largest.length >= 3) return { type: 'strong', agreedValue };
    if (largest.length === 2) return { type: 'partial', agreedValue };

    // Check conflict — are there groups diverging >10%?
    if (groups.length >= 2 && !withinTolerance(groups[0][0], groups[1][0], 0.10)) {
      return { type: 'conflict', agreedValue: null };
    }
    return { type: 'weak', agreedValue };
  }

  // Non-numeric: check string agreement
  const vals = sources.map(s => String(s.rawValue).toLowerCase().trim());
  const freq = new Map<string, number>();
  for (const v of vals) freq.set(v, (freq.get(v) ?? 0) + 1);
  const [topVal, topCount] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];

  if (topCount >= 3) return { type: 'strong', agreedValue: topVal };
  if (topCount === 2) return { type: 'partial', agreedValue: topVal };
  return { type: 'weak', agreedValue: topVal };
}
