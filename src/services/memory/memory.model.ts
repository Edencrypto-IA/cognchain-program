export interface MemoryEntry {
  hash: string;
  content: string;
  model: string;
  timestamp: number;
  parentHash?: string | null;
  score?: number | null;
  verified: boolean;
  zkVerified?: boolean;
  zkMode?: string | null;
  zkProofVersion?: string | null;
  zkHashAlgo?: string | null;
  zkGeneratedAt?: number | null;
  zkProof?: unknown;
  zkPublicSignals?: unknown;
}

export interface MemoryCreateInput {
  content: string;
  model: string;
  parentHash?: string | null;
  clientId?: string | null;
}

export interface MemoryScoreInput {
  hash: string;
  score: number;
}

export interface CompareInput {
  prompt: string;
  models: string[];
}

export interface CompareResult {
  model: string;
  response: string;
  hash: string;
  timestamp: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  memoryHash?: string;
}

export interface ContextChunk {
  id: string;
  content: string;
  summary: string;
  model: string;
  timestamp: number;
  score: number | null;
  hash: string;
  tokenEstimate: number;
}

export type AIModel = 'gpt' | 'claude' | 'nvidia' | 'gemini' | 'deepseek' | 'glm' | 'minimax' | 'qwen';

export const MODEL_LABELS: Record<AIModel, string> = {
  gpt:      'GPT-4o',
  claude:   'Claude Opus',
  nvidia:   'NVIDIA Llama',
  gemini:   'Gemini Pro',
  deepseek: 'DeepSeek V3',
  glm:      'GLM-4.7',
  minimax:  'MiniMax M2.7',
  qwen:     'Qwen3 80B',
};

export const PRO_MODEL_KEYS: AIModel[] = ['gpt', 'claude', 'deepseek', 'gemini'];
export const FREE_MODEL_KEYS: AIModel[] = ['nvidia', 'glm', 'minimax', 'qwen'];
