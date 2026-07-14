---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics']
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-AuthService-2026-07-12/prd.md
  - _bmad-output/planning-artifacts/architecture.md
---

# AuthService - Epic Breakdown

## Overview

Epics are organized as **complete vertical flows** — each epic delivers a working, testable feature from controller to database. Implementation follows a two-phase approach:
1. **Phase A (Epic 1-2)**: Foundation — file structure, types, interfaces, key management
2. **Phase B (Epic 3-7)**: Auth flows — each flow is a complete vertical slice
3. **Phase C (Epic 8-9)**: Cross-cutting — logging, testing, documentation

## Requirements Inventory

### Functional Requirements

FR1: User Registration — System can create new user accounts with username, email, and password
FR2: User Login — System can authenticate users with username/email and password
FR3: Token Refresh — System can issue new access tokens using refresh tokens
FR4: User Logout — System can invalidate tokens and clear sessions
FR5: JWT Token Generation — System generates RSA-signed JWT access tokens
FR6: Refresh Token Rotation — System rotates refresh tokens on each use
FR7: Key Management — System manages RSA key pairs for JWT signing
FR8: Rate Limiting — System limits request rate per IP/endpoint
FR9: Password Reset — System supports secure password reset flow
FR10: Email Verification — System verifies user email addresses
FR11: Input Validation — System validates all input data
FR12: Security Headers — System sets appropriate security headers
FR13: User Entity — System maintains user records with required fields
FR14: User Lookup — System can find users by email or username
FR15: User Blocking — System can block/unblock user accounts
FR16: Structured Logging — System logs structured events with levels
FR17: Request Logging — System logs HTTP requests and responses
FR18: User Demographics Logging — System logs user demographics to MongoDB
FR19: Development Setup — System provides easy development setup
FR20: Documentation — System has comprehensive documentation
FR21: Testing — System has unit and integration tests
FR22: Build & Deployment — System has production build and deployment scripts
FR23: PostgreSQL Schema — System maintains core data in PostgreSQL
FR24: MongoDB Collection — System logs demographics to MongoDB
FR25: Redis Cache — System uses Redis for token blacklisting

### NonFunctional Requirements

NFR1: Security — Passwords bcrypt hashed (cost=10), private key cleared from memory after use
NFR2: Performance — Token refresh uses O(1) query by user_id (not scanning all tokens)
NFR3: Reliability — Graceful fallback for MongoDB (optional connection)
NFR4: Maintainability — Hexagonal architecture for future OAuth support
NFR5: Observability — Structured logging with pino + chalk, log levels supported
NFR6: Type Safety — TypeScript strict mode enabled
NFR7: Validation — Zod for input validation (not class-validator)

### Additional Requirements

- Hexagonal Architecture with Ports & Adapters pattern
- Module Lifecycle: setup() → run() → shutdown() for each NestJS module
- Per-instance RSA key pairs (private key never in DB, cleared from memory after use)
- Hybrid database: PostgreSQL (core) + MongoDB (logging) + Redis (blacklist)
- TypeORM for PostgreSQL — mature, good NestJS integration, supports UUID
- Zod for input validation — runtime validation with TypeScript type inference
- Path aliases via package.json imports field
- Swagger/NestJS plugin for API documentation
- UML diagrams as reference for implementation

### UX Design Requirements

No UX design document exists — this is a backend API service.

## Epic Flow

```
Epic 1: Foundation & Types
    ↓ (all types defined)
Epic 2: Key Management
    ↓ (RSA keys ready for JWT)
Epic 3: Registration Flow
    ↓ (users can sign up)
Epic 4: Login Flow
    ↓ (users can authenticate)
Epic 5: Token Refresh Flow
    ↓ (sessions can be maintained)
Epic 6: Logout Flow
    ↓ (sessions can be terminated)
Epic 7: Auth Guard & Protected Routes
    ↓ (routes can be protected)
Epic 8: Logging & Observability
    ↓ (system is observable)
Epic 9: Testing & Documentation
    ↓ (system is production-ready)
```

## Epic List

| Epic | Title | Deliverable |
|------|-------|-------------|
| 1 | Foundation & Types | Project setup, all types, interfaces, entities |
| 2 | Key Management | RSA key generation, KeyManager service |
| 3 | Registration Flow | POST /auth/v1/register — complete vertical slice |
| 4 | Login Flow | POST /auth/v1/authenticate — complete vertical slice |
| 5 | Token Refresh Flow | POST /auth/v1/refresh — complete vertical slice |
| 6 | Logout Flow | POST /auth/v1/logout — complete vertical slice |
| 7 | Auth Guard & Protected Routes | Guards, middleware, exception filters |
| 8 | Logging & Observability | Structured logging, request logging, demographics |
| 9 | Testing & Documentation | Unit tests, integration tests, docs, Docker |

