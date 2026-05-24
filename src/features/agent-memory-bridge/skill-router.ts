import {
  MYTHOS_FEATURED_SKILLS,
  MYTHOS_SKILL_CATEGORIES,
  type MythosFeaturedSkill,
} from './mythos';

export type MythosSkillRouteAlternative = {
  id: string;
  name: string;
  category: string;
  score: number;
  reason: string;
};

export type MythosSkillRouteResult = {
  ok: true;
  router: 'mythos_skill_router_v1';
  inputSummary: string;
  selectedSkill: MythosFeaturedSkill;
  categoryLabel: string;
  confidence: number;
  confidenceLabel: 'high' | 'medium' | 'low';
  reason: string;
  command: string;
  alternatives: MythosSkillRouteAlternative[];
  safety: {
    autoExecutesSkill: false;
    requiresHumanReview: true;
    storesSecrets: false;
    movesFunds: false;
    writesMemoryAutomatically: false;
  };
};

type RouterRule = {
  skillId: string;
  reason: string;
  keywords: string[];
  weight?: number;
};

const SECRET_PATTERNS = [
  /\bcog_live_[a-z0-9]+/i,
  /\b(api[_-]?key|secret|private[_-]?key|seed phrase|mnemonic|token)\b/i,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/,
];

const ROUTER_RULES: RouterRule[] = [
  {
    skillId: 'solana-tx-inspector',
    reason: 'The request mentions transaction evidence, hashes, Solana status, accounts, fees, or explorer-style debugging.',
    keywords: ['tx', 'transaction', 'signature', 'hash', 'solscan', 'explorer', 'slot', 'fee', 'instruction', 'transacao', 'transação'],
    weight: 5,
  },
  {
    skillId: 'solana-developer',
    reason: 'The request looks like Solana development work involving Anchor, PDAs, CPI, SPL, wallets, or program debugging.',
    keywords: ['anchor', 'pda', 'program', 'idl', 'cpi', 'spl', 'rust', 'solana dev', 'constraint', 'account', 'wallet', 'phantom', 'solflare'],
    weight: 5,
  },
  {
    skillId: 'solana-anchor-schema-validator',
    reason: 'The request points to Anchor schema, IDL, account layout, instruction names, or constraint validation.',
    keywords: ['idl', 'schema', 'constraintseeds', 'constraint', 'account layout', 'anchor error', 'program id', 'seeds'],
    weight: 6,
  },
  {
    skillId: 'congchain-memory',
    reason: 'The request is about saving verifiable memory, hashes, isolated vaults, proof URLs, or the Agent Memory Bridge.',
    keywords: ['memory', 'memoria', 'memória', 'vault', 'hash', 'proof', 'bridge', 'congchain', 'save memory', 'salvar memoria', 'salvar memória'],
    weight: 5,
  },
  {
    skillId: 'congchain-memory-search',
    reason: 'The user wants to find, resume, list, or recover prior Mythos/CongChain memory.',
    keywords: ['search memory', 'find memory', 'listar memoria', 'buscar memoria', 'recuperar', 'resume', 'history', 'historico', 'histórico'],
    weight: 6,
  },
  {
    skillId: 'congchain-session-audit',
    reason: 'The request asks for an audit, receipt, proof of work, review trail, or operational report.',
    keywords: ['audit', 'auditoria', 'receipt', 'recibo', 'report', 'relatorio', 'relatório', 'handoff', 'prova', 'review'],
    weight: 5,
  },
  {
    skillId: 'congchain-confidence-calibration',
    reason: 'The request needs uncertainty, confidence, evidence quality, or an explicit decision explanation.',
    keywords: ['confidence', 'confianca', 'confiança', 'certeza', 'evidence', 'evidencia', 'evidência', 'why', 'por que', 'decisao', 'decisão'],
    weight: 4,
  },
  {
    skillId: 'web3-researcher',
    reason: 'The request is research or due diligence around Web3, tokens, projects, ecosystem signals, or market intelligence.',
    keywords: ['research', 'pesquisa', 'tokenomics', 'token', 'rug', 'holder', 'holders', 'distribution', 'market', 'ecosystem', 'investir', 'risk'],
    weight: 5,
  },
  {
    skillId: 'mythos-deployer',
    reason: 'The request is operational setup for Mythos, providers, gateway, Railway, Docker, deployment, or runtime health.',
    keywords: ['deploy', 'railway', 'docker', 'gateway', 'doctor', 'runtime', 'env', 'setup', 'provider', 'telegram', 'discord', 'api key'],
    weight: 5,
  },
  {
    skillId: 'agent-architect',
    reason: 'The request is about multi-agent design, delegation, runtime architecture, agent memory standards, or orchestration.',
    keywords: ['agent', 'agente', 'subagent', 'delegation', 'orchestration', 'orquestracao', 'orquestração', 'hermes', 'openclaw', 'eliza', 'mythos'],
    weight: 4,
  },
  {
    skillId: 'systematic-debugging',
    reason: 'The request describes a bug, failure, error, 401/403/500, broken deploy, or an investigation path.',
    keywords: ['bug', 'debug', 'erro', 'error', 'falha', 'failed', 'failure', '401', '403', '404', '500', 'quebrou', 'troubleshoot'],
    weight: 5,
  },
  {
    skillId: 'codebase-inspection',
    reason: 'The request needs repository reading, file references, architecture discovery, or codebase orientation.',
    keywords: ['repo', 'repository', 'codebase', 'codigo', 'código', 'files', 'arquivos', 'readme', 'inspect', 'inspecionar'],
    weight: 4,
  },
  {
    skillId: 'test-driven-development',
    reason: 'The request needs tests, validation, safer implementation, or regression prevention.',
    keywords: ['test', 'teste', 'tests', 'coverage', 'validar', 'validation', 'regression', 'build', 'eslint'],
    weight: 4,
  },
  {
    skillId: 'rest-graphql-debug',
    reason: 'The request points to API contracts, headers, auth, REST, GraphQL, webhooks, or integration errors.',
    keywords: ['rest', 'graphql', 'endpoint', 'webhook', 'header', 'auth', 'oauth', 'callback', 'api'],
    weight: 4,
  },
  {
    skillId: 'arxiv',
    reason: 'The request needs scientific papers, academic validation, or source-backed AI research.',
    keywords: ['paper', 'artigo', 'scientific', 'cientifico', 'científico', 'arxiv', 'research paper', 'faculdade', 'universidade'],
    weight: 5,
  },
  {
    skillId: 'architecture-diagram',
    reason: 'The request asks for diagrams, architecture visuals, flows, or technical maps.',
    keywords: ['diagram', 'diagrama', 'architecture', 'arquitetura', 'flow', 'mapa', 'visual'],
    weight: 4,
  },
  {
    skillId: 'popular-web-designs',
    reason: 'The request is UI, landing page, dashboard, card design, or visual refinement.',
    keywords: ['design', 'ui', 'ux', 'pagina', 'página', 'layout', 'card', 'visual', 'interface', 'frontend'],
    weight: 4,
  },
  {
    skillId: 'pt-br-operator',
    reason: 'The request is in Portuguese and benefits from Brazil-local setup guidance and clear operator language.',
    keywords: ['como faço', 'como fazer', 'me ajuda', 'portugues', 'português', 'railway', 'chave', 'configurar'],
    weight: 3,
  },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findSkill(id: string) {
  return MYTHOS_FEATURED_SKILLS.find(skill => skill.id === id);
}

function scoreRule(input: string, rule: RouterRule) {
  const normalized = normalize(input);
  const matches = rule.keywords.filter(keyword => normalized.includes(normalize(keyword)));
  return {
    score: matches.length * (rule.weight || 3),
    matches,
  };
}

function summarizeInput(input: string) {
  const clean = input.replace(/\s+/g, ' ').trim();
  return clean.length > 180 ? `${clean.slice(0, 180)}...` : clean;
}

function confidenceFromScore(score: number, totalMatches: number) {
  if (score >= 18 || totalMatches >= 4) return 0.92;
  if (score >= 10 || totalMatches >= 2) return 0.78;
  if (score >= 5) return 0.64;
  return 0.52;
}

export function routeMythosSkill(input: string, currentSkillId?: string): MythosSkillRouteResult {
  const text = input.trim();
  if (!text) {
    throw new Error('Prompt is required for Mythos skill routing.');
  }

  const blockedSecret = SECRET_PATTERNS.some(pattern => pattern.test(text));
  const scored = ROUTER_RULES
    .map(rule => {
      const result = scoreRule(text, rule);
      return {
        rule,
        score: result.score,
        matches: result.matches,
      };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const fallbackRule = currentSkillId
    ? ROUTER_RULES.find(rule => rule.skillId === currentSkillId)
    : undefined;
  const top = scored[0] || fallbackRule
    ? scored[0] || { rule: fallbackRule as RouterRule, score: 2, matches: [] }
    : {
      rule: {
        skillId: 'congchain-session-audit',
        reason: 'No specialized route matched, so Mythos uses a safe session-audit wrapper to explain the work before action.',
        keywords: [],
      },
      score: 2,
      matches: [],
    };

  const selectedSkill = findSkill(top.rule.skillId) || MYTHOS_FEATURED_SKILLS[0];
  const categoryLabel = MYTHOS_SKILL_CATEGORIES.find(category => category.id === selectedSkill.category)?.label || selectedSkill.category;
  const totalMatches = top.matches.length;
  const confidence = blockedSecret ? 0.48 : confidenceFromScore(top.score, totalMatches);
  const alternatives = scored
    .filter(item => item.rule.skillId !== selectedSkill.id)
    .slice(0, 3)
    .map(item => {
      const skill = findSkill(item.rule.skillId) || MYTHOS_FEATURED_SKILLS[0];
      return {
        id: skill.id,
        name: skill.name,
        category: skill.category,
        score: item.score,
        reason: item.rule.reason,
      };
    });

  return {
    ok: true,
    router: 'mythos_skill_router_v1',
    inputSummary: summarizeInput(text),
    selectedSkill,
    categoryLabel,
    confidence,
    confidenceLabel: confidence >= 0.85 ? 'high' : confidence >= 0.65 ? 'medium' : 'low',
    reason: blockedSecret
      ? 'The prompt appears to contain a secret-like value. Mythos routes to a safe review path and should ask the user to remove secrets before execution.'
      : top.rule.reason,
    command: selectedSkill.command,
    alternatives,
    safety: {
      autoExecutesSkill: false,
      requiresHumanReview: true,
      storesSecrets: false,
      movesFunds: false,
      writesMemoryAutomatically: false,
    },
  };
}
