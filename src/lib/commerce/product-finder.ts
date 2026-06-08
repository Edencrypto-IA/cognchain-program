const MERCADO_LIVRE_API = 'https://api.mercadolibre.com';

export type MythosProductMarketplace = 'mercado_livre';

export type MythosProductOffer = {
  id: string;
  marketplace: MythosProductMarketplace;
  marketplaceLabel: string;
  title: string;
  price: number;
  priceLabel: string;
  originalPrice: number | null;
  originalPriceLabel: string | null;
  discountPercent: number | null;
  url: string;
  image: string | null;
  condition: string | null;
  freeShipping: boolean;
  sellerId: number | null;
  sellerName: string | null;
  sellerStatus: string | null;
  sellerTransactions: number | null;
  soldQuantity: number | null;
  availableQuantity: number | null;
  score: number;
  scoreLabel: string;
  rankReason: string;
  strengths: string[];
  risks: string[];
};

export type MythosProductPriceStats = {
  min: number | null;
  minLabel: string | null;
  median: number | null;
  medianLabel: string | null;
  average: number | null;
  averageLabel: string | null;
  max: number | null;
  maxLabel: string | null;
  withinBudgetCount: number;
  scannedCount: number;
};

export type MythosProductWatchPlan = {
  available: true;
  targetPrice: number | null;
  targetPriceLabel: string | null;
  trigger: string;
  cadence: string;
  note: string;
};

export type MythosProductFinderReport = {
  ok: true;
  generatedAt: string;
  query: string;
  normalizedQuery: string;
  budgetBrl: number | null;
  budgetLabel: string | null;
  bestOffer: MythosProductOffer | null;
  offers: MythosProductOffer[];
  priceStats: MythosProductPriceStats;
  watchPlan: MythosProductWatchPlan;
  providerStatus: Array<{
    marketplace: string;
    status: 'live' | 'pending_connector';
    detail: string;
  }>;
  summary: string;
  safety: {
    readOnlySearch: true;
    noPurchaseExecution: true;
    noPaymentExecution: true;
    notSponsored: true;
    sources: string[];
  };
};

type MercadoLivreSearchResult = {
  id?: string;
  title?: string;
  price?: number;
  original_price?: number | null;
  permalink?: string;
  thumbnail?: string;
  condition?: string;
  shipping?: { free_shipping?: boolean };
  seller?: { id?: number; nickname?: string };
  seller_address?: unknown;
  sold_quantity?: number;
  available_quantity?: number;
  official_store_id?: number | null;
};

type MercadoLivreSearchResponse = {
  results?: MercadoLivreSearchResult[];
};

type MercadoLivreUser = {
  id?: number;
  nickname?: string;
  seller_reputation?: {
    level_id?: string | null;
    power_seller_status?: string | null;
    transactions?: {
      completed?: number;
      ratings?: {
        positive?: number;
        neutral?: number;
        negative?: number;
      };
    };
  };
};

function fmtBrl(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  });
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function normalizeImage(url: string | undefined) {
  if (!url) return null;
  return url.replace(/^http:\/\//i, 'https://');
}

async function safeFetchJson<T>(url: string, timeoutMs = 8500): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const accessToken = process.env.MERCADOLIBRE_ACCESS_TOKEN || process.env.MERCADO_LIVRE_ACCESS_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'CongChain-Mythos-ProductFinder/1.0',
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    const response = await fetch(url, {
      headers,
      next: { revalidate: 90 },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Mercado Livre bloqueou a consulta publica. Configure MERCADOLIBRE_ACCESS_TOKEN no Railway para usar o conector oficial.');
      }
      return null;
    }
    return await response.json() as T;
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && /Mercado Livre bloqueou/.test(error.message)) throw error;
    return null;
  }
}

function sellerStatusLabel(status: string | null | undefined) {
  if (!status) return null;
  return status.replace(/_/g, ' ');
}

