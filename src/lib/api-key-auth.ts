/**
 * API Key Auth — extracts and validates key from request headers.
 *
 * Accepts:
 *   Authorization: Bearer cog_live_xxxxx
 *   X-API-Key: cog_live_xxxxx
 */

import type { NextRequest } from 'next/server';
import { validateApiKey, type ApiKeyRecord } from '@/services/api-keys/api-key.service';

export function extractRawKey(req: NextRequest): string | null {
  // Authorization: Bearer cog_live_...
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer cog_')) return auth.slice(7);

  // X-API-Key: cog_live_...
  const xkey = req.headers.get('x-api-key');
  if (xkey?.startsWith('cog_')) return xkey;

  return null;
}

export interface AuthResult {
  key: ApiKeyRecord;
  error?: never;
}
export interface AuthError {
  key?: never;
  error: string;
  status: 401 | 429;
}

export async function requireApiKey(req: NextRequest): Promise<AuthResult | AuthError> {
  const raw = extractRawKey(req);
  if (!raw) return { error: 'Missing API key. Provide Authorization: Bearer cog_live_xxx or X-API-Key header.', status: 401 };

  const key = await validateApiKey(raw);
  if (!key) return { error: 'Invalid or inactive API key. Check your key at cognchain.xyz/dashboard/keys', status: 401 };

  // Rate limit check already done inside validateApiKey (returns null if exceeded)
  // If we got here the key is valid and usage incremented
  return { key };
}

export function isRateLimited(key: ApiKeyRecord): boolean {
  const limit = key.limitReqPerDay;
  return limit > 0 && key.requestsToday >= limit;
}
