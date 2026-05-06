'use client';
import type { StructuredResponse } from '@/lib/grounding/types';
import RankingDashboard    from './RankingDashboard';
import ComparisonDashboard from './ComparisonDashboard';
import MetricsDashboard    from './MetricsDashboard';
import TimelineDashboard   from './TimelineDashboard';
import ProcessDashboard    from './ProcessDashboard';
import AnalysisDashboard   from './AnalysisDashboard';
import OnChainProof        from './shared/OnChainProof';
import FactCard            from './shared/FactCard';
import EmptyState          from './shared/EmptyState';
import ConfidenceRing      from './shared/ConfidenceRing';

interface ResponseRouterProps {
  response: StructuredResponse;
}

export default function ResponseRouter({ response }: ResponseRouterProps) {
  const { sections, facts, allSources, meta } = response;
  const section = sections[0];
  const type = section?.type ?? 'analysis';

  const dashProps = { section: section!, allSources, meta };

  const hasData = facts.some(f => f.status !== 'blocked');
  if (!hasData && facts.length > 0) return <EmptyState type="no-data" />;

  return (
    <div className="w-full max-w-[900px] rounded-2xl border border-[#1e293b] bg-[#0a0a0f] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.4)] animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* CONGCHAIN branded header */}
      <div className="border-b border-[#1e293b] bg-gradient-to-r from-[#0d0d1a] via-[#0f0f1e] to-[#0d0d1a]">
        {/* Top row: logo + name + confidence */}
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            {/* Logo pill */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-[#9945FF]/20 to-[#14F195]/20 border border-[#9945FF]/30">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M5 1L8.5 3V7L5 9L1.5 7V3L5 1Z" fill="white" fillOpacity="0.9"/>
                </svg>
              </div>
              <span className="text-[11px] font-black tracking-widest bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">
                CONGCHAIN
              </span>
            </div>
            {/* Subtitle */}
            <span className="hidden sm:block text-[10px] text-[#334155] font-medium">
              Verifiable AI Memory Layer
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#334155]">Confiança</span>
            <ConfidenceRing value={meta.avgConfidence} size="sm" />
          </div>
        </div>
        {/* Bottom row: verified tags */}
        <div className="flex items-center gap-2 px-5 pb-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1e3a2f] bg-[#14F195]/10 border border-[#14F195]/20 px-2 py-0.5 rounded-full">
            ✓ Dados em Tempo Real
          </span>
          {meta.approvedFacts > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#14F195]/10 text-[#14F195]/80 border border-[#14F195]/20">
              {meta.approvedFacts} verificado{meta.approvedFacts !== 1 ? 's' : ''}
            </span>
          )}
          {meta.apiSourcesUsed > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#9945FF]/10 text-[#9945FF]/70 border border-[#9945FF]/20">
              {meta.apiSourcesUsed} fonte{meta.apiSourcesUsed !== 1 ? 's' : ''} API
            </span>
          )}
          {meta.reviewFacts > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f59e0b]/10 text-[#f59e0b]/80 border border-[#f59e0b]/20">
              ⚠ {meta.reviewFacts} em revisão
            </span>
          )}
        </div>
      </div>

      {/* Dashboard content */}
      <div className="p-5">
        {section ? (
          <>
            {type === 'ranking'    && <RankingDashboard    {...dashProps} />}
            {type === 'comparison' && <ComparisonDashboard {...dashProps} />}
            {type === 'metrics'    && <MetricsDashboard    {...dashProps} />}
            {type === 'timeline'   && <TimelineDashboard   {...dashProps} />}
            {type === 'process'    && <ProcessDashboard    {...dashProps} />}
            {type === 'analysis'   && <AnalysisDashboard   {...dashProps} />}
            {!['ranking','comparison','metrics','timeline','process','analysis'].includes(type) && (
              <div className="space-y-3">
                {facts.filter(f => f.status !== 'blocked').map((f, i) => (
                  <FactCard key={i} fact={f} index={i} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {facts.filter(f => f.status !== 'blocked').map((f, i) => (
              <FactCard key={i} fact={f} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* On-chain proof footer */}
      {meta.onChainHash && (
        <div className="px-5 py-3 border-t border-[#1e293b] bg-[#111118]/50">
          <OnChainProof
            hash={meta.onChainHash}
            blockNumber={meta.blockNumber}
          />
        </div>
      )}
    </div>
  );
}
