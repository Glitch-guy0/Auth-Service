# Story 8.1: Logging Module

Status: done

## Story

As a developer,
I want the LoggingModule with LogManager,
so that modules can create loggers.

## Acceptance Criteria

1. **Given** the project
   **When** LoggingModule is imported into AppModule
   **Then** LogManager is available via AppContext

2. **Given** LogManager is available
   **When** modules call `logManager.getLogger('ModuleName')`
   **Then** returns an ILogger instance scoped to that module name

3. **Given** an ILogger instance
   **When** any method is called (debug, info, warn, error, fatal)
   **Then** the logger outputs a log entry with the correct level, message, and module name

4. **Given** `LOG_LEVEL` environment variable
   **When** LogManager is constructed
   **Then** it respects the configured log level (default: `info`)

## Tasks / Subtasks

- [x] Task 1: Define `ILogger` interface (AC: 3)
  - [x] Create file `src/shared/logging/logger.interface.ts`
  - [x] Define `ILogger` interface with methods: `debug(message, ...args)`, `info(message, ...args)`, `warn(message, ...args)`, `error(message, ...args)`, `fatal(message, ...args)`
  - [x] Export `ILogger` for cross-module consumption
  - [x] All methods return `void`

- [x] Task 2: Add `fatal` method to `LogManager` interface (AC: 1, 3)
  - [x] Update `src/config/app-context.ts` — add `fatal(message: string, ...args: unknown[]): void` to the `LogManager` interface
  - [x] This is a BREAKING CHANGE to the interface — all existing implementations of `LogManager` must add the `fatal` method

- [x] Task 3: Create `LogManager` class (AC: 1, 2, 4)
  - [x] Create file `src/shared/logging/log-manager.ts`
  - [x] Implement `LogManager` class that implements the `LogManager` interface from `@config/app-context`
  - [x] Add private `loggers` Map keyed by module name (singleton per module name)
  - [x] Add `getLogger(moduleName: string): ILogger` method — returns cached logger or creates new one
  - [x] Constructor accepts `level: string` parameter (default: `'info'`)
  - [x] Add `shutdown(): void` method for cleanup (flush buffered entries)
  - [x] For this story, create a simple console-based `ILogger` implementation inline (Story 8.2 replaces with PinoLogger)

- [x] Task 4: Update `LoggingModule` to be a global NestJS module (AC: 1)
  - [x] Update `src/modules/logging/logging.module.ts`
  - [x] Add `@Global()` decorator so `LogManager` is available to all modules without re-importing
  - [x] Register `LogManager` as a provider using `useFactory` pattern (read `LOG_LEVEL` from `process.env`)
  - [x] Export `LogManager` from the module

- [x] Task 5: Wire `LogManager` into `AppContext` during bootstrap (AC: 1)
  - [x] Update `src/main.ts` — after creating the NestJS app, resolve `LogManager` from the container: `app.get(LogManager)`
  - [x] Replace the placeholder `console.log`-based LogManager in `setAppContext()` with the real `LogManager` instance
  - [x] Remove the inline LogManager stub (lines 14-23 of current main.ts)

- [x] Task 6: Update `AppModule` import order (AC: 1)
  - [x] Update `src/app.module.ts` — move `LoggingModule` to the FIRST position in the imports array
  - [x] This ensures `LogManager` is instantiated before any module that calls `appContext.logManager.getLogger()` in its own `setup()`

- [x] Task 7: Update existing tests that mock LogManager (AC: 1)
  - [x] Update `src/config/__tests__/app-context.spec.ts` — add `fatal: jest.fn()` to the mock LogManager in `createMockContext()`
  - [x] Verify existing tests still pass

- [x] Task 8: Write unit tests for LogManager (AC: 2, 3, 4)
  - [x] Create test file `src/shared/logging/__tests__/log-manager.spec.ts`
  - [x] Test: `getLogger('Test')` returns an object with all 5 methods (debug, info, warn, error, fatal)
  - [x] Test: `getLogger('Test')` called twice returns the same instance (singleton per module name)
  - [x] Test: `getLogger('A')` and `getLogger('B')` return different instances
  - [x] Test: Logger output includes the module name in the message prefix
  - [x] Test: LogManager respects the log level (logger with level 'warn' does not output on `info()`)
  - [x] Test: `shutdown()` completes without error

