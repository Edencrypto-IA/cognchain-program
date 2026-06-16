export type MythosHtmlSkillName =
  | 'html-design-director'
  | 'web3-landing-architect'
  | 'token-page-copywriter'
  | 'premium-ui-refiner'
  | 'responsive-layout-auditor'
  | 'visual-hierarchy-reviewer'
  | 'cta-conversion-designer'
  | 'dark-terminal-design-system'
  | 'solana-dashboard-designer'
  | 'sandbox-safety-reviewer'
  | 'accessibility-pass'
  | 'mobile-polish-pass';

export type MythosHtmlPresetName =
  | 'token-landing-page'
  | 'memecoin-launch-page'
  | 'solana-wallet-dashboard'
  | 'crypto-market-report'
  | 'ai-agent-profile'
  | 'waitlist-page'
  | 'pitch-deck-page'
  | 'docs-whitepaper-page';

export type MythosHtmlSkill = {
  name: MythosHtmlSkillName;
  label: string;
  stage?: 'brief' | 'architecture' | 'generation' | 'review' | 'safety' | 'polish';
  objective: string;
  whenToUse: string;
  securityRules: string[];
  internalPrompt: string;
  enabled?: boolean;
};

export interface SkillExecutionContext {
  userPrompt: string;
  presetName?: MythosHtmlPresetName;
  provider?: string;
  mobileFirst?: boolean;
  applyBrandSystem?: boolean;
}

export interface SkillResult {
  skill: MythosHtmlSkillName;
  ok: boolean;
  output: string;
  warnings: string[];
}

export interface MythosSkill extends MythosHtmlSkill {
  id: MythosHtmlSkillName;
  description: string;
  systemPrompt: string;
  enabled: boolean;
  runWhen: (context: SkillExecutionContext) => boolean;
}

export type MythosDesignPreset = {
  name: MythosHtmlPresetName;
  label: string;
  sections: string[];
  visualStyle: string;
  palette: {
    bg: string;
    surface: string;
    accent: string;
    text: string;
    muted: string;
  };
  components: string[];
  primaryCta: string;
  avoidErrors: string[];
};

