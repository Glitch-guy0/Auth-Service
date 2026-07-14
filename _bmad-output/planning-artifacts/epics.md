---
stepsCompleted:
  - "Step 1: Validate Prerequisites and Extract Requirements"
  - "Step 2: Design Epic List"
  - "Step 3: Generate Epics and Stories"
  - "Step 4: Final Validation"
inputDocuments:
  - "_bmad-output/planning-artifacts/prds/prd-AuthService-2026-07-12/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
---

# AuthService - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for AuthService, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-1: User Registration - POST /auth/v1/register creates accounts with username, email, and password. Returns HTTP 201 with access token on success. Hashed with bcrypt (cost=10) before storage.
FR-2: User Login - POST /auth/v1/authenticate verifies credentials, returns access token, sets secure httpOnly refresh token cookie. Returns HTTP 200 on success.
FR-3: Token Refresh - POST /auth/v1/refresh rotates access/refresh tokens.
FR-4: User Logout - POST /auth/v1/logout clears cookies, deletes refresh token in DB, blacklists access token in Redis.
FR-5: JWT Token Generation - RSA signed access token with kid, sub, iat, iss, exp, user_id.
FR-6: Refresh Token Rotation - Rotates refresh token on every refresh request, invalidating/updating PostgreSQL hash.
FR-7: Key Management - Dynamic RSA key pair retrieval and validation through KeyManager registry.
FR-8: Rate Limiting - Prevent brute force on login; returns HTTP 429 when limits exceeded.
FR-9: Password Reset - Token-based password reset flow (1 hour expiry, in-memory tokens only, no email in v1).
FR-10: Email Verification - Verification flow (deferred/stubbed for v1).
FR-11: Input Validation - Validate incoming payloads using Zod schemas; reject invalid inputs with proper validation errors.
FR-12: Security Headers - Inject standard security headers (Helmet, CORS) via middleware.
FR-13: User Entity - Stores core attributes in PostgreSQL USERS table.
FR-14: User Lookup - Lookup users by UUID, username, or email.
FR-15: User Blocking - Prevent blocked users from authenticating or refreshing.
FR-16: Structured Logging - Basic logging framework using pino.
FR-17: Request Logging - Log HTTP request details and duration using pino middleware/interceptor.
FR-18: User Demographics Logging - Asynchronously write IP and country/city demographics to MongoDB on auth events.
FR-19: Development Setup - Run development server via npm run start:dev.
FR-20: Documentation - 100% documentation coverage of setup and APIs.
FR-21: Testing - Unit tests run via npm run test, integration via npm run test:e2e.
FR-22: Build & Deployment - Compile production bundle via npm run build, start production server, provide Docker Compose config.
FR-23: PostgreSQL Schema - PostgreSQL tables for users, auth_tokens (one-to-one with user_id as PK), and public_key_registry.
FR-24: MongoDB Collection - MongoDB user_demographics, audit_log, and activity collections.
FR-25: Redis Cache - Redis for token blacklisting (blacklist:token TTL) and rate limiting.

### NonFunctional Requirements

NFR-1: Performance / Speed - Response times should be secure (use of bcrypt cost=10 is mandatory even if it adds CPU latency).
NFR-2: Scalability - Hexagonal architecture to support future addition of social login (Google, GitHub) or MFA without core refactoring.
NFR-3: Service Reliability - Authentication success rate must be > 99.9% (SM-1).
NFR-4: Token Refresh Reliability - Token refresh success rate must be > 99.9% (SM-2).
NFR-5: Setup Simplicity - Local environment setup must complete in < 5 minutes (SM-3).
NFR-6: Test Coverage - Maintain > 80% test coverage (SM-5).
NFR-7: Security Compliance - Zero critical security vulnerabilities (SM-6), secure httpOnly cookies, strict SameSite settings, and dynamic RSA key rotation.

### Additional Requirements

- **Hexagonal Architecture:** The codebase must be organized into strict hexagonal layers: Controller (Layer 1), Middleware (Layer 2), Guard (Layer 3), Interceptor (Layer 4), Pipe (Layer 5), Service (Layer 6), Interface/Ports (Layer 6.1), Repository (Layer 7), Adapter (Layer 8), and Plugin (Layer 9).
- **Single Session Constraint:** Exactly one active refresh token session is allowed per user. Enforced by setting `user_id` as the Primary Key of the PostgreSQL `auth_tokens` table.
- **Key Rotation Support:** Keys are rotated dynamically using a KeyID (`kid`) lookup. The public keys are stored in `PUBLIC_KEY_REGISTRY` table.
- **Asynchronous Analytical Logging:** Writing analytics and user demographics to MongoDB must be decoupled from the core transaction and handled asynchronously so it does not block user authentication response.
- **Error Handling Pipeline:** Use of standard NestJS exceptions filters (`HttpExceptionFilter`, `AllExceptionsFilter`) extending a `BaseAuthException` abstract class to return standard JSON error structures containing unique error codes.

