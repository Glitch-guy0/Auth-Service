# Epic 8: Logging & Observability — Implementation Documentation

**Goal:** Implement structured logging and demographics tracking. System is observable.

**Depends on:** Epic 3 (registration flow works for demographics), Epic 1 (AppContext, module structure, exception hierarchy)

**Deliverable:** Structured logging pipeline — LogManager with module-level loggers, pino + chalk console output, request logging interceptor with sensitive data redaction, and MongoDB demographics collection on login/registration.

---

## Story 8.1: Logging Module

### Overview

NestJS module (`LoggingModule`) that provides a centralized `LogManager` for creating module-level loggers. Follows the AD-4 Module Lifecycle Pattern (`setup → run → shutdown`). The `LogManager` is registered in `AppContext` so any module can request a scoped logger via `logManager.getLogger('ModuleName')`. Each logger implements the `ILogger` interface with `debug`, `info`, `warn`, `error`, and `fatal` methods. The `LoggingModule` is imported early in `AppModule` so all other modules can access the logger during their own `setup()` phase.

### Architecture References

| AD | Title | Relevance |
|----|-------|-----------|
| AD-4 | Module Lifecycle Pattern | LoggingModule implements `setup() → run() → shutdown()`. `setup()` initializes the LogManager and configures log levels. `run()` marks the logger as ready. `shutdown()` flushes any buffered log entries before the process exits. |
| AD-1 | Hexagonal Module Boundary | LoggingModule is a cross-cutting concern, not an adapter. It provides an outbound port (ILogger) that other modules consume. It depends on no other module's internals — only on environment configuration for log levels. |

### Acceptance Criteria

- [ ] `LoggingModule` is a valid NestJS module registered in `AppModule` imports (early in the import list so other modules can depend on it).
- [ ] `LogManager` is a singleton service provided by `LoggingModule`.
- [ ] `LogManager` is exposed via `AppContext.logManager` — modules access it through the global AppContext singleton (Story 1.4).
- [ ] `logManager.getLogger('ModuleName')` returns an `ILogger` instance scoped to the given module name.
- [ ] `ILogger` interface exposes: `debug(message, ...args)`, `info(message, ...args)`, `warn(message, ...args)`, `error(message, ...args)`, `fatal(message, ...args)`.
- [ ] Each logger includes the module name in its output (e.g., `[Auth]`, `[User]`, `[Token]`).
- [ ] `LogManager` respects the `LOG_LEVEL` environment variable (default: `info`).
- [ ] `LoggingModule` implements AD-4 lifecycle: `setup()` configures LogManager, `run()` is a no-op (logs are synchronous), `shutdown()` flushes buffered output.
- [ ] `ILogger` is a typed interface exported from `src/shared/logging/` for cross-module use.

### Test Acceptance Criteria

- [ ] **Given** `LoggingModule` is imported into `AppModule`, **when** the application boots, **then** `AppContext.logManager` is defined and is a `LogManager` instance.
- [ ] **Given** `logManager.getLogger('Test')` is called, **when** the logger is returned, **then** it implements `ILogger` (has `debug`, `info`, `warn`, `error`, `fatal` methods).
- [ ] **Given** `logger.info('hello')` is called, **when** the output is captured, **then** the output contains the module name `Test` and the message `hello`.
- [ ] **Given** `LOG_LEVEL=warn`, **when** `logger.info('message')` is called, **then** no output is produced (below configured level).
- [ ] **Given** `LOG_LEVEL=debug`, **when** `logger.debug('detail')` is called, **then** the debug message is output.
- [ ] **Given** the application shuts down, **when** `shutdown()` is called on LogManager, **then** any buffered log entries are flushed (no lost logs).

### Implementation Guidance

Create `src/shared/logging/logger.interface.ts`:

```typescript
export interface ILogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  fatal(message: string, ...args: unknown[]): void;
}
```

Create `src/shared/logging/log-manager.ts`:

```typescript
import { ILogger } from './logger.interface';
import { PinoLogger } from './pino-logger'; // implemented in Story 8.2

export class LogManager {
  private loggers = new Map<string, ILogger>();
  private level: string;

  constructor(level: string = 'info') {
    this.level = level;
  }

  getLogger(moduleName: string): ILogger {
    if (!this.loggers.has(moduleName)) {
      this.loggers.set(moduleName, new PinoLogger(moduleName, this.level));
    }
    return this.loggers.get(moduleName)!;
  }

  shutdown(): void {
    // Flush any buffered entries — pino writes synchronously to stdout
    // but this hook exists for future async transports
  }
}
```

