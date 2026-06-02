import { APPLE_DESIGN_SKILL } from './skills/apple-design-skill';
import { NVIDIA_INTERFACE_SKILL } from './skills/nvidia-interface-skill';
import { MAGIC_UX_SKILL } from './skills/magic-ux-skill';
import { MOBILE_NATIVE_SKILL } from './skills/mobile-native-skill';
import { VISUAL_INTELLIGENCE_SKILL } from './skills/visual-intelligence-skill';
import { AI_ARTIFACT_REFINER_SKILL } from './skills/ai-artifact-refiner';
import { MYTHOS_TERMINAL_SKILL } from './skills/mythos-terminal-skill';
import { WEBSITE_DNA_EXTRACTOR_SKILL } from './skills/website-dna-extractor-skill';
import { UI_EVOLUTION_SKILL } from './skills/ui-evolution-skill';
import { SAFETY_SKILL } from './skills/safety-skill';

export type MythosSkillStage = 'generation' | 'review' | 'polish' | 'mobile' | 'safety';

export interface MythosSkill {
  id: string;
  name: string;
  stage: MythosSkillStage;
  description: string;
  enabled: boolean;
  priority: number;
  systemPrompt: string;
  transform?: (html: string) => string;
  runWhen?: (input: string) => boolean;
}

export interface SkillExecutionContext {
  input: string;
  html?: string;
  stage?: MythosSkillStage;
  includeDisabled?: boolean;
}

export interface SkillExecutionResult {
  html: string;
  selectedSkills: string[];
  appliedSkills: string[];
  stages: Array<{
    stage: MythosSkillStage;
    skillId: string;
    changed: boolean;
  }>;
}

export const MYTHOS_PREMIUM_UI_SKILLS: MythosSkill[] = [
  WEBSITE_DNA_EXTRACTOR_SKILL,
  APPLE_DESIGN_SKILL,
  NVIDIA_INTERFACE_SKILL,
  UI_EVOLUTION_SKILL,
  MAGIC_UX_SKILL,
  VISUAL_INTELLIGENCE_SKILL,
  MOBILE_NATIVE_SKILL,
  AI_ARTIFACT_REFINER_SKILL,
  MYTHOS_TERMINAL_SKILL,
  SAFETY_SKILL,
];

export function selectSkills(context: SkillExecutionContext, skills = MYTHOS_PREMIUM_UI_SKILLS): MythosSkill[] {
  return skills
    .filter(skill => context.includeDisabled || skill.enabled)
    .filter(skill => !context.stage || skill.stage === context.stage)
    .filter(skill => skill.runWhen ? skill.runWhen(context.input) : true)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

export function applySkill(html: string, skill: MythosSkill): { html: string; changed: boolean } {
  if (!skill.transform) return { html, changed: false };
  const next = skill.transform(html);
  return { html: next, changed: next !== html };
}

export function executeSkillPipeline(context: SkillExecutionContext, skills = MYTHOS_PREMIUM_UI_SKILLS): SkillExecutionResult {
  const selected = selectSkills(context, skills);
  let html = context.html || '';
  const stages: SkillExecutionResult['stages'] = [];
  const appliedSkills: string[] = [];

  for (const skill of selected) {
    const result = applySkill(html, skill);
    html = result.html;
    if (skill.transform) appliedSkills.push(skill.id);
    stages.push({
      stage: skill.stage,
      skillId: skill.id,
      changed: result.changed,
    });
  }

  return {
    html,
    selectedSkills: selected.map(skill => skill.id),
    appliedSkills,
    stages,
  };
}

export function buildSkillPipelinePrompt(input: string, skills = selectSkills({ input })) {
  return skills.map(skill => [
    `Skill: ${skill.name}`,
    `Stage: ${skill.stage}`,
    `Priority: ${skill.priority}`,
    `Instruction: ${skill.systemPrompt}`,
  ].join('\n')).join('\n\n');
}
