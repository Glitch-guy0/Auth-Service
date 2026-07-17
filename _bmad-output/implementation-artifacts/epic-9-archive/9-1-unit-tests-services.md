# Story 9.1: Unit Tests — Services

Status: review

## Story

As a developer,
I want comprehensive unit tests for AuthService, UserService, and TokenService,
so that I can verify business logic correctness, catch regressions, and maintain coverage targets.

## Acceptance Criteria

1. **Given** the test suite
   **When** `npm run test` is executed
   **Then** all AuthService, UserService, and TokenService tests pass with 0 failures

2. **Given** coverage reporting
   **When** `npm run test:cov` is executed
   **Then** coverage report is generated covering Statements ≥ 80%, Branches ≥ 75%, Functions ≥ 80%, Lines ≥ 80%

3. **Given** AuthService.register with valid DTO
   **When** no existing user has the same username or email
   **Then** a user is created and `{accessToken, refreshToken, expiresIn}` is returned (UT-S1)

4. **Given** AuthService.register with a DTO whose username already exists
   **When** the duplicate check runs
   **Then** `UserExistsException` is thrown with message "User already exists with this username" (UT-S2)

5. **Given** AuthService.register with a DTO whose email already exists
   **When** the duplicate check runs
   **Then** `UserExistsException` is thrown with message "User already exists with this email" (UT-S3)

6. **Given** AuthService.login with valid credentials
   **When** the user exists and password matches
   **Then** `{accessToken, refreshToken, expiresIn}` is returned, refresh token is hashed and stored, demographics are logged (UT-S4)

7. **Given** AuthService.login with invalid password
   **When** bcrypt.compare returns false
   **Then** `InvalidCredentialsException` is thrown (UT-S5)

8. **Given** AuthService.login with non-existent username/email
   **When** user lookup returns null
   **Then** `InvalidCredentialsException` is thrown (UT-S6)

9. **Given** AuthService.login with a blocked user
   **When** the user has `blocked: true`
   **Then** `UserBlockedException` is thrown (UT-S7)

10. **Given** AuthService.refresh with a valid refresh token
    **When** the token exists, is not expired, and rotation succeeds
    **Then** new `{accessToken, refreshToken, expiresIn}` is returned, old token is rotated (UT-S8)

11. **Given** AuthService.refresh with an expired refresh token
    **When** `tokenRecord.expiresAt < now`
    **Then** `TokenExpiredException` is thrown (UT-S9)

12. **Given** AuthService.logout with a valid access token
    **When** the token verifies successfully
    **Then** `verifyAccessToken` is called, refresh token is deleted, and access token is blacklisted (UT-S10)

13. **Given** UserService.findByEmail with a matching email
    **When** the repository returns a user
    **Then** the User entity is returned (UT-S11)

14. **Given** UserService.findByEmail with a non-matching email
    **When** the repository returns null
    **Then** null is returned (UT-S12)

15. **Given** UserService.findByUsername with a matching username
    **When** the repository returns a user
    **Then** the User entity is returned (UT-S13)

16. **Given** UserService.create with valid registration data
    **When** the password is bcrypt-hashed and the user is saved
    **Then** the created User entity is returned (UT-S14)

17. **Given** TokenService.generateAccessToken (private, via generateTokenPair path)
    **When** a userId is provided
    **Then** a valid RS256 JWT is produced with correct sub, iss, kid, and exp claims (UT-S15)

18. **Given** TokenService.verifyAccessToken with a valid JWT
    **When** the signature is valid and the token is not expired
    **Then** `{userId}` is returned from the decoded payload (UT-S16)

19. **Given** TokenService.verifyAccessToken with an expired JWT
    **When** the `exp` claim is in the past
    **Then** `TokenExpiredException` is thrown (UT-S17)

20. **Given** TokenService.verifyAccessToken with an invalid signature
    **When** the token is signed with a different key
    **Then** `TokenInvalidSignatureException` is thrown

