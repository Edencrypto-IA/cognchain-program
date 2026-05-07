/**
 * Per-browser session identity — no login required.
 * Each browser gets a random UUID on first visit, stored in cookie `cog_cid`.
 * Chat memories are scoped to this ID; agent/pay memories stay global (null).
 */

export const CLIENT_ID_COOKIE = 'cog_cid';
export const CLIENT_ID_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** Read clientId from incoming request cookies (server-side). */
export function getClientId(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${CLIENT_ID_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

/** Build Set-Cookie header value for a new clientId. */
export function buildClientIdCookie(id: string): string {
  return `${CLIENT_ID_COOKIE}=${id}; Path=/; Max-Age=${CLIENT_ID_MAX_AGE}; SameSite=Lax`;
}

/** Generate a random UUID v4. */
export function generateClientId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
