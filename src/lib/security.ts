// ============================================================
// CONGCHAIN Security Layer — Central security utilities
// ============================================================

// ---- In-memory rate limiter (per IP, per endpoint) ----
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number;  // Time window in ms
  maxRequests: number; // Max requests per window
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  '/api/chat': { windowMs: 60_000, maxRequests: 20 },
  '/api/compare': { windowMs: 60_000, maxRequests: 5 },
  '/api/translate': { windowMs: 60_000, maxRequests: 15 },
  '/api/save-memory': { windowMs: 60_000, maxRequests: 30 },
  '/api/score': { windowMs: 60_000, maxRequests: 30 },
  '/api/blockchain/store': { windowMs: 60_000, maxRequests: 5 },
  '/api/blockchain/verify': { windowMs: 60_000, maxRequests: 10 },
  '/api/wallet/connect': { windowMs: 60_000, maxRequests: 10 },
  '/api/wallet/sign': { windowMs: 60_000, maxRequests: 20 },
  '/api/nft/mint': { windowMs: 60_000, maxRequests: 3 },
};

const GLOBAL_DEFAULT: RateLimitConfig = { windowMs: 60_000, maxRequests: 60 };

/**
 * Check rate limit for a given IP + endpoint.
 * Returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(ip: string, pathname: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
} {
  const config = DEFAULT_LIMITS[pathname] || GLOBAL_DEFAULT;
  const key = `${ip}:${pathname}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    // Evict oldest entries when store is full to prevent unbounded memory growth
    if (rateLimitStore.size >= 10_000) {
      const firstKey = rateLimitStore.keys().next().value;
      if (firstKey) rateLimitStore.delete(firstKey);
    }
    entry = { count: 0, resetAt: now + config.windowMs };
    rateLimitStore.set(key, entry);
  }

  entry.count++;

  const remaining = Math.max(0, config.maxRequests - entry.count);
  const allowed = entry.count <= config.maxRequests;

  return { allowed, remaining, resetAt: entry.resetAt, limit: config.maxRequests };
}

// ---- Input sanitization ----
const MAX_CONTENT_LENGTH = 100_000; // 100KB max for content
const MAX_PROMPT_LENGTH = 50_000;
const MAX_HASH_LENGTH = 128;
const MAX_MESSAGES_ARRAY = 50;
const MAX_COMPARE_MODELS = 5;
const MAX_TRANSLATE_MESSAGES = 100;

const ALLOWED_MODELS = new Set(['gpt', 'claude', 'nvidia', 'gemini', 'deepseek', 'glm', 'minimax', 'qwen']);

export const FREE_MODELS  = new Set(['nvidia', 'glm', 'minimax', 'qwen']);
export const PRO_MODELS   = new Set(['gpt', 'claude', 'deepseek', 'gemini']);
export const MODEL_TIER   = (m: string): 'free' | 'pro' => PRO_MODELS.has(m) ? 'pro' : 'free';
const HEX_REGEX = /^[a-fA-F0-9]{64}$/;
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Sanitize and validate a string input.
 */
export function sanitizeString(input: unknown, maxLength: number, fieldName: string): string {
  if (typeof input !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }
  if (input.length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`);
  }
  if (input.length > maxLength) {
    throw new ValidationError(`${fieldName} exceeds maximum length of ${maxLength} characters`);
  }
  return input;
}

/**
 * Validate a SHA-256 hash (64 hex characters).
 */
export function validateHash(hash: unknown): string {
  if (typeof hash !== 'string' || !HEX_REGEX.test(hash)) {
    throw new ValidationError('Hash must be a valid 64-character hex string');
  }
  return hash;
}

/**
 * Validate AI model name against whitelist.
 */
export function validateModel(model: unknown): string {
  if (typeof model !== 'string' || !ALLOWED_MODELS.has(model)) {
    throw new ValidationError(`Model must be one of: ${[...ALLOWED_MODELS].join(', ')}`);
  }
  return model;
}

/**
 * Validate a Solana public key format (base58).
 */
export function validatePublicKey(key: unknown): string {
  if (typeof key !== 'string' || !BASE58_REGEX.test(key)) {
    throw new ValidationError('Invalid Solana public key format');
  }
  return key;
}

/**
 * Sanitize SVG-unsafe characters (prevent XML injection in NFT metadata).
 */
export function sanitizeForSVG(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\$\{/g, '') // Remove template literal openers only (prevent JS injection)
    .replace(/[^\x20-\x7E\u00C0-\u024F]/g, ''); // Keep printable ASCII + Latin extended
}

// ---- Constants ----
export const Limits = {
  MAX_CONTENT_LENGTH,
  MAX_PROMPT_LENGTH,
  MAX_HASH_LENGTH,
  MAX_MESSAGES_ARRAY,
  MAX_COMPARE_MODELS,
  MAX_TRANSLATE_MESSAGES,
  ALLOWED_MODELS,
  ALLOWED_LANGUAGES: new Set(['pt', 'en', 'zh']),
};

// ---- Custom error ----
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ---- Safe error response ----
export function safeErrorMessage(error: unknown): string {
  if (error instanceof ValidationError) return error.message;
  if (error instanceof Error) {
    // Log the real error server-side but never expose details to client
    console.error(`[Security] ${error.name}: ${error.message}`);
    return 'An internal error occurred. Please try again.';
  }
  return 'An unexpected error occurred.';
}
