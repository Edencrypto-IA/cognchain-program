'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
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
  content?: string;
  modelLabel?: string;
  timestamp?: string;
  memoryHash?: string;
  onContinueMemory?: (model: string) => void;
}

const CONTINUE_MODELS = [
  { key: 'nvidia', label: 'NVIDIA Llama' },
  { key: 'gpt', label: 'GPT-4o' },
  { key: 'claude', label: 'Claude' },
  { key: 'gemini', label: 'Gemini' },
  { key: 'deepseek', label: 'DeepSeek' },
  { key: 'qwen', label: 'Qwen3' },
];

function getRenderableItems(response: StructuredResponse) {
  const section = response.sections[0];
  if (!section) return [];
  return section.items.filter(item => {
    const key = Object.keys(item)[0];
    return Boolean(key?.trim());
  });
}

function MemoryAnswerCard({
  response,
  content,
  modelLabel,
  timestamp,
  memoryHash,
  onContinueMemory,
}: ResponseRouterProps) {
  const [showModels, setShowModels] = useState(false);
  const { allSources, meta } = response;
  const hash = memoryHash || meta.onChainHash;
  const verifiedAt = timestamp || (meta.verifiedAt ? new Date(meta.verifiedAt).toLocaleString('pt-BR') : 'Agora');
  const answer = content?.trim() || response.title || 'Resposta verificada gerada pelo CONGCHAIN.';

  return (
    <div className="w-full max-w-[900px] overflow-hidden rounded-2xl border border-[#1e293b] bg-[#08080f] shadow-[0_4px_24px_rgba(0,0,0,0.4)] animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="border-b border-[#1e293b] bg-gradient-to-r from-[#0d0d1a] via-[#101020] to-[#0b1210] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-[#9945FF]/30 bg-gradient-to-r from-[#9945FF]/20 to-[#14F195]/20 px-3 py-1">
                <div className="h-4 w-4 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195]" />
                <span className="text-[11px] font-black tracking-widest text-[#C084FC]">CONGCHAIN</span>
              </div>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/55">
                {modelLabel || 'AI Agent'}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white/90">{response.title || 'Memoria verificada'}</h3>
            <p className="mt-1 text-[11px] text-white/35">Construida em {verifiedAt}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30">Confianca</span>
            <ConfidenceRing value={meta.avgConfidence} size="sm" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#14F195]/20 bg-[#14F195]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#14F195]/70">
            Dados em tempo real
          </span>
          {allSources.length > 0 && (
            <span className="rounded-full border border-[#9945FF]/20 bg-[#9945FF]/10 px-2 py-0.5 text-[10px] text-[#C084FC]/80">
              {allSources.length} fonte{allSources.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5">
        <section>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/25">Resposta</p>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 text-[14px] leading-relaxed text-white/78">
            <div className="prose prose-invert prose-sm max-w-none
              prose-p:my-2 prose-headings:my-3 prose-headings:text-white/90 prose-headings:font-semibold
              prose-strong:text-white prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
              prose-table:my-3 prose-table:text-[13px] prose-th:border-white/10 prose-td:border-white/[0.06]
              prose-th:bg-white/[0.04] prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2
              prose-code:text-[#14F195] prose-code:bg-[#14F195]/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
              <ReactMarkdown>{answer}</ReactMarkdown>
            </div>
          </div>
        </section>

        <section>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/25">Fontes utilizadas</p>
          {allSources.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {allSources.map(source => (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-white/[0.06] bg-black/25 p-3 transition-colors hover:border-[#14F195]/25 hover:bg-[#14F195]/[0.04]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-white/70">{source.name}</span>
                    <span className="text-[10px] text-[#14F195]/65">{Math.round(source.credibilityScore)}/100</span>
                  </div>
                  <p className="mt-1 truncate text-[10px] text-white/28">{source.url}</p>
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3 text-xs text-white/35">
              Nenhuma fonte externa foi anexada pelo stream. A resposta acima veio do modelo selecionado e do contexto de memoria ativo.
            </div>
          )}
        </section>

        {hash && (
          <section>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/25">Hash da memoria</p>
            <div className="rounded-xl border border-[#14F195]/15 bg-[#14F195]/[0.04] p-3">
              <OnChainProof hash={hash} blockNumber={meta.blockNumber} />
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-[#9945FF]/15 bg-[#9945FF]/[0.04] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white/85">Continuar a memoria</p>
              <p className="mt-1 text-xs text-white/40">Escolha outra IA para herdar este contexto verificado.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowModels(v => !v)}
              disabled={!onContinueMemory}
              className="rounded-xl border border-[#9945FF]/30 bg-[#9945FF]/15 px-3 py-2 text-xs font-semibold text-[#C084FC] transition-colors hover:border-[#14F195]/30 hover:text-[#14F195] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar a memoria
            </button>
          </div>
          {showModels && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {CONTINUE_MODELS.map(model => (
                <button
                  key={model.key}
                  type="button"
                  onClick={() => onContinueMemory?.(model.key)}
                  className="rounded-xl border border-white/[0.07] bg-black/25 px-3 py-2 text-left text-xs font-semibold text-white/65 transition-colors hover:border-[#14F195]/30 hover:bg-[#14F195]/[0.05] hover:text-[#14F195]"
                >
                  {model.label}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ResponseRouter({ response, content, modelLabel, timestamp, memoryHash, onContinueMemory }: ResponseRouterProps) {
  const { sections, facts, allSources, meta } = response;
  const section = sections[0];
  const type = section?.type ?? 'analysis';
  const renderableItems = getRenderableItems(response);
  const canRenderDashboard = Boolean(section) && (type !== 'analysis' || renderableItems.length >= 4);
  const dashProps = section ? { section, allSources, meta } : null;

  const hasData = facts.some(f => f.status !== 'blocked');
  if (!canRenderDashboard && content?.trim()) {
    return (
      <MemoryAnswerCard
        response={response}
        content={content}
        modelLabel={modelLabel}
        timestamp={timestamp}
        memoryHash={memoryHash}
        onContinueMemory={onContinueMemory}
      />
    );
  }
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
        {section && dashProps ? (
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
