import type { MythosSkill } from '../skill-engine';

export const AI_ARTIFACT_REFINER_SKILL: MythosSkill = {
  id: 'ai-artifact-refiner',
  name: 'AI Artifact Refiner',
  stage: 'polish',
  description: 'Transforms mediocre AI-generated HTML into believable startup-grade premium UI.',
  enabled: true,
  priority: 80,
  systemPrompt: [
    'This is the most important polish pass. Upgrade hero, cards, grids, spacing, typography, glow usage, shadows, CTA quality, responsiveness, and visual credibility.',
    'The result should feel expensive, cinematic, believable, and production-grade.',
    'Keep it self-contained, dependency-free, read-only, and safe.',
  ].join(' '),
  transform: html => html.replace(
    '</style>',
    '\n/* Mythos AI artifact refiner: final premium polish without scripts or external assets. */\n</style>',
  ),
};
