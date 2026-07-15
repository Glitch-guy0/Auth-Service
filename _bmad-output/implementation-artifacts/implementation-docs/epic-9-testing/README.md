# Epic 9: Testing & Documentation

**Goal:** Add unit tests, integration tests, comprehensive documentation, and Docker configuration. System is production-ready.

**Depends on:** Epic 7 (all auth flows working), Epic 8 (logging in place)

**Deliverable:** Passing unit and integration test suites, complete project documentation, and Docker Compose deployment configuration.

---

## Story 9.1: Unit Tests — Services

### Overview

Write unit tests for all three core services — AuthService, UserService, and TokenService. Each test file isolates the service under test by mocking its dependencies (repositories, KeyManager, TokenService) using NestJS `TestingModule` with custom providers.

### Architecture References

- Architecture §2.1 defines the hexagonal port interfaces consumed by services (`IAuthService`, `IUserService`, `ITokenService`)
- ARCHITECTURE-SPINE.md §Structural Seed defines module locations for service files
- Architecture §11.2 defines expected response shapes for assertion validation
- Epic 3 stories (3.1–3.5) define AuthService and TokenService business logic
- Epic 4 story (4.2) defines AuthService.login contract

### Acceptance Criteria

- `npm run test` passes with 0 failures for AuthService, UserService, TokenService
- Test coverage report is generated (via `npm run test:cov`)
- Every public service method has at least one test case
- Tests are isolated — no real database, no real KeyManager, no real Redis

### Test Acceptance Criteria

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| UT-S1 | AuthService.register with valid DTO | Returns `{accessToken, refreshToken}` |
| UT-S2 | AuthService.register with existing username | Throws `UserExistsException` |
| UT-S3 | AuthService.register with existing email | Throws `UserExistsException` |
| UT-S4 | AuthService.login with valid credentials | Returns `{accessToken, refreshToken}` |
| UT-S5 | AuthService.login with invalid password | Throws `InvalidCredentialsException` |
| UT-S6 | AuthService.login with non-existent user | Throws `InvalidCredentialsException` |
| UT-S7 | AuthService.login with blocked user | Throws `UserBlockedException` |
| UT-S8 | AuthService.refresh with valid token | Returns new `{accessToken, refreshToken}` |
| UT-S9 | AuthService.refresh with expired token | Throws `TokenExpiredException` |
| UT-S10 | AuthService.logout with valid token | Calls deleteToken and blacklistToken |
| UT-S11 | UserService.findByEmail existing user | Returns User entity |
| UT-S12 | UserService.findByEmail no match | Returns `null` |
| UT-S13 | UserService.findByUsername existing user | Returns User entity |
| UT-S14 | UserService.create valid data | Returns created User |
| UT-S15 | TokenService.generateTokenPair | Returns `{accessToken, expiresIn}` |
| UT-S16 | TokenService.verifyAccessToken valid token | Returns decoded `JwtPayload` |
| UT-S17 | TokenService.verifyAccessToken expired token | Throws `TokenExpiredException` |

### Implementation Guidance

**File locations:**

```
src/modules/auth/auth.service.spec.ts
src/modules/user/user.service.spec.ts
src/modules/token/token.service.spec.ts
```

**Test setup pattern — NestJS TestingModule with mocked providers:**