export const MYTHOS_HTML_SKILLS: Record<MythosHtmlSkillName, MythosHtmlSkill> = {
  'html-design-director': {
    name: 'html-design-director',
    label: 'HTML Design Director',
    objective: 'Turn a raw user request into a premium visual direction before code is generated.',
    whenToUse: 'Always first for HTML artifact generation.',
    securityRules: [
      'Do not emit executable wallet, payment, swap, or signing flows.',
      'Flag requests involving seed phrases, private keys, API keys, or signed payloads.',
    ],
    internalPrompt: 'Create a concise visual brief: page type, layout, palette, typography mood, sections, CTA, animation level, and safety flags.',
  },
  'web3-landing-architect': {
    name: 'web3-landing-architect',
    label: 'Web3 Landing Architect',
    objective: 'Define section architecture for Solana, token, protocol, and launch pages.',
    whenToUse: 'Use for token pages, memecoin pages, waitlists, pitch pages, and protocol homepages.',
    securityRules: [
      'No wallet-connect architecture.',
      'No buy, sell, swap, or guaranteed-profit CTA.',
      'Tokenomics must include a not-financial-advice disclaimer.',
    ],
    internalPrompt: 'Create a 6-9 section layout with purpose, visual treatment, and content hints for each section.',
  },
  'token-page-copywriter': {
    name: 'token-page-copywriter',
    label: 'Token Page Copywriter',
    objective: 'Generate sharper headlines, subcopy, features, disclaimers, and informational CTAs.',
    whenToUse: 'Use when a project, token, ticker, or launch page is requested.',
    securityRules: [
      'No ROI promises.',
      'No fake market cap, liquidity, holder count, or price data.',
      'CTAs are informational only.',
    ],
    internalPrompt: 'Write concise Web3 copy with clear labels for demo/placeholder values and no invented market facts.',
  },
  'premium-ui-refiner': {
    name: 'premium-ui-refiner',
    label: 'Premium UI Refiner',
    objective: 'Raise visual quality with spacing, rhythm, depth, gradients, hover states, and component polish.',
    whenToUse: 'Use as a quality pass for all generated HTML.',
    securityRules: [
      'Do not add external scripts, images, fonts, iframes, or dependencies.',
      'Do not add wallet, transaction, or storage behavior.',
    ],
    internalPrompt: 'Improve spacing, typography hierarchy, cards, buttons, shadows, gradients, and micro-interactions using CSS only.',
  },
  'responsive-layout-auditor': {
    name: 'responsive-layout-auditor',
    label: 'Responsive Layout Auditor',
    objective: 'Prevent mobile and tablet layout breakage.',
    whenToUse: 'Use after visual generation or refinement.',
    securityRules: ['No external dependencies.', 'Preserve safety comments and blocked behavior.'],
    internalPrompt: 'Ensure 375px, 768px, and desktop layouts do not overflow. Use fluid widths, clamp(), and responsive grids.',
  },
  'visual-hierarchy-reviewer': {
    name: 'visual-hierarchy-reviewer',
    label: 'Visual Hierarchy Reviewer',
    objective: 'Make the reading path clear from hero to value proposition to CTA.',
    whenToUse: 'Use when generated pages feel flat or generic.',
    securityRules: ['Do not alter claims into financial advice.', 'Do not add invented facts.'],
    internalPrompt: 'Make the H1 dominant, section hierarchy clear, CTA visible, contrast readable, and muted text still legible.',
  },
  'cta-conversion-designer': {
    name: 'cta-conversion-designer',
    label: 'CTA Conversion Designer',
    objective: 'Improve informational CTA design and placement.',
    whenToUse: 'Use for landing pages, token pages, waitlists, and agent profiles.',
    securityRules: [
      'No buy-now, swap, sign, submit, claim airdrop, or wallet-connect actions.',
      'No fake urgency or financial scarcity.',
    ],
    internalPrompt: 'Use safe CTAs such as Explore, Learn, Read Docs, Join Community, View Demo, or View Explorer.',
  },
  'dark-terminal-design-system': {
    name: 'dark-terminal-design-system',
    label: 'Dark Terminal Design System',
    objective: 'Apply the CongChain/Mythos black, neon green, cyan, terminal-grade brand language.',
    whenToUse: 'Use by default for Mythos artifacts unless the user asks for a different brand.',
    securityRules: ['Use system fonts only.', 'No external assets or script sources.'],
    internalPrompt: 'Use black surfaces, neon green/cyan accents, terminal details, scanline-like CSS, tight cards, and professional density.',
  },
  'solana-dashboard-designer': {
    name: 'solana-dashboard-designer',
    label: 'Solana Dashboard Designer',
    stage: 'generation',
    objective: 'Design data-rich Solana dashboards that feel credible, source-labeled, and safe.',
    whenToUse: 'Use for wallet, portfolio, token analytics, market, DeFi, and protocol dashboards.',
    securityRules: [
      'All numbers must be labeled demo, placeholder, estimated, or source-backed.',
      'No send, receive, swap, claim, sign, or connect wallet actions.',
      'No live RPC calls inside the artifact HTML.',
    ],
    internalPrompt: 'Create dense but readable Solana dashboards with metric cards, tables, risk chips, source labels, and demo-only data boundaries.',
  },
  'sandbox-safety-reviewer': {
    name: 'sandbox-safety-reviewer',
    label: 'Sandbox Safety Reviewer',
    objective: 'Final gate that removes or blocks unsafe HTML patterns before preview.',
    whenToUse: 'Always last.',
    securityRules: [
      'Remove external scripts and iframes.',
      'Remove wallet SDK access.',
      'Remove hidden inputs, secret fields, auto-submit, clipboard writes, and javascript: links.',
    ],
    internalPrompt: 'Sanitize all unsafe patterns and preserve a read-only visual preview.',
  },
  'accessibility-pass': {
    name: 'accessibility-pass',
    label: 'Accessibility Pass',
    stage: 'polish',
    objective: 'Improve readability, contrast, focus states, labels, and motion restraint.',
    whenToUse: 'Use for every artifact after visual refinement and before final preview.',
    securityRules: [
      'Do not add external dependencies.',
      'Do not add forms for sensitive data.',
      'Do not weaken safety removals.',
    ],
    internalPrompt: 'Improve semantic structure, color contrast, visible focus states, aria labels where needed, reduced-motion support, and readable mobile typography.',
  },
  'mobile-polish-pass': {
    name: 'mobile-polish-pass',
    label: 'Mobile Polish Pass',
    objective: 'Make viral/social pages feel polished on phone screens.',
    whenToUse: 'Use for token, memecoin, launch, waitlist, and social-share pages.',
    securityRules: ['No external dependencies.', 'No fund-moving action.'],
    internalPrompt: 'Ensure touch targets, readable text, stacked grids, no horizontal overflow, and strong above-fold CTA.',
  },
};

