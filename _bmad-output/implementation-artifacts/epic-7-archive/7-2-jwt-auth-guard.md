# Story 7.2: JWT Auth Guard

Status: review

## Story

As a developer,
I want a JwtAuthGuard that validates access tokens,
so that protected routes are secure.

## Acceptance Criteria

1. **Given** a request with a valid token
   **When** JwtAuthGuard canActivate() is called
   **Then** it decodes JWT header to extract kid
   **Then** it gets public key from KeyManager
   **Then** it verifies JWT signature
   **Then** it checks Redis blacklist
   **Then** it checks expiry
   **And** attaches user to request

2. **Given** a request with an invalid token
   **When** JwtAuthGuard canActivate() is called
   **Then** it throws the appropriate exception

## Tasks / Subtasks

- [x] Task 1: Create JwtAuthGuard class (AC: 1, 2)
  - [x] Create directory `src/modules/auth/guards/`
  - [x] Create file `src/modules/auth/guards/jwt-auth.guard.ts`
  - [x] Implement `CanActivate` interface from `@nestjs/common`
  - [x] Inject `ITokenService` via `@Inject(TOKEN_SERVICE)`
  - [x] Implement `canActivate(context: ExecutionContext)` method

- [x] Task 2: Extract token from request (AC: 1, 2)
  - [x] Get `Request` object from `ExecutionContext.switchToHttp().getRequest()`
  - [x] Read `request.accessToken` (set by Story 7-1 AuthMiddleware)
  - [x] If token is missing or empty, throw `UnauthorizedException`

- [x] Task 3: Verify token via TokenService (AC: 1, 2)
  - [x] Call `this.tokenService.verifyAccessToken(token)`
  - [x] `verifyAccessToken` handles: decode JWT header to extract kid, get public key from KeyManager, verify signature, check expiry
  - [x] Catch `TokenInvalidSignatureException` → throw `UnauthorizedException`
  - [x] Catch `TokenExpiredException` → throw `UnauthorizedException`
  - [x] On success, extract `userId` from the result

- [x] Task 4: Check Redis blacklist (AC: 1, 2)
  - [x] Inject `RedisService` for direct blacklist check
  - [x] Check `blacklist:{token}` key in Redis before signature verification
  - [x] If token is blacklisted, throw `UnauthorizedException` with message indicating revoked token

- [x] Task 5: Attach user to request (AC: 1)
  - [x] Set `request.user = { userId }` after successful verification
  - [x] Return `true` to allow the request to proceed

- [x] Task 6: Register guard in AuthModule (AC: 1)
  - [x] Import `TokenModule` and `RedisModule` into `AuthModule` (TokenModule already imported, RedisModule is @Global)
  - [x] Add `JwtAuthGuard` to AuthModule providers and exports

- [x] Task 7: Write unit tests for JwtAuthGuard (AC: 1, 2)
  - [x] Create test file `src/modules/auth/guards/__tests__/jwt-auth.guard.spec.ts`
  - [x] Mock `ITokenService` (verifyAccessToken)
  - [x] Mock `RedisService` (get)
  - [x] Mock `ExecutionContext` and `Request`
  - [x] Test: returns true for valid token with user attached
  - [x] Test: throws UnauthorizedException when no token
  - [x] Test: throws UnauthorizedException when token verification fails (invalid signature)
  - [x] Test: throws UnauthorizedException when token is expired
  - [x] Test: throws UnauthorizedException when token is blacklisted
  - [x] Test: handles Redis connection errors gracefully (best-effort blacklist check)

## Dev Notes

### Existing Code Context

**Auth Controller** (`src/modules/auth/auth.controller.ts`):

- Has `register`, `login`, `refresh`, `logout` endpoints
- `logout` currently reads token from `@Headers('authorization')` directly (no guard yet)
- Once guard is applied, protected routes won't need to manually extract tokens
- Pattern: `@Version('v1')` + `@Post('<route>')` + `@HttpCode()` + Swagger decorators
- The guard will be applied via `@UseGuards(JwtAuthGuard)` decorator on controller or specific routes

**Auth Service** (`src/modules/auth/auth.service.ts`):

- `logout(accessToken: string)` calls `this.tokenService.verifyAccessToken(accessToken)` to extract `userId`
- The guard should NOT call `authService.logout()` — it only validates and attaches user context
- The guard delegates verification to `ITokenService.verifyAccessToken()`

