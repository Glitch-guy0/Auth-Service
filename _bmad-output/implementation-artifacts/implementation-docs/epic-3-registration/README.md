# Epic 3: Registration Flow

**Goal:** Implement complete user registration — POST /auth/v1/register. Users can create accounts with tokens issued.

**Depends on:** Epic 1 (types, entities, DTOs, transaction pattern), Epic 2 (KeyManager for JWT signing)

**Deliverable:** A fully wired registration vertical slice: TokenService (JWT + refresh), UserService (CRUD), AuthService (orchestration), and AuthController (HTTP endpoint).

---

## Story 3.1: TokenService — JWT Generation

### Overview
Implement RSA-signed JWT access token generation. The TokenService fetches the private key from KeyManager, constructs the payload per AD-15, signs with `jose`, and returns the compact JWT string. The kid is embedded in the payload for key rotation (AD-9).

### Architecture References
- AD-8 (TokenService Returns Complete JWT Payload) — TokenService owns the full signing lifecycle
- AD-15 (JWT Payload Contract) — claims: `sub`, `iat`, `iss`, `kid`, `exp`
- AD-9 (KeyManager Takes kid Parameter) — kid from `keys.json` embedded in payload

### Acceptance Criteria
- `TokenService.generateAccessToken(user)` returns a signed JWT string
- Payload contains: `sub` (user.id), `iat` (now), `iss` (server_id from config), `kid` (from keys.json), `exp` (now + access token expiry)
- Signs with RSA private key via `jose.SignJWT` + `jose.sign()`
- Uses RS256 algorithm

### Test Acceptance Criteria
- **Given** a valid user and configured KeyManager, **when** `generateAccessToken(user)` is called, **then** the result is a valid JWT string (three dot-separated base64url segments)
- **Given** the generated JWT, **when** decoded (without verification), **then** the payload contains all five required claims with correct types

### Implementation Guidance
- Create `src/modules/token/token.service.ts` implementing `ITokenService`
- Inject `IKeyManager` via constructor DI
- Read `kid` and `privateKey` from KeyManager; build JWT with:
  ```typescript
  const jwt = await new jose.SignJWT({ sub: user.id })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuedAt()
    .setIssuer(config.serverId)
    .setExpirationTime(config.jwtAccessExpiry)
    .sign(privateKey);
  ```
- Parse `privateKey` string into `jose.KeyObject` via `jose.importPKCS8()`
- After signing, clear the private key from memory (call `KeyManager.getPrivateKey()` which handles clearing)
- Place under `src/modules/token/`

### Dependencies
- Story 1.12 (ITokenService interface)
- Story 1.15 (JwtPayload type)
- Story 2.2 (KeyManager service)
- Story 2.3 (KeyModule DI registration)

---

## Story 3.2: TokenService — Refresh Token

### Overview
Generate a cryptographically random refresh token and produce both the raw value (sent to client in a cookie) and its bcrypt hash (stored in the database). This dual-output pattern ensures the plaintext never touches persistent storage (AD-5).

### Architecture References
- AD-5 (Single Active Session) — only one refresh token per user; raw token is ephemeral

### Acceptance Criteria
- `TokenService.generateRefreshToken()` returns `{ rawToken: string, tokenHash: string }`
- `rawToken` is generated via `crypto.randomBytes(64).toString('base64url')` (512 bits of entropy)
- `tokenHash` is produced by `bcrypt.hash(rawToken, BCRYPT_COST)`
- BCRYPT_COST is read from validated env config (default 10)

### Test Acceptance Criteria
- **Given** TokenService is initialized, **when** `generateRefreshToken()` is called, **then** `rawToken` is a non-empty string with high entropy (≥64 bytes encoded)
- **Given** the output, **when** `bcrypt.compare(rawToken, tokenHash)` is called, **then** it returns true
- **Given** two consecutive calls, **when** results are compared, **then** `rawToken` values are different