Create `src/modules/logging/logging.module.ts`:

```typescript
import { Module, Global } from '@nestjs/common';
import { LogManager } from '@shared/logging/log-manager';

const logLevel = process.env.LOG_LEVEL || 'info';

@Global()
@Module({
  providers: [
    {
      provide: LogManager,
      useFactory: () => new LogManager(logLevel),
    },
  ],
  exports: [LogManager],
})
export class LoggingModule {}
```

Register early in `src/app.module.ts`:

```typescript
@Module({
  imports: [
    LoggingModule,   // ← first — other modules depend on LogManager
    ConfigModule.forRoot({ isGlobal: true }),
    // ... other modules
  ],
})
export class AppModule {}
```

Wire into `AppContext` (Story 1.4) during bootstrap in `src/main.ts`:

```typescript
import { LogManager } from '@shared/logging/log-manager';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logManager = app.get(LogManager);
  setAppContext({ logManager, config: validatedConfig });
  // ...
}
```

**Key considerations:**

- **Global module.** `@Global()` ensures `LogManager` is available to every module without re-importing `LoggingModule`. This follows NestJS convention for cross-cutting concerns.
- **Import order.** `LoggingModule` must be listed first in `AppModule` imports so that `LogManager` is instantiated before any module that calls `appContext.logManager.getLogger()` in its own `setup()`.
- **Singleton per module name.** `getLogger('Auth')` always returns the same `ILogger` instance. Multiple calls are cheap (Map lookup).
- **Environment-driven level.** `LOG_LEVEL` defaults to `info`. Valid values: `debug`, `info`, `warn`, `error`, `fatal`. Invalid values should fall back to `info` with a warning.

### Dependencies

- Story 1.4 (AppContext singleton — `setAppContext()` / `getAppContext()` for LogManager registration)
- Story 1.5 (AppModule structure — LoggingModule import in AppModule)
- Story 8.2 (PinoLogger — the concrete ILogger implementation, consumed by LogManager)

---

## Story 8.2: Pino Logger Provider

### Overview

Concrete `ILogger` implementation using `pino` for high-performance structured JSON logging, with `chalk` for colorful human-readable console output in development. In production (`NODE_ENV=production`), logs are emitted as raw JSON (machine-parseable, suitable for log aggregators). In development, `pino-transport` or a custom chalk-based transport reformats each log line with color-coded level tags, timestamps, and module names. Log levels are configurable via the `LOG_LEVEL` environment variable.

### Architecture References

| AD | Title | Relevance |
|----|-------|-----------|
| AD-4 | Module Lifecycle Pattern | PinoLogger is instantiated by LogManager during `setup()`. It is not a NestJS injectable — it is a plain class created by the LogManager factory. This avoids circular dependencies between the logging module and the DI container. |

### Acceptance Criteria

- [ ] Uses `pino` as the underlying logging library (structured JSON output).
- [ ] Uses `chalk` to colorize console output in development mode.
- [ ] Log levels configurable via `LOG_LEVEL` environment variable (default: `info`).
- [ ] In production (`NODE_ENV=production`), logs are emitted as JSON to stdout.
- [ ] In development (`NODE_ENV=development`), logs are colorized with chalk: `debug` = gray, `info` = green, `warn` = yellow, `error` = red, `fatal` = magenta.
- [ ] Each log entry includes: `level`, `time` (ISO 8601), `msg` (message), `module` (logger name).
- [ ] Additional context passed as structured data is included in the JSON output (e.g., `logger.info({ userId: '123' }, 'User logged in')`).
- [ ] `fatal` level calls `process.exit(1)` after logging (standard pino behavior).
- [ ] Pino instance is configured with `timestamp: pino.stdTimeFunctions.isoTime` for ISO 8601 timestamps.

### Test Acceptance Criteria

