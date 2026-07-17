# Story 8.3: Request Logging Interceptor

Status: done

## Story

As a developer,
I want an interceptor that logs all HTTP requests,
so that request/response details are tracked.

## Acceptance Criteria

1. **Given** an HTTP request
   **When** `LoggingInterceptor` processes it
   **Then** it logs `method`, `path`, `status` (HTTP status code), and `duration` (milliseconds)

2. **Given** any HTTP request
   **When** the interceptor processes it
   **Then** a unique `requestId` (UUID) is assigned to `req.requestId`
   **And** the `requestId` is included in every log entry for that request

3. **Given** a request body containing sensitive fields (`password`, `token`, `accessToken`, `refreshToken`)
   **When** the interceptor logs the request
   **Then** sensitive field values are replaced with `[REDACTED]`

4. **Given** a request with an `Authorization` header
   **When** the interceptor logs the request headers
   **Then** the `Authorization` header value is replaced with `[REDACTED]`

5. **Given** a request that completes successfully
   **When** the log entry is examined
   **Then** the log level is `info` and includes method, path, status, and duration

6. **Given** a request that throws an exception
   **When** the interceptor logs the error
   **Then** the log entry is at `error` level with the exception message
   **And** the request is re-thrown for the global exception filter (Story 7.3)

7. **Given** the request body
   **When** the interceptor logs it
   **Then** body logging is at `debug` level (not `info`) to avoid cluttering production logs

8. **Given** the response body
   **When** the interceptor processes the response
   **Then** the response body is NOT logged (could contain tokens or PII)

9. **Given** the interceptor is implemented
   **When** it is registered
   **Then** it is registered globally via `APP_INTERCEPTOR` in `AppModule`

10. **Given** the interceptor needs a logger
    **When** it obtains one
    **Then** it uses `LogManager` from DI (injected via `APP_INTERCEPTOR` factory) to create an HTTP-scoped logger

## Tasks / Subtasks

- [x] Task 1: Create `LoggingInterceptor` class with request/response logging (AC: 1, 2, 5, 7, 8)
  - [x] Create file `src/shared/interceptors/logging.interceptor.ts`
  - [x] Implement `LoggingInterceptor` with `@Injectable()` decorator implementing `NestInterceptor`
  - [x] In `intercept()`: extract `Request` and `Response` from `ExecutionContext.switchToHttp()`
  - [x] Generate `requestId` using `uuid.v4()` and assign to `req.requestId`
  - [x] Record `startTime = Date.now()` before calling `next.handle()`
  - [x] Extract `method` and `url` from the request
  - [x] In `tap()` operator: compute `duration = Date.now() - startTime`, read `res.statusCode`, log at `info` level with structured context `{ requestId, method, path, status, duration }`
  - [x] In `catchError()` operator: compute `duration`, read status (default 500), log at `error` level with `{ requestId, method, path, status, duration, error: error.message }`, then re-throw the error

- [x] Task 2: Implement sensitive data redaction (AC: 3, 4)
  - [x] Define `SENSITIVE_FIELDS` set: `password`, `token`, `authorization`, `authorizationheader`, `accesstoken`, `refreshtoken`
  - [x] Create `redactBody(body: unknown): unknown` helper function that deep-clones the body and replaces sensitive field values with `[REDACTED]`
  - [x] Apply `redactBody()` to `req.body` before logging at `debug` level
  - [x] Redact `Authorization` header value when logging headers (replace with `[REDACTED]`)

- [x] Task 3: Register interceptor globally in `AppModule` (AC: 9, 10)
  - [x] Import `APP_INTERCEPTOR` from `@nestjs/core`
  - [x] Import `LoggingInterceptor` from `@shared/interceptors/logging.interceptor`
  - [x] Import `LogManager` from `@shared/logging/log-manager`
  - [x] Add `APP_INTERCEPTOR` provider to `AppModule` with factory that injects `LogManager`
  - [x] Factory: `useFactory: (logManager: LogManager) => new LoggingInterceptor(logManager), inject: [LogManager]`

