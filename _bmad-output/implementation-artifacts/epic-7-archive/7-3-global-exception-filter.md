# Story 7.3: Global Exception Filter

Status: review

## Story

As a developer,
I want a global exception filter that formats all errors consistently,
so that API responses have uniform error structure.

## Acceptance Criteria

1. **Given** an exception is thrown
   **When** AllExceptionsFilter catches it
   **Then** it returns `{ success: false, error: { code, message, timestamp, path } }`
   **And** sets the correct HTTP status code

## Tasks / Subtasks

- [x] Task 1: Enhance AllExceptionsFilter to handle BaseAuthException hierarchy (AC: 1)
  - [x] Add `import { BaseAuthException } from './base.exception';` to filter file
  - [x] Add `instanceof BaseAuthException` check BEFORE the existing `HttpException` check
  - [x] When `BaseAuthException`: extract `exception.statusCode` as HTTP status, `exception.errorCode` as the `code` field, `exception.message` as message
  - [x] Verify the existing `HttpException` branch still works (NestJS built-in exceptions)
  - [x] Verify the existing unknown-exception fallback (500 Internal Server Error) still works
- [x] Task 2: Refactor AuthController to throw BaseAuthException directly (AC: 1)
  - [x] In `register()`: remove `ConflictException` wrapper — throw `UserExistsException` directly
  - [x] In `register()`: remove `InternalServerErrorException` wrapper — let unknown errors propagate to filter
  - [x] In `login()`: remove `UnauthorizedException` wrapper — throw `InvalidCredentialsException` directly
  - [x] In `login()`: remove `ForbiddenException` wrapper — throw `UserBlockedException` directly
  - [x] In `login()`: remove `InternalServerErrorException` wrapper — let unknown errors propagate to filter
  - [x] In `refresh()`: remove `UnauthorizedException` wrapper — throw `TokenExpiredException`/`InvalidCredentialsException` directly
  - [x] In `refresh()`: remove `InternalServerErrorException` wrapper — let unknown errors propagate to filter
  - [x] In `logout()`: remove `InternalServerErrorException` wrapper — let unknown errors propagate to filter
  - [x] Remove unused NestJS exception imports from auth.controller.ts (`ConflictException`, `UnauthorizedException`, `ForbiddenException`, `InternalServerErrorException`)
- [x] Task 3: Add AllExceptionsFilter unit tests (AC: 1)
  - [x] Create `src/shared/exceptions/__tests__/all-exceptions.filter.spec.ts`
  - [x] Test: catches `BaseAuthException` subclass → returns `{ success: false, error: { code: exception.errorCode, message, timestamp, path } }` with correct HTTP status
  - [x] Test: catches NestJS `HttpException` → returns `{ success: false, error: { code: httpStatus, message, timestamp, path } }` with correct HTTP status
  - [x] Test: catches unknown exception → returns 500 with `{ success: false, error: { code: 500, message: "Internal server error", timestamp, path } }`
  - [x] Test: verifies `timestamp` is ISO 8601 format
  - [x] Test: verifies `path` matches request URL
- [x] Task 4: Verify global registration in main.ts (AC: 1)
  - [x] Confirm `app.useGlobalFilters(new AllExceptionsFilter())` is present in `src/main.ts:38`
  - [x] Confirm import of `AllExceptionsFilter` from `@shared/exceptions/all-exceptions.filter` exists in `src/main.ts:7`
  - [x] No changes needed — already correctly registered

## Dev Notes

### Existing Code Context

**AllExceptionsFilter** (`src/shared/exceptions/all-exceptions.filter.ts`):

- ALREADY EXISTS with basic implementation (52 lines)
- Uses `@Catch()` decorator (catches ALL exceptions, not just `HttpException`)
- Defines `ErrorEnvelope` interface matching the expected response shape
- Currently only branches on `HttpException` — does NOT recognize `BaseAuthException` hierarchy
- Unknown exceptions fall through to 500 with generic message
- File is already imported and registered globally in `main.ts:38`