---

## Epic 1: Foundation & Types

**Goal:** Establish project scaffolding, all type definitions, interfaces, and entities. No business logic — just the skeleton.

**Depends on:** Nothing

### Story 1.1: NestJS Project Initialization

As a developer,
I want a properly initialized NestJS project with all dependencies,
So that I can start building features on a solid foundation.

**Acceptance Criteria:**

**Given** the project repository
**When** I run `npm install`
**Then** all dependencies are installed without errors

**Given** the project
**When** I check `package.json`
**Then** it contains all required dependencies (NestJS, TypeORM, jose, bcrypt, pino, zod)
**And** scripts are defined (start:dev, build, test, test:e2e, lint, setup:keys, db:migrate, db:seed)

### Story 1.2: TypeScript Configuration

As a developer,
I want strict TypeScript configuration with path aliases,
So that the codebase is type-safe and imports are clean.

**Acceptance Criteria:**

**Given** the project
**When** I check `tsconfig.json`
**Then** strict mode is enabled (`"strict": true`)
**And** path aliases are configured (`@shared/*`, `@modules/*`, `@config/*`, `@database/*`)
**And** baseUrl is set to `"."`

### Story 1.3: Environment Configuration

As a developer,
I want validated environment configuration,
So that the application starts only when all required variables are present.

**Acceptance Criteria:**

**Given** the project
**When** I check `src/config/env.validator.ts`
**Then** it validates all required environment variables (DATABASE_URL, MONGODB_URL, REDIS_URL, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY, BCRYPT_COST, PORT, NODE_ENV)
**And** it throws descriptive errors for missing/invalid variables

**Given** `.env.example`
**When** I copy it to `.env`
**Then** all variables are documented with descriptions and default values

### Story 1.4: AppContext Global State

As a developer,
I want a global AppContext for sharing config and services across modules,
So that modules can access shared resources without circular dependencies.

**Acceptance Criteria:**

**Given** the project
**When** I check `src/config/app-context.ts`
**Then** AppContext interface is defined with logManager, config, and other shared services
**And** AppContext is a singleton that modules can import

### Story 1.5: NestJS App Module Structure

As a developer,
I want the root AppModule with proper module imports,
So that the application boots correctly.

**Acceptance Criteria:**

**Given** the project
**When** I check `src/app.module.ts`
**Then** it imports ConfigModule, AuthModule, UserModule, TokenModule, LoggingModule
**And** it uses global validation pipe
**And** it registers the global exception filter

**Given** the project
**When** I check `src/main.ts`
**Then** it bootstraps NestJS with AppModule
**And** it sets up Swagger documentation
**And** it listens on the configured PORT

### Story 1.6: User Entity Definition

As a developer,
I want the User entity defined with all fields and relationships,
So that database operations have type safety.

**Acceptance Criteria:**

**Given** the project
**When** I check `src/modules/user/user.entity.ts`
**Then** User entity has fields: id (UUID), username (string, unique), email (string, unique), password (string), blocked (boolean), is_verified (boolean), created_at (timestamp), updated_at (timestamp)
**And** username and email have unique constraints

### Story 1.7: Auth Token Entity Definition

As a developer,
I want the AuthToken entity defined for refresh token storage,
So that token operations have type safety.

**Acceptance Criteria:**

**Given** the project
**When** I check the token entity file
**Then** AuthToken entity has fields: user_id (UUID PK, FK to users), token_hash (string), expires_at (timestamp), updated_at (timestamp)
**And** user_id is primary key (one row per user)
**And** ON DELETE CASCADE is configured

### Story 1.8: Public Key Registry Entity

As a developer,
I want the PublicKeyRegistry entity for key management,
So that JWT verification can find the correct public key.

**Acceptance Criteria:**

**Given** the project
**When** I check the key entity file
**Then** PublicKeyRegistry entity has fields: kid (UUID PK), public_key (text), created_at (timestamp), expires_at (timestamp)
**And** kid is UUID v7

### Story 1.9: Demographics Document (MongoDB)

As a developer,
I want the Demographics document type for MongoDB logging,
So that demographics logging has type safety.

