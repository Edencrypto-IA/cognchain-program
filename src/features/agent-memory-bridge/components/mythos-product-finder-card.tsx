import { ExternalLink, ShieldCheck, Star, Truck } from 'lucide-react';
import type { MythosProductFinderReport, MythosProductOffer } from '@/lib/commerce/product-finder';

function scoreColor(score: number) {
  if (score >= 82) return 'text-[#76FF03]';
  if (score >= 68) return 'text-[#FFD166]';
  return 'text-[#FF9AB1]';
}

function OfferMini({ offer }: { offer: MythosProductOffer }) {
  return (
    <a
      href={offer.url}
      target="_blank"
      rel="noreferrer"
      className="grid grid-cols-[54px_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 transition hover:border-[#7DE4FF]/26 hover:bg-[#7DE4FF]/[0.055]"
    >
      <div className="h-14 w-14 overflow-hidden rounded-xl border border-white/10 bg-black/28">
        {offer.image ? <img src={offer.image} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-xs font-black leading-4 text-white">{offer.title}</p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/42">{offer.marketplaceLabel}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-black text-white">{offer.priceLabel}</p>
        <p className={`text-[11px] font-black ${scoreColor(offer.score)}`}>{offer.score}/100</p>
      </div>
    </a>
  );
}

export function MythosProductFinderCard({ report }: { report: MythosProductFinderReport }) {
  const best = report.bestOffer;
  const priceStats = report.priceStats || {
    minLabel: null,
    medianLabel: null,
    withinBudgetCount: 0,
    scannedCount: report.offers.length,
  };
  const watchPlan = report.watchPlan || {
    targetPriceLabel: null,
    trigger: 'Preparar alerta quando uma oferta confiavel aparecer abaixo do alvo definido.',
    cadence: 'Futuro monitor: checagem diaria ou sob demanda, sem compra automatica.',
    note: 'Nenhum monitor recorrente foi criado automaticamente.',
  };

  return (
    <div className="mt-4 overflow-hidden rounded-[22px] border border-[#7DE4FF]/18 bg-[radial-gradient(circle_at_top_left,rgba(125,228,255,0.13),transparent_36%),rgba(2,13,16,0.92)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 px-4 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9AEAFF]">Product Finder Agent</p>
          <h3 className="mt-1 text-2xl font-black text-white">Melhor oportunidade encontrada</h3>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-white/54">{report.summary}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-black/28 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-white/56">
          {report.budgetLabel ? `orcamento ${report.budgetLabel}` : 'sem orcamento'}
        </div>
      </div>

      <div className="grid gap-3 border-b border-white/8 p-4 sm:grid-cols-4">
        {[
          ['Menor preco', priceStats.minLabel || 'indisponivel'],
          ['Mediana', priceStats.medianLabel || 'indisponivel'],
          ['Dentro do orcamento', report.budgetLabel ? `${priceStats.withinBudgetCount}/${priceStats.scannedCount}` : 'sem orcamento'],
          ['Alerta alvo', watchPlan.targetPriceLabel || 'sob demanda'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#7DE4FF]/12 bg-black/24 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9AEAFF]/70">{label}</p>
            <p className="mt-1 text-sm font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      {best ? (
        <div className="grid gap-4 p-4 lg:grid-cols-[280px_1fr]">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/28">
            <div className="aspect-square bg-white/[0.035]">
              {best.image ? <img src={best.image} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="border-t border-white/8 p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/34">preco</p>
                  <p className="mt-1 text-2xl font-black text-white">{best.priceLabel}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-black ${scoreColor(best.score)}`}>{best.score}/100</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/40">{best.scoreLabel}</p>
                </div>
              </div>
              <a
                href={best.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#76FF03]/25 bg-[#76FF03]/12 text-xs font-black uppercase tracking-[0.1em] text-[#C8FF8A] transition hover:bg-[#76FF03]/18"
              >
                Abrir oferta <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/24 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#76FF03]">Recomendacao</p>
              <h4 className="mt-2 text-xl font-black leading-7 text-white">{best.title}</h4>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  ['Marketplace', best.marketplaceLabel],
                  ['Vendedor', best.sellerName || 'nao informado'],
                  ['Reputacao', best.sellerStatus || 'nao informada'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/34">{label}</p>
                    <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-2xl border border-[#7DE4FF]/12 bg-[#7DE4FF]/[0.045] p-3 text-xs leading-5 text-white/62">
                Escolha Mythos: {best.rankReason || 'melhor equilibrio entre preco, reputacao visivel e risco aparente'}.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[#76FF03]/14 bg-[#76FF03]/[0.045] p-4">
                <div className="flex items-center gap-2 text-[#B8FF79]">
                  <Star className="h-4 w-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.14em]">Pontos fortes</p>
                </div>
                <ul className="mt-3 space-y-2 text-xs leading-5 text-white/62">
                  {best.strengths.map(item => <li key={item}>- {item}</li>)}
                </ul>
              </div>
              <div className="rounded-2xl border border-[#FFD166]/14 bg-[#FFD166]/[0.045] p-4">
                <div className="flex items-center gap-2 text-[#FFE08A]">
                  <ShieldCheck className="h-4 w-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.14em]">Checar antes</p>
                </div>
                <ul className="mt-3 space-y-2 text-xs leading-5 text-white/62">
                  {best.risks.map(item => <li key={item}>- {item}</li>)}
                </ul>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ['Frete', best.freeShipping ? 'gratis informado' : 'ver no checkout', Truck],
                ['Vendas', best.soldQuantity === null ? 'nao informado' : String(best.soldQuantity), Star],
                ['Historico vendedor', best.sellerTransactions === null ? 'nao informado' : String(best.sellerTransactions), ShieldCheck],
              ].map(([label, value, Icon]) => (
                <div key={String(label)} className="rounded-2xl border border-white/10 bg-black/22 p-3">
                  <Icon className="h-4 w-4 text-[#9AEAFF]" />
                  <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/34">{String(label)}</p>
                  <p className="mt-1 text-sm font-black text-white">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {report.offers.length > 1 ? (
        <div className="border-t border-white/8 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Alternativas</p>
          <div className="mt-3 grid gap-3">
            {report.offers.slice(1, 6).map(offer => <OfferMini key={offer.id} offer={offer} />)}
          </div>
        </div>
      ) : null}

      <div className="border-t border-white/8 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FFD166]">Plano de alerta futuro</p>
        <p className="mt-2 text-xs leading-5 text-white/58">{watchPlan.trigger}</p>
        <p className="mt-1 text-[11px] leading-5 text-white/40">{watchPlan.cadence} {watchPlan.note}</p>
      </div>

      <div className="border-t border-white/8 px-4 py-3 text-[11px] leading-5 text-white/42">
        {report.providerStatus.map(item => `${item.marketplace}: ${item.status === 'live' ? 'ao vivo' : 'pendente'} (${item.detail})`).join(' | ')}
      </div>
    </div>
  );
}