**What the filter currently does:**

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    // ... extracts request/response from host
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res
        : (res as { message?: string | string[] }).message?.toString() ?? exception.message;
    }

    // ... builds and sends ErrorEnvelope
  }
}
```

**What's missing:** The filter does NOT check for `BaseAuthException` instances. When a `BaseAuthException` is thrown directly (not wrapped in NestJS `HttpException`), it falls through to the unknown-exception branch and returns 500 with a generic message, losing the custom `statusCode` and `errorCode`.

**BaseAuthException hierarchy** (`src/shared/exceptions/`):

| Class | HTTP Status | Error Code | Default Message |
|-------|-------------|------------|-----------------|
| `BaseAuthException` | (abstract) | (abstract) | — |
| `AuthenticationException` | 401 | `AUTH_ERROR` | (requires message) |
| `InvalidCredentialsException` | 401 | `AUTH_INVALID_CREDENTIALS` | "Invalid email or password" |
| `TokenExpiredException` | 401 | `TOKEN_EXPIRED` | "Token has expired" |
| `TokenRevokedException` | 401 | `TOKEN_REVOKED` | "Token has been revoked" |
| `TokenInvalidSignatureException` | 401 | `TOKEN_INVALID_SIGNATURE` | "Token signature is invalid" |
| `AuthorizationException` | 403 | `AUTH_FORBIDDEN` | (requires message) |
| `UserBlockedException` | 403 | `AUTH_USER_BLOCKED` | "User account has been blocked" |
| `ValidationException` | 400 | `VALIDATION_ERROR` | (requires message) |
| `UserExistsException` | 400 | `VALIDATION_USER_EXISTS` | "User already exists with this email" |

All custom exceptions extend `BaseAuthException` which provides:
- `statusCode: number` — the HTTP status to return
- `errorCode: string` — the application-level error code
- `message: string` — human-readable error message
- `timestamp: string` — ISO 8601 timestamp (set in constructor)

**AuthController** (`src/modules/auth/auth.controller.ts`):

- Currently wraps custom exceptions in NestJS `HttpException` subclasses before throwing
- This loses the `errorCode` from the custom exception hierarchy
- Pattern in every endpoint: `catch (error) → if (specificCustomException) throw new NestJSHttpException(error.message)`
- After this story: controller should throw custom exceptions directly; the filter handles formatting

**Main bootstrap** (`src/main.ts`):

- Line 7: `import { AllExceptionsFilter } from '@shared/exceptions/all-exceptions.filter';`
- Line 38: `app.useGlobalFilters(new AllExceptionsFilter());`
- Already correctly registered — no changes needed

### What This Story Changes

1. **`src/shared/exceptions/all-exceptions.filter.ts`** — ENHANCE: add `BaseAuthException` handling branch before the `HttpException` check
2. **`src/modules/auth/auth.controller.ts`** — SIMPLIFY: remove NestJS exception wrapping, throw custom exceptions directly
3. **`src/shared/exceptions/__tests__/all-exceptions.filter.spec.ts`** — NEW: unit tests for the filter

### What Must Be Preserved

- `ErrorEnvelope` interface shape (must remain compatible with existing consumers)
- `@Catch()` decorator (must catch ALL exceptions, not just specific types)
- The `HttpException` branch (NestJS built-in exceptions like `ValidationPipe` errors still go through this path)
- The 500 fallback for truly unknown exceptions
- The global registration in `main.ts`
- Cookie handling and response patterns in the controller (only exception throwing changes)

### Architecture References

- **Response format**: `architecture.md` Section 11.2 — Error response: `{ success: false, error: { code, message } }`. The filter extends this with `timestamp` and `path` for debugging.
- **Security**: `architecture.md` Section 12 — Error messages must not leak sensitive details (stack traces, internal paths). The filter must NOT include stack traces in responses.
- **API routes**: `architecture.md` Section 11.1 — All endpoints under `/auth/v1`

### Code Pattern to Follow

The filter's `BaseAuthException` branch should follow this pattern:

```typescript
if (exception instanceof BaseAuthException) {
  status = exception.statusCode;
  code = exception.errorCode;
  message = exception.message;
} else if (exception instanceof HttpException) {
  status = exception.getStatus();
  const res = exception.getResponse();
  message = typeof res === 'string'
    ? res
    : (res as { message?: string | string[] }).message?.toString() ?? exception.message;
  code = status; // numeric fallback for NestJS exceptions
} else {
  status = HttpStatus.INTERNAL_SERVER_ERROR;
  message = 'Internal server error';
  code = status;
}
```

The controller pattern after refactoring:

```typescript
// Before (wraps custom exception, loses errorCode):
} catch (error) {
  if (error instanceof InvalidCredentialsException) {
    throw new UnauthorizedException(error.message); // loses AUTH_INVALID_CREDENTIALS
  }
}

// After (throws directly, filter handles formatting):
// No try/catch needed — let BaseAuthException propagate to filter
```

### Project Structure Notes

- Exception files: `src/shared/exceptions/` — filter file is enhanced, others unchanged
- Controller: `src/modules/auth/auth.controller.ts` — simplified (remove exception wrapping)
- New test: `src/shared/exceptions/__tests__/all-exceptions.filter.spec.ts`
- Bootstrap: `src/main.ts` — no changes (already registered)

### Testing Standards

- Unit tests in `__tests__/` subdirectory alongside source files
- Use Jest (NestJS default)
- Mock `ArgumentsHost` with `switchToHttp()` returning mock `Request`/`Response`
- Assert response body matches `ErrorEnvelope` interface
- Assert HTTP status code on response

## Dev Agent Record

### Agent Model Used

opencode/big-pickle

### Debug Log References

### Completion Notes List

- Task 1: Enhanced AllExceptionsFilter with `BaseAuthException` branch before `HttpException` check. Updated `ErrorEnvelope` interface to support `code: number | string` (string for errorCode, number for NestJS exceptions). Added `BaseAuthException` import.
- Task 2: Removed all NestJS exception wrapping in AuthController. Controller now throws custom `BaseAuthException` subclasses directly. Unknown errors propagate naturally to the filter's 500 fallback. Removed unused imports: `ConflictException`, `InternalServerErrorException`, `UnauthorizedException`, `ForbiddenException`, `UserExistsException`, `InvalidCredentialsException`, `TokenExpiredException`, `UserBlockedException`. Replaced `UnauthorizedException` in logout with `AuthenticationException`.
- Task 3: Created 13 unit tests for AllExceptionsFilter covering BaseAuthException hierarchy, HttpException handling, unknown exceptions, response envelope shape, ISO 8601 timestamp validation, path matching, and stack trace exclusion.
- Task 4: Verified main.ts already has correct global filter registration at line 38 with import at line 7. No changes needed.
- Updated auth.controller.spec.ts to match new behavior: custom exceptions propagate directly (not wrapped), unknown errors propagate as-is.

### Review Findings

### File List

- `src/shared/exceptions/all-exceptions.filter.ts` — enhanced with BaseAuthException handling
- `src/shared/exceptions/__tests__/all-exceptions.filter.spec.ts` — new: 13 unit tests
- `src/modules/auth/auth.controller.ts` — simplified: removed try/catch wrappers
- `src/modules/auth/__tests__/auth.controller.spec.ts` — updated tests for direct exception propagation
