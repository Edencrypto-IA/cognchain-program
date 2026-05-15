import type {
  WalletAgentIntentDetection,
  WalletAgentIntentEntities,
  WalletAgentIntentType,
  WalletAgentParsedIntent,
} from './types';

const VALID_INTENTS = new Set<WalletAgentIntentType>([
  'BUY_TOKEN',
  'SELL_TOKEN',
  'SCHEDULE_PAYMENT',
  'PAYROLL_BATCH',
  'PRICE_ALERT',
  'RISK_CHECK',
  'PRIVACY_PAYMENT',
]);

export const WALLET_AGENT_AI_PARSER_SYSTEM = [
  'You are the CongChain Wallet Agent intent parser.',
  'Return ONLY valid JSON. No markdown. No prose.',
  'Never approve, execute, schedule, sign, or claim that a transaction happened.',
  'Your job is to extract a safe draft intent from a user command.',
  'If uncertain, lower confidence and add missingFields.',
  'Allowed intent types: BUY_TOKEN, SELL_TOKEN, SCHEDULE_PAYMENT, PAYROLL_BATCH, PRICE_ALERT, RISK_CHECK, PRIVACY_PAYMENT.',
  'Allowed entity keys: tokenSymbol, quoteTokenSymbol, amountSol, recipientAddress, scheduledFor, targetPriceUsd, employeeCount.',
].join('\n');

type WalletAgentAiParserJson = {
  type?: unknown;
  confidence?: unknown;
  entities?: Partial<Record<keyof WalletAgentIntentEntities, unknown>>;
  missingFields?: unknown;
  notes?: unknown;
};

function coerceNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;

  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function coerceString(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 180) : undefined;
}

function coerceStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => coerceString(item))
    .filter((item): item is string => !!item)
    .slice(0, 8);
}

function normalizeToken(value: unknown) {
  const token = coerceString(value)?.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return token ? token.slice(0, 12) : undefined;
}

function normalizeEntities(entities: WalletAgentAiParserJson['entities']): Partial<WalletAgentIntentEntities> {
  if (!entities || typeof entities !== 'object') return {};

  return {
    tokenSymbol: normalizeToken(entities.tokenSymbol),
    quoteTokenSymbol: normalizeToken(entities.quoteTokenSymbol),
    amountSol: coerceNumber(entities.amountSol),
    recipientAddress: coerceString(entities.recipientAddress),
    scheduledFor: coerceString(entities.scheduledFor),
    targetPriceUsd: coerceNumber(entities.targetPriceUsd),
    employeeCount: coerceNumber(entities.employeeCount),
  };
}

function stripCodeFence(raw: string) {
  return raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

export function createWalletAgentParserPrompt(prompt: string, localDetection: WalletAgentIntentDetection) {
  return JSON.stringify({
    task: 'Parse wallet command into a safe intent draft.',
    userPrompt: prompt,
    localDetection,
    outputSchema: {
      type: 'BUY_TOKEN | SELL_TOKEN | SCHEDULE_PAYMENT | PAYROLL_BATCH | PRICE_ALERT | RISK_CHECK | PRIVACY_PAYMENT',
      confidence: 'number from 0 to 1',
      entities: {
        tokenSymbol: 'string optional',
        quoteTokenSymbol: 'string optional',
        amountSol: 'number optional',
        recipientAddress: 'string optional',
        scheduledFor: 'string optional',
        targetPriceUsd: 'number optional',
        employeeCount: 'number optional',
      },
      missingFields: ['string'],
      notes: ['string'],
    },
    safetyRules: [
      'Do not say the action is approved.',
      'Do not create fake prices, transaction IDs, signatures, hashes, or balances.',
      'Only parse the command.',
      'If the command is not financial, use RISK_CHECK with confidence 0.',
    ],
  });
}

export function parseWalletAgentAiJson(raw: string, localDetection: WalletAgentIntentDetection): WalletAgentParsedIntent {
  const parsed = JSON.parse(stripCodeFence(raw)) as WalletAgentAiParserJson;
  const type = typeof parsed.type === 'string' && VALID_INTENTS.has(parsed.type as WalletAgentIntentType)
    ? parsed.type as WalletAgentIntentType
    : localDetection.type;
  const confidence = Math.max(0, Math.min(1, coerceNumber(parsed.confidence) ?? localDetection.confidence));

  return {
    source: 'ai',
    type,
    confidence,
    entities: normalizeEntities(parsed.entities),
    missingFields: coerceStringArray(parsed.missingFields),
    notes: coerceStringArray(parsed.notes),
  };
}

export function createLocalParsedIntent(localDetection: WalletAgentIntentDetection): WalletAgentParsedIntent {
  return {
    source: 'local',
    type: localDetection.type,
    confidence: localDetection.confidence,
    entities: {},
    missingFields: [],
    notes: localDetection.matchedKeywords.length > 0
      ? [`Detector local: ${localDetection.matchedKeywords.join(', ')}`]
      : [],
  };
}