- [x] Task 4: Augment Express `Request` type for `requestId`
  - [x] Create `src/shared/types/request.types.ts` with ambient module declaration
  - [x] Add `requestId?: string` to Express `Request` interface via declaration merging

- [x] Task 5: Write unit tests for `LoggingInterceptor` (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [x] Create test file `src/shared/interceptors/__tests__/logging.interceptor.spec.ts`
  - [x] Mock `LogManager` and `ILogger` to capture log calls
  - [x] Mock `ExecutionContext` with switchToHttp returning mock Request/Response
  - [x] Mock `CallHandler` with `handle()` returning `of({})` for success case
  - [x] Test: POST request with `{ "username": "alice", "password": "secret123" }` → password is `[REDACTED]` in debug log
  - [x] Test: request to `POST /auth/v1/register` completing with status 201 → log contains `method: POST`, `path: /auth/v1/register`, `status: 201`, `duration` (number)
  - [x] Test: two concurrent requests → each has a unique `requestId`
  - [x] Test: request that throws → error is logged at `error` level with exception message, error is re-thrown
  - [x] Test: request with `Authorization: Bearer abc123` → auth header is `[REDACTED]` in log
  - [x] Test: request completes in ~45ms → `duration` is a positive number
  - [x] Test: response body is NOT logged (only request body at debug level)
  - [x] Test: `requestId` is assigned to `req.requestId`

## Dev Notes

### Project Structure Notes

**Current file layout (relevant):**

```
src/
├── app.module.ts                          # Root module — interceptor registered here
├── main.ts                                # Bootstrap — sets AppContext, global pipes/filters
├── config/
│   └── app-context.ts                     # LogManager interface, getAppContext()
├── shared/
│   ├── exceptions/
│   │   └── all-exceptions.filter.ts       # Global exception filter (Story 7.3)
│   └── logging/
│       ├── logger.interface.ts            # ILogger interface (Story 8.1)
│       └── log-manager.ts                 # LogManager class (Story 8.1)
├── modules/
│   ├── auth/
│   │   ├── auth.middleware.ts             # AuthMiddleware + AuthenticatedRequest
│   │   ├── auth.controller.ts             # Auth endpoints
│   │   ├── auth.service.ts               # Auth business logic
│   │   └── guards/
│   │       └── jwt-auth.guard.ts          # JWT guard (Story 7.2)
│   └── logging/
│       └── logging.module.ts             # LoggingModule (currently empty shell)
```

**New files to create:**

- `src/shared/interceptors/logging.interceptor.ts` — the interceptor
- `src/shared/interceptors/__tests__/logging.interceptor.spec.ts` — unit tests
- `src/shared/types/request.types.ts` — Express Request augmentation

**Files to update:**

- `src/app.module.ts` — add `APP_INTERCEPTOR` provider

### Existing Code Context

**AppModule** (`src/app.module.ts`):

- Currently imports: `ConfigModule`, `AuthModule`, `UserModule`, `TokenModule`, `LoggingModule`, `KeyModule`, `RedisModule`
- Implements `NestModule` with `configure()` for `AuthMiddleware` on all routes
- The interceptor provider will be added to the `providers` array alongside the module imports

**AppContext** (`src/config/app-context.ts`):

- `LogManager` interface has `info`, `warn`, `error`, `debug` methods (no `fatal`)
- `getAppContext()` returns `{ logManager, config }`
- The interceptor uses DI injection rather than `getAppContext()` for testability

**Main Bootstrap** (`src/main.ts`):

- Already registers `AllExceptionsFilter` globally via `app.useGlobalFilters()`
- Already registers `ValidationPipe` globally via `app.useGlobalPipes()`
- The interceptor runs between middleware and controller — this is the correct NestJS execution order

**AllExceptionsFilter** (`src/shared/exceptions/all-exceptions.filter.ts`):

- Catches all exceptions and returns `{ success: false, error: { code, message, timestamp, path } }`
- The interceptor logs errors, then re-throws — the filter handles the HTTP response
- These two concerns (logging vs response formatting) are cleanly separated

**AuthMiddleware** (`src/modules/auth/auth.middleware.ts`):

- Defines `AuthenticatedRequest` with `accessToken?: string`
- Runs before the interceptor on all routes (middleware executes before interceptors in NestJS)

**AuthController** (`src/modules/auth/auth.controller.ts`):

- Uses `new Logger(AuthController.name)` for per-controller logging
- Endpoints: `POST /auth/v1/register`, `POST /auth/v1/authenticate`, `POST /auth/v1/refresh`, `POST /auth/v1/logout`
- Request bodies contain sensitive fields: `password` (register/login), `refreshToken` (refresh)

**Available Dependencies** (from `package.json`):

- `uuid` v14 — already installed, use `uuid.v4()` for request IDs
- `pino` v10 — already installed (Story 8.2 dependency)
- `chalk` v4 — already installed
- `rxjs` v7 — already installed (provides `Observable`, `of`, `tap`, `catchError`)

### Architecture References

| AD   | Title                     | Relevance                                                                                                                                                                                            |
| ---- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AD-4 | Module Lifecycle Pattern  | The interceptor is instantiated once (global scope) via `APP_INTERCEPTOR` and reused for every request. It obtains a logger from `LogManager.getLogger('HTTP')` during construction.                 |
| AD-1 | Hexagonal Module Boundary | The interceptor is an inbound cross-cutting concern. It does not depend on any specific module — it logs request metadata (method, path, status) without accessing business logic or domain objects. |

### Key Design Decisions

1. **DI injection over `getAppContext()`.** The `APP_INTERCEPTOR` factory injects `LogManager` via NestJS DI. This is more testable than calling `getAppContext()` directly — tests can provide a mock `LogManager` without initializing the full app context.

2. **Request ID as UUID v4.** UUID v4 is chosen over v7 or a simple counter because: (a) it's globally unique across distributed instances, (b) `uuid` is already a project dependency, (c) v4 is the standard choice for correlation IDs. The architecture doc says "UUID or a simple counter" — UUID is the safer choice.

3. **`debug` level for request body.** Request bodies can contain PII (passwords, emails). Logging at `info` level would expose this data in production. At `debug` level, bodies only appear when `LOG_LEVEL=debug` is set, which is appropriate for development/troubleshooting only.

4. **No response body logging.** Response bodies may contain tokens, PII, or sensitive data. The architecture doc explicitly prohibits logging response bodies.

5. **`catchError` re-throws.** The interceptor logs the error then re-throws it. The global exception filter (Story 7.3) handles the HTTP response formatting. The interceptor is not responsible for error responses — only for the log entry.

6. **Redaction is field-name-based.** The `SENSITIVE_FIELDS` set matches field names case-insensitively. This covers `password`, `token`, `accessToken`, `refreshToken`, `Authorization` header, and any future sensitive fields added to the set. This is simpler and more maintainable than regex-based content scanning.

7. **`requestId` on `req.requestId`.** Attaching the ID to the Express request object allows downstream code (controllers, services, guards) to access it for their own logging. The type augmentation makes this type-safe.

### What This Story Changes

| File                                                            | Action     | Description                                                                       |
| --------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| `src/shared/interceptors/logging.interceptor.ts`                | **CREATE** | New file — `LoggingInterceptor` class with request/response logging and redaction |
| `src/shared/interceptors/__tests__/logging.interceptor.spec.ts` | **CREATE** | Unit tests for interceptor logging and redaction logic                            |
| `src/shared/types/request.types.ts`                             | **CREATE** | Express `Request` type augmentation for `requestId`                               |
| `src/app.module.ts`                                             | **UPDATE** | Add `APP_INTERCEPTOR` provider with `LoggingInterceptor` factory                  |

### What Must Be Preserved

- All existing endpoints (`register`, `authenticate`, `refresh`, `logout`) must continue to work unchanged.
- The global `ValidationPipe` and `AllExceptionsFilter` remain unaffected.
- `cookieParser` middleware must still run before the interceptor (it already does via `app.use(cookieParser())` in `main.ts`).
- `AuthMiddleware` runs before the interceptor (middleware executes before interceptors in NestJS).
- The `LoggingModule` import order in `AppModule` must remain first (other modules depend on `LogManager`).

### Dependencies

**Upstream (must be implemented first):**

- **Story 8.1** (LoggingModule + LogManager): The interceptor uses `LogManager` to create an HTTP-scoped logger. Without it, there's no logger to inject.
- **Story 8.2** (PinoLogger): The concrete `ILogger` implementation used by `LogManager.getLogger()`. Without it, `LogManager` cannot create logger instances.
- **Story 7.3** (Global Exception Filter): The interceptor logs errors then re-throws. The filter handles the HTTP response. Both must coexist without conflict.
- **Story 1.4** (AppContext): Provides the `LogManager` interface definition used by the DI factory.
- **Story 1.5** (AppModule structure): The interceptor is registered in `AppModule` — it must already have its module structure.

**Downstream (this story enables):**

- Story 8.4 (Demographics Collection): May use `requestId` for correlation, but is not dependent on this story.
- Future stories can access `req.requestId` for distributed tracing.

### Code Patterns to Follow

**NestJS Interceptor Pattern (from architecture):**

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // before request
    return next.handle().pipe(
      tap(() => {
        /* after request */
      }),
    );
  }
}
```

**Global Interceptor Registration Pattern:**

```typescript
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useFactory: (logManager: LogManager) =>
        new LoggingInterceptor(logManager),
      inject: [LogManager],
    },
  ],
})
export class AppModule {}
```

**Logger Usage (from existing controllers):**

```typescript
private readonly logger = new Logger(AuthController.name);
```

The interceptor uses `LogManager.getLogger('HTTP')` instead — this follows the Story 8.1 pattern rather than NestJS's built-in `Logger`.

**Express Type Augmentation:**

```typescript
declare module 'express' {
  interface Request {
    requestId?: string;
  }
}
```

**Import Path Conventions:**

- Path aliases for cross-module: `@shared/interceptors/...`, `@shared/logging/...`
- Express types: `import { Request, Response } from 'express'`
- UUID: `import { v4 as uuidv4 } from 'uuid'`

### Test Setup Notes

The interceptor depends on `LogManager` and `ILogger` — both should be mocked in tests:

```typescript
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockLogManager = {
  getLogger: jest.fn().mockReturnValue(mockLogger),
};
```

Mock `ExecutionContext`:

```typescript
const mockRequest = {
  method: 'POST',
  url: '/auth/v1/register',
  body: { username: 'alice', password: 'secret123' },
  headers: { authorization: 'Bearer abc123' },
};

const mockResponse = {
  statusCode: 201,
};

const mockContext = {
  switchToHttp: () => ({
    getRequest: () => mockRequest,
    getResponse: () => mockResponse,
  }),
};
```

Mock `CallHandler`:

```typescript
const mockCallHandler = {
  handle: () => of({}),
};
```

## Dev Agent Record

### Agent Model Used

[opending soon]

### Debug Log References

[to be filled during implementation]

### Completion Notes List

[to be filled during implementation]

### File List

- `src/shared/interceptors/logging.interceptor.ts` (CREATED)
- `src/shared/interceptors/__tests__/logging.interceptor.spec.ts` (CREATED)
- `src/shared/types/request.types.ts` (CREATED)
- `src/app.module.ts` (UPDATED)
- `package.json` (UPDATED — added `uuid` to `transformIgnorePatterns`)

---

## Retrospective

**Epic 8 Retrospective:** [pending]
**Status:** Pending — to be completed after Epic 8 sprint