## Dev Notes

### Existing Code Context

**LogManager Interface** (`src/config/app-context.ts:1-6`):

- Currently defines `info`, `warn`, `error`, `debug` methods
- **MISSING:** `fatal` method — this story must add it
- This is the contract that all LogManager implementations must satisfy

**LoggingModule Stub** (`src/modules/logging/logging.module.ts`):

- Currently empty: `@Module({}) export class LoggingModule {}`
- Must be converted to a `@Global()` module that provides `LogManager`

**AppContext** (`src/config/app-context.ts:8-11`):

- Already defines `logManager: LogManager` in the `AppContext` interface
- Already has `setAppContext()`, `getAppContext()`, `resetAppContext()`
- No changes needed to the `AppContext` interface itself

**AppModule** (`src/app.module.ts`):

- Already imports `LoggingModule` (line 6, 17)
- Import is NOT first in the list — must be moved to first position
- Already implements `NestModule` with middleware consumer

**Main Bootstrap** (`src/main.ts:13-25`):

- Currently creates a placeholder LogManager using `console.log/warn/error/debug`
- **Must be replaced** with the real LogManager resolved from NestJS DI container
- Pattern: `const logManager = app.get(LogManager); setAppContext({ logManager, ... })`

**Existing Test Mock** (`src/config/__tests__/app-context.spec.ts:4-10`):

- `createMockContext()` creates a LogManager mock without `fatal`
- Must be updated to include `fatal: jest.fn()`

**Dependencies Already Installed** (`package.json`):

- `pino: ^10.3.1` — installed, will be used by Story 8.2
- `chalk: ^4.1.2` — installed, will be used by Story 8.2

### What This Story Changes

| File                                               | Action     | Description                                                            |
| -------------------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| `src/shared/logging/logger.interface.ts`           | **CREATE** | New file — `ILogger` interface definition                              |
| `src/shared/logging/log-manager.ts`                | **CREATE** | New file — `LogManager` class with `getLogger()` factory               |
| `src/modules/logging/logging.module.ts`            | **UPDATE** | Convert from empty stub to `@Global()` module with LogManager provider |
| `src/config/app-context.ts`                        | **UPDATE** | Add `fatal` method to `LogManager` interface                           |
| `src/main.ts`                                      | **UPDATE** | Replace placeholder LogManager with DI-resolved LogManager             |
| `src/app.module.ts`                                | **UPDATE** | Move LoggingModule to first position in imports                        |
| `src/config/__tests__/app-context.spec.ts`         | **UPDATE** | Add `fatal` to mock LogManager                                         |
| `src/shared/logging/__tests__/log-manager.spec.ts` | **CREATE** | Unit tests for LogManager                                              |

### What Must Be Preserved

- All existing endpoints (register, authenticate, refresh, logout) must continue to work
- The `AppContext` singleton pattern (`setAppContext`/`getAppContext`/`resetAppContext`) must not change
- Existing `NestModule` implementation in `AppModule` (middleware consumer) must not break
- Global `ValidationPipe` and `AllExceptionsFilter` registration must not change
- All existing test mocks of LogManager must be updated to include `fatal` or tests will break
- The `demographics.schema.ts` file in the logging directory is unrelated to this story — do not modify

### Architecture References

- **Section 8.1 — Logging Architecture** (`architecture.md:401-439`): Defines the layered design: Modules → loggerService → logProvider (pino + chalk) → Telemetry Factory. This story implements the top two layers (Modules access LogManager → LogManager creates loggers).
- **Section 8.2 — Module Lifecycle** (`architecture.md:441-468`): Shows the `IModule` interface with `setup()` → `run()` → `shutdown()`. The LoggingModule's `shutdown()` should flush buffered log entries.
- **Section 2.2 — Module Isolation** (`architecture.md:64-82`): Shows `AppContext` interface with `logManager: LogManager` — the pattern this story follows.
- **AD-4 Module Lifecycle Pattern** (from implementation docs): LoggingModule implements lifecycle methods. `setup()` configures LogManager, `run()` is a no-op, `shutdown()` flushes.
- **AD-1 Hexagonal Module Boundary**: LoggingModule is a cross-cutting concern providing an outbound port (ILogger) consumed by other modules.