**ITokenService Port** (`src/common/ports/token.port.ts`):

- `verifyAccessToken(token: string): Promise<{ userId: string }>` — already implemented
- `blacklistToken(token: string, userId: string): Promise<void>` — already implemented
- The guard will use `verifyAccessToken` and check blacklist via Redis directly

**ITokenService Implementation** (`src/modules/token/token.service.ts:62-117`):

- `verifyAccessToken()` already handles:
  - Decoding JWT header to extract `kid` (lines 64-79)
  - Getting public key from `IKeyManager.getPublicKey(kid)` (lines 81-86)
  - Verifying JWT signature via `jwtVerify()` from jose (lines 88-91)
  - Checking expiry (jose handles this automatically, throws `JWTExpired`)
- Returns `{ userId: payload.sub as string }` on success
- Throws `TokenInvalidSignatureException` for malformed/invalid tokens
- Throws `TokenExpiredException` for expired tokens

**IKeyManager Port** (`src/common/ports/key-manager.port.ts`):

- `getPublicKey(kid: string): Promise<string>` — used by TokenService internally
- The guard does NOT call KeyManager directly — TokenService handles this

**Redis Service** (`src/modules/redis/redis.service.ts`):

- `get(key: string): Promise<string | null>` — check if key exists
- `set(key: string, value: string, expirySeconds?: number): Promise<void>`
- Blacklist key format: `blacklist:{token}` (from `token.service.ts:202`)

**Exception Classes** (`src/shared/exceptions/authentication.exception.ts`):

- `TokenExpiredException` — thrown for expired tokens
- `TokenRevokedException` — thrown for revoked/blacklisted tokens
- `TokenInvalidSignatureException` — thrown for invalid signature

**JWT Types** (`src/types/jwt.types.ts`):

```typescript
interface JwtPayload {
  sub: string;    // user_id
  iat: number;    // authenticated_at
  iss: string;    // server_id
  kid: string;    // key ID for rotation
  exp: number;    // 1 day (tunable)
}
```

**DI Token Pattern** (`src/common/ports/token.token.ts`):

```typescript
export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');
```

Used with `@Inject(TOKEN_SERVICE)` for dependency injection.

### What This Story Creates

**New file:** `src/modules/auth/guards/jwt-auth.guard.ts`

```typescript
// Pseudocode — implementation details in tasks
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.accessToken; // Set by Story 7-1 middleware

    if (!token) throw new UnauthorizedException('Missing access token');

    // Check Redis blacklist (best-effort)
    const isBlacklisted = await this.redisService.get(`blacklist:${token}`);
    if (isBlacklisted) throw new UnauthorizedException('Token has been revoked');

    // Verify token (handles kid extraction, key lookup, signature, expiry)
    const { userId } = await this.tokenService.verifyAccessToken(token);

    // Attach user to request
    request.user = { userId };

    return true;
  }
}
```

### What This Story Changes

- **New file:** `src/modules/auth/guards/jwt-auth.guard.ts`
- **New file:** `src/modules/auth/guards/__tests__/jwt-auth.guard.spec.ts`
- **Modified file:** `src/modules/auth/auth.module.ts` — add JwtAuthGuard to providers/exports, ensure TokenModule and RedisModule imports

### What Must Be Preserved

