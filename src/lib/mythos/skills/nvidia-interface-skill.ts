import type { MythosSkill } from '../skill-engine';

export const NVIDIA_INTERFACE_SKILL: MythosSkill = {
  id: 'nvidia-interface-skill',
  name: 'NVIDIA Interface Skill',
  stage: 'generation',
  description: 'Shapes AI terminal interfaces with black graphite surfaces, neon green/cyan accents, and restrained AGI infrastructure depth.',
  enabled: true,
  priority: 20,
  systemPrompt: [
    'Apply NVIDIA-grade AI interface aesthetics: matte black, graphite panels, neon green, cyan highlights, neural terminal grids.',
    'Use glow sparingly. Keep the result infrastructure-grade, not gaming-themed.',
    'No remote scripts, CDNs, wallet actions, blockchain signing, or fake live balances.',
  ].join(' '),
  runWhen: input => /\b(ai|agent|terminal|dashboard|solana|token|crypto|mythos|congchain)\b/i.test(input),
};
