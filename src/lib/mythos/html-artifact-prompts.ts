import {
  MYTHOS_DESIGN_PRESETS,
  inferMythosHtmlPreset,
  resolveMythosHtmlSkills,
  type MythosHtmlPresetName,
} from './html-design-skills';

export type MythosHtmlGenerationBrief = {
  userRequest: string;
  presetName?: MythosHtmlPresetName;
  projectName?: string;
  ticker?: string;
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
- JavaScript is optional and must be inline only.
- No external scripts, stylesheets, fonts, iframes, images, or CDNs.
- Use system fonts only.
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
- Do not access window.solana, window.ethereum, localStorage, sessionStorage, clipboard, or external network APIs.
- Do not ask for seed phrase, private key, API key, password, or signed payload.
- Do not include hidden inputs or auto-submit forms.
- Do not invent real market data, holder counts, prices, market caps, liquidity, or guaranteed returns.
- If tokenomics, stats, or market values are shown, label them as demo, placeholder, or estimated.
- Use informational CTAs only: Explore, Learn More, Read Docs, Join Community, View Demo.
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
    `Internal skill pipeline: ${skills.join(' -> ')}`,
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