- Existing controller endpoints must continue to work without guard applied
- The guard should be opt-in per route/controller via `@UseGuards(JwtAuthGuard)`, NOT globally applied yet
- `logout` endpoint should NOT use the guard (it reads token from header directly per Story 6-2)
- `register`, `login`, `refresh` endpoints should NOT use the guard (they don't require pre-authenticated access)
- The guard must not break the existing auth flow

### Code Patterns to Follow

**Logger pattern** (from `auth.service.ts`):

```typescript
private readonly logger = new Logger(AuthService.name);
```

**DI injection pattern** (from `auth.service.ts:24-27`):

```typescript
constructor(
  @Inject(USER_SERVICE) private readonly userService: IUserService,
  @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
) {}
```

**Import path pattern** (from `auth.service.ts`):

```typescript
import { ITokenService } from '../../common/ports/token.port';
import { TOKEN_SERVICE } from '../../common/ports/token.token';
```

**Test pattern** (from `auth.controller.spec.ts`):

```typescript
import { Test, TestingModule } from '@nestjs/testing';
// Mock services, create module, test behavior
```

### Project Structure Notes

- Guard placement: `src/modules/auth/guards/jwt-auth.guard.ts` — follows NestJS convention of `guards/` subdirectory
- Test placement: `src/modules/auth/guards/__tests__/jwt-auth.guard.spec.ts` — follows existing `__tests__/` pattern
- The guard is an **inbound adapter** per hexagonal architecture (Section 2.1)
- The guard consumes the `ITokenService` port, not the concrete implementation
- RedisModule must be importable — check if AuthModule already imports it or needs to add it

### Architecture Reference

- **Hexagonal Architecture:** `architecture.md` Section 2.1 — Guard is an inbound adapter in the "HTTP Controller / Auth Guard" layer
- **Key Management:** `architecture.md` Section 4 — kid-based key rotation, public key retrieval from KeyManager
- **JWT Structure:** `architecture.md` Section 6.1 — `kid` in JWT header, `sub` = user_id, `exp` = expiry
- **Token Expiry:** `architecture.md` Section 6.2 — `ACCESS_TOKEN_EXPIRY = '1d'`, jose handles expiry verification
- **Token Revocation:** `architecture.md` Section 3.3 — Redis blacklist key format: `blacklist:{token_jti}` → `{ expires_at, user_id }`
- **API Routes:** `architecture.md` Section 11.1 — Routes requiring auth: POST `/refresh` (cookie), POST `/logout`
- **Security:** `architecture.md` Section 12 — Token revocation via Redis blacklist, HttpOnly cookie, SameSite=strict

### Key Implementation Decisions

1. **Blacklist check order:** Check Redis blacklist BEFORE signature verification for fast-fail on revoked tokens (avoids expensive crypto operations on revoked tokens). However, this means a Redis lookup on every request. Alternative: check AFTER verification. Decision: **check AFTER verification** — signature verification is the primary security gate; blacklist is secondary.

2. **Guard scope:** NOT global — applied per-route/controller via `@UseGuards()`. The auth endpoints (`register`, `login`, `refresh`) must remain unprotected. Only apply to future protected routes.

3. **Request.user type:** Use `{ userId: string }` to match what `verifyAccessToken` returns. Future RBAC (Phase 4) can extend this to `{ userId, role }`.

4. **Redis failure handling:** If Redis is down, the blacklist check should fail open (log warning, allow request). This prevents a Redis outage from locking out all users. The blacklist is best-effort by design (per `auth.service.ts:170-176`).

### Dependencies

- **Story 7-1** (Auth Middleware): MUST be completed first. The middleware sets `request.accessToken` which the guard reads. Without middleware, the guard has no token to validate.
- **Epic 4** (Token Service): `ITokenService.verifyAccessToken()` must be implemented and working.
- **Redis Module**: Must be available in the DI container. Check `RedisModule` exports.

## Dev Agent Record

### Agent Model Used

opencode/big-pickle

### Debug Log References

- All 11 guard unit tests pass (11/11)
- Full test suite: 174/174 tests pass
- TypeScript type check: clean (no errors)

### Completion Notes List

- Implemented `JwtAuthGuard` implementing `CanActivate` interface
- Guard reads `request.accessToken` from AuthMiddleware (Story 7-1)
- Delegates JWT verification to `ITokenService.verifyAccessToken()` (kid extraction, key lookup, signature, expiry all handled by TokenService)
- Blacklist check via `RedisService.get(`blacklist:${token}`)` — runs before signature verification for fast-fail
- Redis failure handling: fail-open with warning log (best-effort blacklist per architecture)
- On verification failure (TokenInvalidSignatureException, TokenExpiredException), catches and re-throws as `UnauthorizedException`
- Attaches `{ userId }` to `request.user` on success
- Registered in `AuthModule` providers and exports
- Guard is opt-in (not global) — applied via `@UseGuards(JwtAuthGuard)` per route/controller
- RedisModule is `@Global()` so no explicit import needed in AuthModule

### Review Findings

### File List

- `src/modules/auth/guards/jwt-auth.guard.ts` (new)
- `src/modules/auth/guards/__tests__/jwt-auth.guard.spec.ts` (new)
- `src/modules/auth/auth.module.ts` (modified — added JwtAuthGuard to providers/exports)

---

## Retrospective

**Epic 7 Retrospective:** [pending]
