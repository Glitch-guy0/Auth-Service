import { validateEnv } from '../env.validator';

describe('env.validator', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    MONGODB_URL: 'mongodb://localhost:27017/db',
    REDIS_URL: 'redis://localhost:6379',
  };

  it('should validate a complete valid environment', () => {
    const result = validateEnv(validEnv);
    expect(result.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(result.MONGODB_URL).toBe(validEnv.MONGODB_URL);
    expect(result.REDIS_URL).toBe(validEnv.REDIS_URL);
  });

  it('should apply defaults for optional variables', () => {
    const result = validateEnv(validEnv);
    expect(result.JWT_ACCESS_EXPIRY).toBe('1d');
    expect(result.JWT_REFRESH_EXPIRY).toBe('7d');
    expect(result.BCRYPT_COST).toBe(10);
    expect(result.PORT).toBe(3000);
    expect(result.NODE_ENV).toBe('development');
  });

  it('should throw when DATABASE_URL is missing', () => {
    const env = { MONGODB_URL: validEnv.MONGODB_URL, REDIS_URL: validEnv.REDIS_URL };
    expect(() => validateEnv(env)).toThrow('DATABASE_URL');
  });

  it('should throw when MONGODB_URL is missing', () => {
    const env = { DATABASE_URL: validEnv.DATABASE_URL, REDIS_URL: validEnv.REDIS_URL };
    expect(() => validateEnv(env)).toThrow('MONGODB_URL');
  });

  it('should throw when REDIS_URL is missing', () => {
    const env = { DATABASE_URL: validEnv.DATABASE_URL, MONGODB_URL: validEnv.MONGODB_URL };
    expect(() => validateEnv(env)).toThrow('REDIS_URL');
  });

  it('should throw when DATABASE_URL is not a valid URL', () => {
    const env = { ...validEnv, DATABASE_URL: 'not-a-url' };
    expect(() => validateEnv(env)).toThrow('DATABASE_URL');
  });

  it('should throw when PORT is not a valid number', () => {
    const env = { ...validEnv, PORT: 'abc' };
    expect(() => validateEnv(env)).toThrow();
  });

  it('should throw when BCRYPT_COST is below minimum (4)', () => {
    const env = { ...validEnv, BCRYPT_COST: '2' };
    expect(() => validateEnv(env)).toThrow();
  });

  it('should throw when BCRYPT_COST is above maximum (31)', () => {
    const env = { ...validEnv, BCRYPT_COST: '32' };
    expect(() => validateEnv(env)).toThrow();
  });

  it('should throw when NODE_ENV is not a valid enum value', () => {
    const env = { ...validEnv, NODE_ENV: 'invalid' };
    expect(() => validateEnv(env)).toThrow();
  });

  it('should list all invalid variables in error message', () => {
    const env = {};
    try {
      validateEnv(env);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Environment validation failed');
    }
  });
});
