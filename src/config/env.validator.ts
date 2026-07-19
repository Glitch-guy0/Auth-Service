import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid PostgreSQL connection URL' }),
  MONGODB_URL: z.string().url({ message: 'MONGODB_URL must be a valid MongoDB connection URL' }),
  REDIS_URL: z.string().url({ message: 'REDIS_URL must be a valid Redis connection URL' }),
  JWT_ACCESS_EXPIRY: z.string().default('1d'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  BCRYPT_COST: z.coerce.number().int().min(4).max(31).default(10),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const formatted = result.error.format();
    const fmt = formatted as Record<string, { _errors?: string[] }>;
    const missing = Object.keys(formatted)
      .filter((key) => key !== '_errors')
      .filter((key) => fmt[key]?._errors?.length);
    const details = missing
      .map((key) => {
        const field = fmt[key];
        return `  - ${key}: ${field?._errors?.join(', ') || 'invalid'}`;
      })
      .join('\n');
    throw new Error(`Environment validation failed:\n${details}`);
  }
  return result.data;
}

export function getValidatedEnv(): Env {
  return validateEnv(process.env);
}