- [ ] **Given** a PinoLogger instance with level `info`, **when** `logger.debug('detail')` is called, **then** no output is produced (below threshold).
- [ ] **Given** a PinoLogger instance with level `debug`, **when** `logger.debug('detail')` is called, **then** a JSON log entry with `level: 20` and `msg: 'detail'` is written to stdout.
- [ ] **Given** a PinoLogger with module name `Auth`, **when** `logger.info('success')` is called, **then** the JSON output includes `"module": "Auth"` and `"msg": "success"`.
- [ ] **Given** `NODE_ENV=development`, **when** `logger.warn('check')` is called, **then** the console output contains a yellow-colored `[WARN]` prefix.
- [ ] **Given** `NODE_ENV=production`, **when** `logger.error('fail')` is called, **then** the output is raw JSON (no ANSI color codes).
- [ ] **Given** structured context `{ userId: 'abc' }`, **when** `logger.info({ userId: 'abc' }, 'User created')`, **then** the JSON output includes `"userId": "abc"`.

### Implementation Guidance

Create `src/shared/logging/pino-logger.ts`:

```typescript
import pino from 'pino';
import chalk from 'chalk';
import { ILogger } from './logger.interface';

const LEVEL_MAP: Record<string, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 60,
};

const CHALK_COLORS: Record<number, (s: string) => string> = {
  10: chalk.gray,
  20: chalk.green,
  30: chalk.yellow,
  40: chalk.red,
  60: chalk.magenta,
};

export class PinoLogger implements ILogger {
  private pino: pino.Logger;

  constructor(moduleName: string, level: string = 'info') {
    const isDev = process.env.NODE_ENV !== 'production';

    this.pino = pino({
      name: moduleName,
      level: level || 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level(label: string) {
          return { level: label };
        },
      },
      // In production: JSON to stdout (default pino behavior)
      // In development: use pino-transport or write to stdout and reformat
    });

    // Development: wrap the transport with chalk colorization
    if (isDev) {
      this.pino = this.pino.child({ module: moduleName });
      // Chalk formatting is applied in the transport or via pino.destination
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.pino.debug(...args, message);
  }

  info(message: string, ...args: unknown[]): void {
    this.pino.info(...args, message);
  }

  warn(message: string, ...args: unknown[]): void {
    this.pino.warn(...args, message);
  }

  error(message: string, ...args: unknown[]): void {
    this.pino.error(...args, message);
  }

  fatal(message: string, ...args: unknown[]): void {
    this.pino.fatal(...args, message);
    process.exit(1);
  }
}
```

For development colorization, use `pino-transport` or a custom `pino.multistream` with chalk formatting:

```typescript
// Alternative: Use pino.transport() for dev colorization
if (isDev) {
  this.pino = pino({
    name: moduleName,
    level: level || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
    },
  }, pino.multistream([
    { level: 'debug', stream: createChalkStream(moduleName) },
  ]));
}
```

Or a simpler approach — write a chalk formatting function applied in the transport:

```typescript
// src/shared/logging/chalk-transport.ts
import chalk from 'chalk';
import { Writable } from 'stream';

const LEVEL_LABELS: Record<number, string> = {
  10: 'DEBUG',
  20: 'INFO ',
  30: 'WARN ',
  40: 'ERROR',
  60: 'FATAL',
};

export function createChalkStream(moduleName: string): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      try {
        const entry = JSON.parse(chunk.toString());
        const level = entry.level || 20;
        const color = CHALK_COLORS[level] || chalk.white;
        const label = LEVEL_LABELS[level] || '?????';
        const time = entry.time || new Date().toISOString();
        const msg = entry.msg || '';
        const module = entry.module || moduleName;

        const line = `${chalk.gray(time)} ${color(`[${label}]`)} ${chalk.cyan(`[${module}]`)} ${msg}`;
        process.stdout.write(line + '\n');
      } catch {
        process.stdout.write(chunk);
      }
      callback();
    },
  });
}
```

**Key considerations:**

