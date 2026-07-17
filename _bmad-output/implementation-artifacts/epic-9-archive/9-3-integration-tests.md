# Story 9.3: Integration Tests

Status: review

## Story

As a developer,
I want end-to-end integration tests for all four auth endpoints,
so that I can verify the complete HTTP request lifecycle works correctly from controller through service to database.

## Acceptance Criteria

1. **Given** a running NestJS application with test database
   **When** `npm run test:e2e` is executed
   **Then** all integration tests pass with 0 failures

2. **Given** the test suite
   **When** tests are running
   **Then** they use a dedicated test database (not production)

3. **Given** a test has completed
   **When** the next test begins
   **Then** all database tables are truncated to ensure test isolation

4. **Given** the test configuration
   **When** bcrypt hashing is performed
   **Then** BCRYPT_COST=4 is used for faster test execution

### Test Acceptance Criteria

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| IT-1 | POST /auth/v1/register — valid data | 201, returns `{accessToken, refreshToken}` |
| IT-2 | POST /auth/v1/register — duplicate username | 400, error code `USER_EXISTS` |
| IT-3 | POST /auth/v1/register — invalid email format | 400, validation error |
| IT-4 | POST /auth/v1/register — short password | 400, validation error |
| IT-5 | POST /auth/v1/authenticate — valid credentials | 200, returns `{accessToken, refreshToken}` |
| IT-6 | POST /auth/v1/authenticate — wrong password | 401, error code `AUTH_INVALID_CREDENTIALS` |
| IT-7 | POST /auth/v1/authenticate — non-existent user | 401, error code `AUTH_INVALID_CREDENTIALS` |
| IT-8 | POST /auth/v1/refresh — valid refresh token cookie | 200, returns new tokens |
| IT-9 | POST /auth/v1/refresh — missing cookie | 401 |
| IT-10 | POST /auth/v1/refresh — expired refresh token | 401, error code `TOKEN_EXPIRED` |
| IT-11 | POST /auth/v1/logout — valid access token | 200, token blacklisted |
| IT-12 | POST /auth/v1/logout — use same access token again | Token is blacklisted (replay rejected) |
| IT-13 | Full flow — register → refresh → logout → refresh (should fail) | End-to-end session lifecycle works |
| IT-14 | POST /auth/v1/authenticate — blocked user | 403, error code `USER_BLOCKED` |

## Tasks / Subtasks

- [x] Task 1: Update `test/jest-e2e.json` — add moduleNameMapper for path aliases (AC: 1)
  - [x] Add `moduleNameMapper` entries for `@shared/*`, `@modules/*`, `@config/*`, `@database/*`
  - [x] Ensure `rootDir` is set to `"."` (resolves to `test/` directory)
  - [x] Verify `testRegex` matches `.e2e-spec.ts$`

- [x] Task 2: Create `.env.test` configuration file (AC: 2, 4)
  - [x] Create file at project root: `.env.test`
  - [x] Set `DATABASE_URL` to `postgresql://user:pass@localhost:5432/authservice_test`
  - [x] Set `MONGODB_URL` to `mongodb://localhost:27017/authservice_test`
  - [x] Set `REDIS_URL` to `redis://localhost:6379/1`
  - [x] Set `NODE_ENV=test`, `BCRYPT_COST=4`, `PORT=3001`
  - [x] Set `JWT_ACCESS_EXPIRY=1d`, `JWT_REFRESH_EXPIRY=7d`

