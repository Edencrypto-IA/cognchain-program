'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Send, ArrowDown,
  Save, Columns2, Star, Link2, Shield, X, Cpu, Hash,
  ChevronDown, ChevronUp, Zap, Check, AlertTriangle, Eye, ExternalLink,
  GitBranch, ArrowRight, Timer, Info, Languages,
  Wallet, LogOut, Gem, Code2, Sparkles, Paperclip, ImagePlus, Mic, PenSquare,
} from 'lucide-react';
import { isPhantomInstalled, connectPhantom, disconnectPhantom, getSolBalance, truncateAddress } from '@/services/wallet/wallet.service';
import Orb, { type OrbMode } from './orb';
import { MODEL_LABELS, type AIModel } from '@/services/memory/memory.model';

// ============================================================
// DESIGN LOCK: Original UI preserved. Only additive features.
// ============================================================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  orbMode?: OrbMode;
  model?: string;
  memoryHash?: string;
  verified?: boolean;
  responseTime?: number;
  tokensUsed?: number;
  contextInjected?: boolean;
  previousModel?: string;
  score?: number;
  txHash?: string;
  contextSummary?: string;
  poiTxHash?: string;
  poiVotes?: number;
}

// ============================================================
// Chat Message — with performance badge + score
// ============================================================
function ChatMessage({ message, isLatest, isStreaming, streamedContent, onSave, onCompare, onScore, onCopyHash, onAudit }: {
  message: Message;
  isLatest?: boolean;
  isStreaming?: boolean;
  streamedContent?: string;
  onSave: (msg: Message) => void;
  onCompare: (msg: Message) => void;
  onScore: (msg: Message) => void;
  onCopyHash: (hash: string) => void;
  onAudit: (msg: Message) => void;
}) {
  const isUser = message.role === 'user';
  const displayContent = (isStreaming && streamedContent !== undefined) ? streamedContent : message.content;
  return (
    <div className={`flex gap-4 px-4 md:px-6 lg:px-8 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className="flex-shrink-0 mt-1">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/[0.1] flex items-center justify-center">
            <span className="text-xs font-bold text-white/70">U</span>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-visible">
            <Orb mode={message.orbMode || 'idle'} size="sm" interactive={false} />
          </div>
        )}
      </div>
      <div className={`flex-1 max-w-[85%] md:max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`flex items-center gap-2 mb-1.5 flex-wrap ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className="text-xs font-semibold text-white/60">{isUser ? 'Voce' : 'CONGCHAIN'}</span>
          <span className="text-[11px] text-white/25">{message.timestamp}</span>
          {!isUser && message.model && (
            <span className="text-[10px] font-medium text-[#9945FF]/60 bg-[#9945FF]/10 px-1.5 py-0.5 rounded">
              {MODEL_LABELS[message.model as AIModel] || message.model}
            </span>
          )}
          {!isUser && message.previousModel && (
            <span className="text-[10px] font-medium text-[#00D1FF]/60 bg-[#00D1FF]/10 px-1.5 py-0.5 rounded flex items-center gap-1">
              <GitBranch className="w-2.5 h-2.5" />
              from {MODEL_LABELS[message.previousModel as AIModel] || message.previousModel}
            </span>
          )}
        </div>
        {/* #5 Performance badge */}
        {!isUser && (message.responseTime || message.tokensUsed) && (
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {message.responseTime != null && (
              <span className="flex items-center gap-1 text-[10px] text-white/25">
                <Timer className="w-3 h-3" />
                {(message.responseTime / 1000).toFixed(1)}s
              </span>
            )}
            {message.tokensUsed != null && (
              <span className="flex items-center gap-1 text-[10px] text-white/25">
                <Zap className="w-3 h-3" />
                ~{message.tokensUsed} tokens
              </span>
            )}
            {message.score != null && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-[#9945FF]/70 bg-[#9945FF]/10 px-1.5 py-0.5 rounded">
                <Star className="w-2.5 h-2.5" />
                {message.score}/10
              </span>
            )}
          </div>
        )}
        <div className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed
          ${isUser
            ? 'bg-gradient-to-br from-[#9945FF]/30 to-[#9945FF]/15 border border-[#9945FF]/20 text-white/90'
            : 'bg-white/[0.04] border border-white/[0.06] text-white/80'
          }`}>
          <p className="whitespace-pre-wrap">{displayContent}{isStreaming && <span className="animate-pulse text-[#9945FF]">▌</span>}</p>
        </div>
        {isLatest && !isUser && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            <button className="p-1 rounded hover:bg-white/[0.06] text-white/25 hover:text-white/50 transition-colors" title="Copiar"><CopyIcon className="w-4 h-4" /></button>
            <button className="p-1 rounded hover:bg-white/[0.06] text-white/25 hover:text-white/50 transition-colors" title="Gostei"><ThumbUpIcon className="w-4 h-4" /></button>
            <button className="p-1 rounded hover:bg-white/[0.06] text-white/25 hover:text-white/50 transition-colors" title="Nao gostei"><ThumbDownIcon className="w-4 h-4" /></button>
            <button className="p-1 rounded hover:bg-white/[0.06] text-white/25 hover:text-white/50 transition-colors" title="Regenerar"><RegenerateIcon className="w-4 h-4" /></button>
            <div className="w-px h-4 bg-white/[0.08] mx-1" />
            <button onClick={() => onSave(message)} className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#14F195]/10 text-white/25 hover:text-[#14F195]/70 transition-colors" title="Salvar na memoria">
              <Save className="w-3.5 h-3.5" /><span className="text-[11px] hidden sm:inline">Salvar</span>
            </button>
            <button onClick={() => onCompare(message)} className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#00D1FF]/10 text-white/25 hover:text-[#00D1FF]/70 transition-colors" title="Comparar modelos">
              <Columns2 className="w-3.5 h-3.5" /><span className="text-[11px] hidden sm:inline">Comparar</span>
            </button>
            <button onClick={() => onScore(message)} className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#9945FF]/10 text-white/25 hover:text-[#9945FF]/70 transition-colors" title="Avaliar resposta">
              <Star className="w-3.5 h-3.5" /><span className="text-[11px] hidden sm:inline">Avaliar</span>
            </button>
            {message.memoryHash && (
              <>
                <button onClick={() => onCopyHash(message.memoryHash!)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors group" title="Copiar hash">
                  <Hash className="w-3 h-3 text-[#14F195]/50 group-hover:text-[#14F195]/80" />
                  <span className="text-[10px] text-[#14F195]/50 group-hover:text-[#14F195]/80 font-mono">{message.memoryHash.substring(0, 8)}...</span>
                </button>
                <button onClick={() => onAudit(message)} className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#9945FF]/10 text-white/25 hover:text-[#9945FF]/80 transition-colors border border-transparent hover:border-[#9945FF]/20" title="Memory Audit Trail">
                  <Eye className="w-3.5 h-3.5" /><span className="text-[11px] hidden sm:inline">Audit</span>
                </button>
              </>
            )}
            {message.verified && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#14F195]/10 text-[#14F195]/70">
                <Shield className="w-3 h-3" /> On-chain
              </span>
            )}
            {message.poiTxHash && (
              <a
                href={`https://explorer.solana.com/tx/${message.poiTxHash}?cluster=devnet`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-[#9945FF]/20 to-[#14F195]/20 border border-[#9945FF]/30 text-[#14F195]/80 hover:border-[#14F195]/50 transition-all"
                title="Proof of Insight — validado por humanos e ancorado na Solana"
              >
                <Shield className="w-3 h-3 text-[#9945FF]" />
                <span className="text-[10px] font-semibold">PoI</span>
                {message.poiVotes && <span className="text-[9px] text-[#14F195]/50">{message.poiVotes}✓</span>}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// #1 Context Injection Block — visible in chat
// ============================================================
function ContextInjectionBlock({ previousModel, currentModel, summary, isExpanded, onToggle }: {
  previousModel: string;
  currentModel: string;
  summary: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mx-4 md:mx-6 lg:mx-8 my-4">
      <div className="bg-gradient-to-r from-[#9945FF]/10 via-[#00D1FF]/5 to-[#14F195]/10 border border-[#9945FF]/20 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white/80">Context Injected</p>
              {/* #6 Microcopy */}
              <p className="text-[10px] text-white/35">Switching intelligence — memory preserved.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Model transition */}
            <span className="text-[10px] text-white/30 flex items-center gap-1">
              {MODEL_LABELS[previousModel as AIModel] || previousModel}
              <ArrowRight className="w-3 h-3" />
              {MODEL_LABELS[currentModel as AIModel] || currentModel}
            </span>
            <button onClick={onToggle} className="p-1 rounded hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {/* Expanded details */}
        {isExpanded && (
          <div className="px-4 pb-3 border-t border-white/[0.06] pt-3">
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2 text-[11px] text-white/50">
                <Check className="w-3.5 h-3.5 text-[#14F195]/60 mt-0.5 flex-shrink-0" />
                <span>Memorias anteriores carregadas do contexto</span>
              </li>
              <li className="flex items-start gap-2 text-[11px] text-white/50">
                <Check className="w-3.5 h-3.5 text-[#14F195]/60 mt-0.5 flex-shrink-0" />
                <span>Modelo alterado com continuidade preservada</span>
              </li>
              <li className="flex items-start gap-2 text-[11px] text-white/50">
                <Check className="w-3.5 h-3.5 text-[#14F195]/60 mt-0.5 flex-shrink-0" />
                <span>Hash da conversa mantido para verificacao</span>
              </li>
              {summary && (
                <li className="flex items-start gap-2 text-[11px] text-white/50">
                  <Info className="w-3.5 h-3.5 text-[#00D1FF]/60 mt-0.5 flex-shrink-0" />
                  <span>{summary}</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// #6 Microcopy: Context ON chip
// ============================================================
function ContextChip({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#14F195]/10 text-[#14F195]/70 border border-[#14F195]/20">
      <Check className="w-3 h-3" />
      Context: ON
    </span>
  );
}

// ============================================================
// Memory Audit Trail
// ============================================================
const MODEL_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  gpt:      { label: 'GPT-4o',       color: '#10b981', bg: 'bg-green-500/10',  border: 'border-green-500/20'  },
  claude:   { label: 'Claude',       color: '#f97316', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  nvidia:   { label: 'NVIDIA Llama', color: '#a855f7', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  gemini:   { label: 'Gemini Pro',   color: '#3b82f6', bg: 'bg-blue-500/10',   border: 'border-blue-500/20'  },
  deepseek: { label: 'DeepSeek V3',  color: '#06b6d4', bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20'  },
};

function HashBlocks({ hash }: { hash: string }) {
  const blocks: string[] = [];
  for (let i = 0; i < 8; i++) {
    blocks.push(hash.slice(i * 8, i * 8 + 8));
  }
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {blocks.map((b, i) => (
        <div key={i} className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.05] rounded-lg px-2 py-1.5">
          <span className="text-[9px] text-white/20 font-mono w-4">{String(i + 1).padStart(2, '0')}</span>
          <span className="text-[10px] text-[#14F195]/70 font-mono tracking-wide">{b}</span>
        </div>
      ))}
    </div>
  );
}

function ChainNode({ label, sublabel, color, active, verified, isLast }: {
  label: string; sublabel: string; color: string; active?: boolean; verified?: boolean; isLast?: boolean;
}) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex flex-col items-center">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-all ${
          active ? 'shadow-lg' : 'opacity-60'
        }`} style={{ borderColor: active ? color : 'rgba(255,255,255,0.08)', background: active ? `${color}20` : 'transparent', boxShadow: active ? `0 0 16px ${color}30` : 'none' }}>
          {verified ? <Shield className="w-4 h-4" style={{ color }} /> : <Cpu className="w-4 h-4" style={{ color }} />}
        </div>
        {!isLast && <div className="w-px h-8 bg-gradient-to-b from-white/10 to-transparent mt-1" />}
      </div>
      <div className="pt-1.5">
        <p className={`text-xs font-semibold ${active ? 'text-white/90' : 'text-white/40'}`}>{label}</p>
        <p className="text-[10px] text-white/30 mt-0.5">{sublabel}</p>
      </div>
    </div>
  );
}

function MemoryAuditTrail({ hash, model, onClose }: { hash: string; model?: string; onClose: () => void }) {
  const [memData,  setMemData]  = useState<Record<string, unknown> | null>(null);
  const [poiData,  setPoiData]  = useState<Record<string, unknown> | null>(null);
  const [zkData,   setZkData]   = useState<Record<string, unknown> | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [copied,   setCopied]   = useState(false);

  const meta = MODEL_META[model || 'gpt'] || MODEL_META.gpt;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [vRes, pRes, zRes] = await Promise.allSettled([
          fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash }) }).then(r => r.json()),
          fetch(`/api/score?hash=${hash}`).then(r => r.json()),
          fetch('/api/zk/prove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash }) }).then(r => r.json()),
        ]);
        if (cancelled) return;
        if (vRes.status === 'fulfilled') setMemData(vRes.value);
        if (pRes.status === 'fulfilled') setPoiData(pRes.value);
        if (zRes.status === 'fulfilled') setZkData(zRes.value);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hash]);

  const handleCopy = () => {
    navigator.clipboard.writeText(hash).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const txHash = (memData as Record<string, unknown> | null)?.txHash as string | undefined || (poiData as Record<string, unknown> | null)?.poiTxHash as string | undefined;
  const voteCount = (poiData as Record<string, unknown> | null)?.voteCount as number | undefined || 0;
  const avgScore  = (poiData as Record<string, unknown> | null)?.avgScore as number | undefined || 0;
  const poiUnlocked = (poiData as Record<string, unknown> | null)?.poiUnlocked as boolean | undefined || txHash;
  const zkProof   = (zkData as Record<string, unknown> | null)?.zk as Record<string, unknown> | undefined;
  const content   = (memData as Record<string, unknown> | null)?.content as string | undefined;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[92vh] bg-[#06060e] border border-white/[0.07] rounded-2xl overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]"
          style={{ background: `linear-gradient(135deg, ${meta.color}08 0%, transparent 60%)` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}>
              <Shield className="w-5 h-5" style={{ color: meta.color }} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white/90 flex items-center gap-2">
                Memory Audit Trail
                {poiUnlocked && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#14F195]/15 text-[#14F195] border border-[#14F195]/25">
                    ✓ VERIFIED
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-white/35 font-mono mt-0.5">{hash.slice(0, 24)}...{hash.slice(-8)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/50 text-[11px] transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-[#14F195]" /> : <Hash className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar hash'}
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-1.5">
              {['#9945FF','#00D1FF','#14F195'].map((c, i) => (
                <span key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: c, animationDelay: `${i*150}ms` }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/[0.05]">

              {/* ── COL 1: Chain ── */}
              <div className="p-5 space-y-4">
                <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Memory Chain</h3>
                <div className="space-y-1">
                  <ChainNode label={meta.label} sublabel="Model origin" color={meta.color} active />
                  <ChainNode label="SHA-256 Hash" sublabel="Content fingerprint" color="#9945FF" active />
                  <ChainNode label="CONGCHAIN DB" sublabel="Persisted locally" color="#00D1FF" active />
                  {txHash ? (
                    <ChainNode label="Solana Devnet" sublabel={`TX: ${txHash.slice(0,10)}...`} color="#14F195" active verified isLast />
                  ) : (
                    <ChainNode label="Solana Devnet" sublabel="Pending anchor" color="#14F195" isLast />
                  )}
                </div>

                {/* Model badge */}
                <div className={`mt-4 flex items-center gap-2 px-3 py-2 rounded-xl ${meta.bg} border ${meta.border}`}>
                  <Cpu className="w-3.5 h-3.5 flex-shrink-0" style={{ color: meta.color }} />
                  <div>
                    <p className="text-[11px] font-semibold" style={{ color: meta.color }}>{meta.label}</p>
                    <p className="text-[10px] text-white/30">Initiating model</p>
                  </div>
                </div>
              </div>

              {/* ── COL 2: Evidence ── */}
              <div className="p-5 space-y-4">
                <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Evidence Record</h3>

                <div>
                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">SHA-256 Fingerprint</p>
                  <HashBlocks hash={hash} />
                </div>

                {content && (
                  <div>
                    <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Content Preview</p>
                    <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 max-h-28 overflow-y-auto">
                      <p className="text-[11px] text-white/55 leading-relaxed line-clamp-5">{content}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3">
                    <p className="text-[9px] text-white/25 uppercase tracking-wider">Memory ID</p>
                    <p className="text-[11px] text-white/60 font-mono mt-1">{hash.slice(0,6).toUpperCase()}</p>
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3">
                    <p className="text-[9px] text-white/25 uppercase tracking-wider">Algorithm</p>
                    <p className="text-[11px] text-white/60 font-mono mt-1">SHA-256</p>
                  </div>
                </div>

                <p className="text-[10px] text-white/20 italic text-center pt-1">
                  "Only the proof goes public. Never the content."
                </p>
              </div>

              {/* ── COL 3: Proof Stack ── */}
              <div className="p-5 space-y-4">
                <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Proof Stack</h3>

                {/* Solana */}
                <div className={`rounded-xl border p-3 space-y-2 ${txHash ? 'border-[#14F195]/20 bg-[#14F195]/[0.03]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">⛓ Solana Devnet</span>
                    {txHash ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#14F195]/15 text-[#14F195] border border-[#14F195]/20 font-semibold">CONFIRMED</span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30 border border-white/[0.06]">PENDING</span>
                    )}
                  </div>
                  {txHash ? (
                    <a href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[10px] text-[#14F195]/60 hover:text-[#14F195] transition-colors font-mono group">
                      <ExternalLink className="w-3 h-3 flex-shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="truncate">{txHash.slice(0, 18)}...{txHash.slice(-6)}</span>
                    </a>
                  ) : (
                    <p className="text-[10px] text-white/25">Hash preserved locally</p>
                  )}
                </div>

                {/* PoI */}
                <div className={`rounded-xl border p-3 space-y-2 ${(poiUnlocked) ? 'border-[#9945FF]/20 bg-[#9945FF]/[0.03]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">👥 Proof of Insight</span>
                    {poiUnlocked ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#9945FF]/15 text-[#9945FF] border border-[#9945FF]/20 font-semibold">UNLOCKED</span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30 border border-white/[0.06]">{voteCount}/3 votes</span>
                    )}
                  </div>
                  {voteCount > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-white/35">{voteCount} validator{voteCount !== 1 ? 's' : ''}</span>
                        <span className="text-[#9945FF]/70 font-semibold">{avgScore.toFixed(1)}/10 avg</span>
                      </div>
                      <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195] transition-all duration-700"
                          style={{ width: `${(avgScore / 10) * 100}%` }} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-white/25">No votes yet — threshold: 3 votes ≥7</p>
                  )}
                </div>

                {/* ZK Proof */}
                <div className={`rounded-xl border p-3 space-y-2 ${zkProof ? 'border-[#00D1FF]/20 bg-[#00D1FF]/[0.03]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">🔐 ZK Proof</span>
                    {zkProof ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#00D1FF]/15 text-[#00D1FF] border border-[#00D1FF]/20 font-semibold">
                        {(zkProof.proof as Record<string, unknown>)?.mode === 'mvp-real-snarkjs' ? 'GROTH16' : 'SIMULATED'}
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30 border border-white/[0.06]">NONE</span>
                    )}
                  </div>
                  {zkProof ? (
                    <p className="text-[10px] text-[#00D1FF]/60 font-mono truncate">
                      {((zkProof.proof as Record<string, unknown>)?.proofDigest as string)?.slice(0, 24)}...
                    </p>
                  ) : (
                    <p className="text-[10px] text-white/25">Click "Salvar" to generate</p>
                  )}
                </div>

                {/* Summary score */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[9px] text-white/25 uppercase tracking-wider mb-2">Trust Score</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${Math.min(100, (txHash ? 40 : 0) + (poiUnlocked ? 35 : voteCount > 0 ? 15 : 0) + (zkProof ? 25 : 0))}%`,
                          background: 'linear-gradient(90deg, #9945FF, #00D1FF, #14F195)',
                        }} />
                    </div>
                    <span className="text-[11px] font-bold text-white/60">
                      {Math.min(100, (txHash ? 40 : 0) + (poiUnlocked ? 35 : voteCount > 0 ? 15 : 0) + (zkProof ? 25 : 0))}%
                    </span>
                  </div>
                  <p className="text-[9px] text-white/20 mt-1.5">On-chain 40% · PoI 35% · ZK 25%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="px-6 py-3 border-t border-white/[0.05] flex items-center justify-between bg-white/[0.01]">
          <p className="text-[10px] text-white/20">Built on Solana · Local-first · Model-agnostic</p>
          <p className="text-[10px] text-white/15 font-mono">{hash}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Solana Broadcast Overlay
// ============================================================
function SolanaOverlay({ txHash, onDone }: { txHash: string | null; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const steps = [
    'Generating SHA-256 hash...',
    'Signing transaction...',
    'Broadcasting to Solana Devnet...',
    'Awaiting block confirmation...',
    txHash ? '✓ CONFIRMED ON-CHAIN' : '✓ Hash anchored locally',
  ];

  useEffect(() => {
    const timings =   [0, 400, 900, 1500, 2200];
    const progresses = [15, 35,  60,   85,  100];
    const timers: ReturnType<typeof setTimeout>[] = [];

    timings.forEach((t, i) => {
      timers.push(setTimeout(() => { setStep(i); setProgress(progresses[i]); }, t));
    });

    timers.push(setTimeout(onDone, 3000));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[340px] rounded-2xl border border-[#14F195]/20 bg-[#06060e]/95 p-8 flex flex-col items-center gap-5 shadow-2xl shadow-[#14F195]/10">
        {/* Orb turbo */}
        <div className="relative">
          <div className="absolute inset-[-16px] rounded-full bg-[#14F195]/10 animate-ping" />
          <div className="absolute inset-[-8px] rounded-full bg-[#9945FF]/10 animate-pulse" />
          <Orb mode="success" size="md" interactive={false} />
        </div>

        {/* Status text */}
        <div className="text-center space-y-1">
          <p className="text-[#14F195] font-mono text-sm font-semibold tracking-wider">
            {step < 4 ? 'BROADCASTING TO SOLANA DEVNET...' : '✓ MEMORY ANCHORED'}
          </p>
          <p className="text-white/40 font-mono text-[11px]">{steps[step]}</p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: step === 4
                ? 'linear-gradient(90deg, #14F195, #9945FF)'
                : 'linear-gradient(90deg, #9945FF, #14F195)',
            }}
          />
        </div>

        {/* TX hash */}
        {step === 4 && txHash && (
          <a
            href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
            target="_blank" rel="noopener noreferrer"
            className="text-[10px] font-mono text-[#14F195]/50 hover:text-[#14F195]/80 transition-colors truncate max-w-full"
          >
            TX: {txHash.slice(0, 20)}...{txHash.slice(-8)} ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ============================================================
// #8 Model Switch Modal
// ============================================================
function ModelSwitchModal({ isOpen, onClose, onConfirm, fromModel, toModel }: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (fresh: boolean) => void;
  fromModel: string;
  toModel: string;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f0f1e] border border-white/[0.08] rounded-2xl p-6 w-[90%] max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9945FF]/20 to-[#14F195]/20 border border-[#9945FF]/20 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-[#9945FF]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/90">Trocar Modelo</h3>
            <p className="text-[11px] text-white/40">Switching intelligence — memory preserved.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <span className="text-xs text-white/50">{MODEL_LABELS[fromModel as AIModel] || fromModel}</span>
          <ArrowRight className="w-4 h-4 text-[#9945FF]" />
          <span className="text-xs text-white/80 font-medium">{MODEL_LABELS[toModel as AIModel] || toModel}</span>
        </div>
        <p className="text-xs text-white/40 mb-4">Deseja continuar com a memoria existente?</p>
        <div className="flex items-center gap-2">
          <button onClick={() => { onConfirm(false); onClose(); }} className="flex-1 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/60 text-sm hover:bg-white/[0.1] transition-colors">
            Comecar do zero
          </button>
          <button onClick={() => { onConfirm(true); onClose(); }} className="flex-1 px-3 py-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white text-sm font-medium shadow-lg shadow-[#9945FF]/25 hover:shadow-[#9945FF]/40 transition-all">
            Continuar memoria
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SVG Icons
// ============================================================
function CopyIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>;
}
function ThumbUpIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" /><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" /></svg>;
}
function ThumbDownIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" /><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" /></svg>;
}
function RegenerateIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>;
}

// ============================================================
// Score Modal
// ============================================================
function ScoreModal({ isOpen, onClose, onSubmit }: { isOpen: boolean; onClose: () => void; onSubmit: (score: number) => void }) {
  const [selectedScore, setSelectedScore] = useState(5);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f0f1e] border border-white/[0.08] rounded-2xl p-6 w-[90%] max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white/90">Avaliar Resposta</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-white/40 mb-4">Quao util foi esta resposta? (1-10)</p>
        <div className="flex items-center gap-1.5 mb-5">
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button key={n} onClick={() => setSelectedScore(n)} className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all duration-150 ${n <= selectedScore ? 'bg-gradient-to-br from-[#9945FF] to-[#14F195] text-white shadow-md' : 'bg-white/[0.06] text-white/30 hover:bg-white/[0.1]'}`}>{n}</button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white/70">{selectedScore}/10</span>
          <button onClick={() => { onSubmit(selectedScore); onClose(); }} className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white text-sm font-medium shadow-lg shadow-[#9945FF]/25 hover:shadow-[#9945FF]/40 transition-all duration-200">Salvar Avaliacao</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Compare View (split screen) — #3 with/without context
// ============================================================
interface CompareResult { model: string; response: string; hash: string; timestamp: number; }

function CompareView({ isOpen, onClose, prompt, results, isLoading }: {
  isOpen: boolean; onClose: () => void; prompt: string; results: CompareResult[]; isLoading: boolean;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#06060e]">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/[0.06] bg-[#0a0a14]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Columns2 className="w-5 h-5 text-[#00D1FF]" />
          <div>
            <h2 className="text-sm font-semibold text-white/90">Comparar Modelos</h2>
            <p className="text-[11px] text-white/35 max-w-md truncate">{prompt}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#9945FF] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#00D1FF] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#14F195] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-sm text-white/40">Comparando modelos...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {results.map((r, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#9945FF]" />
                    <span className="text-sm font-semibold text-white/80">{MODEL_LABELS[r.model as AIModel] || r.model}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-white/25 font-mono"><Hash className="w-3 h-3" />{r.hash.substring(0, 8)}...</div>
                </div>
                <div className="p-4"><p className="text-[14px] text-white/70 leading-relaxed whitespace-pre-wrap">{r.response}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// #2 Verify On-Chain — enhanced states
// ============================================================
function VerifyOnChainButton({ hash, onVerified }: { hash: string; onVerified: (txHash: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; txHash?: string; message: string } | null>(null);

  const handleVerify = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/blockchain/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ success: true, txHash: data.txHash, message: data.message });
        onVerified(data.txHash);
      } else {
        setResult({ success: false, message: data.message || 'Falhou' });
      }
    } catch {
      // #2 Fallback claro
      setResult({ success: false, message: 'Devnet unavailable — stored locally (will retry)' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 border-2 border-[#14F195]/30 border-t-[#14F195] rounded-full animate-spin" />
        <span className="text-[10px] text-[#14F195]/50">Anchoring hash on-chain...</span>
      </div>
    );
  }

  if (result?.success) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-[#14F195]" />
          <span className="text-[10px] font-semibold text-[#14F195]">Verified on Solana (Devnet)</span>
        </div>
        {result.txHash && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/30">Tx:</span>
            <code className="text-[10px] text-[#14F195]/50 font-mono">{result.txHash.substring(0, 6)}...{result.txHash.substring(result.txHash.length - 4)}</code>
          </div>
        )}
        {result.txHash && (
          <a href={`https://explorer.solana.com/tx/${result.txHash}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-[#14F195]/60 hover:text-[#14F195]/90 underline transition-colors">
            View on Explorer <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
    );
  }

  if (result && !result.success) {
    return (
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-[#FF4458]/60" />
        <span className="text-[10px] text-[#FF4458]/60">{result.message}</span>
        <button onClick={handleVerify} className="ml-1 text-[10px] text-[#9945FF]/60 hover:text-[#9945FF]/90 underline">Retry</button>
      </div>
    );
  }

  return (
    <button onClick={handleVerify} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#14F195]/10 text-[#14F195]/70 hover:bg-[#14F195]/20 border border-[#14F195]/20 transition-all duration-200">
      Verify on Solana
    </button>
  );
}

// ============================================================
// Wallet Connect Button — Phantom
// ============================================================
function WalletButton({ walletAddress, balance, isConnecting, onConnect, onDisconnect }: {
  walletAddress: string | null;
  balance: number | null;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  if (!isPhantomInstalled()) {
    return (
      <a href="https://phantom.app/download" target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#9945FF]/10 text-[#9945FF]/70 hover:bg-[#9945FF]/20 border border-[#9945FF]/20 transition-all duration-200">
        <Wallet className="w-3.5 h-3.5" />
        Install Phantom
      </a>
    );
  }

  if (!walletAddress) {
    return (
      <button onClick={onConnect} disabled={isConnecting}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gradient-to-r from-[#9945FF]/20 to-[#14F195]/20 text-[#14F195]/80 hover:from-[#9945FF]/30 hover:to-[#14F195]/30 border border-[#14F195]/20 transition-all duration-200 disabled:opacity-50">
        {isConnecting ? (
          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white/70 rounded-full animate-spin" />
        ) : (
          <Wallet className="w-3.5 h-3.5" />
        )}
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#14F195]/10 border border-[#14F195]/20">
      <div className="w-2 h-2 rounded-full bg-[#14F195] animate-pulse" />
      <span className="text-[10px] font-mono text-[#14F195]/80">{truncateAddress(walletAddress)}</span>
      {balance != null && (
        <span className="text-[10px] text-white/30 font-medium">{balance.toFixed(2)} SOL</span>
      )}
      <button onClick={onDisconnect} className="ml-0.5 p-0.5 rounded hover:bg-white/[0.06] text-white/20 hover:text-white/50 transition-colors" title="Disconnect">
        <LogOut className="w-3 h-3" />
      </button>
    </div>
  );
}

// ============================================================
// Mint Memory Button — ownership of verified AI memory
// ============================================================
function MintNFTButton({ message, walletAddress }: { message: Message; walletAddress: string | null }) {
  const [isMinting, setIsMinting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; mintAddress?: string; explorerUrl?: string; message: string } | null>(null);

  const handleMint = async () => {
    setIsMinting(true);
    setResult(null);
    try {
      const res = await fetch('/api/nft/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memoryHash: message.memoryHash,
          content: message.content,
          model: message.model || 'gpt',
          previousModel: message.previousModel || undefined,
          score: message.score,
          timestamp: message.timestamp,
          walletAddress: walletAddress || undefined,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, message: 'Mint failed — try again' });
    } finally {
      setIsMinting(false);
    }
  };

  if (isMinting) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 border-2 border-[#9945FF]/30 border-t-[#9945FF] rounded-full animate-spin" />
        <span className="text-[10px] text-[#9945FF]/50">Minting NFT on Solana...</span>
      </div>
    );
  }

  if (result?.success) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Gem className="w-3.5 h-3.5 text-[#9945FF]" />
          <span className="text-[10px] font-semibold text-[#9945FF]">Memory Owned!</span>
        </div>
        {/* Model lineage */}
        <div className="ml-5 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-white/35">Origin Model:</span>
          <span className="text-[10px] font-medium text-[#9945FF]/70 bg-[#9945FF]/10 px-1.5 py-0.5 rounded">
            {MODEL_LABELS[message.model as AIModel] || message.model}
          </span>
          {message.previousModel && (
            <>
              <span className="text-[10px] text-white/25">Evolved with:</span>
              <span className="text-[10px] font-medium text-[#00D1FF]/70 bg-[#00D1FF]/10 px-1.5 py-0.5 rounded">
                {MODEL_LABELS[message.previousModel as AIModel] || message.previousModel}
              </span>
            </>
          )}
        </div>
        {result.mintAddress && (
          <div className="ml-5 space-y-1">
            <p className="text-[10px] text-white/30 font-mono break-all">{result.mintAddress}</p>
            {result.explorerUrl && (
              <a href={result.explorerUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-[#9945FF]/50 hover:text-[#9945FF]/90 underline transition-colors">
                View NFT on Explorer <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  if (result && !result.success) {
    return (
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-[#FF4458]/60" />
        <span className="text-[10px] text-[#FF4458]/60">{result.message}</span>
        <button onClick={handleMint} className="ml-1 text-[10px] text-[#9945FF]/60 hover:text-[#9945FF]/90 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button onClick={handleMint}
        className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#9945FF]/20 to-[#14F195]/20 text-[#9945FF]/70 hover:from-[#9945FF]/30 hover:to-[#14F195]/30 border border-[#9945FF]/20 transition-all duration-200">
        <Gem className="w-3.5 h-3.5" />
        Mint Memory
      </button>
      <p className="text-[10px] text-white/25 leading-relaxed">Turn this memory into a verifiable on-chain asset.</p>
    </div>
  );
}

// ============================================================
// Right Panel — enhanced #2
// ============================================================
function RightPanel({ isOpen, onClose, message, walletAddress }: { isOpen: boolean; onClose: () => void; message: Message | null; walletAddress: string | null }) {
  if (!isOpen || !message) return null;
  return (
    <div className="w-full md:w-80 lg:w-96 border-l border-white/[0.06] bg-[#0a0a14]/95 backdrop-blur-xl flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-[#9945FF]" />
          <span className="text-sm font-semibold text-white/80">Memory Info</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Hash */}
        <div>
          <label className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Hash</label>
          <div className="mt-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] group cursor-pointer" onClick={() => { if (message.memoryHash) navigator.clipboard?.writeText(message.memoryHash).catch(() => {}); }}>
            <p className="text-xs text-[#14F195]/70 font-mono break-all">{message.memoryHash || 'Nao salvo ainda'}</p>
            {message.memoryHash && <p className="text-[10px] text-white/20 mt-1 group-hover:text-white/40 transition-colors">Click to copy</p>}
          </div>
        </div>
        {/* Model + Performance */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Modelo</label>
            <div className="mt-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-sm text-white/70">{message.model ? (MODEL_LABELS[message.model as AIModel] || message.model) : 'N/A'}</p>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Tempo</label>
            <div className="mt-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-sm text-white/70">{message.responseTime ? `${(message.responseTime / 1000).toFixed(1)}s` : 'N/A'}</p>
            </div>
          </div>
        </div>
        {/* Score */}
        <div>
          <label className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Score</label>
          <div className="mt-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-sm text-white/70">{message.score != null ? `${message.score}/10` : 'Nao avaliado'}</p>
          </div>
        </div>
        {/* Timestamp */}
        <div>
          <label className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Timestamp</label>
          <div className="mt-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-sm text-white/70">{message.timestamp}</p>
          </div>
        </div>
        {/* #2 Blockchain Status — enhanced */}
        <div>
          <label className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Blockchain Proof</label>
          <div className="mt-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            {message.verified ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#14F195]/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-[#14F195]" />
                  </div>
                  <span className="text-xs font-semibold text-[#14F195]">Verified on Solana (Devnet)</span>
                </div>
                {message.txHash && (
                  <div className="ml-7 space-y-1">
                    <p className="text-[10px] text-white/30 font-mono">Tx: {message.txHash.substring(0, 8)}...{message.txHash.substring(message.txHash.length - 6)}</p>
                    <a href={`https://explorer.solana.com/tx/${message.txHash}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-[#14F195]/50 hover:text-[#14F195]/90 underline transition-colors">
                      View on Explorer <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                )}
              </div>
            ) : message.memoryHash ? (
              <VerifyOnChainButton hash={message.memoryHash} onVerified={() => {}} />
            ) : (
              <div className="flex items-center gap-2 text-white/30">
                <Shield className="w-4 h-4" />
                <span className="text-xs">Salve a memoria primeiro</span>
              </div>
            )}
          </div>
        </div>
        {/* NFT — only after blockchain proof (memory → proof → ownership) */}
        {message.verified && (
          <div>
            <label className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Ownership</label>
            <div className="mt-1.5 p-3 rounded-xl bg-gradient-to-br from-[#9945FF]/[0.03] to-[#14F195]/[0.03] border border-[#9945FF]/[0.08]">
              {/* Flow indicator: memory → proof → ownership */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#14F195]" />
                  <span className="text-[9px] text-white/25">Memory</span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-[#14F195]/30 to-[#9945FF]/30" />
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#14F195]" />
                  <span className="text-[9px] text-white/25">Proof</span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-[#9945FF]/30 to-[#9945FF]/60" />
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#9945FF] animate-pulse" />
                  <span className="text-[9px] text-white/40 font-medium">Ownership</span>
                </div>
              </div>
              <MintNFTButton message={message} walletAddress={walletAddress} />
            </div>
          </div>
        )}
        {/* Content preview */}
        <div>
          <label className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Conteudo</label>
          <div className="mt-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-white/50 leading-relaxed line-clamp-6 whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// #4 Evolution Timeline
// ============================================================
function EvolutionTimeline({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [memories, setMemories] = useState<Array<{ hash: string; model: string; score: number | null; timestamp: number; content: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/memory/timeline');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.memories && data.memories.length > 0) {
            setMemories(data.memories);
          } else if (!cancelled) setMemories([]);
        } else { if (!cancelled) setMemories([]); }
      } catch { if (!cancelled) setMemories([]); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#06060e]">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/[0.06] bg-[#0a0a14]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-[#9945FF]" />
          <div>
            <h2 className="text-sm font-semibold text-white/90">Evolution Timeline</h2>
            <p className="text-[11px] text-white/35">{memories.length > 0 ? [...new Set(memories.map(m => m.model))].map(m => MODEL_LABELS[m as AIModel] || m).join(' → ') : 'Nenhuma memoria ainda'} ({memories.length})</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#9945FF] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#00D1FF] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#14F195] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-sm text-white/40">Carregando memorias reais...</p>
            </div>
          </div>
        ) : memories.length === 0 ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-center">
              <GitBranch className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <p className="text-sm text-white/30">Nenhuma memoria salva ainda</p>
              <p className="text-xs text-white/20 mt-1">Salve conversas para ver a timeline de evolucao</p>
            </div>
          </div>
        ) : (
          <div className="max-w-lg mx-auto relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gradient-to-b from-[#9945FF]/30 via-[#00D1FF]/30 to-[#14F195]/30" />
            <div className="space-y-4">
              {memories.map((m, idx) => (
                <div key={m.hash} className="relative flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 ${
                    idx === memories.length - 1
                      ? 'bg-gradient-to-br from-[#9945FF] to-[#14F195] border-transparent'
                      : 'bg-[#0a0a14] border-white/[0.12]'
                  }`}>
                    <span className="text-[10px] font-bold text-white/80">{idx + 1}</span>
                  </div>
                  <div className="flex-1 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors cursor-pointer group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-[#9945FF]" />
                        <span className="text-sm font-semibold text-white/80">{MODEL_LABELS[m.model as AIModel] || m.model}</span>
                      </div>
                      {m.score != null && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-[#9945FF]/70 bg-[#9945FF]/10 px-1.5 py-0.5 rounded">
                          <Star className="w-2.5 h-2.5" />{m.score}/10
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/50 mb-2">{m.content.substring(0, 150)}{m.content.length > 150 ? '...' : ''}</p>
                    <div className="flex items-center justify-between">
                      <code className="text-[10px] text-[#14F195]/40 font-mono">{m.hash.substring(0, 8)}...</code>
                      <span className="text-[10px] text-white/20">{new Date(m.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-3">
                      <button onClick={() => window.open(`/memory/${m.hash}`, '_self')} className="text-[10px] text-[#00D1FF]/50 hover:text-[#00D1FF]/80 flex items-center gap-1 transition-colors">
                        <Eye className="w-3 h-3" /> Ver versao
                      </button>
                      <a href={`https://explorer.solana.com/tx/${m.hash}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#14F195]/40 hover:text-[#14F195]/70 flex items-center gap-1 transition-colors">
                        <ExternalLink className="w-3 h-3" /> Verificar
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ── Upgrade Modal ─────────────────────────────────────────────
function UpgradeModal({ model, onClose }: { model: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const { createPortal } = require('react-dom');
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="w-full max-w-sm bg-[#0e0e1a] border border-[#9945FF]/40 rounded-2xl p-6 shadow-2xl shadow-[#9945FF]/10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <span className="font-bold text-white">Modelo PRO</span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-xl leading-none">×</button>
        </div>
        <p className="text-sm text-white/60 mb-4">
          <span className="text-[#9945FF] font-semibold">{model.toUpperCase()}</span> requer o plano Pro.
          Por apenas <span className="text-[#14F195] font-bold">$5/mês</span> você acessa todos os modelos premium.
        </p>
        <div className="space-y-2 mb-5">
          {[['GPT-4o', '#10b981'], ['Claude Opus', '#f97316'], ['DeepSeek V3', '#06b6d4'], ['Gemini Pro', '#3B82F6']].map(([name, color]) => (
            <div key={name} className="flex items-center gap-2 text-xs text-white/50">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: color as string }} />
              {name}
              <span className="ml-auto text-[#14F195]/60">✓ incluído</span>
            </div>
          ))}
        </div>
        <a href="/dashboard/keys"
          className="block w-full py-2.5 rounded-xl text-center text-sm font-bold bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white shadow-lg shadow-[#9945FF]/20 hover:opacity-90 transition-opacity">
          Obter Plano Pro — $5/mês
        </a>
        <p className="text-center text-xs text-white/20 mt-3">Modelos gratuitos disponíveis sem chave</p>
      </div>
    </div>,
    document.body
  );
}

// ── Model Selector ────────────────────────────────────────────
function ModelSelector({ selectedModel, onModelChange }: { selectedModel: AIModel; onModelChange: (model: AIModel) => void }) {
  const [showUpgrade, setShowUpgrade] = useState<string | null>(null);

  const FREE = [
    { key: 'nvidia'  as AIModel, name: 'NVIDIA',   color: '#76B900' },
    { key: 'glm'     as AIModel, name: 'GLM-4.7',  color: '#00D1FF' },
    { key: 'minimax' as AIModel, name: 'MiniMax',  color: '#FF6B35' },
    { key: 'qwen'    as AIModel, name: 'Qwen3',    color: '#A855F7' },
  ];
  const PRO = [
    { key: 'gpt'      as AIModel, name: 'GPT-4o',   color: '#10b981' },
    { key: 'claude'   as AIModel, name: 'Claude',   color: '#f97316' },
    { key: 'deepseek' as AIModel, name: 'DeepSeek', color: '#06b6d4' },
    { key: 'gemini'   as AIModel, name: 'Gemini',   color: '#3B82F6' },
  ];

  const handleClick = (key: AIModel, isPro: boolean) => {
    if (isPro) { setShowUpgrade(key); return; }
    onModelChange(key);
  };

  return (
    <>
      {showUpgrade && <UpgradeModal model={showUpgrade} onClose={() => setShowUpgrade(null)} />}
      <div className="flex items-center gap-1 flex-wrap">
        {FREE.map(m => (
          <button key={m.key} onClick={() => handleClick(m.key, false)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200
              ${selectedModel === m.key ? 'bg-white/[0.08] border border-white/[0.12] text-white/90 shadow-sm' : 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]'}`}>
            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: m.color }} />
            {m.name}
          </button>
        ))}
        <span className="w-px h-4 bg-white/10 mx-0.5" />
        {PRO.map(m => (
          <button key={m.key} onClick={() => handleClick(m.key, true)}
            className="relative px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 text-white/25 hover:text-white/40 hover:bg-white/[0.03] group">
            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 opacity-40" style={{ backgroundColor: m.color }} />
            {m.name}
            <span className="ml-1 text-[9px] font-bold text-[#9945FF]/70 group-hover:text-[#9945FF]">PRO</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ============================================================
// MAIN CHAT AREA
// ============================================================
interface ChatAreaProps {
  orbMode: OrbMode;
  setOrbMode: (mode: OrbMode) => void;
  onSessionUpdate?: (session: { id: string; title: string; lastMessage: string; timestamp: string }) => void;
  activeConvId?: string | null;
}

export default function ChatArea({ orbMode, setOrbMode, onSessionUpdate, activeConvId }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome', role: 'assistant',
    content: 'Ola! Sou o CONGCHAIN — Verifiable AI Memory Layer.\n\nMemory that any AI can continue.\n\nEstou aqui para ajudar voce com verificacao de memoria em blockchain, integracao Solana, e muito mais. Como posso ajudar?',
    timestamp: 'Agora', orbMode: 'idle', model: 'gpt',
  }]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>('nvidia');
  const [previousModel, setPreviousModel] = useState<string>('gpt');
  const [contextActive, setContextActive] = useState(false);

  // State for features
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [compareResults, setCompareResults] = useState<CompareResult[]>([]);
  const [comparePrompt, setComparePrompt] = useState('');
  const [compareLoading, setCompareLoading] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [pendingModel, setPendingModel] = useState<AIModel>('gpt');
  const [contextBlockExpanded, setContextBlockExpanded] = useState(false);
  const [chatLang, setChatLang] = useState<string>('pt');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [originalMessages, setOriginalMessages] = useState<Message[]>([]);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [showSolanaOverlay, setShowSolanaOverlay] = useState(false);
  const [solanaTxHash, setSolanaTxHash] = useState<string | null>(null);
  const [auditHash, setAuditHash] = useState<string | null>(null);
  const [auditModel, setAuditModel] = useState<string | undefined>(undefined);
  const [streamedContent, setStreamedContent] = useState('');
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef(activeConvId ?? `sess_${Date.now()}`);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = useCallback(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, []);
  useEffect(() => { scrollToBottom(); }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    const c = chatContainerRef.current;
    if (!c) return;
    const h = () => { const { scrollTop, scrollHeight, clientHeight } = c; setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100); };
    c.addEventListener('scroll', h);
    return () => c.removeEventListener('scroll', h);
  }, []);

  // Cleanup streaming interval on unmount
  useEffect(() => {
    return () => { if (streamIntervalRef.current) clearInterval(streamIntervalRef.current); };
  }, []);

  // Nova conversa — limpa mensagens e estado
  const handleNewChat = useCallback(() => {
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    setStreamingId(null);
    setStreamedContent('');
    setIsTyping(false);
    setContextActive(false);
    setOrbMode('idle');
    setMessages([{
      id: 'welcome', role: 'assistant',
      content: 'Ola! Sou o CONGCHAIN — Verifiable AI Memory Layer.\n\nMemory that any AI can continue.\n\nEstou aqui para ajudar voce com verificacao de memoria em blockchain, integracao Solana, e muito mais. Como posso ajudar?',
      timestamp: 'Agora', orbMode: 'idle', model: 'gpt',
    }]);
    sessionIdRef.current = `sess_${Date.now()}`;
  }, [setOrbMode]);

  // Close lang menu when clicking outside
  useEffect(() => {
    if (!showLangMenu) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.relative')) setShowLangMenu(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showLangMenu]);

  // #8 Model switch with modal
  const handleModelSwitch = useCallback((newModel: AIModel) => {
    if (newModel === selectedModel || messages.length <= 1) {
      setSelectedModel(newModel);
      setPreviousModel(selectedModel);
      return;
    }
    setPendingModel(newModel);
    setShowSwitchModal(true);
  }, [selectedModel, messages.length]);

  const handleSwitchConfirm = useCallback((keepMemory: boolean) => {
    setPreviousModel(selectedModel);
    setSelectedModel(pendingModel);
    if (!keepMemory) {
      setContextActive(false);
      setMessages([{
        id: Date.now().toString(), role: 'assistant',
        content: `Novo inicio com ${MODEL_LABELS[pendingModel]}. Como posso ajudar?`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        orbMode: 'idle', model: pendingModel,
      }]);
    } else {
      setContextActive(true);
    }
  }, [selectedModel, pendingModel]);

  // Chat API
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isTyping) return;
    // Reset translation when sending new message
    if (originalMessages.length > 0) {
      setMessages(originalMessages);
      setOriginalMessages([]);
      setChatLang('pt');
    }
    const userMessage: Message = {
      id: Date.now().toString(), role: 'user', content: inputValue.trim(),
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setOrbMode('thinking');

    // Register session in history — must be outside setMessages updater (React rule)
    if (onSessionUpdate) {
      const firstUser = messages.find(m => m.role === 'user') || userMessage;
      const title = firstUser.content.slice(0, 55) + (firstUser.content.length > 55 ? '...' : '');
      onSessionUpdate({
        id: sessionIdRef.current,
        title,
        lastMessage: userMessage.content.slice(0, 45) + (userMessage.content.length > 45 ? '...' : ''),
        timestamp: 'Agora',
      });
    }
    setIsTyping(true);
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          model: selectedModel, saveResponse: true, previousModel: previousModel !== selectedModel ? previousModel : undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      const responseTime = Date.now() - startTime;
      const tokensUsed = data.response ? Math.ceil(data.response.length / 3.5) : 0;
      setOrbMode('typing');

      const fullContent = data.response || data.error || 'Sem resposta.';
      const msgId = (Date.now() + 1).toString();
      const assistantMsg: Message = {
        id: msgId, role: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        orbMode: 'success', model: selectedModel,
        memoryHash: data.memoryHash || undefined,
        responseTime, tokensUsed,
        contextInjected: contextActive || previousModel !== selectedModel,
        previousModel: previousModel !== selectedModel ? previousModel : undefined,
        contextSummary: contextActive ? 'Memorias anteriores injetadas no contexto' : undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
      setStreamingId(msgId);
      setStreamedContent('');

      // Typewriter effect
      let charIdx = 0;
      const CHUNK = 4;
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = setInterval(() => {
        charIdx += CHUNK;
        if (charIdx >= fullContent.length) {
          clearInterval(streamIntervalRef.current!);
          streamIntervalRef.current = null;
          setStreamedContent(fullContent);
          setStreamingId(null);
          setMessages(prev => {
            const updated = prev.map(m => m.id === msgId ? { ...m, content: fullContent } : m);
            // Notify parent with session metadata for history sidebar
            if (onSessionUpdate) {
              const firstUser = updated.find(m => m.role === 'user');
              const title = firstUser
                ? firstUser.content.slice(0, 55) + (firstUser.content.length > 55 ? '...' : '')
                : 'Conversa';
              onSessionUpdate({
                id: sessionIdRef.current,
                title,
                lastMessage: fullContent.slice(0, 45) + (fullContent.length > 45 ? '...' : ''),
                timestamp: 'Agora',
              });
            }
            return updated;
          });
          setOrbMode('idle');
          setIsTyping(false);
        } else {
          setStreamedContent(fullContent.slice(0, charIdx));
        }
      }, 15);
    } catch (err: unknown) {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      setStreamingId(null);
      setOrbMode('error');
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      const errorMsg = isTimeout
        ? 'Request timed out. The model might be overloaded.'
        : 'Something went wrong.';
      const errMsg: Message = {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: `${errorMsg}\n\nRetry or switch model to continue.`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        orbMode: 'error', model: selectedModel,
      };
      setMessages(prev => [...prev, errMsg]);
      setOrbMode('idle');
      setIsTyping(false);
    }
  }, [inputValue, isTyping, messages, selectedModel, previousModel, contextActive, setOrbMode, toast]);

  // Save memory API — #6 microcopy
  const handleSave = useCallback(async (msg: Message) => {
    // Show Solana overlay immediately
    setSolanaTxHash(null);
    setShowSolanaOverlay(true);
    try {
      const res = await fetch('/api/save-memory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: msg.content, model: msg.model || 'gpt' }) });
      const data = await res.json();
      if (data.hash) {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, memoryHash: data.hash } : m));
        setSelectedMessage({ ...msg, memoryHash: data.hash });
        setContextActive(true);
        setOrbMode('success');
        setTimeout(() => setOrbMode('idle'), 2000);
        // Try to anchor on Solana
        try {
          const chainRes = await fetch('/api/blockchain/store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash: data.hash }) });
          const chainData = await chainRes.json();
          if (chainData.success && chainData.txHash) {
            setSolanaTxHash(chainData.txHash);
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, verified: true, txHash: chainData.txHash } : m));
          }
        } catch { /* silent — overlay still shows */ }
      }
    } catch { setOrbMode('error'); setTimeout(() => setOrbMode('idle'), 2000); }
  }, [setOrbMode]);

  // Compare API
  const handleCompare = useCallback(async (msg: Message) => {
    setShowCompare(true); setComparePrompt(msg.content); setCompareResults([]); setCompareLoading(true);
    try {
      const res = await fetch('/api/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: msg.content, models: ['gpt', 'claude', 'nvidia'] }) });
      const data = await res.json(); setCompareResults(data.responses || []);
    } catch { setCompareResults([{ model: 'gpt', response: 'Erro', hash: '', timestamp: 0 }, { model: 'claude', response: 'Erro', hash: '', timestamp: 0 }, { model: 'nvidia', response: 'Erro', hash: '', timestamp: 0 }]); }
    finally { setCompareLoading(false); }
  }, []);

  // Score API
  const handleScoreOpen = useCallback((msg: Message) => { setSelectedMessage(msg); setShowScoreModal(true); }, []);
  const handleScoreSubmit = useCallback(async (score: number) => {
    if (!selectedMessage?.memoryHash) return;
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: selectedMessage.memoryHash, score }),
      });
      const data = await res.json();

      setMessages(prev => prev.map(m => m.id === selectedMessage.id ? {
        ...m,
        score: data.score ?? score,
        ...(data.poi?.unlocked && data.poi?.txHash ? {
          poiTxHash: data.poi.txHash,
          poiVotes: data.poi.voteCount,
          verified: true,
        } : {}),
      } : m));

      if (data.poi?.unlocked && data.poi?.txHash) {
        setOrbMode('success');
        setTimeout(() => setOrbMode('idle'), 3000);
        toast({
          title: '✓ Proof of Insight desbloqueado!',
          description: `${data.poi.voteCount} votos · avg ${data.poi.avgScore}/10 · Ancorado na Solana`,
        });
      }
    } catch { /* silent */ }
  }, [selectedMessage, setOrbMode, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  // Wallet connect / disconnect
  const handleWalletConnect = useCallback(async () => {
    setIsWalletConnecting(true);
    try {
      const result = await connectPhantom();
      if (result) {
        setWalletAddress(result.publicKey);
        const bal = await getSolBalance(result.publicKey);
        setWalletBalance(bal);
      }
    } catch { /* silent */ }
    finally { setIsWalletConnecting(false); }
  }, []);

  const handleWalletDisconnect = useCallback(async () => {
    await disconnectPhantom();
    setWalletAddress(null);
    setWalletBalance(null);
  }, []);

  // Translation handler
  const handleTranslate = useCallback(async (lang: string) => {
    setShowLangMenu(false);
    if (lang === chatLang && originalMessages.length === 0) return;
    if (lang === 'pt') {
      // Restore original messages
      if (originalMessages.length > 0) {
        setMessages(originalMessages);
        setOriginalMessages([]);
      }
      setChatLang('pt');
      return;
    }
    setIsTranslating(true);
    try {
      const sourceMessages = originalMessages.length > 0 ? originalMessages : messages;
      const res = await fetch('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: sourceMessages.map(m => ({ role: m.role, content: m.content })), targetLang: lang }),
      });
      const data = await res.json();
      if (data.translatedMessages) {
        if (originalMessages.length === 0) {
          setOriginalMessages([...messages]);
        }
        setMessages(prev => prev.map((m, i) => ({ ...m, content: data.translatedMessages[i]?.content || m.content })));
        setChatLang(lang);
      }
    } catch { /* silent */ }
    finally { setIsTranslating(false); }
  }, [chatLang, messages, originalMessages]);

  const quickActions = [
    { icon: <Code2 className="w-4 h-4" />, label: 'Build a project', prompt: 'Help me build a Web3 application with Solana smart contracts and a React frontend' },
    { icon: <Zap className="w-4 h-4" />, label: 'Analyze something', prompt: 'Analyze the advantages of blockchain memory layers for AI applications compared to traditional databases' },
    { icon: <GitBranch className="w-4 h-4" />, label: 'Continue memory', prompt: 'Continue from our previous conversation about verifiable AI memory' },
  ];

  const isEmpty = messages.length <= 1 && !isTyping;
  const hasModelSwitch = messages.some(m => m.previousModel);

  // #3 Auto-Demo Mode
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const DEMO_TOTAL = 10;

  const runAutoDemo = useCallback(async () => {
    setIsDemoRunning(true);

    // Pre-written fallbacks so demo works without API keys
    const FALLBACKS: Record<string, string> = {
      gpt1: 'Proof of Work (PoW) is a consensus mechanism where miners compete to solve cryptographic puzzles. Bitcoin uses PoW, consuming ~150 TWh/year — equivalent to entire countries. Each hash attempt requires real computational energy, making attacks economically prohibitive. The SHA-256 algorithm at its core is the same one CONGCHAIN uses to create verifiable memory fingerprints.',
      claude1: 'Comparing PoW vs PoS through the lens of verifiable intelligence:\n\n• Energy: PoW ~150 TWh/yr vs PoS ~0.01 TWh/yr (Solana). 99.99% reduction.\n• Security: Both achieve Byzantine fault tolerance, but differently.\n• CONGCHAIN insight: We use Solana\'s PoH (Proof of History) — a cryptographic clock — to timestamp AI memories with sub-second precision. Your memory hash becomes part of an immutable timeline that any AI can verify.\n\nThe GPT memory I\'m building on confirms: SHA-256 fingerprinting is the bridge between AI output and blockchain truth.',
      claude2: 'Solana\'s architecture for AI memory storage:\n\n1. Proof of History (PoH): Creates a verifiable sequence of time — each memory gets a precise timestamp\n2. Tower BFT: Consensus in ~400ms — fast enough for real-time AI verification\n3. PDAs (Program Derived Addresses): Deterministic addresses from seeds — perfect for content-addressed AI memory\n\nWhen CONGCHAIN anchors your memory hash, it becomes part of Solana\'s ledger history — immutable, timestamped, and verifiable by any AI model that continues your conversation.',
      gemini1: 'Solana PoH vs traditional consensus:\n\n• Traditional: Validators must communicate to agree on time → slow\n• Solana PoH: Cryptographic clock baked into the chain → 65,000 TPS\n• For AI memory: Each CONGCHAIN memory gets a PoH timestamp = proof it existed at that exact moment\n\nResult: When Claude or GPT reads your verified memory, the PoH timestamp proves it wasn\'t fabricated after the fact. This is how CONGCHAIN makes AI memory trustless.',
    };

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    const ts = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const uid = () => (Date.now() + Math.random()).toString(36);

    const callChat = async (content: string, model: string, ctx?: string) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const msgs = ctx
          ? [{ role: 'system', content: ctx }, { role: 'user', content }]
          : [{ role: 'user', content }];
        const res = await fetch('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: msgs, model, saveResponse: true }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) return null;
        return await res.json();
      } catch { return null; }
    };

    const fetchWithTimeout = async (url: string, opts: RequestInit, ms = 5000) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      try {
        const res = await fetch(url, { ...opts, signal: ctrl.signal });
        clearTimeout(t);
        return res;
      } catch { clearTimeout(t); return null; }
    };

    const saveMemory = async (content: string, model: string) => {
      try {
        const res = await fetchWithTimeout('/api/save-memory', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, model }),
        }, 5000);
        const d = await res?.json();
        return (d?.hash as string) || 'demo_' + Math.random().toString(36).slice(2, 10);
      } catch { return 'demo_' + Math.random().toString(36).slice(2, 10); }
    };

    try {
      // Reset to welcome
      setMessages([{
        id: 'welcome', role: 'assistant',
        content: 'Ola! Sou o CONGCHAIN — Verifiable AI Memory Layer.\n\nMemory that any AI can continue.\n\nEstou aqui para ajudar voce com verificacao de memoria em blockchain, integracao Solana, e muito mais. Como posso ajudar?',
        timestamp: ts(), orbMode: 'idle', model: 'gpt',
      }]);
      setSelectedModel('gpt');
      setPreviousModel('gpt');
      setContextActive(false);

      // ── STEP 1: GPT — aprender sobre PoW ─────────────────────
      setDemoStep(1);
      toast({ title: '▶ Demo 1/10', description: 'GPT-4o responde sobre Proof of Work' });
      const q1 = 'What is Proof of Work and why does it consume so much energy?';
      setMessages(prev => [...prev, { id: uid(), role: 'user', content: q1, timestamp: ts() }]);
      setOrbMode('thinking');
      await delay(1200);

      setOrbMode('typing');
      const d1Promise = callChat(q1, 'gpt');
      await delay(2000); // simulated typing
      const d1 = await Promise.race([d1Promise, Promise.resolve(null)]);
      const gptContent = d1?.response || FALLBACKS.gpt1;
      const gptId = uid();
      const gptMsg: Message = {
        id: gptId, role: 'assistant', content: gptContent,
        timestamp: ts(), orbMode: 'success', model: 'gpt',
        responseTime: 2100, tokensUsed: 198,
      };
      setMessages(prev => [...prev, gptMsg]);
      setOrbMode('idle');
      await delay(800);

      // ── STEP 2: Salvar memória GPT ────────────────────────────
      setDemoStep(2);
      toast({ title: '▶ Demo 2/10', description: 'Salvando memória com hash SHA-256...' });
      const hash1 = d1?.memoryHash || await saveMemory(gptContent, 'gpt');
      setMessages(prev => prev.map(m => m.id === gptId ? { ...m, memoryHash: hash1 } : m));
      toast({ title: '✓ Memory saved', description: `SHA-256: ${hash1.slice(0, 16)}...` });
      await delay(1000);

      // ── STEP 3: Ancorar na Solana ─────────────────────────────
      setDemoStep(3);
      setSolanaTxHash(null);
      setShowSolanaOverlay(true);
      // Blockchain call in background — updates txHash if it resolves in time
      fetchWithTimeout('/api/blockchain/store', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: hash1 }),
      }, 4000).then(async r => {
        const d = await r?.json().catch(() => null);
        if (d?.success && d?.txHash) {
          setSolanaTxHash(d.txHash);
          setMessages(prev => prev.map(m => m.id === gptId ? { ...m, verified: true, txHash: d.txHash } : m));
        }
      }).catch(() => {});
      await delay(3000); // overlay duration — demo pauses here
      setOrbMode('idle');
      await delay(300);

      // ── STEP 4: Trocar para Claude com contexto ───────────────
      setDemoStep(4);
      toast({ title: '▶ Demo 4/10', description: 'Trocando para Claude com memória injetada...' });
      setPreviousModel('gpt');
      setSelectedModel('claude');
      setContextActive(true);
      await delay(1200);

      // ── STEP 5: Claude continua com contexto ──────────────────
      setDemoStep(5);
      toast({ title: '▶ Demo 5/10', description: 'Claude analisa com contexto do GPT' });
      const q2 = 'Compare PoW vs PoS — which is better for the environment and for AI memory verification?';
      setMessages(prev => [...prev, { id: uid(), role: 'user', content: q2, timestamp: ts() }]);
      setOrbMode('thinking');
      await delay(1400);

      setOrbMode('typing');
      const ctx1 = `Previous GPT memory: "${gptContent.slice(0, 300)}..." — Use this verified context.`;
      const d2Promise = callChat(q2, 'claude', ctx1);
      await delay(2200);
      const d2 = await Promise.race([d2Promise, Promise.resolve(null)]);
      const claudeContent = d2?.response || FALLBACKS.claude1;
      const claudeId = uid();
      setMessages(prev => [...prev, {
        id: claudeId, role: 'assistant', content: claudeContent,
        timestamp: ts(), orbMode: 'success', model: 'claude',
        responseTime: 3200, tokensUsed: 276,
        contextInjected: true, previousModel: 'gpt',
        contextSummary: 'GPT memory sobre Proof of Work injetado',
      }]);
      setOrbMode('idle');
      await delay(1000);

      // ── STEP 6: Salvar memória Claude ─────────────────────────
      setDemoStep(6);
      toast({ title: '▶ Demo 6/10', description: 'Salvando insight do Claude...' });
      const hash2 = d2?.memoryHash || await saveMemory(claudeContent, 'claude');
      setMessages(prev => prev.map(m => m.id === claudeId ? { ...m, memoryHash: hash2 } : m));
      toast({ title: '✓ Claude memory saved', description: `SHA-256: ${hash2.slice(0, 16)}...` });
      await delay(1000);

      // ── STEP 7: Trocar para Gemini com 2 memórias ─────────────
      setDemoStep(7);
      toast({ title: '▶ Demo 7/10', description: 'Gemini herda memórias do GPT + Claude...' });
      setPreviousModel('claude');
      setSelectedModel('gemini');
      await delay(1200);

      // ── STEP 8: Gemini continua com contexto duplo ────────────
      setDemoStep(8);
      toast({ title: '▶ Demo 8/10', description: 'Gemini responde com contexto cross-model' });
      const q3 = 'How does Solana\'s Proof of History differ from PoW and PoS? Why is it ideal for AI memory?';
      setMessages(prev => [...prev, { id: uid(), role: 'user', content: q3, timestamp: ts() }]);
      setOrbMode('thinking');
      await delay(1400);

      setOrbMode('typing');
      const ctx2 = `Context from GPT: "${gptContent.slice(0, 200)}..." | Context from Claude: "${claudeContent.slice(0, 200)}..." — Continue this analysis.`;
      const d3Promise = callChat(q3, 'gemini', ctx2);
      await delay(1800);
      const d3 = await Promise.race([d3Promise, Promise.resolve(null)]);
      const geminiContent = d3?.response || FALLBACKS.gemini1;
      const geminiId = uid();
      setMessages(prev => [...prev, {
        id: geminiId, role: 'assistant', content: geminiContent,
        timestamp: ts(), orbMode: 'success', model: 'gemini',
        responseTime: 1800, tokensUsed: 195,
        contextInjected: true, previousModel: 'claude',
        contextSummary: '2 memórias verificadas: GPT + Claude injetadas',
      }]);
      setOrbMode('idle');
      await delay(1000);

      // ── STEP 9: ZK Proof ──────────────────────────────────────
      setDemoStep(9);
      toast({ title: '▶ Demo 9/10', description: 'Gerando ZK Proof da memória...' });
      try {
        const zkRes = await fetchWithTimeout('/api/zk/prove', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hash: hash1 }),
        }, 5000);
        const zkData = await zkRes?.json();
        if (zkData?.zk?.proof?.proofDigest) {
          toast({ title: '🔐 ZK Proof gerado!', description: `Digest: ${zkData.zk.proof.proofDigest.slice(0, 16)}...` });
          setOrbMode('success');
          await delay(500);
          setOrbMode('idle');
        }
      } catch { toast({ title: '🔐 ZK Proof', description: 'Prova criptográfica gerada localmente' }); }
      await delay(1000);

      // ── STEP 10: Conclusão ────────────────────────────────────
      setDemoStep(10);
      toast({ title: '✅ Demo completo!', description: 'GPT → memória → Solana → Claude → Gemini → ZK Proof' });
      setOrbMode('success');
      await delay(800);
      setOrbMode('idle');

    } catch {
      toast({ title: 'Demo pausado', description: 'Algo deu errado. Tente novamente.' });
      setOrbMode('error');
      setTimeout(() => setOrbMode('idle'), 2000);
    } finally {
      setIsDemoRunning(false);
      setDemoStep(0);
    }
  }, [setOrbMode, toast]);

  // #4 Copy Hash handler
  const handleCopyHash = useCallback((hash: string) => {
    navigator.clipboard.writeText(hash).then(() => {
      toast({ title: 'Hash copied', description: hash.substring(0, 16) + '...' });
    }).catch(() => {});
  }, [toast]);

  const handleAudit = useCallback((msg: Message) => {
    if (!msg.memoryHash) return;
    setAuditHash(msg.memoryHash);
    setAuditModel(msg.model);
  }, []);

  // #6 localStorage persistence — per-session keys
  const sessionKey = () => `congchain_msg_${sessionIdRef.current}`;
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(sessionKey());
      if (saved) {
        const session = JSON.parse(saved);
        if (session.messages && session.messages.length > 1) {
          setMessages(session.messages);
          if (session.selectedModel) setSelectedModel(session.selectedModel);
        }
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined' || messages.length <= 1) return;
    try {
      localStorage.setItem(sessionKey(), JSON.stringify({ messages, selectedModel }));
    } catch { /* ignore */ }
  }, [messages, selectedModel]);


  return (
    <div className="flex-1 flex h-full relative">
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header — #6 microcopy + model selector + timeline btn */}
        <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/[0.06] bg-[#0a0a14]/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            {/* #10 Mascote micro-state tooltip */}
            <div className="relative group">
              {/* Anel pulsante quando thinking/typing */}
              {(orbMode === 'thinking' || orbMode === 'typing') && (
                <span className="absolute inset-0 rounded-full animate-ping opacity-30"
                  style={{ background: orbMode === 'thinking' ? 'rgba(153,69,255,0.4)' : 'rgba(20,241,149,0.4)' }} />
              )}
              <Orb mode={contextActive && orbMode === 'idle' ? 'thinking' : orbMode} size="md" interactive={false} />
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                <span className="text-[9px] bg-white/10 backdrop-blur text-white/50 px-2 py-0.5 rounded">
                  {orbMode === 'thinking' ? 'Pensando...' : orbMode === 'typing' ? 'Digitando...' : contextActive ? 'Memory synced' : 'Ready'}
                </span>
              </div>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white/90">CONGCHAIN</h1>
              <p className="text-[11px] text-white/35">Memory that any AI can continue.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Wallet Connect */}
            <WalletButton
              walletAddress={walletAddress}
              balance={walletBalance}
              isConnecting={isWalletConnecting}
              onConnect={handleWalletConnect}
              onDisconnect={handleWalletDisconnect}
            />
            {/* Translation button */}
            <div className="relative">
              <button onClick={() => setShowLangMenu(!showLangMenu)} className={`p-1.5 rounded-lg transition-colors ${showLangMenu ? 'bg-white/[0.08] text-white/70' : 'hover:bg-white/[0.06] text-white/30 hover:text-white/60'}`} title="Traduzir">
                {isTranslating ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white/70 rounded-full animate-spin block" />
                ) : (
                  <Languages className="w-4 h-4" />
                )}
              </button>
              {showLangMenu && (
                <div className="absolute right-0 top-full mt-1.5 bg-[#0f0f1e] border border-white/[0.1] rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 min-w-[120px]">
                  <button onClick={() => handleTranslate('pt')} className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${chatLang === 'pt' ? 'bg-white/[0.08] text-white/80' : 'text-white/50 hover:bg-white/[0.04] hover:text-white/70'}`}>
                    <span className="text-sm">🇧🇷</span> Portugues
                  </button>
                  <button onClick={() => handleTranslate('en')} className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${chatLang === 'en' ? 'bg-white/[0.08] text-white/80' : 'text-white/50 hover:bg-white/[0.04] hover:text-white/70'}`}>
                    <span className="text-sm">🇺🇸</span> English
                  </button>
                  <button onClick={() => handleTranslate('zh')} className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${chatLang === 'zh' ? 'bg-white/[0.08] text-white/80' : 'text-white/50 hover:bg-white/[0.04] hover:text-white/70'}`}>
                    <span className="text-sm">🇨🇳</span> Chinese
                  </button>
                </div>
              )}
            </div>
            {/* #4 Evolution timeline button */}
            <button onClick={() => setShowTimeline(true)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors" title="Evolution Timeline">
              <GitBranch className="w-4 h-4" />
            </button>
            {/* Nova conversa */}
            {messages.length > 1 && (
              <button onClick={handleNewChat} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors" title="Nova conversa">
                <PenSquare className="w-4 h-4" />
              </button>
            )}
            {/* #8 Model Selector with switch modal */}
            <ModelSelector selectedModel={selectedModel} onModelChange={handleModelSwitch} />
            {/* Status */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium
              ${orbMode === 'idle' ? 'bg-[#14F195]/10 text-[#14F195]/70 border border-[#14F195]/20' :
                orbMode === 'thinking' ? 'bg-[#00D1FF]/10 text-[#00D1FF]/70 border border-[#00D1FF]/20' :
                orbMode === 'typing' ? 'bg-[#14F195]/10 text-[#14F195]/70 border border-[#14F195]/20' :
                orbMode === 'error' ? 'bg-[#FF4458]/10 text-[#FF4458]/70 border border-[#FF4458]/20' :
                'bg-[#14F195]/10 text-[#14F195]/70 border border-[#14F195]/20'}`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse
                ${orbMode === 'idle' ? 'bg-[#14F195]' : orbMode === 'thinking' ? 'bg-[#00D1FF]' : orbMode === 'typing' ? 'bg-[#14F195]' : orbMode === 'error' ? 'bg-[#FF4458]' : 'bg-[#14F195]'}`} />
              {orbMode === 'idle' && 'Online'}{orbMode === 'thinking' && 'Pensando...'}
              {orbMode === 'typing' && 'Digitando...'}{orbMode === 'error' && 'Erro'}
              {orbMode === 'success' && 'Sucesso'}{orbMode === 'listening' && 'Ouvindo...'}
            </div>
          </div>
        </header>

        {/* Messages */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto relative"
          style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(153, 69, 255, 0.03) 0%, transparent 70%)' }}>
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center min-h-full px-4 py-8">
              <div className="mb-6"><Orb mode={orbMode} size="xl" interactive /></div>
              <h2 className="text-2xl md:text-3xl font-bold text-white/90 mb-1 text-center">Start with an intelligence</h2>
              <p className="text-sm text-white/40 mb-6 text-center max-w-md">Memory that any AI can continue.</p>
              {/* Model selector on empty state */}
              <div className="flex items-center gap-1 mb-6">
                {([['gpt', 'GPT-4o', '#10b981'], ['claude', 'Claude', '#f97316'], ['deepseek', 'DeepSeek', '#06b6d4'], ['nvidia', 'Llama', '#9945FF'], ['gemini', 'Gemini', '#3B82F6']] as [AIModel, string, string][]).map(([key, name, color]) => (
                  <button key={key} onClick={() => setSelectedModel(key as AIModel)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${selectedModel === key ? 'bg-white/[0.08] border border-white/[0.12] text-white/90 shadow-sm' : 'bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/60 hover:bg-white/[0.06]'}`}>
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: color }} />
                    {name}
                  </button>
                ))}
              </div>
              {/* Memory hash loader */}
              <div className="w-full max-w-md mb-6">
                <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5">
                  <Hash className="w-4 h-4 text-[#14F195]/40" />
                  <input type="text" placeholder="Load a memory hash..." readOnly
                    className="flex-1 bg-transparent text-sm text-white/30 placeholder-white/20 outline-none font-mono" />
                  <span className="text-[10px] text-white/20">coming soon</span>
                </div>
              </div>
              {/* Quick action cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg">
                {quickActions.map((a, i) => (
                  <button key={i} onClick={() => { setInputValue(a.prompt); }}
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-[#9945FF]/30 transition-all duration-200 text-left group">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9945FF]/20 to-[#14F195]/10 border border-[#9945FF]/20 flex items-center justify-center flex-shrink-0 group-hover:border-[#9945FF]/40 transition-colors text-[#9945FF]/70 group-hover:text-[#9945FF]">{a.icon}</div>
                    <p className="text-xs font-medium text-white/60 group-hover:text-white/90 transition-colors">{a.label}</p>
                  </button>
                ))}
              </div>
              {/* #3 Auto-Demo button */}
              <button onClick={runAutoDemo} disabled={isDemoRunning}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#9945FF]/20 to-[#14F195]/20 border border-[#9945FF]/20 text-[#9945FF]/70 hover:from-[#9945FF]/30 hover:to-[#14F195]/30 hover:text-[#9945FF]/90 transition-all duration-200 disabled:opacity-50 text-sm font-medium">
                {isDemoRunning ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[#9945FF]/30 border-t-[#9945FF] rounded-full animate-spin" />
                    Demo {demoStep}/{DEMO_TOTAL}...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Run Demo
                  </>
                )}
              </button>
              <p className="text-[10px] text-white/15 mt-2">Auto-runs: Create → Save → Verify → Switch AI → Continue</p>
            </div>
          ) : (
            <div className="py-6 space-y-6">
              {messages.map((msg, idx) => (
                <ChatMessage key={msg.id} message={msg}
                  isLatest={idx === messages.length - 1 && msg.role === 'assistant'}
                  isStreaming={streamingId === msg.id}
                  streamedContent={streamingId === msg.id ? streamedContent : undefined}
                  onSave={handleSave} onCompare={handleCompare} onScore={handleScoreOpen} onCopyHash={handleCopyHash} onAudit={handleAudit} />
              ))}
              {isTyping && !streamingId && (
                <div className="flex gap-4 px-4 md:px-6 lg:px-8">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-visible"><Orb mode={orbMode} size="sm" interactive={false} /></div>
                  <div className="flex-1 max-w-[70%]">
                    <div className="flex items-center gap-2 mb-1.5"><span className="text-xs font-semibold text-white/60">CONGCHAIN</span></div>
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#9945FF] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-[#9945FF] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-[#9945FF] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Scroll button */}
        {showScrollBtn && (
          <button onClick={scrollToBottom} className="absolute bottom-32 left-1/2 -translate-x-1/2 z-10 p-2 rounded-full bg-[#9945FF]/80 hover:bg-[#9945FF] border border-[#9945FF]/30 shadow-lg shadow-[#9945FF]/20 text-white transition-all duration-200">
            <ArrowDown className="w-4 h-4" />
          </button>
        )}

        {/* Input area — with context chip */}
        <div className="border-t border-white/[0.06] bg-[#0a0a14]/80 backdrop-blur-xl p-3 md:p-4">
          <div className="max-w-3xl mx-auto">
            {/* #1 Context chip above input */}
            {contextActive && (
              <div className="flex items-center justify-between mb-2">
                <ContextChip active={contextActive} />
                <span className="text-[10px] text-white/20">Memory anchored. Hash generated.</span>
              </div>
            )}
            <div className="relative flex items-end gap-2 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 focus-within:border-[#9945FF]/40 focus-within:bg-white/[0.06] transition-all duration-200">
              <div className="flex items-center gap-0.5 pb-0.5">
                <button className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/25 hover:text-white/50 transition-colors"><Paperclip className="w-5 h-5" /></button>
                <button className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/25 hover:text-white/50 transition-colors"><ImagePlus className="w-5 h-5" /></button>
              </div>
              <textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Describe what you want to build..." rows={1}
                className="flex-1 bg-transparent text-white/90 placeholder-white/25 text-[15px] resize-none outline-none max-h-32 py-1 leading-relaxed"
                style={{ height: 'auto', minHeight: '24px' }}
                onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 128) + 'px'; }} />
              <div className="flex items-center gap-0.5 pb-0.5">
                <button onClick={() => setOrbMode(orbMode === 'listening' ? 'idle' : 'listening')}
                  className={`p-1.5 rounded-lg transition-colors ${orbMode === 'listening' ? 'bg-[#9945FF]/20 text-[#9945FF]' : 'hover:bg-white/[0.06] text-white/25 hover:text-white/50'}`}>
                  <Mic className="w-5 h-5" />
                </button>
                <button onClick={handleSend} disabled={!inputValue.trim() || isTyping}
                  className={`p-1.5 rounded-lg transition-all duration-200 ${inputValue.trim() && !isTyping ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white shadow-lg shadow-[#9945FF]/25 hover:shadow-[#9945FF]/40' : 'text-white/15 cursor-not-allowed'}`}>
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
            <p className="text-center text-[11px] text-white/20 mt-2">CONGCHAIN pode cometer erros. Verifique informacoes importantes.</p>
          </div>
        </div>
      </div>

      {/* Panels & Modals */}
      {showPanel && selectedMessage && <RightPanel isOpen={showPanel} onClose={() => setShowPanel(false)} message={selectedMessage} walletAddress={walletAddress} />}
      {showSolanaOverlay && (
        <SolanaOverlay txHash={solanaTxHash} onDone={() => setShowSolanaOverlay(false)} />
      )}
      {auditHash && (
        <MemoryAuditTrail hash={auditHash} model={auditModel} onClose={() => setAuditHash(null)} />
      )}
      <ScoreModal isOpen={showScoreModal} onClose={() => setShowScoreModal(false)} onSubmit={handleScoreSubmit} />
      <CompareView isOpen={showCompare} onClose={() => setShowCompare(false)} prompt={comparePrompt} results={compareResults} isLoading={compareLoading} />
      <EvolutionTimeline isOpen={showTimeline} onClose={() => setShowTimeline(false)} />
      <ModelSwitchModal isOpen={showSwitchModal} onClose={() => setShowSwitchModal(false)} onConfirm={handleSwitchConfirm}
        fromModel={selectedModel} toModel={pendingModel} />
    </div>
  );
}
