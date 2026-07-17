# Story 9.2: Unit Tests — Guards & Filters

Status: review

## Story

As a developer,
I want unit tests for JwtAuthGuard and AllExceptionsFilter,
so that security-critical components are verified.

## Acceptance Criteria

1. **Given** a request with a valid token
   **When** JwtAuthGuard.canActivate() is called
   **Then** it returns `true`
   **And** attaches `{ userId }` to `request.user`

2. **Given** a request with a missing or empty token
   **When** JwtAuthGuard.canActivate() is called
   **Then** it throws `UnauthorizedException('Missing access token')`

3. **Given** a request with an expired token
   **When** JwtAuthGuard.canActivate() is called
   **Then** it throws `UnauthorizedException`

4. **Given** a request with a blacklisted token
   **When** JwtAuthGuard.canActivate() is called
   **Then** it throws `UnauthorizedException('Token has been revoked')`

5. **Given** a request with an invalid JWT signature
   **When** JwtAuthGuard.canActivate() is called
   **Then** it throws `UnauthorizedException`

6. **Given** Redis is unavailable
   **When** JwtAuthGuard.canActivate() is called with a valid token
   **Then** it fails open — returns `true` and allows the request

7. **Given** a `BaseAuthException` subclass is thrown (e.g. `InvalidCredentialsException`)
   **When** AllExceptionsFilter.catch() handles it
   **Then** it returns the exception's `statusCode`, `errorCode`, `message`, `timestamp`, and `path`

8. **Given** a NestJS `HttpException` is thrown
   **When** AllExceptionsFilter.catch() handles it
   **Then** it returns the HTTP status as code and the response message

9. **Given** an unknown `Error` is thrown
   **When** AllExceptionsFilter.catch() handles it
   **Then** it returns 500 with `'Internal server error'`

10. **Given** a Zod validation error reaches the filter
    **When** AllExceptionsFilter.catch() handles it
    **Then** it returns 400 with validation details in the `errors` array

## Tasks / Subtasks

- [x] Task 1: Verify and finalize JwtAuthGuard unit tests (AC: 1–6)
  - [x] Confirm `src/modules/auth/guards/__tests__/jwt-auth.guard.spec.ts` exists with tests for all scenarios
  - [x] Confirm valid token test: mock `tokenService.verifyAccessToken` to return `{ userId }`, mock `redisService.get` to return `null`, assert `canActivate` returns `true` and `request.user` is set
  - [x] Confirm missing/empty/whitespace token test: assert `UnauthorizedException('Missing access token')`
  - [x] Confirm expired token test: mock `verifyAccessToken` to reject with `TokenExpiredException`, assert `UnauthorizedException`
  - [x] Confirm invalid signature test: mock `verifyAccessToken` to reject with `TokenInvalidSignatureException`, assert `UnauthorizedException`
  - [x] Confirm blacklisted token test: mock `verifyAccessToken` to resolve, mock `redisService.get` to return a non-null value, assert `UnauthorizedException('Token has been revoked')`
  - [x] Confirm Redis failure test: mock `redisService.get` to reject with an error, assert `canActivate` returns `true` (fail open)
  - [x] Confirm unexpected verification error test: mock `verifyAccessToken` to reject with generic `Error`, assert `UnauthorizedException('Invalid or expired token')`
  - [x] Confirm verification runs before blacklist check (call order test)
  - [x] Add test for blocked user scenario if guard checks user block status (UT-G6)
  - [x] Run `npx jest src/modules/auth/guards/__tests__/jwt-auth.guard.spec.ts` — verify all tests pass

- [x] Task 2: Verify and finalize AllExceptionsFilter unit tests (AC: 7–10)
  - [x] Confirm `src/shared/exceptions/__tests__/all-exceptions.filter.spec.ts` exists with tests for all scenarios
  - [x] Confirm `BaseAuthException` test: throw `InvalidCredentialsException`, assert response has `status: 401`, `code: 'AUTH_INVALID_CREDENTIALS'`, `message`, `timestamp` (ISO 8601), `path`
  - [x] Confirm `UserBlockedException` test: assert response has `status: 403`, `code: 'AUTH_USER_BLOCKED'`
  - [x] Confirm `UserExistsException` test: assert response has `status: 400`, `code: 'VALIDATION_USER_EXISTS'`
  - [x] Confirm unknown `Error` test: assert response has `status: 500`, `message: 'Internal server error'`
  - [x] Confirm `HttpException` test: assert correct status and message extraction (string response, object response, string[] message)
  - [x] Confirm non-Error unknown exception test (e.g. string literal) — assert 500
  - [x] Confirm response envelope tests: `success: false` always, ISO 8601 timestamp, request path included, no stack traces
  - [x] Confirm `TokenExpiredException` test exists (UT-F2): assert 401 with code `TOKEN_EXPIRED`
  - [x] Add Zod validation error test (UT-F6): construct an `HttpException` with `errors` array in the response body, assert the filter propagates it in the `errors` field of the response
  - [x] Confirm `exception.timestamp` is used when available (BaseAuthException preserves its own timestamp)
  - [x] Run `npx jest src/shared/exceptions/__tests__/all-exceptions.filter.spec.ts` — verify all tests pass

