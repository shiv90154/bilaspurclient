import {
  buildRefreshToken,
  generateRefreshSecret,
  hashRefreshSecret,
  parseRefreshToken,
  secretMatchesHash,
} from './tokens.util.js';

describe('refresh token helpers', () => {
  it('round-trips a session id and secret', () => {
    const secret = generateRefreshSecret();
    const token = buildRefreshToken('11111111-2222-3333-4444-555555555555', secret);
    expect(parseRefreshToken(token)).toEqual({
      sessionId: '11111111-2222-3333-4444-555555555555',
      secret,
    });
  });

  it('generates unique url-safe secrets', () => {
    const a = generateRefreshSecret();
    const b = generateRefreshSecret();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('rejects malformed tokens', () => {
    expect(parseRefreshToken('')).toBeNull();
    expect(parseRefreshToken('nodot')).toBeNull();
    expect(parseRefreshToken('.secret')).toBeNull();
    expect(parseRefreshToken('session.')).toBeNull();
  });

  it('matches only the secret that produced the stored hash', () => {
    const secret = generateRefreshSecret();
    const hash = hashRefreshSecret(secret);
    expect(secretMatchesHash(secret, hash)).toBe(true);
    expect(secretMatchesHash(generateRefreshSecret(), hash)).toBe(false);
    expect(secretMatchesHash(secret, 'not-hex')).toBe(false);
  });
});
