import type { ForgeFile, ForgeNexusNode, ForgeNexusPlan, ForgeNexusRisk, ForgeNexusTactica } from './types';

type NexusSignal = {
  tactica: ForgeNexusTactica;
  reason: string;
  files: string[];
};

const SAFE_PLAN_CHECKS = [
  'Review generated diff before applying changes',
  'Run npm run lint',
  'Run npm run build',
];

function normalizePrompt(prompt: string): string {
  return prompt.replace(/\s+/g, ' ').trim().slice(0, 1200);
}

function includesAny(input: string, terms: string[]): boolean {
  const lowered = input.toLowerCase();
  return terms.some(term => lowered.includes(term));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function inferSignals(prompt: string, files: ForgeFile[]): NexusSignal[] {
  const lowered = prompt.toLowerCase();
  const signals: NexusSignal[] = [];
  const filePaths = files.map(file => file.path);

  if (includesAny(lowered, ['ui', 'design', 'card', 'layout', 'html', 'css', 'front', 'tela', 'visual', 'botao', 'botão'])) {
    signals.push({
      tactica: 'ui',
      reason: 'Interface, layout ou experiência visual aparecem no objetivo.',
      files: filePaths.filter(path => path.includes('/components/') || path.includes('app/') || path.endsWith('.css')).slice(0, 6),
    });
  }

  if (includesAny(lowered, ['api', 'endpoint', 'backend', 'route', 'server', 'database', 'sqlite', 'store'])) {
    signals.push({
      tactica: 'backend',
      reason: 'O objetivo menciona fluxo server-side, endpoint ou persistência.',
      files: filePaths.filter(path => path.includes('/lib/') || path.includes('/store/') || path.includes('/app/')).slice(0, 6),
    });
  }

  if (includesAny(lowered, ['solana', 'anchor', 'program', 'wallet', 'phantom', 'transaction', 'pump', 'token', 'devnet'])) {
    signals.push({
      tactica: 'solana',
      reason: 'Há superfície Solana/on-chain ou carteira envolvida.',
      files: filePaths.filter(path => path.includes('/solana/') || path.toLowerCase().includes('wallet') || path.toLowerCase().includes('pump')).slice(0, 6),
    });
  }

  if (includesAny(lowered, ['security', 'segurança', 'audit', 'auth', 'token', 'key', 'secret', 'permission', 'permissao', 'permissão'])) {
    signals.push({
      tactica: 'security',
      reason: 'O pedido envolve credenciais, autenticação, permissões ou auditoria.',
      files: filePaths.filter(path => path.includes('/security/') || path.toLowerCase().includes('auth') || path.toLowerCase().includes('key')).slice(0, 6),
    });
  }

  if (includesAny(lowered, ['test', 'lint', 'build', 'bug', 'erro', 'quebrou', 'corrigir', 'fix'])) {
    signals.push({
      tactica: 'test',
      reason: 'O objetivo pede correção, validação ou melhoria com testes/checks.',
      files: filePaths.filter(path => path.includes('test') || path.includes('spec') || path.endsWith('.ts') || path.endsWith('.tsx')).slice(0, 6),
    });
  }

  if (signals.length === 0) {
    signals.push({
      tactica: 'architect',
      reason: 'Pedido amplo: começa por arquitetura e escopo antes de editar.',
      files: filePaths.slice(0, 6),
    });
  }

  return signals;
}

function inferRisk(prompt: string, signals: NexusSignal[]): ForgeNexusRisk {
  const lowered = prompt.toLowerCase();
  if (
    includesAny(lowered, ['private key', 'seed', 'assin', 'sign', 'submit', 'buy', 'sell', 'swap', 'pix', 'banco', 'fundos']) ||
    signals.some(signal => signal.tactica === 'solana' || signal.tactica === 'security')
  ) {
    return 'high';
  }
  if (signals.some(signal => signal.tactica === 'backend' || signal.tactica === 'test')) return 'medium';
  return 'low';
}

function makeNode(input: Omit<ForgeNexusNode, 'status' | 'confidence'> & { confidence?: number }): ForgeNexusNode {
  return {
    ...input,
    status: input.dependencies.length === 0 ? 'ready' : 'pending',
    confidence: input.confidence ?? 82,
  };
}

export function createForgeNexusPlan(promptInput: string, files: ForgeFile[] = []): ForgeNexusPlan {
  const prompt = normalizePrompt(promptInput);
  const signals = inferSignals(prompt, files);
  const risk = inferRisk(prompt, signals);
  const createdAt = new Date().toISOString();
  const planId = `nexus_${createdAt.replace(/[-:.TZ]/g, '').slice(0, 14)}`;

  const scoutFiles = unique(signals.flatMap(signal => signal.files)).slice(0, 10);
  const nodes: ForgeNexusNode[] = [
    makeNode({
      id: 'A',
      title: 'Mapear objetivo e superfície',
      detail: 'Strategus interpreta o pedido, identifica arquivos prováveis e separa o que é leitura, edição, teste e revisão.',
      type: 'analysis',
      tactica: 'strategus',
      dependencies: [],
      risk: 'low',
      files: scoutFiles,
      checks: ['Confirmar escopo', 'Confirmar arquivos candidatos'],
      confidence: 88,
    }),
    makeNode({
      id: 'B',
      title: 'Desenhar plano técnico',
      detail: 'Architect organiza a sequência de mudanças com dependências explícitas antes de qualquer diff.',
      type: 'design',
      tactica: 'architect',
      dependencies: ['A'],
      risk,
      files: scoutFiles.slice(0, 8),
      checks: ['Evitar refatoração fora do escopo', 'Preservar integrações existentes'],
      confidence: 84,
    }),
  ];

  signals.forEach((signal, index) => {
    const letter = String.fromCharCode('C'.charCodeAt(0) + index);
    nodes.push(makeNode({
      id: letter,
      title: `${signal.tactica.charAt(0).toUpperCase()}${signal.tactica.slice(1)} pass`,
      detail: signal.reason,
      type: signal.tactica === 'security' ? 'security' : signal.tactica === 'test' ? 'test' : signal.tactica === 'ui' ? 'edit' : 'design',
      tactica: signal.tactica,
      dependencies: ['B'],
      risk: signal.tactica === 'security' || signal.tactica === 'solana' ? 'high' : risk,
      files: signal.files,
      checks: signal.tactica === 'test' ? SAFE_PLAN_CHECKS : ['Gerar proposta revisável', 'Não aplicar alterações automaticamente'],
      confidence: 78,
    }));
  });

  const lastSignalIds = nodes.filter(node => !['A', 'B'].includes(node.id)).map(node => node.id);
  nodes.push(makeNode({
    id: 'V',
    title: 'Validar com lint/build',
    detail: 'Rodar checks permitidos e anexar logs ao terminal do Forge antes da revisão final.',
    type: 'build',
    tactica: 'test',
    dependencies: lastSignalIds.length ? lastSignalIds : ['B'],
    risk: 'medium',
    files: [],
    checks: SAFE_PLAN_CHECKS,
    confidence: 80,
  }));
  nodes.push(makeNode({
    id: 'R',
    title: 'Review humano obrigatório',
    detail: 'O Forge mostra diffs, riscos e logs. Nada é salvo no projeto sem aceite explícito.',
    type: 'review',
    tactica: 'strategus',
    dependencies: ['V'],
    risk,
    files: [],
    checks: ['Aceitar/Rejeitar diff', 'Salvar memória CognChain se fizer sentido'],
    confidence: 92,
  }));

  return {
    id: planId,
    prompt,
    summary: `Plano Nexus para: ${prompt.slice(0, 120)}${prompt.length > 120 ? '...' : ''}`,
    strategy: `Executar em camadas: Strategus mapeia, Architect organiza, Tacticas propõem mudanças e o Forge valida antes do review.`,
    risk,
    estimatedSteps: nodes.length,
    createdAt,
    nodes,
    reviewGate: {
      required: true,
      reason: 'Forge Nexus Fase 1 é planejamento seguro: nenhuma alteração é aplicada sem revisão humana.',
    },
    safety: [
      'Não assina transações',
      'Não envia fundos',
      'Não executa deploy automático',
      'Não aplica diff sem aceite explícito',
    ],
  };
}
