/**
 * API Key Service — external agent authentication
 *
 * Key format:  cog_live_<32 random hex chars>
 * Storage:     SHA-256 hash of the key (never store plain)
 * Display:     first 12 chars only (prefix)
 *
 * Plans:
 *   free       100 req/day  · 10 memories/day   · no billing
 *   pro        10,000/day   · 1,000 memories/day · $0.01/memory
 *   enterprise unlimited    · custom pricing
 */

import { db } from '@/lib/db';
import { createHash, randomBytes } from 'crypto';

// ── Plan limits ───────────────────────────────────────────────
export const PLAN_LIMITS: Record<string, { reqPerDay: number; memoriesPerDay: number; label: string }> = {
  free:       { reqPerDay: 100,    memoriesPerDay: 10,    label: 'Free' },
  pro:        { reqPerDay: 10_000, memoriesPerDay: 1_000, label: 'Pro' },
  enterprise: { reqPerDay: -1,     memoriesPerDay: -1,    label: 'Enterprise' },
};

export interface ApiKeyRecord {
  id: string;
  keyPrefix: string;
  name: string;
  owner: string;
  plan: string;
  isActive: boolean;
  requestsToday: number;
  requestsTotal: number;
  memoriesSaved: number;
  tokensUsed: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  planLabel: string;
  limitReqPerDay: number;
  limitMemPerDay: number;
}

// ── Helpers ───────────────────────────────────────────────────

function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

function generateRawKey(): string {
  const rand = randomBytes(24).toString('hex'); // 48 hex chars
  return `cog_live_${rand}`;
}

function toRecord(k: { id: string; keyPrefix: string; name: string; owner: string; plan: string; isActive: boolean; requestsToday: number; requestsTotal: number; memoriesSaved: number; tokensUsed: number; lastUsedAt: Date | null; createdAt: Date }): ApiKeyRecord {
  const limits = PLAN_LIMITS[k.plan] ?? PLAN_LIMITS.free;
  return { ...k, planLabel: limits.label, limitReqPerDay: limits.reqPerDay, limitMemPerDay: limits.memoriesPerDay };
}

// ── Public API ────────────────────────────────────────────────

export interface CreateKeyResult {
  record: ApiKeyRecord;
  rawKey: string; // shown ONCE — never stored
}

export async function createApiKey(name: string, owner: string, plan = 'free'): Promise<CreateKeyResult> {
  const raw     = generateRawKey();
  const keyHash = hashKey(raw);
  const prefix  = raw.slice(0, 12); // "cog_live_ab12"

  const created = await db.apiKey.create({
    data: { keyHash, keyPrefix: prefix, name, owner, plan },
  });

  return { record: toRecord(created), rawKey: raw };
}

export async function validateApiKey(rawKey: string): Promise<ApiKeyRecord | null> {
  if (!rawKey?.startsWith('cog_')) return null;

  const key = await db.apiKey.findUnique({ where: { keyHash: hashKey(rawKey) } });
  if (!key || !key.isActive) return null;

  // Reset daily counters if needed
  const now = new Date();
  const reset = new Date(key.rateResetAt);
  const dayPassed = now.getTime() - reset.getTime() > 86_400_000;

  if (dayPassed) {
    await db.apiKey.update({
      where: { id: key.id },
      data: { requestsToday: 0, rateResetAt: now },
    });
    key.requestsToday = 0;
  }

  // Check rate limit
  const limits = PLAN_LIMITS[key.plan] ?? PLAN_LIMITS.free;
  if (limits.reqPerDay > 0 && key.requestsToday >= limits.reqPerDay) return null;

  // Bump usage
  await db.apiKey.update({
    where: { id: key.id },
    data: { requestsToday: { increment: 1 }, requestsTotal: { increment: 1 }, lastUsedAt: now },
  });

  return toRecord({ ...key, requestsToday: key.requestsToday + 1, requestsTotal: key.requestsTotal + 1, lastUsedAt: now });
}

export async function trackMemorySaved(keyId: string, tokens = 0): Promise<void> {
  await db.apiKey.update({
    where: { id: keyId },
    data: { memoriesSaved: { increment: 1 }, tokensUsed: { increment: tokens } },
  }).catch(() => {});
}

export async function listApiKeys(owner: string): Promise<ApiKeyRecord[]> {
  const keys = await db.apiKey.findMany({
    where: { owner },
    orderBy: { createdAt: 'desc' },
  });
  return keys.map(toRecord);
}

export async function revokeApiKey(id: string, owner: string): Promise<boolean> {
  const key = await db.apiKey.findUnique({ where: { id } });
  if (!key || key.owner !== owner) return false;
  await db.apiKey.update({ where: { id }, data: { isActive: false } });
  return true;
}

export async function getApiKeyStats(id: string): Promise<ApiKeyRecord | null> {
  const key = await db.apiKey.findUnique({ where: { id } });
  return key ? toRecord(key) : null;
}
