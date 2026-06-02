import {
  MYTHOS_DESIGN_PRESETS,
  inferMythosHtmlPreset,
  type MythosDesignPreset,
  type MythosHtmlPresetName,
} from './html-design-skills';

export type MythosArtifactMode =
  | 'landing'
  | 'token'
  | 'dashboard'
  | 'report'
  | 'agent'
  | 'docs'
  | 'deck'
  | 'waitlist';

export type MythosRegenerationBrief = {
  mode: MythosArtifactMode;
  presetName: MythosHtmlPresetName;
  intent: string;
  productCategory: string;
  pageContract: string[];
  sectionBlueprint: Array<{
    id: string;
    purpose: string;
    layout: string;
    components: string[];
    copyRules: string[];
  }>;
  componentSystem: string[];
  contentRules: string[];
  interactionRules: string[];
  qualityGates: string[];
};

const MODE_LABELS: Record<MythosArtifactMode, string> = {
  landing: 'Premium landing page',
  token: 'Token or memecoin project page',
  dashboard: 'Data dashboard',
  report: 'Market or research report',
  agent: 'AI agent profile',
  docs: 'Docs or whitepaper page',
  deck: 'Investor pitch page',
  waitlist: 'Waitlist or launch page',
};

function inferArtifactMode(prompt: string, presetName: MythosHtmlPresetName): MythosArtifactMode {
  const lower = prompt.toLowerCase();

  if (/\b(wallet|carteira|portfolio|dashboard|painel|analytics|anal[ií]tico)\b/.test(lower)) return 'dashboard';
  if (/\b(report|relatorio|relat[oó]rio|market|mercado|brief|pesquisa|research)\b/.test(lower)) return 'report';
  if (/\b(agent|agente|mythos|profile|perfil|assistant|assistente)\b/.test(lower)) return 'agent';
  if (/\b(docs|whitepaper|paper|documenta[cç][aã]o|manual|litepaper)\b/.test(lower)) return 'docs';
  if (/\b(deck|pitch|investor|investidor|apresenta[cç][aã]o)\b/.test(lower)) return 'deck';
  if (/\b(waitlist|espera|lista|early access|acesso antecipado)\b/.test(lower)) return 'waitlist';
  if (/\b(token|ticker|memecoin|meme|pump|pumpfun|pump\.fun|solana)\b/.test(lower)) return 'token';

  if (presetName === 'solana-wallet-dashboard') return 'dashboard';
  if (presetName === 'crypto-market-report') return 'report';
  if (presetName === 'ai-agent-profile') return 'agent';
  if (presetName === 'docs-whitepaper-page') return 'docs';
  if (presetName === 'pitch-deck-page') return 'deck';
  if (presetName === 'waitlist-page') return 'waitlist';
  if (presetName === 'memecoin-launch-page' || presetName === 'token-landing-page') return 'token';

  return 'landing';
}

function makeSectionBlueprint(preset: MythosDesignPreset, mode: MythosArtifactMode): MythosRegenerationBrief['sectionBlueprint'] {
  return preset.sections.map((section, index) => {
    const isHero = index === 0 || /hero|cover|header/i.test(section);
    const isData = /stats|portfolio|tokens|market|traction|risk|score|activity/i.test(section);
    const isNarrative = /about|problem|solution|abstract|sections|value|vibe/i.test(section);
    const isConversion = /community|footer|ask|form|waitlist|cta/i.test(section);

    return {
      id: section,
      purpose: isHero
        ? 'Establish the project identity, promise, and safe primary action immediately.'
        : isData
          ? 'Show scannable structured information with honest source or demo labels.'
          : isNarrative
            ? 'Explain the idea with clear hierarchy and short readable copy.'
            : isConversion
              ? 'Move the user to a safe informational next step without wallet or fund actions.'
              : 'Support the main story with a polished, useful section.',
      layout: isHero
        ? 'Full-width first viewport with dominant title, compact proof/status rail, primary visual signal, and a hint of the next section.'
        : isData
          ? mode === 'dashboard'
            ? 'Dense responsive dashboard grid with metric cards, tables, and risk chips.'
            : 'Responsive card or stat grid with strong labels and compact explanations.'
          : isNarrative
            ? 'Editorial split or stacked layout with a strong heading, short paragraphs, and supporting bullets.'
            : isConversion
              ? 'Centered CTA band or footer strip with safe buttons and trust notes.'
              : 'Responsive grid or full-width band using the preset visual rhythm.',
      components: isHero
        ? ['brand lockup', 'value proposition', 'safe CTA pair', 'status/proof chips', 'hero visual block']
        : isData
          ? ['metric cards', 'source labels', 'comparison rows', 'risk/status chips']
          : isNarrative
            ? ['section heading', 'short copy blocks', 'feature bullets', 'supporting callout']
            : isConversion
              ? ['safe CTA', 'community links as labels', 'disclaimer line']
              : ['cards', 'labels', 'microcopy'],
      copyRules: isData
        ? ['Do not invent live financial data.', 'Label any numbers as demo, placeholder, estimated, or user-provided.']
        : isConversion
          ? ['Use informational CTA text only.', 'Do not imply buying, signing, claiming, or payment.']
          : ['Keep copy concise, specific, and original.', 'Do not copy text from reference websites.'],
    };
  });
}

