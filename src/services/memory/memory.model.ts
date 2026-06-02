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
  score?: number | null;
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

export type AIModel =
  | 'gpt'
  | 'claude'
  | 'nvidia'
  | 'gemini'
  | 'deepseek'
  | 'glm'
  | 'minimax'
  | 'qwen'
  | 'nemotron-super-120b'
  | 'deepseek-v4-pro'
  | 'seed-oss-36b'
  | 'qwen35-122b'
  | 'kimi-k26'
  | 'mixtral-8x22b'
  | 'mistral-large'
  | 'gpt-oss-120b'
  | 'gemma4-31b'
  | 'gemma3n-e2b'
  | 'phi4-mini';

export const MODEL_LABELS: Record<AIModel, string> = {
  gpt:      'GPT-4o',
  claude:   'Claude Opus',
  nvidia:   'NVIDIA Llama',
  gemini:   'Gemini Pro',
  deepseek: 'DeepSeek V3',
  glm:      'GLM-4.7',
  minimax:  'MiniMax M2.7',
  qwen:     'Qwen3 80B',
  'nemotron-super-120b': 'Nemotron Super 120B',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
  'seed-oss-36b': 'Seed OSS 36B',
  'qwen35-122b': 'Qwen 3.5 122B',
  'kimi-k26': 'Kimi K2.6',
  'mixtral-8x22b': 'Mixtral 8x22B',
  'mistral-large': 'Mistral Large 3',
  'gpt-oss-120b': 'GPT-OSS 120B',
  'gemma4-31b': 'Gemma 4 31B',
  'gemma3n-e2b': 'Gemma 3N E2B',
  'phi4-mini': 'Phi-4 Mini',
};

export const PRO_MODEL_KEYS: AIModel[] = ['gpt', 'claude', 'deepseek', 'gemini'];
export const FREE_MODEL_KEYS: AIModel[] = [
  'nvidia',
  'glm',
  'minimax',
  'qwen',
  'nemotron-super-120b',
  'deepseek-v4-pro',
  'seed-oss-36b',
  'qwen35-122b',
  'kimi-k26',
  'mixtral-8x22b',
  'mistral-large',
  'gpt-oss-120b',
  'gemma4-31b',
  'gemma3n-e2b',
  'phi4-mini',
];
