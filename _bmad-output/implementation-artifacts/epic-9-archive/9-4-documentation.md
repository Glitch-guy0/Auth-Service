# Story 9.4: Documentation

Status: review

## Story

As a developer onboarding to the project,
I want a comprehensive README.md at the project root and JSDoc on all public methods, interfaces, and DTOs,
so that new contributors can set up, understand, and extend the service without reading the full codebase.

## Acceptance Criteria

1. **Given** the project root
   **When** I open `README.md`
   **Then** it must contain Quick Start guide, Architecture overview with hexagonal diagram, API reference for all 4 endpoints, and Environment Variables table

2. **Given** the auth service (`src/modules/auth/auth.service.ts`)
   **When** I inspect `register()`, `login()`, `refresh()`, `logout()`
   **Then** each method has JSDoc with `@param`, `@returns`, `@throws` documenting all exception paths

3. **Given** the user service (`src/modules/user/user.service.ts`)
   **When** I inspect `findByEmail()`, `findByUsername()`, `create()`, `logDemographics()`
   **Then** each method has JSDoc with `@param`, `@returns`, `@throws`

4. **Given** the token service (`src/modules/token/token.service.ts`)
   **When** I inspect `verifyAccessToken()`, `storeToken()`, `findUserByRefreshToken()`, `deleteRefreshTokenByUserId()`, `blacklistToken()`
   **Then** each public method has JSDoc with `@param`, `@returns`, `@throws`

5. **Given** the JWT auth guard (`src/modules/auth/guards/jwt-auth.guard.ts`)
   **When** I inspect `canActivate()`
   **Then** it has JSDoc with `@param`, `@returns`, `@throws`

6. **Given** DTO schemas (`register.dto.ts`, `login.dto.ts`, `token-response.dto.ts`)
   **When** I inspect each field
   **Then** each Zod schema property has an inline `/** */` JSDoc comment describing its purpose and constraints

7. **Given** port interfaces (`auth.port.ts`, `user.port.ts`, `token.port.ts`)
   **When** I inspect any method signature
   **Then** each method has JSDoc with `@param`, `@returns`, `@throws`

8. **Given** exception classes (`base.exception.ts`, `authentication.exception.ts`, `validation.exception.ts`, `authorization.exception.ts`)
   **When** I inspect each class
   **Then** each class and its properties have JSDoc descriptions

## Tasks / Subtasks

- [x] Task 1: Create `README.md` at project root (AC: 1)
  - [x] Write Quick Start section with prerequisites, setup steps, and Docker alternative
  - [x] Write Architecture section with hexagonal diagram (ASCII art)
  - [x] Write API Reference with all 4 endpoints: register, authenticate, refresh, logout
  - [x] Write Environment Variables table
  - [x] Write Development commands section
  - [x] Write License section

- [x] Task 2: Add JSDoc to `AuthService` (AC: 2)
  - [x] Add JSDoc to `register(dto, ip?)` — document uniqueness checks, bcrypt hashing, token generation, demographics logging; `@throws UserExistsException`, `@throws ValidationException`
  - [x] Add JSDoc to `login(dto, ip?)` — document username/email lookup, password verification, blocked account check, token rotation; `@throws InvalidCredentialsException`, `@throws UserBlockedException`
  - [x] Add JSDoc to `refresh(refreshToken)` — document token lookup, expiry check, rotation; `@throws InvalidCredentialsException`, `@throws TokenExpiredException`
  - [x] Add JSDoc to `logout(accessToken)` — document token verification, DB cleanup, Redis blacklist (best-effort)

- [x] Task 3: Add JSDoc to `UserService` (AC: 3)
  - [x] Add JSDoc to `findByEmail(email)` — `@param email`, `@returns User | null`
  - [x] Add JSDoc to `findByUsername(username)` — `@param username`, `@returns User | null`
  - [x] Add JSDoc to `create(dto)` — document bcrypt hashing, user entity creation; `@param dto`, `@returns User`
  - [x] Add JSDoc to `logDemographics(userId, ip, location?)` — `@param userId`, `@param ip`, `@param location`

