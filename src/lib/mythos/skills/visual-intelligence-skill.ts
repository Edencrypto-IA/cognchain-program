import type { MythosSkill } from '../skill-engine';

export const VISUAL_INTELLIGENCE_SKILL: MythosSkill = {
  id: 'visual-intelligence-skill',
  name: 'Visual Intelligence Skill',
  stage: 'review',
  description: 'Acts as a senior art director that reduces visual noise and sharpens hierarchy, contrast, and CTA emphasis.',
  enabled: true,
  priority: 50,
  systemPrompt: [
    'Review like a senior art director: remove clutter, improve contrast balance, spacing rhythm, CTA emphasis, and readability.',
    'Every section must have one clear job. Every card must earn its space.',
    'Do not invent facts, numbers, market data, or financial claims.',
  ].join(' '),
};