```typescript
// src/modules/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { IUserService } from './user.service.interface';
import { ITokenService } from './token.service.interface';
import { UserExistsException } from '@shared/exceptions';
import { RegisterDto } from './dto/register.dto';

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<IUserService>;
  let tokenService: jest.Mocked<ITokenService>;

  beforeEach(async () => {
    const mockUserService: jest.Mocked<IUserService> = {
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      create: jest.fn(),
      logDemographics: jest.fn(),
    };

    const mockTokenService: jest.Mocked<ITokenService> = {
      generateTokenPair: jest.fn(),
      storeToken: jest.fn(),
      verifyAccessToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: IUserService, useValue: mockUserService },
        { provide: ITokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get(AuthService);
    userService = module.get(IUserService);
    tokenService = module.get(ITokenService);
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      const dto: RegisterDto = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'securepass123',
      };

      userService.findByEmail.mockResolvedValue(null);
      userService.findByUsername.mockResolvedValue(null);
      userService.create.mockResolvedValue({
        id: 'uuid-1',
        username: dto.username,
        email: dto.email,
        password: 'hashed',
        blocked: false,
        is_verified: false,
        created_at: new Date(),
        updated_at: new Date(),
      });
      tokenService.generateTokenPair.mockResolvedValue({
        accessToken: 'access.token.here',
        expiresIn: 86400,
      });

      const result = await service.register(dto);

      expect(result).toHaveProperty('accessToken');
      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: dto.username }),
      );
      expect(tokenService.generateTokenPair).toHaveBeenCalled();
    });

    it('should throw UserExistsException for duplicate username', async () => {
      userService.findByUsername.mockResolvedValue({
        id: 'existing',
        username: 'testuser',
        email: 'other@example.com',
        password: 'hashed',
        blocked: false,
        is_verified: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await expect(
        service.register({
          username: 'testuser',
          email: 'new@example.com',
          password: 'securepass123',
        }),
      ).rejects.toThrow(UserExistsException);
    });
  });
});
```

**Key mocking strategies:**

- **UserService:** Mock the TypeORM repository (`@InjectRepository(User)`) — return fixture data from `jest.fn()` stubs
- **TokenService:** Mock KeyManager dependency — use `jest.fn().mockResolvedValue('private-key')` for `getPrivateKey()`
- **AuthService:** Mock both IUserService and ITokenService — test orchestration logic only
- **bcrypt:** Do NOT mock bcrypt — let it hash real values for integration-level confidence within unit tests. Only mock external I/O (DB, KeyManager)
- **Transaction pattern:** Mock `createTransaction` to invoke the callback directly: `jest.spyOn(transaction, 'createTransaction').mockImplementation((cb) => cb(mockTx))`

**Coverage configuration:**

The `package.json` already has `"test:cov": "jest --coverage"`. After running, check the `coverage/` directory. Aim for:
- Statements: ≥ 80%
- Branches: ≥ 75%
- Functions: ≥ 80%
- Lines: ≥ 80%

**Running tests:**

```bash
npm run test          # Run all unit tests
npm run test:cov      # Run with coverage report
npm run test:watch    # Watch mode for development
```

### Dependencies

- Epic 1 (all types, interfaces, entities defined)
- Epic 2 (KeyManager for mocking)
- Epic 3 (AuthService, UserService, TokenService implemented)
- Epic 4 (login logic implemented)
- Epic 5 (refresh logic implemented)
- Epic 6 (logout logic implemented)

---

## Story 9.2: Unit Tests — Guards & Filters

### Overview

Write unit tests for the JWT authentication guard and the global exception filter. These are security-critical components — the guard protects all protected routes, and the filter ensures consistent error responses. Tests mock HTTP request/response objects and dependency-injected services.

### Architecture References

- Architecture §5.4 defines logout flow (guard validates tokens)
- Epic 7 stories (7.2, 7.3) define JwtAuthGuard and AllExceptionsFilter implementation
- Architecture §11.2 defines error response format enforced by the filter
- AD-5 (Single Active Session) — guard behavior with revoked tokens

### Acceptance Criteria

- `npm run test` passes with 0 failures for JwtAuthGuard, AllExceptionsFilter
- Guard tests cover: valid token, expired token, missing token, revoked token, invalid signature
- Filter tests cover: known exceptions (BaseAuthException subclasses), unknown exceptions, validation errors

### Test Acceptance Criteria

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| UT-G1 | Guard — valid JWT in Authorization header | `canActivate` returns `true`, user attached to request |
| UT-G2 | Guard — missing Authorization header | Throws `AuthenticationException` |
| UT-G3 | Guard — expired JWT | Throws `TokenExpiredException` |
| UT-G4 | Guard — token in Redis blacklist | Throws `TokenRevokedException` |
| UT-G5 | Guard — invalid JWT signature | Throws `TokenInvalidSignatureException` |
| UT-G6 | Guard — blocked user | Throws `UserBlockedException` |
| UT-F1 | Filter — catches `InvalidCredentialsException` | Returns 401 with `{success: false, error: {code: "AUTH_INVALID_CREDENTIALS", ...}}` |
| UT-F2 | Filter — catches `TokenExpiredException` | Returns 401 with code `TOKEN_EXPIRED` |
| UT-F3 | Filter — catches `UserBlockedException` | Returns 403 with code `USER_BLOCKED` |
| UT-F4 | Filter — catches `UserExistsException` | Returns 400 with code `USER_EXISTS` |
| UT-F5 | Filter — catches unknown `Error` | Returns 500 with generic message |
| UT-F6 | Filter — catches Zod validation error | Returns 400 with validation details |