21. **Given** TokenService.verifyAccessToken with a malformed token
    **When** the token does not have 3 dot-separated segments
    **Then** `TokenInvalidSignatureException` is thrown

22. **Given** TokenService.verifyAccessToken with a token missing kid in header
    **When** the JWT header has no kid claim
    **Then** `TokenInvalidSignatureException` is thrown

23. **Given** TokenService.verifyAccessToken when getPublicKey returns null
    **When** the public key for kid is not found
    **Then** `TokenInvalidSignatureException` is thrown

24. **Given** TokenService.findUserByRefreshToken with a matching token
    **When** a row exists and bcrypt.compare matches
    **Then** `{userId, expiresAt}` is returned

25. **Given** TokenService.findUserByRefreshToken with no matching token
    **When** no rows exist or no hash matches
    **Then** null is returned

26. **Given** TokenService.storeToken with valid data
    **When** the UPSERT query executes
    **Then** the token is stored and undefined is returned

27. **Given** TokenService.deleteRefreshTokenByUserId with a userId
    **When** the DELETE query executes
    **Then** the refresh token is removed

28. **Given** TokenService.blacklistToken with a valid JWT
    **When** the Redis set operation succeeds
    **Then** the token is blacklisted with the correct TTL

29. **Given** TokenService.blacklistToken with a malformed JWT
    **When** the token does not have 3 segments
    **Then** the blacklist is silently skipped (no Redis call)

## Tasks / Subtasks

- [x] Task 1: Verify and refine AuthService unit tests (AC: 1, 3-12)
  - [x] Register tests: valid DTO returns tokens, duplicate username/email throws UserExistsException, parallel uniqueness checks, bcrypt hash for refresh token, storeToken called, no create/gen/store when duplicate exists (auth.service.spec.ts exists, 405 lines, 19 test cases)
  - [x] Login tests: valid email returns tokens, valid username returns tokens, non-existent user throws InvalidCredentialsException, wrong password throws InvalidCredentialsException, blocked user throws UserBlockedException, generateTokenPair called with user id, refresh token hashed and stored, logDemographics fire-and-forget (auth.service.spec.ts exists, 11 test cases)
  - [x] Refresh tests: valid token returns new tokens, invalid token throws InvalidCredentialsException, expired token throws TokenExpiredException, null/undefined token throws InvalidCredentialsException, empty string throws InvalidCredentialsException, storeToken failure wraps as InvalidCredentialsException (auth.service.spec.ts exists, 9 test cases)
  - [x] Logout tests: valid token calls verify+delete+blacklist, expired token silently succeeds, DB delete failure silently succeeds, Redis blacklist failure silently succeeds (auth.service.spec.ts exists, 4 test cases)
  - [x] Verify all imports match actual paths (@shared/exceptions, @modules/auth/dto, USER_SERVICE/TOKEN_SERVICE symbols)

- [x] Task 2: Verify and refine UserService unit tests (AC: 1, 13-16)
  - [x] findByEmail tests: found returns User, not found returns null (user.service.spec.ts exists, 2 test cases)
  - [x] findByUsername tests: found returns User, not found returns null (user.service.spec.ts exists, 2 test cases)
  - [x] create tests: password is bcrypt-hashed before save, create+save called with correct data, returns saved User entity (user.service.spec.ts exists, 3 test cases)
  - [x] logDemographics tests: delegates to DemographicsService with userId+ip+location, passes undefined when location omitted (user.service.spec.ts exists, 2 test cases)
  - [x] Verify Repository mock provides all methods used (findOne, create, save)

