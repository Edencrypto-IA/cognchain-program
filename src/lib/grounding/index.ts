import { fetchSourcesForQuery } from './parallel-fetcher';
import { filterTrustedSources } from './trust-filter';
import { createSourceLinker } from './source-linker';
import { buildVerifiedResponse, formatResponseAsMarkdown } from './response-builder';
import type { StructuredResponse } from './types';

export * from './types';
export * from './trust-filter';
export * from './consensus-engine';
export * from './confidence-calculator';
export * from './source-linker';
export * from './response-builder';
export * from './parallel-fetcher';

/**
 * Full grounding pipeline:
 * fetch → filter → link → build → format
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

  // 3. Build verified facts — group by claim
  const facts = trusted.length > 0
    ? [linker.buildVerifiedFact(query, rawSources)]
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
    'preço', 'price', 'valor', 'market cap', 'tvl', 'token', 'sol ',
    'volume', 'variação', '24h', 'rank', 'top ', 'maior', 'estatística',
    'dados', 'número', 'quantos', 'quanto', 'how much', 'how many',
  ];
  const q = query.toLowerCase();
  return triggers.some(t => q.includes(t));
}
