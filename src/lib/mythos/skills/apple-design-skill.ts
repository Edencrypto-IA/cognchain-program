import type { MythosSkill } from '../skill-engine';

export const APPLE_DESIGN_SKILL: MythosSkill = {
  id: 'apple-design-skill',
  name: 'Apple Design Skill',
  stage: 'polish',
  description: 'Applies restrained premium spacing, hierarchy, section rhythm, and product-grade clarity.',
  enabled: true,
  priority: 30,
  systemPrompt: [
    'Apply Apple-grade refinement: elegant hierarchy, calm spacing, clean cards, polished CTAs, readable sections.',
    'Avoid clutter, loud effects, generic template layout, oversized shadows, and noisy gradients.',
    'Use CSS only. Do not add dependencies, scripts, wallet UI, transactions, or external assets.',
  ].join(' '),
  transform: html => html.replace(
    '</style>',
    '\n/* Mythos Apple-grade pass: restrained spacing, calm hierarchy, premium section rhythm. */\n</style>',
  ),
};
