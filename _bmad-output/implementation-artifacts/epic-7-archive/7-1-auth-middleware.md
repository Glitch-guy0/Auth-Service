# Story 7.1: Auth Middleware

Status: review

## Story

As a developer,
I want middleware that extracts tokens from the Authorization header,
so that guards receive tokens already extracted.

## Acceptance Criteria

1. **Given** a request with `Authorization: Bearer <token>`
   **When** AuthMiddleware processes it
   **Then** it extracts the raw token string
   **And** attaches it to the request context as `req.accessToken`

2. **Given** a request with no `Authorization` header
   **When** AuthMiddleware processes it
   **Then** it calls `next()` without setting `req.accessToken`
   **And** does not throw any exception

3. **Given** a request with `Authorization: Basic <credentials>` (non-Bearer scheme)
   **When** AuthMiddleware processes it
   **Then** it calls `next()` without setting `req.accessToken`

4. **Given** a request with `Authorization: Bearer ` (empty token)
   **When** AuthMiddleware processes it
   **Then** `req.accessToken` is an empty string
   **And** the downstream guard is responsible for rejecting it

5. **Given** the middleware is implemented
   **When** it is registered
   **Then** it is registered globally via `AppModule.configure()` so it applies to every route

## Tasks / Subtasks

- [x] Task 1: Create `AuthenticatedRequest` interface and `AuthMiddleware` class (AC: 1, 2, 3, 4)
  - [x] Create file `src/modules/auth/auth.middleware.ts`
  - [x] Define `AuthenticatedRequest` interface extending `Request` from `express` with `accessToken?: string` property
  - [x] Export `AuthenticatedRequest` for downstream consumption by guards (Story 7.2)
  - [x] Implement `AuthMiddleware` class with `@Injectable()` decorator implementing `NestMiddleware`
  - [x] In `use()` method: read `req.headers.authorization`
  - [x] If header starts with `'Bearer '`, slice the token string (index 7) and assign to `req.accessToken`
  - [x] If header is missing or doesn't match Bearer scheme, do nothing (token stays `undefined`)
  - [x] Always call `next()` — never throw exceptions

- [x] Task 2: Register middleware globally in `AppModule` (AC: 5)
  - [x] Add `implements NestModule` to `AppModule` class declaration
  - [x] Import `MiddlewareConsumer` and `NestModule` from `@nestjs/common`
  - [x] Import `AuthMiddleware` from `@modules/auth/auth.middleware`
  - [x] Implement `configure(consumer: MiddlewareConsumer)` method
  - [x] Call `consumer.apply(AuthMiddleware).forRoutes('*')` to register globally
  - [x] Verify `AppModule` still compiles (existing imports unchanged)

- [x] Task 3: Write unit tests for `AuthMiddleware` (AC: 1, 2, 3, 4)
  - [x] Create test file `src/modules/auth/__tests__/auth.middleware.spec.ts`
  - [x] Test: request with `Authorization: Bearer abc123` → `req.accessToken === 'abc123'`
  - [x] Test: request with no `Authorization` header → `req.accessToken` is `undefined`
  - [x] Test: request with `Authorization: Basic abc123` → `req.accessToken` is `undefined`
  - [x] Test: request with `Authorization: Bearer ` (empty token) → `req.accessToken === ''`
  - [x] Test: `next()` is always called exactly once regardless of header state
  - [x] Test: middleware does not throw any exceptions for any input

## Dev Notes

### Existing Code Context

**Auth Controller** (`src/modules/auth/auth.controller.ts`):
- Currently handles Bearer token extraction inline in the `logout` endpoint (lines 158-163): reads `@Headers('authorization') authHeader`, checks `startsWith('Bearer ')`, calls `authHeader.replace('Bearer ', '')`.
- After this middleware is in place, the guard (Story 7.2) can provide the token, simplifying future controller code.
- **No changes required to the controller in this story.** The middleware is additive.

**Auth Service** (`src/modules/auth/auth.service.ts`):
- No changes required. The middleware does not interact with the service layer.

**Auth Module** (`src/modules/auth/auth.module.ts`):
- Currently a plain `@Module` with `imports: [UserModule, TokenModule]`, `controllers: [AuthController]`, `providers: [AuthService]`.
- **No changes required to AuthModule** — the middleware is registered globally in `AppModule`, not per-module.

**App Module** (`src/app.module.ts`):
- Currently a plain `@Module` without `NestModule` implementation.
- **Must be updated** to implement `NestModule` and add `configure()` method for global middleware registration.
- Current imports: `ConfigModule`, `AuthModule`, `UserModule`, `TokenModule`, `LoggingModule`, `KeyModule`, `RedisModule`.

**Main Bootstrap** (`src/main.ts`):
- Sets up `cookieParser`, `ValidationPipe`, `AllExceptionsFilter`, Swagger, CORS.
- The middleware will run before guards and controllers, after `cookieParser` — this ordering is correct (Express middleware runs in registration order; `app.use()` runs before module-registered middleware).

**Exception Hierarchy** (`src/shared/exceptions/`):
- No exceptions used by this middleware. The middleware is a best-effort extraction layer that never throws.

### What This Story Changes

| File | Action | Description |
|------|--------|-------------|
| `src/modules/auth/auth.middleware.ts` | **CREATE** | New file — `AuthenticatedRequest` interface + `AuthMiddleware` class |
| `src/app.module.ts` | **UPDATE** | Add `NestModule` implementation and `configure()` for global middleware |
| `src/modules/auth/__tests__/auth.middleware.spec.ts` | **CREATE** | Unit tests for middleware extraction logic |

