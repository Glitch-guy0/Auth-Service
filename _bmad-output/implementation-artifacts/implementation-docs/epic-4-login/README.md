# Epic 4: Login Flow

**Goal:** Implement complete user login — POST /auth/v1/authenticate. Users can authenticate with email or username.

**Depends on:** Epic 1 (types, entities, DTOs, exception hierarchy), Epic 2 (KeyManager for JWT verification), Epic 3 (TokenService JWT generation, UserService CRUD, token storage pattern)

**Deliverable:** A login vertical slice: TokenService (JWT verification), AuthService (credential validation + session creation), and AuthController (HTTP endpoint).

---

## Story 4.1: TokenService — Token Verification

### Overview
Extend TokenService to verify JWT access tokens. Given a compact JWT string, verify its RSA signature against the public key (fetched by kid from KeyManager per AD-9), validate expiry, and return the decoded JwtPayload. This method is consumed by the AuthGuard (Epic 7) and by AuthService during logout (Epic 6) — it is placed here so the login flow can issue tokens that are immediately verifiable.

### Architecture References
- AD-15 (JWT Payload Contract) — claims to verify: `sub`, `iat`, `iss`, `kid`, `exp`
- AD-9 (KeyManager Takes kid Parameter) — kid extracted from JWT header to retrieve correct public key

### Acceptance Criteria
- `TokenService.verifyAccessToken(token: string)` returns decoded `JwtPayload`
- Extracts `kid` from the JWT protected header
- Calls `KeyManager.getPublicKey(kid)` to fetch the matching public key
- Verifies RS256 signature and expiration via `jose.jwtVerify()`
- Throws `TokenInvalidSignatureException` if signature is invalid
- Throws `TokenExpiredException` if token has expired

### Test Acceptance Criteria
- **Given** a valid signed JWT, **when** `verifyAccessToken(token)` is called, **then** it returns the decoded JwtPayload with correct claims
- **Given** a JWT signed with a wrong key, **when** `verifyAccessToken(token)` is called, **then** it throws `TokenInvalidSignatureException`
- **Given** an expired JWT (exp in the past), **when** `verifyAccessToken(token)` is called, **then** it throws `TokenExpiredException`

### Implementation Guidance
- Add `verifyAccessToken()` to `src/modules/token/token.service.ts`:
  ```typescript
  async verifyAccessToken(token: string): Promise<JwtPayload> {
    const { payload, protectedHeader } = await jose.jwtVerify(
      token,
      /* publicKey - see below */,
      { algorithms: ['RS256'], issuer: this.config.serverId },
    );
    const publicKey = await this.keyManager.getPublicKey(protectedHeader.kid!);
    // Re-verify with the retrieved public key
    const { payload: verified } = await jose.jwtVerify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: this.config.serverId,
    });
    return verified as JwtPayload;
  }
  ```
- Alternative (single-pass): decode the header unsafely to extract `kid`, fetch the public key, then call `jose.jwtVerify()` once — avoids double verification
- Import `TokenInvalidSignatureException` and `TokenExpiredException` from `@shared/exceptions`
- `jose.jwtVerify()` throws `JWSSignatureVerificationFailed` and `JWTExpiredError` respectively — catch and rethrow as domain exceptions

### Dependencies
- Story 1.12 (ITokenService interface — add `verifyAccessToken` method)
- Story 1.15 (JwtPayload type)
- Story 1.13 (TokenInvalidSignatureException, TokenExpiredException)
- Story 2.2 (KeyManager.getPublicKey)
- Story 3.1 (TokenService class exists)

---

## Story 4.2: AuthService — Login Logic

### Overview
Implement the `AuthService.login()` orchestration method. Given a `LoginDto` (usernameOrEmail + password), look up the user, verify they are not blocked, validate the password hash with bcrypt, generate a token pair, and persist the refresh token via UPSERT (AD-5 — single active session). Demographics are logged asynchronously via UserService (AD-10) so a MongoDB failure never blocks authentication.

