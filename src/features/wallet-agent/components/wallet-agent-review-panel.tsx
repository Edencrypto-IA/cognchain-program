'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  LockKeyhole,
  Send,
  ShieldCheck,
  Wallet,
  Zap,
  X,
} from 'lucide-react';
import type { WalletAgentCoreResult, WalletAgentHistoryEntry, WalletAgentReviewItem } from '../types';
import { canConfirmWalletAgentIntent } from '../confirmation';

type WalletAgentReviewPanelProps = {
  result: WalletAgentCoreResult;
  onClose: () => void;
  onConfirm: (result: WalletAgentCoreResult) => void;
  onPrepareTransaction?: (result: WalletAgentCoreResult) => void;
  onSignTransaction?: (result: WalletAgentCoreResult) => void;
  onSubmitTransaction?: (result: WalletAgentCoreResult) => void;
  onConfirmTransaction?: (result: WalletAgentCoreResult) => void;
  history?: WalletAgentHistoryEntry[];
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

export function WalletAgentReviewPanel({
  result,
  onClose,
  onConfirm,
  onPrepareTransaction,
  onSignTransaction,
  onSubmitTransaction,
  onConfirmTransaction,
  history = [],
}: WalletAgentReviewPanelProps) {
  const { draft, safety, review } = result;
  const valueMoving = draft.requiresWalletSignature;
  const confirmationCheck = canConfirmWalletAgentIntent(result);
  const confirmed = !!draft.internalConfirmation?.confirmed;
  const proposal = draft.transactionProposal;
  const preparedTransaction = draft.preparedTransaction;
  const signedTransaction = draft.signedTransaction;
  const submittedTransaction = draft.submittedTransaction;
  const canPrepareTransaction = !!proposal
    && proposal.status === 'ready_for_wallet_signature'
    && !preparedTransaction
    && !!onPrepareTransaction;
  const canSignTransaction = !!preparedTransaction
    && !signedTransaction
    && !!onSignTransaction;
  const canSubmitTransaction = !!signedTransaction
    && !submittedTransaction
    && !!onSubmitTransaction;
  const canConfirmTransaction = !!submittedTransaction
    && submittedTransaction.confirmationStatus !== 'finalized'
    && submittedTransaction.confirmationStatus !== 'error'
    && !!onConfirmTransaction;

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
              {confirmed && (
                <div className="rounded-2xl border border-[#14F195]/20 bg-[#14F195]/[0.07] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#14F195]" />
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#14F195]/85">Confirmacao interna registrada</p>
                  </div>
                  <p className="text-sm leading-relaxed text-white/62">
                    ID {draft.internalConfirmation?.confirmationId}. Esta confirmacao nao assina nem envia transacao.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-[#14F195]/16 bg-[#14F195]/[0.045] p-4">
                <div className="mb-3 flex items-center gap-2">
                  {valueMoving ? <Wallet className="h-4 w-4 text-[#14F195]" /> : <LockKeyhole className="h-4 w-4 text-[#14F195]" />}
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#14F195]/85">{review.custodyLabel}</p>
                </div>
                <p className="text-sm leading-relaxed text-white/62">{safety.reason}</p>
              </div>

              {proposal && (
                <div className="rounded-2xl border border-[#00D1FF]/16 bg-[#00D1FF]/[0.045] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-[#00D1FF]" />
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#00D1FF]/85">Proposta de transacao</p>
                    </div>
                    <span className="rounded-full border border-white/[0.08] bg-black/24 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/46">
                      {proposal.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-white/62">{proposal.summary}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/[0.06] bg-black/18 p-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Tipo</p>
                      <p className="mt-1 text-xs font-semibold text-white/66">{proposal.kind.replaceAll('_', ' ')}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-black/18 p-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Taxa estimada</p>
                      <p className="mt-1 text-xs font-semibold text-white/66">{proposal.estimatedFeeSol.toFixed(6)} SOL</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {proposal.checks.map(check => (
                      <div key={check.label} className="rounded-xl border border-white/[0.06] bg-black/18 p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-white/64">{check.label}</p>
                          <span className="text-[10px] uppercase tracking-[0.12em] text-white/34">{check.status}</span>
                        </div>
                        <p className="text-xs leading-relaxed text-white/42">{check.detail}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-white/42">{proposal.requiredWalletAction}</p>
                </div>
              )}

              {preparedTransaction && (
                <div className="rounded-2xl border border-[#14F195]/18 bg-[#14F195]/[0.055] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4 text-[#14F195]" />
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#14F195]/85">Transacao Devnet preparada</p>
                    </div>
                    <span className="rounded-full border border-[#14F195]/18 bg-[#14F195]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#14F195]">
                      sem assinatura
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/[0.06] bg-black/18 p-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Destino</p>
                      <p className="mt-1 break-words text-xs font-semibold text-white/66">{preparedTransaction.toAddress}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-black/18 p-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Valor</p>
                      <p className="mt-1 text-xs font-semibold text-white/66">{preparedTransaction.amountSol} SOL</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-white/42">
                    Payload criado localmente com blockhash recente. Nada foi assinado ou enviado para a rede.
                  </p>
                </div>
              )}

              {signedTransaction && (
                <div className="rounded-2xl border border-[#9945FF]/18 bg-[#9945FF]/[0.06] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-[#B58CFF]" />
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B58CFF]/85">Assinada pela wallet</p>
                    </div>
                    <span className="rounded-full border border-[#9945FF]/18 bg-[#9945FF]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#C4B5FD]">
                      nao enviada
                    </span>
                  </div>
                  <p className="break-words text-xs leading-relaxed text-white/48">
                    Signer: {signedTransaction.signerAddress}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-white/42">
                    A assinatura foi aprovada na wallet, mas a transacao ainda nao foi transmitida para a rede.
                  </p>
                </div>
              )}

              {submittedTransaction && (
                <div className="rounded-2xl border border-[#14F195]/20 bg-[#14F195]/[0.07] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#14F195]" />
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#14F195]/85">Enviada para Devnet</p>
                    </div>
                    <span className="rounded-full border border-[#14F195]/18 bg-[#14F195]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#14F195]">
                      submitted
                    </span>
                  </div>
                  <p className="break-words text-xs leading-relaxed text-white/50">
                    Signature: {submittedTransaction.signature}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-white/44">
                    Status: {submittedTransaction.confirmationStatus}
                    {submittedTransaction.slot ? ` | Slot: ${submittedTransaction.slot}` : ''}
                  </p>
                  {submittedTransaction.errorMessage && (
                    <p className="mt-2 break-words text-xs leading-relaxed text-[#FF8A9E]">
                      {submittedTransaction.errorMessage}
                    </p>
                  )}
                  <a
                    href={submittedTransaction.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-xs font-semibold text-[#14F195] hover:text-[#8FFFE0]"
                  >
                    Ver no Solana Explorer →
                  </a>
                </div>
              )}

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

              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#9945FF]" />
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/48">Portao de confirmacao</p>
                </div>
                <p className="mb-3 text-sm leading-relaxed text-white/52">{confirmationCheck.reason}</p>
                <button
                  type="button"
                  onClick={() => onConfirm(result)}
                  disabled={!confirmationCheck.allowed || confirmed}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#14F195]/22 bg-[#14F195]/10 px-4 py-3 text-sm font-semibold text-[#14F195] transition-colors hover:bg-[#14F195]/15 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.025] disabled:text-white/28"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {confirmed ? 'Confirmado no app' : 'Confirmar intencao no app'}
                </button>
                {canPrepareTransaction && (
                  <button
                    type="button"
                    onClick={() => onPrepareTransaction(result)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#00D1FF]/22 bg-[#00D1FF]/10 px-4 py-3 text-sm font-semibold text-[#7DE3FF] transition-colors hover:bg-[#00D1FF]/15"
                  >
                    <Send className="h-4 w-4" />
                    Preparar transacao Devnet
                  </button>
                )}
                {canSignTransaction && (
                  <button
                    type="button"
                    onClick={() => onSignTransaction(result)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#9945FF]/24 bg-[#9945FF]/12 px-4 py-3 text-sm font-semibold text-[#C4B5FD] transition-colors hover:bg-[#9945FF]/18"
                  >
                    <Wallet className="h-4 w-4" />
                    Assinar na wallet
                  </button>
                )}
                {canSubmitTransaction && (
                  <button
                    type="button"
                    onClick={() => onSubmitTransaction(result)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#14F195]/24 bg-[#14F195]/12 px-4 py-3 text-sm font-semibold text-[#14F195] transition-colors hover:bg-[#14F195]/18"
                  >
                    <Send className="h-4 w-4" />
                    Enviar para Devnet
                  </button>
                )}
                {canConfirmTransaction && (
                  <button
                    type="button"
                    onClick={() => onConfirmTransaction(result)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#5AD7FF]/24 bg-[#5AD7FF]/10 px-4 py-3 text-sm font-semibold text-[#7DE3FF] transition-colors hover:bg-[#5AD7FF]/15"
                  >
                    <Clock3 className="h-4 w-4" />
                    Verificar confirmacao
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-black/24 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-[#5AD7FF]" />
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">Historico local</p>
                </div>
                {history.length === 0 ? (
                  <p className="text-sm leading-relaxed text-white/38">Nenhuma intencao anterior registrada neste navegador.</p>
                ) : (
                  <div className="space-y-2.5">
                    {history.slice(0, 4).map(item => (
                      <div key={item.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-semibold text-white/62">{item.type.replaceAll('_', ' ')}</p>
                          <span className="shrink-0 rounded-full border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-[9px] text-white/38">
                            {item.status}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-white/38">{item.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
