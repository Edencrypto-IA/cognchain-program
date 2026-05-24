'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  Copy,
  ExternalLink,
  Hammer,
  KeyRound,
  Search,
  ShieldCheck,
  TerminalSquare,
  Wrench,
} from 'lucide-react';
import { MYTHOS_AGENT_PROFILE, MYTHOS_RUNTIME_PROOF } from '../mythos';

type DemoMode = 'transaction' | 'anchor' | 'rpc';

const DEMOS: Array<{
  id: DemoMode;
  title: string;
  eyebrow: string;
  description: string;
  placeholder: string;
  skill: string;
  value: string;
  evidence: string[];
  decision: string;
  nextStep: string;
}> = [
  {
    id: 'transaction',
    title: 'Analyze Transaction',
    eyebrow: 'TX DEBUG',
    description:
      'Paste a Solana transaction signature or describe a failed transaction. Mythos prepares a verified debugging brief.',
    placeholder: 'Paste tx signature or describe the failure, e.g. "custom program error 0x1 after token transfer"...',
    skill: 'solana-tx-inspector',
    value: 'Best for support teams, RPC providers, wallets, and Solana app developers.',
    evidence: [
      'Transaction signature or error text',
      'Program logs and invoked programs',
      'Account changes, token accounts, compute budget, and fee context',
      'Explorer/RPC evidence when connected mode is enabled',
    ],
    decision:
      'Classify the failure, identify likely root cause, explain why it happened, and produce a memory-ready incident summary.',
    nextStep:
      'Connect Helius/RPC evidence, run the real Mythos runtime, then save the approved summary as CongChain memory.',
  },
  {
    id: 'anchor',
    title: 'Debug Anchor Program',
    eyebrow: 'PROGRAM REVIEW',
    description:
      'Paste an Anchor error, program ID, or repo context. Mythos turns it into an auditable fix plan.',
    placeholder: 'Paste Anchor error, logs, program ID, or a short repo/debug description...',
    skill: 'forge-lsp + solana-anchor-schema-validator',
    value: 'Best for Solana devrel, audits, hackathon projects, and protocol engineering teams.',
    evidence: [
      'Anchor error code and stack/log snippet',
      'IDL/account constraints when available',
      'PDA seeds, signer/writable account expectations, and instruction context',
      'Repository references through LSP/code inspection in connected mode',
    ],
    decision:
      'Map the error to likely constraint, account, seed, signer, rent, or serialization issue and propose a minimal safe patch.',
    nextStep:
      'Run with repository access in a sandbox, review the patch manually, then store the final debug note with hash proof.',
  },
  {
    id: 'rpc',
    title: 'Explain Wallet/RPC Issue',
    eyebrow: 'RPC + WALLET',
    description:
      'Describe a wallet, RPC, webhook, priority fee, or indexing issue. Mythos creates a DevRel-ready answer.',
    placeholder: 'Describe the user-facing issue, RPC response, wallet behavior, or webhook problem...',
    skill: 'solana-wallet-ecosystem-bridge',
    value: 'Best for infrastructure teams such as RPC providers, wallet teams, and ecosystem support.',
    evidence: [
      'RPC response/error and timing context',
      'Wallet adapter state, cluster, endpoint, and user-visible action',
      'Priority fee, blockhash, confirmation, or indexing symptoms',
      'Provider docs or status evidence when web search is enabled',
    ],
    decision:
      'Separate app bug, wallet UX issue, RPC/indexer behavior, cluster condition, or user configuration problem.',
    nextStep:
      'Attach real provider evidence, prepare a support-safe explanation, and save only the redacted conclusion.',
  },
];

const KILLER_POINTS = [
  'Solana-native debugging surface instead of generic chat.',
  'Every approved analysis can become a hash-addressable memory.',
  'Another agent can continue from the proof instead of restarting context.',
  'Runtime evidence stays metadata-only: model, skill, source, hash, safety result.',
  'No wallet signing, funds movement, provider secrets, or hidden credentials.',
];

