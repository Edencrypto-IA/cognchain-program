export type WebsiteDnaBrief = {
  url: string;
  title: string;
  description: string;
  sections: string[];
  headings: string[];
  ctas: string[];
  layoutMap: {
    sequence: string[];
    heroSignals: string[];
    navigationSignals: string[];
    componentSignals: string[];
    gridSignals: string[];
    formSignals: string[];
    footerSignals: string[];
    hierarchy: 'hero-led' | 'dashboard-led' | 'content-led' | 'commerce-led' | 'unknown';
  };
  visualDna: {
    paletteHints: string[];
    density: 'minimal' | 'balanced' | 'dense';
    hasDarkModeSignals: boolean;
    hasGradientSignals: boolean;
    hasCardSignals: boolean;
  };
  regenerationRules: string[];
};

const MAX_HTML_BYTES = 450_000;
const MAX_ITEMS = 10;

export function extractFirstUrl(input: string): string | null {
  const match = input.match(/\bhttps?:\/\/[^\s<>"')]+/i);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function stripDangerousHtml(html: string) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

function decodeBasicEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function textFromTagMatches(html: string, pattern: RegExp, limit = MAX_ITEMS) {
  const out: string[] = [];
  for (const match of html.matchAll(pattern)) {
    const text = decodeBasicEntities(String(match[1] || '').replace(/<[^>]+>/g, ' '));
    if (text && text.length > 2 && !out.includes(text)) out.push(text.slice(0, 140));
    if (out.length >= limit) break;
  }
  return out;
}

function metaContent(html: string, name: string) {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  return decodeBasicEntities(html.match(pattern)?.[1] || '');
}

function classSignals(html: string, words: string[]) {
  const lower = html.toLowerCase();
  return words.filter(word => lower.includes(word));
}

function countMatches(html: string, pattern: RegExp) {
  return [...html.matchAll(pattern)].length;
}

function attributeSignals(html: string, words: string[], limit = MAX_ITEMS) {
  const lower = html.toLowerCase();
  const found: string[] = [];
  for (const word of words) {
    const pattern = new RegExp(`(?:class|id|aria-label|role)=["'][^"']*${word}[^"']*["']`, 'i');
    if (pattern.test(lower) && !found.includes(word)) found.push(word);
    if (found.length >= limit) break;
  }
  return found;
}

function inferLayoutMap(safeHtml: string, headings: string[], ctas: string[]): WebsiteDnaBrief['layoutMap'] {
  const lower = safeHtml.toLowerCase();
  const sequence: string[] = [];
  const tagOrder = [...safeHtml.matchAll(/<(header|nav|main|section|article|aside|footer)\b[^>]*>/gi)]
    .map(match => match[1].toLowerCase());

  for (const tag of tagOrder) {
    const normalized = tag === 'header' && !sequence.length ? 'topbar/header' : tag;
    if (!sequence.includes(normalized)) sequence.push(normalized);
    if (sequence.length >= 12) break;
  }

  const heroSignals = attributeSignals(safeHtml, ['hero', 'headline', 'intro', 'masthead', 'banner', 'above-fold', 'jumbotron']);
  if (headings[0]) heroSignals.unshift(`lead heading: ${headings[0]}`);

  const navigationSignals = [
    countMatches(safeHtml, /<nav\b/gi) ? 'nav element' : '',
    countMatches(safeHtml, /<a\b/gi) >= 4 ? 'multiple links' : '',
    attributeSignals(safeHtml, ['menu', 'navbar', 'navigation', 'logo', 'brand']).join(', '),
  ].filter(Boolean);

  const componentSignals = [
    ...attributeSignals(safeHtml, ['card', 'tile', 'panel', 'feature', 'pricing', 'testimonial', 'faq', 'accordion', 'tab', 'badge', 'pill', 'modal']),
    countMatches(safeHtml, /<button\b/gi) >= 2 ? 'button set' : '',
    ctas.length >= 2 ? 'CTA group' : '',
  ].filter(Boolean).slice(0, 14);

  const gridSignals = [
    ...attributeSignals(safeHtml, ['grid', 'columns', 'row', 'stack', 'gallery', 'carousel', 'slider', 'masonry']),
    countMatches(safeHtml, /<li\b/gi) >= 6 ? 'repeated list items' : '',
    countMatches(safeHtml, /<(article|section)\b/gi) >= 4 ? 'multi-section layout' : '',
  ].filter(Boolean).slice(0, 10);

  const formSignals = [
    countMatches(safeHtml, /<form\b/gi) ? 'form element' : '',
    countMatches(safeHtml, /<input\b/gi) ? 'input fields' : '',
    countMatches(safeHtml, /<textarea\b/gi) ? 'textarea' : '',
    ...attributeSignals(safeHtml, ['newsletter', 'subscribe', 'contact', 'signup', 'login']),
  ].filter(Boolean).slice(0, 10);

  const footerSignals = [
    countMatches(safeHtml, /<footer\b/gi) ? 'footer element' : '',
    /\b(privacy|terms|copyright|social|discord|twitter|github)\b/i.test(lower) ? 'legal/social footer copy' : '',
  ].filter(Boolean);

  const hierarchy: WebsiteDnaBrief['layoutMap']['hierarchy'] =
    /\b(cart|checkout|product|price|pricing|shop|buy)\b/i.test(lower) ? 'commerce-led'
      : /\b(dashboard|metrics|table|analytics|admin|status)\b/i.test(lower) ? 'dashboard-led'
        : heroSignals.length || ctas.length ? 'hero-led'
          : headings.length >= 5 ? 'content-led'
            : 'unknown';

  return {
    sequence: sequence.length ? sequence : ['header', 'hero', 'content', 'footer'],
    heroSignals: heroSignals.slice(0, 8),
    navigationSignals: navigationSignals.slice(0, 8),
    componentSignals,
    gridSignals,
    formSignals,
    footerSignals,
    hierarchy,
  };
}

export function buildWebsiteDnaBrief(url: string, html: string): WebsiteDnaBrief {
  const safeHtml = stripDangerousHtml(html.slice(0, MAX_HTML_BYTES));
  const title = decodeBasicEntities(safeHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const description = metaContent(safeHtml, 'description') || metaContent(safeHtml, 'og:description');
  const headings = textFromTagMatches(safeHtml, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi, 12);
  const ctas = textFromTagMatches(safeHtml, /<(?:a|button)[^>]*>([\s\S]*?)<\/(?:a|button)>/gi, 12)
    .filter(text => /\b(start|get|join|try|learn|contact|book|launch|create|sign up|demo|explore|comece|criar|entrar|saiba)\b/i.test(text));
  const landmarkTags = [...safeHtml.matchAll(/<(section|header|main|footer|nav|article|aside)\b/gi)].map(match => match[1].toLowerCase());
  const sections = [...new Set(landmarkTags)].slice(0, MAX_ITEMS);
  const paletteHints = classSignals(safeHtml, ['dark', 'black', 'white', 'green', 'cyan', 'blue', 'purple', 'orange', 'gradient', 'glass', 'neon']);
  const cardSignals = classSignals(safeHtml, ['card', 'tile', 'panel', 'grid', 'feature']);
  const textLength = decodeBasicEntities(safeHtml.replace(/<[^>]+>/g, ' ')).length;
  const layoutMap = inferLayoutMap(safeHtml, headings, ctas);

  return {
    url,
    title: title || 'Untitled source page',
    description: description.slice(0, 220),
    sections: sections.length ? sections : ['header', 'hero', 'content', 'footer'],
    headings,
    ctas,
    layoutMap,
    visualDna: {
      paletteHints,
      density: textLength > 9000 ? 'dense' : textLength > 3500 ? 'balanced' : 'minimal',
      hasDarkModeSignals: /\b(dark|black|slate|zinc|neutral|night)\b/i.test(safeHtml),
      hasGradientSignals: /\bgradient|radial|linear-gradient\b/i.test(safeHtml),
      hasCardSignals: cardSignals.length > 0,
    },
    regenerationRules: [
      'Do not copy source code, protected assets, logos, or full text.',
      'Reinterpret the structure and visual rhythm into a new Mythos/CongChain premium artifact.',
      'Use original copy unless the user provided brand text.',
      'Keep it self-contained, responsive, read-only, and safe.',
    ],
  };
}

export async function fetchWebsiteDnaBrief(url: string): Promise<WebsiteDnaBrief | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'MythosWebsiteDnaExtractor/1.0',
      },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) return null;
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    return buildWebsiteDnaBrief(url, html);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function formatWebsiteDnaForPrompt(brief: WebsiteDnaBrief) {
  return [
    'Website DNA reference:',
    `Source URL: ${brief.url}`,
    `Observed title: ${brief.title}`,
    brief.description ? `Observed description summary: ${brief.description}` : '',
    `Detected structure: ${brief.sections.join(' -> ')}`,
    `Advanced layout sequence: ${brief.layoutMap.sequence.join(' -> ')}`,
    `Page hierarchy: ${brief.layoutMap.hierarchy}`,
    brief.layoutMap.heroSignals.length ? `Hero signals: ${brief.layoutMap.heroSignals.join(' | ')}` : '',
    brief.layoutMap.navigationSignals.length ? `Navigation signals: ${brief.layoutMap.navigationSignals.join(' | ')}` : '',
    brief.layoutMap.componentSignals.length ? `Component signals: ${brief.layoutMap.componentSignals.join(' | ')}` : '',
    brief.layoutMap.gridSignals.length ? `Grid/repetition signals: ${brief.layoutMap.gridSignals.join(' | ')}` : '',
    brief.layoutMap.formSignals.length ? `Form/input signals: ${brief.layoutMap.formSignals.join(' | ')}` : '',
    brief.layoutMap.footerSignals.length ? `Footer signals: ${brief.layoutMap.footerSignals.join(' | ')}` : '',
    brief.headings.length ? `Heading themes: ${brief.headings.join(' | ')}` : '',
    brief.ctas.length ? `CTA patterns: ${brief.ctas.join(' | ')}` : '',
    `Visual hints: palette=${brief.visualDna.paletteHints.join(', ') || 'not explicit'}; density=${brief.visualDna.density}; dark=${brief.visualDna.hasDarkModeSignals}; gradients=${brief.visualDna.hasGradientSignals}; cards=${brief.visualDna.hasCardSignals}`,
    'Regeneration rules:',
    ...brief.regenerationRules.map(rule => `- ${rule}`),
  ].filter(Boolean).join('\n');
}