export const MYTHOS_DESIGN_PRESETS: Record<MythosHtmlPresetName, MythosDesignPreset> = {
  'token-landing-page': {
    name: 'token-landing-page',
    label: 'Token Landing Page',
    sections: ['hero', 'stats', 'about', 'features', 'tokenomics', 'roadmap', 'community', 'footer'],
    visualStyle: 'Premium Web3 landing page with dark depth, crisp sections, and token identity as first-viewport signal.',
    palette: { bg: '#000000', surface: '#0b0f0b', accent: '#76ff03', text: '#f4fff0', muted: '#8a9487' },
    components: ['hero badge', 'ticker lockup', 'stat strip', 'feature grid', 'tokenomics panel', 'roadmap timeline', 'community CTA'],
    primaryCta: 'Explore Project',
    avoidErrors: ['No fake price data', 'No wallet connect', 'No buy button', 'No ROI claim'],
  },
  'memecoin-launch-page': {
    name: 'memecoin-launch-page',
    label: 'Memecoin Launch Page',
    sections: ['hero', 'mascot', 'vibe', 'tokenomics', 'how-it-works', 'community', 'footer'],
    visualStyle: 'Energetic but controlled. Fun mascot language with professional launch safety.',
    palette: { bg: '#030303', surface: '#10130d', accent: '#ffd166', text: '#ffffff', muted: '#9c9c8f' },
    components: ['mascot placeholder', 'ticker chip', 'meme cards', 'safe launch notes', 'community CTA'],
    primaryCta: 'Join Community',
    avoidErrors: ['No guaranteed gains', 'No fake DEX embeds', 'No click-to-buy', 'No clipboard automation'],
  },
  'solana-wallet-dashboard': {
    name: 'solana-wallet-dashboard',
    label: 'Solana Wallet Dashboard',
    sections: ['header', 'portfolio', 'tokens', 'activity', 'risk', 'notes'],
    visualStyle: 'Data-dense terminal dashboard with source labels and demo-only values.',
    palette: { bg: '#050705', surface: '#0d130f', accent: '#00d4ff', text: '#edf7f2', muted: '#7b8780' },
    components: ['wallet chip', 'metric cards', 'token table', 'activity rail', 'risk chips'],
    primaryCta: 'View Report',
    avoidErrors: ['No real RPC in HTML', 'No send form', 'No signing flow', 'Mark data as demo if not real'],
  },
  'crypto-market-report': {
    name: 'crypto-market-report',
    label: 'Crypto Market Report',
    sections: ['header', 'summary', 'market', 'solana', 'risks', 'watchlist', 'footer'],
    visualStyle: 'Editorial market brief with clear facts, estimates, risk labels, and disclaimers.',
    palette: { bg: '#070707', surface: '#111111', accent: '#7de4ff', text: '#f2f2f2', muted: '#8c8c8c' },
    components: ['summary callout', 'data table', 'risk labels', 'watchlist cards', 'disclaimer'],
    primaryCta: 'Read Analysis',
    avoidErrors: ['No financial advice', 'No invented prices', 'No price targets as facts'],
  },
  'ai-agent-profile': {
    name: 'ai-agent-profile',
    label: 'AI Agent Profile',
    sections: ['hero', 'status', 'capabilities', 'memory', 'skills', 'audit', 'footer'],
    visualStyle: 'Sci-fi operational console with agent status, memory proof, and capability cards.',
    palette: { bg: '#000000', surface: '#071006', accent: '#76ff03', text: '#f7fff2', muted: '#82907c' },
    components: ['agent avatar', 'status pill', 'capability grid', 'memory hash block', 'audit trail'],
    primaryCta: 'View Capabilities',
    avoidErrors: ['No real API key form', 'No auto-connect', 'No hidden prompts'],
  },
  'waitlist-page': {
    name: 'waitlist-page',
    label: 'Waitlist Page',
    sections: ['hero', 'value', 'form-demo', 'social-proof', 'footer'],
    visualStyle: 'Focused conversion page with one dominant safe CTA and clear demo labeling.',
    palette: { bg: '#050505', surface: '#101010', accent: '#00d4ff', text: '#f2f6f7', muted: '#858b8d' },
    components: ['hero CTA', 'value bullets', 'demo form', 'proof strip'],
    primaryCta: 'Join Waitlist',
    avoidErrors: ['Do not collect real email unless backend exists', 'No fake countdown', 'No hidden inputs'],
  },
  'pitch-deck-page': {
    name: 'pitch-deck-page',
    label: 'Pitch Deck Page',
    sections: ['cover', 'problem', 'solution', 'market', 'product', 'traction', 'team', 'ask'],
    visualStyle: 'Investor-grade dark slides with strong hierarchy and no fabricated metrics.',
    palette: { bg: '#020202', surface: '#0e0e0e', accent: '#76ff03', text: '#f8f8f8', muted: '#8a8a8a' },
    components: ['slide sections', 'metric callouts', 'product panels', 'team placeholders'],
    primaryCta: 'Review Deck',
    avoidErrors: ['No fake traction', 'No fake logos', 'No guaranteed projections'],
  },
  'docs-whitepaper-page': {
    name: 'docs-whitepaper-page',
    label: 'Docs / Whitepaper Page',
    sections: ['header', 'abstract', 'toc', 'sections', 'references', 'footer'],
    visualStyle: 'Readable technical document with terminal code styling and restrained accents.',
    palette: { bg: '#080808', surface: '#101010', accent: '#7de4ff', text: '#e8f0f0', muted: '#8a9292' },
    components: ['TOC', 'callouts', 'code blocks', 'footnotes', 'section anchors'],
    primaryCta: 'Read Docs',
    avoidErrors: ['No fake PDF link', 'No walls of text', 'No external scripts'],
  },
};