### UX Design Requirements

*None (This is a backend-only HTTP API service)*

### FR Coverage Map

FR-1: Epic 1 - User Registration flow saving to USERS and returning JWT and refresh cookie.
FR-2: Epic 1 - User Authentication flow verifying bcrypt password hash and returning tokens.
FR-3: Epic 1 - Token Refresh flow rotating refresh token cookie and returning new pair.
FR-4: Epic 1 - User Logout flow clearing cookies, deleting refresh token and triggering blacklist.
FR-5: Epic 1 - RSA-signed JWT generation for access tokens.
FR-6: Epic 1 - Refresh Token Rotation updating PostgreSQL `auth_tokens` database.
FR-7: Epic 1 - KeyManager registry for RSA keys.
FR-8: Epic 2 - Rate Limiting to prevent brute force on login.
FR-9: Epic 2 - In-memory token-based password reset flow (no email).
FR-10: Epic 2 - Email Verification flow (stubbed/in-memory).
FR-11: Epic 2 - Input validation using Zod schemas at controller entry points.
FR-12: Epic 2 - Helmet and CORS security headers.
FR-13: Epic 1 - USERS database entity mapping with uuid, email, username, blocked status.
FR-14: Epic 1 - User lookup operations in UserService.
FR-15: Epic 2 - Rejection of authenticated requests if a user is blocked.
FR-16: Epic 3 - Base structured logging using Pino.
FR-17: Epic 3 - Request logging middleware/interceptor.
FR-18: Epic 3 - Asynchronous Demographics Logging to MongoDB.
FR-19: Epic 1 - Local development setup and script configuration.
FR-20: Epic 4 - Project documentation (README, guides).
FR-21: Epic 4 - Automated unit and integration testing setup.
FR-22: Epic 4 - Production build and Docker Compose configuration.
FR-23: Epic 1 - PostgreSQL database schema (`users`, `auth_tokens`, `public_key_registry`).
FR-24: Epic 3 - MongoDB collections config (Mongoose demographics models).
FR-25: Epic 2 - Redis token blacklist management and validation check in JwtAuthGuard.

## Epic List

### Epic 1: Core Authentication & Sessions
Provide user registration, login, token refresh, and logout capabilities. Enforce a single session constraint via PostgreSQL auth_tokens where user_id is the primary key. Sign JWTs statelessly with RSA keys retrieved from KeyManager.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-13, FR-14, FR-19, FR-23

### Epic 2: Security Hardening & Rate Limiting
Protect the auth endpoints with rate limiting, input validation via Zod schemas, secure HTTP headers, user blocking interceptors, in-memory password resets, and access token blacklisting in Redis with TTL validation in JwtAuthGuard.
**FRs covered:** FR-8, FR-9, FR-10, FR-11, FR-12, FR-15, FR-25

### Epic 3: Logging & Analytical Demographics
Asynchronously capture user IP and geolocation demographics in MongoDB on auth events. Log HTTP requests and durations via interceptors using Pino, and format base exceptions.
**FRs covered:** FR-16, FR-17, FR-18, FR-24

### Epic 4: Testing & Production Deployment
Provide production builds, start scripts, Docker Compose environments, and comprehensive automated test suites (unit and end-to-end integration tests).
**FRs covered:** FR-20, FR-21, FR-22

---

## Epic 1: Core Authentication & Sessions

Decompose the registration, login, token refresh, and logout flows into actionable stories using PostgreSQL as the relational backend. Enforces the single active session constraint.

### Story 1.1: Project Scaffolding & Initial Configuration
As a developer,  
I want to initialize the NestJS repository with typescript configuration, package dependencies, environment validation, and core module scaffolding,  
So that I can begin implementing features in a clean, standard hexagonal structure.

**Acceptance Criteria:**
*   **Given** a clean Node.js 22 runtime environment  
*   **When** I run `npm install` and define `.env` variables  
*   **Then** the environment validator must verify all required variables (DATABASE_URL, MONGODB_URL, REDIS_URL, JWT_ACCESS_EXPIRY, etc.)  
*   **And** `npm run start:dev` must boot the server successfully on the target port.

### Story 1.2: PostgreSQL Database Schema Setup
As a developer,  
I want to create migrations and TypeORM configurations for core entities (users, auth_tokens, public_key_registry),  
So that the database schema is provisioned with correct keys and foreign constraints.

