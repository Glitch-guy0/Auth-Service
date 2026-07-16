# Story 5.1: AuthService — Refresh Logic

Status: ready-for-dev

## Story

As a developer,
I want the AuthService to handle token refresh,
so that users can maintain sessions.

## Acceptance Criteria

1. **Given** a valid refresh token
   **When** `AuthService.refresh(refreshToken)` is called
   **Then** it verifies JWT signature
   **Then** it queries auth_tokens by user_id (O(1))
   **Then** it compares bcrypt hash
   **Then** it updates the token in DB
   **And** returns `{accessToken, refreshToken}`

## Tasks / Subtasks

- [ ] Task 1: Reconcile Refresh Token Format (AC: #1)
  - [ ] Subtask 1.1: Analyze current `generateRefreshToken()` in `token.service.ts` — it uses `crypto.randomBytes(64).toString('hex')` producing an opaque hex string, NOT a JWT
  - [ ] Subtask 1.2: Decide approach — either (A) change refresh tokens to JWTs to align with AC "verifies JWT signature" and O(1) user_id lookup, or (B) add a `getTokenByHash()` method with sequential bcrypt scan (violates O(1) AC)
  - [ ] Subtask 1.3: If choosing approach (A), update `generateRefreshToken()` in `token.service.ts` to produce a signed JWT with `{ sub: userId, exp: 7d }` using the same RSA key pair, and update `ITokenService` port to include `verifyRefreshToken(token: string): Promise<{ userId: string }>`
  - [ ] Subtask 1.4: If choosing approach (B), add `getTokenByHash(tokenHash: string): Promise<AuthToken | null>` to `ITokenService` port

- [ ] Task 2: Add `getTokenByUserId` to ITokenService (AC: #1)
  - [ ] Subtask 2.1: Add `getTokenByUserId(userId: string): Promise<{ tokenHash: string; expiresAt: Date } | null>` to `src/common/ports/token.port.ts`
  - [ ] Subtask 2.2: Implement in `src/modules/token/token.service.ts` — query `auth_tokens` by PK (user_id), return token_hash and expires_at

- [ ] Task 3: Implement `AuthService.refresh()` (AC: #1)
  - [ ] Subtask 3.1: Extract user_id from refresh token (via JWT decode if approach A, or via token_hash lookup if approach B)
  - [ ] Subtask 3.2: Query `auth_tokens` by user_id via `tokenService.getTokenByUserId(userId)`
  - [ ] Subtask 3.3: Check token expiry — if `expires_at < now`, throw `TokenExpiredException`
  - [ ] Subtask 3.4: Compare raw refresh token against stored bcrypt hash via `bcrypt.compare(refreshToken, storedHash)`
  - [ ] Subtask 3.5: If hash mismatch, throw `InvalidCredentialsException`
  - [ ] Subtask 3.6: Generate new token pair via `tokenService.generateTokenPair(userId)`
  - [ ] Subtask 3.7: Hash new refresh token with bcrypt (cost=12) and UPSERT via `tokenService.storeToken(userId, newHash, expiresAt)`
  - [ ] Subtask 3.8: Return new `TokenResponseDto`

- [ ] Task 4: Add tests in `src/modules/auth/__tests__/auth.service.spec.ts` (AC: #1)
  - [ ] Subtask 4.1: Mock `tokenService.getTokenByUserId` (and `verifyRefreshToken` if approach A)
  - [ ] Subtask 4.2: Test: valid refresh token → returns new TokenResponseDto
  - [ ] Subtask 4.3: Test: expired token in DB → throws TokenExpiredException
  - [ ] Subtask 4.4: Test: missing token in DB (null result) → throws InvalidCredentialsException
  - [ ] Subtask 4.5: Test: bcrypt hash mismatch → throws InvalidCredentialsException
  - [ ] Subtask 4.6: Test: new token pair is generated and stored via UPSERT
  - [ ] Subtask 4.7: Test: verify bcrypt.hash called with new refresh token and BCRYPT_SALT_ROUNDS (12)

## Dev Notes

### Critical Design Decision: Refresh Token Format

**Conflict found during code analysis.** The AC states "verifies JWT signature" and "queries auth_tokens by user_id (O(1))", implying the refresh token is a JWT that can be decoded to extract `sub` (user_id). However, the current implementation tells a different story:

**Current `token.service.ts:131-145` — `generateRefreshToken()`:**

```typescript
private async generateRefreshToken(): Promise<RefreshTokenResult> {
  const bytes = this.configService.get<number>('REFRESH_TOKEN_BYTES', 64);
  const saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS', 10);
  const rawToken = crypto.randomBytes(bytes).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, saltRounds);
  return { rawToken, tokenHash };
}
```

The refresh token is an **opaque random hex string** (128 chars), NOT a JWT. This creates a fundamental problem:

1. **O(1) user_id lookup is impossible** with opaque tokens — the `auth_tokens` table has `user_id` as PK, not `token_hash`. To find a user by opaque token, you'd need to scan all rows and bcrypt.compare each (O(n)).
2. **JWT signature verification is impossible** — there's no JWT to verify.

**Recommended approach:** Change refresh tokens to JWTs. This aligns with:

- AC requirement: "verifies JWT signature"
- AC requirement: "queries auth_tokens by user_id (O(1))"
- Architecture: access tokens already use RSA-signed JWTs via `jose`

**If choosing JWT approach**, `generateRefreshToken()` in `token.service.ts` must be updated to:

```typescript
// Pseudocode — refresh token becomes a JWT
async generateRefreshToken(userId: string): Promise<RefreshTokenResult> {
  const privateKey = await this.keyManager.getPrivateKey();
  const kid = this.configService.get<string>('KEY_KID');
  const privateKeyObject = await importPKCS8(privateKey, 'RS256');

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 7 * 24 * 60 * 60; // 7 days

  const jwt = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .setSubject(userId)
    .sign(privateKeyObject);

  const tokenHash = await bcrypt.hash(jwt, this.configService.get<number>('BCRYPT_SALT_ROUNDS', 10));
  return { rawToken: jwt, tokenHash };
}
```

**Dev agent: resolve this conflict before implementing. Document your decision in the Completion Notes.**

### Existing Code Context

#### Files to Modify

**`src/modules/auth/auth.service.ts`** (primary target)

- Lines 96-98: Replace `refresh()` stub (`throw new Error('Not implemented')`)
- Import exceptions: `TokenExpiredException`, `TokenRevokedException` already available from `../../shared/exceptions/authentication.exception`
- Follow the pattern established by `login()` (lines 59-93): hash → store → return
- Use `this.BCRYPT_SALT_ROUNDS = 12` and `this.REFRESH_TOKEN_EXPIRY_DAYS = 7` constants already defined
- The `register()` and `login()` methods both use the same token-store pattern: `bcrypt.hash` → `tokenService.storeToken(userId, hash, expiresAt)`

**`src/common/ports/token.port.ts`** (port interface)

- Current methods: `generateTokenPair`, `storeToken`, `verifyAccessToken`
- Needs new method(s) depending on design decision (see above)
- At minimum: `getTokenByUserId(userId: string): Promise<{ tokenHash: string; expiresAt: Date } | null>`
- If JWT approach: also `verifyRefreshToken(token: string): Promise<{ userId: string }>`

**`src/modules/token/token.service.ts`** (implementation)

- `generateRefreshToken()` at line 131 — may need modification (see design decision)
- `storeToken()` at line 37 — UPSERT pattern already works, no changes needed
- `verifyAccessToken()` at line 52 — reference for JWT verification pattern using `jose` library
- Uses `importSPKI`, `jwtVerify` from `jose` — same approach for refresh token verification
- Uses `keyManager.getPublicKey(kid)` and `keyManager.getPrivateKey()` — same for refresh tokens
- `generateAccessToken()` at line 97 — private method, reference for JWT signing pattern

**`src/modules/auth/__tests__/auth.service.spec.ts`** (test file)

- Lines 256-262: Current `refresh` test only asserts "Not implemented" — replace with real tests
- Mock pattern: `mockTokenService()` at line 22 — add new mocked methods
- Follow login test structure (lines 180-253) for setup patterns
- `bcrypt` is mocked globally at line 13: `jest.mock('bcrypt')`

#### Files for Reference (do not modify)

**`src/modules/token/auth-token.entity.ts`**

- `auth_tokens` table schema: `user_id` (UUID PK), `token_hash` (varchar 255), `expires_at` (timestamptz), `updated_at` (timestamptz)
- UPSERT: `INSERT ... ON CONFLICT (user_id) DO UPDATE` — one refresh token per user
- `user_id` is PK → O(1) lookup by user_id

**`src/shared/exceptions/authentication.exception.ts`**

- `InvalidCredentialsException` — 401, errorCode: `AUTH_INVALID_CREDENTIALS`
- `TokenExpiredException` — 401, errorCode: `TOKEN_EXPIRED`
- `TokenRevokedException` — 401, errorCode: `TOKEN_REVOKED`
- `TokenInvalidSignatureException` — 401, errorCode: `TOKEN_INVALID_SIGNATURE`

**`src/modules/auth/dto/token-response.dto.ts`**

```typescript
type TokenResponseDto = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};
```

**`src/types/jwt.types.ts`**

```typescript
interface JwtPayload {
  sub: string;
  iat: number;
  iss: string;
  kid: string;
  exp: number;
}
```

**`src/common/ports/key-manager.port.ts`**

```typescript
interface IKeyManager {
  getPublicKey(kid: string): Promise<string>;
  getPrivateKey(): Promise<string>;
}
```

### Project Structure Notes

- Hexagonal architecture: `AuthService` depends on ports (`ITokenService`, `IUserService`), not concrete implementations
- Injection tokens: `TOKEN_SERVICE` from `../../common/ports/token.token`, `USER_SERVICE` from `../../common/ports/user.token`
- JWT library: `jose` (already installed, used in `token.service.ts`)
- bcrypt cost: AuthService uses 12 rounds (`this.BCRYPT_SALT_ROUNDS = 12`), TokenService uses config (default 10) — AuthService should use its own constant (12) for refresh token hashing to stay consistent with login/register pattern
- `ITokenService` port is the boundary — `AuthService` must not directly access repositories

### Architecture Compliance

From `architecture.md` Section 5.3 (Token Refresh Flow):

```
POST /auth/v1/refresh
Cookie: refreshToken
1. Validate refresh token from cookie
2. Check if token exists in DB (not revoked)
3. Rotate: delete old + insert new
4. Generate new access token
5. Return { accessToken, refreshToken (new cookie) }
```

**Note:** Step 3 says "delete old + insert new" but the current `storeToken()` uses UPSERT (ON CONFLICT DO UPDATE). This is equivalent — the UPSERT replaces the old hash in-place. No delete needed.

**Redis blacklisting** is NOT used for refresh (architecture Section 3.3): `blacklist:{token_jti}` is for access tokens only during logout. Refresh simply rotates the token.

### Story Dependencies

- **Depends on:** Epic 4 (Login Flow) — `login()` and `register()` are implemented and working; `tokenService.generateTokenPair()`, `tokenService.storeToken()` are used
- **Blocks:** Story 5.2 (Auth Controller — Refresh Endpoint), Story 6.1 (Logout Logic)

### Previous Story Intelligence

From Story 4.2 (Login Logic):

- Login pattern: lookup user → validate → `generateTokenPair(userId)` → `bcrypt.hash(refreshToken, 12)` → `storeToken(userId, hash, expiresAt)` → return tokens
- Refresh should follow same pattern but: decode token → lookup stored hash → compare → generate new pair → store → return
- Login uses `Promise.all` for parallel lookups — refresh doesn't need this (single user_id lookup)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Retrospective

**Epic 5 Retrospective:** [epic-5-retrospective.md](./epic-5-retrospective.md)
**Status:** Done — reviewed 2026-07-16
