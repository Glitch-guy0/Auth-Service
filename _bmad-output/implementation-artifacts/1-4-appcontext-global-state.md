---
story_id: 1.4
story_key: 1-4-appcontext-global-state
story_title: "AppContext Global State"
epic_num: 1
story_num: 4
status: ready-for-dev
created_date: 2025-01-01
---

# Story 1.4: AppContext Global State

## Story Summary
As a developer, I want a global AppContext for sharing config and services across modules, so that modules can access shared resources without circular dependencies.

## User Story
**As a** developer,
**I want** a global AppContext for sharing config and services across modules,
**So that** modules can access shared resources without circular dependencies.

## Acceptance Criteria

### Given the project
- When I check `src/config/app-context.ts`
- Then AppContext interface is defined with `logManager`, `config`, and other shared services
- And AppContext is a singleton that modules can import

### Given the project
- When a module calls `getAppContext()`
- Then it receives the same singleton instance with all shared services populated

### Given the project
- When `setAppContext()` is called a second time in production
- Then it throws an error to enforce singleton invariant

## Technical Requirements

### Singleton Pattern
- Module-level `let instance: AppContext | null = null` — no class, no global state beyond this
- `getAppContext()` returns the current instance; throws if not initialized
- `setAppContext(ctx)` sets the instance once; throws if already set in production (`NODE_ENV === 'production'`)
- In non-production environments, `setAppContext()` can be called multiple times to facilitate testing

### AppContext Interface
- `logManager`: Stub `LogManager` interface (implemented in Epic 8)
- `config`: Validated `Env` type from `src/config/env.validator.ts`
- Extensible — additional shared services can be added in later stories without breaking changes

### Circular Dependency Prevention
- AppContext lives in `src/config/` — outside any feature module boundary
- Modules import AppContext via path alias `@config/app-context`
- AppContext does NOT import any feature modules (no `src/modules/*` imports)
- This guarantees no circular dependency chain through the context

### Type Safety
- All properties are typed interfaces — no `any`
- `LogManager` is a stub interface for now (full implementation in Epic 8)
- `Config` type is imported from `env.validator.ts` (Story 1.3)

## Developer Context

### File Structure Requirements
```
src/
└── config/
    ├── env.validator.ts          # Story 1.3 — validated env config
    ├── app-context.ts            # Story 1.4 — global singleton context
    └── app-context.spec.ts       # Story 1.4 — unit tests
```

### app-context.ts
```typescript
import { Env } from './env.validator';

export interface LogManager {
  // Stub — full implementation in Epic 8 (Logging module)
  // Provides structured logging (info, warn, error, debug)
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

export interface AppContext {
  logManager: LogManager;
  config: Env;
}

let instance: AppContext | null = null;

export function getAppContext(): AppContext {
  if (!instance) {
    throw new Error(
      'AppContext not initialized. Call setAppContext() during bootstrap before using getAppContext().',
    );
  }
  return instance;
}

export function setAppContext(ctx: AppContext): void {
  if (instance) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'AppContext already initialized. setAppContext() must only be called once in production.',
      );
    }
    // In non-production environments, allow re-initialization for testing
  }
  instance = ctx;
}

/**
 * Resets the singleton instance. Use only in tests to clean up between test cases.
 * @internal — not exported from the barrel file in production code
 */
export function resetAppContext(): void {
  instance = null;
}
```

### Key Design Decisions
- **Function-based, not class-based**: `getAppContext()` / `setAppContext()` — avoids NestJS DI complexity for a global singleton
- **`resetAppContext()` for tests**: Allows each test case to start with a clean slate
- **Production guard**: Prevents accidental double-initialization in production; relaxed in dev/test for testability
- **Stub LogManager**: The interface is minimal — just enough for Story 1.4 to compile. Epic 8 fills in the real implementation.

### Integration with main.ts (Story 1.5)
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getValidatedEnv } from './config/env.validator';
import { setAppContext } from './config/app-context';

async function bootstrap() {
  const env = getValidatedEnv();

  // Initialize AppContext with validated config
  setAppContext({
    config: env,
    logManager: createStubLogManager(), // stub until Epic 8
  });

  const app = await NestFactory.create(AppModule);
  await app.listen(env.PORT);
}
bootstrap();
```

### Module Usage (Story 1.5+)
```typescript
import { getAppContext } from '@config/app-context';

// Inside a module's setup() or service method
const { config, logManager } = getAppContext();
logManager.info('Module initialized', { port: config.PORT });
```

## Architecture Compliance

### Hexagonal Architecture
- AppContext is infrastructure-level configuration — lives in `src/config/` (outside module boundaries)
- Modules access AppContext through the `getAppContext()` function, not through DI injection
- This is a pragmatic deviation from pure NestJS DI — AppContext is a lightweight bootstrap mechanism, not a service

### Module Lifecycle Pattern (AD-4)
- `setup()` phase reads config from AppContext: `const { config, logManager } = getAppContext()`
- AppContext is initialized before NestJS creates the app — modules find it ready when `setup()` runs
- AD-4 specifies modules call `appContext.config` and `appContext.logManager` in `setup()` — this story provides exactly that

### Configuration Flow
```
.env → process.env → validateEnv() → Env object
         ↓
