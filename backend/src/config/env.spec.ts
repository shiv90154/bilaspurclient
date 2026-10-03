import { validateEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    const env = validateEnv(valid);
    expect(env.PORT).toBe(3000);
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.DEVICE_CHANGE_LIMIT_30D).toBe(3);
    expect(env.SWAGGER_ENABLED).toBe(false);
  });

  it('coerces numeric and boolean strings', () => {
    const env = validateEnv({ ...valid, PORT: '4000', SWAGGER_ENABLED: 'true' });
    expect(env.PORT).toBe(4000);
    expect(env.SWAGGER_ENABLED).toBe(true);
  });

  it('rejects a short JWT secret', () => {
    expect(() => validateEnv({ ...valid, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('requires DATABASE_URL', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET: valid.JWT_ACCESS_SECRET })).toThrow(
      /DATABASE_URL/,
    );
  });
});
