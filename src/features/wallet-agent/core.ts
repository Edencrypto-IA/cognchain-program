import {
  createSafeIntentDraft,
  evaluateWalletAgentSafety,
  isValueMovingIntent,
} from './security-policy';
import {
  classifyWalletAgentIntent,
  createWalletAgentSummary,
  estimateWalletAgentRisk,
  extractWalletAgentEntities,
} from './intent-classifier';
import type {
  WalletAgentCommandInput,
  WalletAgentCoreResult,
  WalletAgentIntentDraft,
  WalletAgentPreview,
} from './types';

function createWarnings(input: WalletAgentCommandInput, draft: WalletAgentIntentDraft) {
  const warnings: string[] = [];

  if (isValueMovingIntent(draft.type) && !input.walletAddress) {
    warnings.push('Conecte uma carteira antes de preparar qualquer transacao assinavel.');
  }

  if (draft.riskLevel === 'high') {
    warnings.push('Risco alto: exige revisao cuidadosa de liquidez, contrato, slippage e destino.');
  }

  if (draft.type === 'PRIVACY_PAYMENT') {
    warnings.push('Privacidade deve proteger metadados sem remover consentimento, auditoria ou seguranca do usuario.');
  }

  return warnings;
}

function createPreview(draft: WalletAgentIntentDraft): WalletAgentPreview {
  const valueMoving = isValueMovingIntent(draft.type);
  const networkLabel = draft.network === 'solana-devnet' ? 'Solana Devnet' : 'Solana Mainnet';

  return {
    title: valueMoving ? 'Preview seguro obrigatorio' : 'Analise segura',
    description: draft.summary,
    networkLabel,
    primaryActionLabel: valueMoving ? 'Revisar intencao' : 'Ver analise',
    nextStep: valueMoving
      ? 'Mostrar detalhes, pedir confirmacao interna e somente depois preparar assinatura na wallet.'
      : 'Coletar dados reais, mostrar fontes e gerar uma recomendacao sem mover fundos.',
    checklist: [
      'Confirmar rede e carteira ativa.',
      'Mostrar fontes de preco/dados antes da decisao.',
      'Explicar taxas, slippage, risco e destino em linguagem humana.',
      valueMoving ? 'Exigir assinatura final na wallet.' : 'Manter fluxo somente leitura.',
    ],
    disclosures: [
      'A CONGCHAIN nao executa transacoes automaticamente.',
      'A IA pode preparar a acao; o usuario mantem custodia e aprovacao.',
      'Nenhuma private key deve ser enviada ao backend.',
    ],
  };
}

export function createWalletAgentCore(input: WalletAgentCommandInput): WalletAgentCoreResult {
  const type = classifyWalletAgentIntent(input.prompt);
  const entities = extractWalletAgentEntities(input.prompt);
  const riskLevel = estimateWalletAgentRisk(type, entities);
  const summary = createWalletAgentSummary(type, entities);
  const baseDraft = createSafeIntentDraft({
    type,
    userPrompt: input.prompt,
    network: input.network ?? 'solana-devnet',
    summary,
    entities,
    estimatedValueSol: entities.amountSol,
    riskLevel,
    sources: [],
  });
  const draft = {
    ...baseDraft,
    warnings: createWarnings(input, baseDraft),
  };
  const safety = evaluateWalletAgentSafety(draft);
  const preview = createPreview(draft);

  return { draft, safety, preview };
}
