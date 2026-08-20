import { createHash } from 'crypto';
import { readWebUrl } from './web-reader';

export type MythosResearchPlatform = 'web' | 'github' | 'youtube' | 'reddit' | 'twitter' | 'unknown';

export type MythosResearchStatus = 'ok' | 'partial' | 'blocked' | 'error';

export interface MythosResearchItem {
  title: string;
  url: string;
  platform: MythosResearchPlatform;
  excerpt: string;
  contentHash: string;
  source: 'jina-reader' | 'github-public' | 'guarded';
  status: MythosResearchStatus;
  error?: string;
}

export interface MythosResearchReport {
  query: string;
  platform: MythosResearchPlatform;
  status: MythosResearchStatus;
  generatedAt: string;
  summary: string;
  items: MythosResearchItem[];
  safety: {
    readOnly: true;
    noLogin: true;
    noCookies: true;
    noPosting: true;
    noShell: true;
    note: string;
  };
  audit: {
    adapter: 'mythos-research-adapter/v1';
    usedAgentReachPackage: false;
    reason: string;
  };
}

const MAX_QUERY = 240;
const MAX_ITEMS = 4;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function cleanQuery(input: string): string {
  return input.replace(/^\/(?:research|pesquisar|github|youtube|reddit|twitter|x)\s*/i, '').trim().slice(0, MAX_QUERY);
}

function detectPlatform(input: string): MythosResearchPlatform {
  const lower = input.toLowerCase();
  if (/\b(github|repo|repositorio|reposit[oó]rio|issues?)\b/.test(lower) || /github\.com/i.test(input)) return 'github';
  if (/\b(youtube|video|v[ií]deo|youtu\.be)\b/.test(lower) || /youtube\.com|youtu\.be/i.test(input)) return 'youtube';
  if (/\b(reddit|subreddit)\b/.test(lower) || /reddit\.com/i.test(input)) return 'reddit';
  if (/\b(twitter|x\.com|tweet|tweets?)\b/.test(lower) || /(?:twitter|x)\.com/i.test(input)) return 'twitter';
  if (/https?:\/\//i.test(input)) return 'web';
  return 'unknown';
}

function extractUrl(input: string): string | null {
  return input.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/i)?.[0]?.replace(/[.,;!?)\]]+$/, '') ?? null;
}

function searchUrl(platform: MythosResearchPlatform, query: string): string | null {
  const encoded = encodeURIComponent(query);
  if (platform === 'github') return `https://github.com/search?q=${encoded}&type=repositories`;
  if (platform === 'youtube') return `https://www.youtube.com/results?search_query=${encoded}`;
  if (platform === 'reddit') return `https://www.reddit.com/search/?q=${encoded}`;
  if (platform === 'twitter') return null;
  if (platform === 'web' || platform === 'unknown') return `https://duckduckgo.com/html/?q=${encoded}`;
  return null;
}

function guardedTwitterReport(query: string): MythosResearchReport {
  return {
    query,
    platform: 'twitter',
    status: 'blocked',
    generatedAt: new Date().toISOString(),
    summary: 'Twitter/X research is blocked in production-safe mode because reliable access often requires login, cookies, browser sessions, or scraping behavior that can break platform terms or leak user state.',
    items: [{
      title: 'Twitter/X guarded mode',
      url: 'https://x.com/search',
      platform: 'twitter',
      excerpt: 'Use official API, user-provided export, public web search, or an explicitly approved local research sandbox. Mythos will not use cookies or login sessions server-side.',
      contentHash: sha256(`${query}:twitter-guarded`),
      source: 'guarded',
      status: 'blocked',
      error: 'Twitter/X requires guarded access.',
    }],
    safety: safetyNote(),
    audit: auditNote('Twitter/X access intentionally blocked without official API or explicit local sandbox.'),
  };
}

function safetyNote(): MythosResearchReport['safety'] {
  return {
    readOnly: true,
    noLogin: true,
    noCookies: true,
    noPosting: true,
    noShell: true,
    note: 'Mythos Research Adapter reads public pages only. It never logs in, stores cookies, posts content, likes, follows, comments, or runs shell scrapers.',
  };
}

function auditNote(reason: string): MythosResearchReport['audit'] {
  return {
    adapter: 'mythos-research-adapter/v1',
    usedAgentReachPackage: false,
    reason,
  };
}

function summarize(platform: MythosResearchPlatform, items: MythosResearchItem[]): string {
  const ok = items.filter(item => item.status === 'ok');
  if (!items.length) return 'No public research result was returned.';
  if (!ok.length) return `No stable public ${platform} content was readable without login/cookies.`;
  const lead = ok[0];
  return `${lead.title} was readable through public, read-only research. Mythos found ${ok.length} public source${ok.length > 1 ? 's' : ''} for review.`;
}

export function parseMythosResearchCommand(input: string): { query: string; platform: MythosResearchPlatform } | null {
  const trimmed = input.trim();
  if (!/^\/(?:research|pesquisar|github|youtube|reddit|twitter|x)\b/i.test(trimmed)) return null;
  const explicit = trimmed.match(/^\/(github|youtube|reddit|twitter|x)\b/i)?.[1]?.toLowerCase();
  const query = cleanQuery(trimmed);
  if (!query) return null;
  const platform = explicit === 'x' ? 'twitter' : explicit ? explicit as MythosResearchPlatform : detectPlatform(query);
  return { query, platform: platform === 'unknown' ? 'web' : platform };
}

export async function runMythosResearch(input: string, preferredPlatform?: MythosResearchPlatform): Promise<MythosResearchReport> {
  const query = cleanQuery(input);
  const platform = preferredPlatform && preferredPlatform !== 'unknown' ? preferredPlatform : detectPlatform(input);
  const safePlatform = platform === 'unknown' ? 'web' : platform;

  if (safePlatform === 'twitter') return guardedTwitterReport(query || input.slice(0, MAX_QUERY));

  const directUrl = extractUrl(input);
  const targetUrl = directUrl || searchUrl(safePlatform, query || input);

  if (!targetUrl) {
    return {
      query,
      platform: safePlatform,
      status: 'blocked',
      generatedAt: new Date().toISOString(),
      summary: 'No safe public URL could be built for this research request.',
      items: [],
      safety: safetyNote(),
      audit: auditNote('No safe reader URL available.'),
    };
  }

  const result = await readWebUrl(targetUrl);
  const item: MythosResearchItem = {
    title: result.title,
    url: result.normalizedUrl || targetUrl,
    platform: safePlatform,
    excerpt: result.success ? result.content.slice(0, 1800) : '',
    contentHash: result.contentHash || sha256(`${targetUrl}:${result.error || 'empty'}`),
    source: safePlatform === 'github' ? 'github-public' : 'jina-reader',
    status: result.success ? 'ok' : 'error',
    error: result.error,
  };

  const items = [item].slice(0, MAX_ITEMS);
  return {
    query,
    platform: safePlatform,
    status: item.status === 'ok' ? 'ok' : 'partial',
    generatedAt: new Date().toISOString(),
    summary: summarize(safePlatform, items),
    items,
    safety: safetyNote(),
    audit: auditNote('Agent-Reach was not installed server-side; Mythos used native TypeScript read-only adapters to avoid Python package, cookie, shell, and scraping risk.'),
  };
}
