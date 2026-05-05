import type { VerifiedFact, FactSource, StructuredResponse, ResponseSection } from './types';
import { sha256 } from '@/lib/utils/hash';

function detectSectionType(query: string): ResponseSection['type'] {
  const q = query.toLowerCase();
  if (q.includes('top') || q.includes('maior') || q.includes('rank')) return 'ranking';
  if (q.includes('vs') || q.includes('compar')) return 'comparison';
  // Price/market queries → metrics dashboard (gauge + table)
  if (q.includes('preço') || q.includes('preco') || q.includes('price') ||
      q.includes('cotação') || q.includes('cotacao') || q.includes('tvl') ||
      q.includes('volume') || q.includes('market cap')) return 'metrics';
  if (q.includes('como') || q.includes('how')) return 'process';
  return 'analysis';
}

/** Build the final structured response from verified facts */
export function buildVerifiedResponse(
  query: string,
  verifiedFacts: readonly VerifiedFact[],
  allSources: readonly FactSource[],
): StructuredResponse {
  const visible = verifiedFacts.filter(f => f.status !== 'blocked');
  const approved = visible.filter(f => f.status === 'approved');
  const review = visible.filter(f => f.status === 'review');
  const blocked = verifiedFacts.filter(f => f.status === 'blocked');
  const avgConf = visible.length > 0
    ? Math.round(visible.reduce((s, f) => s + f.confidence, 0) / visible.length)
    : 0;

  const section: ResponseSection = {
    type: detectSectionType(query),
    heading: query,
    items: visible.map(f => ({
      [f.claim]: {
        value: f.value,
        sources: f.sources.map(s => s.id),
        ...(f.status === 'review' ? { note: `⚠️ Baixa confiança (${f.confidence}%)` } : {}),
      },
    })),
  };

  const meta = {
    totalFacts: verifiedFacts.length,
    approvedFacts: approved.length,
    reviewFacts: review.length,
    blockedFacts: blocked.length,
    avgConfidence: avgConf,
    apiSourcesUsed: allSources.filter(s => s.apiEndpoint).length,
    webSourcesUsed: allSources.filter(s => !s.apiEndpoint).length,
    onChainHash: sha256(JSON.stringify({ query, facts: visible.length, avgConf })),
    blockNumber: 0,
    verifiedAt: new Date().toISOString(),
  };

  return {
    title: query,
    query,
    sections: [section],
    facts: [...verifiedFacts],
    allSources: [...allSources],
    meta,
  };
}

/** Format StructuredResponse as readable markdown for chat */
export function formatResponseAsMarkdown(resp: StructuredResponse): string {
  const lines: string[] = [];
  lines.push(`**${resp.title}**`);
  lines.push(`✅ ${resp.meta.approvedFacts} fatos verificados · Confiança média: ${resp.meta.avgConfidence}%`);
  lines.push('');

  for (const fact of resp.facts) {
    if (fact.status === 'blocked') continue;
    const sourceIds = fact.sources.map(s => s.id).join('');
    const warn = fact.status === 'review' ? ` ⚠️ ${fact.confidence}%` : '';
    lines.push(`• ${fact.claim}: **${fact.value}**${fact.unit ? ' ' + fact.unit : ''} ${sourceIds}${warn}`);
  }

  if (resp.allSources.length > 0) {
    lines.push('');
    lines.push('**📚 Fontes**');
    for (const s of resp.allSources) {
      const ago = Math.round((Date.now() - new Date(s.fetchedAt).getTime()) / 60000);
      lines.push(`${s.id} [${s.name}](${s.url}) · ${ago}min`);
    }
  }

  lines.push('');
  lines.push(`🔗 Hash de verificação: \`${resp.meta.onChainHash.slice(0, 16)}...\``);

  return lines.join('\n');
}
