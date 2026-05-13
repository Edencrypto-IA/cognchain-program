export type ForgeAgentId = 'architect' | 'solana' | 'backend' | 'ui' | 'security';

export type ForgeAgentStatus = 'idle' | 'thinking' | 'running' | 'blocked' | 'complete';

export type ForgePhase = 'idle' | 'thinking' | 'planning' | 'building' | 'deploying' | 'complete' | 'error';

/** Fine-grained UX state for Forge (stream lifecycle). */
export type ForgeRunStatus = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error' | 'cancelled';

export type ForgePanelTab = 'preview' | 'code' | 'files' | 'diff';

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
}

export interface ForgeFile {
  path: string;
  language: string;
  status: 'created' | 'modified' | 'queued';
  contents: string;
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
}

export interface ForgeMemoryNode {
  id: string;
  label: string;
  detail: string;
  confidence: number;
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
}
