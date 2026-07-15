---
name: 'AuthService'
type: architecture-spine
purpose: build-substrate
altitude: feature
paradigm: hexagonal (Ports & Adapters)
scope: AuthService — full-system authentication service
status: draft
created: '2026-07-12'
updated: '2026-07-14'
binds: [FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-11, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-23, FR-24, FR-25]
sources: [_bmad-output/planning-artifacts/prds/prd-AuthService-2026-07-12/prd.md, _bmad-output/planning-artifacts/architecture.md, _bmad-output/planning-artifacts/epics.md]
companions: []
---

# Architecture Spine — AuthService

## Design Paradigm

Hexagonal (Ports & Adapters). Inbound adapters (HTTP controllers, guards) call port interfaces (`IAuthService`, `IUserService`, `ITokenService`). Outbound adapters (PostgreSQL, MongoDB, Redis) implement those ports. Core domain owns use cases; adapters are swappable. This paradigm enables future OAuth provider/consumer support without changing core logic.

```
Inbound → Ports → Core Domain → Ports → Outbound
```

## Invariants & Rules

### AD-1 — Hexagonal Module Boundary

- **Binds:** all modules
- **Prevents:** core domain depending on adapter implementations; adapters calling each other directly
- **Rule:** Core domain defines port interfaces. Adapters implement ports. No adapter-to-adapter calls — all coordination goes through the domain layer.

### AD-2 — Per-Instance RSA Key Pairs

- **Binds:** KeyManager, TokenService, key lifecycle
- **Prevents:** sharing private keys across instances; storing private keys in the database
- **Rule:** Each instance generates its own RSA key pair. Private key stays in `keys.json` (chmod 600). Only the public key is stored in PostgreSQL (`refresh_token_keys` table). Private key is read from file at JWT signing time, then cleared from memory.

### AD-3 — Hybrid Database Architecture

- **Binds:** all data access
- **Prevents:** mixing core auth data with logging data; using the wrong database for a given concern
- **Rule:** PostgreSQL stores core auth data (users, auth_tokens, refresh_token_keys). MongoDB stores experimental logging (user_demographics). Redis handles token blacklisting. No cross-database joins.

### AD-4 — Module Lifecycle Pattern

- **Binds:** all modules
- **Prevents:** ad-hoc initialization; missing cleanup on shutdown
- **Rule:** Every module implements `setup() → run() → shutdown()`. `setup()` initializes config and dependencies. `run()` starts normal operation. `shutdown()` cleans up resources (optional, called on fatal).

### AD-5 — Single Active Session (AUTH_TOKENS Schema)

- **Binds:** AuthRepository, TokenService, login, refresh
- **Prevents:** multiple concurrent refresh tokens per user; session proliferation
- **Rule:** `auth_tokens` table has `user_id UUID PRIMARY KEY` — one row per user. Login uses `INSERT ... ON CONFLICT (user_id) DO UPDATE` (UPSERT). Refresh rotates the single token. No `token_type` column. Schema: `user_id PK, token_hash, expires_at, updated_at`.

### AD-6 — Refresh Token Rotation Strategy

- **Binds:** TokenService, refresh flow
- **Prevents:** token reuse; stale tokens in the database
- **Rule:** On refresh: (1) verify old token, (2) delete old token by user_id, (3) insert new token. Three-step O(1) flow. The old token is invalidated before the new one is created — fail-closed.

### AD-7 — Logout: accessToken-only with Redis Blacklist

- **Binds:** AuthService.logout, AuthController
- **Prevents:** requiring the refresh token to be present at logout; inconsistent logout behavior
- **Rule:** Logout takes only the accessToken from the Authorization header. Flow: (1) verify access token, (2) extract user_id, (3) add access token to Redis blacklist (TTL = token expiry), (4) delete refresh token from DB by user_id. Silently succeeds if token was already invalid/expired.

### AD-8 — TokenService Returns Complete JWT Payload