- [x] Task 3: Verify and refine TokenService unit tests (AC: 1, 17-29)
  - [x] generateAccessToken tests: produces 3-part JWT, correct claims (sub, iss, kid, exp), RS256 algorithm, exp-iat = configured expiry, calls getPrivateKey (token.service.spec.ts exists, 5 test cases)
  - [x] generateRefreshToken tests: returns rawToken+tokenHash, hex-encoded 128 chars, calls crypto.randomBytes(64), calls bcrypt.hash, different tokens per call, error handling for crypto/bcrypt failures (token.service.spec.ts exists, 8 test cases)
  - [x] verifyAccessToken tests: valid JWT returns userId, invalid signature throws TokenInvalidSignatureException, expired token throws TokenExpiredException, malformed token throws, missing kid throws, missing public key throws, algorithm restriction (token.service.spec.ts exists, 7 test cases)
  - [x] findUserByRefreshToken tests: matching token returns userId+expiresAt, no tokens returns null, no hash match returns null (token.service.spec.ts exists, 3 test cases)
  - [x] storeToken tests: executes UPSERT with correct SQL and params, returns void, propagates DB errors (token.service.spec.ts exists, 3 test cases)
  - [x] deleteRefreshTokenByUserId test: executes DELETE with correct userId (token.service.spec.ts exists, 1 test case)
  - [x] blacklistToken tests: sets Redis key with TTL, skips malformed tokens, handles Redis failure gracefully (token.service.spec.ts exists, 3 test cases)
  - [x] generateTokenPair stub test: throws "Not implemented" (token.service.spec.ts exists, 1 test case)

- [x] Task 4: Verify test isolation (AC: 1)
  - [x] Confirm no test relies on another test's state
  - [x] Confirm `afterEach` or `jest.clearAllMocks()` is used appropriately
  - [x] Confirm `beforeEach` re-creates the TestingModule for each test case
  - [x] Verify no real database, KeyManager, or Redis connections are made during tests

- [x] Task 5: Verify coverage thresholds (AC: 2)
  - [x] Run `npm run test:cov` and confirm the report is generated
  - [x] Check Statements ≥ 80%, Branches ≥ 75%, Functions ≥ 80%, Lines ≥ 80%
  - [x] Identify and add tests for any uncovered branches

- [x] Task 6: Verify Jest configuration alignment (AC: 1)
  - [x] Confirm `rootDir: "src"` in jest config resolves all module paths correctly
  - [x] Confirm `moduleNameMapper` aliases (`@shared/*`, `@modules/*`, `@config/*`, `@database/*`) resolve correctly in test files
  - [x] Confirm `transformIgnorePatterns` includes `jose` and `uuid` (ESM packages)
  - [x] Confirm `testRegex: ".*\\.spec\\.ts$"` picks up all three test files

## Dev Notes

### Existing Code Context

**AuthService** (`src/modules/auth/auth.service.ts:1-187`):

- Implements `IAuthService` — 4 public methods: `register`, `login`, `refresh`, `logout`
- Inject `IUserService` via `@Inject(USER_SERVICE)` and `ITokenService` via `@Inject(TOKEN_SERVICE)`
- Uses `bcrypt.hash` with `BCRYPT_SALT_ROUNDS = 12` for refresh token hashing
- `register`: runs `findByUsername` + `findByEmail` in parallel via `Promise.all`, checks duplicates, calls `userService.create`, generates token pair, hashes+stores refresh token, fires `logDemographics` fire-and-forget
- `login`: resolves user by email (if `@` in input) or username, checks blocked status, verifies password with `bcrypt.compare`, generates token pair, hashes+stores refresh token, fires `logDemographics` fire-and-forget
- `refresh`: validates token string, calls `findUserByRefreshToken`, checks expiry, generates new token pair, rotates refresh token (wraps storeToken failure as `InvalidCredentialsException`)
- `logout`: wraps entire body in try-catch, calls `verifyAccessToken` → `deleteRefreshTokenByUserId` → `blacklistToken`, silently swallows all errors

**UserService** (`src/modules/user/user.service.ts:1-49`):

- Implements `IUserService` — 4 public methods: `findByEmail`, `findByUsername`, `create`, `logDemographics`
- Uses `@InjectRepository(User)` for TypeORM Repository injection
- Uses `@Optional() DemographicsService` — optional dependency, can be undefined
- `create`: hashes password with `bcrypt.hash` + `SALT_ROUNDS = 12`, calls `repository.create` then `repository.save`
- `logDemographics`: delegates to `DemographicsService.logDemographics`