### Implementation Guidance

**File locations:**

```
src/modules/auth/jwt-auth.guard.spec.ts
src/shared/exceptions/all-exceptions.filter.spec.ts
```

**Guard test setup — mock ExecutionContext:**

```typescript
// src/modules/auth/jwt-auth.guard.spec.ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ITokenService } from '../token/token.service.interface';
import { IKeyManager } from '../key/key.service.interface';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let tokenService: jest.Mocked<ITokenService>;
  let keyManager: jest.Mocked<IKeyManager>;

  beforeEach(() => {
    tokenService = {
      verifyAccessToken: jest.fn(),
    } as any;

    keyManager = {
      getPublicKey: jest.fn(),
    } as any;

    guard = new JwtAuthGuard(tokenService, keyManager);
  });

  function createMockContext(authHeader?: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: authHeader
            ? { authorization: authHeader }
            : {},
        }),
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow request with valid token', async () => {
    const payload = {
      sub: 'user-uuid',
      iat: 1000,
      iss: 'authservice',
      kid: 'key-uuid',
      exp: 9999999999,
    };

    keyManager.getPublicKey.mockResolvedValue('public-key');
    tokenService.verifyAccessToken.mockResolvedValue(payload);

    const result = await guard.canActivate(
      createMockContext('Bearer valid.jwt.token'),
    );

    expect(result).toBe(true);
  });

  it('should reject request without Authorization header', async () => {
    await expect(
      guard.canActivate(createMockContext()),
    ).rejects.toThrow(UnauthorizedException);
  });
});
```

**Filter test setup — mock ArgumentsHost:**

```typescript
// src/shared/exceptions/all-exceptions.filter.spec.ts
import { ArgumentsHost, HttpException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import {
  InvalidCredentialsException,
  TokenExpiredException,
  UserBlockedException,
} from './index';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  function createMockHost(statusCode?: number) {
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const mockRequest = {
      url: '/auth/v1/authenticate',
    };
    return {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
      getResponse: () => mockResponse,
    } as unknown as ArgumentsHost;
  }

  it('should format InvalidCredentialsException as 401', () => {
    const exception = new InvalidCredentialsException();
    const host = createMockHost();
    const response = host.switchToHttp().getResponse();

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'AUTH_INVALID_CREDENTIALS',
        }),
      }),
    );
  });

  it('should format unknown errors as 500', () => {
    const exception = new Error('Something went wrong');
    const host = createMockHost();
    const response = host.switchToHttp().getResponse();

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(500);
  });
});
```

**Key considerations:**

- The guard reads the `kid` from the JWT header, fetches the public key from KeyManager, then calls `tokenService.verifyAccessToken`. Mock both `keyManager.getPublicKey` and `tokenService.verifyAccessToken` to isolate the guard logic
- The filter receives a mix of `BaseAuthException` subclasses and unknown `Error` types — test both paths
- Redis blacklist check happens inside the guard — mock the Redis client or the token service method that checks it
- Use `jest.spyOn(console, 'error').mockImplementation()` to suppress error output during tests

### Dependencies

- Epic 1 (exception hierarchy defined)
- Epic 4 (token verification implemented)
- Epic 7 (JwtAuthGuard, AllExceptionsFilter implemented)
- Story 9.1 (service mocking patterns established)

---

## Story 9.3: Integration Tests

### Overview

Write end-to-end integration tests that exercise the full HTTP request lifecycle — from controller through service to database. These tests use NestJS's `TestModule` with a real test database (not mocks) to verify that the complete auth flow works correctly.

### Architecture References

