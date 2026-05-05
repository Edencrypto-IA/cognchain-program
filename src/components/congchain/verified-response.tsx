'use client';

import type { StructuredResponse, VerifiedFact, FactSource } from '@/lib/grounding/types';

interface VerifiedResponseProps {
  response: StructuredResponse;
}

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 80
    ? 'bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/20'
    : score >= 50
      ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20'
      : 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20';
  const icon = score >= 80 ? '✅' : score >= 50 ? '⚠️' : '🚫';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${color}`}>
      {icon} {score}%
    </span>
  );
}

function SourceBadge({ source }: { source: FactSource }) {
  const barColor = source.credibilityScore >= 80
    ? 'bg-[#00d4aa]'
    : source.credibilityScore >= 50
      ? 'bg-[#f59e0b]'
      : 'bg-[#ef4444]';
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${source.name} · Credibilidade: ${source.credibilityScore}/100`}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono
        bg-white/[0.05] border border-white/[0.08] text-[#00a8e8] hover:text-[#00d4aa]
        hover:border-[#00d4aa]/30 transition-colors"
    >
      {source.id}
    </a>
  );
}

function FactRow({ fact, sources }: { fact: VerifiedFact; sources: FactSource[] }) {
  const factSources = sources.filter(s => fact.sources.some(fs => fs.id === s.id));
  const isReview = fact.status === 'review';

  return (
    <div className={`py-3 border-b border-white/[0.04] last:border-0 ${isReview ? 'opacity-80' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#e2e8f0] leading-relaxed">
            {fact.claim}
            {fact.value !== undefined && fact.value !== null && (
              <span className="ml-2 font-semibold text-[#00d4aa]">
                {String(fact.value)}{fact.unit ? ` ${fact.unit}` : ''}
              </span>
            )}
          </p>
          {isReview && (
            <p className="mt-1 text-[11px] text-[#f59e0b]/80">
              ⚠️ Baixa confiança ({fact.confidence}%) — verificado em {fact.sources.length} fonte{fact.sources.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {factSources.map(s => <SourceBadge key={s.id} source={s} />)}
        </div>
      </div>
    </div>
  );
}

function SourceFooter({ sources }: { sources: FactSource[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-4 pt-4 border-t border-white/[0.06]">
      <p className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider mb-2">
        📚 Fontes Consultadas
      </p>
      <div className="space-y-1.5">
        {sources.map(s => {
          const ago = Math.round((Date.now() - new Date(s.fetchedAt).getTime()) / 60000);
          const barColor = s.credibilityScore >= 80 ? 'bg-[#00d4aa]' : s.credibilityScore >= 50 ? 'bg-[#f59e0b]' : 'bg-[#ef4444]';
          return (
            <div key={s.id} className="flex items-center gap-2">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono text-[#00a8e8] hover:text-[#00d4aa] transition-colors w-6"
              >
                {s.id}
              </a>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#64748b] hover:text-[#e2e8f0] transition-colors flex-1 truncate"
              >
                {s.name}
              </a>
              <span className="text-[10px] text-[#64748b]/60">{ago}min</span>
              <div className="w-12 h-1 rounded-full bg-white/[0.06] overflow-hidden flex-shrink-0">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${s.credibilityScore}%` }} />
              </div>
              <span className="text-[10px] text-[#64748b]/60 w-8 text-right">{s.credibilityScore}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OnChainFooter({ meta }: { response: StructuredResponse; meta: StructuredResponse['meta'] }) {
  const hasProof = !!meta.onChainHash && meta.onChainHash.length > 10;
  const shortHash = hasProof ? `${meta.onChainHash.slice(0, 8)}...${meta.onChainHash.slice(-6)}` : null;
  const solscanUrl = hasProof && meta.onChainHash.length > 40
    ? `https://solscan.io/tx/${meta.onChainHash}?cluster=devnet`
    : null;

  return (
    <div className="mt-3 pt-3 border-t border-white/[0.04]">
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748b]">
        {hasProof ? (
          <>
            <span>🔗 Hash: <code className="text-[#00a8e8]">{shortHash}</code></span>
            {meta.blockNumber > 0 && (
              <span>⛓️ Block: <span className="text-[#e2e8f0]">{meta.blockNumber.toLocaleString()}</span></span>
            )}
            <span>🛡️ Program: <code className="text-[#64748b]">BgrtrSJ53...RbhiEL</code></span>
            {solscanUrl && (
              <a href={solscanUrl} target="_blank" rel="noopener noreferrer"
                className="text-[#00d4aa] hover:underline">
                Ver no Solscan →
              </a>
            )}
          </>
        ) : (
          <span className="text-[#64748b]/50">🔗 Prova on-chain: wallet não conectada</span>
        )}
      </div>
    </div>
  );
}

/** Renders a StructuredResponse with verified facts, sources and on-chain proof */
export default function VerifiedResponse({ response }: VerifiedResponseProps) {
  const { meta, facts, allSources } = response;
  const visibleFacts = facts.filter(f => f.status !== 'blocked');

  return (
    <div
      className="w-full max-w-[900px] rounded-2xl border border-white/[0.08] bg-[#111118] overflow-hidden
        animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] bg-[#0a0a0f] flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[#e2e8f0] flex-1 min-w-0 truncate">
          {response.title || response.query}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] text-[#64748b]">
            ✅ {meta.approvedFacts} fato{meta.approvedFacts !== 1 ? 's' : ''}
          </span>
          <ConfidenceBadge score={meta.avgConfidence} />
          {meta.reviewFacts > 0 && (
            <span className="text-[11px] text-[#f59e0b]/80">
              ⚠️ {meta.reviewFacts} em revisão
            </span>
          )}
        </div>
      </div>

      {/* Facts */}
      <div className="px-4">
        {visibleFacts.length > 0 ? (
          visibleFacts.map((fact, i) => (
            <FactRow key={i} fact={fact} sources={allSources} />
          ))
        ) : (
          <p className="py-4 text-sm text-[#64748b]">
            Nenhum fato verificado com confiança suficiente para esta consulta.
          </p>
        )}
      </div>

      {/* Sources + On-chain */}
      <div className="px-4 pb-4">
        <SourceFooter sources={allSources} />
        <OnChainFooter response={response} meta={meta} />
      </div>
    </div>
  );
}