function scoreOffer(input: {
  price: number;
  budgetBrl: number | null;
  freeShipping: boolean;
  sellerStatus: string | null;
  sellerTransactions: number | null;
  soldQuantity: number | null;
  condition: string | null;
  discountPercent: number | null;
}) {
  let score = 48;
  if (input.budgetBrl && input.price <= input.budgetBrl) score += 18;
  if (input.budgetBrl && input.price > input.budgetBrl) score -= Math.min(24, ((input.price - input.budgetBrl) / input.budgetBrl) * 45);
  if (input.freeShipping) score += 9;
  if (input.sellerStatus?.includes('platinum')) score += 13;
  else if (input.sellerStatus?.includes('gold')) score += 10;
  else if (input.sellerStatus?.includes('silver')) score += 7;
  if ((input.sellerTransactions ?? 0) > 1000) score += 9;
  else if ((input.sellerTransactions ?? 0) > 100) score += 5;
  if ((input.soldQuantity ?? 0) > 100) score += 6;
  else if ((input.soldQuantity ?? 0) > 20) score += 3;
  if (input.condition === 'new') score += 5;
  if ((input.discountPercent ?? 0) >= 10) score += 4;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function offerLabels(score: number) {
  if (score >= 82) return 'excelente';
  if (score >= 68) return 'boa';
  if (score >= 52) return 'ok';
  return 'revisar';
}

function buildStrengths(offer: MythosProductOffer, budgetBrl: number | null) {
  const strengths: string[] = [];
  if (budgetBrl && offer.price <= budgetBrl) strengths.push('dentro do orcamento');
  if (offer.freeShipping) strengths.push('frete gratis');
  if (offer.sellerStatus) strengths.push(`vendedor ${offer.sellerStatus}`);
  if ((offer.sellerTransactions ?? 0) > 1000) strengths.push('alto historico de vendas');
  if ((offer.soldQuantity ?? 0) > 20) strengths.push('produto com vendas visiveis');
  if (offer.discountPercent && offer.discountPercent > 0) strengths.push(`${offer.discountPercent}% abaixo do preco anterior informado`);
  return strengths.slice(0, 5);
}

function buildRisks(offer: MythosProductOffer, budgetBrl: number | null) {
  const risks: string[] = [];
  if (budgetBrl && offer.price > budgetBrl) risks.push('passa do orcamento informado');
  if (!offer.freeShipping) risks.push('frete pode mudar o custo final');
  if (!offer.sellerStatus) risks.push('reputacao do vendedor nao veio completa na API');
  if ((offer.sellerTransactions ?? 0) < 50) risks.push('historico de vendas limitado');
  if (offer.condition && offer.condition !== 'new') risks.push(`condicao: ${offer.condition}`);
  if (risks.length === 0) risks.push('confira compatibilidade, garantia e voltagem/capacidade antes de comprar');
  return risks.slice(0, 4);
}

function buildRankReason(offer: MythosProductOffer, budgetBrl: number | null) {
  const parts: string[] = [];
  if (budgetBrl && offer.price <= budgetBrl) parts.push('fica dentro do orcamento');
  if (offer.freeShipping) parts.push('tem frete gratis informado');
  if (offer.sellerStatus) parts.push(`vendedor com reputacao ${offer.sellerStatus}`);
  if ((offer.sellerTransactions ?? 0) > 1000) parts.push('alto historico do vendedor');
  if (!parts.length) parts.push('melhor equilibrio entre preco, dados do vendedor e risco visivel');
  return parts.slice(0, 3).join(', ');
}

async function hydrateSeller(result: MercadoLivreSearchResult) {
  const sellerId = result.seller?.id;
  if (!sellerId) return null;
  return safeFetchJson<MercadoLivreUser>(`${MERCADO_LIVRE_API}/users/${sellerId}`, 6500);
}

function toOffer(result: MercadoLivreSearchResult, seller: MercadoLivreUser | null, budgetBrl: number | null): MythosProductOffer | null {
  if (!result.id || !result.title || typeof result.price !== 'number' || !result.permalink) return null;
  const originalPrice = typeof result.original_price === 'number' ? result.original_price : null;
  const discountPercent = originalPrice && originalPrice > result.price
    ? Math.round(((originalPrice - result.price) / originalPrice) * 100)
    : null;
  const sellerStatus = sellerStatusLabel(seller?.seller_reputation?.power_seller_status || seller?.seller_reputation?.level_id);
  const sellerTransactions = seller?.seller_reputation?.transactions?.completed ?? null;
  const base = {
    price: result.price,
    budgetBrl,
    freeShipping: Boolean(result.shipping?.free_shipping),
    sellerStatus,
    sellerTransactions,
    soldQuantity: typeof result.sold_quantity === 'number' ? result.sold_quantity : null,
    condition: result.condition || null,
    discountPercent,
  };
  const score = scoreOffer(base);
  const offer: MythosProductOffer = {
    id: result.id,
    marketplace: 'mercado_livre',
    marketplaceLabel: 'Mercado Livre',
    title: result.title,
    price: result.price,
    priceLabel: fmtBrl(result.price) || 'preco indisponivel',
    originalPrice,
    originalPriceLabel: fmtBrl(originalPrice),
    discountPercent,
    url: result.permalink,
    image: normalizeImage(result.thumbnail),
    condition: result.condition || null,
    freeShipping: Boolean(result.shipping?.free_shipping),
    sellerId: seller?.id ?? result.seller?.id ?? null,
    sellerName: seller?.nickname || result.seller?.nickname || null,
    sellerStatus,
    sellerTransactions,
    soldQuantity: typeof result.sold_quantity === 'number' ? result.sold_quantity : null,
    availableQuantity: typeof result.available_quantity === 'number' ? result.available_quantity : null,
    score,
    scoreLabel: offerLabels(score),
    rankReason: '',
    strengths: [],
    risks: [],
  };
  offer.strengths = buildStrengths(offer, budgetBrl);
  offer.risks = buildRisks(offer, budgetBrl);
  offer.rankReason = buildRankReason(offer, budgetBrl);
  return offer;
}

function buildPriceStats(offers: MythosProductOffer[], budgetBrl: number | null): MythosProductPriceStats {
  const prices = offers.map(offer => offer.price).filter(price => Number.isFinite(price));
  const min = prices.length ? Math.min(...prices) : null;
  const max = prices.length ? Math.max(...prices) : null;
  const avg = average(prices);
  const med = median(prices);
  return {
    min,
    minLabel: fmtBrl(min),
    median: med,
    medianLabel: fmtBrl(med),
    average: avg,
    averageLabel: fmtBrl(avg),
    max,
    maxLabel: fmtBrl(max),
    withinBudgetCount: budgetBrl ? offers.filter(offer => offer.price <= budgetBrl).length : 0,
    scannedCount: offers.length,
  };
}

function buildWatchPlan(bestOffer: MythosProductOffer | null, budgetBrl: number | null): MythosProductWatchPlan {
  const targetPrice = bestOffer
    ? Math.max(1, Math.round((budgetBrl ? Math.min(budgetBrl, bestOffer.price * 0.95) : bestOffer.price * 0.9) * 100) / 100)
    : null;
  return {
    available: true,
    targetPrice,
    targetPriceLabel: fmtBrl(targetPrice),
    trigger: targetPrice
      ? `Avisar quando uma oferta confiavel ficar em ${fmtBrl(targetPrice)} ou menos.`
      : 'Avisar quando aparecer uma oferta confiavel dentro do orcamento informado.',
    cadence: 'Futuro monitor: checagem diaria ou sob demanda, sem compra automatica.',
    note: 'Nesta fase o Mythos apenas prepara o plano de alerta. Nenhum monitor recorrente foi criado automaticamente.',
  };
}

export async function findProductOpportunities(input: { query: string; budgetBrl?: number | null }): Promise<MythosProductFinderReport> {
  const query = input.query.trim().slice(0, 120);
  if (!query) throw new Error('Informe o produto. Exemplo: /procurar powerbank ate 150');

  const url = `${MERCADO_LIVRE_API}/sites/MLB/search?q=${encodeURIComponent(query)}&limit=12`;
  const raw = await safeFetchJson<MercadoLivreSearchResponse>(url);
  const results = (raw?.results || []).slice(0, 10);
  if (!results.length) {
    throw new Error(`Nao encontrei ofertas publicas para "${query}" no Mercado Livre.`);
  }

  const sellers = await Promise.all(results.slice(0, 8).map(hydrateSeller));
  const offers = results.slice(0, 8)
    .map((result, index) => toOffer(result, sellers[index] || null, input.budgetBrl ?? null))
    .filter((offer): offer is MythosProductOffer => Boolean(offer))
    .sort((a, b) => b.score - a.score || a.price - b.price);

  const bestOffer = offers[0] || null;
  const budgetLabel = fmtBrl(input.budgetBrl ?? null);
  const priceStats = buildPriceStats(offers, input.budgetBrl ?? null);
  const watchPlan = buildWatchPlan(bestOffer, input.budgetBrl ?? null);
  const summary = bestOffer
    ? `A melhor oportunidade encontrada agora foi "${bestOffer.title}" no ${bestOffer.marketplaceLabel} por ${bestOffer.priceLabel}${bestOffer.freeShipping ? ' com frete gratis informado' : ''}. Score Mythos: ${bestOffer.score}/100 porque ${bestOffer.rankReason}.`
    : `O Mythos consultou o Mercado Livre, mas nao encontrou uma oferta confiavel para "${query}".`;

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    query: input.query,
    normalizedQuery: query,
    budgetBrl: input.budgetBrl ?? null,
    budgetLabel,
    bestOffer,
    offers,
    priceStats,
    watchPlan,
    providerStatus: [
      {
        marketplace: 'Mercado Livre',
        status: 'live',
        detail: 'Busca publica via API Mercado Livre Brasil.',
      },
      {
        marketplace: 'Amazon / Shopee / Magalu',
        status: 'pending_connector',
        detail: 'Conectores oficiais ou busca licenciada ainda precisam ser configurados para nao inventar preco.',
      },
    ],
    summary,
    safety: {
      readOnlySearch: true,
      noPurchaseExecution: true,
      noPaymentExecution: true,
      notSponsored: true,
      sources: ['Mercado Livre public search API', 'Mercado Livre public seller API'],
    },
  };
}
