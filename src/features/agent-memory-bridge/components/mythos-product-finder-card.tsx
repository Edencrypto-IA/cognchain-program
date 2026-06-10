import { ExternalLink, SearchCheck, ShieldCheck, Star, Truck } from 'lucide-react';
import type { MythosProductFinderReport, MythosProductOffer } from '@/lib/commerce/product-finder';

function scoreColor(score: number) {
  if (score >= 82) return 'text-[#76FF03]';
  if (score >= 68) return 'text-[#FFD166]';
  return 'text-[#FF9AB1]';
}

function providerStatusLabel(status: MythosProductFinderReport['providerStatus'][number]['status']) {
  if (status === 'live') return 'ao vivo';
  if (status === 'fallback') return 'fallback IA';
  if (status === 'blocked') return 'bloqueado';
  if (status === 'unavailable') return 'indisponivel';
  return 'pendente';
}

function normalizeFinderSummary(text: string) {
  return text
    .replace(/\r/g, '')
    .replace(/\s*#{2,6}\s*/g, '\n')
    .replace(/\*\*/g, '')
    .replace(/\s+(?=\d+\.\s)/g, '\n')
    .replace(/\s+-\s+(?=[A-ZÀ-Úa-zà-ú])/g, '\n- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanFinderLine(line: string) {
  return line
    .replace(/^[-*]\s*/, '- ')
    .replace(/^Resumo\s*:\s*/i, 'Resumo:')
    .replace(/^Op[cç][oõ]es\s*:\s*/i, 'Opcoes:')
    .replace(/^Recomenda[cç][aã]o\s*:\s*/i, 'Recomendacao:')
    .replace(/^Cuidados\s*:\s*/i, 'Cuidados:')
    .trim();
}

type WebProductOption = {
  name: string;
  price: string | null;
  specs: string | null;
  reason: string | null;
  link: string | null;
};

function splitTitleAndPrice(value: string) {
  const clean = value.replace(/^\d+\.\s*/, '').trim();
  const parts = clean.split(/\s+-\s+/);
  if (parts.length < 2) return { name: clean, price: null };
  return {
    name: parts.slice(0, -1).join(' - ').trim(),
    price: parts[parts.length - 1].trim(),
  };
}

function extractUrl(value: string) {
  const match = value.match(/https?:\/\/[^\s)]+/i);
  return match?.[0] || null;
}

function parseWebSearchSummary(summary: string) {
  const lines = normalizeFinderSummary(summary)
    .split('\n')
    .map(cleanFinderLine)
    .filter(Boolean);

  const products: WebProductOption[] = [];
  const recommendation: string[] = [];
  const cautions: string[] = [];
  const intro: string[] = [];
  let current: WebProductOption | null = null;
  let section: 'intro' | 'options' | 'recommendation' | 'cautions' = 'intro';

  for (const line of lines) {
    if (/^Resumo:?$/i.test(line)) {
      section = 'intro';
      continue;
    }
    if (/^Opcoes:?$/i.test(line)) {
      section = 'options';
      continue;
    }
    if (/^(Recomendacao|Importante):?$/i.test(line)) {
      section = 'recommendation';
      current = null;
      continue;
    }
    if (/^Cuidados:?$/i.test(line)) {
      section = 'cautions';
      current = null;
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const { name, price } = splitTitleAndPrice(line);
      current = { name, price, specs: null, reason: null, link: null };
      products.push(current);
      section = 'options';
      continue;
    }

    if (current && section === 'options') {
      if (/^Specs:/i.test(line)) {
        current.specs = line.replace(/^Specs:\s*/i, '').trim();
        continue;
      }
      if (/^Por que vale:/i.test(line)) {
        current.reason = line.replace(/^Por que vale:\s*/i, '').trim();
        continue;
      }
      if (/^Link:/i.test(line)) {
        current.link = extractUrl(line) || line.replace(/^Link:\s*/i, '').trim();
        continue;
      }
      if (!current.reason) current.reason = line;
      continue;
    }

    if (section === 'recommendation') recommendation.push(line);
    else if (section === 'cautions') cautions.push(line);
    else intro.push(line);
  }

  return { intro, products, recommendation, cautions, lines };
}

function WebOptionCard({ option, index }: { option: WebProductOption; index: number }) {
  const hasUrl = option.link ? /^https?:\/\//i.test(option.link) : false;

  return (
    <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(118,255,3,0.1),transparent_38%),rgba(255,255,255,0.035)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#76FF03]">Opcao {index + 1}</p>
          <h4 className="mt-1 text-base font-black leading-5 text-white">{option.name}</h4>
        </div>
        <div className="shrink-0 rounded-full border border-[#FFD166]/20 bg-[#FFD166]/10 px-3 py-1 text-xs font-black text-[#FFE08A]">
          {option.price || 'preco a conferir'}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#7DE4FF]/12 bg-black/24 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9AEAFF]/70">Specs</p>
          <p className="mt-1 text-xs leading-5 text-white/66">{option.specs || 'Verificar capacidade, potencia e portas na loja.'}</p>
        </div>
        <div className="rounded-2xl border border-[#76FF03]/12 bg-black/24 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#B8FF79]/70">Por que vale</p>
          <p className="mt-1 text-xs leading-5 text-white/66">{option.reason || 'Boa opcao dentro do filtro informado.'}</p>
        </div>
      </div>

      {option.link ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
          <p className="min-w-0 truncate text-[11px] text-white/44">{option.link}</p>
          {hasUrl ? (
            <a
              href={option.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#7DE4FF]/20 bg-[#7DE4FF]/10 px-3 text-[10px] font-black uppercase tracking-[0.08em] text-[#BDF4FF] transition hover:bg-[#7DE4FF]/16"
            >
              Abrir <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FinderSummary({ summary }: { summary: string }) {
  const parsed = parseWebSearchSummary(summary);

  if (parsed.products.length) {
    return (
      <div className="space-y-4">
        {parsed.intro.length ? (
          <div className="rounded-2xl border border-[#7DE4FF]/12 bg-[#7DE4FF]/[0.045] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9AEAFF]">Resumo</p>
            <p className="mt-1 text-xs leading-5 text-white/66">{parsed.intro.join(' ')}</p>
          </div>
        ) : null}

        <div className="grid gap-3">
          {parsed.products.slice(0, 4).map((option, index) => (
            <WebOptionCard key={`${option.name}-${index}`} option={option} index={index} />
          ))}
        </div>

        {parsed.recommendation.length ? (
          <div className="rounded-2xl border border-[#76FF03]/14 bg-[#76FF03]/[0.055] p-4">
            <div className="flex items-center gap-2 text-[#B8FF79]">
              <SearchCheck className="h-4 w-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.14em]">Escolha Mythos</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-white/74">{parsed.recommendation.join(' ')}</p>
          </div>
        ) : null}

        {parsed.cautions.length ? (
          <div className="rounded-2xl border border-[#FFD166]/14 bg-[#FFD166]/[0.045] p-4">
            <div className="flex items-center gap-2 text-[#FFE08A]">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.14em]">Checar antes</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-white/62">{parsed.cautions.join(' ')}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {parsed.lines.map((line, index) => (
        <p key={`${index}-${line.slice(0, 18)}`} className="text-xs leading-5 text-white/66">
          {line}
        </p>
      ))}
    </div>
  );
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
  const intro = best
    ? report.summary
    : `Busca web ativa para ${report.normalizedQuery || report.query}. Resultados organizados abaixo com precos sujeitos a variacao.`;
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
          <p className="mt-2 max-w-2xl text-xs leading-5 text-white/54">{intro}</p>
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

      {!best && report.summary ? (
        <div className="border-b border-white/8 p-4">
          <div className="rounded-2xl border border-[#7DE4FF]/12 bg-black/24 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9AEAFF]">Recomendacao por busca web</p>
            <div className="mt-3">
              <FinderSummary summary={report.summary} />
            </div>
          </div>
        </div>
      ) : null}

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
        {report.providerStatus.map(item => `${item.marketplace}: ${providerStatusLabel(item.status)} (${item.detail})`).join(' | ')}
      </div>
    </div>
  );
}