**Acceptance Criteria:**

**Given** the project
**When** I check the demographics entity file
**Then** Demographics document has fields: user_id (UUID), last_ip (string), location (object with country, city), created_at (Date)
**And** it uses MongoDB collection user_demographics

### Story 1.10: DTOs — Register & Login

As a developer,
I want Zod schemas for registration and login validation,
So that input is validated before reaching service logic.

**Acceptance Criteria:**

**Given** the project
**When** I check `src/modules/auth/dto/register.dto.ts`
**Then** RegisterSchema is defined with z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8)
})
**And** the schema infers the TypeScript type (z.infer<typeof RegisterSchema>)
**And** the schema is exported for use in controller

**Given** the project
**When** I check `src/modules/auth/dto/login.dto.ts`
**Then** LoginSchema is defined with z.object({
  usernameOrEmail: z.string(),
  password: z.string()
})
**And** the schema infers the TypeScript type

### Story 1.11: DTOs — Token Response

As a developer,
I want Zod schema for token responses,
So that API responses have consistent structure.

**Acceptance Criteria:**

**Given** the project
**When** I check the token DTOs
**Then** TokenResponseSchema is defined with z.object({
  accessToken: z.string(),
  expiresIn: z.number()
})
**And** the schema infers the TypeScript type

### Story 1.12: Service Interfaces (Ports)

As a developer,
I want interfaces for all services (hexagonal ports),
So that implementations are swappable and testable.

**Acceptance Criteria:**

**Given** the project
**When** I check the service interfaces
**Then** IAuthService interface exists with methods: register, login, refresh, logout
**And** IUserService interface exists with methods: findByEmail, findByUsername, create, logDemographics
**And** ITokenService interface exists with methods: generateTokenPair, storeToken, verifyAccessToken
**And** IKeyManager interface exists with methods: getPublicKey, getPrivateKey

### Story 1.13: Exception Hierarchy

As a developer,
I want the complete exception hierarchy defined,
So that error handling is consistent across the application.

**Acceptance Criteria:**

**Given** the project
**When** I check the exception files
**Then** BaseAuthException exists as the root
**And** AuthenticationException (401) with subclasses: InvalidCredentialsException, TokenExpiredException, TokenRevokedException, TokenInvalidSignatureException
**And** AuthorizationException (403) with subclass: UserBlockedException
**And** ValidationException (400) with subclasses: UserExistsException
**And** each exception has an error code (AUTH_*, TOKEN_*, VALIDATION_*)

### Story 1.14: Transaction Pattern

As a developer,
I want the Transaction pattern defined (createTransaction/discard),
So that database operations are properly wrapped.

**Acceptance Criteria:**

**Given** the project
**When** I check the transaction file
**Then** createTransaction(callback) function is defined
**And** callback receives self-contained tx object
**And** auto-commits on success, auto-rollbacks + rethrows on error
**And** discard() is available for explicit cleanup

### Story 1.15: JWT Payload Type

As a developer,
I want the JwtPayload interface defined,
So that JWT operations have type safety.

**Acceptance Criteria:**

**Given** the project
**When** I check the JWT types
**Then** JwtPayload has fields: sub (string, user_id), iat (number), iss (string), kid (string), exp (number)
**And** role field has TODO comment for Phase 4 RBAC

### Story 1.16: API Response Types

As a developer,
I want standardized API response types,
So that all endpoints return consistent response shapes.

**Acceptance Criteria:**

**Given** the project
**When** I check the shared types
**Then** SuccessResponse<T> type exists with success (true) and data (T)
**And** ErrorResponse type exists with success (false) and error (code, message, timestamp, path)

---

## Epic 2: Key Management

**Goal:** Implement RSA key generation and KeyManager service. This must work before any JWT signing.

**Depends on:** Epic 1 (types, entities defined)

### Story 2.1: Key Generation Script

As a developer,
I want a setup script that generates RSA key pairs,
So that JWT signing works without manual key generation.

**Acceptance Criteria:**

**Given** the project
**When** I run `npm run setup:keys`
**Then** `keys.json` is created with kid (UUID v7), publicKey, privateKey, createdAt, expiresAt
**And** file permissions are set to 600 (owner read/write only)
**And** platform architecture and OS are recorded
**And** time to complete is measured and stored

**Given** `keys.json` exists
**When** I run `npm run setup:keys` again
**Then** it does not overwrite existing keys (or warns before overwriting)

