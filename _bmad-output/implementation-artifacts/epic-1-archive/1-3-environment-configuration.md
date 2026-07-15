---
story_id: 1.3
story_key: 1-3-environment-configuration
story_title: "Environment Configuration"
epic_num: 1
story_num: 3
status: done
created_date: 2025-01-01
---

# Story 1.3: Environment Configuration

## Story Summary
As a developer, I want validated environment configuration, so that the application starts only when all required variables are present.

## User Story
**As a** developer,
**I want** validated environment configuration,
**So that** the application starts only when all required variables are present.

## Acceptance Criteria

### Given the project
- When I check `src/config/env.validator.ts`
- Then it validates all required environment variables (DATABASE_URL, MONGODB_URL, REDIS_URL, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY, BCRYPT_COST, PORT, NODE_ENV)
- And it throws descriptive errors for missing/invalid variables

### Given `.env.example`
- When I copy it to `.env`
- Then all variables are documented with descriptions and default values

## Technical Requirements

### Validation Framework
- Use Zod for environment validation (per AD-11 — Zod Validation)
- Schema must validate all 8 required environment variables
- Use `z.infer<>` to derive a TypeScript type from the schema for type-safe config access

### Environment Variables
| Variable | Type | Required | Default | Validation Rule |
|----------|------|----------|---------|-----------------|
| `DATABASE_URL` | string | yes | — | Must be a valid PostgreSQL connection URL |
| `MONGODB_URL` | string | yes | — | Must be a valid MongoDB connection URL |
| `REDIS_URL` | string | yes | — | Must be a valid Redis connection URL |
| `JWT_ACCESS_EXPIRY` | string | no | `'1d'` | Non-empty string (e.g., `'15m'`, `'1d'`) |
| `JWT_REFRESH_EXPIRY` | string | no | `'7d'` | Non-empty string (e.g., `'7d'`, `'30d'`) |
| `BCRYPT_COST` | number | no | `10` | Integer between 4 and 31 |
| `PORT` | number | no | `3000` | Positive integer (1–65535) |
| `NODE_ENV` | enum | no | `'development'` | One of: `'development'`, `'production'`, `'test'` |

### Error Handling
- Throw a descriptive error on startup when validation fails
- Error message must list all invalid/missing variables
- Use Zod's `.refine()` or `.superRefine()` for cross-field or complex validation if needed
- Never silently fall back to undefined — fail fast and loud

### NestJS Integration
- Use `@nestjs/config` `ConfigModule.forRoot()` with `validate` option to wire Zod validation into the NestJS config pipeline
- Alternatively, validate in `main.ts` before `app.listen()` if ConfigModule integration is not straightforward
- The validated config must be accessible via NestJS dependency injection (`ConfigService` or custom provider)

## Developer Context

### File Structure Requirements
```
/
├── .env.example                    # Documented environment variables
├── .env                            # Actual environment variables (gitignored)
└── src/
    └── config/
        ├── env.validator.ts        # Zod schema + validation logic
        └── env.validator.spec.ts   # Unit tests for validation
```

### env.validator.ts
```typescript
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
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const formatted = result.error.format();
    const missing = Object.keys(formatted)
      .filter((key) => key !== '_errors')
      .filter((key) => formatted[key]?._errors?.length);
    const details = missing
      .map((key) => `  - ${key}: ${(formatted[key] as { _errors: string[] })._errors.join(', ')}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${details}`);
  }
  return result.data;
}

export function getValidatedEnv(): Env {
  return validateEnv(process.env);
}
```

### .env.example
```bash
# ============================================
# AuthService Environment Configuration
# ============================================
# Copy this file to .env and fill in values.
# All variables are validated on startup.

# --- Database Connections ---

# PostgreSQL connection URL for core auth data (users, tokens, keys)
DATABASE_URL=postgresql://user:password@localhost:5432/authdb

# MongoDB connection URL for demographics logging
MONGODB_URL=mongodb://localhost:27017/auth_logging

# Redis connection URL for access token blacklisting
REDIS_URL=redis://localhost:6379

# --- JWT Configuration ---

# Access token expiry duration (e.g., '15m', '1h', '1d')
JWT_ACCESS_EXPIRY=1d

# Refresh token expiry duration (e.g., '7d', '30d')
JWT_REFRESH_EXPIRY=7d

# --- Security ---

# bcrypt hashing cost factor (4–31, higher = slower but more secure)
BCRYPT_COST=10

# --- Server ---

# Port the application listens on
PORT=3000

# Node environment: development | production | test
NODE_ENV=development
```

### main.ts Integration (before app bootstrap)
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getValidatedEnv } from './config/env.validator';

async function bootstrap() {
  // Validate environment before creating the app
  const env = getValidatedEnv();

  const app = await NestFactory.create(AppModule);

  await app.listen(env.PORT);
}

