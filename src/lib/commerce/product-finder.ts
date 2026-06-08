const MERCADO_LIVRE_API = 'https://api.mercadolibre.com';
const ANTHROPIC_MESSAGES_API = 'https://api.anthropic.com/v1/messages';
const OPENAI_RESPONSES_API = 'https://api.openai.com/v1/responses';

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

export type MythosProductFinderSource = 'mercado_livre' | 'anthropic_web_search' | 'openai_web_search';

export type MythosProductFinderReport = {
  ok: true;
  generatedAt: string;
  source: MythosProductFinderSource;
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
    status: 'live' | 'blocked' | 'fallback' | 'unavailable' | 'pending_connector';
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

type ProductFinderInput = { query: string; budgetBrl?: number | null };

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

type MercadoLivreTokenResponse = {
  access_token?: string;
  expires_in?: number;
  message?: string;
  error?: string;
};

type AnthropicMessageResponse = {
  content?: Array<{ type?: string; text?: string }>;
  error?: { message?: string };
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string };
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

let mercadoLivreTokenCache: { token: string; expiresAt: number } | null = null;

async function getMercadoLivreAccessToken() {
  const clientId = process.env.ML_APP_ID?.trim() || process.env.ML_CLIENT_ID?.trim();
  const clientSecret = process.env.ML_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error('Mercado Livre credentials missing: configure ML_APP_ID and ML_CLIENT_SECRET on Railway.');

  const now = Date.now();
  if (mercadoLivreTokenCache && now < mercadoLivreTokenCache.expiresAt) {
    return mercadoLivreTokenCache.token;
  }

  const response = await fetch(`${MERCADO_LIVRE_API}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'CongChain-Mythos-ProductFinder/1.0',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({})) as MercadoLivreTokenResponse;
  if (!response.ok || !payload.access_token) {
    const detail = payload.message || payload.error || `HTTP ${response.status}`;
    throw new Error(`Mercado Livre nao gerou token com ML_APP_ID/ML_CLIENT_SECRET: ${detail}`);
  }

  const expiresInSeconds = Number(payload.expires_in || 21600);
  mercadoLivreTokenCache = {
    token: payload.access_token,
    expiresAt: now + Math.max(60, expiresInSeconds - 300) * 1000,
  };
  return mercadoLivreTokenCache.token;
}

async function safeFetchJson<T>(url: string, timeoutMs = 8500): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const accessToken = await getMercadoLivreAccessToken();
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
        mercadoLivreTokenCache = null;
        throw new Error('Mercado Livre rejected the authenticated request. Check ML_APP_ID/ML_CLIENT_SECRET permissions on Railway.');
      }
      return null;
    }
    return await response.json() as T;
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && /Mercado Livre/.test(error.message)) throw error;
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

function buildEmptyPriceStats(scannedCount = 0): MythosProductPriceStats {
  return {
    min: null,
    minLabel: null,
    median: null,
    medianLabel: null,
    average: null,
    averageLabel: null,
    max: null,
    maxLabel: null,
    withinBudgetCount: 0,
    scannedCount,
  };
}

function buildWatchPlan(bestOffer: MythosProductOffer | null, budgetBrl: number | null): MythosProductWatchPlan {
  const targetPrice = bestOffer
    ? Math.max(1, Math.round((budgetBrl ? Math.min(budgetBrl, bestOffer.price * 0.95) : bestOffer.price * 0.9) * 100) / 100)
    : budgetBrl || null;
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

function webSearchSystemPrompt() {
  return `Voce e um assistente de compras brasileiro especializado.
Quando pesquisar produtos, sempre:
- Busque as melhores opcoes dentro do orcamento informado.
- Liste no maximo 4 produtos com nome, capacidade/especificacoes, preco estimado e por que vale.
- Inclua links quando a busca retornar URLs confiaveis.
- Avise quando o preco for estimado ou puder mudar por frete/cupom/estoque.
- De uma recomendacao direta no final.
- Responda em portugues brasileiro, de forma amigavel e util.
- Nunca diga que comprou, pagou, reservou ou executou qualquer acao. A resposta e somente leitura.
- Nao use Markdown: nao use ###, **negrito**, tabelas ou listas gigantes.
- Nao use emojis. O card do Mythos ja tem visual proprio.
- Seja compacto. A resposta inteira deve caber em ate 900 palavras.

Formato obrigatorio:
Resumo:
Uma frase curta dizendo o que encontrou.

Opcoes:
1. Nome do produto - preco estimado
Specs: capacidade, potencia, portas ou detalhe importante.
Por que vale: motivo objetivo em uma frase.
Link: URL se existir; se nao existir, escreva "verificar na loja".

2. Nome do produto - preco estimado
Specs: ...
Por que vale: ...
Link: ...

Recomendacao:
Escolha direta e por que.

Cuidados:
Preco pode mudar por frete, cupom, estoque e reputacao do vendedor.`;
}

function cleanWebSearchSummary(text: string) {
  const cleaned = text
    .replace(/\r/g, '')
    .replace(/\*\*/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleaned.length <= 2400) return cleaned;

  const slice = cleaned.slice(0, 2200);
  const cutAt = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('\nRecomendacao:'), 1500);
  return `${slice.slice(0, cutAt).trim()}\n\nCuidados:\nPrecos podem mudar por frete, cupom, estoque e reputacao do vendedor. Abra a loja e confira antes de comprar.`;
}

function buildProductSearchUserPrompt(input: ProductFinderInput) {
  const budget = input.budgetBrl ? ` ate ${fmtBrl(input.budgetBrl)}` : '';
  return `Quero comprar ${input.query}${budget}. Pesquise opcoes atuais no Brasil, priorize custo-beneficio e confiabilidade, e entregue uma recomendacao clara.`;
}

function extractOpenAIText(data: OpenAIResponse) {
  if (data.output_text) return data.output_text;
  return (data.output || [])
    .flatMap(item => item.content || [])
    .filter(block => (block.type === 'output_text' || block.type === 'text') && typeof block.text === 'string')
    .map(block => block.text)
    .join('\n');
}

async function anthropicWebSearch(input: ProductFinderInput) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured.');

  const response = await fetch(ANTHROPIC_MESSAGES_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.MYTHOS_PRODUCT_FINDER_ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
        },
      ],
      system: webSearchSystemPrompt(),
      messages: [
        { role: 'user', content: buildProductSearchUserPrompt(input) },
      ],
    }),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({})) as AnthropicMessageResponse;
  const text = (data.content || [])
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('\n')
    .trim();
  if (!response.ok || !text) {
    throw new Error(data.error?.message || `Anthropic web search failed with HTTP ${response.status}.`);
  }
  return text;
}

async function openAiWebSearch(input: ProductFinderInput) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');

  const response = await fetch(OPENAI_RESPONSES_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.MYTHOS_PRODUCT_FINDER_OPENAI_MODEL?.trim() || 'gpt-4.1-mini',
      tools: [{ type: 'web_search_preview' }],
      input: [
        { role: 'system', content: webSearchSystemPrompt() },
        { role: 'user', content: buildProductSearchUserPrompt(input) },
      ],
    }),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({})) as OpenAIResponse;
  const text = extractOpenAIText(data).trim();
  if (!response.ok || !text) {
    throw new Error(data.error?.message || `OpenAI web search failed with HTTP ${response.status}.`);
  }
  return text;
}

function buildWebSearchReport(
  input: ProductFinderInput,
  summary: string,
  source: Exclude<MythosProductFinderSource, 'mercado_livre'>,
  mlError: unknown
): MythosProductFinderReport {
  const normalizedQuery = input.query.trim().slice(0, 120);
  const mlDetail = mlError instanceof Error ? mlError.message : 'Mercado Livre indisponivel no momento.';
  const aiLabel = source === 'anthropic_web_search' ? 'Anthropic web_search' : 'OpenAI web search';
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    source,
    query: input.query,
    normalizedQuery,
    budgetBrl: input.budgetBrl ?? null,
    budgetLabel: fmtBrl(input.budgetBrl ?? null),
    bestOffer: null,
    offers: [],
    priceStats: buildEmptyPriceStats(),
    watchPlan: buildWatchPlan(null, input.budgetBrl ?? null),
    providerStatus: [
      {
        marketplace: 'Mercado Livre',
        status: 'blocked',
        detail: `API principal falhou; Mythos usou fallback de busca IA. Motivo: ${mlDetail}`,
      },
      {
        marketplace: aiLabel,
        status: 'fallback',
        detail: 'Busca web server-side usada para recomendacao textual com links e precos sujeitos a variacao.',
      },
      {
        marketplace: 'Amazon / Shopee / Magalu',
        status: 'pending_connector',
        detail: 'Conectores oficiais ainda podem melhorar estoque, frete e reputacao sem depender de busca generica.',
      },
    ],
    summary,
    safety: {
      readOnlySearch: true,
      noPurchaseExecution: true,
      noPaymentExecution: true,
      notSponsored: true,
      sources: [aiLabel, 'Mercado Livre API attempted first'],
    },
  };
}

async function findProductWithWebFallback(input: ProductFinderInput, mlError: unknown): Promise<MythosProductFinderReport> {
  const failures: string[] = [];
  try {
    const text = await anthropicWebSearch(input);
    return buildWebSearchReport(input, cleanWebSearchSummary(text), 'anthropic_web_search', mlError);
  } catch (error) {
    failures.push(`Anthropic: ${error instanceof Error ? error.message : 'failed'}`);
  }

  try {
    const text = await openAiWebSearch(input);
    return buildWebSearchReport(input, cleanWebSearchSummary(text), 'openai_web_search', mlError);
  } catch (error) {
    failures.push(`OpenAI: ${error instanceof Error ? error.message : 'failed'}`);
  }

  const mlDetail = mlError instanceof Error ? mlError.message : 'Mercado Livre indisponivel.';
  throw new Error(`Product Finder indisponivel. Mercado Livre: ${mlDetail}. Fallbacks IA: ${failures.join(' | ')}`);
}

async function findMercadoLivreOpportunities(input: ProductFinderInput): Promise<MythosProductFinderReport> {
  const query = input.query.trim().slice(0, 120);
  if (!query) throw new Error('Informe o produto. Exemplo: /procurar powerbank ate 150');

  const params = new URLSearchParams({
    q: query,
    limit: '10',
    sort: 'price_asc',
  });
  if (input.budgetBrl && Number.isFinite(input.budgetBrl)) {
    params.set('price', `*-${Math.round(input.budgetBrl)}`);
  }
  const url = `${MERCADO_LIVRE_API}/sites/MLB/search?${params.toString()}`;
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
    source: 'mercado_livre',
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

export async function findProductOpportunities(input: { query: string; budgetBrl?: number | null }): Promise<MythosProductFinderReport> {
  try {
    return await findMercadoLivreOpportunities(input);
  } catch (error) {
    return findProductWithWebFallback(input, error);
  }
}
