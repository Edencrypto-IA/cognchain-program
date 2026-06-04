import { createHash } from 'crypto';

export type MythosWebReadResult = {
  url: string;
  normalizedUrl: string;
  title: string;
  content: string;
  contentHash: string;
  wordCount: number;
  readAt: string;
  source: 'jina-reader';
  success: boolean;
  error?: string;
};

export type MythosWebMemoryRecord = {
  url: string;
  title: string;
  contentHash: string;
  wordCount: number;
  readAt: string;
  source: 'jina-reader';
  agentType: 'WEB_READER';
};

const MAX_URLS_PER_READ = 3;
const MAX_CONTENT_CHARS = 14_000;
const JINA_READER_BASE_URL = 'https://r.jina.ai/';

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^0\.0\.0\.0$/,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^::1$/i,
  /^fc[0-9a-f]{2}:/i,
  /^fe80:/i,
  /\.local$/i,
  /\.localhost$/i,
  /\.internal$/i,
  /\.lan$/i,
];

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeUrl(value: string) {
  const parsed = new URL(value.trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs can be read.');
  }

  parsed.hash = '';
  return parsed.toString();
}

function isBlockedHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return BLOCKED_HOST_PATTERNS.some(pattern => pattern.test(normalized));
}

function validatePublicUrl(value: string) {
  const normalizedUrl = normalizeUrl(value);
  const parsed = new URL(normalizedUrl);

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error('Private, local, or internal URLs cannot be read by Mythos.');
  }

  return normalizedUrl;
}

function extractTitle(content: string, url: string) {
  const titleLine = content.match(/^Title:\s*(.+)$/im)?.[1]?.trim();
  if (titleLine) return titleLine.slice(0, 120);

  const h1 = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (h1) return h1.slice(0, 120);

  const firstUsefulLine = content
    .split('\n')
    .map(line => line.trim())
    .find(line => line.length >= 12 && !/^[-=*#\s]+$/.test(line));

  if (firstUsefulLine) return firstUsefulLine.slice(0, 120);

  try {
    return new URL(url).hostname;
  } catch {
    return 'Web page';
  }
}

export function extractWebUrls(text: string) {
  const matches = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/gi) || [];
  const cleaned = matches
    .map(url => url.replace(/[.,;!?)\]]+$/, ''))
    .filter(Boolean);

  return Array.from(new Set(cleaned)).slice(0, MAX_URLS_PER_READ);
}

export async function readWebUrl(url: string): Promise<MythosWebReadResult> {
  const readAt = new Date().toISOString();

  try {
    const normalizedUrl = validatePublicUrl(url);
    const readerUrl = `${JINA_READER_BASE_URL}${normalizedUrl}`;
    const response = await fetch(readerUrl, {
      headers: {
        Accept: 'text/plain; charset=utf-8',
        'User-Agent': 'Mythos-WebReader/1.0 (+CongChain)',
      },
      signal: AbortSignal.timeout(16_000),
    });

    if (!response.ok) {
      throw new Error(`Reader returned HTTP ${response.status}.`);
    }

    const rawContent = await response.text();
    const content = rawContent.slice(0, MAX_CONTENT_CHARS).trim();
    const title = extractTitle(content || rawContent, normalizedUrl);
    const wordCount = rawContent.trim() ? rawContent.trim().split(/\s+/).length : 0;

    return {
      url,
      normalizedUrl,
      title,
      content,
      contentHash: sha256(rawContent),
      wordCount,
      readAt,
      source: 'jina-reader',
      success: true,
    };
  } catch (error) {
    return {
      url,
      normalizedUrl: url,
      title: url,
      content: '',
      contentHash: '',
      wordCount: 0,
      readAt,
      source: 'jina-reader',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown web reader error.',
    };
  }
}

export async function readWebUrls(urls: string[]) {
  const uniqueUrls = Array.from(new Set(urls)).slice(0, MAX_URLS_PER_READ);
  return Promise.all(uniqueUrls.map(url => readWebUrl(url)));
}

export function formatWebReadContext(results: MythosWebReadResult[]) {
  const successful = results.filter(result => result.success && result.content);
  const failed = results.filter(result => !result.success);

  if (!successful.length && !failed.length) return '';

  return [
    '[MYTHOS WEB READER]',
    'The user provided URL(s). Mythos read the public web content server-side through Jina Reader and must answer from this content when relevant.',
    'Do not claim hidden browsing beyond the content below. If content is missing, say what failed.',
    '',
    ...successful.map(result => [
      '--- WEB SOURCE ---',
      `URL: ${result.normalizedUrl}`,
      `Title: ${result.title}`,
      `Read at: ${result.readAt}`,
      `SHA-256 content hash: ${result.contentHash}`,
      `Total words observed: ${result.wordCount}`,
      `Content excerpt limit: ${MAX_CONTENT_CHARS} characters`,
      '',
      result.content,
      '--- END WEB SOURCE ---',
      '',
    ].join('\n')),
    failed.length ? [
      '--- FAILED WEB READS ---',
      ...failed.map(result => `${result.url}: ${result.error || 'unavailable'}`),
      '--- END FAILED WEB READS ---',
      '',
    ].join('\n') : '',
    '[END MYTHOS WEB READER]',
  ].filter(Boolean).join('\n');
}

export function prepareWebMemoryRecords(results: MythosWebReadResult[]): MythosWebMemoryRecord[] {
  return results
    .filter(result => result.success && result.contentHash)
    .map(result => ({
      url: result.normalizedUrl,
      title: result.title,
      contentHash: result.contentHash,
      wordCount: result.wordCount,
      readAt: result.readAt,
      source: result.source,
      agentType: 'WEB_READER',
    }));
}