bootstrap();
```

### Key Configuration Details
- **Zod schema**: Defines the shape and constraints of every environment variable
- **`z.coerce`**: Automatically converts string env vars to numbers (NODE_ENV stays as string via `z.enum`)
- **`.default()`**: Provides safe defaults for optional variables — they don't need to be in `.env`
- **`safeParse`**: Used instead of `parse` to allow custom error formatting with descriptive messages
- **Fail-fast**: Validation runs before NestJS creates the app — bad config is caught immediately
- **Type export**: `Env` type is exported for use by AppContext (Story 1.4) and all modules

## Architecture Compliance

### Hexagonal Architecture
- Environment config is infrastructure-level configuration — lives in `src/config/` (outside module boundaries)
- Config is injected into modules via NestJS DI, not imported directly
- AD-11 mandates Zod for all validation — env validation follows this invariant

### Module Lifecycle Pattern (AD-4)
- `setup()` phase reads config from AppContext (which gets it from validated env)
- Env validation happens before module lifecycle begins — config is guaranteed valid when modules call `appContext.config`

### Zod Validation (AD-11)
- All input validation uses Zod — env validation is no exception
- No class-validator or class-transformer for env parsing
- TypeScript type inferred via `z.infer<typeof envSchema>`

### Configuration Flow
```
.env → process.env → validateEnv() → Env object → AppContext.config → modules read config in setup()
```

## Testing Requirements

### Unit Tests
- Test that valid env vars pass validation and return the correct typed object
- Test that missing required vars throw descriptive errors (DATABASE_URL, MONGODB_URL, REDIS_URL)
- Test that invalid types throw errors (e.g., PORT as string, BCRYPT_COST out of range)
- Test that defaults are applied for optional vars (JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY, BCRYPT_COST, PORT, NODE_ENV)
- Test that NODE_ENV only accepts valid enum values

### Test Cases
```typescript
describe('env.validator', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    MONGODB_URL: 'mongodb://localhost:27017/db',
    REDIS_URL: 'redis://localhost:6379',
  };

  it('should validate a complete valid environment', () => { ... });
  it('should apply defaults for optional variables', () => { ... });
  it('should throw when DATABASE_URL is missing', () => { ... });
  it('should throw when MONGODB_URL is missing', () => { ... });
  it('should throw when REDIS_URL is missing', () => { ... });
  it('should throw when DATABASE_URL is not a valid URL', () => { ... });
  it('should throw when PORT is not a valid number', () => { ... });
  it('should throw when BCRYPT_COST is below minimum (4)', () => { ... });
  it('should throw when BCRYPT_COST is above maximum (31)', () => { ... });
  it('should throw when NODE_ENV is not a valid enum value', () => { ... });
  it('should list all invalid variables in error message', () => { ... });
});
```

### Integration Tests
- Verify NestJS `ConfigModule` integrates with Zod validation (if using `ConfigModule.forRoot({ validate })`)
- Verify app fails to start with invalid `.env`
- Verify app starts successfully with valid `.env`

### Test Configuration
- Unit tests in `src/config/env.validator.spec.ts`
- Run with: `npm test -- --testPathPattern=env.validator`
- No external dependencies required — validation is pure logic

## Business Context

### Project Goals
- Build a secure, scalable authentication service
- Fail-fast validation prevents runtime errors from misconfigured environments
- Documented `.env.example` reduces onboarding friction for new developers

### Success Criteria
- `src/config/env.validator.ts` validates all 8 required environment variables
- Descriptive error messages are thrown for missing/invalid variables
- `.env.example` documents all variables with descriptions and default values
- `Env` TypeScript type is exported for use across the codebase
- Unit tests pass with >90% coverage on env validation
- Application refuses to start with invalid configuration

## Implementation Notes

### Key Considerations
- Use `safeParse` for custom error formatting — `parse` throws ZodError which is less readable
- `z.coerce.number()` converts string env vars to numbers automatically — no manual `parseInt` needed
- The `DATABASE_URL`, `MONGODB_URL`, and `REDIS_URL` use `.url()` for basic URL format validation — not connection testing
- Defaults on optional vars mean developers don't need to specify them in `.env` for local development
- The `Env` type is the single source of truth for config shape — consumed by AppContext (Story 1.4)

### Common Pitfalls
- Using `z.number()` instead of `z.coerce.number()` — env vars are always strings
- Forgetting to validate URL format on connection strings — `.url()` catches malformed URLs early
- Not listing all invalid fields in the error message — developers need to see everything at once
- Running validation after `NestFactory.create()` — must validate before app creation for true fail-fast
- Importing `process.env` inside the schema — pass it explicitly for testability

## Dependencies

### Epic Dependencies
- Depends on Story 1.1 (project structure and dependencies installed, including `zod` and `@nestjs/config`)
- Depends on Story 1.2 (path aliases for `@config/*` imports)
- Foundation for Story 1.4 (AppContext consumes `Env` type from this story)
- Foundation for Story 1.5 (AppModule bootstrap uses validated env for PORT, NODE_ENV)

### External Dependencies
- `zod` v4.4.3 (installed in Story 1.1)
- `@nestjs/config` v4.0.2 (installed in Story 1.1)
- Node.js v22.x or later
- NestJS v11.1.3

## Checklist

- [ ] Create `src/config/env.validator.ts` with Zod schema
- [ ] Define schema for all 8 environment variables
- [ ] Add validation rules: URL format for DBs, enum for NODE_ENV, range for BCRYPT_COST/PORT
- [ ] Add defaults for optional variables (JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY, BCRYPT_COST, PORT, NODE_ENV)
- [ ] Implement descriptive error formatting with `safeParse`
- [ ] Export `Env` TypeScript type via `z.infer<>`
- [ ] Export `validateEnv()` and `getValidatedEnv()` functions
- [ ] Create `.env.example` with all variables documented (descriptions, defaults)
- [ ] Wire validation into `main.ts` before `NestFactory.create()`
- [ ] Create `src/config/env.validator.spec.ts` with unit tests
- [ ] Verify all unit tests pass
- [ ] Verify app fails to start with missing DATABASE_URL
- [ ] Verify app starts with valid `.env`

---

*Story created using bmad-create-story workflow*
*Status: ready-for-dev*
*Next: Developer will implement environment configuration with Zod validation*
