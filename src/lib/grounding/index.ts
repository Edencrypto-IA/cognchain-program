import { fetchSourcesForQuery } from './parallel-fetcher';
import { filterTrustedSources } from './trust-filter';
import { createSourceLinker } from './source-linker';
import { buildVerifiedResponse, formatResponseAsMarkdown } from './response-builder';
import type { StructuredResponse, RawSource } from './types';

export * from './types';
export * from './trust-filter';
export * from './consensus-engine';
export * from './confidence-calculator';
export * from './source-linker';
export * from './response-builder';
export * from './parallel-fetcher';

/**
 * Group raw sources by metric (same source name = same metric).
 * This prevents consensus engine from treating price vs market-cap as a conflict.
 */
function groupByMetric(sources: RawSource[]): RawSource[][] {
  const map = new Map<string, RawSource[]>();
  for (const s of sources) {
    const key = s.name;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return [...map.values()];
}

/** Returns true if this source name represents a market-data row (not a spot price) */
function isMarketDataRow(name: string): boolean {
  return /máxima|maxima|mínima|minima|volume|market.?cap|variação|variacao|holders/i.test(name);
}

/** Clean a raw source name into a display label */
function cleanLabel(raw: string): string {
  return raw
    .replace(/CoinGecko\s*/i, '')
    .replace(/Jupiter\s*/i, '')
    .replace(/Binance\s*/i, 'Binance ')
    .replace(/Bybit\s*/i, 'Bybit ')
    .replace(/Kraken\s*/i, 'Kraken ')
    .replace(/OKX\s*/i, 'OKX ')
    .replace(/^Price\s*/i, 'Preço ')
    .replace(/Market Cap\s*/i, 'Market Cap ')
    .replace(/\s*\(([^)]+)\)/i, (_, sym) => ' ' + sym.toUpperCase())
    .trim() || raw;
}

/**
 * Full grounding pipeline:
 * fetch → filter → group by metric → one fact per metric → build → format
 */
export async function groundQuery(query: string): Promise<{
  response: StructuredResponse;
  markdown: string;
}> {
  const linker = createSourceLinker();

  // 1. Fetch from real APIs
  const rawSources = await fetchSourcesForQuery(query);

  // 2. Trust filter
  const trusted = filterTrustedSources(rawSources);

  // 3. Detect which tokens are in the query
  const q = query.toLowerCase();
  const TOKEN_CHECKS: [string, string[]][] = [
    ['solana', ['solana', 'sol ', ' sol,', ' sol.']],
    ['bonk',   ['bonk']],
    ['pengu',  ['pengu', 'pudgy']],
    ['jup',    ['jupiter', ' jup']],
    ['ray',    ['raydium', ' ray']],
  ];
  const detectedTokens = TOKEN_CHECKS
    .filter(([, checks]) => checks.some(c => q.includes(c)))
    .map(([name]) => name);

  const allGroups = groupByMetric(rawSources).filter(g => g.length > 0);
  let factGroups: RawSource[][];

  if (detectedTokens.length > 1) {
    // Multi-token: one price fact per detected token (not market data rows)
    const seenTokens = new Set<string>();
    factGroups = [];
    for (const token of detectedTokens) {
      for (const group of allGroups) {
        const name = group[0].name.toLowerCase();
        if (name.includes(token) && !isMarketDataRow(name) && !seenTokens.has(token)) {
          seenTokens.add(token);
          factGroups.push(group);
          break;
        }
      }
    }
    // Fallback to full data if only one or zero tokens matched
    if (factGroups.length <= 1) factGroups = allGroups.slice(0, 8);
  } else {
    // Single token: full market data table (up to 8 rows)
    factGroups = allGroups.slice(0, 8);
  }

  // 4. Build one verified fact per group
  const facts = trusted.length > 0
    ? factGroups.map(group => linker.buildVerifiedFact(cleanLabel(group[0].name), group))
    : [];

  // 5. Build structured response
  const response = buildVerifiedResponse(query, facts, linker.getAllSources());

  // 5. Format as markdown
  const markdown = formatResponseAsMarkdown(response);

  return { response, markdown };
}

/** Check if a query is data-heavy (needs grounding) */
export function needsGrounding(query: string): boolean {
  const triggers = [
    'preço', 'preco', 'price', 'valor', 'market cap', 'tvl', 'token', 'sol ',
    'volume', 'variação', 'variacao', '24h', 'rank', 'top ', 'maior',
    'estatística', 'dados', 'número', 'quantos', 'quanto', 'how much', 'how many',
    'cotação', 'cotacao', 'hoje',
  ];
  const q = query.toLowerCase();
  return triggers.some(t => q.includes(t));
}
