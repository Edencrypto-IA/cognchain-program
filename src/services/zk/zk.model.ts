export interface ZkMvpWitness {
  content: string;
  model: string;
  timestamp: number;
  nonce: string;
}

export interface ZkMvpPublicSignals {
  memoryHash: string;
  modelDigest: string;
  timestamp: number;
  nonceDigest: string;
  proofVersion: 'zk-mvp-v1';
  hashAlgo: 'sha256';
}

export interface ZkMvpProof {
  proofDigest?: string;
  snarkProof?: unknown;
  snarkPublicSignals?: string[];
  generatedAt: number;
  mode: 'mvp-simulated' | 'mvp-real-snarkjs';
}

export interface ZkMvpBundle {
  publicSignals: ZkMvpPublicSignals;
  proof: ZkMvpProof;
}

export interface ZkGenerationResult {
  enabled: boolean;
  bundle: ZkMvpBundle | null;
  mode?: 'simulated' | 'real';
  reason?: string;
}

