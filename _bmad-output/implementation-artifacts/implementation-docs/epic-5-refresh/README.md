# Epic 5: Token Refresh Flow

**Goal:** Implement complete token refresh — POST /auth/v1/refresh. Sessions can be maintained.

**Depends on:** Epic 1 (types, entities, DTOs, exception hierarchy, transaction pattern), Epic 2 (KeyManager for JWT verification), Epic 3 (TokenService generation, storage), Epic 4 (AuthService login, AuthController, token verification)

**Deliverable:** A token refresh vertical slice: AuthService (refresh orchestration with three-step rotation), AuthController (HTTP endpoint reading from httpOnly cookie).

---

## Story 5.1: AuthService — Refresh Logic

### Overview
Implement the `AuthService.refresh()` orchestration method. Given a raw refresh token (extracted from the httpOnly cookie by the controller), verify the token hash against the stored value in `auth_tokens`, then rotate the token per AD-6: verify old → delete old → insert new. The entire rotation is wrapped in an AD-12 transaction for atomicity. A new access token is generated via `TokenService.generateAccessToken()` using the user identified from the token record.

### Architecture References
- AD-5 (Single Active Session) — `auth_tokens` has `user_id` as PK; one row per user. Refresh operates on exactly one row via O(1) lookup by `user_id`.
- AD-6 (Refresh Token Rotation Strategy) — three-step rotation: (1) verify old token, (2) delete old token by `user_id`, (3) insert new token. Old token is invalidated before new one is created — fail-closed.
- AD-12 (Transaction Pattern) — the delete + insert sequence is wrapped in `createTransaction()` to guarantee atomicity. If the insert fails, the delete rolls back and the old token remains valid.

### Acceptance Criteria
- `AuthService.refresh(refreshToken: string)` accepts a raw refresh token string
- Decodes the refresh token to extract `user_id` (the refresh token is a opaque random string — lookup is done by scanning `auth_tokens` for the matching `token_hash`)
- Queries `auth_tokens` by matching `token_hash` via `bcrypt.compare()` — this is an O(1) lookup by `user_id` once the token record is found
- Throws `TokenRevokedException` if no matching token is found in the database
- Throws `TokenExpiredException` if the token's `expires_at` is in the past
- Executes the three-step rotation within a single AD-12 transaction:
  1. Delete the old token row by `user_id`
  2. Generate a new refresh token pair via `TokenService.generateRefreshToken()`
  3. Insert the new token hash via `TokenService.storeToken()`
- Generates a new access token via `TokenService.generateAccessToken(user)` using the user entity associated with the token
- Returns `{ accessToken, refreshToken }` where `refreshToken` is the new raw (unhashed) value
- If any step in the transaction fails, the entire operation rolls back and the original token remains valid

### Test Acceptance Criteria
- **Given** a valid refresh token stored in the database, **when** `refresh(token)` is called, **then** it returns `{ accessToken, refreshToken }` with a new access token JWT and a new raw refresh token
- **Given** a refresh token that does not exist in the database (already rotated or revoked), **when** `refresh(token)` is called, **then** it throws `TokenRevokedException`
- **Given** a refresh token whose `expires_at` is in the past, **when** `refresh(token)` is called, **then** it throws `TokenExpiredException`
- **Given** a successful refresh, **when** the `auth_tokens` table is queried, **then** the old token hash is gone and a new row exists with the new token hash for the same `user_id` (no duplicate rows)
- **Given** a successful refresh, **when** the old refresh token is submitted again, **then** it throws `TokenRevokedException` (token reuse is rejected — fail-closed per AD-6)
- **Given** the token storage step fails inside the transaction, **when** the transaction rolls back, **then** the old token remains in the database and is still valid