- **Binds:** TokenService, AuthService
- **Prevents:** AuthService needing to construct JWT payloads; split responsibility for token content
- **Rule:** TokenService.generateAccessToken(userId, keyId) returns the complete JWT string. AuthService owns user lookup and passes userId + keyId. TokenService does not query the user table.

### AD-9 — KeyManager Takes kid Parameter

- **Binds:** KeyManager, TokenService, auth guard
- **Prevents:** hardcoding key selection; inability to verify tokens signed with older keys during rotation
- **Rule:** `KeyManager.getPublicKey(kid)` takes the `kid` from the JWT header to retrieve the correct public key. Enables key rotation without invalidating existing tokens.

### AD-10 — Demographics Logging via UserService

- **Binds:** AuthService, UserService, DemographicsRepository
- **Prevents:** AuthService directly accessing MongoDB; tight coupling between auth and logging
- **Rule:** AuthService calls `UserService.logDemographics(userId, data)`. UserService delegates to DemographicsRepository. AuthService never imports or injects DemographicsRepository directly.

### AD-11 — Zod Validation (Strictly)

- **Binds:** all DTOs, all input validation
- **Prevents:** using class-validator/class-transformer; inconsistent validation approaches
- **Rule:** All input validation uses Zod schemas with `nestjs-zod` integration. No class-validator or class-transformer. Runtime validation with TypeScript type inference via `z.infer<>`.

### AD-12 — Transaction Pattern

- **Binds:** all database operations requiring atomicity
- **Prevents:** partial writes; inconsistent state on failure
- **Rule:** Use `createTransaction(callback)` + `discard()`. The callback receives a self-contained `tx` object. Auto-commits on success, auto-rollbacks + rethrows on failure. `discard()` cleans up resources.

### AD-13 — Role Field Deferred

- **Binds:** JwtPayload, RBAC
- **Prevents:** premature RBAC implementation; shipping role logic before it's needed
- **Rule:** `JwtPayload.role` is deferred — Phase 1 omits it or defaults to `'user'`. Full RBAC (admin/user/client roles) is Phase 3.

### AD-14 — Users Table Schema Contract

- **Binds:** UserRepository, AuthRepository, all user-related operations
- **Prevents:** incompatible `users` table definitions across modules
- **Rule:** `users` table schema is: `id UUID PK DEFAULT gen_random_uuid(), username VARCHAR(255) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, blocked BOOLEAN DEFAULT FALSE, is_deleted BOOLEAN DEFAULT FALSE, is_verified BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()`. Only UserRepository may write to this table. AuthRepository references it (read-only) for credential verification.

### AD-15 — JWT Payload Contract

- **Binds:** TokenService, AuthGuard, AuthService
- **Prevents:** guard and token service disagreeing on claim names/shapes
- **Rule:** AccessToken payload MUST contain: `sub: string` (user_id), `iat: number` (issued-at), `iss: string` (server_id), `kid: string` (key ID per AD-9), `exp: number` (expiry), `user_id: string` (redundant with sub for backwards compat). `role: string` is deferred to Phase 4 (RBAC). Header MUST contain `kid` for key lookup. TokenService owns payload construction. AuthGuard owns payload extraction. Any claim not in this list MUST NOT be added without a spine amendment.

### AD-16 — Repository Ownership & Orchestration

- **Binds:** all repositories
- **Prevents:** multiple write paths to the same table; competing mutation strategies
- **Rule:** Every database table has exactly one repository class that owns all writes. `auth_tokens`: owned by TokenRepository. `users`: owned by UserRepository. `refresh_token_keys`: owned by KeyRepository. AuthService orchestrates calls to TokenRepository (for token ops) and UserRepository (for user ops) but does not own a repository itself. Other modules may read through injected repository instances but MUST NOT define their own write methods against another module's table.

## Consistency Conventions

