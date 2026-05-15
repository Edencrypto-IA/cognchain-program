import type {
  WalletAgentIntentDetection,
  WalletAgentIntentEntities,
  WalletAgentIntentType,
  WalletAgentLanguageHint,
  WalletAgentRiskLevel,
} from './types';

const MEME_TOKENS = ['BONK', 'PENGU', 'WIF', 'POPCAT', 'MEW', 'BOME', 'SAMO'];
const KNOWN_TOKENS = ['SOL', 'USDC', 'USDT', 'JUP', 'RAY', 'ORCA', 'JITO', ...MEME_TOKENS];

type KeywordLanguage = Exclude<WalletAgentLanguageHint, 'mixed' | 'unknown'>;
type LocalizedKeywords = Record<KeywordLanguage, string[]>;

const INTENT_KEYWORDS: Record<WalletAgentIntentType, LocalizedKeywords> = {
  PRIVACY_PAYMENT: {
    pt: ['privado', 'privacidade', 'anonimo', 'confidencial', 'camada privada'],
    en: ['privacy', 'private', 'anonymous', 'confidential', 'cloak'],
    es: ['privado', 'privacidad', 'anonimo', 'confidencial'],
    fr: ['prive', 'confidentiel', 'anonyme', 'confidentialite'],
  },
  PAYROLL_BATCH: {
    pt: ['folha', 'funcionarios', 'salarios', 'colaboradores', 'pagamento em lote'],
    en: ['payroll', 'employees', 'salaries', 'team payments', 'batch payment'],
    es: ['nomina', 'empleados', 'salarios', 'pago en lote'],
    fr: ['paie', 'employes', 'salaires', 'paiement groupe'],
  },
  SCHEDULE_PAYMENT: {
    pt: ['agendar pagamento', 'pagamento agendado', 'enviar amanha', 'pagar amanha'],
    en: ['schedule payment', 'scheduled payment', 'send tomorrow', 'pay tomorrow'],
    es: ['programar pago', 'pago programado', 'enviar manana'],
    fr: ['programmer paiement', 'paiement programme', 'envoyer demain'],
  },
  SELL_TOKEN: {
    pt: ['vender', 'venda', 'liquidar', 'realizar lucro', 'stop loss'],
    en: ['sell', 'liquidate', 'take profit', 'stop loss'],
    es: ['vender', 'liquidar', 'tomar ganancia'],
    fr: ['vendre', 'liquider', 'prendre profit'],
  },
  BUY_TOKEN: {
    pt: ['comprar', 'compra', 'trocar por', 'fazer swap'],
    en: ['buy', 'purchase', 'swap for', 'swap into'],
    es: ['comprar', 'intercambiar por', 'hacer swap'],
    fr: ['acheter', 'echanger contre', 'faire swap'],
  },
  PRICE_ALERT: {
    pt: ['alerta', 'avisar', 'monitorar preco', 'quando chegar', 'chegar em'],
    en: ['alert', 'notify', 'monitor price', 'when it reaches', 'price hits'],
    es: ['alerta', 'avisar', 'monitorear precio', 'cuando llegue'],
    fr: ['alerte', 'notifier', 'surveiller prix', 'quand il atteint'],
  },
  RISK_CHECK: {
    pt: ['risco', 'analisar', 'auditar', 'liquidez', 'seguranca', 'holders', 'rug'],
    en: ['risk', 'analyze', 'audit', 'liquidity', 'security', 'holders', 'rug'],
    es: ['riesgo', 'analizar', 'auditar', 'liquidez', 'seguridad', 'holders'],
    fr: ['risque', 'analyser', 'auditer', 'liquidite', 'securite', 'holders'],
  },
};

const PAYMENT_KEYWORDS: LocalizedKeywords = {
  pt: ['pagar', 'pagamento', 'enviar', 'transferir'],
  en: ['pay', 'payment', 'send', 'transfer'],
  es: ['pagar', 'pago', 'enviar', 'transferir'],
  fr: ['payer', 'paiement', 'envoyer', 'transferer'],
};

