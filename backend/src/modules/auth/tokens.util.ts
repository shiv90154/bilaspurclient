import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Refresh token format: `<sessionId>.<secret>`.
 * Only sha256(secret) is stored, so a database leak does not leak tokens.
 */
export function generateRefreshSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function buildRefreshToken(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

export function parseRefreshToken(
  token: string,
): { sessionId: string; secret: string } | null {
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  return { sessionId: token.slice(0, dot), secret: token.slice(dot + 1) };
}

export function secretMatchesHash(secret: string, storedHash: string): boolean {
  const a = Buffer.from(hashRefreshSecret(secret), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