- **Pino is fast.** Pino is one of the fastest Node.js loggers — it defers formatting to the transport (or to the log aggregator), keeping the hot path lean. Never use `console.log` in production code.
- **JSON in production.** Structured JSON logs are machine-parseable by aggregators (Datadog, ELK, CloudWatch). The `module` field enables filtering by component.
- **Chalk in development.** Developers scan logs visually — colorized levels and timestamps reduce cognitive load. Chalk is only used in the development transport, never in the JSON output path.
- **`fatal` exits.** Pino's `fatal()` calls `process.exit(1)` by default. This is correct for fatal errors — the application cannot continue. If the process should not exit, use `error()` instead.
- **Structured context.** Pino supports structured context as the first argument: `logger.info({ userId, action }, 'User created')`. The extra fields appear in the JSON output. This is the preferred pattern over string interpolation.
- **Add dependencies.** Run `npm install pino chalk` (and `@types/chalk` if needed — chalk v5 is ESM-only; check compatibility with the project's module system. If using chalk v4, it supports CommonJS: `npm install chalk@4`).

### Dependencies

- Story 8.1 (LogManager — creates PinoLogger instances via `getLogger()`)
- Story 1.3 (Environment config — `NODE_ENV` and `LOG_LEVEL` env vars)
- `pino` package — add to `package.json` (already listed in Story 1.1 AC)
- `chalk` package — add to `package.json` (listed in ARCHITECTURE-SPINE.md consistency conventions)

---

## Story 8.3: Request Logging Interceptor

### Overview

NestJS interceptor (`LoggingInterceptor`) that wraps every HTTP request/response cycle, logging the method, path, status code, and duration. Each request is assigned a unique `requestId` (UUID or correlation ID) that propagates through all log entries for that request, enabling end-to-end tracing. Sensitive data — passwords, tokens, authorization headers — is automatically redacted from log output. The interceptor is registered globally so all routes are logged without per-controller boilerplate.

### Architecture References

| AD | Title | Relevance |
|----|-------|-----------|
| AD-4 | Module Lifecycle Pattern | The interceptor is instantiated once (global scope) and reused for every request. It obtains a logger from `LogManager.getLogger('HTTP')` during construction. |
| AD-1 | Hexagonal Module Boundary | The interceptor is an inbound cross-cutting concern. It does not depend on any specific module — it logs request metadata (method, path, status) without accessing business logic or domain objects. |

### Acceptance Criteria

- [ ] Interceptor implements `NestInterceptor` and wraps the request handling via `handle.switchToHttp()`.
- [ ] Logs the following for every HTTP request: `method` (GET, POST, etc.), `path` (request URL), `status` (HTTP status code), `duration` (milliseconds from request start to response end).
- [ ] Each request is assigned a `requestId` (UUID v4 or v7) attached to `req.requestId`.
- [ ] The `requestId` is included in every log entry produced during that request's lifecycle.
- [ ] Sensitive fields are redacted: `password`, `token`, `authorization` headers are replaced with `[REDACTED]` in log output.
- [ ] Request body is logged at `debug` level (not `info`) to avoid cluttering production logs.
- [ ] Response body is NOT logged (could contain tokens, PII).
- [ ] Errors during request handling are logged at `error` level with the exception message and stack trace (at `debug` level for stack).
- [ ] Registered globally via `APP_INTERCEPTOR` in `AppModule`.
- [ ] Uses `LogManager` from AppContext (or injected via DI) to obtain the HTTP logger.

### Test Acceptance Criteria

- [ ] **Given** a POST request with `{ "username": "alice", "password": "secret123" }`, **when** the interceptor logs the request, **then** the `password` field is replaced with `[REDACTED]` in the log output.
- [ ] **Given** an HTTP request to `POST /auth/v1/register`, **when** the request completes with status 201, **when** the log entry is examined, **then** it contains `method: POST`, `path: /auth/v1/register`, `status: 201`, and a `duration` value in milliseconds.
- [ ] **Given** two concurrent requests, **when** their log entries are examined, **then** each has a unique `requestId`.
- [ ] **Given** a request that throws an exception, **when** the interceptor logs the error, **then** the log entry contains the exception message and is at `error` level.
- [ ] **Given** a request with `Authorization: Bearer abc123`, **when** the interceptor logs the request headers, **then** the authorization header value is `[REDACTED]`.
- [ ] **Given** a request completes in 45ms, **when** the log entry is examined, **then** `duration` is approximately 45 (within a small tolerance).

### Implementation Guidance

Create `src/shared/interceptors/logging.interceptor.ts`:

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { LogManager } from '@shared/logging/log-manager';
import { ILogger } from '@shared/logging/logger.interface';
import { v4 as uuidv4 } from 'uuid';

const SENSITIVE_FIELDS = new Set(['password', 'token', 'authorization', 'authorizationheader']);

function redactBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const redacted = { ...(body as Record<string, unknown>) };
  for (const key of Object.keys(redacted)) {
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    }
  }
  return redacted;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private logger: ILogger;

  constructor(private readonly logManager: LogManager) {
    this.logger = logManager.getLogger('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const requestId = uuidv4();
    req.requestId = requestId;

    const { method, url } = req;
    const startTime = Date.now();

    // Log request body at debug level (redacted)
    this.logger.debug({
      requestId,
      method,
      path: url,
      body: redactBody(req.body),
    }, 'Incoming request');

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const status = res.statusCode;

        this.logger.info({
          requestId,
          method,
          path: url,
          status,
          duration,
        }, `${method} ${url} ${status} ${duration}ms`);
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const status = res.statusCode || 500;

        this.logger.error({
          requestId,
          method,
          path: url,
          status,
          duration,
          error: error.message,
        }, `${method} ${url} ${status} ${duration}ms - ${error.message}`);

        throw error; // re-throw for the exception filter
      }),
    );
  }
}
```

Register globally in `src/app.module.ts`:

```typescript
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
import { LogManager } from '@shared/logging/log-manager';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useFactory: (logManager: LogManager) => new LoggingInterceptor(logManager),
      inject: [LogManager],
    },
  ],
})
export class AppModule {}
```

Augment the `Request` type for `requestId` (add to `src/shared/types/request.types.ts` or alongside the `AuthenticatedRequest` from Story 7.1):

```typescript
declare module 'express' {
  interface Request {
    requestId?: string;
  }
}
```

**Key considerations:**

- **Request ID as correlation key.** The `requestId` propagates through all log entries for a request. Downstream services (if added later) can forward this ID in headers for distributed tracing.
- **Redaction is field-based.** The `SENSITIVE_FIELDS` set matches field names case-insensitively. This covers `{ "password": "..." }` in request bodies and `Authorization` headers. Token values in headers are also redacted.
- **Debug-level body logging.** Request bodies are logged at `debug` level — they are verbose and often contain PII. In production with `LOG_LEVEL=info`, bodies are not logged. In development, they appear for debugging.
- **Duration measurement.** `Date.now()` before and after `handle()` gives wall-clock duration. For sub-millisecond precision, use `process.hrtime()` — but millisecond granularity is sufficient for HTTP logging.
- **Error logging.** The `catchError` operator logs the error at `error` level before re-throwing it to the global exception filter (Story 7.3). The filter handles the HTTP response; the interceptor handles the log entry.
- **uuid dependency.** Add `npm install uuid @types/uuid` if not already present. Alternatively, use `crypto.randomUUID()` (Node.js 19+ built-in, no dependency needed).

### Dependencies

- Story 8.1 (LogManager — provides the HTTP-scoped logger)
- Story 8.2 (PinoLogger — concrete ILogger used by LogManager)
- Story 7.3 (Global exception filter — the interceptor logs errors, the filter formats the response; they do not conflict)
- Story 1.4 (AppContext — for accessing LogManager during interceptor factory creation)

---

## Story 8.4: Demographics Collection

### Overview

MongoDB-based demographics collection that records user activity on login and registration events. The `UserService.logDemographics()` method delegates to `DemographicsRepository`, which inserts a document into the `user_demographics` collection. Each document captures: `user_id`, `last_ip` (client IP address), `location` (country and city — derived from IP via a geo-lookup or defaulting to unknown), and `created_at` timestamp. MongoDB connection failures are handled gracefully — a failed insert logs a warning but does not fail the login/registration flow. This follows AD-10 (AuthService never accesses MongoDB directly) and AD-3 (MongoDB stores logging data, not core auth data).

### Architecture References

| AD | Title | Relevance |
|----|-------|-----------|
| AD-3 | Hybrid Database Architecture | MongoDB stores demographics logging data. PostgreSQL stores core auth data. The demographics collection is write-only from the auth flow's perspective — it does not affect authentication decisions. |
| AD-10 | Demographics Logging via UserService | AuthService calls `UserService.logDemographics(userId, data)`. UserService delegates to DemographicsRepository. AuthService never imports or injects DemographicsRepository directly. This decouples auth logic from the logging database. |
| AD-4 | Module Lifecycle Pattern | The UserModule's `setup()` establishes the MongoDB connection (or verifies it). `logDemographics()` is called during normal operation. If MongoDB is unavailable, the failure is logged and the auth flow continues. |

### Acceptance Criteria

- [ ] On successful login, `UserService.logDemographics()` is called with the user's ID, IP address, and location data.
- [ ] On successful registration, `UserService.logDemographics()` is called with the new user's ID, IP address, and location data.
- [ ] A document is inserted into the `user_demographics` MongoDB collection with fields: `user_id` (UUID string), `last_ip` (string), `location` (object: `{ country: string, city: string }`), `created_at` (Date).
- [ ] `DemographicsRepository` is the sole writer to the `user_demographics` collection (AD-16 pattern for MongoDB).
- [ ] If the MongoDB connection fails or the insert throws, the error is logged at `warn` level and the login/registration flow continues successfully (graceful degradation).
- [ ] The demographics call is fire-and-forget — it does not block or await in the critical auth path (or is called after the token response is prepared).
- [ ] `UserService.logDemographics()` is defined in `IUserService` (Story 1.12) and implemented in `UserService`.
- [ ] The client IP is extracted from the request (via `req.ip` or `req.headers['x-forwarded-for']`).
- [ ] Location data (country, city) is derived from the IP address. If no geo-lookup service is available, default to `{ country: 'unknown', city: 'unknown' }`.

### Test Acceptance Criteria

- [ ] **Given** a successful login, **when** `logDemographics()` is called, **then** a document exists in `user_demographics` with the correct `user_id`, `last_ip`, and `location` fields.
- [ ] **Given** a successful registration, **when** `logDemographics()` is called, **then** a document is inserted into `user_demographics`.
- [ ] **Given** MongoDB is unavailable (connection refused), **when** `logDemographics()` is called, **then** the login/registration still succeeds and a warning is logged.
- [ ] **Given** `logDemographics()` is called with user_id `abc-123`, IP `192.168.1.1`, **when** the document is examined, **then** `user_id` is `abc-123` and `last_ip` is `192.168.1.1`.
- [ ] **Given** a login event, **when** `logDemographics()` is called, **then** the `created_at` field is a valid Date close to the current time.
- [ ] **Given** two login events for the same user, **when** both documents are examined, **then** each has a unique `created_at` and potentially different `last_ip` values.

### Implementation Guidance

Create `src/modules/user/demographics.repository.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectMongoRepository } from '@nestjs/mongoose'; // or use native MongoDB driver
import { Collection, Db } from 'mongodb';
import { Demographics } from './demographics.interface';