- Architecture §5.1–5.4 defines all four auth flows (register, login, refresh, logout)
- Architecture §11.1 defines API routes and base path `/auth/v1`
- Architecture §11.2 defines response format
- Architecture §3.1–3.3 defines database schemas (PostgreSQL, MongoDB, Redis)
- AD-17 (Cross-Database Mutation Ordering) — PG first, Redis second

### Acceptance Criteria

- `npm run test:e2e` passes with 0 failures
- Tests cover all four endpoints: register, login, refresh, logout
- Tests use a dedicated test database (not production)
- Tests are isolated — each test cleans up after itself (truncates tables)
- Tests run in sequence (not parallel) to avoid state conflicts

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

### Implementation Guidance

**File locations:**

```
test/auth.e2e-spec.ts
test/jest-e2e.json
```

**E2E test setup — Supertest + NestJS TestModule:**

```typescript
// test/auth.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean test database between tests
    // Truncate users and auth_tokens tables
    // This ensures test isolation
  });

  describe('/auth/v1/register (POST)', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/auth/v1/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'securepass123',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('accessToken');
        });
    });

    it('should reject duplicate username', () => {
      // Register once
      return request(app.getHttpServer())
        .post('/auth/v1/register')
        .send({
          username: 'testuser',
          email: 'first@example.com',
          password: 'securepass123',
        })
        .expect(201)
        .then(() => {
          // Try again with same username
          return request(app.getHttpServer())
            .post('/auth/v1/register')
            .send({
              username: 'testuser',
              email: 'second@example.com',
              password: 'securepass123',
            })
            .expect(400)
            .expect((res) => {
              expect(res.body.error.code).toBe('USER_EXISTS');
            });
        });
    });
  });

  describe('/auth/v1/authenticate (POST)', () => {
    it('should login with valid credentials', async () => {
      // First register
      await request(app.getHttpServer())
        .post('/auth/v1/register')
        .send({
          username: 'logintest',
          email: 'login@example.com',
          password: 'securepass123',
        })
        .expect(201);

      // Then login
      return request(app.getHttpServer())
        .post('/auth/v1/authenticate')
        .send({
          usernameOrEmail: 'logintest',
          password: 'securepass123',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('accessToken');
        });
    });
  });
});
```

**Test database configuration:**

Create `.env.test` or configure via environment variables:

```bash
# .env.test
DATABASE_URL=postgresql://user:pass@localhost:5432/authservice_test
MONGODB_URL=mongodb://localhost:27017/authservice_test
REDIS_URL=redis://localhost:6379/1
NODE_ENV=test
JWT_ACCESS_EXPIRY=1d
JWT_REFRESH_EXPIRY=7d
BCRYPT_COST=4  # Lower cost for faster tests
PORT=3001
```