- [x] Task 4: Add JSDoc to `TokenService` (AC: 4)
  - [x] Add JSDoc to `storeToken(userId, tokenHash, expiresAt)` — document upsert pattern
  - [x] Add JSDoc to `verifyAccessToken(token)` — document KID lookup, SPKI import, jose verify; `@throws TokenInvalidSignatureException`, `@throws TokenExpiredException`
  - [x] Add JSDoc to `findUserByRefreshToken(rawToken)` — document linear bcrypt comparison scan; `@returns {userId, expiresAt} | null`
  - [x] Add JSDoc to `deleteRefreshTokenByUserId(userId)` — document DELETE query
  - [x] Add JSDoc to `blacklistToken(token, userId)` — document Redis SET with TTL, best-effort semantics

- [x] Task 5: Add JSDoc to `JwtAuthGuard` (AC: 5)
  - [x] Add JSDoc to class — describe purpose (validates bearer token + blacklist)
  - [x] Add JSDoc to `canActivate(context)` — document token extraction, verification, blacklist check, request enrichment; `@throws UnauthorizedException`

- [x] Task 6: Add JSDoc to DTO schemas (AC: 6)
  - [x] Add JSDoc to `RegisterSchema` — describe registration request payload
  - [x] Add inline JSDoc to `username` — min 3 chars, unique
  - [x] Add inline JSDoc to `email` — valid format, unique
  - [x] Add inline JSDoc to `password` — min 8 chars
  - [x] Add JSDoc to `LoginSchema` — describe login request payload
  - [x] Add inline JSDoc to `usernameOrEmail` — min 3, max 254
  - [x] Add inline JSDoc to `password` — min 8, max 20
  - [x] Add JSDoc to `TokenResponseSchema` — describe token pair response
  - [x] Add inline JSDoc to `accessToken`
  - [x] Add inline JSDoc to `refreshToken`
  - [x] Add inline JSDoc to `expiresIn`

- [x] Task 7: Add JSDoc to port interfaces (AC: 7)
  - [x] Add JSDoc to `IAuthService` interface and all 4 methods
  - [x] Add JSDoc to `IUserService` interface and all 4 methods
  - [x] Add JSDoc to `ITokenService` interface and all 6 methods

- [x] Task 8: Add JSDoc to exception classes (AC: 8)
  - [x] Add JSDoc to `BaseAuthException` — describe abstract base with `statusCode`, `errorCode`, `timestamp`, `toJSON()`
  - [x] Add JSDoc to `AuthenticationException`, `InvalidCredentialsException`, `TokenExpiredException`, `TokenRevokedException`, `TokenInvalidSignatureException`
  - [x] Add JSDoc to `AuthorizationException`, `UserBlockedException`
  - [x] Add JSDoc to `ValidationException`, `UserExistsException`

## Dev Notes

### Existing Code State

**README.md**: Does not exist at project root. Must be created from scratch.