const SCHEDULE_KEYWORDS: LocalizedKeywords = {
  pt: ['agenda', 'agendar', 'dia', 'horario', 'amanha', 'semana', 'mes'],
  en: ['schedule', 'date', 'time', 'tomorrow', 'week', 'month'],
  es: ['programar', 'fecha', 'hora', 'manana', 'semana', 'mes'],
  fr: ['programmer', 'date', 'heure', 'demain', 'semaine', 'mois'],
};

const INTENT_PRIORITY: WalletAgentIntentType[] = [
  'PRIVACY_PAYMENT',
  'PAYROLL_BATCH',
  'SCHEDULE_PAYMENT',
  'SELL_TOKEN',
  'BUY_TOKEN',
  'PRICE_ALERT',
  'RISK_CHECK',
];

function normalizePrompt(prompt: string) {
  return prompt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordMatches(normalizedText: string, keyword: string) {
  const normalizedKeyword = normalizePrompt(keyword).trim();

  if (!normalizedKeyword) return false;
  if (normalizedKeyword.includes(' ')) return normalizedText.includes(normalizedKeyword);

  return new RegExp(`\\b${escapeRegExp(normalizedKeyword)}\\b`).test(normalizedText);
}

function collectMatches(normalizedText: string, keywords: LocalizedKeywords) {
  const matches: string[] = [];
  const languageCounts: Record<KeywordLanguage, number> = { pt: 0, en: 0, es: 0, fr: 0 };

  (Object.keys(keywords) as KeywordLanguage[]).forEach(language => {
    keywords[language].forEach(keyword => {
      if (keywordMatches(normalizedText, keyword)) {
        matches.push(keyword);
        languageCounts[language] += 1;
      }
    });
  });

  return { matches, languageCounts };
}

function mergeLanguageCounts(...counts: Array<Record<KeywordLanguage, number>>) {
  return counts.reduce<Record<KeywordLanguage, number>>(
    (acc, current) => ({
      pt: acc.pt + current.pt,
      en: acc.en + current.en,
      es: acc.es + current.es,
      fr: acc.fr + current.fr,
    }),
    { pt: 0, en: 0, es: 0, fr: 0 }
  );
}

function inferLanguageHint(languageCounts: Record<KeywordLanguage, number>): WalletAgentLanguageHint {
  const active = (Object.keys(languageCounts) as KeywordLanguage[]).filter(
    language => languageCounts[language] > 0
  );

  if (active.length === 0) return 'unknown';
  if (active.length > 1) return 'mixed';

  return active[0];
}

function confidenceForIntent(type: WalletAgentIntentType, matchedCount: number) {
  const baseConfidence: Record<WalletAgentIntentType, number> = {
    PRIVACY_PAYMENT: 0.9,
    PAYROLL_BATCH: 0.9,
    SCHEDULE_PAYMENT: 0.88,
    SELL_TOKEN: 0.84,
    BUY_TOKEN: 0.84,
    PRICE_ALERT: 0.78,
    RISK_CHECK: 0.74,
  };

  return Math.min(0.98, baseConfidence[type] + Math.max(0, matchedCount - 1) * 0.04);
}

export function detectWalletAgentIntent(prompt: string): WalletAgentIntentDetection {
  const text = normalizePrompt(prompt);
  const detections = INTENT_PRIORITY.map(type => {
    if (type === 'SCHEDULE_PAYMENT') {
      const direct = collectMatches(text, INTENT_KEYWORDS.SCHEDULE_PAYMENT);
      const payment = collectMatches(text, PAYMENT_KEYWORDS);
      const schedule = collectMatches(text, SCHEDULE_KEYWORDS);
      const matchedKeywords = [...direct.matches, ...payment.matches, ...schedule.matches];

      return {
        type,
        matchedKeywords,
        languageCounts: mergeLanguageCounts(
          direct.languageCounts,
          payment.languageCounts,
          schedule.languageCounts
        ),
        isMatch: direct.matches.length > 0 || (payment.matches.length > 0 && schedule.matches.length > 0),
      };
    }

    const result = collectMatches(text, INTENT_KEYWORDS[type]);

    return {
      type,
      matchedKeywords: result.matches,
      languageCounts: result.languageCounts,
      isMatch: result.matches.length > 0,
    };
  });

  const selected = detections.find(detection => detection.isMatch);

  if (!selected) {
    return {
      type: 'RISK_CHECK',
      confidence: 0,
      matchedKeywords: [],
      languageHint: 'unknown',
      isFinancialCommand: false,
    };
  }

  return {
    type: selected.type,
    confidence: confidenceForIntent(selected.type, selected.matchedKeywords.length),
    matchedKeywords: Array.from(new Set(selected.matchedKeywords)),
    languageHint: inferLanguageHint(selected.languageCounts),
    isFinancialCommand: true,
  };
}

export function classifyWalletAgentIntent(prompt: string): WalletAgentIntentType {
  return detectWalletAgentIntent(prompt).type;
}

export function extractWalletAgentEntities(prompt: string): WalletAgentIntentEntities {
  const upperPrompt = prompt.toUpperCase();
  const normalizedPrompt = normalizePrompt(prompt);
  const tokenSymbol = KNOWN_TOKENS.find(token => new RegExp(`\\b${token}\\b`).test(upperPrompt));
  const quoteTokenSymbol = tokenSymbol && tokenSymbol !== 'SOL' ? 'SOL' : undefined;
  const amountMatch = normalizedPrompt.match(/(\d+(?:[,.]\d+)?)\s*(sol|solana)\b/i);
  const targetPriceMatch = normalizedPrompt.match(
    /(?:\$|usd|preco|precio|price|target|chegar em|llegar a|atteindre)\s*(\d+(?:[,.]\d+)?)/i
  );
  const recipientMatch = prompt.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/);
  const employeeCountMatch = normalizedPrompt.match(
    /(\d+)\s*(funcionarios|colaboradores|pessoas|employees|empleados|employes)\b/i
  );

  return {
    tokenSymbol,
    quoteTokenSymbol,
    amountSol: amountMatch ? Number(amountMatch[1].replace(',', '.')) : undefined,
    targetPriceUsd: targetPriceMatch ? Number(targetPriceMatch[1].replace(',', '.')) : undefined,
    recipientAddress: recipientMatch?.[0],
    employeeCount: employeeCountMatch ? Number(employeeCountMatch[1]) : undefined,
  };
}