**jest-e2e.json configuration:**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^@shared/(.*)$": "<rootDir>/../src/shared/$1",
    "^@modules/(.*)$": "<rootDir>/../src/modules/$1",
    "^@config/(.*)$": "<rootDir>/../src/config/$1",
    "^@database/(.*)$": "<rootDir>/../src/database/$1"
  }
}
```

**Database cleanup strategy:**

```typescript
// Helper for test isolation
async function cleanupDatabase(dataSource: DataSource) {
  await dataSource.query('TRUNCATE TABLE auth_tokens CASCADE');
  await dataSource.query('TRUNCATE TABLE users CASCADE');
}
```

**Key considerations:**

- Use `BCRYPT_COST=4` in test env to speed up password hashing (4 vs 10 — ~16x faster)
- Set generous Jest timeouts (`jest.setTimeout(30000)`) since DB operations add latency
- The `beforeEach` hook truncates tables to ensure test isolation
- Cookie assertions for refresh tokens require parsing `Set-Cookie` headers: `res.headers['set-cookie']`
- Redis blacklist verification in logout tests can query Redis directly or test via subsequent refresh attempts

### Dependencies

- Epic 3 (registration endpoint)
- Epic 4 (login endpoint)
- Epic 5 (refresh endpoint)
- Epic 6 (logout endpoint)
- Epic 7 (guard and filter wiring)
- Running PostgreSQL, MongoDB, and Redis instances (or Docker — see Story 9.5)

---

## Story 9.4: Documentation

### Overview

Write comprehensive project documentation including a README with quick start guide, architecture overview, and API reference. Add JSDoc comments to all public service methods and interfaces so IDE tooling provides inline documentation.

### Architecture References

- Architecture §1 defines the project overview and key design decisions
- Architecture §2.1 defines hexagonal architecture diagram
- Architecture §11.1 defines all API routes
- Architecture §14 defines the technology stack
- ARCHITECTURE-SPINE.md defines structural conventions

### Acceptance Criteria

- `README.md` exists at project root with:
  - Quick start guide (prerequisites, setup, run)
  - Architecture overview with diagram
  - API reference (all endpoints with request/response examples)
  - Environment variables table
- All public service methods have JSDoc with `@param`, `@returns`, `@throws`
- All DTOs and interfaces have JSDoc descriptions

### Implementation Guidance

**File locations:**

```
README.md                              # Project root
src/modules/auth/auth.service.ts       # Add JSDoc
src/modules/user/user.service.ts       # Add JSDoc
src/modules/token/token.service.ts     # Add JSDoc
src/modules/auth/jwt-auth.guard.ts     # Add JSDoc
src/shared/exceptions/*.ts             # Add JSDoc
src/modules/auth/dto/*.ts              # Add JSDoc
```

**README.md structure:**

```markdown
# AuthService

> Scalable authentication service built with NestJS — hexagonal architecture,
> RSA-signed JWTs, refresh token rotation, per-instance key management.

## Quick Start

### Prerequisites

- Node.js ≥ 18
- PostgreSQL ≥ 14
- MongoDB ≥ 6
- Redis ≥ 7

### Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd AuthService
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Generate RSA keys
npm run setup:keys

# 4. Run database migrations
npm run db:migrate

# 5. Start development server
npm run start:dev
```

The server starts at `http://localhost:3000`. Swagger docs at `/api`.

### Docker (Alternative)

```bash
docker-compose up -d
```

## Architecture

 AuthService follows hexagonal architecture (Ports & Adapters):

 ┌─────────────────────────────────────┐
 │  Inbound Adapters                   │
 │  Controllers, Guards, Middleware    │
 └──────────────┬──────────────────────┘
                │
 ┌──────────────▼──────────────────────┐
 │  Ports (Interfaces)                 │
 │  IAuthService, IUserService,        │
 │  ITokenService, IKeyManager         │
 └──────────────┬──────────────────────┘
                │
 ┌──────────────▼──────────────────────┐
 │  Core Domain                        │
 │  Auth Use Cases, User Entity,       │
 │  Token Service                      │
 └──────────────┬──────────────────────┘
                │
 ┌──────────────▼──────────────────────┐
 │  Outbound Adapters                  │
 │  PostgreSQL, MongoDB, Redis         │
 └─────────────────────────────────────┘

## API Reference

### POST /auth/v1/register

Create a new user account.

**Request:**
```json
{
  "username": "string (min 3 chars)",
  "email": "string (valid email)",
  "password": "string (min 8 chars)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "expiresIn": 86400
  }
}
```

### POST /auth/v1/authenticate

Authenticate with username/email and password.

**Request:**
```json
{
  "usernameOrEmail": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "expiresIn": 86400
  }
}
```

### POST /auth/v1/refresh

Refresh access token using refresh token cookie.

**Cookie:** `refreshToken=<token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "expiresIn": 86400
  }
}
```

### POST /auth/v1/logout

Invalidate session and blacklist access token.

**Header:** `Authorization: Bearer <accessToken>`

**Response (200):**
```json
{
  "success": true,
  "data": null
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — (required) |
| `MONGODB_URL` | MongoDB connection string | — (required) |
| `REDIS_URL` | Redis connection string | — (required) |
| `JWT_ACCESS_EXPIRY` | Access token lifetime | `1d` |
| `JWT_REFRESH_EXPIRY` | Refresh token lifetime | `7d` |
| `BCRYPT_COST` | Bcrypt hash cost factor | `10` |
| `PORT` | Server listen port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `LOG_LEVEL` | Minimum log level | `debug` |

## Development

```bash
npm run start:dev        # Start with hot reload
npm run test             # Run unit tests
npm run test:cov         # Run with coverage
npm run test:e2e         # Run integration tests
npm run lint             # Lint and auto-fix
npm run build            # Production build
```

## License

ISC
```

**JSDoc pattern for public methods:**

```typescript
/**
 * Register a new user account.
 *
 * Validates username/email uniqueness, hashes the password with bcrypt,
 * creates the user record, and returns a token pair.
 *
 * @param dto - Registration data (username, email, password)
 * @returns Promise resolving to access token and expiration
 * @throws {UserExistsException} If username or email already exists
 * @throws {ValidationException} If input fails Zod schema validation
 *
 * @example
 * ```typescript
 * const tokens = await authService.register({
 *   username: 'alice',
 *   email: 'alice@example.com',
 *   password: 'securepass123',
 * });
 * // { accessToken: 'eyJ...', expiresIn: 86400 }
 * ```
 */