export function getMythosHtmlSkill(name: MythosHtmlSkillName) {
  return MYTHOS_HTML_SKILLS[name];
}

export function getMythosDesignPreset(name: MythosHtmlPresetName) {
  return MYTHOS_DESIGN_PRESETS[name];
}

export function inferMythosHtmlPreset(userPrompt: string): MythosHtmlPresetName {
  const lower = userPrompt.toLowerCase();
  if (/\b(wallet|carteira|portfolio|dashboard)\b/.test(lower)) return 'solana-wallet-dashboard';
  if (/\b(report|relatorio|relat[oó]rio|market|mercado)\b/.test(lower)) return 'crypto-market-report';
  if (/\b(agent|agente|mythos|profile|perfil)\b/.test(lower)) return 'ai-agent-profile';
  if (/\b(waitlist|espera|lista)\b/.test(lower)) return 'waitlist-page';
  if (/\b(deck|pitch|investor|investidor)\b/.test(lower)) return 'pitch-deck-page';
  if (/\b(docs|whitepaper|paper|documenta[cç][aã]o)\b/.test(lower)) return 'docs-whitepaper-page';
  if (/\b(meme|memecoin|pump|pumpfun|pump\.fun)\b/.test(lower)) return 'memecoin-launch-page';
  return 'token-landing-page';
}

export function resolveMythosHtmlSkills(
  userPrompt: string,
  options: { applyBrandSystem?: boolean; mobileFirst?: boolean } = {},
): MythosHtmlSkillName[] {
  const pipeline: MythosHtmlSkillName[] = [
    'html-design-director',
    'web3-landing-architect',
    'token-page-copywriter',
    'premium-ui-refiner',
    'responsive-layout-auditor',
    'visual-hierarchy-reviewer',
    'cta-conversion-designer',
  ];

  if (/\b(wallet|carteira|portfolio|dashboard|solana|defi|token table)\b/i.test(userPrompt)) {
    pipeline.push('solana-dashboard-designer');
  }
  if (options.applyBrandSystem !== false) pipeline.push('dark-terminal-design-system');
  pipeline.push('accessibility-pass');
  if (options.mobileFirst !== false) pipeline.push('mobile-polish-pass');
  pipeline.push('sandbox-safety-reviewer');
  return pipeline;
}

export const DESIGN_PRESETS = MYTHOS_DESIGN_PRESETS;

export const MYTHOS_SKILLS = Object.fromEntries(
  Object.entries(MYTHOS_HTML_SKILLS).map(([id, skill]) => [
    id,
    {
      ...skill,
      id: id as MythosHtmlSkillName,
      description: skill.objective,
      systemPrompt: skill.internalPrompt,
      enabled: skill.enabled ?? true,
        runWhen: (_context: SkillExecutionContext) => true,
    },
  ]),
) as unknown as Record<MythosHtmlSkillName, MythosSkill>;

export function selectSkills(context: SkillExecutionContext): MythosSkill[] {
  return resolveMythosHtmlSkills(context.userPrompt, {
    applyBrandSystem: context.applyBrandSystem,
    mobileFirst: context.mobileFirst,
  })
    .map(name => MYTHOS_SKILLS[name])
    .filter(skill => skill.enabled && skill.runWhen(context));
}

export function applyPreset(userPrompt: string, presetName?: MythosHtmlPresetName): MythosDesignPreset {
  return MYTHOS_DESIGN_PRESETS[presetName || inferMythosHtmlPreset(userPrompt)];
}

export function buildVisualBrief(context: SkillExecutionContext) {
  const preset = applyPreset(context.userPrompt, context.presetName);
  const skills = selectSkills(context).map(skill => skill.name);
  return {
    preset: preset.name,
    presetLabel: preset.label,
    sections: preset.sections,
    visualStyle: preset.visualStyle,
    palette: preset.palette,
    components: preset.components,
    primaryCta: preset.primaryCta,
    avoidErrors: preset.avoidErrors,
    skills,
    safety: {
      canMoveFunds: false,
      canSignTransactions: false,
      allowsWalletConnect: false,
      externalDependencies: false,
    },
  };
}
