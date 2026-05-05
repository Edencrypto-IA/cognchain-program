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

      {/* Global header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e293b] bg-[#111118]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
            Resposta Verificada · CognChain
          </span>
          {meta.approvedFacts > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20">
              ✅ {meta.approvedFacts} fato{meta.approvedFacts !== 1 ? 's' : ''}
            </span>
          )}
          {meta.reviewFacts > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20">
              ⚠️ {meta.reviewFacts} em revisão
            </span>
          )}
        </div>
        <ConfidenceRing value={meta.avgConfidence} size="sm" />
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