async register(dto: RegisterDto): Promise<TokenResponseDto> {
  // ...
}
```

```typescript
/**
 * Authenticate a user by username or email.
 *
 * Looks up the user, verifies the password with bcrypt, checks if the
 * account is blocked, generates a new token pair, and logs demographics.
 *
 * @param dto - Login credentials (usernameOrEmail, password)
 * @returns Promise resolving to access token and expiration
 * @throws {InvalidCredentialsException} If credentials are incorrect
 * @throws {UserBlockedException} If the user account is blocked
 */
async login(dto: LoginDto): Promise<TokenResponseDto> {
  // ...
}
```

**JSDoc for DTOs:**

```typescript
/**
 * Registration request payload.
 * Validated against RegisterSchema before reaching the controller.
 */
export const RegisterSchema = z.object({
  /** Username — minimum 3 characters, must be unique */
  username: z.string().min(3),
  /** Email — must be valid format, must be unique */
  email: z.string().email(),
  /** Password — minimum 8 characters */
  password: z.string().min(8),
});
```

### Dependencies

- Epic 1–8 (all features implemented to document)
- Story 9.3 (API endpoints verified by integration tests — document what works)

---

## Story 9.5: Docker Configuration

### Overview

Create Docker Compose configuration for consistent local development and deployment. Includes a multi-stage Dockerfile for the NestJS application and service definitions for PostgreSQL, MongoDB, and Redis with health checks.

### Architecture References

- Architecture §13.1 defines single-instance deployment architecture
- Architecture §3.1–3.3 defines database schemas and connection requirements
- Architecture §7.2 defines all environment variables

### Acceptance Criteria

- `docker-compose.yml` at project root defines four services: `app`, `postgres`, `mongodb`, `redis`
- `docker-compose up` starts all services and the NestJS app is reachable
- Health checks configured for all database services
- `Dockerfile` uses multi-stage build (build stage + production stage)
- Application connects to databases using Docker service names as hosts
- `.dockerignore` exists to exclude node_modules, .git, coverage, etc.

### Test Acceptance Criteria

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| DC-1 | `docker-compose up --build` | All 4 services start without errors |
| DC-2 | App health check | `GET /health` returns 200 (if implemented) or app responds on port 3000 |
| DC-3 | PostgreSQL health check | `pg_isready` passes within 10 seconds |
| DC-4 | MongoDB health check | `mongosh --eval "db.runCommand({ping:1})"` passes |
| DC-5 | Redis health check | `redis-cli ping` returns `PONG` |
| DC-6 | App connects to PostgreSQL | Registration endpoint works (creates user in DB) |
| DC-7 | App connects to MongoDB | Demographics logged on login |
| DC-8 | App connects to Redis | Logout blacklists token |
| DC-9 | `docker-compose down` | All services stop cleanly |

### Implementation Guidance

**File locations:**

```
Dockerfile
docker-compose.yml
.dockerignore
```

**Multi-stage Dockerfile:**

```dockerfile
# ---- Build Stage ----
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (layer caching)
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Prune devDependencies
RUN npm prune --production

# ---- Production Stage ----
FROM node:18-alpine AS production

WORKDIR /app

