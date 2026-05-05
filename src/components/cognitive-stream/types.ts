export interface CognitiveAction {
  type: 'api_call' | 'web_search' | 'calculation' | 'decision' | 'render' | 'anchor';
  description: string;
  status: 'pending' | 'success' | 'failure';
  result?: string;
  durationMs?: number;
  source?: string;
}

export interface CognitiveCheckpoint {
  hash: string;
  blockNumber: number;
  timestamp: string;
}

export interface CognitiveStep {
  id: number;
  type: 'analysis' | 'data_collection' | 'verification' | 'synthesis' | 'anchoring';
  model: string;
  status: 'pending' | 'running' | 'completed' | 'paused' | 'error';
  title: string;
  thought: string;
  actions: CognitiveAction[];
  confidence?: number;
  checkpoint?: CognitiveCheckpoint;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface CognitiveStream {
  query: string;
  agentName: string;
  agentModel: string;
  steps: CognitiveStep[];
  currentStepId: number;
  overallStatus: 'running' | 'completed' | 'paused' | 'aborted';
  startedAt: string;
  completedAt?: string;
  totalDurationMs?: number;
  finalHash?: string;
  finalBlockNumber?: number;
}
