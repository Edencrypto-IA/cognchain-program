import { createSafetySkillTransform } from '../html-artifact-safety';
import type { MythosSkill } from '../skill-engine';

export const SAFETY_SKILL: MythosSkill = {
  id: 'html-safety',
  name: 'HTML Artifact Safety',
  stage: 'safety',
  description: 'Runs the final Mythos safety pass for sandboxed HTML artifacts.',
  enabled: true,
  priority: 999,
  systemPrompt: [
    'Always keep Mythos HTML artifacts read-only and sandbox-safe.',
    'Block external scripts, iframes, wallet provider access, fake wallet connect UI, seed phrase or private key fields, API key collection, auto-submit forms, clipboard hijacking, redirects, storage writes, eval, Function constructors, and javascript: links.',
    'If unsafe behavior would appear, replace it with inert visual placeholders and keep the preview informational only.',
    'Never generate wallet signing, transaction submission, buy, sell, swap, claim, payment, schedule, or fund movement behavior.',
  ].join(' '),
  transform: createSafetySkillTransform(),
};
