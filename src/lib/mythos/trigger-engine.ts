import { parseProductFinderPrompt } from '@/lib/commerce/product-finder-parser';
import { parseMythosExternalDataCommand } from '@/lib/mythos/external-data-query';

export type MythosTriggerIntent =
  | 'command_terminal'
  | 'product_finder'
  | 'product_finder_followup'
  | 'wallet_intelligence'
  | 'market_report'
  | 'market_heatmap'
  | 'token_chart'
  | 'solana_ecosystem'
  | 'memecoin_launch'
  | 'html_artifact'
  | 'html_revision'
  | 'external_data'
  | 'unknown';

export type MythosTriggerRoute = {
  matched: boolean;
  intent: MythosTriggerIntent;
  confidence: number;
  normalizedPrompt: string;
  params: Record<string, unknown>;
  reason: string;
  safety: {
    readOnly: boolean;
    requiresWallet: boolean;
    requiresSignature: boolean;
    canMoveFunds: false;
  };
};

export type MythosTriggerContext = {
  hasProductFinderReport?: boolean;
  hasHtmlArtifact?: boolean;
};

const READ_ONLY = {
  readOnly: true,
  requiresWallet: false,
  requiresSignature: false,
  canMoveFunds: false as const,
};

const WALLET_REVIEW = {
  readOnly: true,
  requiresWallet: true,
  requiresSignature: false,
  canMoveFunds: false as const,
};

function route(
  intent: MythosTriggerIntent,
  confidence: number,
  prompt: string,
  reason: string,
  params: Record<string, unknown> = {},
  safety = READ_ONLY
): MythosTriggerRoute {
  return {
    matched: intent !== 'unknown',
    intent,
    confidence,
    normalizedPrompt: prompt.trim(),
    params,
    reason,
    safety,
  };
}

function parseHtmlArtifactPrompt(command: string) {
  const trimmed = command.trim();
  const patterns = [
    /^\/artifact\s+(.+)$/i,
    /^\/criar\s+(?:html|site|pagina|p[aá]gina|landing(?:\s+page)?)\s+(.+)$/i,
    /^\/create\s+(?:html|site|website|page|landing(?:\s+page)?)\s+(.+)$/i,
    /^\/gerar\s+(?:html|site|pagina|p[aá]gina|landing(?:\s+page)?)\s+(.+)$/i,
    /^\/generate\s+(?:html|site|website|page|landing(?:\s+page)?)\s+(.+)$/i,
    /\b(?:crie|criar|gere|gerar|create|generate)\b.*\b(?:html|site|website|landing page|pagina|p[aá]gina)\b/i,
  ];
  return patterns.some(pattern => pattern.test(trimmed));
}

function parseHtmlRevisionPrompt(command: string) {
  const trimmed = command.trim();
  const patterns = [
    /^\/(?:editar|edit|melhorar|improve|refinar|refine)\s+(?:html|site|pagina|p[aá]gina|artifact|artefato)\s+(.+)$/i,
    /^\/(?:html|artifact|artefato)\s+(?:editar|edit|melhorar|improve|refinar|refine)\s+(.+)$/i,
    /\b(?:edite|editar|melhore|melhorar|refine|refinar|improve)\b.*\b(?:html|site|pagina|p[aá]gina|landing|artefato)\b/i,
  ];
  return patterns.some(pattern => pattern.test(trimmed));
}

function isWalletIntelligenceRequest(content: string) {
  const normalized = content.trim().toLowerCase();
  return /^\/wallet\s+(intelligence|intel|finance|financial|snapshot|portfolio)$/.test(normalized) ||
    /^\/carteira\s+(inteligencia|inteligência|financeira|snapshot|portfolio|portfólio)$/.test(normalized) ||
    /\b(minha carteira|carteira|wallet|portfolio|portf[oó]lio)\b/i.test(content) &&
    /\b(analisa|analisar|inteligencia|inteligência|financeira|saldo|valoriza|valorizacao|valorização|risco)\b/i.test(content);
}

function isProductFinderFollowup(content: string, context: MythosTriggerContext) {
  if (!context.hasProductFinderReport) return false;
  return /\b(compara|comparar|comparacao|comparação|melhor dos|qual voce|qual você|qual escolher|qual compra|qual compraria|menos risco|mais seguro|mais barato|custo beneficio|custo-beneficio|vale mais|vale a pena|recomenda|recomendar|entre os|dos dois|das opcoes|das opções)\b/i.test(content);
}

function isMarketReportRequest(content: string) {
  return /^\/(?:market|crypto)\s+report$/i.test(content.trim()) ||
    /\b(relatorio|relatório|report|market|mercado|oportunidades)\b/i.test(content) &&
    /\b(crypto|cripto|bitcoin|solana|altcoin|tokens?)\b/i.test(content);
}

function isMarketHeatmapRequest(content: string) {
  const normalized = content.trim().toLowerCase();
  return /^\/(?:hm|heatmap|mapa|mapa-mercado|market\s+heatmap)$/.test(normalized) ||
    /\b(mapa de calor|heatmap)\b/i.test(content) && /\b(crypto|cripto|mercado|market|tokens?)\b/i.test(content);
}

