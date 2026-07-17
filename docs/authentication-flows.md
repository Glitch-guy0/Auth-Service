# Authentication Flows

## 1. Overview

This document describes the four core authentication flows in AuthService, plus the Auth Guard that protects routes. Each flow is backed by an approved Mermaid sequence diagram.

**Token Strategy**

| Token | Type | Signing | Expiry | Storage |
|-------|------|---------|--------|---------|
| Access | JWT | RSA (kid-based key rotation) | 1 day | httpOnly cookie + Authorization header |
| Refresh | opaque (bcrypt-hashed) | RSA-signed JWT | 7 days | httpOnly cookie + `auth_tokens` table (hashed) |

**Key Invariants**

- Single session per user: `auth_tokens.user_id` is the primary key. A new login replaces the previous refresh token.
- Refresh tokens are stored as bcrypt hashes (salt rounds: 12). Raw tokens are never persisted.
- Access token revocation uses a Redis blacklist with TTL matching token expiry. Blacklist failures are best-effort (fail-open).
- Demographics are logged asynchronously to MongoDB. Failures are silently discarded.

**Flows**

| Flow | Diagram | Service Method |
|------|---------|---------------|
| Registration | [Registration Sequence](diagrams/01-sequence-registration.mmd) | `register()` |
| Login | [Login Sequence](diagrams/02-sequence-login.mmd) | `login()` |
| Token Refresh | [Refresh Sequence](diagrams/03-sequence-refresh.mmd) | `refresh()` |
| Logout | [Logout Sequence](diagrams/04-sequence-logout.mmd) | `logout()` |
| Auth Guard | [Auth Guard Sequence](diagrams/11-sequence-auth-guard.mmd) | `JwtAuthGuard.canActivate()` |

---

## 2. Registration Flow

**Source:** `src/modules/auth/auth.service.ts` — `register()`
**Diagram:** [Registration Sequence](diagrams/01-sequence-registration.mmd)

### Steps

1. **Validate input** — `RegisterSchema.parse()` enforces username, email, and password constraints.
2. **Check uniqueness** — Parallel lookup by username and email via `UserService`. Either match returns 409.
3. **Hash password** — bcrypt with 12 salt rounds.
4. **Create user (Transaction 1)** — Insert into `users` table within a database transaction. Auto-commits on success.
5. **Generate token pair** — RSA-signed access token (JWT) + opaque refresh token. Uses `KeyManager` for the current private key.
6. **Store refresh token (Transaction 2)** — Hash the refresh token with bcrypt, insert into `auth_tokens` with a 7-day expiry. Separate transaction from user creation.
7. **Set cookie** — Controller sets `Set-Cookie` header (httpOnly, secure, sameSite=strict).
8. **Async demographics** — `logDemographics()` fires and forgets. Failure is silently caught.

### Error Cases

| Condition | HTTP Status | Exception |
|-----------|------------|-----------|
| Duplicate username | 409 | `UserExistsException` |
| Duplicate email | 409 | `UserExistsException` |

---

## 3. Login Flow

**Source:** `src/modules/auth/auth.service.ts` — `login()`
**Diagram:** [Login Sequence](diagrams/02-sequence-login.mmd)

### Steps

1. **Validate input** — `LoginSchema.parse()` enforces `usernameOrEmail` and `password`.
2. **Lookup user** — If the input contains `@`, look up by email; otherwise by username.
3. **Check blocked** — If `user.blocked` is true, return 403.
4. **Verify password** — `bcrypt.compare()` against the stored hash.
5. **Generate token pair** — Same RSA signing flow as registration.
6. **Upsert token (ON CONFLICT)** — Because `user_id` is the PK, a new login replaces any existing refresh token for that user.
7. **Set cookie** — httpOnly, secure, sameSite=strict.
8. **Async demographics** — Fire-and-forget.

### Error Cases

| Condition | HTTP Status | Exception |
|-----------|------------|-----------|
| User not found | 401 | `InvalidCredentialsException` |
| Wrong password | 401 | `InvalidCredentialsException` |
| User blocked | 403 | `UserBlockedException` |

---

## 4. Token Refresh Flow

**Source:** `src/modules/auth/auth.service.ts` — `refresh()`
**Diagram:** [Refresh Sequence](diagrams/03-sequence-refresh.mmd)

### Steps