### Architecture References
- AD-5 (Single Active Session) — UPSERT ensures one refresh token per user; new login overwrites any stale session
- AD-10 (Demographics via UserService) — AuthService calls `UserService.logDemographics()`, never touches DemographicsRepository directly
- AD-14 (Users Schema) — user lookup by email or username; checks `blocked` boolean
- AD-16 (Repository Ownership) — AuthService delegates to UserService and TokenService; does not access repositories directly

### Acceptance Criteria
- `AuthService.login(dto)` accepts `{ usernameOrEmail: string, password: string }`
- Looks up user by email first, then by username (if no `@` present, skip email lookup)
- Throws `UserBlockedException` if `user.blocked === true`
- Validates password with `bcrypt.compare(dto.password, user.password)`
- Throws `InvalidCredentialsException` if user is null or password does not match
- Generates access token via `TokenService.generateAccessToken(user)`
- Generates refresh token pair via `TokenService.generateRefreshToken()`
- Stores refresh token hash via UPSERT in a transaction using `TokenService.storeToken()`
- Calls `UserService.logDemographics(user.id, { last_ip, location })` asynchronously (fire-and-forget)
- Returns `{ accessToken, refreshToken }`

### Test Acceptance Criteria
- **Given** a valid email and password, **when** `login()` is called, **then** it returns `{ accessToken, refreshToken }`
- **Given** a valid username and password, **when** `login()` is called, **then** it returns `{ accessToken, refreshToken }`
- **Given** a blocked user, **when** `login()` is called, **then** it throws `UserBlockedException`
- **Given** an incorrect password, **when** `login()` is called, **then** it throws `InvalidCredentialsException`
- **Given** a non-existent email/username, **when** `login()` is called, **then** it throws `InvalidCredentialsException`
- **Given** a successful login, **when** `auth_tokens` table is queried, **then** a row exists with the hashed refresh token for that user_id (UPSERT — no duplicate rows)

### Implementation Guidance
- Add `login()` to `src/modules/auth/auth.service.ts`:
  ```typescript
  async login(dto: LoginDto): Promise<TokenResponseDto> {
    let user: User | null = null;
    if (dto.usernameOrEmail.includes('@')) {
      user = await this.userService.findByEmail(dto.usernameOrEmail);
    } else {
      user = await this.userService.findByUsername(dto.usernameOrEmail);
    }
    if (!user) throw new InvalidCredentialsException();
    if (user.blocked) throw new UserBlockedException();
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new InvalidCredentialsException();

    const accessToken = await this.tokenService.generateAccessToken(user);
    const { rawToken, tokenHash } = await this.tokenService.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.config.refreshTokenExpiryMs);

    await createTransaction(async () => {
      await this.tokenService.storeToken(user.id, tokenHash, expiresAt);
    });

    // Fire-and-forget demographics (AD-10)
    this.userService.logDemographics(user.id, { last_ip: dto.ip, location: dto.location })
      .catch(() => {}); // swallow — never block login

    return { accessToken, refreshToken: rawToken };
  }
  ```
- Inject `IUserService`, `ITokenService`, and validated config via constructor DI
- The `LoginDto` is passed from the controller which extracts `req.ip` and basic geo data before calling `login()`
- Place under `src/modules/auth/`

### Dependencies
- Story 1.6 (User entity — `blocked` field)
- Story 1.12 (IAuthService, IUserService, ITokenService interfaces)
- Story 1.13 (InvalidCredentialsException, UserBlockedException)
- Story 1.14 (Transaction pattern)
- Story 3.1 (TokenService.generateAccessToken)
- Story 3.2 (TokenService.generateRefreshToken)
- Story 3.3 (TokenService.storeToken — UPSERT)
- Story 3.4 (UserService — findByEmail, findByUsername)

---

## Story 4.3: Auth Controller — Login Endpoint