- [x] Task 3: Create `test/auth.e2e-spec.ts` with all 14 test scenarios (AC: 1, 3)
  - [x] Set up `beforeAll` — create NestJS test module with AppModule, configure ValidationPipe, cookieParser, AllExceptionsFilter, await app.init()
  - [x] Set up `afterAll` — close app and data source
  - [x] Set up `beforeEach` — truncate `users` and `auth_tokens` tables for test isolation
  - [x] Set Jest timeout to 30000ms for database operations
  - [x] Implement IT-1: POST /auth/v1/register with valid data — expect 201, success, accessToken
  - [x] Implement IT-2: POST /auth/v1/register duplicate username — register then register again — expect 400, error code USER_EXISTS
  - [x] Implement IT-3: POST /auth/v1/register invalid email — expect 400 validation error
  - [x] Implement IT-4: POST /auth/v1/register short password — expect 400 validation error
  - [x] Implement IT-5: POST /auth/v1/authenticate valid credentials — register then login — expect 200, accessToken
  - [x] Implement IT-6: POST /auth/v1/authenticate wrong password — register then login with wrong password — expect 401, AUTH_INVALID_CREDENTIALS
  - [x] Implement IT-7: POST /auth/v1/authenticate non-existent user — expect 401, AUTH_INVALID_CREDENTIALS
  - [x] Implement IT-8: POST /auth/v1/refresh valid cookie — register, capture Set-Cookie, send refresh with cookie — expect 200, new tokens
  - [x] Implement IT-9: POST /auth/v1/refresh missing cookie — expect 401
  - [x] Implement IT-10: POST /auth/v1/refresh expired token — requires manipulating token expiry or waiting (use short expiry or mock) — expect 401, TOKEN_EXPIRED
  - [x] Implement IT-11: POST /auth/v1/logout valid token — register, get accessToken, call logout with Bearer — expect 200
  - [x] Implement IT-12: POST /auth/v1/logout replay — register, logout, then logout again with same token — expect success or blacklist rejection
  - [x] Implement IT-13: Full flow — register → refresh → logout → refresh (should fail) — end-to-end session lifecycle
  - [x] Implement IT-14: POST /auth/v1/authenticate blocked user — register, manually block user in DB, then login — expect 403, USER_BLOCKED

- [ ] Task 4: Verify test execution (AC: 1)
  - [ ] Run `npm run test:e2e` with databases running
  - [ ] Confirm all 14 test scenarios pass
  - [ ] Confirm test database isolation (no data leaked between tests)

## Dev Notes

### Existing Code Context

**E2E Test Configuration** (`test/jest-e2e.json`):

- Currently missing `moduleNameMapper` for path aliases — tests that import using `@shared/*`, `@modules/*`, `@config/*`, `@database/*` will fail with module resolution errors
- `rootDir` is `"."` (resolves to `test/` directory when Jest loads the config)
- `testRegex` is `.e2e-spec.ts$`
- Config file is at `test/jest-e2e.json`, run via `jest --config ./test/jest-e2e.json`

**App Configuration** (`src/app.module.ts`):

- Root module imports: `LoggingModule.forRoot()`, `ConfigModule.forRoot({ isGlobal: true })`, `AuthModule`, `UserModule`, `TokenModule`, `KeyModule`, `RedisModule`
- Registers `LoggingInterceptor` globally via `APP_INTERCEPTOR`
- ConfigModule is global — environment variables are available everywhere
- The test module imports `AppModule` directly, which boots everything including Redis, PostgreSQL, MongoDB connections

**Main Bootstrap** (`src/main.ts`):

- Uses `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- Registers `AllExceptionsFilter` globally
- Uses `cookieParser()` middleware for reading refresh tokens from cookies
- The e2e test setup must replicate these: ValidationPipe, AllExceptionsFilter, cookieParser

**Auth Controller** (`src/modules/auth/auth.controller.ts`):

- `POST /auth/v1/register` — Body: `{ username, email, password }` → 201 CREATED
- `POST /auth/v1/authenticate` — Body: `{ usernameOrEmail, password }` → 200 OK
- `POST /auth/v1/refresh` — Reads `refreshToken` from `req.cookies`, sets new `Set-Cookie` → 200 OK
- `POST /auth/v1/logout` — Reads `Authorization: Bearer <token>`, clears `refreshToken` cookie → 200 OK
- Uses `ZodValidationPipe` for DTO validation with `RegisterSchema` and `LoginSchema`
- Refresh endpoint uses `@Res({ passthrough: true })` — must handle response object in tests

**Auth Service** (`src/modules/auth/auth.service.ts`):

- `register(dto, ip?)` — Checks username/email uniqueness, creates user, generates token pair, stores refresh token hash, logs demographics
- `login(dto, ip?)` — Looks up user by email or username, checks blocked status, compares bcrypt password, generates tokens
- `refresh(refreshToken)` — Validates token string, finds user by refresh token, checks expiry, generates new token pair, rotates refresh token
- `logout(accessToken)` — Verifies access token, deletes refresh tokens from DB, blacklists access token in Redis (best-effort)
- Uses `this.BCRYPT_SALT_ROUNDS = 12` — this is the hardcoded salt rounds in the service; tests that call register/login directly will use 12 rounds regardless of BCRYPT_COST env var
- The service is injected via custom tokens: `@Inject(USER_SERVICE)` and `@Inject(TOKEN_SERVICE)`

### Test Database Configuration

Create `.env.test` at project root:

```bash
# .env.test
DATABASE_URL=postgresql://user:pass@localhost:5432/authservice_test
MONGODB_URL=mongodb://localhost:27017/authservice_test
REDIS_URL=redis://localhost:6379/1
NODE_ENV=test
JWT_ACCESS_EXPIRY=1d
JWT_REFRESH_EXPIRY=7d
BCRYPT_COST=4
PORT=3001
```

Load `.env.test` in the e2e test setup before module creation:

```typescript
import { config } from 'dotenv';
config({ path: '.env.test' });
```

**Note:** `AuthService` has `this.BCRYPT_SALT_ROUNDS = 12` hardcoded — the service does not read `BCRYPT_COST` from env. If tests call `authService.register()` or `authService.login()` directly, they will use 12 rounds regardless of env. The BCRYPT_COST env var is relevant only if the service reads it. Verify whether `AuthService` should be refactored to read from env, or accept the slower hashing during e2e tests.

### Cleanup Strategy

Truncate tables in `beforeEach` for test isolation:

```typescript
import { DataSource } from 'typeorm';

