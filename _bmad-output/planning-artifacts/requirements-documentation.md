# AuthService — Requirements Documentation

**Status:** APPROVED  
**Source of Truth:** Approved UML Diagrams (`_bmad-output/implementation-artifacts/uml/approved/`)  
**Scope:** v1 Core Backend Authentication Service

---

## 1. System Requirements Diagram Reference

The system requirements diagram is stored as a separate Mermaid requirement diagram file.

*   **View Diagram File:** [requirements.mmd](file:///Users/prajwal/Documents/learning/AuthService/_bmad-output/planning-artifacts/requirements.mmd)

---

## 2. Requirement Details & Design Mapping

### 2.1 Core Authentication Flow Requirements

#### FR-1: User Registration
*   **Description:** The system must allow users to register with a unique email, unique username, and password. Passwords must be hashed using bcrypt (rounds = 10) before database persist.
*   **UML Source of Truth:** [01-sequence-registration.mmd](file:///Users/prajwal/Documents/learning/AuthService/_bmad-output/implementation-artifacts/uml/approved/01-sequence-registration.mmd)
*   **System Action:**
    1. Validate registration inputs (`RegisterSchema.parse`).
    2. Check uniqueness of email and username in PostgreSQL.
    3. Generate user entity UUID, hash password, and store in PostgreSQL.
    4. Issue JWT access token and hashed refresh token (persisted in PostgreSQL `auth_tokens` table).
    5. Asynchronously log demographics details.

#### FR-2: User Login
*   **Description:** Users must be authenticated using email/username and password. Upon successful validation, the system returns a JWT access token in the response and sets a secure, httpOnly, sameSite=strict cookie containing the refresh token.
*   **UML Source of Truth:** [02-sequence-login.mmd](file:///Users/prajwal/Documents/learning/AuthService/_bmad-output/implementation-artifacts/uml/approved/02-sequence-login.mmd)
*   **System Action:**
    1. Parse and validate login DTO.
    2. Retrieve user entity from PostgreSQL (check is_blocked status).
    3. Perform bcrypt comparison of input password and stored hash.
    4. Upsert `auth_tokens` table with new hashed refresh token (replacing existing session).

#### FR-3: Token Refresh
*   **Description:** The system must support issuing a new access token and refresh token pair when presented with a valid, non-expired refresh token.
*   **UML Source of Truth:** [03-sequence-refresh.mmd](file:///Users/prajwal/Documents/learning/AuthService/_bmad-output/implementation-artifacts/uml/approved/03-sequence-refresh.mmd)
*   **System Action:**
    1. Decode JWT header to extract key ID (`kid`).
    2. Retrieve public key from `KeyManager` and verify signature.
    3. Extract user ID and retrieve refresh token hash from PostgreSQL `auth_tokens` table.
    4. Perform bcrypt comparison of incoming token against stored hash.
    5. Issue a new token pair, invalidate/update old refresh token hash in PostgreSQL, and set new cookie.

#### FR-4: User Logout
*   **Description:** The logout request must revoke both access and refresh tokens. The refresh token record in the database is deleted, and the access token is blacklisted in Redis to prevent reuse.
*   **UML Source of Truth:** [04-sequence-logout.mmd](file:///Users/prajwal/Documents/learning/AuthService/_bmad-output/implementation-artifacts/uml/approved/04-sequence-logout.mmd) & [04-redis-blacklist.mmd](file:///Users/prajwal/Documents/learning/AuthService/_bmad-output/implementation-artifacts/uml/approved/04-redis-blacklist.mmd)
*   **System Action:**
    1. Extract access token from authorization header and refresh token from cookie.
    2. Clear refresh token cookie.
    3. Retrieve user ID from access token payload, and delete the corresponding refresh token row in PostgreSQL `auth_tokens`.
    4. Blacklist the access token in Redis using a key pattern `blacklist:{access_token}` and TTL matching the token's remaining expiry (best-effort write).

---

### 2.2 Token Lifecycle & Verification Requirements

#### FR-5: JWT Token Generation
*   **Description:** Access tokens must be signed JWTs using RSA algorithms, containing standard claims (`sub`, `iat`, `iss`, `kid`, `exp`, `user_id`).
*   **UML Source of Truth:** [06-types-interfaces.mmd](file:///Users/prajwal/Documents/learning/AuthService/_bmad-output/implementation-artifacts/uml/approved/06-types-interfaces.mmd)

#### FR-6: Refresh Token Rotation
*   **Description:** A refresh token can only be used once. During a refresh request, a new refresh token is issued, and the database record is updated with the new hash.
*   **UML Source of Truth:** [03-sequence-refresh.mmd](file:///Users/prajwal/Documents/learning/AuthService/_bmad-output/implementation-artifacts/uml/approved/03-sequence-refresh.mmd)

#### FR-7: Key Management
*   **Description:** System must support secure retrieval and lifecycle management of RSA keys for signing and verification through a `KeyManager`. Public keys must be stored in the database with their respective `kid` (Key ID).
*   **UML Source of Truth:** [05-class-entities.mmd](file:///Users/prajwal/Documents/learning/AuthService/_bmad-output/implementation-artifacts/uml/approved/05-class-entities.mmd)

#### FR-25: Token Blacklisting (Redis)
*   **Description:** Logged-out access tokens must be placed in a Redis cache with a TTL equal to the token's remaining lifespan. The `JwtAuthGuard` must inspect Redis on every request before granting access.
*   **UML Source of Truth:** [04-redis-blacklist.mmd](file:///Users/prajwal/Documents/learning/AuthService/_bmad-output/implementation-artifacts/uml/approved/04-redis-blacklist.mmd) & [11-sequence-auth-guard.mmd](file:///Users/prajwal/Documents/learning/AuthService/_bmad-output/implementation-artifacts/uml/approved/11-sequence-auth-guard.mmd)

---

### 2.3 User Domain & Data Requirements

#### FR-13: Single Session Constraint (User Entity & Tokens Relationship)
*   **Description:** To enforce security, a user is allowed exactly one active refresh token session at a time. This is implemented at the schema level: `user_id` acts as the Primary Key in the `auth_tokens` table.
*   **UML Source of Truth:** [05-class-entities.mmd](file:///Users/prajwal/Documents/learning/AuthService/_bmad-output/implementation-artifacts/uml/approved/05-class-entities.mmd)

#### FR-15: User Blocking
*   **Description:** Blocked users (`blocked: true`) must have authentication requests blocked immediately during registration, login, or token refresh checks.
*   **UML Source of Truth:** [02-sequence-login.mmd](file:///Users/prajwal/Documents/learning/AuthService/_bmad-output/implementation-artifacts/uml/approved/02-sequence-login.mmd)

#### FR-18: User Demographics Logging
*   **Description:** System logs auth events (login/registration metadata) including IP and location demographics. This writing operation must execute asynchronously without blocking the client's HTTP response.
*   **UML Source of Truth:** [08-component-hexagonal.mmd](file:///Users/prajwal/Documents/learning/AuthService/_bmad-output/component-hexagonal.mmd) (Layer 8 Mongoose Demographics Repository) & [10-object-runtime.mmd](file:///Users/prajwal/Documents/learning/AuthService/_bmad-output/object-runtime.mmd) (MongoDB Adapter).

---

## 3. Technology Stack & Component Architecture

As defined by the component hierarchy (`08-component-hexagonal.mmd`) and package tree (`09-package-modules-tree.mmd`), the architecture follows **Hexagonal (Ports and Adapters) Architecture** implemented using **NestJS**:

1.  **Framework:** NestJS (Node.js framework using TypeScript)
2.  **Core Databases:**
    *   **PostgreSQL:** Relational database for core entities (`users`, `auth_tokens`, `public_key_registry`) managed using **TypeORM**.
    *   **MongoDB:** Document store for analytical records (`user_demographics`, `audit_logs`, `activity`) managed using **Mongoose**.
    *   **Redis:** In-memory store for blacklist tracking (`blacklist:<access_token>`), session caching, and rate limiting.
3.  **Validation Layer:** Inputs are checked statelessly at controllers using **Zod Schemas** (inferred as DTO types).
4.  **Guard Layer:**
    *   `JwtAuthGuard`: Validates signatures using RSA public keys retrieved from `KeyManager` and rejects blacklisted tokens queried from Redis.
    *   `RolesGuard`: Verifies role permission constraints (Roles: Admin, User, Client).
