import sharp from 'sharp';

export type MythosScreenshotInput = {
  label?: string;
  dataUrl?: string;
  base64?: string;
  mimeType?: string;
};

export type MythosScreenshotDna = {
  label: string;
  width: number;
  height: number;
  orientation: 'mobile' | 'tablet' | 'desktop' | 'wide';
  aspectRatio: string;
  palette: string[];
  brightness: 'dark' | 'balanced' | 'bright';
  contrast: 'soft' | 'balanced' | 'strong';
  layoutHints: string[];
};

const MAX_SCREENSHOTS = 2;
const MAX_SCREENSHOT_BYTES = 2_500_000;

function parseScreenshotBuffer(input: MythosScreenshotInput): Buffer | null {
  const raw = input.dataUrl || input.base64 || '';
  if (!raw) return null;
  const base64 = raw.includes(',') ? raw.split(',').pop() || '' : raw;
  if (!/^[a-z0-9+/=\s]+$/i.test(base64)) return null;
  const buffer = Buffer.from(base64.replace(/\s+/g, ''), 'base64');
  if (!buffer.length || buffer.length > MAX_SCREENSHOT_BYTES) return null;
  return buffer;
}

function hexFromRgb(r: number, g: number, b: number) {
  return `#${[r, g, b].map(value => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')).join('')}`;
}

function bucketColor(r: number, g: number, b: number) {
  const step = 32;
  return [
    Math.round(r / step) * step,
    Math.round(g / step) * step,
    Math.round(b / step) * step,
  ].map(value => Math.max(0, Math.min(255, value)));
}

function orientationFor(width: number, height: number): MythosScreenshotDna['orientation'] {
  if (width <= 520 || height > width * 1.35) return 'mobile';
  if (width <= 900) return 'tablet';
  if (width >= 1440) return 'wide';
  return 'desktop';
}

function layoutHintsFor(width: number, height: number, brightness: MythosScreenshotDna['brightness'], palette: string[]) {
  const hints = [
    orientationFor(width, height) === 'mobile' ? 'single-column mobile reference' : 'desktop multi-section reference',
    height > width ? 'vertical scrolling composition' : 'landscape first-viewport composition',
    brightness === 'dark' ? 'dark interface base' : brightness === 'bright' ? 'bright interface base' : 'mixed-tone interface',
  ];
  if (palette.some(color => /^#0|^#1|^#2/i.test(color))) hints.push('strong dark surfaces detected');
  if (palette.length >= 4) hints.push('multi-accent palette detected');
  return hints;
}

async function analyzeScreenshot(input: MythosScreenshotInput, index: number): Promise<MythosScreenshotDna | null> {
  const buffer = parseScreenshotBuffer(input);
  if (!buffer) return null;

  const image = sharp(buffer, { limitInputPixels: 12_000_000 }).rotate();
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (!width || !height) return null;

  const sample = await image
    .resize({ width: 64, height: 64, fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer();

  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  let luminanceTotal = 0;
  let minLum = 255;
  let maxLum = 0;
  for (let i = 0; i < sample.length; i += 3) {
    const r = sample[i] || 0;
    const g = sample[i + 1] || 0;
    const b = sample[i + 2] || 0;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminanceTotal += lum;
    minLum = Math.min(minLum, lum);
    maxLum = Math.max(maxLum, lum);
    const [br, bg, bb] = bucketColor(r, g, b);
    const key = `${br},${bg},${bb}`;
    const current = buckets.get(key) || { count: 0, r: br, g: bg, b: bb };
    current.count += 1;
    buckets.set(key, current);
  }

  const pixels = Math.max(1, sample.length / 3);
  const avgLum = luminanceTotal / pixels;
  const palette = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(color => hexFromRgb(color.r, color.g, color.b));
  const brightness: MythosScreenshotDna['brightness'] = avgLum < 82 ? 'dark' : avgLum > 176 ? 'bright' : 'balanced';
  const contrast: MythosScreenshotDna['contrast'] = maxLum - minLum > 180 ? 'strong' : maxLum - minLum > 100 ? 'balanced' : 'soft';

  return {
    label: input.label || (index === 0 ? 'desktop/reference' : `reference ${index + 1}`),
    width,
    height,
    orientation: orientationFor(width, height),
    aspectRatio: `${width}:${height}`,
    palette,
    brightness,
    contrast,
    layoutHints: layoutHintsFor(width, height, brightness, palette),
  };
}

export async function analyzeScreenshotDna(inputs: MythosScreenshotInput[] = []) {
  const selected = inputs.slice(0, MAX_SCREENSHOTS);
  const results = await Promise.all(selected.map(analyzeScreenshot));
  return results.filter((item): item is MythosScreenshotDna => Boolean(item));
}

export function formatScreenshotDnaForPrompt(items: MythosScreenshotDna[]) {
  if (!items.length) return '';
  return [
    'Screenshot DNA reference:',
    ...items.map((item, index) => [
      `Screenshot ${index + 1}: ${item.label}`,
      `Viewport: ${item.width}x${item.height}; orientation=${item.orientation}; aspect=${item.aspectRatio}`,
      `Visual tone: brightness=${item.brightness}; contrast=${item.contrast}; palette=${item.palette.join(', ')}`,
      `Layout hints: ${item.layoutHints.join('; ')}`,
    ].join('\n')),
    'Screenshot rules:',
    '- Use screenshots as visual rhythm and layout inspiration only.',
    '- Do not copy logos, protected artwork, exact imagery, exact text, or brand identity.',
    '- Rebuild an original premium Mythos/CongChain artifact with stronger hierarchy and mobile polish.',
  ].join('\n');
}
