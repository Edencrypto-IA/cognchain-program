import type { TriggerReport } from '@/trigger/triggerEngine';

export type ForgeAgentId = 'architect' | 'solana' | 'backend' | 'ui' | 'security';

export type ForgeAgentStatus = 'idle' | 'thinking' | 'running' | 'blocked' | 'complete';

export type ForgePhase = 'idle' | 'thinking' | 'planning' | 'building' | 'deploying' | 'complete' | 'error';

/** Fine-grained UX state for Forge (stream lifecycle). */
export type ForgeRunStatus = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error' | 'cancelled';

export type ForgePanelTab = 'preview' | 'code' | 'files' | 'diff';

export interface ForgeDiffProposal {
  action: 'edit';
  path: string;
  diff: string;
  createdAt: string;
  originalCode?: string;
  proposedCode?: string;
}

export interface ForgeAgent {
  id: ForgeAgentId;
  name: string;
  role: string;
  accent: string;
  status: ForgeAgentStatus;
  progress: number;
  currentTask: string;
  logs: string[];
}

export interface ForgeTerminalLine {
  id: string;
  kind: 'system' | 'agent' | 'shell' | 'success' | 'warning' | 'error';
  source: string;
  text: string;
  timestamp: string;
  triggerReport?: TriggerReport;
}

export interface ForgeFile {
  path: string;
  language: string;
  status: 'created' | 'modified' | 'queued';
  contents: string;
  real?: boolean;
  size?: number;
}

export interface ForgeSandboxSession {
  id: string;
  title: string;
  prompt: string;
  files: ForgeFile[];
  appliedAt: string;
  hash: string;
  status: 'applied';
}

export interface ForgeBuildStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  detail?: string;
  result?: string;
  files?: string[];
  updatedAt?: string;
}

export interface ForgeMemoryNode {
  id: string;
  label: string;
  detail: string;
  confidence: number;
  hash?: string;
  source?: 'session' | 'cognchain' | 'local';
}

export interface ForgeCommandRun {
  command: 'npm run lint' | 'npm run build';
  status: 'idle' | 'running' | 'complete' | 'error';
  output: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface ForgeSessionSnapshot {
  phase: ForgePhase;
  runStatus: ForgeRunStatus;
  promptHistory: string[];
  activePrompt: string;
  streamedResponse: string;
  agents: ForgeAgent[];
  terminal: ForgeTerminalLine[];
  files: ForgeFile[];
  selectedFile: string;
  buildSteps: ForgeBuildStep[];
  memoryNodes: ForgeMemoryNode[];
  deployStatus: string;
  panelTab: ForgePanelTab;
  sandboxSessions: ForgeSandboxSession[];
  activeSandboxSessionId: string;
  diffProposal?: ForgeDiffProposal | null;
  commandRun?: ForgeCommandRun | null;
}