- [x] Task 3: Run full test suite and verify coverage (AC: all)
  - [x] Run `npm run test` — verify 0 failures
  - [x] Run `npm run test:cov` — verify coverage report generates
  - [x] Confirm guard and filter tests appear in coverage report
  - [x] Fix any failing tests

## Dev Notes

### Existing Code Context

**JwtAuthGuard** (`src/modules/auth/guards/jwt-auth.guard.ts:1-63`):

```typescript
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardRequest>();
    const token = request.accessToken;
    if (!token?.trim()) throw new UnauthorizedException('Missing access token');

    try {
      const { userId } = await this.tokenService.verifyAccessToken(token);
      const isBlacklisted = await this.checkBlacklist(token);
      if (isBlacklisted) throw new UnauthorizedException('Token has been revoked');
      request.user = { userId };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.warn(`Token verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private async checkBlacklist(token: string): Promise<boolean> {
    try {
      const result = await this.redisService.get(`blacklist:${token}`);
      return result !== null;
    } catch (error) {
      this.logger.warn(`Redis blacklist check failed (failing open): ${(error as Error).message}`);
      return false;
    }
  }
}
```

Key behavior:
- Reads `request.accessToken` (set by AuthMiddleware, Story 7-1)
- Throws `UnauthorizedException('Missing access token')` for missing/empty/whitespace tokens
- Delegates JWT verification to `ITokenService.verifyAccessToken(token)` — this handles kid extraction, public key lookup, signature verification, and expiry
- Checks Redis blacklist AFTER verification (fast-fail on crypto failure first, then check revocation)
- Redis failure is handled with fail-open: if Redis is unreachable, the check returns `false` (not blacklisted), and the request proceeds
- All `UnauthorizedException` instances propagate directly; other errors (signature, expiry, unknown) are caught and re-thrown as `UnauthorizedException('Invalid or expired token')`
- Guard does NOT check user block status — that is the service layer's responsibility

**ITokenService Port** (`src/common/ports/token.port.ts`):

- `verifyAccessToken(token: string): Promise<{ userId: string }>`
- Mock this in guard tests with `jest.fn().mockResolvedValue({ userId: 'user-123' })` for success, `.mockRejectedValue(...)` for failures

**TokenService DI Token** (`src/common/ports/token.token.ts`):

- `export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');`

**RedisService** (`src/modules/redis/redis.service.ts`):

- `get(key: string): Promise<string | null>` — returns `null` if key not found
- Mock with `jest.fn().mockResolvedValue(null)` for not-blacklisted, `jest.fn().mockResolvedValue('{"user_id":"user-123"}')` for blacklisted, `jest.fn().mockRejectedValue(new Error('...'))` for failure

