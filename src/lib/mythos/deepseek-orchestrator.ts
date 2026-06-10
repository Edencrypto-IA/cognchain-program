import { createHash } from 'crypto';
import { routeMythosTrigger, type MythosTriggerIntent } from '@/lib/mythos/trigger-engine';

export type DeepSeekRouteIntent =
  | 'roteamento_simples'
  | 'analise_codigo'
  | 'busca_financeira'
  | 'analise_politica'
  | 'criacao_html'
  | 'risco_compliance'
  | 'multi_step_agente'
  | 'produto_compras'
  | 'radar_publico'
  | 'solana_readonly'
  | 'memecoin_safe_draft'
  | 'unknown';

export type DeepSeekRouteDecision = {
  intent: DeepSeekRouteIntent;
  mythosIntent: MythosTriggerIntent | 'unknown';
  complexity: 'baixa' | 'media' | 'alta';
  recommendedModel: string;
  fallbackModel: string;
  confidence: number;
  requiresValidation: boolean;
  estimatedTokens: number;
  safety: {
    readOnly: boolean;
    requiresWallet: boolean;
    requiresSignature: boolean;
    canMoveFunds: false;
    blockedActions: string[];
  };
  reason: string;
  source: 'deterministic' | 'deepseek' | 'fallback';
  decisionHash: string;
};

export type DeepSeekValidationResult = {
  verdict: 'pass' | 'review' | 'reject';
  canDisplay: boolean;
  severity: 'low' | 'medium' | 'high';
  issues: string[];
  missingCitations: string[];
  safeSummary: string;
  source: 'deepseek' | 'fallback';
  validationHash: string;
};

type DeepSeekMessage = {
  role: 'system' | 'user';
  content: string;
};

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';

const BLOCKED_ACTION_PATTERNS = [
  /\b(assinar|sign|submit|enviar\s+tx|enviar\s+transa[cç][aã]o)\b/i,
  /\b(comprar|buy|vender|sell|swap|trocar|transferir|pix|pagar|sacar|depositar)\b/i,
  /\b(mover\s+fundos|move\s+funds|private\s+key|seed\s+phrase|frase\s+secreta)\b/i,
];

const POLITICAL_PATTERNS = /\b(pol[ií]tic|prefeitura|vereador|deputado|senador|governador|presidente|elei[cç][aã]o|tse|tre|tcu|tce|cgu|transpar[eê]ncia)\b/i;
const FINANCIAL_PATTERNS = /\b(selic|ipca|d[oó]lar|b3|bolsa|ibovespa|fed|copom|juros|infla[cç][aã]o|mercado|financeiro)\b/i;
const CODE_PATTERNS = /\b(c[oó]digo|debug|erro|log|stack|typescript|javascript|python|solana program|anchor|api|endpoint)\b/i;
const HTML_PATTERNS = /\b(html|landing|site|website|p[aá]gina|design|layout|css|preview)\b/i;
const PRODUCT_PATTERNS = /\b(comprar|procurar|produto|pre[cç]o|marketplace|mercado livre|amazon|powerbank|oferta)\b/i;
const SOLANA_PATTERNS = /\b(solana|wallet|carteira|token|tx|assinatura|phantom|pump\.?fun|memecoin)\b/i;

function stableHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function stripCodeFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(stripCodeFence(value)) as T;
  } catch {
    return null;
  }
}

function blockedActionsFor(text: string) {
  const matches = new Set<string>();
  if (BLOCKED_ACTION_PATTERNS[0].test(text)) matches.add('assinatura/envio de transacao');
  if (BLOCKED_ACTION_PATTERNS[1].test(text)) matches.add('compra/venda/swap/pagamento');
  if (BLOCKED_ACTION_PATTERNS[2].test(text)) matches.add('movimentacao de fundos ou segredo de carteira');
  return [...matches];
}

function estimateTokens(text: string) {
  return Math.max(120, Math.ceil(text.length / 4));
}

function modelForIntent(intent: DeepSeekRouteIntent) {
  if (intent === 'analise_politica' || intent === 'risco_compliance') {
    return { recommendedModel: 'claude', fallbackModel: 'gpt' };
  }
  if (intent === 'busca_financeira' || intent === 'radar_publico') {
    return { recommendedModel: 'gpt', fallbackModel: 'claude' };
  }
  if (intent === 'criacao_html') {
    return { recommendedModel: 'claude', fallbackModel: 'gpt' };
  }
  if (intent === 'analise_codigo' || intent === 'multi_step_agente') {
    return { recommendedModel: 'deepseek', fallbackModel: 'nvidia' };
  }
  return { recommendedModel: 'deepseek', fallbackModel: 'nvidia' };
}