### Code Patterns to Follow

**NestJS Global Module Pattern** (from `redis.module.ts`):

```typescript
import { Module, Global } from '@nestjs/common';

@Global()
@Module({
  providers: [{ provide: LogManager, useFactory: () => new LogManager(level) }],
  exports: [LogManager],
})
export class LoggingModule {}
```

**DI Container Resolution Pattern** (for main.ts):

```typescript
const app = await NestFactory.create(AppModule);
const logManager = app.get(LogManager);
setAppContext({ logManager, config: validatedConfig });
```

**Symbol-based Token Pattern** (from `common/ports/key-manager.token.ts`):
This story uses the class itself as the token (`LogManager`), not a Symbol, since LogManager is a concrete class that implements its own interface.

**Path Aliases**:

- `@shared/*` maps to `src/shared/*`
- `@config/*` maps to `src/config/*`
- Use `@shared/logging/logger.interface` for cross-module imports

### Key Design Decisions

1. **`@Global()` module.** LogManager is a cross-cutting concern available to every module. Using `@Global()` avoids re-importing LoggingModule in every feature module. This follows NestJS convention for infrastructure services.

2. **Import order matters.** LoggingModule must be first in `AppModule` imports so LogManager is instantiated before any module that calls `appContext.logManager.getLogger()` in its own `setup()`. If another module's `setup()` runs first and tries to access `logManager`, it will fail because the LogManager provider hasn't been created yet.

3. **Singleton per module name.** `getLogger('Auth')` always returns the same ILogger instance. This is efficient (Map lookup) and ensures consistent log formatting per module. Module-level loggers are long-lived — they don't need to be garbage collected.

4. **`fatal` triggers graceful shutdown.** Per the architecture, `fatal()` calls `process.exit(1)`. This is standard pino behavior and correct for unrecoverable errors. If the caller wants to log a severe error without exiting, they should use `error()` instead.

5. **Placeholder implementation for Story 8.1.** This story creates a simple console-based ILogger. Story 8.2 replaces it with PinoLogger (pino + chalk). The LogManager's `getLogger()` method will be updated to create PinoLogger instances instead of the placeholder. This staged approach means Story 8.1 can be tested independently.

6. **Environment-driven log level.** `LOG_LEVEL` defaults to `info`. Valid values: `debug`, `info`, `warn`, `error`, `fatal`. Invalid values should fall back to `info` with a console warning during startup.

### Project Structure Notes

- New directory `src/shared/logging/` follows the existing `src/shared/` convention (cf. `src/shared/exceptions/`, `src/shared/transaction/`)
- The `logger.interface.ts` file is the hexagonal port (contract) — consumed by all modules
- The `log-manager.ts` file is the orchestrator that creates and manages logger instances
- Test file follows `__tests__/` convention: `src/shared/logging/__tests__/log-manager.spec.ts`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#8.1 — Logging Architecture layered design]
- [Source: _bmad-output/planning-artifacts/architecture.md#8.2 — Module Lifecycle]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.1 — Acceptance Criteria]
- [Source: _bmad-output/implementation-artifacts/implementation-docs/epic-8-logging/README.md#Story 8.1 — Implementation Guidance]
- [Source: src/config/app-context.ts:1-6 — Current LogManager interface (missing fatal)]
- [Source: src/modules/logging/logging.module.ts:1-4 — Current empty stub]
- [Source: src/main.ts:13-25 — Placeholder LogManager to replace]
- [Source: src/app.module.ts:12-20 — Current import order (LoggingModule not first)]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

| File                                               | Action |
| -------------------------------------------------- | ------ |
| `src/shared/logging/logger.interface.ts`           | CREATE |
| `src/shared/logging/log-manager.ts`                | CREATE |
| `src/shared/logging/__tests__/log-manager.spec.ts` | CREATE |
| `src/modules/logging/logging.module.ts`            | UPDATE |
| `src/config/app-context.ts`                        | UPDATE |
| `src/main.ts`                                      | UPDATE |
| `src/app.module.ts`                                | UPDATE |
| `src/config/__tests__/app-context.spec.ts`         | UPDATE |
