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

  // 3. Build one verified fact per metric group (avoids conflict on price vs market cap)
  const facts = trusted.length > 0
    ? groupByMetric(rawSources)
        .filter(group => group.length > 0)
        .slice(0, 6) // max 6 facts
        .map(group => {
          // Clean label: "CoinGecko Price (solana)" → "Preço SOL"
          const raw = group[0].name;
          const label = raw
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
          return linker.buildVerifiedFact(label, group);
        })
    : [];

  // 4. Build structured response
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
