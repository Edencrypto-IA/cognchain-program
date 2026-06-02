import type { MythosSkill } from '../skill-engine';

export const MOBILE_NATIVE_SKILL: MythosSkill = {
  id: 'mobile-native-skill',
  name: 'Mobile Native Skill',
  stage: 'mobile',
  description: 'Makes artifacts feel like premium native mobile experiences with safe touch targets, hierarchy, and overflow control.',
  enabled: true,
  priority: 70,
  systemPrompt: [
    'Audit 375px mobile layouts first. Use stacked grids, stable card widths, 44px touch targets, readable line length, and no horizontal overflow.',
    'Mobile must feel native, premium, and intentionally composed.',
    'Do not scale typography directly with viewport width; prefer clamp with sane min/max.',
  ].join(' '),
  transform: html => html.replace(
    '</style>',
    '\n@media (max-width: 640px) { .shell { width: 100%; } button, a { min-height: 44px; } }\n</style>',
  ),
};
