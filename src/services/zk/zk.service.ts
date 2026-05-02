import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { MemoryEntry } from '@/services/memory';
import type {
  ZkGenerationResult,
  ZkMvpBundle,
  ZkMvpPublicSignals,
  ZkMvpWitness,
} from './zk.model';

const ZK_PROOF_VERSION: ZkMvpPublicSignals['proofVersion'] = 'zk-mvp-v1';
const ZK_HASH_ALGO: ZkMvpPublicSignals['hashAlgo'] = 'sha256';
const BN128_FIELD =
  BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
const DEFAULT_ZK_MAX_CONTENT_LENGTH = 8000;
const DEFAULT_ZK_PROVE_TIMEOUT_MS = 30_000;
const DEFAULT_ZK_VERIFY_TIMEOUT_MS = 10_000;

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function hexToFieldDecimal(hexDigest: string): string {
  const value = BigInt(`0x${hexDigest}`);
  return (value % BN128_FIELD).toString();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function maxContentLength(): number {
  const fromEnv = Number(process.env.ZK_MAX_CONTENT_LENGTH || DEFAULT_ZK_MAX_CONTENT_LENGTH);
  if (!Number.isFinite(fromEnv) || fromEnv < 256) return DEFAULT_ZK_MAX_CONTENT_LENGTH;
  return Math.floor(fromEnv);
}

function validateWitnessLimits(witness: ZkMvpWitness): void {
  if (witness.content.length > maxContentLength()) {
    throw new Error(
      `Content too large for ZK prover (${witness.content.length} > ${maxContentLength()}). ` +
        'Use smaller content or raise ZK_MAX_CONTENT_LENGTH.'
    );
  }
}

function proveTimeoutMs(): number {
  const fromEnv = Number(process.env.ZK_PROVE_TIMEOUT_MS || DEFAULT_ZK_PROVE_TIMEOUT_MS);
  return Number.isFinite(fromEnv) && fromEnv > 1000 ? Math.floor(fromEnv) : DEFAULT_ZK_PROVE_TIMEOUT_MS;
}

function verifyTimeoutMs(): number {
  const fromEnv = Number(process.env.ZK_VERIFY_TIMEOUT_MS || DEFAULT_ZK_VERIFY_TIMEOUT_MS);
  return Number.isFinite(fromEnv) && fromEnv > 1000 ? Math.floor(fromEnv) : DEFAULT_ZK_VERIFY_TIMEOUT_MS;
}

export function isZkMvpEnabled(): boolean {
  return process.env.ZK_MVP_ENABLED === 'true';
}

export function zkMvpMode(): 'simulated' | 'real' {
  return process.env.ZK_MVP_MODE === 'real' ? 'real' : 'simulated';
}

export function buildCanonicalMemoryHash(witness: ZkMvpWitness): string {
  const contentHash = sha256(witness.content);
  const modelDigest = sha256(witness.model);
  return sha256(`${contentHash}:${modelDigest}:${witness.timestamp}:${witness.nonce}`);
}

export function buildZkBundle(witness: ZkMvpWitness): ZkMvpBundle {
  const memoryHash = buildCanonicalMemoryHash(witness);
  const modelDigest = sha256(witness.model);
  const nonceDigest = sha256(witness.nonce);
  const generatedAt = Math.floor(Date.now() / 1000);

  const proofDigest = sha256(
    `${memoryHash}:${modelDigest}:${witness.timestamp}:${nonceDigest}:${ZK_PROOF_VERSION}`
  );

  return {
    publicSignals: {
      memoryHash,
      modelDigest,
      timestamp: witness.timestamp,
      nonceDigest,
      proofVersion: ZK_PROOF_VERSION,
      hashAlgo: ZK_HASH_ALGO,
    },
    proof: {
      proofDigest,
      generatedAt,
      mode: 'mvp-simulated',
    },
  };
}

function verifySimulatedBundle(bundle: ZkMvpBundle): boolean {
  const expected = sha256(
    `${bundle.publicSignals.memoryHash}:${bundle.publicSignals.modelDigest}:` +
      `${bundle.publicSignals.timestamp}:${bundle.publicSignals.nonceDigest}:${bundle.publicSignals.proofVersion}`
  );

  return expected === bundle.proof.proofDigest;
}

function getArtifactPaths() {
  const baseDir = process.env.ZK_ARTIFACTS_DIR || path.join(process.cwd(), 'zk-artifacts');
  return {
    wasm: process.env.ZK_CIRCUIT_WASM || path.join(baseDir, 'memory_hash.wasm'),
    zkey: process.env.ZK_PROVING_KEY || path.join(baseDir, 'memory_hash.zkey'),
    vkey: process.env.ZK_VERIFYING_KEY || path.join(baseDir, 'memory_hash.vkey.json'),
  };
}

async function fileExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function buildRealSnarkBundle(witness: ZkMvpWitness): Promise<ZkMvpBundle> {
  validateWitnessLimits(witness);
  // @ts-ignore — snarkjs has no @types package
  const snarkjs = await import('snarkjs');
  const artifacts = getArtifactPaths();

  const [hasWasm, hasZkey] = await Promise.all([
    fileExists(artifacts.wasm),
    fileExists(artifacts.zkey),
  ]);
  if (!hasWasm || !hasZkey) {
    throw new Error('Missing ZK artifacts. Configure ZK_CIRCUIT_WASM and ZK_PROVING_KEY.');
  }

  const contentHash = sha256(witness.content);
  const modelDigest = sha256(witness.model);
  const nonceDigest = sha256(witness.nonce);

  const input = {
    content_hash: hexToFieldDecimal(contentHash),
    model_digest: hexToFieldDecimal(modelDigest),
    timestamp: witness.timestamp.toString(),
    nonce_digest: hexToFieldDecimal(nonceDigest),
  };

  const { proof, publicSignals } = await withTimeout(
    snarkjs.groth16.fullProve(input, artifacts.wasm, artifacts.zkey),
    proveTimeoutMs(),
    'ZK proof generation'
  );

  const memoryHash = Array.isArray(publicSignals) && publicSignals.length > 0
    ? String(publicSignals[0])
    : '';

  return {
    publicSignals: {
      memoryHash,
      modelDigest,
      timestamp: witness.timestamp,
      nonceDigest,
      proofVersion: ZK_PROOF_VERSION,
      hashAlgo: ZK_HASH_ALGO,
    },
    proof: {
      snarkProof: proof,
      snarkPublicSignals: Array.isArray(publicSignals)
        ? publicSignals.map((value) => String(value))
        : [],
      generatedAt: Math.floor(Date.now() / 1000),
      mode: 'mvp-real-snarkjs',
    },
  };
}

export async function verifyZkBundle(bundle: ZkMvpBundle): Promise<boolean> {
  if (bundle.proof.mode === 'mvp-simulated') {
    return verifySimulatedBundle(bundle);
  }

  // @ts-ignore — snarkjs has no @types package
  const snarkjs = await import('snarkjs');
  const artifacts = getArtifactPaths();
  const hasVKey = await fileExists(artifacts.vkey);
  if (!hasVKey) {
    throw new Error('Missing ZK verifying key. Configure ZK_VERIFYING_KEY.');
  }

  const vKeyRaw = await fs.readFile(artifacts.vkey, 'utf-8');
  const vKey = JSON.parse(vKeyRaw);
  const valid = await withTimeout(
    snarkjs.groth16.verify(vKey, bundle.proof.snarkPublicSignals || [], bundle.proof.snarkProof),
    verifyTimeoutMs(),
    'ZK proof verification'
  );
  if (!valid) return false;

  const publicSignalHash = bundle.proof.snarkPublicSignals?.[0];
  return String(publicSignalHash || '') === bundle.publicSignals.memoryHash;
}

export async function generateZkForMemory(memory: MemoryEntry): Promise<ZkGenerationResult> {
  if (!isZkMvpEnabled()) {
    return {
      enabled: false,
      bundle: null,
      reason: 'ZK_MVP_ENABLED is false. Set ZK_MVP_ENABLED=true to activate.',
    };
  }

  const witness: ZkMvpWitness = {
    content: memory.content,
    model: memory.model,
    timestamp: memory.timestamp,
    nonce: memory.hash.slice(0, 16),
  };

  if (zkMvpMode() === 'real') {
    try {
      const bundle = await buildRealSnarkBundle(witness);
      return { enabled: true, bundle, mode: 'real' };
    } catch (error: unknown) {
      return {
        enabled: false,
        bundle: null,
        mode: 'real',
        reason:
          error instanceof Error
            ? `Real ZK mode failed: ${error.message}`
            : 'Real ZK mode failed',
      };
    }
  }

  return {
    enabled: true,
    bundle: buildZkBundle(witness),
    mode: 'simulated',
  };
}

