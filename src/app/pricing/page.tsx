import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Check, Cpu, KeyRound, Layers3, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'CongChain Forge — Preços (BRL)',
  description: 'Planos do CongChain Forge em reais: Free, Pro e Enterprise. IA agêntica, memória verificável e modo local privado.',
};

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: 'R$ 0',
    period: '/mês',
    highlight: false,
    description: 'Para começar a construir e conhecer o Forge agêntico.',
    features: [
      'Loop agêntico (planejar → propor → verificar)',
      '4 modelos via NVIDIA: Llama · GLM · MiniMax · Qwen',
      'Modo local privado (Ollama) — sem custo de API',
      'Templates Solana-native (Anchor · pump.fun · SPL · dApp)',
      '20 memórias verificadas por dia',
      'Rate limit padrão por IP',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'R$ 29',
    period: '/mês',
    highlight: true,
    description: 'Para builders que querem modelos top e memória ilimitada no fluxo.',
    features: [
      'Tudo do Free',
      'GPT-4o · Claude · DeepSeek · Gemini',
      'Router de custo automático (tarefa simples → DeepSeek/Qwen)',
      'Apply All + Salvar memória do build em 1 clique',
      '200 memórias verificadas por dia',
      'BYOK: traga sua própria chave DeepSeek/Ollama',
      'Prioridade em fila (sem rate limit de IP)',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Sob consulta',
    period: '',
    highlight: false,
    description: 'Para times e empresas que precisam de controle e suporte.',
    features: [
      'Tudo do Pro',
      'Keys de API dedicadas (cog_live_...)',
      'Self-host / deploy privado',
      'Observabilidade e auditoria de builds',
      'SLA e onboarding com o time',
      'Faturamento em BRL ou USD',
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06060e] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-10rem] h-96 w-[46rem] -translate-x-1/2 rounded-full bg-[#9945FF]/10 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[-8rem] h-80 w-80 rounded-full bg-[#14F195]/6 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link
          href="/forge"
          className="mb-6 inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/55 transition-colors hover:text-white/85"
        >
          <ArrowLeft className="size-3.5" />
          Voltar ao Forge
        </Link>

        <header className="mb-10 text-center">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#14F195]/80">
            CongChain Forge · Preços em reais
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            IA agêntica que <span className="bg-gradient-to-r from-[#9945FF] via-[#00D1FF] to-[#14F195] bg-clip-text text-transparent">memoriza e prova</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/45">
            Construa com o loop agêntico, rode localmente com Ollama (privado e grátis) e salve cada build
            como memória verificável. Feito para o ecossistema Solana e para o Brasil.
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-3">
          {TIERS.map(tier => (
            <section
              key={tier.id}
              className={cn(
                'relative flex flex-col rounded-3xl border p-6',
                tier.highlight
                  ? 'border-[#14F195]/30 bg-gradient-to-b from-[#14F195]/[0.08] to-[#9945FF]/[0.06] shadow-[0_0_40px_rgba(20,241,149,0.12)]'
                  : 'border-white/[0.08] bg-white/[0.03]',
              )}
            >
              {tier.highlight ? (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full border border-[#14F195]/30 bg-[#06140d] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#14F195]">
                  Mais popular
                </span>
              ) : null}
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/50">{tier.name}</h2>
              <div className="mt-3 flex items-baseline gap-1">
                <span className={cn('text-3xl font-bold', tier.highlight ? 'text-[#14F195]' : 'text-white/85')}>{tier.price}</span>
                <span className="text-xs text-white/35">{tier.period}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-white/40">{tier.description}</p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {tier.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2 text-[12px] leading-5 text-white/62">
                    <Check className={cn('mt-0.5 size-3.5 shrink-0', tier.highlight ? 'text-[#14F195]' : 'text-[#00D1FF]/80')} />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/forge"
                className={cn(
                  'mt-6 flex min-h-10 items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-colors',
                  tier.highlight
                    ? 'border-[#14F195]/30 bg-[#14F195]/15 text-[#14F195] hover:bg-[#14F195]/20'
                    : 'border-white/[0.09] bg-white/[0.04] text-white/70 hover:border-[#00D1FF]/30 hover:text-white/90',
                )}
              >
                {tier.id === 'free' ? <Zap className="size-3.5" /> : tier.id === 'pro' ? <Layers3 className="size-3.5" /> : <KeyRound className="size-3.5" />}
                {tier.id === 'enterprise' ? 'Falar com o time' : 'Começar agora'}
              </Link>
            </section>
          ))}
        </div>

        <section className="mt-10 grid gap-4 rounded-3xl border border-white/[0.07] bg-white/[0.02] p-6 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#00D1FF]/20 bg-[#00D1FF]/10 text-[#5EEAD4]">
              <Cpu className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white/80">Modo local privado</p>
              <p className="mt-1 text-[11px] leading-5 text-white/40">
                Ollama na sua máquina: zero custo de API, dados nunca saem do computador.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#9945FF]/20 bg-[#9945FF]/10 text-[#C084FC]">
              <Layers3 className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white/80">Memória verificável</p>
              <p className="mt-1 text-[11px] leading-5 text-white/40">
                Cada build pode virar memória com hash — portátil entre modelos e sessões.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#14F195]/20 bg-[#14F195]/10 text-[#14F195]">
              <Zap className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white/80">Router de custo</p>
              <p className="mt-1 text-[11px] leading-5 text-white/40">
                Tarefa simples vai pro modelo barato (DeepSeek/Qwen); complexa pro mais forte.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-8 text-center text-[11px] text-white/25">
          Preços em BRL. Pagamento via SOL ou cartão (em breve). Hackathons e comunidades Solana: fale com a gente.
        </footer>
      </div>
    </main>
  );
}
