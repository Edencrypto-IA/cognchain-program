import type { FactSource, RawResult } from './types';

const TIER_SCORES: Record<string, number> = {
  'helius.xyz': 98, 'helius-rpc.com': 98, 'solana.com': 97, 'docs.solana.com': 97,
  'solana-labs': 96, 'github.com/solana-labs': 96, 'solanabeach.io': 95,
  'solscan.io': 95, 'solana.fm': 95,
  'coingecko.com': 92, 'coinmarketcap.com': 91, 'defillama.com': 90,
  'llama.fi': 90, 'birdeye.so': 88,
  'theblock.co': 82, 'blockworks.co': 81, 'decrypt.co': 80,
  'cointelegraph.com': 68, 'medium.com': 60, 'stackexchange.com': 65,
  'twitter.com': 30, 'x.com': 30, 't.me': 25,
};

const BLACKLIST = new Set(['telegram.me', 'bit.ly', 'tinyurl.com']);

function domainScore(url: string): number {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    for (const [domain, score] of Object.entries(TIER_SCORES)) {
      if (host.includes(domain)) return score;
    }
    return url.startsWith('https://') ? 50 : 15;
  } catch {
    return 0;
  }
}

function isBlacklisted(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return BLACKLIST.has(host);
  } catch { return true; }
}

/** Filter, score and deduplicate raw results into trusted FactSources */
export function filterTrustedSources(results: readonly RawResult[]): FactSource[] {
  const seen = new Map<string, FactSource>();
  const superscripts = ['¹','²','³','⁴','⁵','⁶','⁷','⁸','⁹'];
  let counter = 0;

  for (const r of results) {
    if (isBlacklisted(r.url)) continue;
    const score = domainScore(r.url);
    if (score < 20) continue;

    const existing = seen.get(r.url);
    if (existing && existing.credibilityScore >= score) continue;

    const id = `[${superscripts[counter % superscripts.length] ?? String(counter + 1)}]`;
    const source: FactSource = {
      id,
      name: r.name,
      url: r.url,
      fetchedAt: new Date().toISOString(),
      credibilityScore: score,
      rawValue: r.value,
      ...(r.fromApi ? { apiEndpoint: r.url } : {}),
    };

    if (!existing) counter++;
    seen.set(r.url, source);
  }

  return [...seen.values()].sort((a, b) => b.credibilityScore - a.credibilityScore);
}
