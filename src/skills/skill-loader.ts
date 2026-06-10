import { readdir, readFile } from 'fs/promises';
import path from 'path';

export type SkillFrontmatter = {
  name: string;
  description: string;
  trigger: string;
  version: string;
};

export type MythosSkill = SkillFrontmatter & {
  id: string;
  fileName: string;
  body: string;
};

const SKILL_FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function parseFrontmatterBlock(block: string): Partial<SkillFrontmatter> {
  return block.split(/\r?\n/).reduce<Partial<SkillFrontmatter>>((acc, line) => {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) return acc;
    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, '');
    if (key === 'name' || key === 'description' || key === 'trigger' || key === 'version') {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function assertSkillFrontmatter(value: Partial<SkillFrontmatter>, fileName: string): SkillFrontmatter {
  const missing = (['name', 'description', 'trigger', 'version'] as const)
    .filter(key => !value[key]);
  if (missing.length > 0) {
    throw new Error(`Skill ${fileName} missing frontmatter fields: ${missing.join(', ')}`);
  }
  return {
    name: value.name as string,
    description: value.description as string,
    trigger: value.trigger as string,
    version: value.version as string,
  };
}

export function parseSkillMarkdown(fileName: string, markdown: string): MythosSkill {
  const match = markdown.match(SKILL_FRONTMATTER_PATTERN);
  if (!match) {
    throw new Error(`Skill ${fileName} must start with YAML frontmatter.`);
  }

  const frontmatter = assertSkillFrontmatter(parseFrontmatterBlock(match[1]), fileName);
  return {
    ...frontmatter,
    id: frontmatter.name,
    fileName,
    body: match[2].trim(),
  };
}

export async function loadSkills(skillsDirectory = path.join(process.cwd(), 'src', 'skills')): Promise<MythosSkill[]> {
  const entries = await readdir(skillsDirectory, { withFileTypes: true });
  const markdownFiles = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const skills = await Promise.all(markdownFiles.map(async fileName => {
    const markdown = await readFile(path.join(skillsDirectory, fileName), 'utf8');
    return parseSkillMarkdown(fileName, markdown);
  }));

  return skills;
}

export async function listSkillSummaries(skillsDirectory?: string): Promise<SkillFrontmatter[]> {
  const skills = await loadSkills(skillsDirectory);
  return skills.map(({ name, description, trigger, version }) => ({
    name,
    description,
    trigger,
    version,
  }));
}
