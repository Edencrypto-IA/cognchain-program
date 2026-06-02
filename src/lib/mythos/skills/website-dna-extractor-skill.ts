import type { MythosSkill } from '../skill-engine';

export const WEBSITE_DNA_EXTRACTOR_SKILL: MythosSkill = {
  id: 'website-dna-extractor',
  name: 'Website DNA Extractor',
  stage: 'generation',
  description: 'Interprets a public website URL into structure, hierarchy, visual DNA, and regeneration constraints without copying protected code or assets.',
  enabled: true,
  priority: 5,
  systemPrompt: [
    'When a URL reference is present, use it as inspiration only.',
    'Extract layout intent, hierarchy, spacing rhythm, density, CTA patterns, and visual language.',
    'Never copy source code, logos, protected assets, full text, brand identity, wallet flows, or interactive behavior.',
  ].join(' '),
  runWhen: input => /\bhttps?:\/\//i.test(input),
};
