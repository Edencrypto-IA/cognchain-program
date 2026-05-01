'use client';

import { useEffect, useState } from 'react';
import {
  GitBranch, Zap, Shield, AlertTriangle, Check, X as XIcon,
  Loader2, ExternalLink, Clock, ArrowRight, Brain,
} from 'lucide-react';

interface DecisionRecord {
  id: string;
  ruleId: string;
  condition: string;
  action: string;
  result: string;
  evidence?: string;
  output?: string;
  txHash?: string;
  timestamp: number;
  createdAt: string;
}

interface DecisionTimelineProps {
  agentId: string;
  compact?: boolean;
}

const ACTION_ICONS: Record<string, string> = {
  notify: '\u{1F514}',
  analyze: '\u{1F4CA}',
  save_preference: '\u{1F4BE}',
  webhook_trigger: '\u{1F517}',
  blockchain_anchor: '\u26D3\uFE0F',
  memory_query: '\u{1F50D}',
};

const ACTION_LABELS: Record<string, string> = {
  notify: 'Notificacao',
  analyze: 'Analise',
  save_preference: 'Salvar Preferencia',
  webhook_trigger: 'Webhook',
  blockchain_anchor: 'Blockchain Anchor',
  memory_query: 'Query Memoria',
};

function timeAgo(timestamp: number): string {
  const diff = Math.floor(Date.now() / 1000 - timestamp);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atras`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atras`;
  return `${Math.floor(diff / 86400)}d atras`;
}

function parseCondition(conditionStr: string): string {
  try {
    const c = JSON.parse(conditionStr);
    const typeLabels: Record<string, string> = {
      memory_contains: 'Memoria contem',
      memory_score_above: 'Score acima de',
      memory_newer_than: 'Mais novo que',
    };
    return `${typeLabels[c.type] || c.type}: "${c.value}"`;
  } catch {
    return conditionStr;
  }
}

export default function DecisionTimeline({ agentId, compact }: DecisionTimelineProps) {
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    fetch(`/api/agents/${agentId}/decisions?limit=30`)
      .then(r => r.json())
      .then(data => setDecisions(data.decisions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agentId]);

  // Auto-refresh every 10s
  useEffect(() => {
    if (!agentId) return;
    const interval = setInterval(() => {
      fetch(`/api/agents/${agentId}/decisions?limit=30`)
        .then(r => r.json())
        .then(data => setDecisions(data.decisions || []))
        .catch(() => {});
    }, 10_000);
    return () => clearInterval(interval);
  }, [agentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[#9945FF]/50" />
          <p className="text-xs text-white/30">Carregando decisoes...</p>
        </div>
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#9945FF]/10 border border-[#9945FF]/20">
          <Brain className="h-6 w-6 text-[#9945FF]/50" />
        </div>
        <p className="text-sm text-white/40">Nenhuma decisao autonoma ainda</p>
        <p className="mt-1 text-[11px] text-white/20 max-w-xs">
          Adicione regras ao agente para ativar decisoes autonomas. O agente vai ler memorias, decidir e agir automaticamente.
        </p>
      </div>
    );
  }

  const successCount = decisions.filter(d => d.result === 'success').length;
  const failureCount = decisions.filter(d => d.result === 'failure').length;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      {!compact && (
        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#14F195] animate-pulse" />
            <span className="text-[11px] text-white/40">
              <span className="font-semibold text-[#14F195]/80">{successCount}</span> executadas
            </span>
          </div>
          {failureCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[#FF4458]/60" />
              <span className="text-[11px] text-white/40">
                <span className="font-semibold text-[#FF4458]/80">{failureCount}</span> falhas
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-white/20" />
            <span className="text-[11px] text-white/30">Auto-refresh 10s</span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-[#9945FF]/30 via-[#00D1FF]/20 to-[#14F195]/10" />

        <div className="space-y-1">
          {decisions.map((decision, idx) => {
            const isExpanded = expanded === decision.id;
            const isSuccess = decision.result === 'success';
            const isLatest = idx === 0;

            return (
              <div key={decision.id} className="relative flex gap-4 group">
                {/* Node */}
                <div className="relative z-10 flex-shrink-0">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                    isLatest
                      ? isSuccess
                        ? 'bg-gradient-to-br from-[#9945FF] to-[#14F195] border-transparent shadow-lg shadow-[#9945FF]/20'
                        : 'bg-gradient-to-br from-[#FF4458]/40 to-[#FF4458]/20 border-[#FF4458]/40'
                      : isSuccess
                        ? 'bg-[#14F195]/10 border-[#14F195]/30'
                        : 'bg-[#FF4458]/5 border-[#FF4458]/20'
                  }`}>
                    <span className="text-sm">{ACTION_ICONS[decision.action] || '\u26A1'}</span>
                  </div>
                </div>

                {/* Card */}
                <div
                  className={`flex-1 min-w-0 mb-1 ${compact ? 'cursor-default' : 'cursor-pointer'}`}
                  onClick={() => compact ? undefined : setExpanded(isExpanded ? null : decision.id)}
                >
                  <div className={`rounded-xl border transition-all ${
                    isLatest
                      ? isSuccess
                        ? 'bg-gradient-to-r from-[#9945FF]/5 via-[#00D1FF]/3 to-transparent border-[#9945FF]/20'
                        : 'bg-[#FF4458]/3 border-[#FF4458]/10'
                      : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]'
                  } ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs font-semibold ${isSuccess ? 'text-[#14F195]/90' : 'text-[#FF4458]/80'}`}>
                          {ACTION_LABELS[decision.action] || decision.action}
                        </span>
                        {isLatest && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#9945FF]/10 text-[9px] text-[#9945FF]/70 font-medium">
                            <Zap className="w-2.5 h-2.5" />
                            latest
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-white/20 flex-shrink-0">{timeAgo(decision.timestamp)}</span>
                    </div>

                    {/* Condition */}
                    {!compact && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/35">
                        <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-white/[0.04] text-white/25">
                          IF
                        </span>
                        <span>{parseCondition(decision.condition)}</span>
                      </div>
                    )}

                    {/* Expanded details */}
                    {isExpanded && !compact && (
                      <div className="mt-3 space-y-2 border-t border-white/[0.04] pt-3">
                        {/* Output */}
                        {decision.output && (
                          <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-2.5">
                            <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Output</p>
                            <p className="text-[12px] text-white/50 leading-relaxed whitespace-pre-wrap">{decision.output}</p>
                          </div>
                        )}

                        {/* Evidence */}
                        {decision.evidence && (
                          <div className="flex items-center gap-2">
                            <Shield className="h-3.5 w-3.5 text-[#14F195]/50" />
                            <span className="text-[11px] text-white/30">
                              Evidencia: <code className="text-[#14F195]/60 font-mono">{decision.evidence.substring(0, 16)}...</code>
                            </span>
                          </div>
                        )}

                        {/* Blockchain proof */}
                        {decision.txHash && (
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-3.5 w-3.5 text-[#9945FF]/50" />
                            <a
                              href={`https://explorer.solana.com/tx/${decision.txHash}?cluster=devnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[11px] text-[#9945FF]/60 hover:text-[#9945FF]/90 transition-colors"
                            >
                              On-chain proof
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        )}

                        {/* Status badge */}
                        <div className="flex items-center gap-1.5">
                          {isSuccess ? (
                            <span className="flex items-center gap-1 text-[10px] text-[#14F195]/70 bg-[#14F195]/5 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" /> Success
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] text-[#FF4458]/70 bg-[#FF4458]/5 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="w-3 h-3" /> Failed
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