### Implementation Guidance
- Add `generateRefreshToken()` to `TokenService`:
  ```typescript
  import * as crypto from 'crypto';
  import * as bcrypt from 'bcrypt';

  async generateRefreshToken(): Promise<{ rawToken: string; tokenHash: string }> {
    const rawToken = crypto.randomBytes(64).toString('base64url');
    const tokenHash = await bcrypt.hash(rawToken, this.config.bcryptCost);
    return { rawToken, tokenHash };
  }
  ```
- `base64url` (not `base64`) avoids padding and URL-unsafe characters — suitable for cookie values
- The raw token is returned to the controller for the Set-Cookie header; the hash goes to the DB

### Dependencies
- Story 1.3 (BCRYPT_COST from env config)
- Story 1.12 (ITokenService interface)

---

## Story 3.3: TokenService — Token Storage

### Overview
Persist the refresh token hash in the `auth_tokens` table using a UPSERT pattern. Because `user_id` is the primary key (AD-5), `INSERT ... ON CONFLICT (user_id) DO UPDATE` ensures only one active session per user — a new registration overwrites any stale token.

### Architecture References
- AD-5 (Single Active Session) — PK on `user_id` enforces one row per user
- AD-12 (Transaction Pattern) — called within Transaction 2 from AuthService

### Acceptance Criteria
- `TokenService.storeToken(user_id, token_hash, expires_at)` inserts/updates a row in `auth_tokens`
- Uses TypeORM `upsert()` or raw query: `INSERT INTO auth_tokens ... ON CONFLICT (user_id) DO UPDATE SET token_hash = ..., expires_at = ...`
- Called within a transaction context (receives the `tx` object or uses the transactional query runner)

### Test Acceptance Criteria
- **Given** a new user_id, **when** `storeToken()` is called, **then** a new row exists in `auth_tokens`
- **Given** the same user_id called again, **when** `storeToken()` completes, **then** the row is updated (token_hash and expires_at changed), not duplicated
- **Given** a failed transaction, **when** it rolls back, **then** no row is inserted

### Implementation Guidance
- Add `storeToken()` to `TokenService`:
  ```typescript
  async storeToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.tokenRepository.upsert(
      { userId, tokenHash, expiresAt },
      ['userId'],  // conflict column
    );
  }
  ```
- Alternatively, use TypeORM `createQueryBuilder().insert().orUpdate().execute()` for explicit control
- The method receives the `tx` query runner from the AuthService transaction — pass it via repository or use the active transaction manager
- The AuthToken entity from Story 1.7 maps to this table; use its TypeORM repository

### Dependencies
- Story 1.7 (AuthToken entity)
- Story 1.12 (ITokenService interface)
- Story 1.14 (Transaction pattern)
- Story 2.3 (TokenModule with TypeORM registration)

---

## Story 3.4: UserService — User CRUD

### Overview
Implement the UserService with database queries for user lookup and creation. This story delivers the three methods required by the registration flow: email lookup, username lookup, and user creation. All operations target PostgreSQL via TypeORM.

### Architecture References
- AD-14 (Users Table Schema Contract) — `users` table schema: id, username, email, password, blocked, is_verified, created_at, updated_at
- AD-16 (Repository Ownership) — UserService owns the user repository; no other service queries the users table directly

### Acceptance Criteria
- `UserService.findByEmail(email)` queries PostgreSQL, returns `User | null`
- `UserService.findByUsername(username)` queries PostgreSQL, returns `User | null`
- `UserService.create(userData)` inserts a new user, returns the created `User` entity
- `create()` accepts: username, email, password (pre-hashed by caller)

### Test Acceptance Criteria
- **Given** a non-existent email, **when** `findByEmail()` is called, **then** it returns `null`
- **Given** an existing user, **when** `findByEmail()` is called with their email, **then** it returns the full `User` entity
- **Given** valid userData, **when** `create()` is called, **then** a new row exists in `users` and the returned entity has a UUID `id`
- **Given** duplicate username/email, **when** `create()` is called, **then** it throws a database constraint error (handled upstream by AuthService)