# Security: run as non-root
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Copy built artifacts and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy keys directory if it exists (mounted via volume in dev)
# In production, mount keys.json as a volume

# Set file permissions for keys
RUN chmod -R 750 /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/main"]
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    ports:
      - '${PORT:-3000}:3000'
    environment:
      - DATABASE_URL=postgresql://authuser:authpass@postgres:5432/authservice
      - MONGODB_URL=mongodb://mongodb:27017/authservice
      - REDIS_URL=redis://redis:6379
      - JWT_ACCESS_EXPIRY=${JWT_ACCESS_EXPIRY:-1d}
      - JWT_REFRESH_EXPIRY=${JWT_REFRESH_EXPIRY:-7d}
      - BCRYPT_COST=${BCRYPT_COST:-10}
      - PORT=3000
      - NODE_ENV=production
      - LOG_LEVEL=${LOG_LEVEL:-info}
    depends_on:
      postgres:
        condition: service_healthy
      mongodb:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./keys.json:/app/keys.json:ro
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: authuser
      POSTGRES_PASSWORD: authpass
      POSTGRES_DB: authservice
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U authuser -d authservice']
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  mongodb:
    image: mongo:7
    ports:
      - '27017:27017'
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ['CMD', 'mongosh', '--eval', 'db.runCommand({ping:1})']
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 5s

volumes:
  postgres_data:
  mongo_data:
  redis_data:
```

**.dockerignore:**

```
node_modules
dist
coverage
.env
.env.*
!.env.example
.git
.gitignore
*.md
docker-compose.yml
Dockerfile
.dockerignore
test/
*.spec.ts
*.e2e-spec.ts
.ok/
_bmad-output/
```

**Key considerations:**

- **Layer caching:** Copy `package.json` before `src/` so `npm ci` layer is cached when only source changes
- **Non-root user:** Production container runs as `appuser` — security best practice
- **Health checks:** Use `condition: service_healthy` in `depends_on` so the app waits for databases
- **Volumes:** Named volumes (`postgres_data`, `mongo_data`, `redis_data`) persist data across container restarts
- **Keys volume:** Mount `keys.json` read-only — private keys never baked into the image
- **Environment variables:** Use `${VAR:-default}` syntax so `.env` values override defaults
- **Test env:** Create `docker-compose.test.yml` override that uses the test database and lower bcrypt cost

**Docker Compose test override (`docker-compose.test.yml`):**

```yaml
version: '3.8'

services:
  app:
    environment:
      - DATABASE_URL=postgresql://authuser:authpass@postgres:5432/authservice_test
      - MONGODB_URL=mongodb://mongodb:27017/authservice_test
      - REDIS_URL=redis://redis:6379/1
      - BCRYPT_COST=4
      - NODE_ENV=test
      - LOG_LEVEL=warn
    command: npm run test:e2e

  postgres:
    environment:
      POSTGRES_DB: authservice_test

  mongodb:
    # Same container, different database name in connection string
```

### Dependencies

- Epic 1–8 (all features implemented and runnable)
- Story 9.3 (integration tests define the test database configuration)
- `keys.json` must exist (from `npm run setup:keys` — Epic 2)

---

## Summary

| Story | Key Deliverable | File Locations |
|-------|----------------|----------------|
| 9.1 | Unit tests for services | `src/modules/auth/auth.service.spec.ts`, `src/modules/user/user.service.spec.ts`, `src/modules/token/token.service.spec.ts` |
| 9.2 | Unit tests for guards & filters | `src/modules/auth/jwt-auth.guard.spec.ts`, `src/shared/exceptions/all-exceptions.filter.spec.ts` |
| 9.3 | Integration tests for API endpoints | `test/auth.e2e-spec.ts`, `test/jest-e2e.json` |
| 9.4 | Project documentation + JSDoc | `README.md`, `src/**/*.ts` (JSDoc annotations) |
| 9.5 | Docker deployment configuration | `Dockerfile`, `docker-compose.yml`, `.dockerignore` |

**Note:** Epic 9 is the final epic in the implementation sequence. All prior epics (1–8) must be complete before starting. Tests validate existing behavior — they do not add new features. Documentation captures what exists. Docker enables consistent deployment of the finished system.
