import type { MythosSkill } from '../skill-engine';

export const MYTHOS_TERMINAL_SKILL: MythosSkill = {
  id: 'mythos-terminal-skill',
  name: 'Mythos Terminal Skill',
  stage: 'generation',
  description: 'Applies the Mythos/CongChain visual DNA: black matte surfaces, neon green, cyan glow, holographic borders, and terminal-grade sophistication.',
  enabled: true,
  priority: 10,
  systemPrompt: [
    'Apply Mythos/CongChain identity: black matte backgrounds, neon green, cyan glow, holographic borders, terminal typography, and neural interface aesthetics.',
    'Make the artifact immediately recognizable as CongChain infrastructure, not a generic AI page.',
    'Use the protocol language safely: memory hash, proof route, read-only, human approval, sandboxed preview.',
  ].join(' '),
};
