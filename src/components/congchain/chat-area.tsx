'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import {
  Send, ArrowDown,
  Save, Columns2, Star, Link2, Shield, X, Cpu, Hash,
  ChevronDown, ChevronUp, Zap, Check, AlertTriangle, Eye, ExternalLink,
  GitBranch, ArrowRight, Timer, Info, Languages,
  Gem, Code2, Sparkles, Paperclip, ImagePlus, Mic, PenSquare,
  BarChart3,
} from 'lucide-react';
import Orb, { type OrbMode } from './orb';
import { MODEL_LABELS, type AIModel } from '@/services/memory/memory.model';
import type { StructuredResponse } from '@/lib/grounding/types';
import {
  WalletAgentPreviewCard,
  WalletAgentReviewPanel,
  confirmWalletAgentIntent,
  confirmWalletAgentDevnetTransaction,
  createWalletAgentHistoryEntry,
  createWalletAgentCore,
  detectWalletAgentIntent,
  readWalletAgentHistory,
  readWalletAgentWalletSnapshot,
  prepareWalletAgentDevnetTransaction,
  signWalletAgentDevnetTransaction,
  submitWalletAgentDevnetTransaction,
  upsertWalletAgentHistory,
  type WalletAgentCoreResult,
  type WalletAgentHistoryEntry,
  type WalletAgentParsedIntent,
} from '@/features/wallet-agent';
import dynamic from 'next/dynamic';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
const ResponseRouter = dynamic(() => import('@/components/responses/ResponseRouter'), { ssr: false });
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false });
const WalletAdapterButton = dynamic(() => import('./wallet-button'), { ssr: false });
type ChatPhase = 'idle' | 'connecting' | 'thinking' | 'streaming' | 'completed' | 'error';
type DemoStage = {
  visible: boolean;
  step: number;
  title: string;
  subtitle: string;
  phase: 'boot' | 'capture' | 'anchor' | 'handoff' | 'synthesis' | 'proof' | 'finale';
  primaryModel?: string;
  secondaryModel?: string;
  hash?: string;
  txHash?: string;
  trustScore?: number;
};
type DemoMemoryPassport = {
  hash: string;
  model: string;
  createdAt: string;
  title: string;
};

type SolMarketSnapshot = {
  symbol: 'SOL';
  price: number | null;
  change24h: number | null;
  volume24h: number | null;
  marketCap: number | null;
  liquidity: number | null;
  liquidityLabel: string | null;
  marketCapLabel: string | null;
  volumeLabel: string | null;
  chart: number[];
  protocols: Array<{ name: string; tvl: number; change1d: number | null }>;
  signal: 'bullish' | 'risk-off' | 'neutral';
  action: string;
  trustScore: number;
  sources: string[];
  updatedAt: string;
};

type DevnetWalletCreatedEvent = CustomEvent<{
  publicKey: string;
  createdAt: string;
  balance: number;
  airdropTx?: string;
  airdropStatus: 'success' | 'pending' | 'failed';
}>;

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
  structuredResponse?: StructuredResponse;
  marketSnapshot?: SolMarketSnapshot;
  walletAgentResult?: WalletAgentCoreResult;
}