**TokenService** (`src/modules/token/token.service.ts:1-237`):

- Implements `ITokenService` — 6 public methods: `generateTokenPair`, `storeToken`, `verifyAccessToken`, `findUserByRefreshToken`, `deleteRefreshTokenByUserId`, `blacklistToken`
- Injects `IKeyManager` via `@Inject(KEY_MANAGER)`, `ConfigService`, `@InjectRepository(AuthToken)`, and `RedisService`
- `generateTokenPair`: currently throws `new Error('Not implemented')` — stub method
- `generateAccessToken` (private): uses `jose.SignJWT` with RS256, reads config for `KEY_KID`, `AUTH_SERVICE_ISSUER`, `ACCESS_TOKEN_EXPIRY_SECONDS`
- `generateRefreshToken` (private): uses `crypto.randomBytes` for entropy, `bcrypt.hash` for hash, reads `REFRESH_TOKEN_BYTES` and `BCRYPT_SALT_ROUNDS` from config
- `verifyAccessToken`: decodes header for `kid`, calls `keyManager.getPublicKey(kid)`, imports SPKI key, verifies with `jwtVerify`, maps JOSE errors to domain exceptions
- `findUserByRefreshToken`: queries all rows from `auth_tokens`, iterates with `bcrypt.compare`
- `storeToken`: raw SQL UPSERT (`INSERT ... ON CONFLICT DO UPDATE SET`)
- `blacklistToken`: decodes exp from JWT payload, calls `redisService.set` with TTL, silently catches errors

**Existing Test File Layout:**

| File | Lines | Test Cases | Coverage |
|------|-------|-----------|----------|
| `src/modules/auth/__tests__/auth.service.spec.ts` | 405 | 19 | register(7), login(8), refresh(4), logout(4) |
| `src/modules/user/__tests__/user.service.spec.ts` | 183 | 9 | findByEmail(2), findByUsername(2), create(3), logDemographics(2) |
| `src/modules/token/__tests__/token.service.spec.ts` | 553 | 31 | generateAccessToken(5), generateRefreshToken(8), verifyAccessToken(7), findUserByRefreshToken(3), storeToken(3), deleteRefreshTokenByUserId(1), blacklistToken(3), generateTokenPair stub(1) |

**Total:** 59 test cases across 3 files

**Jest Configuration** (`package.json:74-99`):

- `rootDir`: `"src"`
- `testRegex`: `".*\\.spec\\.ts$"`
- `moduleNameMapper`: `^@shared/(.*)$` → `<rootDir>/shared/$1`, same pattern for `@modules`, `@config`, `@database`
- `transform`: `"^.+\.(t|j)s$": "ts-jest"`
- `transformIgnorePatterns`: `node_modules/(?!jose|uuid)` — ESM packages must be transpiled
- `coverageDirectory`: `"../coverage"`
- `testEnvironment`: `"node"`

**Test Token Symbols:**

| Symbol | File | Usage |
|--------|------|-------|
| `USER_SERVICE` | `common/ports/user.token.ts` | `provide: USER_SERVICE` in AuthService test |
| `TOKEN_SERVICE` | `common/ports/token.token.ts` | `provide: TOKEN_SERVICE` in AuthService test |
| `KEY_MANAGER` | `common/ports/key-manager.token.ts` | `provide: KEY_MANAGER` in TokenService test |

**Port Interfaces:**

| Interface | File | Methods |
|-----------|------|---------|
| `IUserService` | `common/ports/user.port.ts` | `findByEmail`, `findByUsername`, `create`, `logDemographics` |
| `ITokenService` | `common/ports/token.port.ts` | `generateTokenPair`, `storeToken`, `verifyAccessToken`, `findUserByRefreshToken`, `deleteRefreshTokenByUserId`, `blacklistToken` |
| `IKeyManager` | `common/ports/key-manager.port.ts` | `getPublicKey(kid)`, `getPrivateKey()` |

