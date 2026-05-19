export const AGENT_MEMORY_BRIDGE_ENDPOINTS = {
  saveMemory: '/api/save-memory',
  writeMemory: '/api/memory/write',
  listMemories: '/api/memory/list',
  health: '/api/memory/health',
  verifyMemory: '/api/memory/verify/{hash}',
  readMemory: '/api/memory/{hash}',
  readProof: '/api/memory/{hash}/proof',
  generateProof: '/api/zk/prove',
  anchorHash: '/api/blockchain/store',
  verifyAnchor: '/api/blockchain/verify',
} as const;

export const AGENT_MEMORY_BRIDGE_SOURCES = [
  'mythos',
  'hermes',
  'openclaw',
  'eliza',
  'external_agent',
  'congchain',
] as const;

export const AGENT_MEMORY_BRIDGE_CONTENT_TYPES = [
  'mythos_skill',
  'mythos_memory',
  'mythos_task_result',
  'hermes_skill',
  'hermes_memory',
  'hermes_task_result',
  'openclaw_skill',
  'openclaw_memory',
  'openclaw_task_result',
  'eliza_skill',
  'eliza_memory',
  'eliza_task_result',
  'agent_skill',
  'agent_memory',
  'agent_task_result',
] as const;

export type AgentMemoryBridgeSource =
  (typeof AGENT_MEMORY_BRIDGE_SOURCES)[number];

export type AgentMemoryBridgeContentType =
  (typeof AGENT_MEMORY_BRIDGE_CONTENT_TYPES)[number];

export type AgentMemoryBridgeProofMode = 'none' | 'zk_requested' | 'zk_ready';

export type AgentMemoryBridgeAnchorMode =
  | 'none'
  | 'manual'
  | 'requested'
  | 'anchored';

export interface AgentMemoryBridgeMetadata {
  source: AgentMemoryBridgeSource;
  contentType: AgentMemoryBridgeContentType;
  agentId: string;
  agentName?: string;
  skillName?: string;
  skillVersion?: string;
  taskId?: string;
  runId?: string;
  origin?: string;
  proofMode: AgentMemoryBridgeProofMode;
  anchorMode: AgentMemoryBridgeAnchorMode;
  safety: {
    containsSecrets: false;
    containsPrivateKeys: false;
    containsSignedPayloads: false;
    canMoveFunds: false;
    requiresHumanReview: boolean;
  };
}

export interface AgentMemoryBridgeSaveRequest {
  content: string;
  model: string;
  parentHash?: string;
  generateZkProof?: boolean;
  metadata: AgentMemoryBridgeMetadata;
}

export interface AgentMemoryBridgeSaveResponse {
  hash: string;
  timestamp: string;
  message: string;
  zkEnabled?: boolean;
  zkPersisted?: boolean;
  proofUrl?: string;
  anchorUrl?: string;
}

export function isAgentMemoryBridgeContentType(
  value: string,
): value is AgentMemoryBridgeContentType {
  return AGENT_MEMORY_BRIDGE_CONTENT_TYPES.includes(
    value as AgentMemoryBridgeContentType,
  );
}

export function buildAgentMemoryBridgeMetadata(
  input: Omit<AgentMemoryBridgeMetadata, 'safety'> & {
    requiresHumanReview?: boolean;
  },
): AgentMemoryBridgeMetadata {
  return {
    ...input,
    safety: {
      containsSecrets: false,
      containsPrivateKeys: false,
      containsSignedPayloads: false,
      canMoveFunds: false,
      requiresHumanReview: input.requiresHumanReview ?? true,
    },
  };
}
