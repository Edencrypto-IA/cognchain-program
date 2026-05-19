import { AGENT_MEMORY_BRIDGE_ENDPOINTS } from './types';

export const MYTHOS_AGENT_PROFILE = {
  id: 'mythos',
  name: 'Mythos',
  label: 'Primeiro agente externo oficial',
  image: '/agents/mythos.png',
  route: '/mythos',
  summary:
    'Agente externo estruturado para contexto, observabilidade, skills, tarefas e memoria verificavel na CongChain.',
  counts: {
    skills: 168,
    memoryProvidersBeforeCongChain: 8,
    memoryProvidersWithCongChain: 9,
    llmProviders: 28,
    messagePlatforms: 19,
    languageServers: 26,
    toolFiles: 76,
  },
  contracts: [
    {
      name: 'Context Engine',
      status: 'precisa adaptar key',
      detail:
        'Seleciona turnos de alto valor antes da compressao e grava como memoria Mythos autenticada.',
    },
    {
      name: 'Observability',
      status: 'precisa adaptar key',
      detail:
        'Registra tool calls, sessoes e resultados de tarefa como trilha auditavel, sem segredos.',
    },
    {
      name: 'Blockchain Skill',
      status: 'compat parcial',
      detail:
        'Skill existente precisa trocar vault antigo por Authorization Bearer cog_live_*.'
    },
  ],
  endpoints: {
    health: AGENT_MEMORY_BRIDGE_ENDPOINTS.health,
    writeMemory: AGENT_MEMORY_BRIDGE_ENDPOINTS.writeMemory,
    listMemories: AGENT_MEMORY_BRIDGE_ENDPOINTS.listMemories,
    verifyMemory: AGENT_MEMORY_BRIDGE_ENDPOINTS.verifyMemory,
    readMemory: AGENT_MEMORY_BRIDGE_ENDPOINTS.readMemory,
    readProof: AGENT_MEMORY_BRIDGE_ENDPOINTS.readProof,
  },
  requiredEnv: [
    {
      name: 'CONGCHAIN_API_URL',
      value: 'https://cognchain-program-production.up.railway.app',
      secret: false,
    },
    {
      name: 'CONGCHAIN_API_KEY',
      value: 'cog_live_...',
      secret: true,
    },
    {
      name: 'CONGCHAIN_AGENT_ID',
      value: 'mythos-local',
      secret: false,
    },
  ],
  safety: [
    'A key autentica escrita e leitura do vault do agente externo.',
    'Conteudo com API keys, secrets, private keys ou signed payloads e bloqueado.',
    'Memoria salva nao assina, nao agenda, nao compra, nao vende e nao move fundos.',
    'On-chain/ZK ficam explicitos: somente aparecem como ativos quando forem realmente persistidos.',
  ],
} as const;

export type MythosAgentProfile = typeof MYTHOS_AGENT_PROFILE;