async function cleanupDatabase(dataSource: DataSource) {
  await dataSource.query('TRUNCATE TABLE auth_tokens CASCADE');
  await dataSource.query('TRUNCATE TABLE users CASCADE');
}
```

Also clear Redis blacklist keys between tests:

```typescript
async function cleanupRedis(redisClient: any) {
  // Flush only the test DB (default: Redis DB 1 for tests)
  await redisClient.flushdb();
}
```

### Code Patterns

**E2E test file structure** (`test/auth.e2e-spec.ts`):

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { config } from 'dotenv';
config({ path: '.env.test' });

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/shared/exceptions/all-exceptions.filter';
import { DataSource } from 'typeorm';
import cookieParser from 'cookie-parser';

jest.setTimeout(30000);

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE users CASCADE');
    await dataSource.query('TRUNCATE TABLE auth_tokens CASCADE');
    // Also clear Redis test DB
  });

  describe('/auth/v1/register (POST)', () => {
    it('IT-1: should register a new user', () => {
      return request(app.getHttpServer())
        .post('/auth/v1/register')
        .send({ username: 'testuser', email: 'test@example.com', password: 'securepass123' })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('accessToken');
          expect(res.body.data).toHaveProperty('expiresIn');
        });
    });

    it('IT-2: should reject duplicate username', async () => {
      await request(app.getHttpServer())
        .post('/auth/v1/register')
        .send({ username: 'dupuser', email: 'first@example.com', password: 'securepass123' })
        .expect(201);

      return request(app.getHttpServer())
        .post('/auth/v1/register')
        .send({ username: 'dupuser', email: 'second@example.com', password: 'securepass123' })
        .expect(400)
        .expect((res) => {
          expect(res.body.error.code).toBe('USER_EXISTS');
        });
    });

    it('IT-3: should reject invalid email format', () => {
      return request(app.getHttpServer())
        .post('/auth/v1/register')
        .send({ username: 'validuser', email: 'not-an-email', password: 'securepass123' })
        .expect(400);
    });

    it('IT-4: should reject short password', () => {
      return request(app.getHttpServer())
        .post('/auth/v1/register')
        .send({ username: 'validuser', email: 'test@example.com', password: '123' })
        .expect(400);
    });
  });

  describe('/auth/v1/authenticate (POST)', () => {
    it('IT-5: should login with valid credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/v1/register')
        .send({ username: 'logintest', email: 'login@example.com', password: 'securepass123' })
        .expect(201);

      return request(app.getHttpServer())
        .post('/auth/v1/authenticate')
        .send({ usernameOrEmail: 'logintest', password: 'securepass123' })
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('accessToken');
          expect(res.body.data).toHaveProperty('expiresIn');
        });
    });

    // IT-6, IT-7, IT-14 follow similar patterns
  });

  describe('/auth/v1/refresh (POST)', () => {
    // IT-8, IT-9, IT-10
    // Cookie assertions via res.headers['set-cookie']
  });

  describe('/auth/v1/logout (POST)', () => {
    // IT-11, IT-12
  });

  describe('Full flow', () => {
    // IT-13
  });
});
```

