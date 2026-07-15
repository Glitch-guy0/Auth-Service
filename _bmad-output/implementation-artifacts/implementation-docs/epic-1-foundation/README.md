# Epic 1: Foundation & Types

**Goal:** Establish project scaffolding, all type definitions, interfaces, and entities. No business logic — just the skeleton.

**Depends on:** Nothing

**Deliverable:** Complete project structure with strict TypeScript, validated config, all entities, DTOs, service interfaces, exception hierarchy, and API response types.

---

## Story 1.1: NestJS Project Initialization

### Overview
Bootstrap the NestJS project with all required dependencies and npm scripts. This story ensures the development environment is ready for all subsequent work.

### Architecture References
- Architecture overview defines NestJS as the framework (architecture.md §14)
- Structural seed defines the module layout (ARCHITECTURE-SPINE.md §Structural Seed)

### Acceptance Criteria
- `npm install` completes without errors
- `package.json` contains all required dependencies: `@nestjs/*`, `@nestjs/config`, `typeorm`, `jose`, `bcrypt`, `pino`, `zod`, `nestjs-zod`
- Scripts defined: `start:dev`, `build`, `test`, `test:e2e`, `lint`, `setup:keys`, `db:migrate`, `db:seed`
- `package.json` already has: `@nestjs/common`, `@nestjs/config`, `zod`, `nestjs-zod`, `class-validator`, `class-transformer`, jest, eslint, prettier

### Implementation Guidance
- Use the NestJS CLI (`nest new`) if starting fresh, or verify the existing scaffold
- Add missing dependencies: `typeorm`, `jose`, `bcrypt`, `pino` (plus `@types/bcrypt`)
- Add missing scripts to `package.json`: `setup:keys`, `db:migrate`, `db:seed` (can be stubs initially)
- The existing `package.json` already has `start:dev`, `build`, `test`, `test:e2e`, `lint` — verify and augment
- Ensure `jest.config` or inline jest config maps path aliases for testing

### Dependencies
- None

---

## Story 1.2: TypeScript Configuration

### Overview
Configure TypeScript with strict mode and path aliases for clean, type-safe imports across the codebase.

### Architecture References
- Architecture spine defines feature-based module structure (ARCHITECTURE-SPINE.md §Structural Seed)
- Path aliases: `@shared/*`, `@modules/*`, `@config/*`, `@database/*`

### Acceptance Criteria
- `tsconfig.json` has `"strict": true`
- Path aliases configured: `@shared/*` → `src/shared/*`, `@modules/*` → `src/modules/*`, `@config/*` → `src/config/*`, `@database/*` → `src/database/*`
- `baseUrl` set to `"."`
- Jest `moduleNameMapper` in `package.json` mirrors the path aliases

### Implementation Guidance
- The existing `tsconfig.json` already has `strict: true`, `baseUrl: "./"`, and all four path aliases — verify they are correct
- Ensure `tsconfig.build.json` extends `tsconfig.json` (already does)
- Verify Jest `moduleNameMapper` in `package.json` matches tsconfig paths (already configured)
- Add `jest.config.ts` or ensure the inline jest config works with path resolution

### Dependencies
- Story 1.1 (package.json must exist)

---

## Story 1.3: Environment Configuration

### Overview
Create a validated environment configuration system that ensures the application only starts when all required variables are present and correctly typed.

### Architecture References
- AD-11 (Zod Validation) — validation approach
- Architecture defines env vars in §7.2: DATABASE_URL, MONGODB_URL, REDIS_URL, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY, BCRYPT_COST, PORT, NODE_ENV
- AppContext config flow (architecture.md §7.1)

### Acceptance Criteria
- `src/config/env.validator.ts` validates all required env vars: DATABASE_URL, MONGODB_URL, REDIS_URL, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY, BCRYPT_COST, PORT, NODE_ENV
- Throws descriptive errors for missing/invalid variables
- `.env.example` exists with all variables documented (descriptions, defaults)
- Uses Zod for validation (per AD-11)