**AllExceptionsFilter** (`src/shared/exceptions/all-exceptions.filter.ts:1-79`):

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: number | string = status;
    let message = 'Internal server error';
    let timestamp = new Date().toISOString();
    let errors: ErrorEnvelope['error']['errors'] | undefined;

    if (exception instanceof BaseAuthException) {
      status = exception.statusCode;
      code = exception.errorCode;
      message = exception.message;
      timestamp = exception.timestamp;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = status;
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else {
        const obj = res as Record<string, unknown>;
        message = (obj.message as string)?.toString() ?? exception.message;
        if (Array.isArray(obj.errors)) {
          errors = obj.errors as ErrorEnvelope['error']['errors'];
        }
      }
    } else {
      this.logger.error(...);
    }

    response.status(status).json({
      success: false,
      error: { code, message, timestamp, path: request.url, ...(errors && { errors }) },
    });
  }
}
```

Key behavior:
- `@Catch()` with no arguments catches ALL exceptions
- Three branches: `BaseAuthException` (custom hierarchy), `HttpException` (NestJS built-in), unknown (500 fallback)
- `BaseAuthException` branch: extracts `statusCode`, `errorCode`, `message`, `timestamp` directly from the exception instance
- `HttpException` branch: extracts status via `getStatus()`, message from `getResponse()` (handles string, object, array message)
- Supports `errors` array in `HttpException` responses — enables Zod validation error propagation
- Logs unknown exceptions via `this.logger.error` — should be suppressed in tests with `jest.spyOn(console, 'error').mockImplementation()`
- Always returns `{ success: false, error: { code, message, timestamp, path } }` — no stack traces

**BaseAuthException Hierarchy** (`src/shared/exceptions/`):

| Class | File | Status | Error Code | Default Message |
|-------|------|--------|------------|-----------------|
| `BaseAuthException` (abstract) | `base.exception.ts` | (abstract) | (abstract) | — |
| `AuthenticationException` | `authentication.exception.ts` | 401 | `AUTH_ERROR` | (requires message) |
| `InvalidCredentialsException` | `authentication.exception.ts` | 401 | `AUTH_INVALID_CREDENTIALS` | "Invalid email or password" |
| `TokenExpiredException` | `authentication.exception.ts` | 401 | `TOKEN_EXPIRED` | "Token has expired" |
| `TokenRevokedException` | `authentication.exception.ts` | 401 | `TOKEN_REVOKED` | "Token has been revoked" |
| `TokenInvalidSignatureException` | `authentication.exception.ts` | 401 | `TOKEN_INVALID_SIGNATURE` | "Token signature is invalid" |
| `AuthorizationException` | `authorization.exception.ts` | 403 | `AUTH_FORBIDDEN` | (requires message) |
| `UserBlockedException` | `authorization.exception.ts` | 403 | `AUTH_USER_BLOCKED` | "User account has been blocked" |
| `ValidationException` | `validation.exception.ts` | 400 | `VALIDATION_ERROR` | (requires message) |
| `UserExistsException` | `validation.exception.ts` | 400 | `VALIDATION_USER_EXISTS` | "User already exists with this email" |

**Existing Test Files:**

Guard tests (`src/modules/auth/guards/__tests__/jwt-auth.guard.spec.ts:1-188`):

- Already covers: valid token, missing/empty/whitespace token, invalid signature, expired token, unexpected errors, blacklisted token, verify-before-blacklist order, Redis fail-open (connection refused, timeout)
- Missing: blocked user scenario (not in scope — guard does not check user status)
- Guard is instantiated with constructor: `new JwtAuthGuard(mockTokenService, mockRedisService)`
- No NestJS `TestingModule` — guard is instantiated directly with mocks

Filter tests (`src/shared/exceptions/__tests__/all-exceptions.filter.spec.ts:1-272`):

- Already covers: `InvalidCredentialsException`, `UserBlockedException`, `UserExistsException`, custom `BaseAuthException` subclass, `exception.timestamp` preservation, `HttpException` (string message, object message, object response without message, string[] message), unknown `Error`, non-Error unknown, `success: false` always, ISO 8601 timestamp format, request path, stack trace exclusion
- Missing: `TokenExpiredException` test (UT-F2 — though code path is same as `InvalidCredentialsException`), Zod validation error propagation (UT-F6 — tests `errors` array in `HttpException` response)
- Filter is instantiated directly: `new AllExceptionsFilter()`

### Architecture References

- **Architecture §5.4**: Logout flow — guard validates tokens before logout handler runs
- **Architecture §11.2**: Error response format — `{ success: false, error: { code, message } }` — enforced by the filter
- **Architecture §12**: Security — Redis blacklist for token revocation, fail-open on Redis outage
- **AD-5 Single Active Session**: Guard behavior with revoked tokens — blacklist check verifies session lifecycle
- **AD-1 Hexagonal Module Boundary**: Guard is an inbound adapter (HTTP layer); filter is cross-cutting infrastructure

### Mocking ExecutionContext (Guard Tests)

```typescript
function createMockContext(token?: string) {
  const mockRequest: Record<string, any> = {};
  if (token) mockRequest.accessToken = token;

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
  } as unknown as ExecutionContext;
}
```

The guard reads `request.accessToken` (not from `Authorization` header directly — the middleware extracts it). Set `mockRequest.accessToken` to simulate different states.

### Mocking ArgumentsHost (Filter Tests)

```typescript
function createMockHost() {
  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const mockRequest = { url: '/auth/v1/authenticate' };

  return {
    switchToHttp: () => ({
      getResponse: () => mockResponse,
      getRequest: () => mockRequest,
    }),
  } as unknown as ArgumentsHost;
}
```

Assert on `mockResponse.status` (HTTP status) and `mockResponse.json` (response body). The `json` mock does NOT need `.mockReturnThis()` — it is the final call in the chain.

### Code Patterns to Follow

**Guard constructor injection** (from `auth.service.ts:24-27`):

```typescript
@Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
```

Use `@Inject(TOKEN_SERVICE)` with the Symbol token from `src/common/ports/token.token.ts`.

**Logger pattern** (from `auth.service.ts`):

```typescript
private readonly logger = new Logger(ClassName.name);
```

**Test isolation** — `afterEach(() => { jest.clearAllMocks(); })` prevents cross-test leakage.

**Suppress logger output in tests** — for the filter, suppress error log output for unknown exception tests:

```typescript
jest.spyOn(console, 'error').mockImplementation(() => {});
```

### Key Design Decisions

1. **Guard tests use direct instantiation, not TestingModule.** The guard has only two dependencies (`ITokenService`, `RedisService`), both injectable without NestJS module compilation. This keeps tests fast and simple. Do NOT use `Test.createTestingModule` for guard tests.

2. **Filter tests also use direct instantiation.** `AllExceptionsFilter` is stateless — no DI dependencies. `new AllExceptionsFilter()` is sufficient. Mock `ArgumentsHost` with the factory pattern above.

3. **Guard throws `UnauthorizedException`, not custom exceptions.** The guard catches custom exceptions (`TokenExpiredException`, `TokenInvalidSignatureException`) and re-throws as NestJS `UnauthorizedException`. Tests assert on `UnauthorizedException`, not on the underlying custom exception. This is a deliberate design choice to keep NestJS exception filters as the single exception formatting layer.

4. **Verification-first ordering.** The guard verifies the token signature BEFORE checking the Redis blacklist. This means token expiry and invalid signature errors are caught before any Redis lookup, avoiding unnecessary I/O on clearly invalid tokens. Verify this call order in tests.

5. **Redis fail-open by design.** If Redis is unreachable, the guard logs a warning but allows the request through. This prevents a Redis outage from becoming a full application outage. The blacklist is a best-effort revocation mechanism, not a security gate. Tests must verify this behavior.

6. **Filter handles three exception categories:** `BaseAuthException` for custom domain exceptions, `HttpException` for NestJS built-in exceptions (including `ValidationPipe` errors), and a catch-all `Error` fallback for 500. The `BaseAuthException` branch must be checked FIRST because `BaseAuthException` extends `Error`, not `HttpException` — the two hierarchies are completely separate.

7. **Zod validation errors reach the filter as `HttpException` with `errors` array.** NestJS `ValidationPipe` wraps Zod errors into `BadRequestException` with a structured response. The filter's `HttpException` branch extracts the `errors` array if present and includes it in the response. The `ErrorEnvelope` interface already supports this via the optional `errors` field.

### What This Story Changes

| File | Action | Description |
| ---- | ------ | ----------- |
| `src/modules/auth/guards/__tests__/jwt-auth.guard.spec.ts` | **VERIFY** | Already exists with 14 tests. Confirm all pass. Add blocked user test if applicable. |
| `src/shared/exceptions/__tests__/all-exceptions.filter.spec.ts` | **ENHANCE** | Already exists with 17 tests. Add `TokenExpiredException` test (UT-F2) and Zod validation error test with `errors` array (UT-F6). Confirm all pass. |

### What Must Be Preserved

- Guard must NOT check user block status — that is the service layer's domain
- Guard must NOT read `Authorization` header directly — it reads `request.accessToken` set by AuthMiddleware
- Guard must NOT use `TestingModule` — direct instantiation is correct for this simple dependency graph
- Filter must preserve the `BaseAuthException` → `HttpException` → unknown 500 branching order
- Filter must NOT include stack traces in responses (security requirement per Architecture §12)
- Filter must always return `success: false` in the envelope
- All existing test assertions must continue to pass (do not change existing behavior, only add missing coverage)
- Mock implementations must not use real services — no database, no Redis, no TokenService

### Dependencies

- **Epic 1**: Exception hierarchy defined (`BaseAuthException`, subclasses)
- **Epic 4**: Token verification implemented (`ITokenService.verifyAccessToken`)
- **Epic 7**: JwtAuthGuard and AllExceptionsFilter implemented and registered
- **Story 7-1**: AuthMiddleware sets `request.accessToken` (guard reads this)
- **Story 7-2**: JwtAuthGuard implementation (file under test)
- **Story 7-3**: AllExceptionsFilter implementation (file under test)
- **Story 9-1**: Service mocking patterns established

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

| File | Action |
| ---- | ------ |
| `src/modules/auth/guards/__tests__/jwt-auth.guard.spec.ts` | VERIFY |
| `src/shared/exceptions/__tests__/all-exceptions.filter.spec.ts` | ENHANCE |
