import {
  MYTHOS_DESIGN_PRESETS,
  inferMythosHtmlPreset,
  resolveMythosHtmlSkills,
  type MythosHtmlPresetName,
} from './html-design-skills';
import { MYTHOS_PREMIUM_CSS_GUIDE } from './design-system';
import { buildSkillPipelinePrompt } from './skill-engine';

export type MythosHtmlGenerationBrief = {
  userRequest: string;
  presetName?: MythosHtmlPresetName;
  projectName?: string;
  ticker?: string;
  websiteDna?: string;
};

export const MYTHOS_HTML_SYSTEM_PROMPT = `
You are Mythos HTML Studio, a senior frontend engineer and product designer inside the CongChain/Mythos agent system.

Generate a complete, self-contained, premium HTML artifact for a sandboxed preview.

Output format:
Return only:
<artifact type="html" title="Short descriptive title">
...complete HTML document...
</artifact>

Technical requirements:
- One self-contained HTML document.
- CSS must be inside one <style> block.
- Do not include JavaScript. Use HTML and CSS only.
- No external scripts, stylesheets, fonts, iframes, images, or CDNs.
- Use system fonts only.
- Do not use Tailwind, Bootstrap, utility classes, or CDN frameworks.
- Use CSS custom properties for colors, spacing, radius, and shadows.
- Responsive at 375px, 768px, and 1280px.
- Use stable layout constraints: max-width, minmax(0, 1fr), overflow-wrap, and responsive grids.
- Text must not overflow buttons, cards, or narrow mobile screens.

Visual quality bar:
- Premium Web3 product quality, not generic template output.
- CongChain/Mythos style by default: black, neon green, cyan, high contrast, terminal-grade, sophisticated.
- Strong first viewport: clear brand/project name, strong value proposition, visible next section hint.
- Professional spacing, cards, buttons, hierarchy, contrast, and mobile polish.
- Add CSS-only visual richness: gradients, borders, shadows, subtle scanline or grid texture, and restrained keyframe animation.
- Use cards only for repeated items or framed tools; avoid card-in-card clutter.
- Use concise copy and label placeholder/demo values honestly.

Safety rules:
- Do not create wallet connect, signing, submit, buy, sell, swap, airdrop claim, payment, or fund movement flows.
- Do not access window.solana, window.ethereum, localStorage, sessionStorage, clipboard, external network APIs, eval(), Function(), or redirects.
- Do not ask for seed phrase, private key, API key, password, or signed payload.
- Do not include hidden inputs or auto-submit forms.
- Do not invent real market data, holder counts, prices, market caps, liquidity, or guaranteed returns.
- If tokenomics, stats, or market values are shown, label them as demo, placeholder, or estimated.
- Use informational CTAs only: Explore, Learn More, Read Docs, Join Community, View Demo.

Website reference rules:
- If a URL was analyzed, treat it as visual/structural inspiration only.
- Do not clone source code, protected assets, logos, exact branding, or full page copy.
- Rebuild an original, improved Mythos/CongChain-style version with better hierarchy, spacing, responsiveness, and safety.
`.trim();

export const MYTHOS_HTML_REVISION_PROMPT = `
You are a senior product designer doing a final quality pass on a Mythos HTML artifact.

Improve the HTML while preserving safety and meaning:
- better spacing and rhythm;
- clearer hierarchy;
- stronger hero;
- more polished cards and buttons;
- mobile-safe grids;
- no text overflow;
- better contrast;
- no external dependencies;
- no wallet, transaction, storage, clipboard, or network behavior.

Return the full improved document inside the same <artifact type="html" title="..."> wrapper.
`.trim();

export function buildMythosHtmlGenerationPrompt(brief: MythosHtmlGenerationBrief) {
  const presetName = brief.presetName || inferMythosHtmlPreset(brief.userRequest);
  const preset = MYTHOS_DESIGN_PRESETS[presetName];
  const skills = resolveMythosHtmlSkills(brief.userRequest);

  return [
    'User request:',
    brief.userRequest,
    '',
    `Selected preset: ${preset.label}`,
    `Sections: ${preset.sections.join(' -> ')}`,
    `Visual style: ${preset.visualStyle}`,
    `Palette: bg ${preset.palette.bg}, surface ${preset.palette.surface}, accent ${preset.palette.accent}, text ${preset.palette.text}, muted ${preset.palette.muted}`,
    `Expected components: ${preset.components.join(', ')}`,
    `Primary safe CTA: ${preset.primaryCta}`,
    `Avoid: ${preset.avoidErrors.join('; ')}`,
    '',
    brief.projectName ? `Project name: ${brief.projectName}` : '',
    brief.ticker ? `Ticker: ${brief.ticker}` : '',
    '',
    brief.websiteDna ? [
      'Website reinterpretation context:',
      brief.websiteDna,
      '',
      'Important: use this as abstract design DNA only. Do not copy source code, protected assets, logos, full text, or brand identity.',
    ].join('\n') : '',
    '',
    `Internal skill pipeline: ${skills.join(' -> ')}`,
    '',
    'Premium UI skill engine:',
    buildSkillPipelinePrompt(brief.userRequest),
    '',
    'Mythos design system CSS guidance:',
    MYTHOS_PREMIUM_CSS_GUIDE,
    '',
    'Generate a polished, production-grade, read-only HTML preview. Keep it safe, self-contained, responsive, and visually premium.',
  ].filter(Boolean).join('\n');
}

export function buildMythosHtmlRevisionPrompt(html: string) {
  return [
    MYTHOS_HTML_REVISION_PROMPT,
    '',
    'Current HTML:',
    html,
  ].join('\n');
}

export const MYTHOS_HTML_PIPELINE_STAGE_LABELS = {
  interpret: 'Interpreting the request...',
  brief: 'Creating the visual brief...',
  generate: 'Generating premium HTML...',
  refine: 'Refining visual quality...',
  responsive: 'Auditing responsive layout...',
  safety: 'Running the sandbox safety gate...',
  preview: 'Rendering preview...',
} as const;

export const SYSTEM_PROMPT_HTML_GENERATOR = MYTHOS_HTML_SYSTEM_PROMPT;
export const SYSTEM_PROMPT_HTML_REVIEWER = MYTHOS_HTML_REVISION_PROMPT;

export const PROMPT_VISUAL_BRIEF = 'Create a concise visual brief with preset, sections, visual rhythm, CTA, palette, and safety flags.';
export const PROMPT_UI_REFINER = 'Refine spacing, hierarchy, depth, cards, buttons, contrast, and premium visual polish without adding dependencies.';
export const PROMPT_RESPONSIVE_PASS = 'Audit 375px, 768px, and desktop layouts for overflow, readable type, stacked grids, and touch-friendly controls.';
export const PROMPT_ACCESSIBILITY_PASS = 'Improve semantic structure, contrast, focus states, labels, readable motion, and mobile legibility.';
export const PROMPT_SAFETY_REVIEW = 'Remove or block external scripts, wallet APIs, secret fields, hidden inputs, auto-submit, clipboard writes, redirects, and suspicious storage.';

export function buildGenerationPrompt(brief: MythosHtmlGenerationBrief) {
  return buildMythosHtmlGenerationPrompt(brief);
}

export function buildReviewPrompt(html: string) {
  return buildMythosHtmlRevisionPrompt(html);
}

export function buildSkillPrompt(skillPrompt: string) {
  return [
    MYTHOS_HTML_SYSTEM_PROMPT,
    '',
    'Internal skill instruction:',
    skillPrompt,
  ].join('\n');
}