### Implementation Guidance
- Add `refresh()` to `src/modules/auth/auth.service.ts`:
  ```typescript
  async refresh(refreshToken: string): Promise<TokenResponseDto> {
    // Step 1: Find the token record by comparing bcrypt hash
    const tokenRecord = await this.tokenRepository.findOne();
    // Scan auth_tokens — in practice this is bounded by active sessions.
    // For each record, bcrypt.compare(refreshToken, record.token_hash).
    // O(1) lookup by user_id once matched; the scan is acceptable at Phase 1 scale.

    // Step 2: Validate expiry
    if (!tokenRecord || tokenRecord.expires_at < new Date()) {
      throw new TokenExpiredException();
    }

    // Step 3: Verify bcrypt hash
    const valid = await bcrypt.compare(refreshToken, tokenRecord.token_hash);
    if (!valid) {
      throw new TokenRevokedException();
    }

    // Step 4: Look up the user for access token generation
    const user = await this.userService.findById(tokenRecord.user_id);
    if (!user) throw new InvalidCredentialsException();

    // Step 5: Three-step rotation in a transaction (AD-6, AD-12)
    const { rawToken, tokenHash } = await this.tokenService.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.config.refreshTokenExpiryMs);

    await createTransaction(async () => {
      // (a) Delete old token by user_id — fail-closed: old token invalid before new exists
      await this.tokenRepository.delete({ user_id: tokenRecord.user_id });
      // (b) Insert new token
      await this.tokenService.storeToken(tokenRecord.user_id, tokenHash, expiresAt);
    });

    // Step 6: Generate new access token (outside transaction — no DB write)
    const accessToken = await this.tokenService.generateAccessToken(user);

    return { accessToken, refreshToken: rawToken };
  }
  ```
- The `token_hash` lookup via `bcrypt.compare()` is inherently O(n) across stored hashes, but since AD-5 enforces one row per user, the table size equals the number of active users. At Phase 1 scale this is acceptable. If scaling becomes a concern, an in-memory LRU cache of `user_id → token_hash` can be introduced without changing the interface.
- The `UserService.findById()` method may need to be added if not already present (check Story 3.4 — only `findByEmail` and `findByUsername` are defined). If so, add `findById(id: string): Promise<User | null>` to `IUserService` and implement in `UserService`.
- Inject `ITokenService`, `IUserService`, token repository, and validated config via constructor DI
- The transaction wraps only the PostgreSQL mutations (delete + insert). Token generation (`generateRefreshToken`, `generateAccessToken`) happens outside the transaction since they are pure computation with no DB writes.
- Place under `src/modules/auth/`
- Import `TokenRevokedException`, `TokenExpiredException` from `@shared/exceptions`
- Import `createTransaction` from `@shared/transaction`

### Dependencies
- Story 1.6 (User entity — for user lookup)
- Story 1.7 (AuthToken entity — for token record type)
- Story 1.12 (IAuthService, IUserService, ITokenService interfaces — `refresh` method)
- Story 1.13 (TokenRevokedException, TokenExpiredException)
- Story 1.14 (Transaction pattern — `createTransaction`)
- Story 3.1 (TokenService.generateAccessToken)
- Story 3.2 (TokenService.generateRefreshToken)
- Story 3.3 (TokenService.storeToken)
- Story 3.4 (UserService — may need `findById` addition)
- Story 4.1 (TokenService.verifyAccessToken — not directly used here but validates the token generation pipeline works)

---

## Story 5.2: Auth Controller — Refresh Endpoint

### Overview
Wire the HTTP layer for token refresh: expose POST /auth/v1/refresh, extract the refresh token from the httpOnly cookie (not from the request body), delegate to AuthService, and return 200 with new tokens and an updated Set-Cookie header. The controller is a thin adapter — no Zod body validation is needed because the token arrives via cookie, not via request body. Swagger decorators document the endpoint.

### Architecture References
- AD-11 (Zod Validation) — not applicable to this endpoint's input (token comes from cookie, not body). No Zod schema needed.
- Architecture §5.3 (Token Refresh Flow) — POST /auth/v1/refresh, cookie-based, returns new tokens
- Architecture §11.2 (Response Format) — `{ success: true, data: { accessToken } }` with Set-Cookie for new refresh token
- Architecture §6.3 (Cookie Configuration) — `REFRESH_TOKEN_COOKIE` constant with httpOnly, secure, sameSite=strict, path=/auth