function short(value: string, length = 18) {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function buildReport(mode: typeof DEMOS[number], input: string) {
  const subject = input.trim() || `Demo request for ${mode.title}`;
  return [
    `Mythos Solana Developer Brief`,
    `Mode: ${mode.title}`,
    `Governing skill: ${mode.skill}`,
    `Subject: ${subject}`,
    ``,
    `Evidence to collect:`,
    ...mode.evidence.map(item => `- ${item}`),
    ``,
    `Decision pattern: ${mode.decision}`,
    `Next human step: ${mode.nextStep}`,
    ``,
    `CongChain memory plan: save only the approved summary, source=mythos, contentType=mythos_solana_debug, vault=Mythos.`,
    `Safety: no API keys, no private keys, no seed phrases, no signed payloads, no fund movement.`,
  ].join('\n');
}

export default function MythosSolanaDevConsole() {
  const [mode, setMode] = useState<DemoMode>('transaction');
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const active = DEMOS.find(item => item.id === mode) || DEMOS[0];
  const report = useMemo(() => buildReport(active, input), [active, input]);

  async function copyReport() {
    await navigator.clipboard?.writeText(report).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <main className="min-h-screen bg-[#05050b] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a href="/mythos" className="inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white/80">
            <ArrowLeft className="h-4 w-4" />
            Back to Mythos
          </a>
          <div className="flex flex-wrap gap-2">
            <a href="/mythos/lab" className="inline-flex items-center gap-2 rounded-xl border border-[#76FF03]/20 bg-[#76FF03]/10 px-3 py-2 text-xs font-bold text-[#A7FF3D]">
              <TerminalSquare className="h-4 w-4" />
              Mythos Lab
            </a>
            <a href="/brain?view=agents&agent=mythos" className="inline-flex items-center gap-2 rounded-xl border border-[#14F195]/20 bg-[#14F195]/10 px-3 py-2 text-xs font-bold text-[#14F195]">
              <Brain className="h-4 w-4" />
              Memory Brain
            </a>
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-[#76FF03]/25 bg-[radial-gradient(circle_at_top_left,rgba(118,255,3,0.15),transparent_34%),linear-gradient(135deg,rgba(7,20,8,0.96),rgba(4,5,10,0.98))]">
          <div className="grid gap-6 p-5 lg:grid-cols-[220px_1fr] lg:p-7">
            <div className="flex items-center justify-center">
              <div className="h-44 w-44 overflow-hidden rounded-full border border-[#76FF03]/35 bg-black shadow-[0_0_60px_rgba(118,255,3,0.22)]">
                <img src={MYTHOS_AGENT_PROFILE.image} alt="" className="h-full w-full object-cover" />
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-[#76FF03]/24 bg-[#76FF03]/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#A7FF3D]">
                  Solana Developer Copilot
                </span>
                <span className="rounded-full border border-[#5AD7FF]/20 bg-[#5AD7FF]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#7DE4FF]">
                  Verifiable debug memory
                </span>
              </div>
              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
                Mythos for Solana Developers
              </h1>
              <p className="mt-4 max-w-4xl text-sm leading-6 text-white/62 sm:text-base">
                A focused demo for the people who build Solana infrastructure: transaction debugging, Anchor program review, wallet/RPC explanations, and hash-addressable memory that another agent can continue from.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ['Memory proof', short(MYTHOS_RUNTIME_PROOF.shortHash, 16)],
                  ['Runtime skills', `${MYTHOS_RUNTIME_PROOF.totalRuntimeSkillsEnabled} enabled`],
                  ['CongChain skills', `${MYTHOS_RUNTIME_PROOF.installedCongChainSkills} installed`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-black/26 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/34">{label}</p>
                    <p className="mt-1 text-sm font-bold text-white/78">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-2xl border border-[#76FF03]/18 bg-[#071008] p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Choose a Solana workflow</p>
            <div className="mt-4 grid gap-3">
              {DEMOS.map(item => {
                const selected = item.id === mode;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMode(item.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? 'border-[#76FF03]/35 bg-[#76FF03]/10'
                        : 'border-white/8 bg-black/24 hover:border-white/14 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#76FF03]">{item.eyebrow}</p>
                        <h2 className="mt-1 text-base font-black text-white">{item.title}</h2>
                      </div>
                      {selected ? <CheckCircle2 className="h-5 w-5 text-[#76FF03]" /> : <Wrench className="h-5 w-5 text-white/28" />}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/50">{item.description}</p>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="grid gap-4">
            <section className="rounded-2xl border border-[#5AD7FF]/18 bg-[radial-gradient(circle_at_top_right,rgba(90,215,255,0.10),transparent_30%),rgba(5,10,14,0.90)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7DE4FF]">{active.eyebrow}</p>
                  <h2 className="mt-1 text-2xl font-black">{active.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/52">{active.value}</p>
                </div>
                <span className="rounded-xl border border-[#14F195]/18 bg-[#14F195]/10 px-3 py-2 text-xs font-bold text-[#14F195]">
                  Skill: {active.skill}
                </span>
              </div>

              <textarea
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder={active.placeholder}
                className="mt-4 min-h-[128px] w-full resize-none rounded-2xl border border-white/10 bg-black/34 p-4 text-sm leading-6 text-white/78 outline-none transition placeholder:text-white/25 focus:border-[#76FF03]/35"
              />

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyReport}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#76FF03]/25 bg-[#76FF03]/12 px-4 text-sm font-bold text-[#A7FF3D] transition hover:bg-[#76FF03]/18"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copied brief' : 'Copy debug brief'}
                </button>
                <a
                  href="/dashboard/keys"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#5AD7FF]/20 bg-[#5AD7FF]/10 px-4 text-sm font-bold text-[#7DE4FF] transition hover:bg-[#5AD7FF]/15"
                >
                  <KeyRound className="h-4 w-4" />
                  Create agent key
                </a>
                <a
                  href="/memory/b727b1e1715680f4ef234f4d46cc76e7625ff36c1594a4165baf71c8cc1b570c"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white/62 transition hover:bg-white/[0.07]"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open proof example
                </a>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
              <div className="rounded-2xl border border-white/8 bg-black/26 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/38">Generated operator brief</p>
                <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl border border-white/8 bg-[#030306] p-4 text-xs leading-6 text-white/64">
                  {report}
                </pre>
              </div>

              <aside className="rounded-2xl border border-[#FACC15]/18 bg-[#FACC15]/[0.045] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FACC15]">Why Mert/Toly would care</p>
                <div className="mt-4 space-y-3">
                  {KILLER_POINTS.map(point => (
                    <div key={point} className="flex gap-3 rounded-xl border border-white/8 bg-black/22 p-3 text-xs leading-5 text-white/56">
                      <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#14F195]" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-[#FF5C8A]/14 bg-[#FF5C8A]/[0.04] p-3">
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#FF7AA2]" />
                    <p className="text-xs leading-5 text-white/56">
                      This page prepares a safe Solana debugging brief. Real provider evidence, browser actions, Telegram/Discord delivery, and memory writes require explicit connected-mode configuration.
                    </p>
                  </div>
                </div>
              </aside>
            </section>
          </div>
        </section>

        <section className="rounded-2xl border border-[#14F195]/18 bg-[#14F195]/[0.035] p-4">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ['Evidence used', active.evidence.join(', ')],
              ['Decision trace', active.decision],
              ['Memory result', 'Approved output can be saved as source=mythos and contentType=mythos_solana_debug.'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/8 bg-black/24 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#14F195]">{label}</p>
                <p className="mt-2 text-xs leading-5 text-white/54">{value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