### Overview
Wire the HTTP layer for login: expose POST /auth/v1/authenticate, validate the request body with Zod (AD-11), delegate to AuthService, and return 200 with tokens. The controller is a thin adapter — all business logic lives in AuthService.

### Architecture References
- AD-11 (Zod Validation) — input validation via `LoginSchema.parse(body)`, not class-validator
- Architecture §5.2 (Login Flow) — POST /auth/v1/authenticate, body: `{ usernameOrEmail, password }`
- Architecture §11.2 (Response Format) — `{ success: true, data: { accessToken, refreshToken } }`

### Acceptance Criteria
- `POST /auth/v1/authenticate` endpoint exists on `AuthController`
- Input validated via `LoginSchema.parse(body)` — throws Zod error on invalid input
- Returns HTTP 200 with `{ success: true, data: { accessToken, refreshToken } }`
- Sets refresh token as httpOnly cookie (secure, sameSite=strict, path=/auth)
- Swagger decorators present: `@ApiTags('Auth')`, `@ApiOperation({ summary: 'Login' })`, `@ApiResponse({ status: 200 })`, `@ApiResponse({ status: 401 })`, `@ApiResponse({ status: 403 })`
- Zod validation errors caught and returned as 400 with structured error body

### Test Acceptance Criteria
- **Given** valid credentials, **when** POST `/auth/v1/authenticate` is called, **then** the response is 200 with `{ success: true, data: { accessToken, refreshToken } }` and a `Set-Cookie` header for the refresh token
- **Given** an invalid body (missing password), **when** POST `/auth/v1/authenticate` is called, **then** the response is 400 with a Zod validation error
- **Given** incorrect credentials, **when** POST `/auth/v1/authenticate` is called, **then** the response is 401 with `INVALID_CREDENTIALS` error code

### Implementation Guidance
- Add `login()` method to `src/modules/auth/auth.controller.ts`:
  ```typescript
  @Post('authenticate')
  @ApiOperation({ summary: 'Login with credentials' })
  @ApiResponse({ status: 200, description: 'Authentication successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'User is blocked' })
  async login(@Body() body: unknown, @Req() req: Request) {
    const dto = LoginSchema.parse(body); // throws ZodError on invalid
    const tokens = await this.authService.login({
      ...dto,
      ip: req.ip,
    });
    res.cookie('refreshToken', tokens.refreshToken, REFRESH_TOKEN_COOKIE);
    return { success: true, data: { accessToken: tokens.accessToken } };
  }
  ```
- The global Zod validation pipe catches `ZodError` and formats it as 400 — no manual try/catch needed for validation
- Catch `InvalidCredentialsException` → 401 and `UserBlockedException` → 403 (via exception filter from Epic 7, or explicit catch in the interim)
- Cookie config constant: `{ httpOnly: true, secure: true, sameSite: 'strict', path: '/auth', maxAge: 7 * 24 * 60 * 60 * 1000 }`
- Register controller in `AuthModule`: ensure `controllers: [AuthController]` includes the new method

### Dependencies
- Story 1.5 (AppModule, global validation pipe, Swagger setup)
- Story 1.10 (LoginSchema Zod definition)
- Story 1.13 (exception hierarchy for error responses)
- Story 4.2 (AuthService.login implementation)

---

## Summary

| Story | Key Deliverable | File Location |
|-------|----------------|---------------|
| 4.1 | TokenService — JWT verification with RSA public key | `src/modules/token/token.service.ts` |
| 4.2 | AuthService — login orchestration (lookup, block check, bcrypt, UPSERT) | `src/modules/auth/auth.service.ts` |
| 4.3 | AuthController — POST /auth/v1/authenticate endpoint with cookie | `src/modules/auth/auth.controller.ts` |

**Note:** This epic completes the login vertical slice. After Epic 4, users can register (Epic 3) and authenticate via HTTP. Token refresh (Epic 5), logout (Epic 6), and protected routes (Epic 7) follow. Demographics logging is fire-and-forget here; full MongoDB integration and structured logging are delivered in Epic 8.