function parseTokenChartRequest(content: string) {
  const trimmed = content.trim();
  const slash = trimmed.match(/^\/(?:chart|grafico|gr[aá]fico|price|preco|pre[cç]o)\s+([$]?[a-zA-Z0-9][a-zA-Z0-9\-_.]{1,24})(?:\s+(\d{1,3})d?)?$/i);
  if (slash) return { symbol: slash[1].replace(/^\$/, '').toLowerCase(), days: slash[2] ? Number(slash[2]) : 30 };

  const natural = trimmed.match(/\b(?:grafico|gr[aá]fico|chart|preco|pre[cç]o|cotacao|cota[cç][aã]o)\s+(?:do|da|de)?\s*([$]?[a-zA-Z0-9][a-zA-Z0-9\-_.]{1,24})\b/i);
  if (natural && /\b(token|crypto|cripto|moeda|solana|bitcoin|ethereum|mercado|price|preco|pre[cç]o|chart|grafico|gr[aá]fico)\b/i.test(trimmed)) {
    return { symbol: natural[1].replace(/^\$/, '').toLowerCase(), days: 30 };
  }
  return null;
}

function isSolanaEcosystemRequest(content: string) {
  const normalized = content.trim().toLowerCase();
  if (/^\/solana\s+(report|price|preco|preço|protocols|protocolos|volume|memes?)$/.test(normalized)) return true;
  if (/^\/sol\s+(report|price|preco|preço|protocols|protocolos|volume|memes?)$/.test(normalized)) return true;
  const asksSolana = /\b(sol|solana)\b/i.test(content);
  const asksPrice = /\b(price|preco|preço|cotacao|cotação|valor)\b/i.test(content);
  const asksProtocols = /\b(protocol|protocolo|protocolos|protocols|tvl|defi)\b/i.test(content);
  const asksVolume = /\b(volume|liquidez|liquidity)\b/i.test(content);
  const asksMemes = /\b(meme|memes|memecoin|memecoins)\b/i.test(content);
  const asksTop = /\b(top|maiores|principais|10|dez)\b/i.test(content);
  return asksSolana && ((asksPrice && !asksProtocols && !asksVolume && !asksMemes) || (asksProtocols && asksTop) || (asksVolume && asksTop) || (asksMemes && asksTop));
}

function isMemecoinLaunchRequest(content: string) {
  const trimmed = content.trim();
  return /^\/create\s+(?:meme|memecoin)\b/i.test(trimmed) ||
    /\b(crie|criar|create|launch|lancar|lançar)\b/i.test(content) &&
    /\b(memecoin|meme\s*coin|meme|pump\.?fun|pump fun)\b/i.test(content);
}

export function routeMythosTrigger(content: string, context: MythosTriggerContext = {}): MythosTriggerRoute {
  const prompt = content.trim();
  if (!prompt) return route('unknown', 0, content, 'Empty prompt.');

  if (prompt.startsWith('/')) {
    return route('command_terminal', 0.99, prompt, 'Slash command should stay on the deterministic Mythos terminal route.');
  }

  const externalData = parseMythosExternalDataCommand(prompt);
  if (externalData) return route('external_data', 0.96, prompt, 'Matched external data command parser.', externalData);

  const productFinder = parseProductFinderPrompt(prompt);
  if (productFinder) return route('product_finder', 0.92, prompt, 'Matched product shopping intent.', productFinder);

  if (isProductFinderFollowup(prompt, context)) {
    return route('product_finder_followup', 0.88, prompt, 'Matched follow-up about latest Product Finder report.');
  }

  if (parseHtmlRevisionPrompt(prompt) && context.hasHtmlArtifact) {
    return route('html_revision', 0.88, prompt, 'Matched HTML artifact revision intent.');
  }

  if (parseHtmlArtifactPrompt(prompt)) {
    return route('html_artifact', 0.88, prompt, 'Matched HTML artifact generation intent.');
  }

  if (isWalletIntelligenceRequest(prompt)) {
    return route('wallet_intelligence', 0.86, prompt, 'Matched wallet financial intelligence intent.', {}, WALLET_REVIEW);
  }

  if (isMarketHeatmapRequest(prompt)) return route('market_heatmap', 0.9, prompt, 'Matched market heatmap intent.');

  const tokenChart = parseTokenChartRequest(prompt);
  if (tokenChart) return route('token_chart', 0.9, prompt, 'Matched token chart intent.', tokenChart);

  if (isMarketReportRequest(prompt)) return route('market_report', 0.88, prompt, 'Matched crypto market report intent.');

  if (isSolanaEcosystemRequest(prompt)) return route('solana_ecosystem', 0.86, prompt, 'Matched Solana ecosystem intent.');

  if (isMemecoinLaunchRequest(prompt)) {
    return route('memecoin_launch', 0.86, prompt, 'Matched safe memecoin draft intent.', {}, {
      readOnly: false,
      requiresWallet: false,
      requiresSignature: false,
      canMoveFunds: false,
    });
  }

  return route('unknown', 0, prompt, 'No deterministic Mythos trigger matched.');
}