**Test Acceptance Criteria:**
**Given** no keys.json exists
**When** setupKeys() is called
**Then** keys.json is created with all required fields
**And** file has correct permissions (600)

**Given** keys.json already exists
**When** setupKeys() is called again
**Then** it throws an error or warns (does not overwrite)

### Story 2.2: KeyManager Service

As a developer,
I want the KeyManager service to read RSA keys from keys.json,
So that JWT signing and verification works.

**Acceptance Criteria:**

**Given** keys.json exists
**When** KeyManager.getPublicKey(kid) is called
**Then** it reads the public key for the specified kid
**And** returns the public key as a string

**Given** keys.json exists
**When** KeyManager.getPrivateKey() is called
**Then** it reads the private key from file
**And** clears the key from memory after use

### Story 2.3: KeyManager Module Registration

As a developer,
I want KeyManager registered in the NestJS module system,
So that it can be injected into other services.

**Acceptance Criteria:**

**Given** the project
**When** I check the module registration
**Then** KeyManager is provided in the appropriate module
**And** it can be injected via @Inject(IKeyManager)

---

## Epic 3: Registration Flow

**Goal:** Implement complete user registration — POST /auth/v1/register. Users can create accounts.

**Depends on:** Epic 1 (types), Epic 2 (KeyManager for JWT)

### Story 3.1: TokenService — JWT Generation

As a developer,
I want the TokenService to generate RSA-signed JWT access tokens,
So that authentication tokens are cryptographically secure.

**Acceptance Criteria:**

**Given** KeyManager is configured
**When** TokenService.generateAccessToken(user) is called
**Then** it creates a JWT with payload: sub (user_id), iat, iss, kid, exp
**And** signs it with the RSA private key
**And** returns the signed JWT string

### Story 3.2: TokenService — Refresh Token

As a developer,
I want the TokenService to generate and hash refresh tokens,
So that refresh token rotation works.

**Acceptance Criteria:**

**Given** TokenService is configured
**When** TokenService.generateRefreshToken() is called
**Then** it generates a cryptographically random token
**And** hashes it with bcrypt (cost=10)
**And** returns both the raw token (for cookie) and hash (for DB)

### Story 3.3: TokenService — Token Storage

As a developer,
I want the TokenService to store refresh tokens in the database,
So that refresh tokens can be validated on use.

**Acceptance Criteria:**

**Given** a user_id and token_hash
**When** TokenService.storeToken(user_id, token_hash, expires_at) is called
**Then** it inserts a row into auth_tokens
**And** uses UPSERT (INSERT ... ON CONFLICT (user_id) DO UPDATE)

### Story 3.4: UserService — User CRUD

As a developer,
I want the UserService to manage user records,
So that user operations are properly encapsulated.

**Acceptance Criteria:**

**Given** UserService is configured
**When** UserService.findByEmail(email) is called
**Then** it queries PostgreSQL for the user
**And** returns User entity or null

**Given** UserService is configured
**When** UserService.findByUsername(username) is called
**Then** it queries PostgreSQL for the user
**And** returns User entity or null

**Given** UserService is configured
**When** UserService.create(userData) is called
**Then** it inserts a new user into PostgreSQL
**And** returns the created User entity

### Story 3.5: AuthService — Registration Logic

As a developer,
I want the AuthService to handle user registration,
So that new users can create accounts.

**Acceptance Criteria:**

**Given** a RegisterDto with valid data
**When** AuthService.register(dto) is called
**Then** it checks username/email uniqueness
**Then** it hashes the password with bcrypt
**Then** it creates the user in Transaction 1
**Then** it generates token pair
**Then** it stores refresh token in Transaction 2
**And** returns {accessToken, refreshToken}

**Given** a RegisterDto with existing username
**When** AuthService.register(dto) is called
**Then** it throws UserExistsException

### Story 3.6: Auth Controller — Register Endpoint

As a developer,
I want the register endpoint wired up,
So that users can register via HTTP.

**Acceptance Criteria:**

**Given** the project
**When** I check AuthController
**Then** POST /auth/v1/register endpoint exists
**And** it validates input with RegisterSchema.parse(body)
**And** it returns 201 with tokens on success
**And** it has Swagger decorators (@ApiTags, @ApiOperation, @ApiResponse)

---

## Epic 4: Login Flow

**Goal:** Implement complete user login — POST /auth/v1/authenticate. Users can authenticate.

**Depends on:** Epic 3 (users exist in DB, TokenService works)

