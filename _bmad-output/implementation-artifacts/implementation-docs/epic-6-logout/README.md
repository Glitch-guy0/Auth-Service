# Epic 6: Logout Flow — Implementation Documentation

## Story 6.1: AuthService — Logout Logic

### Overview

`AuthService.logout(accessToken)` orchestrates the complete logout flow. It verifies the incoming access token, deletes the associated refresh token from PostgreSQL, and blacklists the access token in Redis. The service silently succeeds if the token was already invalid or expired, ensuring idempotent behavior across concurrent or duplicate logout requests.

### Architecture References

| AD | Title | Relevance |
|----|-------|-----------|
| AD-7 | Logout accessToken-only with Redis Blacklist | Defines the dual-phase invalidation strategy: access token blacklisted in Redis, refresh token deleted from DB. No refresh token required from the client. |
| AD-17 | Cross-Database Mutation Ordering | Enforces that the PostgreSQL mutation (refresh token deletion) executes **before** the Redis mutation (blacklist insertion). This ordering prevents a race condition where a stolen access token could still be used to obtain a new refresh token between the two operations. |

### Acceptance Criteria

- [ ] Verifies the access token signature and expiry via `TokenService`.
- [ ] Extracts `user_id` from the verified token payload.
- [ ] Deletes the refresh token from the `auth_tokens` table by `user_id` (**PostgreSQL first**, per AD-17).
- [ ] Adds the access token to the Redis blacklist with `TTL = token expiry` (Redis second; self-healing via native JWT `exp` claim).
- [ ] Silently succeeds (returns success) if the token was already invalid, expired, or not found in the database.

### Test Acceptance Criteria

- [ ] **Happy path**: Valid token results in refresh token deletion from PostgreSQL and access token added to Redis blacklist with correct TTL.
- [ ] **Expired token**: Returns success without database or Redis mutations.
- [ ] **Invalid token (bad signature)**: Returns success without database or Redis mutations.
- [ ] **Token not in DB**: Refresh token already absent — logout still completes and blacklists the access token.
- [ ] **Redis failure**: Blacklist insertion fails — logout still returns success (non-blocking; self-healing via JWT `exp`). Verify no exception propagates to the caller.
- [ ] **Ordering invariant**: Verify PostgreSQL delete is called before Redis blacklist insert (mock both and assert call order).
- [ ] **TTL correctness**: Redis blacklist entry TTL matches the remaining expiry of the access token.

### Implementation Guidance

Follow the flow defined in **AD-17** strictly:

```
1. TokenService.verify(accessToken)
   └─→ If invalid/expired → return success (no-op)
2. Extract user_id from decoded payload
3. Delete refresh token from auth_tokens WHERE user_id = ?  [PostgreSQL — first]
4. Blacklist access token in Redis with TTL = token.exp - now()  [Redis — second]
```

**Key considerations:**

- **PostgreSQL first (AD-17):** The DB mutation must complete before the Redis mutation begins. This is a hard ordering constraint, not a suggestion.
- **Redis failure is non-blocking:** If the Redis `set` call throws, swallow the error and return success. The access token will naturally expire via its `exp` claim (self-healing).
- **Idempotency:** If the access token is already blacklisted or the refresh token is already deleted, treat it as success. No partial-failure semantics.
- **TTL calculation:** Compute `ttl = decodedToken.exp - Math.floor(Date.now() / 1000)`. Clamp to a minimum of 0 to avoid negative TTL errors from Redis.

### Dependencies

- `TokenService` — for access token verification and decoding.
- `PrismaClient` (PostgreSQL) — for refresh token deletion.
- `RedisClient` — for blacklist insertion.

---

## Story 6.2: Auth Controller — Logout Endpoint

### Overview

Exposes `POST /auth/v1/logout` — the HTTP entry point for logout. Reads the access token from the `Authorization: Bearer <token>` header, delegates to `AuthService.logout()`, clears the refresh token cookie, and returns a 200 response with Swagger documentation.

### Architecture References

| AD | Title | Relevance |
|----|-------|-----------|
| AD-11 | Zod Validation | The endpoint must validate incoming request shape (headers) using Zod before processing. Ensures consistent error responses for malformed requests. |

### Acceptance Criteria

- [ ] Reads the access token from the `Authorization` header as a Bearer token.
- [ ] Validates the request via Zod schema (AD-11).
- [ ] Deletes refresh token from DB first, then blacklists access token in Redis (delegated to `AuthService.logout()` per AD-17).
- [ ] Clears the refresh token cookie by setting `Set-Cookie` with an expired date.
- [ ] Returns HTTP 200 with a success body.
- [ ] Has Swagger/OpenAPI decorators for documentation (`@ApiTags`, `@ApiOperation`, `@ApiBearerAuth`, etc.).

### Test Acceptance Criteria

- [ ] **Valid Bearer token**: Returns 200 and delegates to `AuthService.logout()`.
- [ ] **Missing Authorization header**: Returns 400/401 per Zod validation error shape.
- [ ] **Malformed Authorization header** (e.g., `Basic <token>`): Returns validation error.
- [ ] **Refresh cookie is cleared**: Response contains `Set-Cookie` header with `refresh_token=; Expires=...` (past date).
- [ ] **Swagger decorators present**: Endpoint appears in Swagger UI with correct tags, auth scheme, and operation description.
- [ ] **AuthService failure**: If `AuthService.logout()` throws unexpectedly, returns 500 (or appropriate error shape per global exception filter).

### Implementation Guidance

**Request flow:**

```
1. Extract Bearer token from Authorization header
   └─→ If missing/malformed → return validation error (AD-11)
2. Call AuthService.logout(token)
3. Clear refresh token cookie via Set-Cookie header
4. Return 200
```

**Cookie clearing pattern:**

```typescript
response.cookie('refresh_token', '', {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  expires: new Date(0),  // epoch = expired
});
```

**Swagger decorators (NestJS example):**

```typescript
@UseGuards(AccessTokenGuard)  // if token verification is done at controller level
@Post('logout')
@HttpCode(200)
@ApiOperation({ summary: 'Logout user and invalidate tokens' })
@ApiBearerAuth()
@ApiTags('Auth')
async logout(@Req() req, @Res({ passthrough: true }) res: Response) {
  // implementation
}
```

**Key considerations:**

- **Token extraction:** Use a consistent pattern to extract the Bearer token. Do not pass the full `Authorization` header value to `AuthService` — strip the `Bearer ` prefix.
- **Cookie clearing is mandatory:** Even though the DB refresh token is deleted, the client cookie must also be cleared to prevent stale cookies from being sent on subsequent requests.
- **Passthrough response:** If using NestJS with `@Res({ passthrough: true })`, ensure the 200 status code is set explicitly via `@HttpCode(200)`.

### Dependencies

- `AuthService.logout()` — from Story 6.1.
- `AccessTokenGuard` — if token verification is handled at the guard level rather than inside the service.
- Zod schema — for request validation (AD-11).