### Implementation Guidance
- Create `src/modules/user/user.service.ts` implementing `IUserService`:
  ```typescript
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  async create(data: { username: string; email: string; password: string }): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }
  ```
- Inject `Repository<User>` via `@InjectRepository(User)` in the constructor
- `create()` does NOT hash passwords — the AuthService (Story 3.5) hashes before calling `create()`
- Place under `src/modules/user/`
- Register `UserModule` with `TypeOrmModule.forFeature([User])` in `user.module.ts`

### Dependencies
- Story 1.6 (User entity)
- Story 1.12 (IUserService interface)
- Story 1.5 (module structure for UserModule)

---

## Story 3.5: AuthService — Registration Logic

### Overview
Orchestrate the complete registration flow: validate uniqueness, hash password, create user (Transaction 1), generate token pair, store refresh token (Transaction 2), and return tokens. This is the core business logic that ties all services together.

### Architecture References
- AD-12 (Transaction Pattern) — two separate transactions: user creation, then token storage
- AD-14 (Users Schema) — user data shape for creation
- AD-16 (Repository Ownership) — AuthService delegates to UserService (not repositories directly)
- Architecture §5.1 (Signup Flow) — step-by-step registration sequence

### Acceptance Criteria
- `AuthService.register(dto)` checks username uniqueness via `UserService.findByUsername()`
- `AuthService.register(dto)` checks email uniqueness via `UserService.findByEmail()`
- Throws `UserExistsException` if username already exists
- Hashes password with bcrypt (cost from config) before creating user
- Creates user in Transaction 1 via `createTransaction()`
- Generates token pair via `TokenService.generateAccessToken()` + `TokenService.generateRefreshToken()`
- Stores refresh token hash in Transaction 2 via `TokenService.storeToken()`
- Returns `{ accessToken, refreshToken }` where refreshToken is the raw (unhashed) value

### Test Acceptance Criteria
- **Given** a valid RegisterDto, **when** `register()` is called, **then** the returned object contains `accessToken` (JWT string) and `refreshToken` (base64url string)
- **Given** a RegisterDto with an existing username, **when** `register()` is called, **then** it throws `UserExistsException`
- **Given** a successful registration, **when** the DB is queried, **then** a row exists in `users` with the hashed password and a row in `auth_tokens` with the token hash
- **Given** Transaction 1 fails, **when** `register()` is called, **then** no rows are inserted in either table (rollback)

### Implementation Guidance
- Create `src/modules/auth/auth.service.ts`:
  ```typescript
  async register(dto: RegisterDto): Promise<TokenResponseDto> {
    const existingUsername = await this.userService.findByUsername(dto.username);
    if (existingUsername) throw new UserExistsException('Username already exists');

    const existingEmail = await this.userService.findByEmail(dto.email);
    if (existingEmail) throw new UserExistsException('Email already exists');

    const hashedPassword = await bcrypt.hash(dto.password, this.config.bcryptCost);

    // Transaction 1: User creation
    const user = await createTransaction(async (tx) => {
      return this.userService.create({
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
      });
    });

    // Token generation (outside transaction — no DB writes)
    const accessToken = await this.tokenService.generateAccessToken(user);
    const { rawToken, tokenHash } = await this.tokenService.generateRefreshToken();

    // Transaction 2: Token storage
    const expiresAt = new Date(Date.now() + this.config.refreshTokenExpiryMs);
    await createTransaction(async (tx) => {
      await this.tokenService.storeToken(user.id, tokenHash, expiresAt);
    });

    return { accessToken, refreshToken: rawToken };
  }
  ```
- Inject `IUserService`, `ITokenService`, and config via constructor DI
- Place under `src/modules/auth/`
- Register `AuthModule` with imports: `UserModule`, `TokenModule`