| Concern | Convention |
| --- | --- |
| Naming (entities, files, interfaces, events) | Feature-based modules: `modules/auth/`, `modules/user/`, `modules/token/`. Entities: `User`, `AuthToken`, `RefreshTokenKey`. Interfaces: `IAuthService`, `IUserService`, `ITokenService` |
| Data & formats (ids, dates, error shapes, envelopes) | UUIDs via `gen_random_uuid()`. Timestamps: `TIMESTAMP DEFAULT NOW()`. Error envelope: `{ success: false, error: { code, message } }`. Success envelope: `{ success: true, data: { ... } }` |
| State & cross-cutting (mutation, errors, logging, config, auth) | Logging: pino + chalk via LogManager. Config: `@nestjs/config` with .env. Auth: JWT with RSA signing via jose. Passwords: bcrypt cost=10 |

## Stack

| Name | Version |
| --- | --- |
| NestJS | 11.1.3 |
| TypeScript | 5.8.3 |
| Node.js | 22.x |
| PostgreSQL | 16+ |
| MongoDB | 7+ |
| Redis | 7+ |
| jose | latest |
| bcrypt | latest |
| pino | latest |
| zod | 4.4.3 |
| nestjs-zod | 5.4.0 |
| TypeORM | latest |
| Jest | 29.7.0 |
| ESLint | 9.25.1 |
| Prettier | 3.5.3 |

## Structural Seed

```text
src/
  modules/
    auth/
      auth.module.ts
      auth.controller.ts
      auth.service.ts
      auth.repository.ts
      dto/
      types/
    user/
      user.module.ts
      user.service.ts
      user.repository.ts
    token/
      token.module.ts
      token.service.ts
    key/
      key.module.ts
      key.service.ts
    logging/
      logging.module.ts
  shared/
    transaction/
    types/
    exceptions/
  config/
```

## Capability → Architecture Map

| Capability | Lives in | Governed by |
| --- | --- | --- |
| Registration | AuthService → UserRepository → PostgreSQL | AD-1, AD-3, AD-5, AD-11, AD-14, AD-16 |
| Login | AuthService → UserRepository + TokenRepository | AD-1, AD-3, AD-5, AD-6, AD-14, AD-16 |
| Logout | AuthService → TokenRepository (Redis+PG) | AD-1, AD-7, AD-3, AD-17 |
| Token Refresh | AuthService → TokenRepository | AD-1, AD-5, AD-6, AD-9, AD-16 |
| JWT Signing | TokenService → KeyManager → keys.json | AD-2, AD-8, AD-9, AD-15 |
| Key Lifecycle | KeyManager → KeyRepository → PostgreSQL | AD-2, AD-9, AD-16 |
| Demographics Logging | AuthService → UserService → DemographicsRepository | AD-3, AD-10 |
| Input Validation | All DTOs → Zod schemas | AD-11 |
| Database Transactions | Transaction module → TypeORM | AD-12 |
| RBAC | Deferred to Phase 3 | AD-13 |

### AD-17 — Cross-Database Mutation Ordering

- **Binds:** logout, any use case spanning Redis + PostgreSQL
- **Prevents:** half-logout states; inconsistent cross-database mutations
- **Rule:** When a use case mutates PostgreSQL and Redis: (1) Execute PostgreSQL mutation first (within AD-12 transaction). (2) After PG commit, mutate Redis. (3) If Redis fails, log the error — the access token expires naturally via its JWT `exp` claim (self-healing). The AD-12 transaction pattern applies to PostgreSQL-only multi-table mutations. Cross-database atomicity is best-effort with ordering guarantees, not two-phase commit.

## Deferred

- **FR-8 Rate Limiting** — Phase 2. No rate limiting in Phase 1.
- **FR-9 Password Reset** — Phase 2. Token-based password reset flow.
- **FR-10 Email Verification** — Phase 2. Email verification on registration.
- **FR-12 Security Headers** — Phase 2. Helmet/CORS configuration.
- **Multi-instance key sharing** — When scaling beyond single instance, keys.json needs to be shared or replaced with a key service.
- **OAuth consumer/provider** — Phase 4. Google/GitHub OAuth.
- **Vault integration** — Future. HashiCorp Vault or AWS Secrets Manager for key storage.
- **Metrics/tracing** — Future. OpenTelemetry integration.
