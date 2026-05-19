import { sanitizeString, Limits, ValidationError } from '@/lib/security';
import type {
  AgentMemoryBridgeContentType,
  AgentMemoryBridgeMetadata,
  AgentMemoryBridgeSource,
} from './types';

export const AGENT_MEMORY_BRIDGE_TAG = '[AGENT_MEMORY_BRIDGE]';

const SUPPORTED_SOURCES: AgentMemoryBridgeSource[] = [
  'mythos',
  'hermes',
  'openclaw',
  'eliza',
  'external_agent',
  'congchain',
];

const SUPPORTED_CONTENT_TYPES: AgentMemoryBridgeContentType[] = [
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
];

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /\b(seed phrase|mnemonic|private key|secret key)\b/i,
  /\b[A-Z0-9_]*(API_KEY|SECRET|TOKEN|PRIVATE_KEY)\s*=/i,
  /\bcog_live_[a-f0-9]{24,}\b/i,
  /\b(?:[1-9A-HJ-NP-Za-km-z]{80,})\b/,
];

function safeSlug(value: unknown, fallback: string, maxLength = 48): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength);
  return cleaned || fallback;
}

function safeOptional(value: unknown, maxLength = 80): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

export function normalizeBridgeSource(value: unknown): AgentMemoryBridgeSource {
  const source = safeSlug(value, 'external_agent') as AgentMemoryBridgeSource;
  if (source.startsWith('mythos')) return 'mythos';
  if (source.startsWith('hermes')) return 'hermes';
  if (source.startsWith('openclaw')) return 'openclaw';
  if (source.startsWith('eliza')) return 'eliza';
  return SUPPORTED_SOURCES.includes(source) ? source : 'external_agent';
}

export function normalizeBridgeContentType(value: unknown): AgentMemoryBridgeContentType {
  const contentType = safeSlug(value, 'agent_memory') as AgentMemoryBridgeContentType;
  return SUPPORTED_CONTENT_TYPES.includes(contentType) ? contentType : 'agent_memory';
}

export function normalizeBridgeModel(value: unknown, source: AgentMemoryBridgeSource): string {
  return safeSlug(value, source, 32);
}

export function buildBridgeClientId(input: {
  keyId: string;
  source: AgentMemoryBridgeSource;
  agentId: string;
}): string {
  return `agent:${input.keyId}:${input.source}:${safeSlug(input.agentId, input.source, 64)}`;
}

export function validateBridgeContent(value: unknown): string {
  const content = sanitizeString(value, Limits.MAX_CONTENT_LENGTH, 'Content');
  if (SECRET_PATTERNS.some(pattern => pattern.test(content))) {
    throw new ValidationError('Content appears to contain secrets or private credentials.');
  }
  return content;
}

export function normalizeBridgeMetadata(value: unknown): AgentMemoryBridgeMetadata {
  const raw = (value && typeof value === 'object') ? value as Record<string, unknown> : {};
  const source = normalizeBridgeSource(raw.source);
  const defaultContentType = source === 'mythos'
    ? 'mythos_memory'
    : source === 'hermes'
      ? 'hermes_memory'
      : source === 'openclaw'
        ? 'openclaw_memory'
        : source === 'eliza'
          ? 'eliza_memory'
          : 'agent_memory';
  const contentType = normalizeBridgeContentType(raw.contentType ?? defaultContentType);
  const agentId = safeSlug(raw.agentId, source, 64);
  const safety = (raw.safety && typeof raw.safety === 'object') ? raw.safety as Record<string, unknown> : {};

  if (
    safety.containsSecrets === true ||
    safety.containsPrivateKeys === true ||
    safety.containsSignedPayloads === true ||
    safety.canMoveFunds === true
  ) {
    throw new ValidationError('Bridge safety flags block this memory write.');
  }

  return {
    source,
    contentType,
    agentId,
    agentName: safeOptional(raw.agentName, 60),
    skillName: safeOptional(raw.skillName, 80),
    skillVersion: safeOptional(raw.skillVersion, 40),
    taskId: safeOptional(raw.taskId, 80),
    runId: safeOptional(raw.runId, 80),
    origin: safeOptional(raw.origin, 120),
    proofMode: raw.proofMode === 'zk_requested' || raw.proofMode === 'zk_ready' ? raw.proofMode : 'none',
    anchorMode: raw.anchorMode === 'manual' || raw.anchorMode === 'requested' || raw.anchorMode === 'anchored' ? raw.anchorMode : 'none',
    safety: {
      containsSecrets: false,
      containsPrivateKeys: false,
      containsSignedPayloads: false,
      canMoveFunds: false,
      requiresHumanReview: safety.requiresHumanReview !== false,
    },
  };
}

export function buildBridgeEnvelope(input: {
  content: string;
  owner: string;
  clientId: string;
  metadata: AgentMemoryBridgeMetadata;
}): string {
  const { metadata } = input;
  const lines = [
    AGENT_MEMORY_BRIDGE_TAG,
    `Source: ${metadata.source}`,
    `Agent: ${metadata.agentName || metadata.agentId}`,
    `Agent ID: ${metadata.agentId}`,
    `Content-Type: ${metadata.contentType}`,
    `Owner: ${input.owner}`,
    `Vault: ${input.clientId}`,
    metadata.skillName ? `Skill: ${metadata.skillName}` : null,
    metadata.skillVersion ? `Skill Version: ${metadata.skillVersion}` : null,
    metadata.taskId ? `Task ID: ${metadata.taskId}` : null,
    metadata.runId ? `Run ID: ${metadata.runId}` : null,
    metadata.origin ? `Origin: ${metadata.origin}` : null,
    `Proof Mode: ${metadata.proofMode}`,
    `Anchor Mode: ${metadata.anchorMode}`,
    `Human Review: ${metadata.safety.requiresHumanReview ? 'required' : 'not_required'}`,
    'Safety: no secrets, no private keys, no signed payloads, no fund movement',
    '---',
    input.content,
  ].filter(Boolean);

  return lines.join('\n');
}

export function parseBridgeEnvelope(content: string) {
  if (!content.startsWith(AGENT_MEMORY_BRIDGE_TAG)) return null;
  const lines = content.split('\n');
  const separatorIndex = lines.findIndex(line => line.trim() === '---');
  const headerLines = separatorIndex >= 0 ? lines.slice(1, separatorIndex) : lines.slice(1, 16);
  const body = separatorIndex >= 0 ? lines.slice(separatorIndex + 1).join('\n') : '';
  const fields = new Map<string, string>();

  for (const line of headerLines) {
    const index = line.indexOf(':');
    if (index <= 0) continue;
    fields.set(line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim());
  }

  return {
    source: fields.get('source') || 'external_agent',
    agent: fields.get('agent') || fields.get('agent id') || 'External agent',
    agentId: fields.get('agent id') || 'external_agent',
    contentType: fields.get('content-type') || 'agent_memory',
    vault: fields.get('vault') || '',
    runId: fields.get('run id') || '',
    body,
  };
}
