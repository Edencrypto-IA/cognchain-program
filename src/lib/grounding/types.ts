export interface FactSource {
  id: string;
  name: string;
  url: string;
  apiEndpoint?: string;
  fetchedAt: string;
  credibilityScore: number;
  rawValue: unknown;
}

export interface VerifiedFact {
  claim: string;
  value: unknown;
  unit?: string;
  sources: FactSource[];
  consensus: 'strong' | 'partial' | 'weak' | 'conflict';
  confidence: number;
  verifiedAt: string;
  status: 'approved' | 'review' | 'blocked';
}

export interface VerificationMeta {
  totalFacts: number;
  approvedFacts: number;
  reviewFacts: number;
  blockedFacts: number;
  avgConfidence: number;
  apiSourcesUsed: number;
  webSourcesUsed: number;
  onChainHash: string;
  blockNumber: number;
  verifiedAt: string;
}

export interface ResponseSection {
  type: 'ranking' | 'comparison' | 'metrics' | 'timeline' | 'process' | 'analysis';
  heading: string;
  items: ResponseItem[];
}

export interface ResponseItem {
  [key: string]: {
    value: unknown;
    sources: string[];
    note?: string;
  };
}

export interface StructuredResponse {
  title: string;
  query: string;
  sections: ResponseSection[];
  facts: VerifiedFact[];
  allSources: FactSource[];
  meta: VerificationMeta;
}

export interface RawResult {
  name: string;
  url: string;
  value: unknown;
  fromApi: boolean;
}

export interface ConsensusResult {
  type: 'strong' | 'partial' | 'weak' | 'conflict';
  agreedValue: unknown;
}

export interface RawSource {
  name: string;
  url: string;
  value: unknown;
  fromApi: boolean;
}

export function isFactSource(obj: unknown): obj is FactSource {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.url === 'string' && typeof o.credibilityScore === 'number';
}

export function isVerifiedFact(obj: unknown): obj is VerifiedFact {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return typeof o.claim === 'string' && typeof o.confidence === 'number' && typeof o.status === 'string';
}
