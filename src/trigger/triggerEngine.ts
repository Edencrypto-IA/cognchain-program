import type { SkillFrontmatter } from '@/skills';

export type SkillMeta = SkillFrontmatter;

export type TriggerRisk = 'low' | 'medium' | 'high';
export type TriggerSource = 'web' | 'local' | 'on-chain' | 'unknown';

export interface TriggerReport {
  skill: string;
  risk: TriggerRisk;
  source: TriggerSource;
  reason: string;
  timestamp: number;
}

type SkillRule = {
  skill: string;
  patterns: RegExp[];
  reason: string;
};

type RiskRule = {
  risk: TriggerRisk;
  matches: (input: string, skill: string) => boolean;
};

type SourceRule = {
  source: TriggerSource;
  matches: (skill: string) => boolean;
};

const FALLBACK_REPORT: Omit<TriggerReport, 'timestamp'> = {
  skill: 'none',
  risk: 'low',
  source: 'unknown',
  reason: 'TriggerEngine fallback: intent could not be classified safely.',
};

const SKILL_RULES: SkillRule[] = [
  {
    skill: 'web-search',
    patterns: [
      /\b(buscar|pesquisa|pesquisar|search|not[ií]cia|noticia|noticias|not[ií]cias)\b/i,
    ],
    reason: 'Matched web-search keywords.',
  },
  {
    skill: 'url-reader',
    patterns: [
      /\bhttps?:\/\//i,
      /\b(url|site|pagina|p[aá]gina|link)\b/i,
      /\bleia esse link\b/i,
    ],
    reason: 'Matched URL/site reading intent.',
  },
  {
    skill: 'memory-store',
    patterns: [
      /\b(salvar mem[oó]ria|salve essa mem[oó]ria|lembrar|memorize|guardar contexto)\b/i,
    ],
    reason: 'Matched memory storage intent.',
  },
  {
    skill: 'memory-anchor',
    patterns: [
      /\b(ancorar|on-chain|onchain|blockchain|salvar hash|verificar hash)\b/i,
    ],
    reason: 'Matched memory anchoring intent.',
  },
];

const SENSITIVE_SECRET_PATTERNS = [
  /\b(seed phrase|mnemonic|private key|secret key|api[_ -]?key|access token|refresh token)\b/i,
  /\b(?:sk|pk|api|secret|token)_(?:live|test|prod)?_[A-Za-z0-9]{16,}\b/i,
];

const RISK_RULES: RiskRule[] = [
  {
    risk: 'high',
    matches: (input, skill) => skill === 'memory-anchor' ||
      SENSITIVE_SECRET_PATTERNS.some(pattern => pattern.test(input)),
  },
  {
    risk: 'medium',
    matches: (_input, skill) => skill === 'web-search' || skill === 'url-reader',
  },
  {
    risk: 'low',
    matches: () => true,
  },
];

const SOURCE_RULES: SourceRule[] = [
  {
    source: 'web',
    matches: skill => skill === 'web-search' || skill === 'url-reader',
  },
  {
    source: 'on-chain',
    matches: skill => skill === 'memory-anchor',
  },
  {
    source: 'local',
    matches: () => true,
  },
];

function skillExists(skill: string, availableSkills: SkillMeta[]): boolean {
  return skill === 'none' || availableSkills.some(item => item.name === skill);
}

function resolveSkill(input: string, availableSkills: SkillMeta[]): { skill: string; reason: string } {
  const matchedRule = SKILL_RULES.find(rule =>
    rule.patterns.some(pattern => pattern.test(input)) && skillExists(rule.skill, availableSkills)
  );

  if (!matchedRule) {
    return {
      skill: 'none',
      reason: 'No catalog skill matched the input.',
    };
  }

  return {
    skill: matchedRule.skill,
    reason: matchedRule.reason,
  };
}

function resolveRisk(input: string, skill: string): TriggerRisk {
  return RISK_RULES.find(rule => rule.matches(input, skill))?.risk || 'low';
}

function resolveSource(skill: string): TriggerSource {
  return SOURCE_RULES.find(rule => rule.matches(skill))?.source || 'unknown';
}

export async function analyzeIntent(input: string, availableSkills: SkillMeta[]): Promise<TriggerReport> {
  try {
    const safeInput = typeof input === 'string' ? input : '';
    const skills = Array.isArray(availableSkills) ? availableSkills : [];
    const { skill, reason } = resolveSkill(safeInput, skills);
    return {
      skill,
      risk: resolveRisk(safeInput, skill),
      source: resolveSource(skill),
      reason,
      timestamp: Date.now(),
    };
  } catch {
    return {
      ...FALLBACK_REPORT,
      timestamp: Date.now(),
    };
  }
}