**Assertion patterns:**

- Status codes: `.expect(201)`, `.expect(200)`, `.expect(400)`, `.expect(401)`, `.expect(403)`
- Response body: `res.body.success`, `res.body.data.accessToken`, `res.body.data.expiresIn`
- Error responses: `res.body.error.code` (e.g. `USER_EXISTS`, `AUTH_INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `USER_BLOCKED`)
- Cookie assertions: `res.headers['set-cookie']` — parse to extract `refreshToken` value for subsequent requests
- Cookie forwarding for refresh: use `.set('Cookie', `refreshToken=${token}`)` on supertest request

### Key Considerations

1. **jest-e2e.json moduleNameMapper.** The current config is missing `moduleNameMapper` — all imports using `@shared/*`, `@modules/*`, `@config/*`, `@database/*` will fail. Since `rootDir` is `"."` (resolves to `test/`), paths use `../src/` prefix:
   ```json
   "moduleNameMapper": {
     "^@shared/(.*)$": "<rootDir>/../src/shared/$1",
     "^@modules/(.*)$": "<rootDir>/../src/modules/$1",
     "^@config/(.*)$": "<rootDir>/../src/config/$1",
     "^@database/(.*)$": "<rootDir>/../src/database/$1"
   }
   ```

2. **BCRYPT_COST and test speed.** `AuthService` hardcodes `this.BCRYPT_SALT_ROUNDS = 12`. If the service doesn't read from env, tests will use 12 rounds (~250ms per hash). Verify whether the service should be refactored to read `BCRYPT_COST` from env or if 12 rounds is acceptable for a small test suite. The `.env.test` should set `BCRYPT_COST=4` regardless.

3. **Jest timeout.** Set `jest.setTimeout(30000)` globally — DB operations, bcrypt hashing, and HTTP calls add latency. Individual test timeouts can override if needed.

4. **Cookie assertions.** The refresh endpoint reads `refreshToken` from `req.cookies` and sets a new `Set-Cookie` header. Extract the cookie from the register response:
   ```typescript
   const cookies = res.headers['set-cookie'];
   const refreshToken = cookies.find((c: string) => c.startsWith('refreshToken=')).split(';')[0].split('=')[1];
   ```

5. **Redis blacklist.** Logout blacklists the access token in Redis. IT-12 verifies the blacklist works — after logout, attempting to use the same token (logout again or access a protected route) should be rejected. IT-13 verifies the full lifecycle: refresh token rotation means old refresh tokens become invalid after use.

6. **Test isolation.** `beforeEach` truncates `users` and `auth_tokens` tables. Also clear Redis test DB (DB 1) between tests. This prevents cross-test pollution and ensures deterministic results.

7. **ConfigModule loading.** `ConfigModule.forRoot({ isGlobal: true })` loads `.env` by default. The e2e test must call `dotenv.config({ path: '.env.test' })` BEFORE the module is compiled, or configure the module to load `.env.test` explicitly.

8. **AllExceptionsFilter registration.** The controller throws exceptions (e.g., `UserExistsException`, `InvalidCredentialsException`) that are caught by `AllExceptionsFilter`. The test app must register this filter to get consistent error response shapes.

9. **Versioned routes.** All endpoints are versioned with `@Version('v1')` — routes are `/auth/v1/register`, `/auth/v1/authenticate`, `/auth/v1/refresh`, `/auth/v1/logout`.

### Dependencies

- Epic 3 (registration endpoint: POST /auth/v1/register)
- Epic 4 (login endpoint: POST /auth/v1/authenticate)
- Epic 5 (refresh endpoint: POST /auth/v1/refresh)
- Epic 6 (logout endpoint: POST /auth/v1/logout)
- Epic 7 (guard and filter wiring — AllExceptionsFilter must be registered)
- Running PostgreSQL instance with `authservice_test` database
- Running MongoDB instance (demographics logging — failure is caught, tests may pass without it)
- Running Redis instance with DB 1 available for test blacklist keys
- Existing `.env` file or environment variables for database credentials
- `supertest` — already in devDependencies
- `@types/supertest` — verify it's installed
- `cookie-parser` and `@types/cookie-parser` — verify it's installed

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

| File | Action |
|------|--------|
| `test/jest-e2e.json` | UPDATE |
| `.env.test` | CREATE |
| `test/auth.e2e-spec.ts` | CREATE |