1. **Extract cookie** — Controller reads the refresh token from the httpOnly cookie.
2. **Verify JWT signature** — Decode the JWT header to extract `kid`, fetch the corresponding public key from `KeyManager`, and verify the RSA signature.
3. **Fetch token hash** — Query `auth_tokens` by `user_id` extracted from the verified JWT payload.
4. **Bcrypt compare** — Compare the raw refresh token against the stored hash using a linear scan.
5. **Check expiry** — Verify `expires_at` has not passed.
6. **Check user blocked** — Fetch user by ID; return 403 if blocked.
7. **Generate new tokens** — Fresh access + refresh token pair with new expiry timestamps.
8. **Update DB** — Replace the stored hash and expiry in `auth_tokens` (single-session constraint).
9. **Set new cookie** — Updated httpOnly cookie in the response.

### Error Cases

| Condition | HTTP Status | Exception |
|-----------|------------|-----------|
| Invalid JWT signature | 401 | `TokenInvalidSignatureException` |
| Token not found (revoked) | 401 | `InvalidCredentialsException` |
| Refresh token expired | 401 | `TokenExpiredException` |
| Hash mismatch (tampered) | 401 | `InvalidCredentialsException` |
| User blocked | 403 | `UserBlockedException` |

---

## 5. Logout Flow

**Source:** `src/modules/auth/auth.service.ts` — `logout()`
**Diagrams:** [Logout Sequence](diagrams/04-sequence-logout.mmd), [Redis Blacklist](diagrams/04-redis-blacklist.mmd)

### Steps

1. **Extract access token** — Read from the `Authorization: Bearer` header.
2. **Verify access token** — Decode and verify the JWT signature to extract `userId`. If invalid or expired, the logout still completes silently (the outer try/catch guarantees this).
3. **Delete refresh token (Transaction)** — Remove the row from `auth_tokens` for this `user_id`. This is the authoritative revocation step — without a valid refresh token, no new access tokens can be issued.
4. **Blacklist access token (best-effort)** — Write to Redis with key `blacklist:{access_token}` and TTL matching the token's remaining expiry. Redis failures are caught and logged as warnings; the logout succeeds regardless.
5. **Clear cookie** — Controller issues a `Clear-Cookie` header for the refresh token.

### Design Decision: PostgreSQL-First, Redis-Second

The refresh token deletion in PostgreSQL is the authoritative logout action. The Redis blacklist is a secondary, best-effort layer that short-circuits already-issued access tokens before their natural 1-day expiry. If Redis is unavailable, the access token remains valid until it expires naturally, but no new tokens can be issued because the refresh token has been deleted. This ordering (AD-17) ensures logout never fails due to Redis downtime.

### Error Cases

The logout flow is designed to always return 200 OK. Invalid or expired access tokens are silently handled. Database failures during refresh token deletion are logged but do not propagate. Redis blacklist failures are caught via `.catch()` and logged as warnings.

---

## 6. Auth Guard Flow (Protected Routes)

**Source:** `src/modules/auth/auth.middleware.ts`, `src/modules/auth/guards/jwt-auth.guard.ts`
**Diagram:** [Auth Guard Sequence](diagrams/11-sequence-auth-guard.mmd)

### Pipeline

The guard operates as a two-stage pipeline:

**Stage 1 — Middleware** (`AuthMiddleware`)
- Extracts the Bearer token from the `Authorization` header.
- Attaches it to the request context as `accessToken`.

**Stage 2 — Guard** (`JwtAuthGuard`)
1. **Check presence** — If no token is present, throw 401.
2. **Verify JWT signature** — Decode the header to get `kid`, fetch the matching public key from `KeyManager`, verify the RSA signature.
3. **Check blacklist** — Query Redis for `blacklist:{token}`. If Redis is unreachable, the check is skipped (fail-open).
4. **Check expiry** — Handled automatically by `jwt.verify()`.
5. **Attach user** — Set `request.user = { userId }` for downstream handlers.

### Error Cases

| Condition | HTTP Status | Exception |
|-----------|------------|-----------|
| Missing token | 401 | `UnauthorizedException` |
| Invalid signature | 401 | `UnauthorizedException` |
| Token revoked (blacklisted) | 401 | `UnauthorizedException` |
| Token expired | 401 | `UnauthorizedException` |

### Fail-Open Redis

The blacklist check implements fail-open semantics: if Redis is unreachable, the guard logs a warning and allows the request through. This prevents a Redis outage from locking all users out of protected routes. The worst case is that a revoked access token remains valid until its natural 1-day expiry.
