import type { MythosSkill } from '../skill-engine';

export const MAGIC_UX_SKILL: MythosSkill = {
  id: 'magic-ux-skill',
  name: 'Magic UX Skill',
  stage: 'polish',
  description: 'Adds premium perceived-performance and interaction polish inspired by Linear, Arc, Raycast, OpenAI Canvas, and Vercel.',
  enabled: true,
  priority: 42,
  systemPrompt: [
    'Improve hover feel, reading flow, visual responsiveness, perceived performance, and subtle transitions.',
    'The interface should feel alive, intelligent, cinematic, and premium without becoming distracting.',
    'Use CSS-only transitions and respect prefers-reduced-motion.',
  ].join(' '),
};
