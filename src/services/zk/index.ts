export {
  isZkMvpEnabled,
  zkMvpMode,
  buildCanonicalMemoryHash,
  buildZkBundle,
  buildRealSnarkBundle,
  verifyZkBundle,
  generateZkForMemory,
} from './zk.service';
export type {
  ZkGenerationResult,
  ZkMvpBundle,
  ZkMvpProof,
  ZkMvpPublicSignals,
  ZkMvpWitness,
} from './zk.model';

