import type { FactSource, VerifiedFact, RawSource } from './types';
import { filterTrustedSources } from './trust-filter';
import { calculateConsensus } from './consensus-engine';
import { calculateConfidence, confidenceToStatus } from './confidence-calculator';

const SUPERSCRIPTS = ['¹','²','³','⁴','⁵','⁶','⁷','⁸','⁹','¹⁰'];

export function createSourceLinker() {
  const sources: FactSource[] = [];
  let counter = 0;

  function addSource(raw: RawSource): FactSource {
    const existing = sources.find(s => s.url === raw.url);
    if (existing) return existing;

    const id = `[${SUPERSCRIPTS[counter] ?? String(counter + 1)}]`;
    counter++;
    const [filtered] = filterTrustedSources([{ ...raw, fromApi: raw.fromApi }]);
    const source: FactSource = filtered
      ? { ...filtered, id }
      : {
          id,
          name: raw.name,
          url: raw.url,
          fetchedAt: new Date().toISOString(),
          credibilityScore: 50,
          rawValue: raw.value,
          ...(raw.fromApi ? { apiEndpoint: raw.url } : {}),
        };
    sources.push(source);
    return source;
  }

  function buildVerifiedFact(claim: string, rawSources: RawSource[]): VerifiedFact {
    const factSources = rawSources.map(r => addSource(r));
    const consensus = calculateConsensus(factSources);
    const partial: VerifiedFact = {
      claim,
      value: consensus.agreedValue,
      sources: factSources,
      consensus: consensus.type,
      confidence: 0,
      verifiedAt: new Date().toISOString(),
      status: 'blocked',
    };
    const confidence = calculateConfidence(partial);
    return { ...partial, confidence, status: confidenceToStatus(confidence) };
  }

  function getAllSources(): readonly FactSource[] {
    return [...sources];
  }

  function generateFooter(): string {
    return sources
      .map(s => {
        const ago = Math.round((Date.now() - new Date(s.fetchedAt).getTime()) / 60000);
        return `${s.id} ${s.name} — ${s.url} · ${ago}min atrás · score: ${s.credibilityScore}`;
      })
      .join('\n');
  }

  function reset(): void {
    sources.length = 0;
    counter = 0;
  }

  return { addSource, buildVerifiedFact, getAllSources, generateFooter, reset };
}