**Acceptance Criteria:**
*   **Given** an active connection to PostgreSQL  
*   **When** I run TypeORM migrations (`npm run migration:run`)  
*   **Then** tables `users`, `auth_tokens`, and `public_key_registry` must be created.  
*   **And** the `auth_tokens` table must use `user_id` as its Primary Key (enforcing the single session constraint).  
*   **And** the `users` table must use UUID v4 values for identifiers.

### Story 1.3: KeyManager & RSA Key Management
As a developer,  
I want to establish the KeyManager adapter to load, cache, and rotate RSA keys,  
So that access tokens can be signed and verified using secure asymmetric cryptography.

**Acceptance Criteria:**
*   **Given** a request to sign an access token  
*   **When** the KeyManager is initialized  
*   **Then** it must retrieve the current private key, sign the JWT, and immediately clear the private key from memory.  
*   **And** it must write the corresponding public key to `public_key_registry` with a unique Key ID (`kid`).

### Story 1.4: User Registration Flow
As a new user,  
I want to submit email, username, and password to `/auth/v1/register`,  
So that a secure account is created and I receive my initial session tokens.

**Acceptance Criteria:**
*   **Given** unique email and username values  
*   **When** I POST to `/auth/v1/register`  
*   **Then** the system must hash the password using bcrypt (cost=10).  
*   **And** insert a new row in the `users` table.  
*   **And** generate and return a JWT access token in the response body.  
*   **And** store the bcrypt-hashed refresh token in the `auth_tokens` table.

### Story 1.5: User Login Flow
As a user,  
I want to log in using `/auth/v1/authenticate` with username/email and password,  
So that my identity is verified and my session cookie is set.

**Acceptance Criteria:**
*   **Given** a user is active and registered  
*   **When** I POST valid credentials to `/auth/v1/authenticate`  
*   **Then** the system must verify the credentials via bcrypt comparison.  
*   **And** return a JWT access token in the response body.  
*   **And** set a secure, httpOnly, sameSite=strict cookie containing the refresh token.

### Story 1.6: Token Refresh Rotation Flow
As an authenticated user,  
I want to send my refresh token cookie to `/auth/v1/refresh`,  
So that my access token is rotated without needing to prompt me for credentials.

**Acceptance Criteria:**
*   **Given** a valid refresh token cookie  
*   **When** I POST to `/auth/v1/refresh`  
*   **Then** the system must retrieve the stored hash from PostgreSQL and run bcrypt comparison.  
*   **And** issue a fresh RSA-signed access token.  
*   **And** rotate the refresh token, saving the new hash to PostgreSQL `auth_tokens` (updating the single record).  
*   **And** set the new cookie.

### Story 1.7: User Logout Flow
As a logged-in user,  
I want to trigger `/auth/v1/logout` to clear my active session,  
So that my tokens are immediately revoked.

**Acceptance Criteria:**
*   **Given** a user has an active session  
*   **When** I POST to `/auth/v1/logout`  
*   **Then** the system must delete the corresponding refresh token row in PostgreSQL `auth_tokens` (removing the active session).  
*   **And** clear the refresh token cookie on the HTTP response.

---

## Epic 2: Security Hardening & Rate Limiting

Secure the application layers using guards, filters, interceptors, and Redis storage.

### Story 2.1: Input Validation with Zod
As an API consumer,  
I want incoming HTTP payloads validated against schemas,  
So that malformed requests are rejected immediately with structured error codes.

**Acceptance Criteria:**
*   **Given** a client payload to register or login  
*   **When** properties fail to match the Zod schema (`RegisterSchema` or `LoginSchema`)  
*   **Then** the system must reject the request with HTTP 400 Bad Request.  
*   **And** return a structured JSON response with `code: VALIDATION_ERROR` (or specific sub-codes like `VALIDATION_EMAIL`).

### Story 2.2: Rate Limiting Guard
As a system administrator,  
I want to rate-limit requests to auth endpoints using a Redis back-end,  
So that brute force and DDoS attempts are blocked.

**Acceptance Criteria:**
*   **Given** a client calling login or register endpoints  
*   **When** request volume exceeds the maximum threshold within a window  
*   **Then** Redis must increment the request bucket count.  
*   **And** block subsequent requests, returning HTTP 429 Too Many Requests with `code: RATE_LIMIT_EXCEEDED`.

### Story 2.3: Security Headers and CORS
As a system architect,  
I want to configure Helmet middleware and CORS rules on the NestJS app,  
So that browser clients can safely interact with endpoints without cross-site scripting vulnerabilities.

**Acceptance Criteria:**
*   **Given** a client requesting resources from the server  
*   **When** headers are generated by the app  
*   **Then** standard security headers (XSS, Frame Options, HSTS) must be present.  
*   **And** CORS origins must be validated against whitelist configuration.