function inferIntent(command: string): DeepSeekRouteIntent {
  if (POLITICAL_PATTERNS.test(command)) return 'analise_politica';
  if (FINANCIAL_PATTERNS.test(command)) return 'busca_financeira';
  if (PRODUCT_PATTERNS.test(command)) return 'produto_compras';
  if (HTML_PATTERNS.test(command)) return 'criacao_html';
  if (CODE_PATTERNS.test(command)) return 'analise_codigo';
  if (SOLANA_PATTERNS.test(command)) {
    if (/\b(memecoin|pump\.?fun|lan[cç]ar|criar\s+meme)\b/i.test(command)) return 'memecoin_safe_draft';
    return 'solana_readonly';
  }
  if (/\b(plano|planeje|fa[cç]a tudo|workflow|multi.?step|agente)\b/i.test(command)) return 'multi_step_agente';
  return 'roteamento_simples';
}

function buildDecision(
  command: string,
  source: DeepSeekRouteDecision['source'],
  overrides: Partial<DeepSeekRouteDecision> = {}
): DeepSeekRouteDecision {
  const deterministicRoute = routeMythosTrigger(command, {});
  const inferredIntent = overrides.intent || inferIntent(command);
  const models = modelForIntent(inferredIntent);
  const blockedActions = blockedActionsFor(command);
  const complexity = command.length > 480 || /\b(compare|analise|planeje|estrat[eé]gia|relat[oó]rio)\b/i.test(command)
    ? 'media'
    : 'baixa';
  const requiresValidation = inferredIntent === 'analise_politica' ||
    inferredIntent === 'busca_financeira' ||
    inferredIntent === 'risco_compliance' ||
    blockedActions.length > 0;

  const decision = {
    intent: inferredIntent,
    mythosIntent: deterministicRoute.intent,
    complexity,
    recommendedModel: models.recommendedModel,
    fallbackModel: models.fallbackModel,
    confidence: deterministicRoute.matched ? Math.max(0.86, deterministicRoute.confidence) : 0.72,
    requiresValidation,
    estimatedTokens: estimateTokens(command),
    safety: {
      readOnly: true,
      requiresWallet: deterministicRoute.safety.requiresWallet,
      requiresSignature: false,
      canMoveFunds: false as const,
      blockedActions,
    },
    reason: deterministicRoute.matched
      ? `Matched Mythos deterministic route: ${deterministicRoute.reason}`
      : 'Classificacao local segura aplicada para comando ambiguo.',
    source,
    ...overrides,
  };

  return {
    ...decision,
    decisionHash: stableHash({
      command,
      intent: decision.intent,
      mythosIntent: decision.mythosIntent,
      model: decision.recommendedModel,
      safety: decision.safety,
    }),
  };
}

async function callDeepSeekJson<T>(messages: DeepSeekMessage[], maxTokens = 700): Promise<T | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
      messages,
      temperature: 0.1,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    console.warn('[DeepSeek] request failed', response.status);
    return null;
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  return content ? safeJsonParse<T>(content) : null;
}