### Story 4.1: TokenService — Token Verification

As a developer,
I want the TokenService to verify JWT access tokens,
So that protected endpoints can validate requests.

**Acceptance Criteria:**

**Given** a signed JWT
**When** TokenService.verifyAccessToken(token) is called
**Then** it verifies the signature using the public key
**And** checks expiry
**And** returns the decoded JwtPayload

**Given** an invalid JWT
**When** TokenService.verifyAccessToken(token) is called
**Then** it throws the appropriate exception (TokenInvalidSignatureException or TokenExpiredException)

### Story 4.2: AuthService — Login Logic

As a developer,
I want the AuthService to handle user login,
So that users can authenticate.

**Acceptance Criteria:**

**Given** valid credentials
**When** AuthService.login(dto) is called
**Then** it looks up user by email or username
**Then** it checks if user is blocked (throws UserBlockedException)
**Then** it validates password with bcrypt
**Then** it uses UPSERT to store/update refresh token
**Then** it logs demographics
**And** returns {accessToken, refreshToken}

**Given** invalid credentials
**When** AuthService.login(dto) is called
**Then** it throws InvalidCredentialsException

### Story 4.3: Auth Controller — Login Endpoint

As a developer,
I want the login endpoint wired up,
So that users can login via HTTP.

**Acceptance Criteria:**

**Given** the project
**When** I check AuthController
**Then** POST /auth/v1/authenticate endpoint exists
**And** it validates input with LoginSchema.parse(body)
**And** it returns 200 with tokens on success
**And** it has Swagger decorators

---

## Epic 5: Token Refresh Flow

**Goal:** Implement complete token refresh — POST /auth/v1/refresh. Sessions can be maintained.

**Depends on:** Epic 4 (login works, tokens exist)

### Story 5.1: AuthService — Refresh Logic

As a developer,
I want the AuthService to handle token refresh,
So that users can maintain sessions.

**Acceptance Criteria:**

**Given** a valid refresh token
**When** AuthService.refresh(refreshToken) is called
**Then** it verifies JWT signature
**Then** it queries auth_tokens by user_id (O(1))
**Then** it compares bcrypt hash
**Then** it updates the token in DB
**And** returns {accessToken, refreshToken}

### Story 5.2: Auth Controller — Refresh Endpoint

As a developer,
I want the refresh endpoint wired up,
So that users can refresh tokens via HTTP.

**Acceptance Criteria:**

**Given** the project
**When** I check AuthController
**Then** POST /auth/v1/refresh endpoint exists
**And** it reads refresh token from httpOnly cookie
**And** it returns 200 with new tokens on success
**And** it has Swagger decorators

---

## Epic 6: Logout Flow

**Goal:** Implement complete user logout — POST /auth/v1/logout. Sessions can be terminated.

**Depends on:** Epic 4 (login works)

### Story 6.1: AuthService — Logout Logic

As a developer,
I want the AuthService to handle logout,
So that sessions can be terminated.

**Acceptance Criteria:**

**Given** a valid accessToken
**When** AuthService.logout(accessToken) is called
**Then** it verifies the access token
**Then** it extracts user_id
**Then** it deletes refresh token from DB by user_id
**And** silently succeeds if token was already invalid/expired

### Story 6.2: Auth Controller — Logout Endpoint

As a developer,
I want the logout endpoint wired up,
So that users can logout via HTTP.

**Acceptance Criteria:**

**Given** the project
**When** I check AuthController
**Then** POST /auth/v1/logout endpoint exists
**And** it reads access token from Authorization header
**And** it clears refresh token cookie
**And** it returns 200 on success
**And** it has Swagger decorators

---

## Epic 7: Auth Guard & Protected Routes

**Goal:** Implement auth guards, middleware, and exception filters. Routes can be protected.

**Depends on:** Epic 4 (login works, tokens can be verified)

### Story 7.1: Auth Middleware

As a developer,
I want middleware that extracts tokens from the Authorization header,
So that guards receive tokens already extracted.

**Acceptance Criteria:**

**Given** a request with Authorization: Bearer <token>
**When** AuthMiddleware processes it
**Then** it extracts the token
**And** attaches it to the request context

### Story 7.2: JWT Auth Guard

As a developer,
I want a JwtAuthGuard that validates access tokens,
So that protected routes are secure.

**Acceptance Criteria:**