export function buildMythosRegenerationBrief(userRequest: string, presetName?: MythosHtmlPresetName): MythosRegenerationBrief {
  const resolvedPresetName = presetName || inferMythosHtmlPreset(userRequest);
  const preset = MYTHOS_DESIGN_PRESETS[resolvedPresetName];
  const mode = inferArtifactMode(userRequest, resolvedPresetName);

  return {
    mode,
    presetName: resolvedPresetName,
    intent: MODE_LABELS[mode],
    productCategory: preset.label,
    pageContract: [
      'Generate one complete, original, self-contained HTML document.',
      'Use a deliberate product-page structure, not a generic template.',
      'Make the first viewport immediately communicate brand, offer, and safe next step.',
      'Keep all actions read-only and informational.',
      'The output must look like a finished product demo, not a prompt placeholder or centered splash screen.',
    ],
    sectionBlueprint: makeSectionBlueprint(preset, mode),
    componentSystem: [
      'Use reusable visual patterns: badges, stat cards, proof rails, feature grids, timelines, comparison rows, and CTA bands.',
      'Create one substantial CSS-only product visual: protocol console, launch dashboard, token card, market terminal, agent operating panel, docs browser, or roadmap board.',
      'Use asymmetric desktop composition where possible: copy and actions on one side, product visual/data surface on the other.',
      'Use CSS custom properties for color, spacing, radius, border, glow, and shadow tokens.',
      'Use semantic HTML sections, readable headings, and compact labels.',
      'Use mobile-first responsive grids with minmax(0, 1fr), max-width constraints, and overflow-wrap.',
      'Use premium but restrained CSS-only motion and depth.',
    ],
    contentRules: [
      'Prefer concrete product language over vague AI marketing.',
      'Do not invent real prices, market caps, liquidity, holders, partnerships, exchange listings, or guarantees.',
      'If the user did not provide a logo or asset, create a CSS-only symbolic mark integrated into a useful product surface, not an isolated square placeholder.',
      'If the user provided a URL or screenshot, reinterpret structure and rhythm only.',
      'Avoid long walls of text; make the result easy to scan and demo on video.',
      'Every section should answer a useful user question: what it is, why it matters, how it works, what is safe, what comes next.',
    ],
    interactionRules: [
      'Buttons are visual/read-only CTAs only.',
      'No JavaScript, wallet connect, transaction signing, submit, buy, sell, swap, claim, storage, clipboard, or network behavior.',
      'Forms may be visual demos only and must be labeled demo if present.',
    ],
    qualityGates: [
      'Looks polished at 375px, 768px, and 1280px.',
      'No text overflow in cards, buttons, chips, headings, tables, or nav.',
      'No nested card clutter.',
      'Hero, next section, and CTA must be visible or hinted in first viewport.',
      'Every data/stat area must be source-labeled or clearly marked demo.',
      'Visual style should feel like a premium Mythos/CongChain artifact, not a default AI page.',
      'Reject generic centered poster pages with only a logo, headline, chips, and one button.',
      'Reject meaningless placeholder graphics; use purposeful CSS-built product visuals.',
      'Include at least 5 meaningful sections unless the user explicitly asks for a compact component.',
    ],
  };
}

export function formatRegenerationBriefForPrompt(brief: MythosRegenerationBrief) {
  return [
    `Artifact mode: ${brief.intent}`,
    `Product category: ${brief.productCategory}`,
    `Preset key: ${brief.presetName}`,
    '',
    'Page contract:',
    ...brief.pageContract.map(item => `- ${item}`),
    '',
    'Section blueprint:',
    ...brief.sectionBlueprint.map(section => [
      `- ${section.id}`,
      `  Purpose: ${section.purpose}`,
      `  Layout: ${section.layout}`,
      `  Components: ${section.components.join(', ')}`,
      `  Copy rules: ${section.copyRules.join(' ')}`,
    ].join('\n')),
    '',
    'Component system:',
    ...brief.componentSystem.map(item => `- ${item}`),
    '',
    'Content rules:',
    ...brief.contentRules.map(item => `- ${item}`),
    '',
    'Interaction rules:',
    ...brief.interactionRules.map(item => `- ${item}`),
    '',
    'Quality gates:',
    ...brief.qualityGates.map(item => `- ${item}`),
  ].join('\n');
}
