'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  LockKeyhole,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react';
import type { WalletAgentCoreResult, WalletAgentRiskLevel } from '../types';

type WalletAgentPreviewCardProps = {
  result: WalletAgentCoreResult;
  onReview?: () => void;
  onDismiss?: () => void;
};

const RISK_STYLES: Record<WalletAgentRiskLevel, { label: string; className: string }> = {
  low: {
    label: 'baixo risco',
    className: 'border-[#14F195]/25 bg-[#14F195]/10 text-[#14F195]',
  },
  medium: {
    label: 'revisar',
    className: 'border-[#F5A524]/25 bg-[#F5A524]/10 text-[#F5A524]',
  },
  high: {
    label: 'alto risco',
    className: 'border-[#FF5C7A]/25 bg-[#FF5C7A]/10 text-[#FF8A9E]',
  },
  blocked: {
    label: 'bloqueado',
    className: 'border-red-500/30 bg-red-500/10 text-red-300',
  },
};

function formatIntentType(type: string) {
  return type
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

export function WalletAgentPreviewCard({ result, onReview, onDismiss }: WalletAgentPreviewCardProps) {
  const { draft, safety, preview } = result;
  const risk = RISK_STYLES[draft.riskLevel];
  const valueMoving = draft.requiresWalletSignature;

  return (
    <section className="w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#07070d]/95 shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
      <div className="border-b border-white/[0.06] bg-gradient-to-r from-[#14F195]/10 via-[#00D1FF]/6 to-[#9945FF]/10 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#14F195]/20 bg-[#14F195]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#14F195]">
                <ShieldCheck className="h-3 w-3" />
                Wallet Agent
              </span>
              <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${risk.className}`}>
                {risk.label}
              </span>
            </div>
            <h3 className="text-base font-semibold text-white/88">{preview.title}</h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/45">{preview.description}</p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2 text-right">
            <p className="text-[9px] uppercase tracking-[0.18em] text-white/28">Intent</p>
            <p className="mt-1 text-xs font-semibold text-white/70">{formatIntentType(draft.type)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Rede</p>
              <p className="mt-1 text-sm font-semibold text-white/78">{preview.networkLabel}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Token</p>
              <p className="mt-1 text-sm font-semibold text-white/78">{draft.entities.tokenSymbol ?? 'a confirmar'}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Valor</p>
              <p className="mt-1 text-sm font-semibold text-white/78">
                {draft.entities.amountSol ? `${draft.entities.amountSol} SOL` : 'simulacao primeiro'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#00D1FF]/14 bg-[#00D1FF]/[0.045] p-3">
            <div className="mb-2 flex items-center gap-2">
              <Eye className="h-4 w-4 text-[#00D1FF]" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#00D1FF]/85">Proximo passo seguro</p>
            </div>
            <p className="text-sm leading-relaxed text-white/62">{preview.nextStep}</p>
          </div>

          {draft.warnings.length > 0 && (
            <div className="rounded-xl border border-[#F5A524]/18 bg-[#F5A524]/[0.055] p-3">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#F5A524]" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#F5A524]/85">Avisos</p>
              </div>
              <div className="space-y-1.5">
                {draft.warnings.map(warning => (
                  <p key={warning} className="text-xs leading-relaxed text-white/50">{warning}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LockKeyhole className="h-4 w-4 text-[#14F195]" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/58">Checklist</p>
              </div>
              <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/38">
                {safety.status}
              </span>
            </div>
            <div className="space-y-2">
              {preview.checklist.map(item => (
                <div key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#14F195]/80" />
                  <p className="text-xs leading-relaxed text-white/48">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <div className="mb-2 flex items-center gap-2">
              {valueMoving ? <Wallet className="h-4 w-4 text-[#9945FF]" /> : <Clock3 className="h-4 w-4 text-[#9945FF]" />}
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/58">
                {valueMoving ? 'Assinatura exigida' : 'Somente leitura'}
              </p>
            </div>
            <div className="space-y-1.5">
              {preview.disclosures.map(disclosure => (
                <p key={disclosure} className="text-xs leading-relaxed text-white/42">{disclosure}</p>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onReview}
              disabled={!safety.allowed}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#14F195]/20 bg-[#14F195]/10 px-3 py-2 text-xs font-semibold text-[#14F195] transition-colors hover:bg-[#14F195]/15 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Zap className="h-3.5 w-3.5" />
              {preview.primaryActionLabel}
            </button>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs font-semibold text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white/70"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
