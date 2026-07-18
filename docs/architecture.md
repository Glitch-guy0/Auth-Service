# Architecture

## 1. Architecture Overview

AuthService follows **Hexagonal Architecture** (Ports & Adapters), isolating core business logic from infrastructure concerns. Each feature module depends on port interfaces defined in `src/shared/lib/interfaces/`, not on concrete implementations. Adapters (controllers, repositories, middleware) live at the edges and plug into the core through these ports.

[Hexagonal Component Architecture](diagrams/08-component-hexagonal.mmd)

The hexagonal pattern was chosen to support future extensibility: swapping authentication providers (e.g. OAuth, SAML), replacing database backends, or adding new transport adapters without modifying the core service layer.

## 2. Module Structure

[Module Dependencies](diagrams/09-package-modules-flowchart.mmd) | [Package Tree](diagrams/09-package-modules-tree.mmd)

| Module | Directory | Responsibility |
|--------|-----------|----------------|
| **AuthModule** | `src/modules/auth/` | Registration, login, logout, token refresh orchestration |
| **UserModule** | `src/modules/user/` | User entity CRUD, demographics logging |
| **TokenModule** | `src/modules/token/` | JWT generation, verification, refresh token storage, blacklisting |
| **KeyModule** | `src/modules/key/` | RSA key pair management, public key registry |
| **RedisModule** | `src/modules/redis/` | Redis client for token blacklisting |
| **LoggingModule** | `src/modules/logging/` | Structured logging (Pino), request context, demographics persistence |

### Port Interfaces

Port interfaces are defined in `src/shared/lib/interfaces/` and consumed via NestJS dependency injection tokens.

| Interface | File | Token | Purpose |
|-----------|------|-------|---------|
| `IAuthService` | `src/shared/lib/interfaces/auth.interface.ts` | `AUTH_SERVICE` | Registration, login, refresh, logout contracts |
| `IUserService` | `src/shared/lib/interfaces/user.interface.ts` | `USER_SERVICE` | User lookup, creation, demographics logging |
| `ITokenService` | `src/shared/lib/interfaces/token.interface.ts` | `TOKEN_SERVICE` | JWT lifecycle, blacklisting, refresh token storage |
| `IKeyManager` | `src/shared/lib/interfaces/key-manager.interface.ts` | `KEY_MANAGER` | RSA public/private key retrieval by key ID |

## 3. Request Lifecycle

[Runtime Object Graph](diagrams/10-object-runtime.mmd)

Every inbound HTTP request passes through the following pipeline:

```
Client
  -> AuthMiddleware          (extracts Bearer token, attaches to request)
    -> [JwtAuthGuard]        (validates token if @UseGuards applied)
      -> LoggingInterceptor  (assigns requestId, logs timing and status)
        -> TransformResponseInterceptor (wraps successful responses in { success, data })
          -> ValidationPipe  (whitelist, transform, forbidNonWhitelisted)
            -> Controller    (delegates to service via port interface)
              -> Service     (orchestrates business logic)
                -> Repository (TypeORM / Mongoose data access)
                  -> Database (PostgreSQL / MongoDB / Redis)
```

**AuthMiddleware** (`src/modules/auth/auth.middleware.ts`) extracts the `Authorization: Bearer <token>` header and attaches the raw token to `req.accessToken`. It runs on all routes unconditionally.

**JwtAuthGuard** (`src/modules/auth/guards/jwt-auth.guard.ts`) is applied selectively to protected routes. It verifies the access token signature via `ITokenService`, checks the Redis blacklist (fail-open), and populates `req.user` with the authenticated user ID.

**LoggingInterceptor** (`src/shared/logging/logging.interceptor.ts`) assigns a UUID `requestId` if absent, logs incoming requests (with sensitive fields redacted), and records response status and duration. Uses Pino via `LogManagerService`.

**TransformResponseInterceptor** (`src/shared/interceptors/transform-response.interceptor.ts`) wraps all successful controller return values in `{ success: true, data: <payload> }`.

**ValidationPipe** (NestJS built-in, configured in `src/main.ts`) applies class-validator/class-transformer rules with `whitelist: true` and `forbidNonWhitelisted: true`.

## 4. Entity Relationships

[Entity ER Diagram](diagrams/05-class-entities.mmd)

### PostgreSQL Entities (TypeORM)

| Entity | Table | Key Fields |
|--------|-------|------------|
| **User** | `users` | `id` (UUID PK), `username` (unique), `email` (unique), `password` (bcrypt hash), `blocked`, `is_verified`, `created_at`, `updated_at` |
| **AuthToken** | `auth_tokens` | `user_id` (UUID PK, FK -> users CASCADE), `token_hash` (bcrypt), `expires_at`, `updated_at` |
| **PublicKeyRegistry** | `public_key_registry` | `kid` (UUID PK), `public_key` (text), `created_at`, `expires_at` |

Relationships: `auth_tokens.user_id` references `users.id` with `ON DELETE CASCADE`.

### MongoDB Collection (Mongoose)

| Collection | Document Shape |
|------------|----------------|
| `user_demographics` | `{ user_id: string, last_ip: string, location?: { country, city }, created_at: Date }` |

Defined in `src/modules/logging/demographics.schema.ts`. Written asynchronously after login/registration; failures are silently ignored.

## 5. Service Layer

[Service Class Diagram](diagrams/06-class-services.mmd) | [Types & Interfaces](diagrams/06-types-interfaces.mmd)

### AuthService

**File:** `src/modules/auth/auth.service.ts`

