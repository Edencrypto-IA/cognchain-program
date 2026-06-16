'use client';

import { memo } from 'react';
import { AlertTriangle, CheckCircle2, CircleDot, GitBranch, ShieldCheck } from 'lucide-react';
import type { ForgeNexusPlan as ForgeNexusPlanType, ForgeNexusRisk } from '@/lib/forge/types';
import { cn } from '@/lib/utils';

const RISK_CLASS: Record<ForgeNexusRisk, string> = {
  low: 'border-[#14F195]/25 bg-[#14F195]/10 text-[#14F195]',
  medium: 'border-amber-300/25 bg-amber-400/10 text-amber-200',
  high: 'border-red-300/25 bg-red-500/10 text-red-200',
};

function ForgeNexusPlanComponent({ plan }: { plan: ForgeNexusPlanType | null }) {
  if (!plan) {
    return (
      <section className="rounded-2xl border border-white/[0.07] bg-black/25 p-4">
        <div className="flex items-center gap-2">
          <GitBranch className="size-4 text-[#00D4FF]" />
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#00D4FF]/80">Forge Nexus</p>
        </div>
        <h3 className="mt-3 text-xl font-semibold text-white/86">Strategus aguardando objetivo.</h3>
        <p className="mt-2 text-sm leading-6 text-white/42">
          Envie um prompt no terminal para gerar um plano DAG seguro antes de qualquer proposta de código.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#00D4FF]/18 bg-[#031012]/72 p-4 shadow-xl shadow-black/25">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <GitBranch className="size-4 text-[#00D4FF]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#00D4FF]/80">Forge Nexus Plan</p>
          </div>
          <h3 className="mt-2 text-xl font-semibold leading-tight text-white/90">{plan.summary}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/48">{plan.strategy}</p>
        </div>
        <span className={cn('rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]', RISK_CLASS[plan.risk])}>
          risk {plan.risk}
        </span>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/26">Nós</p>
          <p className="mt-1 text-2xl font-black text-white">{plan.estimatedSteps}</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/26">Review gate</p>
          <p className="mt-1 text-sm font-semibold text-[#14F195]">{plan.reviewGate.required ? 'obrigatório' : 'opcional'}</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/26">Criado</p>
          <p className="mt-1 font-mono text-xs text-white/62">{new Date(plan.createdAt).toLocaleString('pt-BR')}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {plan.nodes.map(node => (
          <article key={node.id} className="rounded-xl border border-white/[0.07] bg-black/24 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] font-mono text-[10px] text-white/62">
                    {node.id}
                  </span>
                  <h4 className="truncate text-sm font-semibold text-white/82">{node.title}</h4>
                </div>
                <p className="mt-2 text-xs leading-5 text-white/43">{node.detail}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase', RISK_CLASS[node.risk])}>
                  {node.risk}
                </span>
                <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2 py-0.5 text-[9px] font-semibold uppercase text-white/35">
                  {node.tactica}
                </span>
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <div className="rounded-lg bg-white/[0.025] p-2">
                <p className="text-[9px] uppercase tracking-[0.16em] text-white/22">Arquivos candidatos</p>
                <p className="mt-1 line-clamp-2 font-mono text-[11px] text-white/42">{node.files.length ? node.files.join(', ') : 'nenhum arquivo direto'}</p>
              </div>
              <div className="rounded-lg bg-white/[0.025] p-2">
                <p className="text-[9px] uppercase tracking-[0.16em] text-white/22">Checks</p>
                <p className="mt-1 line-clamp-2 text-[11px] text-white/42">{node.checks.join(' | ')}</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white/[0.025] p-2">
                <CircleDot className="size-3.5 text-[#00D4FF]" />
                <span className="font-mono text-[11px] text-white/48">{node.confidence}%</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <div className="rounded-xl border border-[#14F195]/15 bg-[#14F195]/8 p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#14F195]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#14F195]/80">Safety</p>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-white/46">
            {plan.safety.map(item => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#14F195]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-amber-300/15 bg-amber-400/8 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-200" />
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-100/80">Review</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-white/46">{plan.reviewGate.reason}</p>
        </div>
      </div>
    </section>
  );
}

export const ForgeNexusPlan = memo(ForgeNexusPlanComponent);