### Architecture References

- **Architecture §2.1 — Hexagonal Port Interfaces**: Defines `IAuthService`, `IUserService`, `ITokenService` as domain ports consumed by controllers and implemented by service classes. Tests mock these ports to isolate the service under test.
- **Architecture §11.2 — Response Shapes**: Defines `TokenResponseDto` (accessToken + refreshToken + expiresIn) returned by auth flows. Tests assert on these shapes.
- **Epic 3 stories (3.1–3.5)**: Define AuthService and TokenService business logic — register flow, login flow, token generation, refresh rotation.
- **Epic 4 story (4.2)**: Defines AuthService.login contract — user lookup → password verify → blocked check → token gen → store → demographics.
- **AD-4 Module Lifecycle Pattern**: LoggingModule lifecycle is unrelated to these tests but the `logDemographics` fire-and-forget pattern (`.catch(() => {})`) is tested in AuthService.
- **AD-5 Single Active Session**: The `deleteRefreshTokenByUserId` + `storeToken` pattern implements session rotation per refresh. Tests verify old tokens are invalidated.

### Mocking Strategies

**AuthService — Mock ports via Symbol tokens:**

```typescript
const mockUserService = () => ({
  findByUsername: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  logDemographics: jest.fn(),
});

const mockTokenService = () => ({
  generateTokenPair: jest.fn(),
  storeToken: jest.fn(),
  verifyAccessToken: jest.fn(),
  findUserByRefreshToken: jest.fn(),
  deleteRefreshTokenByUserId: jest.fn(),
  blacklistToken: jest.fn(),
});

// Registration in TestingModule
{ provide: USER_SERVICE, useValue: mockUserService },
{ provide: TOKEN_SERVICE, useValue: mockTokenService },
```

Key: AuthService uses `@Inject(USER_SERVICE)` and `@Inject(TOKEN_SERVICE)` (Symbol-based injection, not class-based). Tests must provide mocks using the same Symbol tokens from `common/ports/user.token.ts` and `common/ports/token.token.ts`.

**UserService — Mock TypeORM Repository:**

```typescript
userRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
} as unknown as jest.Mocked<Repository<User>>;

{ provide: getRepositoryToken(User), useValue: userRepository },
```

`getRepositoryToken(User)` is the NestJS/TypeORM injection token. The mock must provide only the methods the service actually calls (`findOne`, `create`, `save`). The `DemographicsService` uses `@Optional()` — the mock provides a stub.

**TokenService — Mock KeyManager + ConfigService + Repository + RedisService:**

```typescript
keyManagerMock = {
  getPrivateKey: jest.fn().mockResolvedValue(testPrivateKey),
  getPublicKey: jest.fn(),
};

configServiceMock = {
  get: jest.fn((key: string, defaultValue?: unknown) => {
    const config: Record<string, unknown> = {
      KEY_KID: 'test-kid-123',
      AUTH_SERVICE_ISSUER: 'test-issuer',
      ACCESS_TOKEN_EXPIRY_SECONDS: 900,
    };
    return config[key] ?? defaultValue;
  }),
} as unknown as jest.Mocked<ConfigService>;
```

Key: TokenService calls `ConfigService.get()` with string keys — the mock must return correct values per key. For `KEY_MANAGER`, the token is the Symbol from `common/ports/key-manager.token.ts` (`provide: KEY_MANAGER`).

**JOSE library — use real crypto, do NOT mock:**
TokenService tests use real `jose` functions (`generateKeyPair`, `SignJWT`, `jwtVerify`, `importPKCS8`, `exportSPKI`) to produce cryptographically valid tokens. This tests the real verification path. The `transformIgnorePatterns` ensures `jose` is transpiled by ts-jest.

**bcrypt — do NOT mock for UserService.create (real hash/compare):**
UserService tests let bcrypt actually hash the password, then verify with `bcrypt.compare(dto.password, savedPassword)` — this validates the hash-salt flow end-to-end.

