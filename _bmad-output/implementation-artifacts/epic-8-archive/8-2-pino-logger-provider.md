# Story 8.2: Pino Logger Provider

Status: done

## Story

As a developer,
I want pino + chalk for colorful console output,
so that logs are readable and fast.

## Acceptance Criteria

1. **Given** the project
   **When** a log message is written
   **Then** it uses pino for structured JSON logging

2. **Given** the project
   **When** chalk colors are applied for console output
   **Then** each log level has a distinct color in development mode

3. **Given** the project
   **When** I check log level configuration
   **Then** log levels are configurable via LOG_LEVEL env var

4. **Given** `NODE_ENV=production`
   **When** a log message is written
   **Then** the output is raw JSON to stdout (no ANSI color codes)

5. **Given** `NODE_ENV=development`
   **When** a log message is written
   **Then** the output is colorized with chalk: debug=gray, info=green, warn=yellow, error=red, fatal=magenta

6. **Given** a log entry
   **When** it is emitted
   **Then** it includes: level, time (ISO 8601), msg (message), module (logger name)

7. **Given** structured context `{ userId: '123' }`
   **When** `logger.info({ userId: '123' }, 'User created')`
   **Then** the JSON output includes `"userId": "123"`

8. **Given** `logger.fatal('unrecoverable')`
   **When** the fatal method is called
   **Then** `process.exit(1)` is called after logging

## Tasks / Subtasks