**Given** a request with a valid token
**When** JwtAuthGuard canActivate() is called
**Then** it decodes JWT header to extract kid
**Then** it gets public key from KeyManager
**Then** it verifies JWT signature
**Then** it checks Redis blacklist
**Then** it checks expiry
**And** attaches user to request

**Given** a request with an invalid token
**When** JwtAuthGuard canActivate() is called
**Then** it throws the appropriate exception

### Story 7.3: Global Exception Filter

As a developer,
I want a global exception filter that formats all errors consistently,
So that API responses have uniform error structure.

**Acceptance Criteria:**

**Given** an exception is thrown
**When** AllExceptionsFilter catches it
**Then** it returns {success: false, error: {code, message, timestamp, path}}
**And** sets the correct HTTP status code

### Story 7.4: Zod Validation Pipe

As a developer,
I want a global validation pipe that uses Zod schemas,
So that invalid input is rejected before reaching controllers.

**Acceptance Criteria:**

**Given** a request with invalid body
**When** ValidationPipe processes it
**Then** it parses the body with the route's Zod schema
**Then** it rejects the request with 400 status if validation fails
**And** returns Zod error details (field, message, code)

---

## Epic 8: Logging & Observability

**Goal:** Implement structured logging and demographics tracking. System is observable.

**Depends on:** Epic 3 (registration flow works for demographics)

### Story 8.1: Logging Module

As a developer,
I want the LoggingModule with LogManager,
So that modules can create loggers.

**Acceptance Criteria:**

**Given** the project
**When** LoggingModule is imported
**Then** LogManager is available via AppContext
**And** modules can call logManager.getLogger('ModuleName')
**And** returns ILogger with debug, info, warn, error, fatal methods

### Story 8.2: Pino Logger Provider

As a developer,
I want pino + chalk for colorful console output,
So that logs are readable and fast.

**Acceptance Criteria:**

**Given** the project
**When** a log message is written
**Then** it uses pino for structured JSON logging
**And** chalk colors are applied for console output
**And** log levels are configurable via LOG_LEVEL env var

### Story 8.3: Request Logging Interceptor

As a developer,
I want an interceptor that logs all HTTP requests,
So that request/response details are tracked.

**Acceptance Criteria:**

**Given** an HTTP request
**When** LoggingInterceptor processes it
**Then** it logs method, path, status code, duration
**And** includes request ID for tracing
**And** redacts sensitive data (passwords, tokens)

### Story 8.4: Demographics Collection

As a developer,
I want demographics collection to MongoDB,
So that user activity is tracked.

**Acceptance Criteria:**

**Given** a login or registration event
**When** demographics are logged
**Then** a document is inserted into user_demographics
**And** includes user_id, last_ip, location (country, city)
**And** MongoDB connection failure is handled gracefully

---

## Epic 9: Testing & Documentation

**Goal:** Add unit tests, integration tests, and documentation. System is production-ready.

**Depends on:** Epic 7 (all auth flows working)

### Story 9.1: Unit Tests — Services

As a developer,
I want unit tests for all services,
So that business logic is verified.

**Acceptance Criteria:**

**Given** the project
**When** I run `npm run test`
**Then** unit tests pass for AuthService, UserService, TokenService
**And** test coverage is reported

### Story 9.2: Unit Tests — Guards & Filters

As a developer,
I want unit tests for guards and exception filters,
So that security logic is verified.

**Acceptance Criteria:**

**Given** the project
**When** I run `npm run test`
**Then** unit tests pass for JwtAuthGuard, AllExceptionsFilter

### Story 9.3: Integration Tests

As a developer,
I want integration tests for API endpoints,
So that end-to-end flows are verified.

**Acceptance Criteria:**

**Given** the project
**When** I run `npm run test:e2e`
**Then** integration tests pass for register, login, refresh, logout
**And** tests use test database (not production)

### Story 9.4: Documentation

As a developer,
I want comprehensive documentation,
So that the project is easy to understand and maintain.

**Acceptance Criteria:**

**Given** the project
**When** I check README.md
**Then** it has quick start guide, architecture overview, API reference
**And** all public methods have JSDoc comments

### Story 9.5: Docker Configuration

As a developer,
I want Docker Compose configuration,
So that the application can be deployed consistently.

**Acceptance Criteria:**

**Given** the project
**When** I check docker-compose.yml
**Then** it defines services for NestJS app, PostgreSQL, MongoDB, Redis
**And** `docker-compose up` starts all services
**And** health checks are configured

---

*Epic breakdown created. Ready for story creation.*