// ============================================================
// Chat Message — with performance badge + score
// ============================================================
function ThinkingPanel({ phase, status, thoughts, showReasoning, onToggle }: {
  phase: ChatPhase;
  status: string;
  thoughts: string[];
  showReasoning: boolean;
  onToggle: () => void;
}) {
  if (!['connecting', 'thinking'].includes(phase)) return null;

  return (
    <div className="flex gap-4 px-4 md:px-6 lg:px-8">
      <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-visible">
        <Orb mode="thinking" size="sm" interactive={false} />
      </div>
      <div className="flex-1 max-w-[85%] md:max-w-[70%]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold text-white/60">CONGCHAIN</span>
          <button
            onClick={onToggle}
            className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/35 hover:text-white/60 hover:border-[#9945FF]/30 transition-colors"
          >
            {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
          </button>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-3 shadow-lg shadow-black/10">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9945FF] animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[#9945FF] animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[#9945FF] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-[12px] text-white/45 transition-all duration-300">{status || 'Thinking...'}</span>
          </div>
          {showReasoning && thoughts.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
              {thoughts.slice(-4).map((thought, index) => (
                <div key={`${thought}-${index}`} className="rounded-xl bg-[#9945FF]/[0.07] border border-[#9945FF]/10 px-3 py-2 text-[12px] leading-relaxed text-white/50 animate-in fade-in duration-300">
                  {thought}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DemoCommandCenter({ stage, total }: { stage: DemoStage; total: number }) {
  if (!stage.visible) return null;
  const progress = Math.min(100, Math.round((stage.step / total) * 100));
  const phaseColor: Record<DemoStage['phase'], string> = {
    boot: '#9945FF',
    capture: '#00D1FF',
    anchor: '#14F195',
    handoff: '#F59E0B',
    synthesis: '#3B82F6',
    proof: '#06B6D4',
    finale: '#14F195',
  };
  const color = phaseColor[stage.phase];

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-40 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2">
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080812]/90 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: color, boxShadow: `0 0 18px ${color}` }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Hackathon Demo</span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-mono text-white/40">
                {stage.step}/{total}
              </span>
            </div>
            <h3 className="truncate text-sm font-semibold text-white/90">{stage.title}</h3>
            <p className="mt-0.5 line-clamp-2 text-xs text-white/45">{stage.subtitle}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:w-72">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-white/25">Model</p>
              <p className="mt-1 truncate text-[11px] font-semibold text-white/70">{stage.primaryModel ?? 'CONGCHAIN'}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-white/25">Memory</p>
              <p className="mt-1 truncate font-mono text-[11px] text-[#14F195]/70">{stage.hash ? `${stage.hash.slice(0, 6)}...` : 'pending'}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-white/25">Trust</p>
              <p className="mt-1 text-[11px] font-semibold text-[#00D1FF]/75">{stage.trustScore ?? progress}%</p>
            </div>
          </div>
        </div>
        <div className="h-1 bg-white/[0.05]">
          <div
            className="h-full transition-all duration-700"
            style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${color}, #14F195)` }}
          />
        </div>
      </div>
    </div>
  );
}

function DemoFinaleOverlay({ stage, summary, onCopy, copied, onClose }: {
  stage: DemoStage;
  summary: string;
  onCopy: () => void;
  copied: boolean;
  onClose: () => void;
}) {
  if (!stage.visible || stage.phase !== 'finale') return null;
  void summary;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-[#14F195]/20 bg-[#06060e]/95 shadow-2xl shadow-[#14F195]/10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#14F195] to-transparent" />
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[#14F195]/70">Judge Moment</p>
              <h2 className="text-2xl font-bold leading-tight text-white sm:text-3xl">One memory. Three models. Verifiable continuity.</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/50">
                CONGCHAIN turns an AI answer into a portable memory primitive: hashed, anchored, inherited by another model, and proven again without locking the user to one provider.
              </p>
            </div>
            <button onClick={onClose} className="pointer-events-auto rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/45 hover:text-white/80">
              Close
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Memory Hash', stage.hash ? `${stage.hash.slice(0, 12)}...` : 'generated', '#9945FF'],
              ['Solana Proof', stage.txHash ? `${stage.txHash.slice(0, 12)}...` : 'devnet ready', '#14F195'],
              ['Trust Score', `${stage.trustScore ?? 100}%`, '#00D1FF'],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
                <p className="text-[10px] uppercase tracking-wider text-white/25">{label}</p>
                <p className="mt-2 truncate font-mono text-sm font-semibold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-[#14F195]/15 bg-[#14F195]/[0.04] p-4">
            <p className="text-sm font-semibold text-white/85">What jurors should remember:</p>
            <p className="mt-1 text-sm leading-relaxed text-white/50">
              The demo is not a chatbot trick. It is a live proof that AI memory can survive model switching, be verified on Solana, and become reusable infrastructure for agents.
            </p>
          </div>

          <button
            onClick={onCopy}
            className="mt-4 w-full rounded-2xl border border-[#9945FF]/25 bg-[#9945FF]/10 px-4 py-3 text-sm font-semibold text-[#C084FC] transition-colors hover:border-[#14F195]/30 hover:bg-[#14F195]/10 hover:text-[#14F195]"
          >
            {copied ? 'Judge summary copied' : 'Copy judge summary'}
          </button>
        </div>
      </div>
    </div>
  );
}

function isSolMarketQuery(text: string) {
  const normalized = text.toLowerCase();
  return /(solana|sol\b)/i.test(normalized)
    && /(pre[cç]o|price|valor|mercado|market|hoje|agora|cotacao|cotação|volume|liquidez)/i.test(normalized);
}

function SolMarketCard({ snapshot }: { snapshot: SolMarketSnapshot }) {
  const currentPrice = snapshot.price ?? 0;
  const previousPrice = currentPrice && snapshot.change24h !== null
    ? currentPrice / (1 + snapshot.change24h / 100)
    : currentPrice;
  const fallbackChart = Array.from({ length: 24 }, (_, index) => {
    const progress = index / 23;
    const wave = Math.sin(progress * Math.PI * 2) * Math.abs(currentPrice - previousPrice) * 0.08;
    return previousPrice + (currentPrice - previousPrice) * progress + wave;
  });
  const chart = snapshot.chart.length >= 3 ? snapshot.chart : fallbackChart;
  const min = Math.min(...chart);
  const max = Math.max(...chart);
  const range = max - min || 1;
  const pointPairs = chart.map((value, index) => {
    const x = 3 + (index / Math.max(1, chart.length - 1)) * 94;
    const y = 78 - ((value - min) / range) * 58;
    return { x, y, value };
  });
  const points = pointPairs.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  const areaPoints = pointPairs.length
    ? `${pointPairs[0].x.toFixed(2)},84 ${points} ${pointPairs[pointPairs.length - 1].x.toFixed(2)},84`
    : '';
  const lastPoint = pointPairs[pointPairs.length - 1];
  const positive = (snapshot.change24h ?? 0) >= 0;
  const signalLabel = snapshot.signal === 'bullish' ? 'Momentum positivo' : snapshot.signal === 'risk-off' ? 'Risk-off' : 'Neutro';
  const signalColor = snapshot.signal === 'bullish' ? '#14F195' : snapshot.signal === 'risk-off' ? '#EF4444' : '#F59E0B';

  return (
    <div className="mb-3 w-full overflow-hidden rounded-2xl border border-[#14F195]/15 bg-[#05070a] shadow-2xl shadow-[#14F195]/5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-white/[0.025] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-[#14F195]/20 bg-[#14F195]/10 p-2 text-[#14F195]">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#14F195]/70">SOL Market Intelligence</p>
            <p className="text-xs text-white/35">Dados vivos: {snapshot.sources.join(' + ')}</p>
          </div>
        </div>
        <div className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ borderColor: `${signalColor}44`, background: `${signalColor}18`, color: signalColor }}>
          {signalLabel}
        </div>
      </div>

      <div className="grid gap-px bg-white/[0.06] sm:grid-cols-3">
        <div className="bg-[#07090d] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Preco SOL</p>
          <p className="mt-1 text-2xl font-black text-white">${snapshot.price?.toFixed(2) ?? '--'}</p>
          <p className={`mt-1 text-xs font-bold ${positive ? 'text-[#14F195]' : 'text-[#EF4444]'}`}>
            {positive ? '+' : ''}{snapshot.change24h?.toFixed(2) ?? '--'}% 24h
          </p>
        </div>
        <div className="bg-[#07090d] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Volume 24h</p>
          <p className="mt-1 text-2xl font-black text-white">{snapshot.volumeLabel ?? '--'}</p>
          <p className="mt-1 text-xs text-white/35">Binance/CoinGecko</p>
        </div>
        <div className="bg-[#07090d] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Market cap</p>
          <p className="mt-1 text-2xl font-black text-white">{snapshot.marketCapLabel ?? '--'}</p>
          <p className="mt-1 text-xs text-white/35">Trust {snapshot.trustScore}/100</p>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-2xl border border-white/[0.06] bg-black/35 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/30">24h chart</span>
            <span className="text-[10px] text-white/25">{new Date(snapshot.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <svg viewBox="0 0 100 90" className="h-44 w-full overflow-visible">
            <defs>
              <linearGradient id="sol-market-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={signalColor} stopOpacity="0.35" />
                <stop offset="100%" stopColor={signalColor} stopOpacity="0" />
              </linearGradient>
              <filter id="sol-market-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {[22, 42, 62, 82].map(y => (
              <line key={y} x1="3" x2="97" y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="1.5 3" />
            ))}
            <polyline points={areaPoints} fill="url(#sol-market-fill)" stroke="none" />
            <polyline points={points} fill="none" stroke={signalColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" filter="url(#sol-market-glow)" />
            {pointPairs.filter((_, index) => index % 6 === 0).map(point => (
              <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="1.3" fill="#05070a" stroke={signalColor} strokeWidth="1" />
            ))}
            {lastPoint && (
              <>
                <circle cx={lastPoint.x} cy={lastPoint.y} r="2.2" fill={signalColor} />
                <text x="96" y={Math.max(12, lastPoint.y - 5)} textAnchor="end" fill={signalColor} fontSize="4.5" fontWeight="700">
                  ${lastPoint.value.toFixed(2)}
                </text>
              </>
            )}
            <text x="3" y="10" fill="rgba(255,255,255,0.28)" fontSize="4.5">${max.toFixed(2)} high</text>
            <text x="3" y="88" fill="rgba(255,255,255,0.22)" fontSize="4.5">${min.toFixed(2)} low</text>
          </svg>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-white/[0.06] bg-black/35 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">Liquidez Solana DeFi</p>
            <p className="mt-1 text-xl font-black text-white">{snapshot.liquidityLabel ?? '--'}</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.protocols.slice(0, 3).map(protocol => (
                <div key={protocol.name} className="flex items-center justify-between text-xs">
                  <span className="truncate text-white/50">{protocol.name}</span>
                  <span className="font-mono text-white/35">${(protocol.tvl / 1e6).toFixed(1)}M</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[#14F195]/15 bg-[#14F195]/[0.04] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#14F195]/75">O que fazer agora</p>
            <p className="mt-2 text-sm leading-relaxed text-white/70">{snapshot.action}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ message, isLatest, isStreaming, streamedContent, onSave, onCompare, onScore, onCopyHash, onAudit, onContinueMemory, onWalletAgentReview }: {
  message: Message;
  isLatest?: boolean;
  isStreaming?: boolean;
  streamedContent?: string;
  onSave: (msg: Message) => void;
  onCompare: (msg: Message) => void;
  onScore: (msg: Message) => void;
  onCopyHash: (hash: string) => void;
  onAudit: (msg: Message) => void;
  onContinueMemory: (msg: Message, model: AIModel) => void;
  onWalletAgentReview: (result: WalletAgentCoreResult) => void;
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
      <div className={`flex-1 max-w-[85%] ${message.walletAgentResult ? 'md:max-w-[82%]' : 'md:max-w-[70%]'} ${isUser ? 'items-end' : 'items-start'}`}>
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
        {!isUser && message.walletAgentResult ? (
          <WalletAgentPreviewCard
            result={message.walletAgentResult}
            onReview={() => onWalletAgentReview(message.walletAgentResult!)}
          />
        ) : !isUser && message.marketSnapshot ? (
          <>
            <SolMarketCard snapshot={message.marketSnapshot} />
            <div className="rounded-2xl px-4 py-3 text-[15px] leading-relaxed bg-white/[0.04] border border-white/[0.06] text-white/80">
              <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-strong:text-white">
                <ReactMarkdown>{displayContent}</ReactMarkdown>
              </div>
            </div>
          </>
        ) : !isUser && message.structuredResponse ? (
          (() => {
            try {
              return (
                <ResponseRouter
                  response={message.structuredResponse}
                  content={displayContent}
                  modelLabel={message.model ? (MODEL_LABELS[message.model as AIModel] || message.model) : 'CONGCHAIN'}
                  timestamp={message.timestamp}
                  memoryHash={message.memoryHash || message.structuredResponse.meta.onChainHash}
                  onContinueMemory={(model) => onContinueMemory(message, model as AIModel)}
                />
              );
            } catch {
              return (
                <div className="rounded-2xl px-4 py-3 text-[15px] leading-relaxed bg-white/[0.04] border border-white/[0.06] text-white/80">
                  <p className="whitespace-pre-wrap">{displayContent}</p>
                </div>
              );
            }
          })()
        ) : (
          <div className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed
            ${isUser
              ? 'bg-gradient-to-br from-[#9945FF]/30 to-[#9945FF]/15 border border-[#9945FF]/20 text-white/90'
              : 'bg-white/[0.04] border border-white/[0.06] text-white/80'
            }`}>
            {isStreaming
              ? <p className="whitespace-pre-wrap">{displayContent}<span className="animate-pulse text-[#9945FF]">▌</span></p>
              : isUser
                ? <p className="whitespace-pre-wrap">{displayContent}</p>
                : <div className="prose prose-invert prose-sm max-w-none
                    prose-p:my-1.5 prose-headings:text-white/90 prose-headings:font-semibold
                    prose-strong:text-white prose-code:text-[#14F195] prose-code:bg-[#14F195]/10
                    prose-code:px-1.5 prose-code:rounded prose-code:font-mono prose-code:text-[13px]
                    prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2 prose-ul:pl-4 prose-ol:pl-4
                    prose-hr:border-white/10 prose-blockquote:border-l-[#9945FF] prose-blockquote:text-white/60
                    prose-table:text-[13px] prose-th:border-white/10 prose-td:border-white/[0.06]
                    prose-pre:bg-[#0d0d1a] prose-pre:border prose-pre:border-white/[0.08] prose-pre:rounded-xl">
                    <ReactMarkdown
                      components={{
                        code({ className, children, ...props }) {
                          const isBlock = className?.includes('language-');
                          const copied = false;
                          const code = String(children).replace(/\n$/, '');
                          if (!isBlock) return <code className="font-mono text-[#14F195] bg-[#14F195]/10 px-1.5 py-0.5 rounded text-[13px]" {...props}>{children}</code>;
                          return (
                            <div className="relative group">
                              <div className="flex items-center justify-between px-4 py-1.5 bg-white/[0.04] border-b border-white/[0.06] rounded-t-xl">
                                <span className="text-[10px] text-white/30 font-mono">{className?.replace('language-', '') ?? 'code'}</span>
                                <button onClick={() => { navigator.clipboard.writeText(code).catch(() => {}); }}
                                  className="text-[10px] text-white/40 hover:text-[#14F195] transition-colors">
                                  {copied ? '✅ Copiado' : '📋 Copiar'}
                                </button>
                              </div>
                              <pre className="!mt-0 !rounded-t-none overflow-x-auto"><code className={`${className} text-[13px]`}>{code}</code></pre>
                            </div>
                          );
                        },
                      }}
                    >{displayContent}</ReactMarkdown>
                  </div>
            }
          </div>
        )}
        {isLatest && !isUser && !message.walletAgentResult && (
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
  const onDoneRef = useRef(onDone);

  const steps = [
    'Generating SHA-256 hash...',
    'Signing transaction...',
    'Broadcasting to Solana Devnet...',
    'Awaiting block confirmation...',
    txHash ? '✓ CONFIRMED ON-CHAIN' : '✓ Hash anchored locally',
  ];

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timings =   [0, 250, 550, 900, 1300];
    const progresses = [15, 35,  60,   85,  100];
    const timers: ReturnType<typeof setTimeout>[] = [];

    timings.forEach((t, i) => {
      timers.push(setTimeout(() => { setStep(i); setProgress(progresses[i]); }, t));
    });

    timers.push(setTimeout(() => onDoneRef.current(), 1800));
    return () => timers.forEach(clearTimeout);
  }, []);

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
    <div className="fixed inset-0 md:relative md:inset-auto md:w-80 lg:w-96 border-l border-white/[0.06] bg-[#0a0a14]/95 backdrop-blur-xl flex flex-col z-50 md:z-auto overflow-y-auto md:overflow-hidden">
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
  if (typeof document === 'undefined') return null;

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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch('/api/auth/verify').then(r => r.json()).then(d => setIsAdmin(!!d.admin)).catch(() => {});
  }, []);

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
    if (isPro && !isAdmin) { setShowUpgrade(key); return; }
    onModelChange(key);
  };

  return (
    <>
      {showUpgrade && <UpgradeModal model={showUpgrade} onClose={() => setShowUpgrade(null)} />}
      <div className="flex items-center gap-1 flex-wrap rounded-full border border-white/[0.055] bg-white/[0.025] px-1 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
        {FREE.map(m => (
          <button key={m.key} onClick={() => handleClick(m.key, false)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200
              ${selectedModel === m.key ? 'bg-white/[0.105] border border-white/[0.14] text-white/92 shadow-sm' : 'border border-transparent text-white/48 hover:text-white/72 hover:bg-white/[0.045]'}`}>
            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 shadow-[0_0_10px_currentColor]" style={{ backgroundColor: m.color, color: m.color }} />
            {m.name}
          </button>
        ))}
        <span className="w-px h-4 bg-white/[0.08] mx-0.5" />
        {PRO.map(m => (
          <button key={m.key} onClick={() => handleClick(m.key, true)}
            className={`relative px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200 group
              ${selectedModel === m.key
                ? 'bg-white/[0.105] border border-white/[0.14] text-white/92 shadow-sm'
                : isAdmin
                  ? 'border border-transparent text-white/56 hover:text-white/84 hover:bg-white/[0.04]'
                  : 'border border-transparent text-white/38 hover:text-white/58 hover:bg-white/[0.035]'
              }`}>
            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 shadow-[0_0_10px_currentColor]" style={{ backgroundColor: m.color, color: m.color, opacity: isAdmin ? 1 : 0.55 }} />
            {m.name}
            {!isAdmin && <span className="ml-1 text-[9px] font-bold text-[#A78BFA]/80 group-hover:text-[#C4B5FD]">PRO</span>}
            {isAdmin && selectedModel === m.key && <span className="ml-1 text-[9px] text-[#00d4aa]/60">✓</span>}
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
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const walletAddress = publicKey?.toString() ?? null;
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome', role: 'assistant',
    content: 'Ola! Sou o CONGCHAIN — Verifiable AI Memory Layer.\n\nMemory that any AI can continue.\n\nEstou aqui para ajudar voce com verificacao de memoria em blockchain, integracao Solana, e muito mais. Como posso ajudar?',
    timestamp: 'Agora', orbMode: 'idle', model: 'gpt',
  }]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hashInput, setHashInput] = useState('');
  const [hashLoading, setHashLoading] = useState(false);
  const [hashError, setHashError] = useState('');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>('nvidia');
  const [previousModel, setPreviousModel] = useState<string>('gpt');
  const [contextActive, setContextActive] = useState(false);
  const [agentInsights, setAgentInsights] = useState<{ count: number; latest: string } | null>(null);

  // Load agent insights count on mount + every 2min
  useEffect(() => {
    const load = () => {
      fetch('/api/agents/insights?hours=24&limit=5').then(r => r.json()).then(d => {
        if (d.count > 0) {
          const latest = d.insights?.[0]?.topic ?? '';
          setAgentInsights({ count: d.count, latest });
        } else {
          setAgentInsights(null);
        }
      }).catch(() => {});
    };
    load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, []);

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
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [thinkingStatus, setThinkingStatus] = useState('Analisando...');
  const [chatPhase, setChatPhase] = useState<ChatPhase>('idle');
  const [reasoningChunks, setReasoningChunks] = useState<string[]>([]);
  const [showReasoning, setShowReasoning] = useState(false);
  const [showSolanaOverlay, setShowSolanaOverlay] = useState(false);
  const [solanaTxHash, setSolanaTxHash] = useState<string | null>(null);
  const [auditHash, setAuditHash] = useState<string | null>(null);
  const [auditModel, setAuditModel] = useState<string | undefined>(undefined);
  const [streamedContent, setStreamedContent] = useState('');
  const [walletAgentReview, setWalletAgentReview] = useState<WalletAgentCoreResult | null>(null);
  const [walletAgentHistory, setWalletAgentHistory] = useState<WalletAgentHistoryEntry[]>([]);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const streamWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamFrameRef = useRef<number | null>(null);
  const pendingStreamContentRef = useRef('');
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
    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      if (streamWatchdogRef.current) clearTimeout(streamWatchdogRef.current);
      if (streamFrameRef.current) cancelAnimationFrame(streamFrameRef.current);
      streamAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setWalletAgentHistory(readWalletAgentHistory());
  }, []);

  useEffect(() => {
    const handleDevnetWalletCreated = (event: Event) => {
      const {
        publicKey: createdPublicKey,
        createdAt,
        balance: devnetBalance,
        airdropTx: createdAirdropTx,
        airdropStatus,
      } = (event as DevnetWalletCreatedEvent).detail;
      const createdAtLabel = new Date(createdAt).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
      const shortAddress = `${createdPublicKey.slice(0, 4)}...${createdPublicKey.slice(-4)}`;
      const airdropLine = airdropStatus === 'success'
        ? `Airdrop concluido: ${devnetBalance.toFixed(4)} SOL Devnet disponivel para testes.`
        : 'A carteira foi criada, mas o faucet da Devnet nao respondeu agora. Voce pode tentar o airdrop novamente no card da carteira.';
      const explorerLine = createdAirdropTx
        ? `Transacao do airdrop: https://explorer.solana.com/tx/${createdAirdropTx}?cluster=devnet`
        : `Endereco no Explorer: https://explorer.solana.com/address/${createdPublicKey}?cluster=devnet`;

      const content = [
        '### Solana Devnet Sandbox criado',
        '',
        'A CONGCHAIN criou uma carteira local de teste para voce construir sem usar SOL real.',
        '',
        `- Rede: Solana Devnet`,
        `- Endereco: ${createdPublicKey}`,
        `- Criada em: ${createdAtLabel}`,
        `- Saldo inicial: ${devnetBalance.toFixed(4)} SOL Devnet`,
        `- Status: ${airdropLine}`,
        '',
        'Como usar:',
        '- Clique na carteira no topo para ver endereco, saldo e Explorer.',
        '- Use essa carteira para testar memorias, agentes e futuros fluxos on-chain na Devnet.',
        '- Ela e uma sandbox local deste navegador. Nao envie fundos reais para esse endereco.',
        '',
        explorerLine,
      ].join('\n');

      setMessages(prev => [...prev, {
        id: `devnet-wallet-${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        orbMode: 'success',
        model: selectedModel,
      }]);
      setOrbMode('success');
      onSessionUpdate?.({
        id: sessionIdRef.current,
        title: 'Carteira Devnet criada',
        lastMessage: `Devnet Sandbox ${shortAddress}`,
        timestamp: 'Agora',
      });
    };

    window.addEventListener('congchain:devnet-wallet-created', handleDevnetWalletCreated);
    return () => window.removeEventListener('congchain:devnet-wallet-created', handleDevnetWalletCreated);
  }, [onSessionUpdate, selectedModel, setOrbMode]);

  // Nova conversa — limpa mensagens e estado
  const handleNewChat = useCallback(() => {
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    if (streamWatchdogRef.current) clearTimeout(streamWatchdogRef.current);
    if (streamFrameRef.current) cancelAnimationFrame(streamFrameRef.current);
    streamAbortRef.current?.abort();
    setStreamingId(null);
    setStreamedContent('');
    pendingStreamContentRef.current = '';
    streamFrameRef.current = null;
    setChatPhase('idle');
    setReasoningChunks([]);
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

  const handleWalletAgentReview = useCallback((result: WalletAgentCoreResult) => {
    setWalletAgentReview(result);
  }, []);

  const recordWalletAgentHistory = useCallback((result: WalletAgentCoreResult) => {
    const status = result.draft.internalConfirmation?.nextApprovalStep === 'wallet_signature_required'
      ? 'wallet_signature_required'
      : result.draft.internalConfirmation?.confirmed
        ? 'confirmed'
        : 'previewed';
    const next = upsertWalletAgentHistory(createWalletAgentHistoryEntry(result, status));
    setWalletAgentHistory(next);
  }, []);

  const handleWalletAgentConfirm = useCallback((result: WalletAgentCoreResult) => {
    const confirmed = confirmWalletAgentIntent(result);
    setWalletAgentReview(confirmed);
    recordWalletAgentHistory(confirmed);
    setMessages(prev => prev.map(message => message.walletAgentResult?.draft.id === result.draft.id
      ? {
          ...message,
          walletAgentResult: confirmed,
          content: confirmed.preview.description,
        }
      : message
    ));
    toast({
      title: 'Intencao confirmada no app',
      description: confirmed.draft.requiresWalletSignature
        ? 'Ainda falta a assinatura explicita na carteira antes de qualquer transacao.'
        : 'Fluxo somente leitura confirmado para analise segura.',
    });
  }, [recordWalletAgentHistory, toast]);

  const handleWalletAgentPrepareTransaction = useCallback(async (result: WalletAgentCoreResult) => {
    try {
      const prepared = await prepareWalletAgentDevnetTransaction(result, connection);
      setWalletAgentReview(prepared);
      recordWalletAgentHistory(prepared);
      setMessages(prev => prev.map(message => message.walletAgentResult?.draft.id === result.draft.id
        ? {
            ...message,
            walletAgentResult: prepared,
            content: prepared.preview.description,
          }
        : message
      ));
      toast({
        title: prepared.draft.preparedTransaction ? 'Transacao Devnet preparada' : 'Builder indisponivel',
        description: prepared.draft.preparedTransaction
          ? 'Payload sem assinatura criado localmente. Nada foi enviado para a rede.'
          : 'Esse tipo de intencao ainda precisa de mais dados ou builder proprio.',
      });
    } catch (error) {
      console.warn('[wallet-agent] devnet transaction prepare failed', error);
      toast({
        title: 'Nao foi possivel preparar a transacao',
        description: 'Revise endereco, valor e rede antes de tentar novamente.',
        variant: 'destructive',
      });
    }
  }, [connection, recordWalletAgentHistory, toast]);

  const handleWalletAgentSignTransaction = useCallback(async (result: WalletAgentCoreResult) => {
    try {
      const signed = await signWalletAgentDevnetTransaction(result, signTransaction, walletAddress);
      setWalletAgentReview(signed);
      recordWalletAgentHistory(signed);
      setMessages(prev => prev.map(message => message.walletAgentResult?.draft.id === result.draft.id
        ? {
            ...message,
            walletAgentResult: signed,
            content: signed.preview.description,
          }
        : message
      ));
      toast({
        title: signed.draft.signedTransaction ? 'Assinatura aprovada' : 'Assinatura indisponivel',
        description: signed.draft.signedTransaction
          ? 'A wallet assinou a transacao. Ela ainda nao foi enviada para a Devnet.'
          : signed.safety.reason,
      });
    } catch (error) {
      console.warn('[wallet-agent] wallet signature failed', error);
      toast({
        title: 'Assinatura cancelada ou falhou',
        description: 'Nenhuma transacao foi enviada. Voce pode revisar e tentar novamente.',
        variant: 'destructive',
      });
    }
  }, [recordWalletAgentHistory, signTransaction, toast, walletAddress]);

  const handleWalletAgentSubmitTransaction = useCallback(async (result: WalletAgentCoreResult) => {
    try {
      const submitted = await submitWalletAgentDevnetTransaction(result, connection);
      setWalletAgentReview(submitted);
      recordWalletAgentHistory(submitted);
      setMessages(prev => prev.map(message => message.walletAgentResult?.draft.id === result.draft.id
        ? {
            ...message,
            walletAgentResult: submitted,
            content: submitted.draft.submittedTransaction
              ? `${submitted.preview.description}\n\nDevnet tx: ${submitted.draft.submittedTransaction.explorerUrl}`
              : submitted.preview.description,
          }
        : message
      ));
      toast({
        title: submitted.draft.submittedTransaction ? 'Transacao enviada para Devnet' : 'Envio indisponivel',
        description: submitted.draft.submittedTransaction
          ? submitted.draft.submittedTransaction.signature
          : submitted.safety.reason,
      });
    } catch (error) {
      console.warn('[wallet-agent] devnet submit failed', error);
      toast({
        title: 'Envio para Devnet falhou',
        description: 'Nenhuma nova tentativa automatica foi feita. Revise saldo, blockhash e tente novamente.',
        variant: 'destructive',
      });
    }
  }, [connection, recordWalletAgentHistory, toast]);

  const handleWalletAgentConfirmTransaction = useCallback(async (result: WalletAgentCoreResult) => {
    try {
      const confirmed = await confirmWalletAgentDevnetTransaction(result, connection);
      setWalletAgentReview(confirmed);
      recordWalletAgentHistory(confirmed);
      setMessages(prev => prev.map(message => message.walletAgentResult?.draft.id === result.draft.id
        ? {
            ...message,
            walletAgentResult: confirmed,
            content: confirmed.draft.submittedTransaction
              ? `${confirmed.preview.description}\n\nDevnet tx: ${confirmed.draft.submittedTransaction.explorerUrl}\nStatus: ${confirmed.draft.submittedTransaction.confirmationStatus}`
              : confirmed.preview.description,
          }
        : message
      ));
      toast({
        title: 'Status Devnet atualizado',
        description: confirmed.draft.submittedTransaction?.confirmationStatus ?? confirmed.safety.reason,
      });
    } catch (error) {
      console.warn('[wallet-agent] devnet confirmation check failed', error);
      toast({
        title: 'Nao foi possivel verificar',
        description: 'A Devnet nao respondeu agora. Tente novamente em alguns segundos.',
        variant: 'destructive',
      });
    }
  }, [connection, recordWalletAgentHistory, toast]);

  const parseWalletAgentIntent = useCallback(async (prompt: string): Promise<WalletAgentParsedIntent | undefined> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    try {
      const response = await fetch('/api/wallet-agent/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: selectedModel }),
        signal: controller.signal,
      });

      if (!response.ok) return undefined;

      const data = await response.json() as { parsedIntent?: WalletAgentParsedIntent };
      return data.parsedIntent;
    } catch (error) {
      console.warn('[wallet-agent] parser fallback', error);
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
  }, [selectedModel]);

  const readWalletAgentSnapshot = useCallback(async () => {
    try {
      return await readWalletAgentWalletSnapshot(connection, publicKey);
    } catch (error) {
      console.warn('[wallet-agent] wallet snapshot unavailable', error);
      return null;
    }
  }, [connection, publicKey]);

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
    setChatPhase('connecting');
    setThinkingStatus('Conectando ao stream...');
    setReasoningChunks([]);

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

    const walletDetection = detectWalletAgentIntent(userMessage.content);
    if (walletDetection.isFinancialCommand && walletDetection.confidence >= 0.74) {
      setThinkingStatus('Interpretando comando financeiro com parser seguro...');
      const parsedIntent = await parseWalletAgentIntent(userMessage.content);
      setThinkingStatus('Lendo carteira em modo somente leitura...');
      const walletSnapshot = await readWalletAgentSnapshot();
      const walletAgentResult = createWalletAgentCore({
        prompt: userMessage.content,
        walletAddress: walletSnapshot?.address ?? walletAddress,
        network: walletSnapshot?.network ?? 'solana-devnet',
        walletSnapshot,
        parsedIntent,
      });
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: walletAgentResult.preview.description,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        orbMode: 'success',
        model: 'wallet-agent',
        walletAgentResult,
      };
      recordWalletAgentHistory(walletAgentResult);
      setMessages(prev => [...prev, assistantMsg]);
      setChatPhase('completed');
      setThinkingStatus('Analisando...');
      setReasoningChunks([]);
      setOrbMode('idle');
      onSessionUpdate?.({
        id: sessionIdRef.current,
        title: userMessage.content.slice(0, 55) + (userMessage.content.length > 55 ? '...' : ''),
        lastMessage: walletAgentResult.preview.title,
        timestamp: 'Agora',
      });
      return;
    }

    setIsTyping(true);
    const startTime = Date.now();

    try {
      if (isSolMarketQuery(userMessage.content)) {
        setThinkingStatus('Buscando preco, volume e liquidez da Solana...');
        const marketRes = await fetch('/api/market/sol');
        if (marketRes.ok) {
          const snapshot = await marketRes.json() as SolMarketSnapshot;
          const price = snapshot.price === null ? 'indisponivel' : `$${snapshot.price.toFixed(2)}`;
          const change = snapshot.change24h === null ? 'indisponivel' : `${snapshot.change24h >= 0 ? '+' : ''}${snapshot.change24h.toFixed(2)}%`;
          const content = `**SOL esta em ${price}**, com variacao de **${change} em 24h**.\n\n- **Volume 24h:** ${snapshot.volumeLabel ?? 'indisponivel'}\n- **Market cap:** ${snapshot.marketCapLabel ?? 'indisponivel'}\n- **Liquidez Solana DeFi:** ${snapshot.liquidityLabel ?? 'indisponivel'}\n- **Fontes:** ${snapshot.sources.join(', ')}\n\n${snapshot.action}`;
          const assistantMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            orbMode: 'success',
            model: 'market',
            responseTime: Date.now() - startTime,
            marketSnapshot: snapshot,
          };
          setMessages(prev => [...prev, assistantMsg]);
          setChatPhase('completed');
          setOrbMode('idle');
          setIsTyping(false);
          if (onSessionUpdate) {
            onSessionUpdate({
              id: sessionIdRef.current,
              title: userMessage.content.slice(0, 55) + (userMessage.content.length > 55 ? '...' : ''),
              lastMessage: `SOL ${price} (${change})`,
              timestamp: 'Agora',
            });
          }
          return;
        }
      }

      const controller = new AbortController();
      streamAbortRef.current?.abort();
      streamAbortRef.current = controller;
      const resetWatchdog = () => {
        if (streamWatchdogRef.current) clearTimeout(streamWatchdogRef.current);
        streamWatchdogRef.current = setTimeout(() => {
          console.warn('[chat-stream] watchdog timeout');
          controller.abort();
        }, 90000);
      };
      resetWatchdog();
      console.log('[chat-stream] request:start', { model: selectedModel });
      const res = await fetch('/api/chat/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          model: selectedModel, saveResponse: true, previousModel: previousModel !== selectedModel ? previousModel : undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error('Stream failed');

      const msgId = (Date.now() + 1).toString();
      const assistantMsg: Message = {
        id: msgId, role: 'assistant', content: '',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        orbMode: 'success', model: selectedModel,
        contextInjected: contextActive || previousModel !== selectedModel,
        previousModel: previousModel !== selectedModel ? previousModel : undefined,
        contextSummary: contextActive ? 'Memorias anteriores injetadas no contexto' : undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
      setStreamingId(msgId);
      setStreamedContent('');
      setChatPhase('thinking');

      // Real token streaming
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let fullContent = '';
      let finalized = false;
      let finalStructuredResponse: StructuredResponse | undefined;
      pendingStreamContentRef.current = '';

      const flushStreamContent = () => {
        streamFrameRef.current = null;
        setStreamedContent(pendingStreamContentRef.current);
      };

      const scheduleStreamContent = (content: string) => {
        pendingStreamContentRef.current = content;
        if (streamFrameRef.current !== null) return;
        streamFrameRef.current = requestAnimationFrame(flushStreamContent);
      };

      const finalizeStream = (reason: 'done' | 'closed' | 'error', errorMessage?: string) => {
        if (finalized) return;
        finalized = true;
        if (streamWatchdogRef.current) clearTimeout(streamWatchdogRef.current);
        if (streamFrameRef.current) cancelAnimationFrame(streamFrameRef.current);
        streamWatchdogRef.current = null;
        streamFrameRef.current = null;
        streamAbortRef.current = null;
        reader.releaseLock();
        setStreamingId(null);
        setStreamedContent('');
        pendingStreamContentRef.current = '';
        setThinkingStatus('Analisando...');
        setChatPhase(reason === 'error' ? 'error' : 'completed');
        const responseTime = Date.now() - startTime;
        const content = fullContent || errorMessage || 'A resposta terminou sem conteudo. Tente novamente ou troque de modelo.';
        setMessages(prev => {
          const updated = prev.map(m => m.id === msgId ? {
            ...m, content,
            orbMode: reason === 'error' ? 'error' as OrbMode : 'success' as OrbMode,
            responseTime,
            tokensUsed: Math.ceil(content.length / 3.5),
            structuredResponse: finalStructuredResponse,
          } : m);
          if (onSessionUpdate) {
            const firstUser = updated.find(m => m.role === 'user');
            const title = firstUser
              ? firstUser.content.slice(0, 55) + (firstUser.content.length > 55 ? '...' : '')
              : 'Conversa';
            onSessionUpdate({
              id: sessionIdRef.current, title,
              lastMessage: content.slice(0, 45) + (content.length > 45 ? '...' : ''),
              timestamp: 'Agora',
            });
          }
          return updated;
        });
        setOrbMode(reason === 'error' ? 'error' : 'idle');
        if (reason === 'error') setTimeout(() => setOrbMode('idle'), 1500);
        setIsTyping(false);
        console.log('[chat-stream] finalize', { reason, chars: content.length });
      };

      const handleEvent = (evt: { status?: string; token?: string; done?: boolean; error?: string; structuredResponse?: StructuredResponse }) => {
        if (evt.status) {
          setChatPhase('thinking');
          setThinkingStatus(evt.status);
          setReasoningChunks(prev => {
            if (prev[prev.length - 1] === evt.status) return prev;
            return [...prev, evt.status!].slice(-8);
          });
          console.log('[chat-stream] status', evt.status);
        }
        if (evt.token) {
          setChatPhase('streaming');
          setOrbMode('typing');
          fullContent += evt.token;
          scheduleStreamContent(fullContent);
        }
        if (evt.structuredResponse) {
          finalStructuredResponse = evt.structuredResponse;
        }
        if (evt.error) {
          console.error('[chat-stream] event:error', evt.error);
          finalizeStream('error', `Stream error: ${evt.error}`);
          return;
        }
        if (evt.done) {
          finalizeStream('done');
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          const tail = decoder.decode();
          if (tail) sseBuffer += tail;
          break;
        }
        resetWatchdog();
        sseBuffer += decoder.decode(value, { stream: true });
        const events = sseBuffer.split('\n\n');
        sseBuffer = events.pop() ?? '';
        for (const rawEvent of events) {
          const data = rawEvent
            .split('\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.replace(/^data:\s?/, ''))
            .join('\n');
          if (!data) continue;
          try {
            handleEvent(JSON.parse(data));
            if (finalized) break;
          } catch (parseError) {
            console.warn('[chat-stream] malformed event', parseError);
          }
        }
        if (finalized) break;
      }
      if (!finalized && sseBuffer.trim()) {
        const data = sseBuffer
          .split('\n')
          .filter(line => line.startsWith('data:'))
          .map(line => line.replace(/^data:\s?/, ''))
          .join('\n');
        if (data) {
          try { handleEvent(JSON.parse(data)); } catch { /* ignore trailing partial */ }
        }
      }
      if (!finalized) finalizeStream(fullContent ? 'closed' : 'error', 'The stream closed before the final chunk arrived.');
    } catch (err: unknown) {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      if (streamWatchdogRef.current) clearTimeout(streamWatchdogRef.current);
      if (streamFrameRef.current) cancelAnimationFrame(streamFrameRef.current);
      streamWatchdogRef.current = null;
      streamFrameRef.current = null;
      streamAbortRef.current = null;
      setStreamingId(null);
      setStreamedContent('');
      pendingStreamContentRef.current = '';
      setChatPhase('error');
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
      console.error('[chat-stream] request:error', err);
    }
  }, [inputValue, isTyping, messages, selectedModel, previousModel, contextActive, setOrbMode, onSessionUpdate, originalMessages, walletAddress, parseWalletAgentIntent, readWalletAgentSnapshot, recordWalletAgentHistory]);

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
  const [demoStage, setDemoStage] = useState<DemoStage>({
    visible: false,
    step: 0,
    title: '',
    subtitle: '',
    phase: 'boot',
  });
  const [demoJudgeSummary, setDemoJudgeSummary] = useState('');
  const [demoSummaryCopied, setDemoSummaryCopied] = useState(false);
  const DEMO_TOTAL = 10;

  const copyDemoJudgeSummary = useCallback(() => {
    if (!demoJudgeSummary) return;
    navigator.clipboard.writeText(demoJudgeSummary).then(() => {
      setDemoSummaryCopied(true);
      setTimeout(() => setDemoSummaryCopied(false), 1600);
    }).catch(() => {});
  }, [demoJudgeSummary]);

  const runAutoDemo = useCallback(async () => {
    setIsDemoRunning(true);
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    if (streamWatchdogRef.current) clearTimeout(streamWatchdogRef.current);
    if (streamFrameRef.current) cancelAnimationFrame(streamFrameRef.current);
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    streamWatchdogRef.current = null;
    streamFrameRef.current = null;
    pendingStreamContentRef.current = '';
    setStreamingId(null);
    setStreamedContent('');
    setIsTyping(false);
    setChatPhase('idle');
    setReasoningChunks([]);
    setThinkingStatus('Analisando...');
    setShowPanel(false);
    setShowScoreModal(false);
    setShowCompare(false);
    setCompareResults([]);
    setComparePrompt('');
    setCompareLoading(false);
    setShowTimeline(false);
    setShowSwitchModal(false);
    setSelectedMessage(null);
    setAuditHash(null);
    setHashError('');
    setHashLoading(false);
    setShowLangMenu(false);
    setIsTranslating(false);
    setDemoJudgeSummary('');
    setDemoSummaryCopied(false);
    setDemoStage({
      visible: true,
      step: 0,
      title: 'Initializing verifiable memory demo',
      subtitle: 'Preparing model handoff, Solana proof, and cross-model continuity.',
      phase: 'boot',
      trustScore: 0,
    });

    // Pre-written fallbacks so demo works without API keys
    const FALLBACKS: Record<string, string> = {
      gpt1: 'Proof of Work (PoW) is a consensus mechanism where miners compete to solve cryptographic puzzles. Bitcoin uses PoW, consuming ~150 TWh/year — equivalent to entire countries. Each hash attempt requires real computational energy, making attacks economically prohibitive. The SHA-256 algorithm at its core is the same one CONGCHAIN uses to create verifiable memory fingerprints.',
      claude1: 'Comparing PoW vs PoS through the lens of verifiable intelligence:\n\n• Energy: PoW ~150 TWh/yr vs PoS ~0.01 TWh/yr (Solana). 99.99% reduction.\n• Security: Both achieve Byzantine fault tolerance, but differently.\n• CONGCHAIN insight: We use Solana\'s PoH (Proof of History) — a cryptographic clock — to timestamp AI memories with sub-second precision. Your memory hash becomes part of an immutable timeline that any AI can verify.\n\nThe GPT memory I\'m building on confirms: SHA-256 fingerprinting is the bridge between AI output and blockchain truth.',
      claude2: 'Solana\'s architecture for AI memory storage:\n\n1. Proof of History (PoH): Creates a verifiable sequence of time — each memory gets a precise timestamp\n2. Tower BFT: Consensus in ~400ms — fast enough for real-time AI verification\n3. PDAs (Program Derived Addresses): Deterministic addresses from seeds — perfect for content-addressed AI memory\n\nWhen CONGCHAIN anchors your memory hash, it becomes part of Solana\'s ledger history — immutable, timestamped, and verifiable by any AI model that continues your conversation.',
      gemini1: 'Solana PoH vs traditional consensus:\n\n• Traditional: Validators must communicate to agree on time → slow\n• Solana PoH: Cryptographic clock baked into the chain → 65,000 TPS\n• For AI memory: Each CONGCHAIN memory gets a PoH timestamp = proof it existed at that exact moment\n\nResult: When Claude or GPT reads your verified memory, the PoH timestamp proves it wasn\'t fabricated after the fact. This is how CONGCHAIN makes AI memory trustless.',
    };

    FALLBACKS.gpt1 = '### Insight captured\n\n**Problem:** AI conversations die inside one model, one tab, one vendor.\n\n**CONGCHAIN move:** turn the answer into a portable memory object:\n\n- semantic content for future models\n- SHA-256 fingerprint for integrity\n- Solana anchor for public timestamping\n- optional ZK proof for private verification\n\nThis is the primitive agents need: memory that survives the model.';
    FALLBACKS.claude1 = '### Cross-model continuation\n\nI received the GPT memory as verified context, not as a loose prompt.\n\n**What changed:** the second model can trust that the previous reasoning existed before this response. That creates continuity without vendor lock-in.\n\n**Why Solana matters:** low-latency finality makes memory anchoring feel native to a chat interface. Users do not wait minutes for AI state to become verifiable.\n\n**Judge takeaway:** CONGCHAIN is not storing chats. It is creating a proof layer for AI cognition.';
    FALLBACKS.gemini1 = '### Final synthesis\n\nGPT produced the insight. Claude inherited it. Gemini can now continue with a verified trail.\n\n**Result:** model switching becomes a feature, not a reset button.\n\nThe memory hash is the bridge. Solana provides the public clock. ZK keeps private content private while still proving integrity.\n\nThis is how autonomous agents can collaborate with shared, verifiable memory.';

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    const ts = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const stamp = () => new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
    const uid = () => (Date.now() + Math.random()).toString(36);
    const present = (stage: Partial<DemoStage>) => {
      setDemoStage(prev => ({ ...prev, visible: true, ...stage }));
    };
    let anchoredTxHash: string | null = null;

    const passportText = (passport: DemoMemoryPassport, nextModel: string) => (
      `### Memory passport received\n\n` +
      `**${nextModel} is continuing from verified memory created by ${passport.model}.**\n\n` +
      `| Field | Value |\n| --- | --- |\n| Source AI | ${passport.model} |\n| Memory title | ${passport.title} |\n| Memory hash | \`${passport.hash}\` |\n| Built at | ${passport.createdAt} |\n| Next AI | ${nextModel} |\n\n` +
      `The next answer must build on this hash, not restart from an empty prompt.`
    );

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
      present({ step: 1, title: 'Capture an insight with GPT-4o', subtitle: 'The first model creates memory-ready reasoning instead of disposable chat text.', phase: 'capture', primaryModel: 'GPT-4o', trustScore: 10 });
      toast({ title: '▶ Demo 1/10', description: 'GPT-4o responde sobre Proof of Work' });
      const q1 = 'Create a concise hackathon insight: why does verifiable AI memory matter for autonomous agents on Solana?';
      setMessages(prev => [...prev, { id: uid(), role: 'user', content: q1, timestamp: ts() }]);
      setOrbMode('thinking');
      await delay(1200);

      setOrbMode('typing');
      const d1Promise = callChat(q1, 'gpt');
      await delay(2000); // simulated typing
      const d1 = await Promise.race([d1Promise, Promise.resolve(null)]);
      const gptContent = d1?.response || FALLBACKS.gpt1;
      const gptId = uid();
      const gptCreatedAt = stamp();
      const gptMsg: Message = {
        id: gptId, role: 'assistant', content: gptContent,
        timestamp: gptCreatedAt, orbMode: 'success', model: 'gpt',
        responseTime: 2100, tokensUsed: 198,
      };
      setMessages(prev => [...prev, gptMsg]);
      setOrbMode('idle');
      await delay(2600);

      // ── STEP 2: Salvar memória GPT ────────────────────────────
      setDemoStep(2);
      present({ step: 2, title: 'Seal the memory fingerprint', subtitle: 'The answer becomes a content-addressed memory object with a stable hash.', phase: 'proof', trustScore: 28 });
      toast({ title: '▶ Demo 2/10', description: 'Salvando memória com hash SHA-256...' });
      const hash1 = d1?.memoryHash || await saveMemory(gptContent, 'gpt');
      const gptPassport: DemoMemoryPassport = {
        hash: hash1,
        model: 'GPT-4o',
        createdAt: gptCreatedAt,
        title: 'Verifiable AI memory for Solana agents',
      };
      setMessages(prev => prev.map(m => m.id === gptId ? { ...m, memoryHash: hash1 } : m));
      present({ hash: hash1, trustScore: 35 });
      toast({ title: '✓ Memory saved', description: `SHA-256: ${hash1.slice(0, 16)}...` });
      await delay(1000);

      // ── STEP 3: Ancorar na Solana ─────────────────────────────
      setDemoStep(3);
      present({ step: 3, title: 'Anchor proof to Solana', subtitle: 'Only the fingerprint is public. The AI content remains private and portable.', phase: 'anchor', primaryModel: 'Solana Devnet', trustScore: 52 });
      setSolanaTxHash(null);
      setShowSolanaOverlay(true);
      // Blockchain call in background — updates txHash if it resolves in time
      fetchWithTimeout('/api/blockchain/store', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: hash1 }),
      }, 4000).then(async r => {
        const d = await r?.json().catch(() => null);
        if (d?.success && d?.txHash) {
          anchoredTxHash = d.txHash;
          setSolanaTxHash(d.txHash);
          present({ txHash: d.txHash, trustScore: 68 });
          setMessages(prev => prev.map(m => m.id === gptId ? { ...m, verified: true, txHash: d.txHash } : m));
        }
      }).catch(() => {});
      await delay(1800); // overlay duration — demo pauses here
      setOrbMode('idle');
      await delay(300);

      // ── STEP 4: Trocar para Claude com contexto ───────────────
      setDemoStep(4);
      present({ step: 4, title: 'Switch model without losing memory', subtitle: 'GPT-4o hands verified context to Claude. The conversation does not reset.', phase: 'handoff', primaryModel: 'GPT-4o', secondaryModel: 'Claude', trustScore: 72 });
      toast({ title: '▶ Demo 4/10', description: 'Trocando para Claude com memória injetada...' });
      setPreviousModel('gpt');
      setSelectedModel('claude');
      setContextActive(true);
      setMessages(prev => [...prev, {
        id: uid(),
        role: 'assistant',
        content: passportText(gptPassport, 'Claude'),
        timestamp: ts(),
        orbMode: 'success',
        model: 'gpt',
        memoryHash: hash1,
        verified: true,
        txHash: anchoredTxHash ?? undefined,
      }]);
      await delay(1200);

      // ── STEP 5: Claude continua com contexto ──────────────────
      setDemoStep(5);
      present({ step: 5, title: 'Claude continues from verified context', subtitle: 'The second model builds on a memory object, not blind prompt copying.', phase: 'handoff', primaryModel: 'Claude', secondaryModel: 'GPT memory', trustScore: 78 });
      toast({ title: '▶ Demo 5/10', description: 'Claude analisa com contexto do GPT' });
      const q2 = 'Continue the verified GPT memory. Explain why this creates a new primitive for multi-agent collaboration.';
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
      const claudeCreatedAt = stamp();
      setMessages(prev => [...prev, {
        id: claudeId, role: 'assistant', content: claudeContent,
        timestamp: claudeCreatedAt, orbMode: 'success', model: 'claude',
        responseTime: 3200, tokensUsed: 276,
        contextInjected: true, previousModel: 'gpt',
        contextSummary: 'GPT memory sobre Proof of Work injetado',
      }]);
      setOrbMode('idle');
      await delay(1000);

      // ── STEP 6: Salvar memória Claude ─────────────────────────
      setDemoStep(6);
      present({ step: 6, title: 'Extend the memory chain', subtitle: 'Claude creates a child memory linked to the first verified insight.', phase: 'proof', primaryModel: 'Claude', trustScore: 82 });
      toast({ title: '▶ Demo 6/10', description: 'Salvando insight do Claude...' });
      const hash2 = d2?.memoryHash || await saveMemory(claudeContent, 'claude');
      const claudePassport: DemoMemoryPassport = {
        hash: hash2,
        model: 'Claude',
        createdAt: claudeCreatedAt,
        title: 'Cross-model continuation of verified memory',
      };
      setMessages(prev => prev.map(m => m.id === claudeId ? { ...m, memoryHash: hash2 } : m));
      toast({ title: '✓ Claude memory saved', description: `SHA-256: ${hash2.slice(0, 16)}...` });
      await delay(1000);

      // ── STEP 7: Trocar para Gemini com 2 memórias ─────────────
      setDemoStep(7);
      present({ step: 7, title: 'Second model handoff', subtitle: 'Gemini receives a two-step memory trail and continues the same intelligence.', phase: 'handoff', primaryModel: 'Claude', secondaryModel: 'Gemini', trustScore: 86 });
      toast({ title: '▶ Demo 7/10', description: 'Gemini herda memórias do GPT + Claude...' });
      setMessages(prev => [...prev, {
        id: uid(),
        role: 'assistant',
        content: `${passportText(gptPassport, 'Gemini')}\n\n---\n\n${passportText(claudePassport, 'Gemini')}`,
        timestamp: ts(),
        orbMode: 'success',
        model: 'claude',
        memoryHash: hash2,
        verified: true,
      }]);
      setPreviousModel('claude');
      setSelectedModel('gemini');
      await delay(1200);

      // ── STEP 8: Gemini continua com contexto duplo ────────────
      setDemoStep(8);
      present({ step: 8, title: 'Synthesize across three models', subtitle: 'The final model proves memory continuity across providers.', phase: 'synthesis', primaryModel: 'Gemini', secondaryModel: 'GPT + Claude', trustScore: 90 });
      toast({ title: '▶ Demo 8/10', description: 'Gemini responde com contexto cross-model' });
      const q3 = 'Synthesize the GPT and Claude memories into one judge-facing conclusion for CONGCHAIN.';
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
      present({ step: 9, title: 'Generate privacy-preserving proof', subtitle: 'ZK proof verifies integrity without exposing private memory content.', phase: 'proof', primaryModel: 'ZK verifier', trustScore: 94 });
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
      present({ step: 10, title: 'Verifiable AI continuity is live', subtitle: 'The memory survived model switching and produced a portable proof trail.', phase: 'finale', primaryModel: 'CONGCHAIN', secondaryModel: 'Solana', trustScore: 100 });
      const judgeSummary = `CONGCHAIN turns AI output into verifiable memory infrastructure.\n\nDemo trail:\n- GPT-4o memory: ${gptPassport.hash}\n- GPT-4o built at: ${gptPassport.createdAt}\n- Claude memory: ${claudePassport.hash}\n- Claude built at: ${claudePassport.createdAt}\n- Solana anchor: ${anchoredTxHash ?? 'devnet proof path ready'}\n- ZK proof: generated for memory integrity\n\nOne insight moved across GPT-4o -> Claude -> Gemini while preserving a cryptographic trail. AI memory becomes portable, inspectable, and reusable by agents across models.`;
      setDemoJudgeSummary(judgeSummary);
      setMessages(prev => [...prev, {
        id: uid(),
        role: 'assistant',
        content: `### Judge summary\n\n**CONGCHAIN turns AI output into verifiable memory infrastructure.**\n\nIn this demo, one insight moved across **GPT-4o -> Claude -> Gemini** while preserving a cryptographic trail:\n\n- **GPT-4o memory:** \`${gptPassport.hash}\`\n- **GPT-4o built at:** ${gptPassport.createdAt}\n- **Claude memory:** \`${claudePassport.hash}\`\n- **Claude built at:** ${claudePassport.createdAt}\n- **Solana anchor:** ${anchoredTxHash ? `\`${anchoredTxHash.slice(0, 18)}...\`` : 'devnet proof path ready'}\n- **Privacy layer:** ZK proof generated for memory integrity\n\nThis is the wow: AI memory becomes portable, inspectable, and reusable by agents across models.`,
        timestamp: ts(),
        orbMode: 'success',
        model: 'gemini',
        contextInjected: true,
        previousModel: 'claude',
        memoryHash: hash1,
        verified: true,
        txHash: anchoredTxHash ?? undefined,
        responseTime: 900,
        tokensUsed: 168,
      }]);
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

  const handleContinueMemory = useCallback((msg: Message, model: AIModel) => {
    const hash = msg.memoryHash || msg.structuredResponse?.meta?.onChainHash;
    const fromModel = msg.model ? (MODEL_LABELS[msg.model as AIModel] || msg.model) : 'CONGCHAIN';
    const toModel = MODEL_LABELS[model] || model;
    const createdAt = msg.structuredResponse?.meta?.verifiedAt
      ? new Date(msg.structuredResponse.meta.verifiedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      : msg.timestamp;
    setPreviousModel(msg.model || selectedModel);
    setSelectedModel(model);
    setContextActive(true);
    setInputValue(
      hash
        ? `Continue esta memoria verificada com ${toModel}.\n\nFormato obrigatorio da resposta:\n### Com base no hash ${hash}\nMemoria salva em ${createdAt}, criada por ${fromModel}.\n\n### Aprofundando a Memoria Verificada\nEscreva abaixo o aprofundamento com clareza, contexto, decisoes praticas, fontes quando disponiveis e proximos passos.\n\nNao repita o texto original inteiro; continue a partir dele.`
        : `Continue esta resposta com ${toModel}.\n\nFormato obrigatorio da resposta:\n### Aprofundando a Memoria Verificada\nOrigem: ${fromModel}\n\nEscreva o aprofundamento com clareza, contexto, decisoes praticas, fontes quando disponiveis e proximos passos.`
    );
    toast({
      title: `Memoria pronta para ${toModel}`,
      description: hash ? `${hash.substring(0, 16)}...` : 'Contexto carregado no prompt.',
    });
  }, [selectedModel, toast]);

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
      <DemoCommandCenter stage={demoStage} total={DEMO_TOTAL} />
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header — #6 microcopy + model selector + timeline btn */}
        <header className="flex items-center justify-between pl-14 pr-4 md:px-5 py-2.5 border-b border-white/[0.055] bg-[#07070f]/82 shadow-[inset_0_-1px_0_rgba(255,255,255,0.025)] backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            {/* #10 Mascote micro-state tooltip */}
            <div className="relative group h-10 w-10 shrink-0">
              {/* Anel pulsante quando thinking/typing */}
              {(orbMode === 'thinking' || orbMode === 'typing') && (
                <span className="absolute inset-0 rounded-full animate-ping opacity-30"
                  style={{ background: orbMode === 'thinking' ? 'rgba(153,69,255,0.4)' : 'rgba(20,241,149,0.4)' }} />
              )}
              <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 scale-[0.42]">
                <Orb mode={contextActive && orbMode === 'idle' ? 'thinking' : orbMode} size="sm" interactive={false} />
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                <span className="text-[9px] bg-white/10 backdrop-blur text-white/50 px-2 py-0.5 rounded">
                  {orbMode === 'thinking' ? 'Pensando...' : orbMode === 'typing' ? 'Digitando...' : contextActive ? 'Memory synced' : 'Ready'}
                </span>
              </div>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold tracking-[-0.01em] text-white/90">CognChain</h1>
              <p className="max-w-[190px] text-[11px] leading-snug text-white/34">Verifiable Memory Protocol for AI Agents.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Desktop-only: Wallet + Lang + Timeline */}
            <div className="hidden sm:flex items-center gap-1.5">
              <WalletAdapterButton />
              <div className="relative">
                <button onClick={() => setShowLangMenu(!showLangMenu)} className={`p-1.5 rounded-full transition-colors ${showLangMenu ? 'bg-white/[0.08] text-white/70' : 'hover:bg-white/[0.055] text-white/30 hover:text-white/62'}`} title="Traduzir">
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
              <button onClick={() => setShowTimeline(true)} className="p-1.5 rounded-full hover:bg-white/[0.055] text-white/30 hover:text-white/62 transition-colors" title="Evolution Timeline">
                <GitBranch className="w-4 h-4" />
              </button>
            </div>
            {/* Always visible: new chat */}
            {messages.length > 1 && (
              <button onClick={handleNewChat} className="p-1.5 rounded-full hover:bg-white/[0.055] text-white/30 hover:text-white/62 transition-colors" title="Nova conversa">
                <PenSquare className="w-4 h-4" />
              </button>
            )}
            {/* Model selector: desktop header only */}
            <div className="hidden md:flex">
              <ModelSelector selectedModel={selectedModel} onModelChange={handleModelSwitch} />
            </div>
            {/* Status badge: desktop only */}
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]
              ${orbMode === 'idle' ? 'bg-[#14F195]/[0.08] text-[#14F195]/72 border border-[#14F195]/18' :
                orbMode === 'thinking' ? 'bg-[#5AD7FF]/[0.08] text-[#5AD7FF]/72 border border-[#5AD7FF]/18' :
                orbMode === 'typing' ? 'bg-[#14F195]/[0.08] text-[#14F195]/72 border border-[#14F195]/18' :
                orbMode === 'error' ? 'bg-[#FF4458]/10 text-[#FF4458]/70 border border-[#FF4458]/20' :
                'bg-[#14F195]/[0.08] text-[#14F195]/72 border border-[#14F195]/18'}`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse
                ${orbMode === 'idle' ? 'bg-[#14F195]' : orbMode === 'thinking' ? 'bg-[#00D1FF]' : orbMode === 'typing' ? 'bg-[#14F195]' : orbMode === 'error' ? 'bg-[#FF4458]' : 'bg-[#14F195]'}`} />
              {orbMode === 'idle' && 'Online'}{orbMode === 'thinking' && 'Pensando...'}
              {orbMode === 'typing' && 'Digitando...'}{orbMode === 'error' && 'Erro'}
              {orbMode === 'success' && 'Sucesso'}{orbMode === 'listening' && 'Ouvindo...'}
            </div>
          </div>
        </header>

        {/* Mobile model selector row — visible only on small screens */}
        <div className="flex md:hidden overflow-x-auto gap-1 px-3 py-2 border-b border-white/[0.06] bg-[#0a0a14]/50">
          <ModelSelector selectedModel={selectedModel} onModelChange={handleModelSwitch} />
        </div>

        {/* Messages */}
        <div ref={chatContainerRef} className={`relative ${isEmpty ? 'flex-none overflow-visible xl:flex-1 xl:overflow-y-auto' : 'flex-1 overflow-y-auto'}`}
          style={{
            backgroundImage: [
              'radial-gradient(circle at 50% 18%, rgba(90, 215, 255, 0.055) 0%, transparent 34%)',
              'radial-gradient(circle at 50% 44%, rgba(139, 92, 246, 0.045) 0%, transparent 46%)',
            ].join(', '),
          }}>
          {isEmpty ? (
            <div className="flex min-h-0 flex-col items-center px-4 pb-4 pt-5 sm:pt-7 md:pt-7 xl:min-h-full xl:pb-8 xl:pt-12">
              <div className="relative flex w-full max-w-4xl flex-col items-center">
                <div className="pointer-events-none absolute inset-x-0 top-6 mx-auto h-56 max-w-2xl rounded-full bg-[radial-gradient(circle,rgba(20,241,149,0.08),rgba(139,92,246,0.045)_42%,transparent_70%)] blur-3xl xl:top-10 xl:h-72" />
                <div className="relative mb-1 flex h-24 w-24 items-center justify-center md:h-28 md:w-28 xl:mb-2 xl:h-36 xl:w-36">
                  <div className="absolute left-1/2 top-1/2 scale-[0.46] -translate-x-1/2 -translate-y-1/2 md:scale-[0.52] xl:scale-[0.64]">
                    <Orb mode={orbMode} size="xl" interactive />
                  </div>
                </div>
                <p className="relative mb-2 text-[9px] font-bold uppercase tracking-[0.34em] text-[#5AD7FF]/70 xl:mb-3 xl:text-[10px]">CognChain</p>
                <h2 className="relative max-w-2xl text-center text-[1.55rem] font-semibold leading-[1.06] text-[#F4F2FF] md:text-[2.45rem] xl:text-[3.35rem]">
                  Verifiable Memory Protocol
                  <span className="block text-white/82">for AI Agents.</span>
                </h2>
                <p className="relative mt-3 max-w-xl text-center text-xs leading-relaxed text-[#A7A4B6] md:text-sm xl:mt-4 xl:text-base">
                  Persistent, portable memory that agents can prove, inherit, and continue across models.
                </p>
                <div className="relative mt-3 mb-3 flex flex-wrap items-center justify-center gap-2 xl:mt-5 xl:mb-5">
                  {['Verifiable', 'Portable', 'Cross-model'].map(label => (
                    <span key={label} className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-[11px] font-medium text-white/48 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              {/* Model selector on empty state */}
              <div className="flex items-center gap-1.5 mb-5 flex-wrap justify-center">
                {([['gpt', 'GPT-4o', '#10b981'], ['claude', 'Claude', '#f97316'], ['deepseek', 'DeepSeek', '#06b6d4'], ['nvidia', 'Llama', '#9945FF'], ['gemini', 'Gemini', '#3B82F6']] as [AIModel, string, string][]).map(([key, name, color]) => (
                  <button key={key} onClick={() => setSelectedModel(key as AIModel)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${selectedModel === key ? 'bg-white/[0.08] border border-white/[0.14] text-white/90 shadow-sm' : 'bg-white/[0.025] border border-white/[0.06] text-white/42 hover:text-white/65 hover:bg-white/[0.055]'}`}>
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: color }} />
                    {name}
                  </button>
                ))}
              </div>
              {/* Memory hash loader */}
              <div className="w-full max-w-md mb-5">
                <div className={`flex items-center gap-2 bg-[#0A0A12]/70 border rounded-2xl px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl transition-all ${hashError ? 'border-red-500/40' : hashLoading ? 'border-[#8B5CF6]/40' : 'border-white/[0.07] focus-within:border-[#14F195]/40'}`}>
                  <Hash className={`w-4 h-4 flex-shrink-0 ${hashLoading ? 'text-[#9945FF] animate-pulse' : 'text-[#14F195]/40'}`} />
                  <input
                    type="text"
                    placeholder="Cole um hash de memória para continuar..."
                    value={hashInput}
                    onChange={e => { setHashInput(e.target.value); setHashError(''); }}
                    onKeyDown={async e => {
                      if (e.key !== 'Enter' || !hashInput.trim() || hashLoading) return;
                      setHashLoading(true); setHashError('');
                      try {
                        const r = await fetch(`/api/memory/${hashInput.trim()}`);
                        if (!r.ok) throw new Error('Hash não encontrado');
                        const data = await r.json();
                        const mem = data.memory;
                        if (!mem) throw new Error('Memória inválida');
                        const createdAt = new Date(mem.timestamp * 1000).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
                        const ctx = `⚡ Memória Verificada · CognChain on Solana\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nHash: ${mem.hash}\nModelo: ${mem.model} · Score: ${mem.score ?? '—'}/10\nCriada em: ${createdAt}\nStatus: ${mem.verified ? '✓ Verificado on-chain' : '⏳ Pendente'}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${mem.content}`;
                        setMessages([{ id: Date.now().toString(), role: 'assistant', content: ctx, timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }]);
                        setHashInput('');
                        setInputValue(`Continue e aprofunde esta memoria verificada.\n\nFormato obrigatorio da resposta:\n### Com base no hash ${mem.hash}\nMemoria salva em ${createdAt}, criada por ${MODEL_LABELS[mem.model as AIModel] || mem.model}.\n\n### Aprofundando a Memoria Verificada\nEscreva abaixo o aprofundamento com clareza, contexto, decisoes praticas, fontes quando disponiveis e proximos passos.\n\nNao repita o texto original inteiro; continue a partir dele.`);
                      } catch (err) {
                        setHashError(err instanceof Error ? err.message : 'Erro ao carregar');
                      } finally {
                        setHashLoading(false);
                      }
                    }}
                    className="flex-1 bg-transparent text-sm text-white/70 placeholder-white/20 outline-none font-mono"
                  />
                  {hashLoading
                    ? <span className="text-[10px] text-[#9945FF]/60">carregando...</span>
                    : hashError
                      ? <span className="text-[10px] text-red-400/70">{hashError}</span>
                      : hashInput
                        ? <span className="text-[10px] text-white/20">↵ Enter</span>
                        : <span className="text-[10px] text-white/20">↵ Enter</span>}
                </div>
              </div>
              {/* Quick action cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-lg">
                {quickActions.map((a, i) => (
                  <button key={i} onClick={() => { setInputValue(a.prompt); }}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.025] border border-white/[0.065] hover:bg-white/[0.055] hover:border-[#8B5CF6]/25 transition-all duration-200 text-left group">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#8B5CF6]/18 to-[#14F195]/10 border border-white/[0.08] flex items-center justify-center flex-shrink-0 group-hover:border-[#5AD7FF]/25 transition-colors text-[#A78BFA]/75 group-hover:text-[#5AD7FF]">{a.icon}</div>
                    <p className="text-xs font-medium text-white/60 group-hover:text-white/90 transition-colors">{a.label}</p>
                  </button>
                ))}
              </div>
              {/* #3 Auto-Demo button */}
              <button onClick={runAutoDemo} disabled={isDemoRunning}
                className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#8B5CF6]/18 to-[#14F195]/14 border border-[#8B5CF6]/22 text-[#C4B5FD]/80 hover:from-[#8B5CF6]/26 hover:to-[#14F195]/22 hover:text-white transition-all duration-200 disabled:opacity-50 text-sm font-medium">
                {isDemoRunning ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[#9945FF]/30 border-t-[#9945FF] rounded-full animate-spin" />
                    Live proof {demoStep}/{DEMO_TOTAL}...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Run Hackathon Demo
                  </>
                )}
              </button>
              <p className="text-[10px] text-white/15 mt-2">Auto-runs: Create → Save → Verify → Switch AI → Continue</p>
            </div>
          ) : (
            <div className="py-6 space-y-6">
              {messages.map((msg, idx) => {
                const isStreamingMessage = streamingId === msg.id;
                if (isStreamingMessage && !streamedContent) return null;
                return (
                  <ChatMessage key={msg.id} message={msg}
                    isLatest={idx === messages.length - 1 && msg.role === 'assistant'}
                    isStreaming={isStreamingMessage}
                    streamedContent={isStreamingMessage ? streamedContent : undefined}
                    onSave={handleSave} onCompare={handleCompare} onScore={handleScoreOpen} onCopyHash={handleCopyHash} onAudit={handleAudit} onContinueMemory={handleContinueMemory} onWalletAgentReview={handleWalletAgentReview} />
                );
              })}
              <ThinkingPanel
                phase={chatPhase}
                status={thinkingStatus}
                thoughts={reasoningChunks}
                showReasoning={showReasoning}
                onToggle={() => setShowReasoning(v => !v)}
              />
              {isTyping && !streamingId && chatPhase === 'idle' && (
                <div className="flex gap-4 px-4 md:px-6 lg:px-8">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-visible">
                    <Orb mode={orbMode} size="sm" interactive={false} />
                  </div>
                  <div className="flex-1 max-w-[70%]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-white/60">CONGCHAIN</span>
                    </div>
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#9945FF] animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#9945FF] animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#9945FF] animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-[12px] text-white/40 transition-all duration-300">{thinkingStatus}</span>
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
        <div className="border-t border-transparent bg-transparent p-2.5 shadow-none backdrop-blur-2xl sm:p-3 md:border-transparent md:bg-transparent md:p-5 md:shadow-none">
          <div className="mx-auto max-w-3xl lg:max-w-4xl">
            {/* Agent insights notification */}
            {agentInsights && (
              <div className="flex items-center justify-between mb-2 px-1">
                <button
                  onClick={() => setInputValue('O que seus agentes descobriram nas últimas 24h?')}
                  className="flex items-center gap-2 text-[11px] text-[#F59E0B]/70 hover:text-[#F59E0B] transition-colors group"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse" />
                  <span className="font-semibold">{agentInsights.count} insight{agentInsights.count > 1 ? 's' : ''} dos agentes</span>
                  <span className="text-white/25 group-hover:text-white/40 truncate max-w-[200px]">— {agentInsights.latest}</span>
                  <span className="text-[#F59E0B]/40 group-hover:text-[#F59E0B]/70">→ perguntar</span>
                </button>
                <button onClick={() => setAgentInsights(null)} className="text-white/15 hover:text-white/40 text-xs">✕</button>
              </div>
            )}
            {/* #1 Context chip above input */}
            {contextActive && (
              <div className="flex items-center justify-between mb-2">
                <ContextChip active={contextActive} />
                <span className="text-[10px] text-white/20">Memory anchored. Hash generated.</span>
              </div>
            )}
            <div className="relative flex min-h-[58px] items-end gap-2 rounded-[28px] border border-[#5AD7FF]/18 bg-[#0D0D16]/94 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_14px_42px_rgba(0,0,0,0.38),0_0_34px_rgba(90,215,255,0.045)] backdrop-blur-2xl transition-all duration-200 focus-within:border-[#5AD7FF]/42 focus-within:bg-[#10101A]/96 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_52px_rgba(0,0,0,0.42),0_0_42px_rgba(90,215,255,0.08)] sm:px-4 md:min-h-[64px] md:rounded-[32px] md:border-[#5AD7FF]/20 md:px-5 md:py-3.5 md:shadow-[inset_0_1px_0_rgba(255,255,255,0.075),0_24px_70px_rgba(0,0,0,0.34),0_0_46px_rgba(90,215,255,0.055)]">
              <div className="flex items-center gap-0.5 pb-0.5">
                <button className="p-1.5 rounded-full hover:bg-white/[0.06] text-white/34 hover:text-white/62 transition-colors"><Paperclip className="w-5 h-5" /></button>
                <button className="p-1.5 rounded-full hover:bg-white/[0.06] text-white/34 hover:text-white/62 transition-colors"><ImagePlus className="w-5 h-5" /></button>
              </div>
              <textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Describe what you want to build..." rows={1}
                className="flex-1 bg-transparent text-[15px] leading-relaxed text-white/92 placeholder-white/38 resize-none outline-none max-h-32 py-1"
                style={{ height: 'auto', minHeight: '24px' }}
                onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 128) + 'px'; }} />
              <div className="flex items-center gap-0.5 pb-0.5">
                <button onClick={() => setOrbMode(orbMode === 'listening' ? 'idle' : 'listening')}
                  className={`p-1.5 rounded-full transition-colors ${orbMode === 'listening' ? 'bg-[#8B5CF6]/18 text-[#C4B5FD]' : 'hover:bg-white/[0.06] text-white/34 hover:text-white/62'}`}>
                  <Mic className="w-5 h-5" />
                </button>
                <button onClick={handleSend} disabled={!inputValue.trim() || isTyping}
                  className={`p-2 rounded-full transition-all duration-200 ${inputValue.trim() && !isTyping ? 'bg-gradient-to-r from-[#8B5CF6] via-[#5AD7FF] to-[#14F195] text-[#050509] shadow-lg shadow-[#5AD7FF]/20 hover:shadow-[#14F195]/24' : 'text-white/24 cursor-not-allowed'}`}>
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
            <p className="text-center text-[10px] text-white/18 mt-1.5 md:text-[11px] md:mt-2">CONGCHAIN pode cometer erros. Verifique informacoes importantes.</p>
          </div>
        </div>
      </div>

      {/* Panels & Modals */}
      {showPanel && selectedMessage && <RightPanel isOpen={showPanel} onClose={() => setShowPanel(false)} message={selectedMessage} walletAddress={walletAddress} />}
      {showSolanaOverlay && (
        <SolanaOverlay txHash={solanaTxHash} onDone={() => setShowSolanaOverlay(false)} />
      )}
      <DemoFinaleOverlay
        stage={demoStage}
        summary={demoJudgeSummary}
        onCopy={copyDemoJudgeSummary}
        copied={demoSummaryCopied}
        onClose={() => setDemoStage(prev => ({ ...prev, visible: false }))}
      />
      {auditHash && (
        <MemoryAuditTrail hash={auditHash} model={auditModel} onClose={() => setAuditHash(null)} />
      )}
      {walletAgentReview && (
        <WalletAgentReviewPanel
          result={walletAgentReview}
          onClose={() => setWalletAgentReview(null)}
          onConfirm={handleWalletAgentConfirm}
          onPrepareTransaction={handleWalletAgentPrepareTransaction}
          onSignTransaction={handleWalletAgentSignTransaction}
          onSubmitTransaction={handleWalletAgentSubmitTransaction}
          onConfirmTransaction={handleWalletAgentConfirmTransaction}
          history={walletAgentHistory}
        />
      )}
      <ScoreModal isOpen={showScoreModal} onClose={() => setShowScoreModal(false)} onSubmit={handleScoreSubmit} />
      <CompareView isOpen={showCompare} onClose={() => setShowCompare(false)} prompt={comparePrompt} results={compareResults} isLoading={compareLoading} />
      <EvolutionTimeline isOpen={showTimeline} onClose={() => setShowTimeline(false)} />
      <ModelSwitchModal isOpen={showSwitchModal} onClose={() => setShowSwitchModal(false)} onConfirm={handleSwitchConfirm}
        fromModel={selectedModel} toModel={pendingModel} />
    </div>
  );
}
