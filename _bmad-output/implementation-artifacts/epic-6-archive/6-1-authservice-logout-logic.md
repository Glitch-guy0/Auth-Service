---
story_id: 6.1
story_key: 6-1-authservice-logout-logic
story_title: 'AuthService — Logout Logic'
epic_num: 6
story_num: 1
status: ready-for-dev
created_date: 2026-07-16
---

# Story 6.1: AuthService — Logout Logic

Status: ready-for-dev

## Story

As a developer,
I want the AuthService to handle logout,
so that sessions can be terminated.

## Acceptance Criteria

1. **Given** a valid accessToken
   **When** `AuthService.logout(accessToken)` is called
   **Then** it verifies the access token
   **Then** it extracts user_id
   **Then** it deletes refresh token from DB by user_id (PostgreSQL first, per AD-17)
   **Then** it adds access token to Redis blacklist (TTL = token expiry) (Redis second, self-healing via TTL)
   **And** silently succeeds if token was already invalid/expired

## Tasks / Subtasks

- [ ] Task 1: Change `IAuthService.logout` port signature (AC: #1)
  - [ ] Update `src/common/ports/auth.port.ts` — change `logout(userId: string)` to `logout(accessToken: string)`
  - [ ] Update `src/modules/auth/auth.service.ts` — change `logout(_userId: string)` stub parameter to `_accessToken: string`

- [ ] Task 2: Add `deleteRefreshTokenByUserId` to `ITokenService` port and implementation (AC: #1)
  - [ ] Add `deleteRefreshTokenByUserId(userId: string): Promise<void>` to `src/common/ports/token.port.ts`
  - [ ] Implement in `src/modules/token/token.service.ts` — `DELETE FROM auth_tokens WHERE user_id = $1`

- [ ] Task 3: Add `blacklistToken` to `ITokenService` port and implementation (AC: #1)
  - [ ] Add `blacklistToken(token: string, userId: string): Promise<void>` to `src/common/ports/token.port.ts`
  - [ ] Implement in `src/modules/token/token.service.ts` — decode JWT to extract `exp`, calculate remaining TTL, store in Redis via `SET blacklist:{token} {expires_at, user_id} EX {ttl_seconds}`

- [ ] Task 4: Create Redis module/client integration (AC: #1)
  - [ ] Create `src/modules/redis/redis.module.ts` — NestJS module providing Redis client
  - [ ] Create `src/modules/redis/redis.service.ts` — wraps `ioredis` client with `set`, `get`, `del` methods
  - [ ] Register `RedisModule` in `TokenModule` imports (or as global module)
  - [ ] Inject Redis client into `TokenService` for blacklist operations

- [ ] Task 5: Implement `AuthService.logout()` method (AC: #1)
  - [ ] Wrap entire method in try/catch — catch all errors and return void silently
  - [ ] Call `tokenService.verifyAccessToken(accessToken)` to verify and extract userId
  - [ ] Call `tokenService.deleteRefreshTokenByUserId(userId)` — PostgreSQL first (AD-17)
  - [ ] Call `tokenService.blacklistToken(accessToken, userId)` — Redis second, best-effort
  - [ ] Log success at info level, log failures at warn level (never throw)

- [ ] Task 6: Update mock for `auth.service.spec.ts` logout test (AC: #1)
  - [ ] Update `mockTokenService` to include `deleteRefreshTokenByUserId` and `blacklistToken` mocks
  - [ ] Remove the `'Not implemented'` throw test for logout

- [ ] Task 7: Add unit tests for `AuthService.logout()` (AC: #1)
  - [ ] Test happy path: valid token → verify called, delete called, blacklist called, returns void
  - [ ] Test invalid/expired token: `verifyAccessToken` throws → silently returns void
  - [ ] Test DB failure: `deleteRefreshTokenByUserId` throws → log warning, return void (best-effort)
  - [ ] Test Redis failure: `blacklistToken` throws → log warning, return void (best-effort)
  - [ ] Test both DB and Redis fail → still return void (graceful degradation)

- [ ] Task 8: Add unit tests for `TokenService.deleteRefreshTokenByUserId` and `blacklistToken` (AC: #1)
  - [ ] Test `deleteRefreshTokenByUserId` executes correct DELETE query
  - [ ] Test `blacklistToken` decodes JWT, extracts expiry, sets Redis key with correct TTL
  - [ ] Test `blacklistToken` handles Redis connection failure gracefully

## Dev Notes

### Existing Code Context

**Current `auth.service.ts` (src/modules/auth/auth.service.ts):**

- Lines 100-102: `logout` stub throws `'Not implemented'` — replace this
- Constructor injects `IUserService` (via `USER_SERVICE`) and `ITokenService` (via `TOKEN_SERVICE`)
- Follows existing patterns: structured logging with `this.logger`, try/catch error handling

**Current `IAuthService` port (src/common/ports/auth.port.ts):**

- Line 9: `logout(userId: string): Promise<void>` — **must change** to `logout(accessToken: string)`
- The AC explicitly states the method takes the access token, verifies it internally, and extracts userId

**Current `ITokenService` port (src/common/ports/token.port.ts):**

- Has `verifyAccessToken(token: string): Promise<{ userId: string }>` — already implemented
- Missing: `deleteRefreshTokenByUserId(userId)` and `blacklistToken(token, userId)` — need to add

**Current `TokenService` implementation (src/modules/token/token.service.ts):**

- `verifyAccessToken` (lines 52-95): fully implemented, verifies JWT signature and returns `{ userId }`
- `storeToken` (lines 37-50): uses raw SQL query — follow same pattern for delete
- Has access to `authTokenRepository` (TypeORM Repository<AuthToken>) for PostgreSQL operations
- Does NOT currently have Redis access — needs Redis client injected

**Current `auth.service.spec.ts` (src/modules/auth/**tests**/auth.service.spec.ts):**

- Lines 264-270: logout test expects `'Not implemented'` throw — must replace
- `mockTokenService` (lines 22-26): needs `deleteRefreshTokenByUserId` and `blacklistToken` added

**Current `auth.controller.ts` (src/modules/auth/auth.controller.ts):**

- No logout endpoint yet — Story 6.2 will add it. This story is service logic only.

**Redis state:**

- `ioredis` v5.11.1 is in `package.json` dependencies — already installed
- `REDIS_URL` is validated in `env.validator.ts` (line 6) — env config exists
- **No Redis module/service exists** — must create `src/modules/redis/`

**Transaction pattern (src/shared/transaction/transaction.ts):**

- `createTransaction(dataSource, callback)` available for wrapped DB operations
- The sequence diagram shows logout using a transaction for the DELETE operation
- However, since logout is a simple single-statement DELETE (not multi-step), a transaction is optional but can be used for consistency with the diagram

### Project Structure Notes

```
src/modules/
├── auth/
│   ├── auth.service.ts              ← MODIFY (implement logout)
│   ├── auth.module.ts               ← NO CHANGE (DI already wired for token)
│   └── __tests__/
│       └── auth.service.spec.ts     ← MODIFY (replace logout stub test)
├── token/
│   ├── token.service.ts             ← MODIFY (add deleteRefreshTokenByUserId, blacklistToken)
│   ├── token.module.ts              ← MODIFY (add Redis import/provider)
│   ├── auth-token.entity.ts         ← NO CHANGE
│   └── __tests__/
│       └── token.service.spec.ts    ← MODIFY (add new method tests)
├── redis/                           ← NEW MODULE
│   ├── redis.module.ts              ← CREATE
│   └── redis.service.ts             ← CREATE
└── ...existing modules...
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6: Logout Flow]
- [Source: _bmad-output/planning-artifacts/architecture.md#5.4 Logout Flow]
- [Source: _bmad-output/planning-artifacts/approved/04-sequence-logout.mmd]
- [Source: _bmad-output/planning-artifacts/approved/04-redis-blacklist.mmd]
- [Source: src/modules/auth/auth.service.ts (current logout stub)]
- [Source: src/common/ports/auth.port.ts (IAuthService interface)]
- [Source: src/common/ports/token.port.ts (ITokenService interface)]
- [Source: src/modules/token/token.service.ts (verifyAccessToken implementation)]
- [Source: src/shared/exceptions/authentication.exception.ts (TokenExpiredException, TokenInvalidSignatureException)]
- [Source: src/shared/transaction/transaction.ts (createTransaction pattern)]
- [Source: src/modules/auth/**tests**/auth.service.spec.ts (existing test patterns)]

### Port Interface Change Required

**Why the signature must change:**

The current `IAuthService.logout(userId: string)` takes a userId, but the epic AC says:

- `AuthService.logout(accessToken)` — takes the raw access token
- "it verifies the access token" — verification happens inside the method
- "it extracts user_id" — extraction happens inside the method

This is a **breaking change** to the port interface. No other code currently calls `logout()` (it's a stub), so the change is safe.

**Updated `IAuthService` (src/common/ports/auth.port.ts):**

```typescript
export interface IAuthService {
  register(dto: RegisterDto): Promise<TokenResponseDto>;
  login(dto: LoginDto): Promise<TokenResponseDto>;
  refresh(refreshToken: string): Promise<TokenResponseDto>;
  logout(accessToken: string): Promise<void>; // CHANGED from userId
}
```

### ITokenService Port Extensions

Add two new methods to `src/common/ports/token.port.ts`:

```typescript
export interface ITokenService {
  generateTokenPair(userId: string): Promise<TokenResponseDto>;
  storeToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  verifyAccessToken(token: string): Promise<{ userId: string }>;
  deleteRefreshTokenByUserId(userId: string): Promise<void>; // NEW
  blacklistToken(token: string, userId: string): Promise<void>; // NEW
}
```

### Redis Blacklist Key Pattern

Per architecture.md and `04-redis-blacklist.mmd`:

```
Key:   blacklist:{raw_access_token}
Value: { "expires_at": "ISO-8601", "user_id": "uuid" }
TTL:   Remaining seconds until token expiry (exp - now)
```

**TTL Calculation:**

1. Decode the JWT payload to extract `exp` (Unix timestamp)
2. Calculate `remainingTtl = exp - Math.floor(Date.now() / 1000)`
3. If `remainingTtl <= 0`, skip blacklisting (token already expired)
4. Use `SET key value EX remainingTtl` (ioredis supports EX parameter)

**Note:** The architecture diagram shows `blacklist:{token_jti}` but the JWT payload (JwtPayload type) does not currently include a `jti` claim. Use the full raw token as the key instead, which is what the diagram also references in the Redis operations section (`blacklist:{access_token}`).

### AD-17: Operation Order

The order matters and is explicitly documented:

1. **PostgreSQL FIRST** — Delete refresh token from `auth_tokens` by user_id
2. **Redis SECOND** — Add access token to blacklist (best-effort)

**Rationale:** If Redis fails after PostgreSQL succeeds, the refresh token is already revoked (session terminated from DB side). The access token remains valid until natural expiry — self-healing via TTL. This is acceptable because:

- The refresh token is the long-lived credential (7 days)
- The access token is short-lived (1 day default)
- The worst case: access token works for up to 1 more day, but refresh is dead

### Silent Success for Invalid/Expired Tokens

The `logout()` method must **never throw** for invalid or expired tokens. This is critical for UX — logout should always "work" from the user's perspective.

**Implementation pattern:**

```typescript
async logout(accessToken: string): Promise<void> {
  try {
    // 1. Verify token — if invalid/expired, catch will handle
    const { userId } = await this.tokenService.verifyAccessToken(accessToken);

    // 2. Delete refresh token from DB (PostgreSQL first)
    await this.tokenService.deleteRefreshTokenByUserId(userId);

    // 3. Blacklist access token (Redis second, best-effort)
    await this.tokenService.blacklistToken(accessToken, userId).catch((err) => {
      this.logger.warn(`Redis blacklist failed (best-effort): ${err.message}`);
    });

    this.logger.log(`Logout successful for user: ${userId}`);
  } catch (error) {
    // Token invalid/expired OR DB failure — log and return silently
    this.logger.warn(`Logout completed (token may be invalid/expired): ${(error as Error).message}`);
  }
}
```

### Redis Module Design

Since `ioredis` is already a dependency and `REDIS_URL` is validated, create a minimal Redis module:

**`src/modules/redis/redis.service.ts`:**

```typescript
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
    this.client.on('error', (err) =>
      this.logger.error('Redis connection error', err),
    );
    this.client.on('connect', () => this.logger.log('Redis connected'));
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    if (expirySeconds) {
      await this.client.set(key, value, 'EX', expirySeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
```

**`src/modules/redis/redis.module.ts`:**

```typescript
import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: RedisService,
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        return new RedisService(redisUrl);
      },
      inject: [ConfigService],
    },
  ],
  exports: [RedisService],
})
export class RedisModule {}
```

**Note:** Making `RedisModule` global allows any module to inject `RedisService` without explicit imports. Register it in `AppModule` imports alongside other global modules.

### TokenService — deleteRefreshTokenByUserId

```typescript
async deleteRefreshTokenByUserId(userId: string): Promise<void> {
  await this.authTokenRepository.query(
    'DELETE FROM auth_tokens WHERE user_id = $1',
    [userId],
  );
  this.logger.debug(`Refresh token deleted for user ${userId}`);
}
```

### TokenService — blacklistToken

```typescript
async blacklistToken(token: string, userId: string): Promise<void> {
  try {
    // Decode JWT to extract exp
    const parts = token.split('.');
    if (parts.length !== 3) return; // malformed — skip

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const exp = payload.exp as number;
    if (!exp) return; // no expiry — skip

    const now = Math.floor(Date.now() / 1000);
    const remainingTtl = exp - now;
    if (remainingTtl <= 0) return; // already expired — skip

    const blacklistKey = `blacklist:${token}`;
    const blacklistValue = JSON.stringify({
      expires_at: new Date(exp * 1000).toISOString(),
      user_id: userId,
    });

    await this.redisService.set(blacklistKey, blacklistValue, remainingTtl);
    this.logger.debug(`Token blacklisted for user ${userId}, TTL: ${remainingTtl}s`);
  } catch (error) {
    this.logger.warn(`Token blacklisting failed (best-effort): ${(error as Error).message}`);
    // Don't throw — blacklisting is best-effort
  }
}
```

### Implementation Pattern

Follow existing conventions from `register()` and `login()`:

- Use `this.logger.log()` for success, `this.logger.warn()` for failures
- Inject services via `@Inject(TOKEN_SERVICE)` tokens (already wired)
- Return `Promise<void>` consistently
- Use `.catch()` for best-effort operations (Redis blacklisting)
- Never log raw tokens — log userId only

### Testing Approach

**Unit tests for `AuthService.logout()` in `auth.service.spec.ts`:**

| Scenario              | Input                                                                                 | Expected                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Valid token logout    | `'valid-jwt-token'`                                                                   | `verifyAccessToken` called, `deleteRefreshTokenByUserId` called with userId, `blacklistToken` called, returns void |
| Invalid/expired token | `'expired-jwt-token'`                                                                 | `verifyAccessToken` throws → returns void silently (no DB/Redis calls)                                             |
| DB failure            | `verifyAccessToken` succeeds but `deleteRefreshTokenByUserId` throws                  | Log warning, returns void (blacklist NOT attempted)                                                                |
| Redis failure         | `verifyAccessToken` and `deleteRefreshTokenByUserId` succeed, `blacklistToken` throws | Log warning, returns void                                                                                          |
| Both fail             | `verifyAccessToken` succeeds, both DB and Redis fail                                  | Log warning, returns void                                                                                          |
| Empty/malformed token | `''` or `'not-a-jwt'`                                                                 | `verifyAccessToken` throws → returns void silently                                                                 |

**Mock setup update:**

```typescript
const mockTokenService = () => ({
  generateTokenPair: jest.fn(),
  storeToken: jest.fn(),
  verifyAccessToken: jest.fn(),
  deleteRefreshTokenByUserId: jest.fn(), // NEW
  blacklistToken: jest.fn(), // NEW
});
```

**Unit tests for `TokenService.deleteRefreshTokenByUserId`:**

- Test DELETE query executed with correct userId
- Test handles case where no row exists (DELETE returns 0 affected rows — no error)

**Unit tests for `TokenService.blacklistToken`:**

- Test valid JWT → Redis SET called with correct key, value, and TTL
- Test malformed JWT → skip silently (no Redis call)
- Test expired JWT (remainingTtl <= 0) → skip silently
- Test Redis connection failure → log warning, don't throw

### Dependencies

- **Depends on:** Epic 4 (login flow — `verifyAccessToken` must be implemented, tokens must be generatable)
- **Depends on:** `ioredis` package (already in `package.json`)
- **Blocks:** Story 6.2 (Auth Controller — Logout Endpoint) depends on this service method

### Security Considerations

- **Token verification first:** Always verify before attempting revocation — prevents abuse
- **PostgreSQL before Redis:** Per AD-17, DB is source of truth for session revocation
- **TTL self-healing:** Redis blacklist entries auto-expire with the token — no manual cleanup needed
- **No token logging:** Never log raw access tokens — log userId only
- **Best-effort Redis:** Redis failure should NOT prevent logout from succeeding — DB revocation is sufficient

---

## Retrospective

**Epic 6 Retrospective:** [epic-6-retrospective.md](./epic-6-retrospective.md)
**Status:** Done — reviewed 2026-07-16
