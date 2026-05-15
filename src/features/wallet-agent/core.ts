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
  WalletAgentReviewDetails,
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

  if (input.parsedIntent?.source === 'ai' && input.parsedIntent.confidence < 0.72) {
    warnings.push('Parser de IA com baixa confianca: revise todos os campos antes de continuar.');
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

function presentValue(value: string | number | undefined, fallback = 'A confirmar') {
  if (value === undefined || value === '') return fallback;
  return String(value);
}

function createReviewDetails(draft: WalletAgentIntentDraft, input: WalletAgentCommandInput): WalletAgentReviewDetails {
  const valueMoving = isValueMovingIntent(draft.type);
  const walletStatus = input.walletAddress ? 'ready' : valueMoving ? 'missing' : 'review';
  const tokenStatus = draft.entities.tokenSymbol ? 'ready' : 'review';
  const valueStatus = draft.entities.amountSol || draft.entities.targetPriceUsd || draft.type === 'RISK_CHECK'
    ? 'ready'
    : valueMoving
      ? 'missing'
      : 'review';

  return {
    title: valueMoving ? 'Revisao obrigatoria antes de assinar' : 'Revisao de analise segura',
    subtitle: valueMoving
      ? 'Esta etapa apenas organiza a intencao. Nenhuma transacao sera preparada sem confirmacao interna e assinatura da wallet.'
      : 'Esta etapa valida o pedido como somente leitura antes de consultar dados reais e fontes externas.',
    intentLabel: draft.type.toLowerCase().replaceAll('_', ' '),
    custodyLabel: valueMoving ? 'Custodia do usuario - assinatura obrigatoria' : 'Somente leitura - sem assinatura',
    items: [
      {
        label: 'Comando original',
        value: draft.userPrompt,
        status: 'ready',
      },
      {
        label: 'Rede',
        value: draft.network === 'solana-devnet' ? 'Solana Devnet' : 'Solana Mainnet',
        status: 'ready',
      },
      {
        label: 'Carteira',
        value: input.walletAddress ?? 'Nenhuma carteira conectada',
        status: walletStatus,
      },
      {
        label: 'Token',
        value: presentValue(draft.entities.tokenSymbol),
        status: tokenStatus,
      },
      {
        label: 'Valor / condicao',
        value: draft.entities.amountSol
          ? `${draft.entities.amountSol} SOL`
          : draft.entities.targetPriceUsd
            ? `Preco alvo: $${draft.entities.targetPriceUsd}`
            : presentValue(undefined),
        status: valueStatus,
      },
      {
        label: 'Risco inicial',
        value: draft.riskLevel,
        status: draft.riskLevel === 'high' || draft.riskLevel === 'blocked' ? 'review' : 'ready',
      },
      {
        label: 'Parser',
        value: input.parsedIntent
          ? `${input.parsedIntent.source} (${Math.round(input.parsedIntent.confidence * 100)}%)`
          : 'local',
        status: input.parsedIntent?.source === 'ai' ? 'ready' : 'review',
      },
    ],
    requiredBeforeExecution: [
      'Confirmar todos os campos em linguagem humana.',
      'Buscar fontes reais de preco, liquidez, contrato e destino.',
      'Exibir taxas, slippage, rede e impacto esperado.',
      valueMoving ? 'Pedir confirmacao interna antes de abrir assinatura da wallet.' : 'Manter a resposta como analise sem transacao.',
      valueMoving ? 'Exigir assinatura final dentro da wallet conectada.' : 'Registrar apenas evidencias e recomendacao.',
    ],
    blockedActions: [
      'Mover fundos automaticamente.',
      'Assinar transacoes pelo backend.',
      'Usar seed phrase, private key ou permissao invisivel.',
      'Executar ordens agendadas sem nova aprovacao no horario.',
    ],
  };
}

export function createWalletAgentCore(input: WalletAgentCommandInput): WalletAgentCoreResult {
  const type = input.parsedIntent?.type ?? classifyWalletAgentIntent(input.prompt);
  const entities = {
    ...extractWalletAgentEntities(input.prompt),
    ...input.parsedIntent?.entities,
  };
  const riskLevel = estimateWalletAgentRisk(type, entities);
  const summary = createWalletAgentSummary(type, entities);
  const baseDraft = createSafeIntentDraft({
    type,
    userPrompt: input.prompt,
    network: input.network ?? 'solana-devnet',
    walletAddress: input.walletAddress,
    summary,
    entities,
    estimatedValueSol: entities.amountSol,
    riskLevel,
    sources: input.parsedIntent?.source === 'ai' ? ['wallet-agent-ai-parser'] : ['wallet-agent-local-detector'],
  });
  const draft = {
    ...baseDraft,
    warnings: createWarnings(input, baseDraft),
  };
  const safety = evaluateWalletAgentSafety(draft);
  const preview = createPreview(draft);
  const review = createReviewDetails(draft, input);

  return { draft, safety, preview, review };
}