**bcrypt — mock for AuthService (control hash output):**
AuthService tests mock `bcrypt.hash` to return predictable values (`'hashed-refresh-token'`) so `tokenService.storeToken` assertions check known values.

**crypto — partial mock for TokenService:**
`crypto.randomBytes` is mocked via `jest.mock('crypto')` so `generateRefreshToken` produces deterministic output. `bcrypt.hash` is also mocked (via `jest.mock` with `jest.requireActual` spread for fallback).

### Code Patterns to Follow

**NestJS TestingModule — per-service pattern:**

```typescript
import { Test, TestingModule } from '@nestjs/testing';

describe('ServiceName', () => {
  let service: ServiceName;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceName,
        { provide: TOKEN, useValue: mockDependency },
      ],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
  });
});
```

**Symbol-based token injection (NOT class-based):**
AuthService uses `@Inject(USER_SERVICE)` — the Symbol from `common/ports/user.token.ts`. Tests must use the same Symbol:
```typescript
import { USER_SERVICE } from '../../../common/ports/user.token';
// ...
{ provide: USER_SERVICE, useValue: mockUserService },
```

**Mock factory pattern (avoids cross-test state leakage):**

```typescript
const mockUserService = () => ({
  findByUsername: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  logDemographics: jest.fn(),
});

beforeEach(async () => {
  userService = mockUserService();  // Fresh mocks per test
  // ...
});
```

**Fixture data pattern:**

```typescript
const mockUser: User = {
  id: 'uuid-123',
  username: 'testuser',
  email: 'test@example.com',
  password: 'hashed-password',
  blocked: false,
  is_verified: false,
  created_at: new Date(),
  updated_at: new Date(),
};
```

**Edge case coverage pattern for refresh login (null/undefined/empty):**

```typescript
it('should throw for null/undefined/empty token', async () => {
  await expect(service.refresh(null as any)).rejects.toThrow(InvalidCredentialsException);
  await expect(service.refresh(undefined as any)).rejects.toThrow(InvalidCredentialsException);
  await expect(service.refresh('')).rejects.toThrow(InvalidCredentialsException);
});
```

### Key Design Decisions

1. **Tests already exist but must be verified.** All three test files exist with comprehensive coverage (59 test cases total). The dev agent must run the test suite, fix any failures, and verify coverage thresholds. The existing tests serve as the baseline — no need to rewrite from scratch.

2. **Real JOSE crypto in token tests.** TokenService tests generate real RSA key pairs and sign/verify real JWTs using the `jose` library. This is intentional — it validates the actual cryptographic path rather than mocking it. The `transformIgnorePatterns: node_modules/(?!jose|uuid)` in Jest config ensures jose (an ESM package) is transpiled by ts-jest.

3. **Symbol-based injection requires Symbol-based mocks.** AuthService uses `@Inject(USER_SERVICE)` and `@Inject(TOKEN_SERVICE)` — both are Symbol tokens from `common/ports/`. Tests cannot provide mocks under the class token (`IUserService`) — they must use the Symbol constant. This is already reflected in the existing tests.

4. **Partial bcrypt mock for AuthService vs. real bcrypt for UserService.** AuthService uses mock bcrypt (`jest.mock('bcrypt')`) to control `hash`/`compare` return values and test specific error paths. UserService uses real bcrypt to validate the actual password-hashing pipeline. This distinction reflects what each service tests: AuthService tests orchestration logic; UserService tests data persistence with real crypto.

5. **Partial bcrypt mock for TokenService.** The token service test uses `jest.mock('bcrypt', ...)` with `jest.requireActual` to spread the real module, then overrides specific functions. This allows testing `findUserByRefreshToken` with controlled `bcrypt.compare` return values while keeping `bcrypt.hash` functional for other paths.

6. **Fire-and-forget demographics pattern.** `userService.logDemographics` is called with `.catch(() => {})` in AuthService — it's non-critical. Tests verify it's called AND verify that if it rejects, the login/register still succeeds.

