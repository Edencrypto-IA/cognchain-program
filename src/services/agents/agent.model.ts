// ============================================================
// Agent Builder — Type definitions
// ============================================================

export type AgentTemplate = 'trading' | 'research' | 'support' | 'solana-sage';

export type DeployTarget = 'telegram' | 'whatsapp';

export interface AgentConfig {
  id?: string;
  name: string;
  goal: string;
  personality: string;
  model: string;
  tools: string[];
  template?: AgentTemplate | null;
  systemPrompt?: string | null;
}

export interface AgentDeploy {
  target: DeployTarget;
  webhookUrl?: string;
  botToken?: string;
  phoneNumber?: string;
}

export interface AgentRuntime {
  id: string;
  name: string;
  goal: string;
  personality: string;
  model: string;
  tools: string[];
  systemPrompt: string;
  isDeployed: boolean;
  deployTarget: string | null;
  memoryCount: number;
  totalInteractions: number;
  createdAt: string;
  // New: decision engine fields
  ruleCount?: number;
  decisionCount?: number;
  isLoopRunning?: boolean;
}

export interface AgentTemplateConfig {
  key: AgentTemplate;
  name: string;
  description: string;
  icon: string;
  goal: string;
  personality: string;
  model: string;
  tools: string[];
  systemPrompt: string;
  // New: default rules for template
  defaultRules?: RuleTemplate[];
}

// Tool definitions
export const AVAILABLE_TOOLS = [
  { key: 'memory', name: 'Verifiable Memory', description: 'Store and retrieve memories with Solana verification' },
  { key: 'web_search', name: 'Web Search', description: 'Search the internet for real-time information' },
  { key: 'code_execution', name: 'Code Execution', description: 'Run code snippets and get results' },
  { key: 'image_generation', name: 'Image Generation', description: 'Generate images from text descriptions' },
  { key: 'blockchain', name: 'Blockchain Query', description: 'Query Solana blockchain data and transactions' },
  { key: 'data_analysis', name: 'Data Analysis', description: 'Analyze data, create charts and reports' },
] as const;

export type ToolKey = typeof AVAILABLE_TOOLS[number]['key'];

// ============================================================
// Decision Engine Types
// ============================================================

export interface Condition {
  type: 'memory_contains' | 'memory_score_above' | 'memory_newer_than' | 'model_equals';
  value: string;
  operator?: '>' | '<' | '=' | 'contains';
  threshold?: number;
}

export interface RuleTemplate {
  name: string;
  condition: Condition;
  action: string;
  params?: Record<string, any>;
}

export interface DecisionRuleData {
  id: string;
  agentId: string;
  name: string;
  condition: string; // JSON
  action: string;
  params: string; // JSON
  isActive: boolean;
  lastTriggered: number | null;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionRecordData {
  id: string;
  agentId: string;
  ruleId: string;
  condition: string;
  action: string;
  result: 'success' | 'failure' | 'pending';
  evidence?: string;
  output?: string;
  txHash?: string;
  timestamp: number;
  createdAt: string;
}