setAppContext({ config: env, logManager: stub })
         ↓
getAppContext() → { config, logManager }  ← consumed by all modules in setup()
```

### Circular Dependency Prevention
- AppContext imports only from `src/config/env.validator.ts` — no feature module imports
- Feature modules import from `@config/app-context` — no reverse dependency
- This breaks the circular dependency chain: `config → (nothing in modules/)` and `modules → config`

## Testing Requirements

### Unit Tests
```typescript
import { getAppContext, setAppContext, resetAppContext } from './app-context';

describe('AppContext', () => {
  beforeEach(() => {
    resetAppContext();
  });

  const mockContext = {
    config: {
      DATABASE_URL: 'postgresql://localhost:5432/db',
      MONGODB_URL: 'mongodb://localhost:27017/db',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_EXPIRY: '1d',
      JWT_REFRESH_EXPIRY: '7d',
      BCRYPT_COST: 10,
      PORT: 3000,
      NODE_ENV: 'development',
    },
    logManager: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  };

  it('should throw when getAppContext is called before setAppContext', () => {
    expect(() => getAppContext()).toThrow('AppContext not initialized');
  });

  it('should return the context after setAppContext', () => {
    setAppContext(mockContext);
    expect(getAppContext()).toBe(mockContext);
  });

  it('should return the same instance on multiple calls', () => {
    setAppContext(mockContext);
    expect(getAppContext()).toBe(getAppContext());
  });

  it('should allow setAppContext in non-production after reset', () => {
    process.env.NODE_ENV = 'test';
    setAppContext(mockContext);
    resetAppContext();
    setAppContext(mockContext);
    expect(getAppContext()).toBe(mockContext);
  });

  it('should throw on double setAppContext in production', () => {
    process.env.NODE_ENV = 'production';
    setAppContext(mockContext);
    expect(() => setAppContext(mockContext)).toThrow('already initialized');
    process.env.NODE_ENV = 'development';
  });

  it('should reset instance after resetAppContext', () => {
    setAppContext(mockContext);
    resetAppContext();
    expect(() => getAppContext()).toThrow('AppContext not initialized');
  });
});
```

### Test Coverage Target
- >90% line coverage on `app-context.ts`
- All 6 test cases must pass

### Test Configuration
- Unit tests in `src/config/app-context.spec.ts`
- Run with: `npm test -- --testPathPattern=app-context`
- No external dependencies required — pure logic tests

## Business Context

### Project Goals
- Build a secure, scalable authentication service
- AppContext provides the central nervous system for sharing configuration and services
- Eliminates circular dependency risk that would otherwise plague cross-module communication

### Success Criteria
- `src/config/app-context.ts` defines the `AppContext` interface with `logManager` and `config`
- `getAppContext()` returns a typed singleton instance
- `setAppContext()` enforces singleton in production
- `resetAppContext()` allows clean test isolation
- Unit tests pass with >90% coverage
- No circular dependency between `src/config/` and `src/modules/`

## Implementation Notes

### Key Considerations
- The `LogManager` interface is a stub — just enough signatures for TypeScript to compile. Epic 8 replaces it with a real implementation using pino.
- `resetAppContext()` is intentionally not exported from a barrel file — it's for test use only
- In production, `setAppContext()` throws on second call — this is a hard invariant
- In test (`NODE_ENV === 'test'`), re-initialization is allowed for test isolation

### Common Pitfalls
- Forgetting to call `setAppContext()` before `getAppContext()` — results in a thrown error at startup
- Importing `getAppContext()` at module scope (top-level) instead of inside a function — the context may not be initialized yet. Always call `getAppContext()` inside `setup()` or service methods.
- Not resetting AppContext in tests — causes test pollution where one test's context leaks into the next

## Dependencies

### Epic Dependencies
- Depends on Story 1.1 (project structure and dependencies installed)
- Depends on Story 1.2 (path aliases for `@config/*` imports)
- Depends on Story 1.3 (`Env` type from `env.validator.ts`)
- Foundation for Story 1.5 (AppModule bootstrap initializes AppContext with validated config)
- Foundation for Epic 8 (LogManager stub is replaced with real pino-based implementation)

### External Dependencies
- None — this story only uses TypeScript types and a module-level variable
- `zod` is not directly used here — `Env` type is imported from `env.validator.ts`

## Checklist

- [ ] Create `src/config/app-context.ts` with AppContext interface
- [ ] Define `LogManager` stub interface with info, warn, error, debug methods
- [ ] Implement `getAppContext()` — returns singleton or throws if not initialized
- [ ] Implement `setAppContext()` — sets singleton; throws in production if called twice
- [ ] Implement `resetAppContext()` — for test cleanup
- [ ] Export `AppContext`, `LogManager`, `getAppContext`, `setAppContext`, `resetAppContext`
- [ ] Create `src/config/app-context.spec.ts` with unit tests
- [ ] Verify all 6 test cases pass
- [ ] Verify >90% line coverage
- [ ] Verify no circular dependency between `src/config/` and `src/modules/`

---

*Story created using bmad-create-story workflow*
*Status: ready-for-dev*
*Next: Developer will implement AppContext singleton with LogManager stub*
