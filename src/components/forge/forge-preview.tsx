'use client';

import { memo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Code2, ExternalLink, Globe2, LockKeyhole, Play, ReceiptText, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import type { ForgeFile, ForgeNexusPlan, ForgePhase, ForgeRunStatus } from '@/lib/forge/types';
import { RUN_STATUS_LABELS } from '@/lib/forge/forge-ui';
import { ForgeNexusPlan as ForgeNexusPlanView } from './forge-nexus-plan';

type PreviewMode = 'product' | 'receipt' | 'code' | 'live';

function ForgePreviewComponent({
  phase,
  runStatus,
  files,
  selectedFile,
  busy,
  canReplay,
  onPrivatePayDemo,
  onReplayLast,
  nexusPlan,
}: {
  phase: ForgePhase;
  runStatus: ForgeRunStatus;
  files: ForgeFile[];
  selectedFile: string;
  busy: boolean;
  canReplay: boolean;
  onPrivatePayDemo: () => void;
  onReplayLast: () => void;
  nexusPlan: ForgeNexusPlan | null;
}) {
  const [mode, setMode] = useState<PreviewMode>('product');
  const [pulseKey, setPulseKey] = useState(0);

  const active = ['building', 'deploying', 'complete'].includes(phase);
  const streaming = runStatus === 'streaming';
  const connecting = runStatus === 'connecting';
  const selected = files.find(file => file.path === selectedFile) ?? files.find(file => file.contents);
  const htmlFile = files.find(file => file.path.endsWith('.html') && file.contents.trim());
  const previewDoc = htmlFile?.contents || `<!doctype html>
<html><head><meta charset="utf-8" /><style>
body{margin:0;background:#050505;color:white;font-family:Inter,system-ui,sans-serif}
main{min-height:100vh;display:grid;place-items:center;padding:32px;background:radial-gradient(circle at 70% 20%,rgba(0,255,156,.18),transparent 32%),radial-gradient(circle at 20% 80%,rgba(0,212,255,.14),transparent 30%)}
.card{width:min(720px,92vw);border:1px solid rgba(255,255,255,.12);border-radius:28px;background:rgba(255,255,255,.045);padding:34px;box-shadow:0 24px 80px rgba(0,0,0,.45)}
p{color:rgba(255,255,255,.58);line-height:1.7} h1{font-size:clamp(34px,7vw,74px);line-height:.95;margin:10px 0 18px}.pill{color:#00ff9c;letter-spacing:.22em;font-size:12px;text-transform:uppercase}.btn{display:inline-flex;margin-top:18px;padding:13px 18px;border-radius:999px;background:#00ff9c;color:#04110b;font-weight:800}
code{color:#00d4ff}
</style></head><body><main><section class="card"><div class="pill">Forge live preview</div><h1>${selected?.path ?? 'CognChain app'}</h1><p>This sandbox renders the selected Forge artifact as an isolated preview. It cannot sign, submit, buy, sell, schedule, or move funds.</p><p><code>${(selected?.contents || 'Select or generate a file to preview.').slice(0, 220).replace(/[<>&]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char] ?? char))}</code></p><span class="btn">Preview only</span></section></main></body></html>`;

  const bumpPulse = useCallback(() => {
    setPulseKey(k => k + 1);
  }, []);

  const progressByPhase: Record<ForgePhase, number> = {
    idle: 8,
    thinking: 18,
    planning: 34,
    building: 64,
    deploying: 86,
    complete: 100,
    error: 18,
  };

  const statusLabel: Record<ForgePhase, string> = {
    idle: 'Waiting for prompt',
    thinking: RUN_STATUS_LABELS.connecting,
    planning: 'Architecting PrivatePay',
    building: RUN_STATUS_LABELS.streaming,
    deploying: 'Preparing proof capsule',
    complete: 'Receipt layer ready',
    error: 'Recovery needed',
  };

  const codePreview = phase === 'idle' && runStatus === 'idle'
    ? `// Waiting for Forge prompt
export function PrivatePay() {
  return <EncryptedCheckout />;
}`
    : `const receipt = await createPrivatePaymentIntent({
  recipient: '7xP4...9kL2',
  amountSol: 2.4,
  memoHash: 'sha256:sealed'
});

derivePrivateReceiptProof(receipt.paymentHash);`;

  const proofSteps = [
    { label: 'Intent encrypted', ready: streaming || ['deploying', 'complete'].includes(phase) },
    { label: 'Receipt proof derived', ready: ['deploying', 'complete'].includes(phase) },
    { label: 'Solana anchor ready', ready: phase === 'complete' && runStatus === 'complete' },
  ];

  return (
    <div className="flex h-full min-h-[min(430px,42vh)] flex-col overflow-hidden bg-[#050505] lg:min-h-[430px]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-2 py-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-1">
          <span className="size-2 shrink-0 rounded-full bg-red-400/70 sm:size-2.5" />
          <span className="size-2 shrink-0 rounded-full bg-yellow-400/70 sm:size-2.5" />
          <span className="size-2 shrink-0 rounded-full bg-[#14F195]/70 sm:size-2.5" />
        </div>
        <span className="min-w-0 truncate rounded-full border border-white/[0.07] bg-white/[0.035] px-2 py-1 text-[10px] text-white/35 sm:px-3 sm:text-[11px]">
          privatepay.preview.local
        </span>
        <div className="flex shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.025] p-0.5">
          {(
            [
              ['product', WalletCards],
              ['receipt', ReceiptText],
              ['code', Code2],
              ['live', Globe2],
            ] as const
          ).map(([itemMode, Icon]) => (
            <button
              key={itemMode}
              type="button"
              onClick={() => {
                setMode(itemMode);
                bumpPulse();
              }}
              className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] transition-colors sm:gap-1.5 sm:px-2 sm:text-[11px] ${
                mode === itemMode ? 'bg-white/[0.08] text-white/80' : 'text-white/32 hover:text-white/65'
              }`}
            >
              <Icon className="size-3 shrink-0" />
              <span className="hidden capitalize sm:inline">{itemMode}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
        {/* FORGE_UPGRADE: Nexus Fase 1 renders a read-only DAG plan before edits or execution. */}
        <div className="relative z-[3] mb-4">
          <ForgeNexusPlanView plan={nexusPlan} />
        </div>
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#9945FF]/15 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-44 w-44 rounded-full bg-[#14F195]/10 blur-3xl" />
        <div className="absolute left-1/2 top-10 h-56 w-56 -translate-x-1/2 rounded-full bg-[#38BDF8]/10 blur-3xl" />

        <motion.div
          key={pulseKey}
          className="relative min-h-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#09090B]/92 p-4 shadow-2xl shadow-black/40 sm:rounded-3xl sm:p-5"
          animate={{ y: active ? [0, -3, 0] : 0 }}
          transition={{ duration: 4, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(153,69,255,0.20),transparent_34%),radial-gradient(circle_at_14%_74%,rgba(20,241,149,0.12),transparent_28%)]" />
          {streaming && (
            <motion.div
              className="pointer-events-none absolute inset-0 z-[1] rounded-2xl ring-2 ring-[#14F195]/20 sm:rounded-3xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.35, 0.65, 0.35] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          <div className="relative z-[2] flex min-h-[34rem] flex-col lg:min-h-[31rem]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#14F195]/75">PrivatePay Preview</p>
                <h3 className="mt-2 max-w-lg text-2xl font-semibold leading-tight text-white sm:text-3xl">
                  Private payments for Solana teams.
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/46">
                  Encrypted payment intents, receipt proofs, and a clean checkout surface — demo UI only, no chain execution.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onPrivatePayDemo}
                  disabled={busy}
                  className="flex min-h-9 items-center gap-2 rounded-full border border-[#14F195]/20 bg-[#14F195]/10 px-3 py-2 text-[11px] font-semibold text-[#14F195] transition-colors hover:bg-[#14F195]/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Play className="size-3.5 shrink-0" />
                  Run PrivatePay demo
                </button>
                <button
                  type="button"
                  onClick={onReplayLast}
                  disabled={!canReplay || busy}
                  className="flex min-h-9 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white/55 transition-colors hover:border-[#9945FF]/30 hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles className="size-3.5 shrink-0" />
                  Replay build
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'product' ? 'receipt' : 'product');
                    bumpPulse();
                  }}
                  className="grid size-9 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/40 transition-colors hover:text-white/75"
                  aria-label="Toggle product and receipt preview"
                >
                  <ExternalLink className="size-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 grid flex-1 gap-3 lg:mt-5 lg:grid-cols-[1.05fr_0.95fr] lg:gap-4">
              <motion.div
                key={`${mode}-${phase}`}
                initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="flex min-h-0 flex-col rounded-2xl border border-white/[0.07] bg-black/30 p-3 sm:p-4"
              >
                {mode === 'live' ? (
                  <iframe
                    title="Forge live sandbox preview"
                    sandbox=""
                    srcDoc={previewDoc}
                    className="min-h-[28rem] flex-1 rounded-2xl border border-[#00D4FF]/20 bg-black"
                  />
                ) : mode === 'code' ? (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/30">Live generated code</p>
                        <p className="mt-1 text-sm font-semibold text-white/78">solana/private-payment-proof.ts</p>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                          streaming ? 'border-[#14F195]/30 bg-[#14F195]/15 text-[#14F195]' : 'border-[#38BDF8]/20 bg-[#38BDF8]/10 text-[#7DD3FC]'
                        }`}
                      >
                        {connecting ? 'connecting' : streaming ? 'streaming' : 'idle'}
                      </span>
                    </div>
                    <pre className="mt-3 min-h-0 flex-1 overflow-auto rounded-2xl border border-white/[0.06] bg-[#050505]/80 p-3 font-mono text-[11px] leading-6 text-white/62 sm:mt-4 sm:p-4 sm:text-[12px]">
                      <code>{codePreview}</code>
                    </pre>
                  </div>
                ) : mode === 'receipt' ? (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="grid size-8 place-items-center rounded-xl bg-[#14F195]/12 text-[#14F195]">
                        <ReceiptText className="size-4" />
                      </span>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/30">Private receipt</p>
                        <p className="text-sm font-semibold text-white/78">ZK-ready payment capsule</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:mt-5 sm:gap-3">
                      {[
                        ['payment hash', phase === 'complete' ? '0x8f4e...a91c' : connecting ? '…' : 'deriving…'],
                        ['recipient commitment', 'sha256:7xP4...9kL2'],
                        ['amount commitment', phase === 'idle' && runStatus === 'idle' ? 'pending' : 'pedersen:sealed'],
                        ['network', 'solana-devnet'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-3">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-white/28">{label}</p>
                          <p className="mt-1 font-mono text-sm text-white/72">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-xl bg-[#9945FF]/15 text-[#C084FC]">
                          <LockKeyhole className="size-4" />
                        </span>
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/30">Transfer intent</p>
                          <p className="text-sm font-semibold text-white/78">Encrypted checkout</p>
                        </div>
                      </div>
                      <span className="rounded-full border border-[#14F195]/20 bg-[#14F195]/10 px-2.5 py-1 text-[10px] font-semibold text-[#14F195]">
                        {statusLabel[phase]}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2 sm:mt-5 sm:space-y-3">
                      {[
                        ['Recipient', '7xP4...9kL2'],
                        ['Amount', '2.40 SOL'],
                        ['Private memo', phase === 'complete' ? 'sealed and hashed' : streaming ? 'streaming…' : 'encrypting'],
                      ].map(([label, value]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={bumpPulse}
                          className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.035] p-3 text-left transition-colors hover:border-[#9945FF]/25 hover:bg-white/[0.055]"
                        >
                          <p className="text-[10px] uppercase tracking-[0.16em] text-white/28">{label}</p>
                          <p className="mt-1 font-mono text-sm text-white/72">{value}</p>
                        </button>
                      ))}
                    </div>

                    <div className="mt-auto pt-3 sm:pt-4">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-[#9945FF] via-[#38BDF8] to-[#14F195]"
                          animate={{ width: `${progressByPhase[phase]}%` }}
                          transition={{ duration: 0.45, ease: 'easeOut' }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={bumpPulse}
                        className="mt-3 flex w-full min-h-11 items-center justify-center gap-2 rounded-2xl border border-[#14F195]/25 bg-[#14F195]/12 px-4 py-3 text-sm font-semibold text-[#D8FFF0] transition-colors hover:bg-[#14F195]/18 sm:mt-4"
                      >
                        <WalletCards className="size-4 shrink-0" />
                        {phase === 'complete' ? 'Receipt proof ready (demo)' : 'Generate private receipt (demo)'}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>

              <div className="flex min-h-0 flex-col gap-2 sm:gap-3">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-[#14F195]" />
                    <p className="text-sm font-semibold text-white/78">Proof rail</p>
                  </div>
                  <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                    {proofSteps.map(step => (
                      <div key={step.label} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/24 px-3 py-2">
                        <span className="text-xs text-white/55">{step.label}</span>
                        <span className={step.ready ? 'text-[#14F195]' : 'text-white/20'}>
                          {step.ready ? <Check className="size-4" /> : <span className="block size-2 rounded-full border border-current" />}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="min-h-0 flex-1 rounded-2xl border border-[#9945FF]/15 bg-[#9945FF]/[0.05] p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-[#C084FC]" />
                    <p className="text-sm font-semibold text-white/80">Live build</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/48 sm:mt-3">
                    {phase === 'complete'
                      ? 'Forge assembled the PrivatePay interface shell in this sandbox. Model output streams in the terminal below.'
                      : 'Agents stay in sync with model phases: connect → stream → complete. Preview stays mounted while you read the stream.'}
                  </p>
                  {(busy || streaming) && (
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-[#14F195]/80 sm:mt-4">
                      <span className="size-1.5 animate-pulse rounded-full bg-[#14F195]" />
                      {RUN_STATUS_LABELS[runStatus]}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export const ForgePreview = memo(ForgePreviewComponent);