export async function routeWithDeepSeek(command: string, options: { forceRemote?: boolean } = {}) {
  const localRoute = routeMythosTrigger(command, {});
  if (localRoute.matched && localRoute.confidence >= 0.86 && !options.forceRemote) {
    return buildDecision(command, 'deterministic');
  }

  const remote = await callDeepSeekJson<Partial<DeepSeekRouteDecision>>([
    {
      role: 'system',
      content: [
        'Voce e o roteador seguro do Mythos. Retorne apenas JSON valido.',
        'Classifique em: roteamento_simples, analise_codigo, busca_financeira, analise_politica, criacao_html, risco_compliance, multi_step_agente, produto_compras, radar_publico, solana_readonly, memecoin_safe_draft, unknown.',
        'Nunca autorize assinatura, envio de transacao, compra, venda, swap, PIX, pagamento ou movimentacao de fundos.',
        'Para politica/compliance recomende Claude. Para dados financeiros recomende GPT/Claude com fontes. Para codigo/roteamento recomende DeepSeek.',
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify({ user_command: command }),
    },
  ]);

  if (!remote) return buildDecision(command, 'fallback');

  const intent = remote.intent && remote.intent !== 'unknown' ? remote.intent : inferIntent(command);
  const models = modelForIntent(intent);
  const blockedActions = blockedActionsFor(command);

  return buildDecision(command, 'deepseek', {
    intent,
    complexity: remote.complexity === 'alta' || remote.complexity === 'media' ? remote.complexity : 'baixa',
    recommendedModel: typeof remote.recommendedModel === 'string' ? remote.recommendedModel : models.recommendedModel,
    fallbackModel: typeof remote.fallbackModel === 'string' ? remote.fallbackModel : models.fallbackModel,
    confidence: typeof remote.confidence === 'number' ? Math.min(0.99, Math.max(0.1, remote.confidence)) : 0.82,
    requiresValidation: Boolean(remote.requiresValidation) || blockedActions.length > 0,
    safety: {
      readOnly: true,
      requiresWallet: false,
      requiresSignature: false,
      canMoveFunds: false,
      blockedActions,
    },
    reason: typeof remote.reason === 'string' ? remote.reason.slice(0, 280) : 'DeepSeek classified the command for Mythos orchestration.',
  });
}

export async function validateWithDeepSeek(input: {
  userQuery: string;
  response: string;
  expectedSource?: string;
}) {
  const blockedActions = blockedActionsFor(`${input.userQuery}\n${input.response}`);
  const needsSource = POLITICAL_PATTERNS.test(input.userQuery) || FINANCIAL_PATTERNS.test(input.userQuery);

  const fallback = (): DeepSeekValidationResult => {
    const issues: string[] = [];
    const missingCitations: string[] = [];
    if (blockedActions.length > 0) issues.push(`A resposta toca em acao bloqueada: ${blockedActions.join(', ')}.`);
    if (needsSource && !/(fonte|source|ibge|banco central|bcb|tse|tre|tcu|tce|cgu|portal da transpar[eê]ncia|coingecko|solscan|mercado livre|anthropic web search)/i.test(input.response)) {
      missingCitations.push(input.expectedSource || 'fonte oficial/verificavel');
    }
    const verdict = blockedActions.length > 0 ? 'reject' : missingCitations.length > 0 ? 'review' : 'pass';
    return {
      verdict,
      canDisplay: verdict !== 'reject',
      severity: verdict === 'reject' ? 'high' : verdict === 'review' ? 'medium' : 'low',
      issues,
      missingCitations,
      safeSummary: verdict === 'pass'
        ? 'Resposta liberada pela validacao local.'
        : 'Resposta precisa de revisao/fonte antes de ser tratada como verificavel.',
      source: 'fallback',
      validationHash: stableHash({ userQuery: input.userQuery, response: input.response, verdict, issues, missingCitations }),
    };
  };

  const remote = await callDeepSeekJson<Partial<DeepSeekValidationResult>>([
    {
      role: 'system',
      content: [
        'Voce e um validador de seguranca do Mythos. Retorne apenas JSON valido.',
        'Campos: verdict(pass|review|reject), canDisplay(boolean), severity(low|medium|high), issues(array), missingCitations(array), safeSummary(string).',
        'Rejeite qualquer resposta que instrua assinar, enviar transacao, comprar, vender, swap, PIX, pagamento ou mover fundos sem aprovacao humana.',
        'Marque review quando houver numero financeiro, politica ou acusacao publica sem fonte verificavel.',
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify({
        user_query: input.userQuery,
        response_to_validate: input.response.slice(0, 12000),
        expected_source: input.expectedSource || null,
      }),
    },
  ], 900);

  if (!remote) return fallback();

  const issues = Array.isArray(remote.issues) ? remote.issues.map(String).slice(0, 8) : [];
  const missingCitations = Array.isArray(remote.missingCitations)
    ? remote.missingCitations.map(String).slice(0, 8)
    : [];
  const verdict = remote.verdict === 'reject' || remote.verdict === 'review' ? remote.verdict : 'pass';
  const hasBlockedAction = blockedActions.length > 0;

  return {
    verdict: hasBlockedAction ? 'reject' : verdict,
    canDisplay: !hasBlockedAction && remote.canDisplay !== false,
    severity: hasBlockedAction ? 'high' : remote.severity === 'high' || remote.severity === 'medium' ? remote.severity : 'low',
    issues: hasBlockedAction ? [...issues, `Acao bloqueada detectada: ${blockedActions.join(', ')}.`] : issues,
    missingCitations,
    safeSummary: typeof remote.safeSummary === 'string'
      ? remote.safeSummary.slice(0, 500)
      : 'Validacao DeepSeek concluida.',
    source: 'deepseek',
    validationHash: stableHash({ userQuery: input.userQuery, response: input.response, verdict, issues, missingCitations, hasBlockedAction }),
  } satisfies DeepSeekValidationResult;
}