@Injectable()
export class DemographicsRepository {
  private readonly logger = new Logger('DemographicsRepository');
  private collection: Collection<Demographics>;

  constructor(private readonly db: Db) {
    this.collection = this.db.collection<Demographics>('user_demographics');
  }

  async insert(data: Demographics): Promise<void> {
    try {
      await this.collection.insertOne({
        ...data,
        created_at: new Date(),
      });
    } catch (error) {
      // Graceful degradation — log warning, do not throw
      this.logger.warn(
        `Failed to insert demographics for user ${data.user_id}: ${error.message}`,
      );
    }
  }
}
```

Update `src/modules/user/user.service.ts` — add `logDemographics()`:

```typescript
export class UserService implements IUserService {
  // ... existing methods

  async logDemographics(
    userId: string,
    data: { ip: string; location: { country: string; city: string } },
  ): Promise<void> {
    // Fire-and-forget: do not await in the critical path
    this.demographicsRepository.insert({
      user_id: userId,
      last_ip: data.ip,
      location: data.location,
      created_at: new Date(),
    }).catch((error) => {
      this.logger.warn(`Demographics insert failed for ${userId}: ${error.message}`);
    });
  }
}
```

Wire the demographics call into the auth flow. In `src/modules/auth/auth.service.ts`, after successful login:

```typescript
async login(dto: LoginDto): Promise<TokenResponseDto> {
  // ... existing login logic (verify credentials, generate tokens)

  // Demographics — fire-and-forget after response preparation
  this.userService.logDemographics(user.id, {
    ip: requestIp,       // passed from controller
    location: geoLookup(requestIp), // or default { country: 'unknown', city: 'unknown' }
  }).catch(() => {}); // already handled in UserService

  return { accessToken, refreshToken };
}
```

For IP extraction, add to the auth controller or pass via request:

```typescript
// In AuthController
const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
```

For geo-lookup, use a lightweight approach:

```typescript
// src/shared/utils/geo-lookup.ts
export function geoLookup(ip: string): { country: string; city: string } {
  // Phase 1: return unknown — no external dependency
  // Phase 2: integrate with MaxMind GeoLite2 or ip-api.com
  return { country: 'unknown', city: 'unknown' };
}
```

**MongoDB connection setup** — add to `UserModule` or a shared `DatabaseModule`:

```typescript
// src/modules/user/user.module.ts
import { Module } from '@nestjs/common';
import { MongoClient, Db } from 'mongodb';

