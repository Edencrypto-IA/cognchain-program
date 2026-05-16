import crypto from 'crypto';

export const USER_EMAIL_COOKIE = 'cog_user';

export type UserEmailSession = {
  email: string;
  authLevel: 'email_local' | 'email_magic';
  verified: boolean;
  createdAt: number;
  expiresAt: number;
};

export type UserEmailMagicLink = {
  email: string;
  purpose: 'email_magic_link';
  nonce: string;
  createdAt: number;
  expiresAt: number;
};

const EMAIL_SESSION_DAYS = 30;
const EMAIL_MAGIC_LINK_MINUTES = 15;

function getSecret() {
  return process.env.USER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || 'fallback-user-secret';
}

export function normalizeUserEmail(email: unknown) {
  if (typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) return null;
  if (normalized.length > 254) return null;
  return normalized;
}

export function createUserEmailSession(email: string, now = Date.now()): UserEmailSession {
  return {
    email,
    authLevel: 'email_local',
    verified: false,
    createdAt: now,
    expiresAt: now + EMAIL_SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function createVerifiedUserEmailSession(email: string, now = Date.now()): UserEmailSession {
  return {
    email,
    authLevel: 'email_magic',
    verified: true,
    createdAt: now,
    expiresAt: now + EMAIL_SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function createUserEmailMagicLink(email: string, now = Date.now()): UserEmailMagicLink {
  return {
    email,
    purpose: 'email_magic_link',
    nonce: crypto.randomBytes(18).toString('base64url'),
    createdAt: now,
    expiresAt: now + EMAIL_MAGIC_LINK_MINUTES * 60 * 1000,
  };
}

export function signUserEmailSession(session: UserEmailSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function signUserEmailMagicLink(link: UserEmailMagicLink) {
  const payload = Buffer.from(JSON.stringify(link)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(`magic:${payload}`).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyUserEmailToken(token: string | undefined | null): UserEmailSession | null {
  if (!token) return null;

  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;

    const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as UserEmailSession;
    if (!session?.email || !['email_local', 'email_magic'].includes(session.authLevel)) return null;
    if (session.expiresAt < Date.now()) return null;

    return session;
  } catch {
    return null;
  }
}

export function verifyUserEmailMagicLinkToken(token: string | undefined | null): UserEmailMagicLink | null {
  if (!token) return null;

  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;

    const expected = crypto.createHmac('sha256', getSecret()).update(`magic:${payload}`).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

    const link = JSON.parse(Buffer.from(payload, 'base64url').toString()) as UserEmailMagicLink;
    if (!link?.email || link.purpose !== 'email_magic_link') return null;
    if (link.expiresAt < Date.now()) return null;

    return link;
  } catch {
    return null;
  }
}

export function toPublicUserEmailSession(session: UserEmailSession) {
  return {
    email: session.email,
    authLevel: session.authLevel,
    verified: session.verified,
    createdAt: new Date(session.createdAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString(),
  };
}