### Acceptance Criteria
- `POST /auth/v1/refresh` endpoint exists on `AuthController`
- Reads refresh token from `req.cookies.refreshToken` (httpOnly cookie set during login)
- Returns HTTP 200 with `{ success: true, data: { accessToken } }` on success
- Sets new refresh token as httpOnly cookie via `Set-Cookie` header using the `REFRESH_TOKEN_COOKIE` constant
- Swagger decorators present: `@ApiTags('Auth')`, `@ApiOperation({ summary: 'Refresh tokens' })`, `@ApiResponse({ status: 200 })`, `@ApiResponse({ status: 401 })`
- Returns 401 with `TOKEN_REVOKED` error code if the refresh token is invalid or missing
- Returns 401 with `TOKEN_EXPIRED` error code if the refresh token has expired
- Missing cookie (no `refreshToken` cookie present) returns 401 with descriptive error

### Test Acceptance Criteria
- **Given** a valid refresh token cookie, **when** POST `/auth/v1/refresh` is called, **then** the response is 200 with `{ success: true, data: { accessToken } }` and a `Set-Cookie` header for the new refresh token
- **Given** no refresh token cookie, **when** POST `/auth/v1/refresh` is called, **then** the response is 401 with a missing token error
- **Given** an expired refresh token cookie, **when** POST `/auth/v1/refresh` is called, **then** the response is 401 with `TOKEN_EXPIRED` error code
- **Given** a revoked/rotated refresh token cookie, **when** POST `/auth/v1/refresh` is called, **then** the response is 401 with `TOKEN_REVOKED` error code
- **Given** a successful refresh, **when** the response is inspected, **then** the `Set-Cookie` header contains the new refresh token with correct attributes (httpOnly, secure, sameSite=strict, path=/auth)

### Implementation Guidance
- Add `refresh()` method to `src/modules/auth/auth.controller.ts`:
  ```typescript
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access and refresh tokens' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new AuthenticationException('Refresh token not provided', 'AUTH_TOKEN_MISSING');
    }

    const tokens = await this.authService.refresh(refreshToken);

    res.cookie('refreshToken', tokens.refreshToken, REFRESH_TOKEN_COOKIE);
    return { success: true, data: { accessToken: tokens.accessToken } };
  }
  ```
- The `@Res({ passthrough: true })` decorator allows setting cookies while still returning a response body (NestJS default behavior)
- `req.cookies` requires the `cookie-parser` middleware — ensure it is registered in `main.ts`:
  ```typescript
  import * as cookieParser from 'cookie-parser';
  // In bootstrap():
  app.use(cookieParser());
  ```
- The `REFRESH_TOKEN_COOKIE` constant should be shared with the login endpoint (Story 4.3). Define it in a shared location or import from the auth module constants:
  ```typescript
  export const REFRESH_TOKEN_COOKIE = {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
  };
  ```
- Catch `TokenRevokedException` → 401 and `TokenExpiredException` → 401 (via exception filter from Epic 7, or explicit catch in the interim)
- The response omits `refreshToken` from the JSON body — the new refresh token is only set via the Set-Cookie header. This prevents token leakage in logs, browser storage, or JavaScript.
- Register controller in `AuthModule`: ensure `controllers: [AuthController]` includes the new method

### Dependencies
- Story 1.5 (AppModule, Swagger setup)
- Story 1.13 (exception hierarchy for error responses)
- Story 4.3 (AuthController exists — this method is added to the same controller)
- Story 5.1 (AuthService.refresh implementation)
- `cookie-parser` middleware (verify it is in `package.json` dependencies; add if missing)

---

## Summary

| Story | Key Deliverable | File Location |
|-------|----------------|---------------|
| 5.1 | AuthService — refresh orchestration (three-step rotation, transaction-wrapped) | `src/modules/auth/auth.service.ts` |
| 5.2 | AuthController — POST /auth/v1/refresh endpoint (cookie-based, thin adapter) | `src/modules/auth/auth.controller.ts` |

**Note:** This epic completes the session maintenance vertical slice. After Epic 5, users can register (Epic 3), login (Epic 4), and refresh tokens (Epic 5) — sessions are maintained. The refresh token rotation (AD-6) ensures that each refresh invalidates the previous token, preventing token reuse. Logout (Epic 6) and protected routes (Epic 7) follow. The `cookie-parser` middleware must be registered in `main.ts` before the refresh endpoint will function — verify this is already in place from Epic 4 (login also sets cookies).