### What Must Be Preserved

- All existing endpoints (`register`, `authenticate`, `refresh`, `logout`) must continue to work unchanged.
- The `logout` endpoint's inline header parsing (Story 6.2) remains functional — it reads `@Headers('authorization')` directly, which is independent of the middleware. The middleware and the controller's `@Headers()` decorator both read from the same header; they don't conflict.
- `cookieParser` middleware must still run before this middleware (it already does via `app.use(cookieParser())` in `main.ts`).
- The global `ValidationPipe` and `AllExceptionsFilter` remain unaffected.

### Architecture References

- **Hexagonal Architecture (Section 2.1):** The middleware is an **inbound adapter**. It lives in the auth module's directory, depends on no outbound adapters, and does not call services — it only mutates the request object for downstream consumers (guards, controllers).
- **Logout Flow (Section 5.4):** Shows the token extraction pattern: "Get access token from request." The middleware standardizes this pattern for all routes.
- **API Routes (Section 11.1):** Routes that require auth (`POST /logout`, `POST /refresh`) will benefit from the pre-extracted token. Routes that don't need auth (`POST /register`, `POST /authenticate`) simply aren't guarded — the middleware runs but the guard skips them.
- **Security Considerations (Section 12):** The middleware does not validate tokens. Token validation (signature, expiry, blacklist) is the guard's responsibility (Story 7.2). This separation of concerns is a security principle — extraction and validation are distinct layers.

### Code Patterns to Follow

**NestJS Middleware Pattern:**
```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SomeMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    // ... mutate req
    next();
  }
}
```

**Logger Usage (from `auth.controller.ts` line 40):**
```typescript
private readonly logger = new Logger(AuthController.name);
```
Note: The middleware should NOT log token values (security). If logging is added, log only structural facts (e.g., "Bearer token present" / "No Authorization header"), never the token content.

**Import Path Convention (from `auth.controller.ts`):**
- Relative imports for sibling files: `'./auth.service'`
- Path aliases for cross-module: `'@modules/auth/...'`, `'@shared/...'`
- The middleware file uses `express` types directly: `import { Request, Response, NextFunction } from 'express'`

**Module Registration Pattern:**
```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';

@Module({ ... })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SomeMiddleware).forRoutes('*');
  }
}
```

### Key Design Decisions

1. **No exceptions thrown.** The middleware is purely extractive. An unauthenticated request has `req.accessToken === undefined`, and the guard (Story 7.2) decides whether to reject it. This keeps the middleware simple and testable.

2. **Global registration (`forRoutes('*')`).** Every route goes through extraction. Individual routes that don't need auth are simply not guarded — the guard is the access control decision point, not the middleware.

3. **Export `AuthenticatedRequest`.** The interface is consumed by the guard in Story 7.2 (`import { AuthenticatedRequest } from '../auth.middleware'`). Exporting it from the middleware file creates a clean dependency direction: middleware defines the contract, guard reads it.

4. **`accessToken` as the property name.** This matches the architecture doc's convention and is explicit about what's on the request. Avoids ambiguity with generic names like `token`.

5. **Bearer scheme only.** The middleware only extracts `Bearer` tokens. Other schemes (`Basic`, `ApiKey`, etc.) are ignored. The guard or specific route logic can handle other schemes if needed in the future.

### Project Structure Notes

- New file `src/modules/auth/auth.middleware.ts` follows the existing pattern of co-locating auth-related code in `src/modules/auth/`.
- The `middleware/` subdirectory mentioned in the requirements is NOT used — the implementation doc places the file directly in the auth module root (`src/modules/auth/auth.middleware.ts`). This is simpler and consistent with how `auth.controller.ts` and `auth.service.ts` are co-located.
- Test file follows the existing `__tests__/` convention: `src/modules/auth/__tests__/auth.middleware.spec.ts`.
- `AppModule` change is minimal — add `implements NestModule` and one method.

### Dependencies

- **Story 7.2** (JWT Auth Guard): Consumes `AuthenticatedRequest` and reads `req.accessToken`. Not required for this story to function, but the interface export enables it.
- **Story 1.15** (JwtPayload type): Not consumed by this middleware.
- **No upstream dependencies:** This story has no blocking dependencies on other stories.

## Dev Agent Record

### Agent Model Used

opencode/big-pickle

### Debug Log References

- All 7 middleware unit tests pass
- Full test suite: 162 tests passed, 12 suites
- TypeScript compiles cleanly with `tsc --noEmit`
- ESLint config issue is pre-existing (no `eslint.config.js`), unrelated to this story

### Completion Notes List

- Task 1: Created `src/modules/auth/auth.middleware.ts` with `AuthenticatedRequest` interface and `AuthMiddleware` class
- Task 2: Updated `src/app.module.ts` to implement `NestModule` with global middleware registration
- Task 3: Created `src/modules/auth/__tests__/auth.middleware.spec.ts` with 7 unit tests covering all acceptance criteria
- All tasks completed and verified

### Review Findings

- No issues found

### File List

- `src/modules/auth/auth.middleware.ts` (CREATE)
- `src/modules/auth/__tests__/auth.middleware.spec.ts` (CREATE)
- `src/app.module.ts` (UPDATE)

---

## Retrospective

**Epic 7 Retrospective:** [pending]
**Status:** Pending — to be completed after Epic 7 sprint