### Story 2.4: User Blocking Guard
As an administrator,  
I want authentication requests from blocked users to be rejected immediately,  
So that unauthorized access is suspended.

**Acceptance Criteria:**
*   **Given** a user account with `blocked: true` in the database  
*   **When** the user attempts to log in or refresh their token  
*   **Then** the service must check `user.blocked` and throw `UserBlockedException`.  
*   **And** return HTTP 403 Forbidden with `code: AUTH_USER_BLOCKED`.

### Story 2.5: Access Token Blacklisting in Redis
As a security engineer,  
I want logged-out access tokens cached in Redis as blacklisted until their expiry,  
So that they cannot be re-used to access protected endpoints.

**Acceptance Criteria:**
*   **Given** a user successfully logs out  
*   **When** the access token is decoded for remaining expiry TTL  
*   **Then** the token must be saved to Redis with a `blacklist:` prefix and key TTL.  
*   **And** the `JwtAuthGuard` must check Redis on every protected request and return HTTP 401 Unauthorized if found.

### Story 2.6: In-Memory Password Reset Flow
As a user who forgot my password,  
I want to submit my email and reset my password using a token,  
So that I can recover my account securely without external email dependencies.

**Acceptance Criteria:**
*   **Given** a registered user email  
*   **When** I request a password reset  
*   **Then** the system must generate a reset token (1 hour expiry) stored in-memory, returning it in the API response.  
*   **And** update the password in PostgreSQL when the valid token is submitted with a new password.

---

## Epic 3: Logging & Analytical Demographics

Capture demographics and request details asynchronously in MongoDB.

### Story 3.1: Structured Logging with Pino
As a system administrator,  
I want all application logs formatted as JSON with structured metadata,  
So that they can be easily aggregated and searched.

**Acceptance Criteria:**
*   **Given** the application generates logs  
*   **When** messages are written to stdout  
*   **Then** they must be structured JSON logs including timestamp, log level, request context, and request ID.

### Story 3.2: Request & Response Logging
As a developer,  
I want all incoming HTTP requests and response times logged via interceptors,  
So that API latency and performance bottlenecks can be monitored.

**Acceptance Criteria:**
*   **Given** an incoming HTTP request  
*   **When** the response is dispatched to the client  
*   **Then** the `LoggingInterceptor` must log the HTTP method, route, status code, and execution time in milliseconds.

### Story 3.3: Asynchronous Demographics Logging to MongoDB
As a business analyst,  
I want user demographics (IP, location) logged to MongoDB on auth events asynchronously,  
So that analytics are tracked without slowing down user authentications.

**Acceptance Criteria:**
*   **Given** a successful user registration or login event  
*   **When** IP address and User-Agent are captured  
*   **Then** the system must perform an asynchronous write to MongoDB `user_demographics` collection.  
*   **And** the HTTP response must be returned to the client immediately without blocking on the MongoDB operation.

---

## Epic 4: Testing & Production Deployment

Scaffold testing suites and compile containers for production.

### Story 4.1: Automated Unit Testing Suite
As a developer,  
I want unit tests for services, utilities, and guards,  
So that I can verify logic correctness during development.

**Acceptance Criteria:**
*   **Given** unit test specifications  
*   **When** I execute `npm run test`  
*   **Then** unit test suites for `AuthService`, `TokenService`, `KeyManager`, and validation pipes must run and pass.  
*   **And** code coverage must be reported.

### Story 4.2: E2E Integration Testing Suite
As a QA engineer,  
I want E2E integration tests for register, authenticate, refresh, and logout endpoints,  
So that end-to-end authentication flows can be regression-tested.

**Acceptance Criteria:**
*   **Given** a running test database and cache instance  
*   **When** I run `npm run test:e2e`  
*   **Then** the test framework must simulate client HTTP calls and assert correct status codes, body response shapes, and cookie headers.

### Story 4.3: Docker Compose & Production Build Setup
As a system administrator,  
I want compilation scripts and Docker configurations for core services,  
So that deployment is standardized.

**Acceptance Criteria:**
*   **Given** deployment-ready codebase  
*   **When** I run `npm run build`  
*   **Then** the typescript application compiles into `dist/`.  
*   **And** running `docker-compose up` stands up PostgreSQL, Redis, MongoDB, and the NestJS app containers linked correctly.

### Story 4.4: Project Documentation & API Reference
As an onboarding developer,  
I want setup instructions and endpoint references in markdown,  
So that I can quickly set up and integrate with the service.

**Acceptance Criteria:**
*   **Given** documentation guides in `docs/`  
*   **When** I read the references  
*   **Then** I must see clear setup commands, environment configs, and endpoint documentation.