export function estimateWalletAgentRisk(
  type: WalletAgentIntentType,
  entities: WalletAgentIntentEntities
): WalletAgentRiskLevel {
  if (type === 'RISK_CHECK' || type === 'PRICE_ALERT') return 'low';
  if (type === 'PRIVACY_PAYMENT') return 'high';
  if (entities.tokenSymbol && MEME_TOKENS.includes(entities.tokenSymbol)) return 'high';
  if (type === 'PAYROLL_BATCH' || type === 'SCHEDULE_PAYMENT') return 'medium';
  return 'medium';
}

export function createWalletAgentSummary(type: WalletAgentIntentType, entities: WalletAgentIntentEntities) {
  const token = entities.tokenSymbol ?? 'token';

  switch (type) {
    case 'BUY_TOKEN':
      return `Preparar compra de ${token} com preview, fonte de preco, risco e assinatura manual.`;
    case 'SELL_TOKEN':
      return `Preparar venda de ${token} com condicoes, slippage, risco e assinatura manual.`;
    case 'SCHEDULE_PAYMENT':
      return 'Preparar agendamento de pagamento Solana com confirmacao interna e assinatura no horario.';
    case 'PAYROLL_BATCH':
      return 'Preparar folha de pagamento em lote com revisao humana e assinatura final da wallet.';
    case 'PRICE_ALERT':
      return `Monitorar preco de ${token} e notificar quando a condicao for atingida.`;
    case 'PRIVACY_PAYMENT':
      return 'Preparar pagamento privado com foco em protecao de metadados e aprovacao explicita.';
    case 'RISK_CHECK':
    default:
      return `Analisar risco, liquidez e seguranca de ${token} antes de qualquer acao.`;
  }
}