- [x] Task 1: Create chalk transport for development colorization (AC: #2, #5)
  - [x] Subtask 1.1: Create `src/shared/logging/chalk-transport.ts`
  - [x] Subtask 1.2: Implement a `Writable` stream that parses pino JSON output and applies chalk colors per level
  - [x] Subtask 1.3: Define level-to-color mapping: debug=gray, info=green, warn=yellow, error=red, fatal=magenta
  - [x] Subtask 1.4: Define level labels: `DEBUG`, `INFO `, `WARN `, `ERROR`, `FATAL`
  - [x] Subtask 1.5: Format each line as `{timestamp} [{LEVEL}] [{module}] {message}`
  - [x] Subtask 1.6: Handle malformed JSON gracefully (passthrough the raw chunk)

- [x] Task 2: Create PinoLogger class (AC: #1, #6, #7, #8)
  - [x] Subtask 2.1: Create `src/shared/logging/pino-logger.ts`
  - [x] Subtask 2.2: Import pino, chalk, and `ILogger` from `./logger.interface`
  - [x] Subtask 2.3: Create a `LEVEL_MAP` constant mapping level names to pino numeric levels
  - [x] Subtask 2.4: In the constructor, accept `moduleName` and `level` parameters
  - [x] Subtask 2.5: In the constructor, configure pino with: `name: moduleName`, `level`, `timestamp: pino.stdTimeFunctions.isoTime`, and a `formatters.level` that returns `{ level: label }`
  - [x] Subtask 2.6: In the constructor, check `NODE_ENV !== 'production'` — if true, pipe pino output through the chalk transport using `pino.multistream` or `pino.transport`
  - [x] Subtask 2.7: In the constructor, attach a child logger with `{ module: moduleName }` to include the module field in every entry
  - [x] Subtask 2.8: Implement `debug(message, ...args)`, `info(message, ...args)`, `warn(message, ...args)`, `error(message, ...args)`, `fatal(message, ...args)` — each delegates to the corresponding pino method with spread args before the message
  - [x] Subtask 2.9: In `fatal()`, call `process.exit(1)` after logging

- [x] Task 3: Validate LOG_LEVEL configuration (AC: #3)
  - [x] Subtask 3.1: In the PinoLogger constructor, validate that `level` is one of: `debug`, `info`, `warn`, `error`, `fatal`
  - [x] Subtask 3.2: If the level is invalid, default to `info` (pino handles this, but we add explicit validation for clarity)

- [x] Task 4: Add unit tests (AC: #1, #2, #5, #6, #7, #8)
  - [x] Subtask 4.1: Create `src/shared/logging/__tests__/pino-logger.spec.ts`
  - [x] Subtask 4.2: Test that PinoLogger with level `info` does not emit debug messages
  - [x] Subtask 4.3: Test that PinoLogger with level `debug` emits debug messages with level 20
  - [x] Subtask 4.4: Test that logger output includes the module name in JSON output
  - [x] Subtask 4.5: Test that structured context is merged into JSON output
  - [x] Subtask 4.6: Test that `fatal()` calls `process.exit(1)`
  - [x] Subtask 4.7: Test that chalk colors are applied in development mode (mock `NODE_ENV`)
  - [x] Subtask 4.8: Test that no ANSI codes appear in production mode

- [x] Task 5: Verify integration with LogManager (AC: #1, #3)
  - [x] Subtask 5.1: Verify that `PinoLogger` is instantiated correctly by `LogManager.getLogger()` from Story 8.1
  - [x] Subtask 5.2: Verify that `LOG_LEVEL` env var is respected end-to-end (env → LogManager → PinoLogger)

## Dev Notes

### Existing Code Context

**`src/config/app-context.ts`** — Defines the `LogManager` interface (not yet implemented) with `info`, `warn`, `error`, `debug` methods. This story creates the concrete `PinoLogger` class that implements the `ILogger` interface (created in Story 8.1). The `LogManager` from Story 8.1 will instantiate `PinoLogger` via `getLogger()`.

**`src/modules/logging/logging.module.ts`** — Currently a bare NestJS module stub. Story 8.1 wires this up with the `LogManager` provider. This story creates the `PinoLogger` that the `LogManager` depends on.

**`package.json`** — `pino` (^10.3.1) and `chalk` (^4.1.2) are already installed as dependencies. Chalk v4.1.2 is intentionally used because chalk v5+ is ESM-only and incompatible with the project's CommonJS/NestJS setup.

**Architecture Section 8 (Logging Architecture)** — Defines the layered design:

- `Modules` → `logManager.getLogger('ModuleName')` → `ILogger` → `LoggerService` → `logProvider` (pino + chalk)
- Log levels: `debug`, `info`, `warn`, `error`, `fatal`
- `fatal` level triggers graceful shutdown (`process.exit(1)`)

### Key Decisions

#### Pino Transport for Development Colorization

Pino's default behavior outputs raw JSON to stdout. For development, we need colorized output. Two approaches:

**Approach A (recommended): `pino.multistream` + chalk Writable**
Pipe pino's output through a custom `Writable` stream that parses JSON and applies chalk colors. This keeps the hot path fast (pino writes to a buffer, transport reformats).

```typescript
const chalkStream = createChalkStream(moduleName);
this.pino = pino(
  {
    name: moduleName,
    level: level || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
  },
  pino.multistream([{ stream: chalkStream }]),
);
```

**Approach B: `pino.transport` with target**
Use `pino.transport({ target: 'pino/file', options: { destination: 1 } })` for the transport, with a custom destination. More pino-native but slightly more complex.

**Decision:** Use Approach A (`pino.multistream`) for simplicity and direct control over output formatting. The chalk transport is a plain `Writable` stream — easy to test, easy to understand.

#### Chalk v4 CommonJS Compatibility

Chalk v5+ is ESM-only. The project uses CommonJS (`"type": "commonjs"` implied by NestJS defaults). Chalk v4.1.2 is the last CJS-compatible version — this is already installed and intentional.

```typescript
import chalk from 'chalk'; // Works with chalk@4 (CJS)
```

#### Pino Level Formatting

Pino uses numeric levels (10=debug, 20=info, 30=warn, 40=error, 50=trace, 60=fatal). The `formatters.level` option in pino config remaps the level field. We use:

```typescript
formatters: {
  level(label: string) {
    return { level: label }; // outputs "level": "info" in JSON
  },
}
```

This gives human-readable level strings in JSON output, which is easier for log aggregators and developers to read than numeric levels.

#### Fatal Behavior

Pino's `fatal()` calls `process.exit(1)` by default. We preserve this behavior — a fatal log means the application cannot continue. If a caller wants to log a fatal message without exiting, they should use `error()` instead.

### Project Structure Notes

- No new directories are created. Files are placed in the existing `src/shared/logging/` directory (to be created by Story 8.1).
- `src/shared/logging/chalk-transport.ts` — Chalk-formatted Writable stream for development output
- `src/shared/logging/pino-logger.ts` — PinoLogger class implementing ILogger
- `src/shared/logging/logger.interface.ts` — Already created by Story 8.1 (ILogger interface)
- `src/shared/logging/log-manager.ts` — Already created by Story 8.1 (LogManager creates PinoLogger instances)
- `src/shared/logging/__tests__/pino-logger.spec.ts` — Unit tests

### References

- Epic 8 Story 8.2 in `_bmad-output/planning-artifacts/epics.md:776`
- Architecture logging section in `_bmad-output/planning-artifacts/architecture.md:401`
- Epic 8 implementation doc in `_bmad-output/implementation-artifacts/implementation-docs/epic-8-logging/README.md:149`
- Story 8.1 (LogManager) — depends on this story for the concrete PinoLogger implementation
- `ILogger` interface: `src/shared/logging/logger.interface.ts` (Story 8.1)
- `LogManager`: `src/shared/logging/log-manager.ts` (Story 8.1) — instantiates PinoLogger
- Environment variables: `LOG_LEVEL` (architecture.md Section 5), `NODE_ENV` (standard NestJS)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

| File                                               | Action   | Description                                                                                   |
| -------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `src/shared/logging/chalk-transport.ts`            | Modified | Writable stream that parses pino JSON and applies chalk colors per log level                  |
| `src/shared/logging/pino-logger.ts`                | Modified | PinoLogger class implementing ILogger — wraps pino with chalk transport in dev                |
| `src/shared/logging/__tests__/pino-logger.spec.ts` | Created  | Unit tests for PinoLogger — level filtering, structured context, chalk colors, fatal behavior |
| `src/shared/logging/__tests__/log-manager.spec.ts` | Modified | Updated LogManager tests to work with pino-based logger (JSON output instead of console)      |