### Dependencies
- Story 1.12 (IAuthService, IUserService, ITokenService interfaces)
- Story 1.13 (UserExistsException)
- Story 1.14 (Transaction pattern)
- Story 3.1 (TokenService — JWT generation)
- Story 3.2 (TokenService — refresh token generation)
- Story 3.3 (TokenService — token storage)
- Story 3.4 (UserService — CRUD)

---

## Story 3.6: Auth Controller — Register Endpoint

### Overview
Wire the HTTP layer: expose POST /auth/v1/register, validate input with Zod, delegate to AuthService, and return 201 with Swagger documentation. The controller is a thin adapter — all logic lives in AuthService.

### Architecture References
- AD-11 (Zod Validation) — input validation via `RegisterSchema.parse()`, not class-validator
- Architecture §11.1 (API Routes) — base path `/auth/v1`, POST `/register`
- Architecture §11.2 (Response Format) — `{ success: true, data: { accessToken, refreshToken } }`

### Acceptance Criteria
- `POST /auth/v1/register` endpoint exists on `AuthController`
- Input validated via `RegisterSchema.parse(body)` — throws Zod error on invalid input
- Returns HTTP 201 with `{ success: true, data: { accessToken, refreshToken } }`
- Swagger decorators present: `@ApiTags('Auth')`, `@ApiOperation({ summary: 'Register' })`, `@ApiResponse({ status: 201 })`, `@ApiResponse({ status: 409 })`
- Zod validation errors are caught and returned as 400 with structured error body

### Test Acceptance Criteria
- **Given** a valid registration body, **when** POST `/auth/v1/register` is called, **then** the response is 201 with `{ success: true, data: { accessToken, refreshToken } }`
- **Given** an invalid body (missing email), **when** POST `/auth/v1/register` is called, **then** the response is 400 with a Zod validation error
- **Given** a body with an existing username, **when** POST `/auth/v1/register` is called, **then** the response is 409 with `USER_EXISTS` error code

### Implementation Guidance
- Create `src/modules/auth/auth.controller.ts`:
  ```typescript
  @ApiTags('Auth')
  @Controller('auth/v1')
  export class AuthController {
    constructor(private readonly authService: IAuthService) {}

    @Post('register')
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User registered successfully' })
    @ApiResponse({ status: 409, description: 'Username or email already exists' })
    async register(@Body() body: unknown) {
      const dto = RegisterSchema.parse(body);  // throws ZodError on invalid
      const tokens = await this.authService.register(dto);
      return { success: true, data: tokens };
    }
  }
  ```
- Use `@nestjs/swagger` decorators for API documentation
- The global Zod validation pipe (from Story 1.5) catches `ZodError` and formats it as 400 — no manual try/catch needed for validation
- Catch `UserExistsException` explicitly (or via exception filter) to return 409
- Register controller in `AuthModule`: `controllers: [AuthController]`
- Place under `src/modules/auth/`

### Dependencies
- Story 1.5 (AppModule, global validation pipe, Swagger setup)
- Story 1.10 (RegisterSchema)
- Story 1.13 (exception hierarchy for error responses)
- Story 3.5 (AuthService.register implementation)

---

## Summary

| Story | Key Deliverable | File Location |
|-------|----------------|---------------|
| 3.1 | TokenService — JWT generation with RSA signing | `src/modules/token/token.service.ts` |
| 3.2 | TokenService — refresh token generation + bcrypt hash | `src/modules/token/token.service.ts` |
| 3.3 | TokenService — UPSERT token storage | `src/modules/token/token.service.ts` |
| 3.4 | UserService — findByEmail, findByUsername, create | `src/modules/user/user.service.ts` |
| 3.5 | AuthService — registration orchestration (2 transactions) | `src/modules/auth/auth.service.ts` |
| 3.6 | AuthController — POST /auth/v1/register endpoint | `src/modules/auth/auth.controller.ts` |

**Note:** This epic delivers the first complete vertical slice. After Epic 3, users can register via HTTP and receive JWT access + refresh tokens. Demographics logging (MongoDB async write) is deferred to Epic 8. Token verification and AuthGuard are implemented in Epic 7.