const mongoProvider = {
  provide: Db,
  useFactory: async (): Promise<Db> => {
    const client = new MongoClient(process.env.MONGODB_URL!);
    await client.connect();
    return client.db(); // default database from MONGODB_URL
  },
};

@Module({
  providers: [UserService, DemographicsRepository, mongoProvider],
  exports: [UserService],
})
export class UserModule {}
```

**Key considerations:**

- **Fire-and-forget pattern.** `logDemographics()` is called after the token response is prepared. It does not block the auth flow. If MongoDB is slow or down, the user still gets their tokens. The `.catch(() => {})` ensures unhandled promise rejections do not crash the process.
- **Graceful degradation.** The `DemographicsRepository.insert()` method catches its own errors and logs a warning. The `UserService.logDemographics()` also catches errors. Two layers of error handling ensure MongoDB failures never propagate to the auth flow.
- **No geo-lookup in Phase 1.** The architecture does not specify a geo-IP provider. Default to `{ country: 'unknown', city: 'unknown' }`. A future enhancement can integrate MaxMind GeoLite2 or an HTTP-based geo API.
- **MongoDB connection.** The `Db` provider is a shared singleton. If `MONGODB_URL` is not configured or the connection fails at startup, the application should log a warning but still boot (demographics is non-critical per NFR-3). Use a try/catch in the factory:
  ```typescript
  useFactory: async (): Promise<Db | null> => {
    try {
      const client = new MongoClient(process.env.MONGODB_URL!);
      await client.connect();
      return client.db();
    } catch (error) {
      console.warn('MongoDB unavailable — demographics logging disabled');
      return null;
    }
  }
  ```
  Then in `DemographicsRepository`, check if `db` is null before attempting inserts.
- **AD-10 compliance.** AuthService never imports DemographicsRepository. It calls `UserService.logDemographics()`, and UserService delegates. The dependency chain is: `AuthService → UserService → DemographicsRepository → MongoDB`.
- **Collection name.** `user_demographics` per the Demographics interface in Story 1.9.

### Dependencies

- Story 1.9 (Demographics interface — `Demographics`, `DemographicsLocation` types)
- Story 1.12 (IUserService — `logDemographics` method signature)
- Story 1.3 (Environment config — `MONGODB_URL` env var)
- Story 3.1 (Registration flow — where demographics logging is triggered on register)
- Story 4.2 (Login flow — where demographics logging is triggered on login)
- `mongodb` package — add to `package.json` if not present (`npm install mongodb`)
- AD-10 (AuthService → UserService → DemographicsRepository delegation chain)

---

## Summary

| Story | Key Deliverable | File Location |
|-------|----------------|---------------|
| 8.1 | LoggingModule + LogManager — centralized logger factory | `src/modules/logging/logging.module.ts`, `src/shared/logging/log-manager.ts`, `src/shared/logging/logger.interface.ts` |
| 8.2 | PinoLogger — pino + chalk structured logging | `src/shared/logging/pino-logger.ts`, `src/shared/logging/chalk-transport.ts` |
| 8.3 | LoggingInterceptor — HTTP request/response logging with redaction | `src/shared/interceptors/logging.interceptor.ts` |
| 8.4 | DemographicsCollection — MongoDB user demographics on login/register | `src/modules/user/demographics.repository.ts`, `src/modules/user/user.service.ts` (update) |

**Note:** This epic completes the observability layer. All modules now have structured, level-aware logging. HTTP requests are traced with correlation IDs. Sensitive data is automatically redacted. User demographics flow to MongoDB without blocking auth operations. The logging infrastructure is the foundation for future OpenTelemetry/metrics integration (deferred per architecture).

**Implementation order:** Story 8.1 → Story 8.2 → Story 8.3 → Story 8.4. Stories 8.1 and 8.2 are tightly coupled (LogManager needs PinoLogger) and should be implemented together. Story 8.3 depends on both. Story 8.4 is independent of 8.3 but depends on 8.1/8.2 for the logger used in graceful degradation messages.
