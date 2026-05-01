import crypto from 'crypto';

/**
 * Generate a deterministic SHA-256 hash from content.
 * Uses the full content string as input for consistent hashing.
 */
export function generateHash(content: string, model?: string): string {
  const data = model ? `${content}:${model}` : content;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a short hash (first 8 chars) for display purposes.
 */
export function shortHash(hash: string): string {
  return hash.substring(0, 8);
}

/**
 * Generate a timestamp (unix seconds).
 */
export function nowTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Format timestamp to readable date string.
 */
export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