**AuthService** (`src/modules/auth/auth.service.ts:1-187`):
- 4 public methods: `register()`, `login()`, `refresh()`, `logout()`
- Implements `IAuthService` port
- Injects `IUserService` (via `USER_SERVICE` token) and `ITokenService` (via `TOKEN_SERVICE` token)
- Uses `bcrypt` for password hashing (salt rounds: 12) and refresh token hashing
- Calls `userService.logDemographics()` as fire-and-forget (`.catch(() => {}))
- **No JSDoc on any method** — all 4 methods need complete JSDoc

**UserService** (`src/modules/user/user.service.ts:1-49`):
- 4 public methods: `findByEmail()`, `findByUsername()`, `create()`, `logDemographics()`
- Implements `IUserService` port
- Uses TypeORM `@InjectRepository(User)` for database access
- `DemographicsService` is `@Optional()` — can be null when logging module is not configured
- **No JSDoc on any method**

**TokenService** (`src/modules/token/token.service.ts:1-237`):
- 5 public methods: `storeToken()`, `verifyAccessToken()`, `findUserByRefreshToken()`, `deleteRefreshTokenByUserId()`, `blacklistToken()`
- `generateTokenPair()` exists but throws `'Not implemented'` — document this
- 2 private methods: `generateAccessToken()`, `generateRefreshToken()` — no JSDoc needed (private)
- Uses `jose` for JWT verification (`importSPKI`, `jwtVerify`)
- Uses `bcrypt` for refresh token comparison (linear scan)
- Uses `RedisService` for token blacklisting
- `findUserByRefreshToken()` does a linear scan over all auth_tokens — O(n) per lookup
- **No JSDoc on any public method**

**JwtAuthGuard** (`src/modules/auth/guards/jwt-auth.guard.ts:1-63`):
- 1 public method: `canActivate()`
- 1 private method: `checkBlacklist()` — no JSDoc needed (private)
- Implements `CanActivate` from `@nestjs/common`
- Injects `ITokenService` and `RedisService`
- Reads `request.accessToken` set by auth middleware
- Blacklist check is fail-open (returns `false` on Redis error)
- **No JSDoc on class or `canActivate()`**

**DTOs**:
- `register.dto.ts` — `RegisterSchema` (3 fields: username, email, password) + type alias
- `login.dto.ts` — `LoginSchema` (2 fields: usernameOrEmail, password) + type alias
- `token-response.dto.ts` — `TokenResponseSchema` (3 fields: accessToken, refreshToken, expiresIn) + type alias
- **No inline JSDoc on any schema or property**

**Port Interfaces**:
- `auth.port.ts` — `IAuthService` with 4 method signatures
- `user.port.ts` — `IUserService` with 4 method signatures
- `token.port.ts` — `ITokenService` with 6 method signatures
- **No JSDoc on any interface or method**

**Exception Classes**:
- `base.exception.ts` — abstract `BaseAuthException` with `statusCode`, `errorCode`, `timestamp`, `toJSON()`
- `authentication.exception.ts` — 5 classes: `AuthenticationException`, `InvalidCredentialsException`, `TokenExpiredException`, `TokenRevokedException`, `TokenInvalidSignatureException`
- `authorization.exception.ts` — 2 classes: `AuthorizationException`, `UserBlockedException`
- `validation.exception.ts` — 2 classes: `ValidationException`, `UserExistsException`
- **No JSDoc on any class**

### Architecture References

- **Section 1 — Project Overview** (`architecture.md`): Defines the service as a NestJS authentication service with hexagonal architecture, RSA-signed JWTs, refresh token rotation, per-instance key management.
- **Section 2.1 — Hexagonal Architecture Diagram** (`architecture.md`): Shows inbound adapters (controllers, guards) → ports (interfaces) → core domain (use cases, entities) → outbound adapters (PostgreSQL, MongoDB, Redis).
- **Section 11.1 — API Routes** (`architecture.md`): Documents all 4 auth endpoints — POST `/auth/v1/register`, `/auth/v1/authenticate`, `/auth/v1/refresh`, `/auth/v1/logout`.
- **Section 14 — Technology Stack** (`architecture.md`): Lists NestJS 11, TypeScript, PostgreSQL, MongoDB, Redis, jose, bcrypt, pino, Zod.
- **ARCHITECTURE-SPINE.md**: Defines structural conventions for module boundaries, port naming, and dependency injection patterns.

### README Structure Map

The README.md follows this exact structure (from implementation doc lines 651–831):

```
# AuthService
> Tagline

## Quick Start
### Prerequisites (Node.js ≥ 18, PostgreSQL ≥ 14, MongoDB ≥ 6, Redis ≥ 7)
### Setup (clone → install → .env → keys → migrate → dev)
### Docker (Alternative)

## Architecture
[Hexagonal ASCII diagram]
Ports & Adapters layered description

## API Reference
### POST /auth/v1/register (request/response JSON examples)
### POST /auth/v1/authenticate
### POST /auth/v1/refresh (cookie-based)
### POST /auth/v1/logout (header-based)

## Environment Variables
| Variable | Description | Default |

## Development
npm run start:dev, test, test:cov, test:e2e, lint, build

## License
ISC
```

### JSDoc Patterns

**Service method pattern** (from implementation doc lines 835–860):
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
```

**DTO field pattern** (from implementation doc lines 879–894):
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

**Guard method pattern**:
```typescript
/**
 * Validate the incoming request by checking the bearer access token.
 *
 * Extracts the token from the request (set by AuthMiddleware), verifies
 * it via TokenService, checks Redis blacklist, and enriches the request
 * with the authenticated user's ID.
 *
 * @param context - NestJS execution context providing the HTTP request
 * @returns Promise resolving to true if the token is valid and not revoked
 * @throws {UnauthorizedException} If token is missing, invalid, expired, or revoked
 */
```

### What This Story Changes

| File                                               | Action     | Description                                               |
| -------------------------------------------------- | ---------- | --------------------------------------------------------- |
| `README.md`                                        | **CREATE** | Project root README with Quick Start, Architecture, API   |
| `src/modules/auth/auth.service.ts`                 | **UPDATE** | Add JSDoc to all 4 public methods                         |
| `src/modules/user/user.service.ts`                 | **UPDATE** | Add JSDoc to all 4 public methods                         |
| `src/modules/token/token.service.ts`               | **UPDATE** | Add JSDoc to all 5 public methods                         |
| `src/modules/auth/guards/jwt-auth.guard.ts`        | **UPDATE** | Add JSDoc to class and `canActivate()`                   |
| `src/modules/auth/dto/register.dto.ts`             | **UPDATE** | Add JSDoc to schema and all fields                        |
| `src/modules/auth/dto/login.dto.ts`                | **UPDATE** | Add JSDoc to schema and all fields                        |
| `src/modules/auth/dto/token-response.dto.ts`       | **UPDATE** | Add JSDoc to schema and all fields                        |
| `src/common/ports/auth.port.ts`                    | **UPDATE** | Add JSDoc to interface and all 4 methods                  |
| `src/common/ports/user.port.ts`                    | **UPDATE** | Add JSDoc to interface and all 4 methods                  |
| `src/common/ports/token.port.ts`                   | **UPDATE** | Add JSDoc to interface and all 6 methods                  |
| `src/shared/exceptions/base.exception.ts`          | **UPDATE** | Add JSDoc to class, properties, and `toJSON()`            |
| `src/shared/exceptions/authentication.exception.ts`| **UPDATE** | Add JSDoc to all 5 exception classes                      |
| `src/shared/exceptions/validation.exception.ts`    | **UPDATE** | Add JSDoc to both exception classes                       |
| `src/shared/exceptions/authorization.exception.ts` | **UPDATE** | Add JSDoc to both exception classes                       |

### What Must Be Preserved

- All existing method signatures must remain unchanged — JSDoc is additive only
- No runtime behavior changes — JSDoc comments are stripped during compilation and have zero runtime impact
- All existing imports, decorators, and DI wiring must not be modified
- The `generateTokenPair()` stub in TokenService (throws `'Not implemented'`) must stay as-is — document it as stub
- Exception class inheritance hierarchy (`BaseAuthException` → `AuthenticationException`/`AuthorizationException`/`ValidationException` → concrete) must be preserved
- Do NOT add JSDoc to private methods (`generateAccessToken`, `generateRefreshToken`, `checkBlacklist`) — this story only targets public API surface
- Do NOT modify `src/shared/exceptions/index.ts` (re-export barrel) or `src/shared/exceptions/all-exceptions.filter.ts`

### Dependencies

- **Epic 1–8** (all features implemented and stable — documenting existing behavior)
- **Story 9.3** (integration tests verify all 4 endpoints — documentation must match verified behavior)
- **No new npm dependencies required** — JSDoc is native TypeScript syntax
- The README Quick Start assumes `npm run setup:keys` and `npm run db:migrate` scripts exist in `package.json` — verify these exist before writing the README
- Swagger UI at `/api` is referenced in README — verify this endpoint is configured

### Key Design Decisions

1. **JSDoc only on public API surface.** Private methods (`generateAccessToken`, `generateRefreshToken`, `checkBlacklist`) are excluded. This follows the principle of documenting the contract, not the implementation.

2. **Zod inline JSDoc for DTOs.** Zod schemas use inline `/** */` comments on each `.object()` property. This keeps the documentation co-located with the validation rule and is the idiomatic approach for Zod-based DTOs in this codebase.

3. **README as single source of truth.** The README.md is the first thing a developer reads. It must contain enough context to set up, run, and understand the service without opening any other file. The API reference documents request/response shapes with JSON examples so clients can integrate without reading controller code.

4. **`@throws` documents all exception paths.** Every checked exception that a caller must handle is listed. This is critical for the hexagonal architecture where ports define the contract — callers need to know what exceptions to catch.

5. **`@example` on primary use cases.** The `register()` and `login()` methods get `@example` blocks showing usage. Secondary methods (refresh, logout, token service internals) get simpler JSDoc without examples to avoid bloat.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.4 — Acceptance Criteria]
- [Source: _bmad-output/implementation-artifacts/implementation-docs/epic-9-testing/README.md#Story 9.4 — Implementation Guidance]
- [Source: src/modules/auth/auth.service.ts — AuthService with 4 public methods needing JSDoc]
- [Source: src/modules/user/user.service.ts — UserService with 4 public methods needing JSDoc]
- [Source: src/modules/token/token.service.ts — TokenService with 5 public methods needing JSDoc]
- [Source: src/modules/auth/guards/jwt-auth.guard.ts — JwtAuthGuard needing JSDoc]
- [Source: src/modules/auth/dto/register.dto.ts — RegisterSchema needing inline JSDoc]
- [Source: src/modules/auth/dto/login.dto.ts — LoginSchema needing inline JSDoc]
- [Source: src/modules/auth/dto/token-response.dto.ts — TokenResponseSchema needing inline JSDoc]
- [Source: src/common/ports/auth.port.ts — IAuthService interface needing JSDoc]
- [Source: src/common/ports/user.port.ts — IUserService interface needing JSDoc]
- [Source: src/common/ports/token.port.ts — ITokenService interface needing JSDoc]
- [Source: src/shared/exceptions/base.exception.ts — BaseAuthException needing JSDoc]
- [Source: src/shared/exceptions/authentication.exception.ts — 5 exception classes needing JSDoc]
- [Source: src/shared/exceptions/validation.exception.ts — 2 exception classes needing JSDoc]
- [Source: src/shared/exceptions/authorization.exception.ts — 2 exception classes needing JSDoc]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

| File                                               | Action |
| -------------------------------------------------- | ------ |
| `README.md`                                        | CREATE |
| `src/modules/auth/auth.service.ts`                 | UPDATE |
| `src/modules/user/user.service.ts`                 | UPDATE |
| `src/modules/token/token.service.ts`               | UPDATE |
| `src/modules/auth/guards/jwt-auth.guard.ts`        | UPDATE |
| `src/modules/auth/dto/register.dto.ts`             | UPDATE |
| `src/modules/auth/dto/login.dto.ts`                | UPDATE |
| `src/modules/auth/dto/token-response.dto.ts`       | UPDATE |
| `src/common/ports/auth.port.ts`                    | UPDATE |
| `src/common/ports/user.port.ts`                    | UPDATE |
| `src/common/ports/token.port.ts`                   | UPDATE |
| `src/shared/exceptions/base.exception.ts`          | UPDATE |
| `src/shared/exceptions/authentication.exception.ts` | UPDATE |
| `src/shared/exceptions/validation.exception.ts`    | UPDATE |
| `src/shared/exceptions/authorization.exception.ts` | UPDATE |