7. **Logout is best-effort.** The `logout` method wraps everything in a try-catch — it silently succeeds even if the token is invalid, DB deletion fails, or Redis blacklisting fails. Tests cover all three failure modes plus the happy path.

8. **Coverage thresholds.** The implementation doc specifies ≥ 80% statements/functions/lines and ≥ 75% branches. Existing tests are comprehensive but the actual coverage must be verified with `npm run test:cov`. Additional edge case tests may be needed if coverage falls short.

9. **No cross-test dependencies.** Each test re-creates the `TestingModule` in `beforeEach` and clears mocks in `afterEach` (or via `jest.clearAllMocks()`). No state leaks between test cases. The dev agent must verify this isolation is watertight.

10. **test:cov coverage path.** The `coverageDirectory` is `"../coverage"` (relative to `rootDir: "src"`), so the coverage report lands in `/coverage/`. Open `coverage/lcov-report/index.html` in a browser for the visual report.

### What This Story Changes

| File | Action | Description |
|------|--------|-------------|
| `src/modules/auth/__tests__/auth.service.spec.ts` | **VERIFY** | 405-line test file, 19 test cases across register/login/refresh/logout — ensure all pass and imports resolve |
| `src/modules/user/__tests__/user.service.spec.ts` | **VERIFY** | 183-line test file, 9 test cases across findByEmail/findByUsername/create/logDemographics — ensure all pass |
| `src/modules/token/__tests__/token.service.spec.ts` | **VERIFY** | 553-line test file, 31 test cases across all public methods + private helpers — ensure all pass |
| No service files are changed | — | This story produces no source code changes — only tests and verification |

### What Must Be Preserved

- All existing service business logic must continue to work unchanged
- The `AuthService.register` method uses `Promise.all` for parallel username/email lookup — cannot change to sequential
- The `AuthService.login` method distinguishes email vs username by `@` presence — must stay
- TokenService `generateTokenPair` remains `Not implemented` (it is a stub)
- TokenService `verifyAccessToken` maps JOSE errors to domain exceptions (TokenExpiredException, TokenInvalidSignatureException) — must not leak raw JOSE errors
- TokenService `blacklistToken` silently catches errors (best-effort Redis) — must preserve
- AuthService `logout` silently catches all errors (best-effort cleanup) — must preserve
- AuthService `refresh` wraps storeToken failure as `InvalidCredentialsException` — must preserve
- All dependency injection tokens (Symbols) must remain unchanged
- JOSE `transformIgnorePatterns` in Jest config must remain to transpile ESM packages

### Dependencies

- Epic 1 (all types, interfaces, entities defined — User entity, AuthToken entity, DTOs)
- Epic 2 (KeyManager for TokenService dependency — getPublicKey/getPrivateKey pattern)
- Epic 3 (AuthService, UserService, TokenService fully implemented with all 4 auth flows)
- Epic 4 (login logic with password verification, blocked check, demographics logging)
- Epic 5 (refresh logic with token rotation and expiry validation)
- Epic 6 (logout logic with token verification, DB cleanup, Redis blacklist)
- Epic 7 (JwtAuthGuard, AllExceptionsFilter — indirectly, via logout flow)
- Epic 8 (Logging module — services use Logger, but tests don't assert on log output)
- `@nestjs/testing` (already in devDependencies)
- `jose` (ESM — must be in transformIgnorePatterns)
- `bcrypt` (mocked differently per service: `jest.mock('bcrypt')` in AuthService, partial mock in TokenService, real in UserService)
- `crypto` (mocked via `jest.mock('crypto')` in TokenService)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

| File | Action |
|------|--------|
| `src/modules/auth/__tests__/auth.service.spec.ts` | VERIFY |
| `src/modules/user/__tests__/user.service.spec.ts` | VERIFY |
| `src/modules/token/__tests__/token.service.spec.ts` | VERIFY |
