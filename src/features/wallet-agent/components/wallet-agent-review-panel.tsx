'use client';

import {
  AlertTriangle,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import type { WalletAgentCoreResult, WalletAgentReviewItem } from '../types';

type WalletAgentReviewPanelProps = {
  result: WalletAgentCoreResult;
  onClose: () => void;
};

const STATUS_STYLES: Record<WalletAgentReviewItem['status'], { label: string; className: string }> = {
  ready: {
    label: 'pronto',
    className: 'border-[#14F195]/22 bg-[#14F195]/10 text-[#14F195]',
  },
  missing: {
    label: 'faltando',
    className: 'border-[#FF5C7A]/24 bg-[#FF5C7A]/10 text-[#FF8A9E]',
  },
  review: {
    label: 'revisar',
    className: 'border-[#F5A524]/24 bg-[#F5A524]/10 text-[#F5A524]',
  },
};

function ReviewItem({ item }: { item: WalletAgentReviewItem }) {
  const status = STATUS_STYLES[item.status];

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34">{item.label}</p>
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${status.className}`}>
          {status.label}
        </span>
      </div>
      <p className="break-words text-sm leading-relaxed text-white/72">{item.value}</p>
    </div>
  );
}

export function WalletAgentReviewPanel({ result, onClose }: WalletAgentReviewPanelProps) {
  const { draft, safety, review } = result;
  const valueMoving = draft.requiresWalletSignature;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/72 px-3 py-4 backdrop-blur-xl">
      <section className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-white/[0.09] bg-[#07070d]/98 shadow-[0_36px_140px_rgba(0,0,0,0.68)]">
        <div className="border-b border-white/[0.07] bg-gradient-to-r from-[#14F195]/10 via-[#00D1FF]/6 to-[#9945FF]/12 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#14F195]/22 bg-[#14F195]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#14F195]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Wallet Agent Review
                </span>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/46">
                  {review.intentLabel}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-white/92 sm:text-2xl">{review.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/50">{review.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/[0.08] bg-white/[0.04] p-2 text-white/42 transition-colors hover:bg-white/[0.08] hover:text-white/80"
              aria-label="Fechar revisao"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(92vh-118px)] overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {review.items.map(item => (
                  <ReviewItem key={item.label} item={item} />
                ))}
              </div>

              {draft.warnings.length > 0 && (
                <div className="rounded-2xl border border-[#F5A524]/18 bg-[#F5A524]/[0.055] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[#F5A524]" />
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F5A524]/85">Avisos de seguranca</p>
                  </div>
                  <div className="space-y-2">
                    {draft.warnings.map(warning => (
                      <p key={warning} className="text-sm leading-relaxed text-white/58">{warning}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-[#14F195]/16 bg-[#14F195]/[0.045] p-4">
                <div className="mb-3 flex items-center gap-2">
                  {valueMoving ? <Wallet className="h-4 w-4 text-[#14F195]" /> : <LockKeyhole className="h-4 w-4 text-[#14F195]" />}
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#14F195]/85">{review.custodyLabel}</p>
                </div>
                <p className="text-sm leading-relaxed text-white/62">{safety.reason}</p>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-black/24 p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-white/42">Obrigatorio antes de executar</p>
                <div className="space-y-2.5">
                  {review.requiredBeforeExecution.map(item => (
                    <div key={item} className="flex gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#14F195]/80" />
                      <p className="text-sm leading-relaxed text-white/56">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#FF5C7A]/16 bg-[#FF5C7A]/[0.045] p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#FF8A9E]/85">Nunca permitido</p>
                <div className="space-y-2.5">
                  {review.blockedActions.map(item => (
                    <div key={item} className="flex gap-2.5">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8A9E]/80" />
                      <p className="text-sm leading-relaxed text-white/54">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