Orchestrates the four primary use cases: `register`, `login`, `refresh`, `logout`. Depends on `IUserService` and `ITokenService` via port injection. Performs bcrypt password comparison, refresh token rotation (hash with bcrypt cost 12, 7-day expiry), and best-effort demographics logging.

### UserService

**File:** `src/modules/user/user.service.ts`

Manages `User` entity persistence: `findByUsername`, `findByEmail`, `create`. Delegates demographics logging to the `DemographicsService` in the LoggingModule.

### TokenService

**File:** `src/modules/token/token.service.ts`

Handles JWT creation and verification using the `jose` library with RSA signatures. Manages refresh token storage (bcrypt hashes in `auth_tokens` table), access token blacklisting in Redis via `ITokenService.blacklistToken`.

### KeyManager

**File:** `src/modules/key/key-manager.service.ts`

Manages RSA key pairs for JWT signing. Keys are stored in `public_key_registry` and loaded via a setup script (`src/scripts/setup-keys.ts`). Provides `getPublicKey(kid)` and `getPrivateKey()` to the TokenService.

## 6. Exception Handling

[Exception Hierarchy](diagrams/07-class-exceptions.mmd)

All application exceptions extend `BaseAuthException` (`src/shared/exceptions/base.exception.ts`), which provides:

- `statusCode` (HTTP status)
- `errorCode` (machine-readable code)
- `timestamp` (ISO-8601)
- `toJSON()` serialization

### Exception Classes

| Class | File | Status | Error Code |
|-------|------|--------|------------|
| `BaseAuthException` | `src/shared/exceptions/base.exception.ts` | abstract | abstract |
| `InvalidCredentialsException` | `src/shared/exceptions/authentication.exception.ts` | 401 | `AUTH_INVALID_CREDENTIALS` |
| `TokenExpiredException` | `src/shared/exceptions/authentication.exception.ts` | 401 | `AUTH_TOKEN_EXPIRED` |
| `TokenInvalidSignatureException` | `src/shared/exceptions/authentication.exception.ts` | 401 | `AUTH_TOKEN_INVALID_SIGNATURE` |
| `UserBlockedException` | `src/shared/exceptions/authorization.exception.ts` | 403 | `AUTH_USER_BLOCKED` |
| `UserExistsException` | `src/shared/exceptions/validation.exception.ts` | 409 | `AUTH_USER_EXISTS` |
| `ValidationException` | `src/shared/exceptions/validation.exception.ts` | 400 | `AUTH_VALIDATION_ERROR` |

### AllExceptionsFilter

**File:** `src/shared/exceptions/all-exceptions.filter.ts`

Registered globally in `src/main.ts`. Catches all exceptions and returns a uniform error envelope:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid credentials",
    "timestamp": "2026-07-18T12:00:00.000Z",
    "path": "/v1/auth/login"
  }
}
```

Handles three exception hierarchies: `BaseAuthException` (application errors), `HttpException` (NestJS framework errors), and unhandled exceptions (logged as 500).

## 7. Security Architecture

[Auth Guard Flow](diagrams/11-sequence-auth-guard.mmd) | [Redis Blacklist](diagrams/04-redis-blacklist.mmd)

### Password Hashing

Passwords are hashed with **bcrypt** (cost factor 12) before storage in the `users` table. The same cost factor is used for refresh token hashing.

### JWT Strategy

Access tokens are RSA-signed JWTs using the `jose` library. Each token includes a `kid` header referencing the signing key from `public_key_registry`. Private keys never leave the server. Key rotation is supported by storing multiple key records with expiry dates.

### Token Blacklisting

Access tokens are blacklisted in **Redis** (ioredis) with a TTL matching the token expiry. The blacklist check in `JwtAuthGuard` uses **fail-open** semantics: if Redis is unreachable, the request proceeds. This is a deliberate tradeoff -- security vs availability -- documented as best-effort.

### Cookie Security

Refresh tokens are set as HTTP-only cookies with the following attributes:

| Attribute | Value |
|-----------|-------|
| `httpOnly` | `true` |
| `secure` | `true` (HTTPS only) |
| `sameSite` | `strict` |
| `path` | `/` |

## 8. Technology Stack

| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| Runtime | NestJS | ^11.1.3 | Opinionated Node.js framework with DI, module system, decorators |
| Language | TypeScript | ^5.8.3 | Type safety, port interface contracts, decorator metadata |
| HTTP | Express | ^5.0.2 | Mature HTTP adapter for NestJS |
| Database | PostgreSQL | via pg ^8.22.0 | Relational integrity for users, tokens, keys |
| ORM | TypeORM | ^1.1.0 | Entity decorators, migrations, NestJS integration |
| Document Store | MongoDB | via Mongoose ^9.7.4 | Flexible schema for demographics logging |
| Cache | Redis | via ioredis ^5.11.1 | Token blacklisting with TTL |
| JWT | jose | ^6.2.3 | Standards-compliant JOSE/JWT with RSA signing |
| Password Hashing | bcrypt | ^6.0.0 | Industry-standard adaptive hashing (cost 12) |
| Validation | Zod + nestjs-zod | ^4.4.3 / ^5.4.0 | Schema-based request validation |
| Logging | Pino | ^10.3.1 | High-performance structured JSON logging |
| Log Styling | chalk | ^4.1.2 | Colorized terminal output for development |
| API Docs | Swagger | ^11.4.5 | OpenAPI 3.0 auto-generated documentation |
| Configuration | @nestjs/config | ^4.0.2 | Environment variable validation and injection |
| Testing | Jest + Supertest | ^29.7.0 / ^7.2.2 | Unit and integration testing |
