import type { VerifiedFact } from './types';

const CONSENSUS_MULTIPLIER: Record<string, number> = {
  strong: 1.0, partial: 0.8, weak: 0.5, conflict: 0,
};

/** Calculate 0-100 confidence score for a verified fact */
export function calculateConfidence(fact: VerifiedFact): number {
  const base = Math.min(fact.sources.length * 20, 60);
  const credBonus = fact.sources.length > 0
    ? fact.sources.reduce((s, src) => s + src.credibilityScore, 0) / fact.sources.length
    : 0;
  const apiBonus = fact.sources.some(s => s.apiEndpoint) ? 25 : 0;
  const multiplier = CONSENSUS_MULTIPLIER[fact.consensus] ?? 0;

  const raw = (base + credBonus + apiBonus) * multiplier;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

/** Map confidence score to approval status */
export function confidenceToStatus(score: number): 'approved' | 'review' | 'blocked' {
  if (score >= 80) return 'approved';
  if (score >= 50) return 'review';
  return 'blocked';
}
