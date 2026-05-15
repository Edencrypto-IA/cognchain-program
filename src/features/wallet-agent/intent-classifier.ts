import type {
  WalletAgentIntentEntities,
  WalletAgentIntentType,
  WalletAgentRiskLevel,
} from './types';

const MEME_TOKENS = ['BONK', 'PENGU', 'WIF', 'POPCAT', 'MEW', 'BOME'];
const KNOWN_TOKENS = ['SOL', 'USDC', 'USDT', ...MEME_TOKENS];

function normalizePrompt(prompt: string) {
  return prompt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function classifyWalletAgentIntent(prompt: string): WalletAgentIntentType {
  const text = normalizePrompt(prompt);

  if (/\b(privado|privacidade|privacy|cloak|anonimo|confidencial)\b/.test(text)) {
    return 'PRIVACY_PAYMENT';
  }

  if (/\b(folha|payroll|funcionarios|salarios|equipe|time)\b/.test(text)) {
    return 'PAYROLL_BATCH';
  }

  if (/\b(pagar|pagamento|enviar|transferir)\b/.test(text) && /\b(agenda|agendar|dia|horario|amanha|semana|mes)\b/.test(text)) {
    return 'SCHEDULE_PAYMENT';
  }

  if (/\b(vender|venda|sell|liquidar|take profit|stop)\b/.test(text)) {
    return 'SELL_TOKEN';
  }

  if (/\b(comprar|compra|buy|swap|trocar)\b/.test(text)) {
    return 'BUY_TOKEN';
  }

  if (/\b(alerta|avisar|monitorar|quando chegar|preco chegar|chegar em)\b/.test(text)) {
    return 'PRICE_ALERT';
  }

  if (/\b(risco|analisar|auditar|liquidez|rug|seguranca|holders)\b/.test(text)) {
    return 'RISK_CHECK';
  }

  return 'RISK_CHECK';
}

export function extractWalletAgentEntities(prompt: string): WalletAgentIntentEntities {
  const upperPrompt = prompt.toUpperCase();
  const tokenSymbol = KNOWN_TOKENS.find(token => upperPrompt.includes(token));
  const quoteTokenSymbol = tokenSymbol && tokenSymbol !== 'SOL' ? 'SOL' : undefined;
  const amountMatch = prompt.match(/(\d+(?:[,.]\d+)?)\s*(SOL|solana)\b/i);
  const targetPriceMatch = prompt.match(/(?:\$|usd|preco|preço|chegar em)\s*(\d+(?:[,.]\d+)?)/i);
  const recipientMatch = prompt.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/);
  const employeeCountMatch = prompt.match(/(\d+)\s*(funcionarios|funcionários|colaboradores|pessoas)/i);

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