### Implementation Guidance
- Create `src/config/env.validator.ts` using Zod schemas:
  ```typescript
  import { z } from 'zod';
  const envSchema = z.object({
    DATABASE_URL: z.string().url(),
    MONGODB_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    JWT_ACCESS_EXPIRY: z.string().default('1d'),
    JWT_REFRESH_EXPIRY: z.string().default('7d'),
    BCRYPT_COST: z.coerce.number().default(10),
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  });
  ```
- Create `.env.example` with all variables and comments
- Export the parsed/validated env object for use by AppContext
- Integrate with `@nestjs/config` or validate on bootstrap in `main.ts`

### Dependencies
- Story 1.2 (path aliases for @config/*)

---

## Story 1.4: AppContext Global State

### Overview
Define a global AppContext singleton that provides shared config and services across modules, avoiding circular dependencies.

### Architecture References
- AD-4 (Module Lifecycle Pattern) — modules call `appContext.config` and `appContext.logManager`
- Architecture §2.2 defines AppContext interface: `{ logManager, config, ... }`
- Each module's `setup()` calls appContext to get env vars

### Acceptance Criteria
- `src/config/app-context.ts` defines AppContext interface with: `logManager`, `config`, and other shared services
- AppContext is a singleton pattern — modules import and access the same instance
- Type-safe — all properties are typed interfaces

### Implementation Guidance
- Create `src/config/app-context.ts`:
  ```typescript
  import { LogManager } from '@shared/logging';
  import { Config } from '@config/env.validator';

  interface AppContext {
    logManager: LogManager;
    config: Config;
  }

  let instance: AppContext | null = null;

  export function getAppContext(): AppContext { ... }
  export function setAppContext(ctx: AppContext): void { ... }
  ```
- LogManager type can be a stub interface for now (implemented in Epic 8)
- Config type comes from the validated env schema in Story 1.3
- Ensure singleton enforcement — `setAppContext` throws if called twice in production

### Dependencies
- Story 1.3 (Config type from env.validator.ts)

---

## Story 1.5: NestJS App Module Structure

### Overview
Wire up the root AppModule with all module imports, global validation pipe, exception filter, and bootstrap with Swagger documentation.

### Architecture References
- Architecture §2.1 defines hexagonal module structure
- ARCHITECTURE-SPINE.md §Structural Seed defines module locations
- Architecture §11 defines API routes and base path `/auth/v1`

### Acceptance Criteria
- `src/app.module.ts` imports: ConfigModule, AuthModule, UserModule, TokenModule, LoggingModule
- Global validation pipe is registered (using Zod via nestjs-zod)
- Global exception filter is registered
- `src/main.ts` bootstraps NestJS with AppModule
- Swagger documentation is set up
- Listens on the configured PORT

### Implementation Guidance
- Create stub modules under `src/modules/`: `auth/`, `user/`, `token/`, `logging/`
- Each module is a minimal `@Module({})` — business logic comes in later epics
- Register modules in `AppModule`:
  ```typescript
  @Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      AuthModule,
      UserModule,
      TokenModule,
      LoggingModule,
    ],
  })
  ```
- Update `main.ts` to:
  - Apply global Zod validation pipe (via `nestjs-zod`)
  - Register global exception filter
  - Set up Swagger with `@nestjs/swagger`
  - Read PORT from validated env config
- The existing `main.ts` already has a `ValidationPipe` — replace with Zod-based pipe per AD-11

### Dependencies
- Story 1.3 (env config for PORT, NODE_ENV)
- Story 1.4 (AppContext for shared services)

---

## Story 1.6: User Entity Definition

### Overview
Define the User TypeORM entity mapping to the PostgreSQL `users` table with all required fields and constraints.

### Architecture References
- AD-14 (Users Table Schema Contract) — canonical schema definition
- AD-3 (Hybrid Database Architecture) — PostgreSQL stores core auth data

### Acceptance Criteria
- User entity has fields: `id` (UUID), `username` (string, unique), `email` (string, unique), `password` (string), `blocked` (boolean), `is_verified` (boolean), `created_at` (timestamp), `updated_at` (timestamp)
- `username` and `email` have unique constraints
- Entity maps to `users` table

### Implementation Guidance
- Create `src/modules/user/user.entity.ts`:
  ```typescript
  import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

  @Entity('users')
  export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    username: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    email: string;

    @Column({ type: 'varchar', length: 255 })
    password: string;

    @Column({ type: 'boolean', default: false })
    blocked: boolean;

    @Column({ type: 'boolean', default: false })
    is_verified: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
  }
  ```
- Follow AD-14 schema exactly — no `is_deleted` field in the entity (deferred if not in AC)
- Place under `src/modules/user/` per the structural seed

### Dependencies
- Story 1.5 (module structure exists)

---

## Story 1.7: Auth Token Entity Definition

### Overview
Define the AuthToken entity for refresh token storage, enforcing one-active-session-per-user via primary key constraint.

### Architecture References
- AD-5 (Single Active Session) — `user_id` is PK, one row per user
- AD-3 (Hybrid Database Architecture) — PostgreSQL stores auth tokens

### Acceptance Criteria
- AuthToken entity: `user_id` (UUID PK, FK to users), `token_hash` (string), `expires_at` (timestamp), `updated_at` (timestamp)
- `user_id` is primary key (one row per user)
- ON DELETE CASCADE configured (when user is deleted, token is deleted)

### Implementation Guidance
- Create `src/modules/token/auth-token.entity.ts`:
  ```typescript
  @Entity('auth_tokens')
  export class AuthToken {
    @PrimaryColumn({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'varchar', length: 255 })
    token_hash: string;

    @Column({ type: 'timestamp' })
    expires_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;
  }
  ```
- The PK on `user_id` enforces AD-5 (single active session) — UPSERT is used instead of INSERT
- Place under `src/modules/token/` per the structural seed

### Dependencies
- Story 1.6 (User entity for FK reference)

---

## Story 1.8: Public Key Registry Entity

### Overview
Define the PublicKeyRegistry entity for storing RSA public keys, enabling JWT verification and key rotation.

### Architecture References
- AD-2 (Per-Instance RSA Key Pairs) — only public key stored in PostgreSQL
- AD-9 (KeyManager Takes kid Parameter) — kid is used for key lookup

### Acceptance Criteria
- PublicKeyRegistry entity: `kid` (UUID PK), `public_key` (text), `created_at` (timestamp), `expires_at` (timestamp)
- `kid` is UUID v7

### Implementation Guidance
- Create `src/modules/key/public-key-registry.entity.ts`:
  ```typescript
  @Entity('refresh_token_keys')
  export class PublicKeyRegistry {
    @PrimaryColumn({ type: 'uuid' })
    kid: string;

    @Column({ type: 'text' })
    public_key: string;

    @CreateDateColumn()
    created_at: Date;

    @Column({ type: 'timestamp' })
    expires_at: Date;
  }
  ```
- Table name is `refresh_token_keys` per the architecture SQL schema (architecture.md §3.1)
- The entity name `PublicKeyRegistry` maps to this table — keep consistent
- Place under `src/modules/key/` per the structural seed

### Dependencies
- Story 1.5 (module structure exists)

---

## Story 1.9: Demographics Document (MongoDB)

### Overview
Define the Demographics document type for MongoDB-based user demographics logging.

### Architecture References
- AD-3 (Hybrid Database Architecture) — MongoDB stores logging data
- AD-10 (Demographics Logging via UserService) — UserService delegates to DemographicsRepository

### Acceptance Criteria
- Demographics document: `user_id` (UUID), `last_ip` (string), `location` (object with `country`, `city`), `created_at` (Date)
- Uses MongoDB collection `user_demographics`

### Implementation Guidance
- Since this is a MongoDB document (not a TypeORM entity), define a TypeScript interface:
  ```typescript
  // src/modules/user/demographics.interface.ts
  export interface DemographicsLocation {
    country: string;
    city: string;
  }

  export interface Demographics {
    _id?: import('mongodb').ObjectId;
    user_id: string;
    last_ip: string;
    location: DemographicsLocation;
    created_at: Date;
  }
  ```
- The collection name `user_demographics` is set when creating the MongoDB collection or via a TypeORM `@Collection` decorator if using MongoDB with TypeORM
- Place under `src/modules/user/` since UserService owns demographics logging (AD-10)
- No business logic — just the type definition for now

### Dependencies
- Story 1.5 (module structure exists)

---

## Story 1.10: DTOs — Register & Login

### Overview
Define Zod validation schemas for registration and login request bodies, providing runtime validation with TypeScript type inference.

### Architecture References
- AD-11 (Zod Validation) — all input validation uses Zod, not class-validator
- Architecture §5.1 defines registration request shape
- Architecture §5.2 defines login request shape

### Acceptance Criteria
- `RegisterSchema`: `username` z.string().min(3), `email` z.string().email(), `password` z.string().min(8)
- `LoginSchema`: `usernameOrEmail` z.string(), `password` z.string()
- Both schemas use `z.infer<>` to derive TypeScript types
- Schemas are exported for use in controllers

### Implementation Guidance
- Create `src/modules/auth/dto/register.dto.ts`:
  ```typescript
  import { z } from 'zod';

  export const RegisterSchema = z.object({
    username: z.string().min(3),
    email: z.string().email(),
    password: z.string().min(8),
  });

  export type RegisterDto = z.infer<typeof RegisterSchema>;
  ```
- Create `src/modules/auth/dto/login.dto.ts`:
  ```typescript
  export const LoginSchema = z.object({
    usernameOrEmail: z.string(),
    password: z.string(),
  });

  export type LoginDto = z.infer<typeof LoginSchema>;
  ```
- Use `nestjs-zod` decorators if integrating with NestJS validation pipe (optional — raw Zod.parse works too)
- Place DTOs under `src/modules/auth/dto/` per the structural seed

### Dependencies
- Story 1.5 (module structure exists)

---

## Story 1.11: DTOs — Token Response

### Overview
Define Zod schema for token response objects, ensuring consistent API response structure.

### Architecture References
- AD-11 (Zod Validation)
- Architecture §11.2 defines success response shape with token data

### Acceptance Criteria
- `TokenResponseSchema`: `accessToken` z.string(), `expiresIn` z.number()
- Uses `z.infer<>` to derive TypeScript type

### Implementation Guidance
- Create `src/modules/auth/dto/token-response.dto.ts`:
  ```typescript
  import { z } from 'zod';

  export const TokenResponseSchema = z.object({
    accessToken: z.string(),
    expiresIn: z.number(),
  });

  export type TokenResponseDto = z.infer<typeof TokenResponseSchema>;
  ```
- This schema can also be used to validate outgoing responses during development
- Place under `src/modules/auth/dto/`

### Dependencies
- Story 1.5 (module structure exists)

---

## Story 1.12: Service Interfaces (Ports)

### Overview
Define TypeScript interfaces for all services — the hexagonal port contracts that decouple inbound adapters from outbound adapters.

### Architecture References
- AD-1 (Hexagonal Module Boundary) — core domain defines port interfaces
- Architecture §2.1 defines the port interfaces: IAuthService, IUserService, ITokenService
- Architecture §9.1 defines IKeyManager (ISecretProvider is future, IKeyManager is current)

### Acceptance Criteria
- `IAuthService`: register, login, refresh, logout
- `IUserService`: findByEmail, findByUsername, create, logDemographics
- `ITokenService`: generateTokenPair, storeToken, verifyAccessToken
- `IKeyManager`: getPublicKey, getPrivateKey

### Implementation Guidance
- Create interface files alongside each module:
  ```typescript
  // src/modules/auth/auth.service.interface.ts
  export interface IAuthService {
    register(dto: RegisterDto): Promise<TokenResponseDto>;
    login(dto: LoginDto): Promise<TokenResponseDto>;
    refresh(refreshToken: string): Promise<TokenResponseDto>;
    logout(accessToken: string): Promise<void>;
  }

  // src/modules/user/user.service.interface.ts
  export interface IUserService {
    findByEmail(email: string): Promise<User | null>;
    findByUsername(username: string): Promise<User | null>;
    create(dto: RegisterDto): Promise<User>;
    logDemographics(userId: string, data: DemographicsData): Promise<void>;
  }

  // src/modules/token/token.service.interface.ts
  export interface ITokenService {
    generateTokenPair(userId: string, keyId: string): Promise<TokenResponseDto>;
    storeToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
    verifyAccessToken(token: string): Promise<JwtPayload>;
  }

  // src/modules/key/key.service.interface.ts
  export interface IKeyManager {
    getPublicKey(kid: string): Promise<string>;
    getPrivateKey(): Promise<string>;
  }
  ```
- These are pure interfaces — no implementation logic
- Import types from DTOs and entities defined in previous stories
- Follow the naming convention: `I{ServiceName}` per ARCHITECTURE-SPINE.md §Naming

### Dependencies
- Story 1.6 (User entity type)
- Story 1.10 (RegisterDto, LoginDto types)
- Story 1.11 (TokenResponseDto type)
- Story 1.15 (JwtPayload type — can be a forward reference)

---

## Story 1.13: Exception Hierarchy

### Overview
Define a complete exception hierarchy with HTTP status codes and error codes for consistent, structured error handling across the application.

### Architecture References
- Architecture §11.2 defines error response shape: `{ success: false, error: { code, message } }`
- Error codes follow pattern: AUTH_*, TOKEN_*, VALIDATION_*

### Acceptance Criteria
- `BaseAuthException` root class
- `AuthenticationException` (401) with subclasses: `InvalidCredentialsException`, `TokenExpiredException`, `TokenRevokedException`, `TokenInvalidSignatureException`
- `AuthorizationException` (403) with subclass: `UserBlockedException`
- `ValidationException` (400) with subclass: `UserExistsException`
- Each exception has an error code: AUTH_*, TOKEN_*, VALIDATION_*

### Implementation Guidance
- Create `src/shared/exceptions/` directory:
  ```typescript
  // src/shared/exceptions/base-auth.exception.ts
  export class BaseAuthException extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = this.constructor.name;
    }
  }

  // src/shared/exceptions/authentication.exception.ts
  export class AuthenticationException extends BaseAuthException {
    constructor(message: string, code = 'AUTH_ERROR') {
      super(code, message, 401);
    }
  }

  export class InvalidCredentialsException extends AuthenticationException {
    constructor() {
      super('Invalid username or password', 'AUTH_INVALID_CREDENTIALS');
    }
  }

  export class TokenExpiredException extends AuthenticationException {
    constructor() {
      super('Token has expired', 'TOKEN_EXPIRED');
    }
  }

  // ... remaining exceptions follow the same pattern
  ```
- Place all exception classes under `src/shared/exceptions/`
- Export a barrel file `src/shared/exceptions/index.ts`
- Error codes: `AUTH_INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `TOKEN_INVALID_SIGNATURE`, `USER_BLOCKED`, `USER_EXISTS`

### Dependencies
- Story 1.5 (module structure for shared/)

---

## Story 1.14: Transaction Pattern

### Overview
Define the transaction wrapper pattern for atomic database operations with auto-commit/rollback semantics.

### Architecture References
- AD-12 (Transaction Pattern) — `createTransaction(callback)` + `discard()`
- AD-17 (Cross-Database Mutation Ordering) — PG first, Redis second

### Acceptance Criteria
- `createTransaction(callback)` function defined
- Callback receives a self-contained `tx` object
- Auto-commits on success, auto-rollbacks + rethrows on error
- `discard()` available for explicit cleanup

### Implementation Guidance
- Create `src/shared/transaction/transaction.ts`:
  ```typescript
  export interface Transaction {
    queryRunner: import('typeorm').QueryRunner;
    // expose query methods, save, etc.
    discard(): Promise<void>;
  }

  export async function createTransaction<T>(
    callback: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const tx: Transaction = {
        queryRunner,
        discard: async () => {
          await queryRunner.release();
        },
      };
      const result = await callback(tx);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  ```
- Uses TypeORM QueryRunner for transaction management
- `discard()` enables explicit resource cleanup when needed before natural scope exit
- The `tx` object wraps QueryRunner — adapters (repositories) receive it and use it for queries
- Place under `src/shared/transaction/`

### Dependencies
- Story 1.5 (module structure for shared/)

---

## Story 1.15: JWT Payload Type

### Overview
Define the JWT access token payload interface, establishing the contract between token generation and verification.

### Architecture References
- AD-15 (JWT Payload Contract) — canonical claim definitions
- AD-13 (Role Field Deferred) — role is deferred to Phase 4

### Acceptance Criteria
- `JwtPayload` has fields: `sub` (string, user_id), `iat` (number), `iss` (string), `kid` (string), `exp` (number)
- `role` field deferred with TODO comment

### Implementation Guidance
- Create `src/shared/types/jwt.types.ts`:
  ```typescript
  export interface JwtPayload {
    sub: string;      // user_id
    iat: number;      // issued at
    iss: string;      // server_id
    kid: string;      // key ID for rotation (AD-9)
    exp: number;      // expiry
    // TODO: role field deferred to Phase 4 RBAC (AD-13)
  }
  ```
- Place under `src/shared/types/` per the structural seed
- This interface is consumed by TokenService (generation) and AuthGuard (verification) — both import from this shared location
- AD-15 also mentions `user_id` as redundant with `sub` for backwards compat — include only if the AC requires it; the AC lists `sub` only

### Dependencies
- Story 1.5 (module structure for shared/)

---

## Story 1.16: API Response Types

### Overview
Define standardized success and error response types for consistent API response shapes across all endpoints.

### Architecture References
- Architecture §11.2 defines response format: `{ success: true, data }` and `{ success: false, error: { code, message } }`
- ARCHITECTURE-SPINE.md §Consistency Conventions defines envelope shapes

### Acceptance Criteria
- `SuccessResponse<T>` type with `success` (true) and `data` (T)
- `ErrorResponse` type with `success` (false) and `error` (code, message, timestamp, path)

### Implementation Guidance
- Create `src/shared/types/response.types.ts`:
  ```typescript
  export interface SuccessResponse<T> {
    success: true;
    data: T;
  }

  export interface ErrorResponse {
    success: false;
    error: {
      code: string;
      message: string;
      timestamp: string;
      path: string;
    };
  }

  export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
  ```
- These types are used by all controllers and the global exception filter
- The exception filter (Story 7.3 / Story 1.5) constructs `ErrorResponse` from caught exceptions
- Controllers return `SuccessResponse<T>` wrapping the service result
- Place under `src/shared/types/`

### Dependencies
- Story 1.5 (module structure for shared/)

---

## Summary

| Story | Key Deliverable | File Location |
|-------|----------------|---------------|
| 1.1 | NestJS project + deps + scripts | `package.json` |
| 1.2 | Strict TS + path aliases | `tsconfig.json` |
| 1.3 | Env validation + .env.example | `src/config/env.validator.ts` |
| 1.4 | AppContext singleton | `src/config/app-context.ts` |
| 1.5 | AppModule + main.ts bootstrap | `src/app.module.ts`, `src/main.ts` |
| 1.6 | User entity (PostgreSQL) | `src/modules/user/user.entity.ts` |
| 1.7 | AuthToken entity (PostgreSQL) | `src/modules/token/auth-token.entity.ts` |
| 1.8 | PublicKeyRegistry entity (PostgreSQL) | `src/modules/key/public-key-registry.entity.ts` |
| 1.9 | Demographics interface (MongoDB) | `src/modules/user/demographics.interface.ts` |
| 1.10 | Register + Login DTOs (Zod) | `src/modules/auth/dto/register.dto.ts`, `login.dto.ts` |
| 1.11 | TokenResponse DTO (Zod) | `src/modules/auth/dto/token-response.dto.ts` |
| 1.12 | Service interfaces (ports) | `src/modules/*/ *.service.interface.ts` |
| 1.13 | Exception hierarchy | `src/shared/exceptions/` |
| 1.14 | Transaction pattern | `src/shared/transaction/transaction.ts` |
| 1.15 | JwtPayload type | `src/shared/types/jwt.types.ts` |
| 1.16 | API response types | `src/shared/types/response.types.ts` |

**Note:** This epic defines only types, interfaces, and entities. No business logic is implemented until Epic 2+. All interfaces are stubs or type-only — concrete implementations come in later epics.
