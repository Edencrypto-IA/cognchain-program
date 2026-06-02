import type { MythosSkill } from '../skill-engine';

export const UI_EVOLUTION_SKILL: MythosSkill = {
  id: 'ui-evolution-skill',
  name: 'UI Evolution Skill',
  stage: 'polish',
  description: 'Turns an interpreted website or rough UI into a better, cleaner, more premium Mythos/CongChain version.',
  enabled: true,
  priority: 35,
  systemPrompt: [
    'Improve the referenced UI instead of cloning it.',
    'Upgrade spacing, hierarchy, mobile behavior, CTA clarity, premium feel, and visual consistency.',
    'The output must be a new, editable, self-contained Mythos artifact with original wording and no protected assets.',
  ].join(' '),
  runWhen: input => /\b(https?:\/\/|make this better|improve this|melhore|recrie|refa[cç]a|site)\b/i.test(input),
};
