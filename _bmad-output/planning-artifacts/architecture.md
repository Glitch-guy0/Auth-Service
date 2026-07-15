# AuthService — Technical Architecture

**Author:** Winston (System Architect) + Paige (Technical Writer)  
**Date:** 2026-07-12  
**Status:** APPROVED  
**Project:** AuthService  
**Framework:** NestJS  
**Architecture Style:** Hexagonal (Ports & Adapters)

---

## 1. Executive Summary

This document defines the technical architecture for AuthService — a scalable authentication service built with NestJS, following hexagonal architecture principles. The system supports simple auth (username/password) now, with a clear path to OAuth consumer/provider in the future.

**Key Design Decisions:**
- Hexagonal architecture for future OAuth provider support
- Per-instance RSA key pairs (private key never in DB)
- Hybrid database: PostgreSQL (core) + MongoDB (logging)
- Module lifecycle: `setup()` → `run()` → `shutdown()`

---

## 2. Architecture Overview

### 2.1 Hexagonal Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INBOUND ADAPTERS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  HTTP Controller          Auth Guard            Admin Controller            │
│  (NestJS Routes)         (NestJS Guards)       (Analytics)                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PORTS (Interfaces)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Auth Port               User Port              Token Port                  │
│  (IAuthService)          (IUserService)         (ITokenService)             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CORE DOMAIN                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Auth Use Cases          User Entity           Token Service                │
│  ├── Signup              ├── Validation        ├── JWT Signing              │
│  ├── Login               └── Business Rules    ├── Token Rotation           │
│  ├── Logout                                     └── Revocation              │
│  └── Refresh                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OUTBOUND ADAPTERS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL              MongoDB               Redis          Vault (Future) │
│  (Core Data)             (Logging)             (Blacklist)    (Secrets)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Module Isolation

Each module follows the same pattern:

```typescript
// Module Interface
interface IAuthModule {
  setup(): Promise<void>;      // Initialize, get env vars
  run(): Promise<void>;        // Normal operation
  shutdown(): Promise<void>;   // Cleanup (optional, called on fatal)
}

// AppContext Global
interface AppContext {
  logManager: LogManager;
  config: Config;
  // ... other shared services
}
```

---

## 3. Database Architecture

### 3.1 PostgreSQL (Core Data)

**Connection:** Primary database for users, tokens, keys

#### Schema: `users`

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,           -- bcrypt hashed
    blocked BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Schema: `auth_tokens`

```sql
CREATE TABLE auth_tokens (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,          -- bcrypt hashed refresh token
    expires_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Schema: `refresh_token_keys`

```sql
CREATE TABLE refresh_token_keys (
    kid UUID PRIMARY KEY,                     -- uuidv7
    public_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    platform_architecture VARCHAR(100),
    platform_os VARCHAR(100),
    time_to_complete INTERVAL
);
```

### 3.2 MongoDB (Logging)

**Connection:** Secondary database for experimental logging

#### Collection: `user_demographics`

```typescript
// MongoDB Document
{
  _id: ObjectId,
  user_id: UUID,              // References users.id
  last_ip: string,
  location: {
    country: string,
    city: string,
    // ... semi-structured
  },
  created_at: Date
}
```

### 3.3 Redis (Blacklisting)

**Connection:** Cache for token blacklisting

```
blacklist:{token_jti} → { expires_at, user_id }
```

---

## 4. Key Management

### 4.1 Key Generation (Setup Script)

```bash
# One-time setup
npm run setup:keys

# Creates keys.json
{
  "kid": "uuidv7",
  "publicKey": "-----BEGIN PUBLIC KEY-----...",
  "privateKey": "-----BEGIN PRIVATE KEY-----...",
  "createdAt": "2026-07-12T00:00:00Z",
  "expiresAt": "2027-07-12T00:00:00Z",
  "platformArchitecture": "arm64",
  "platformOs": "darwin",
  "timeToComplete": "00:00:02.500"
}
```

### 4.2 Key Storage

| Storage | Content | Protection |
|---------|---------|------------|
| `keys.json` | Private + Public keys | File permissions (chmod 600) |
| PostgreSQL | Public key only | DB access control |
| Memory | Private key (temporary) | Cleared after each use |

### 4.3 Key Lifecycle

```
Server Startup
    │
    ├─→ Read keys.json
    │
    ├─→ Check if kid exists in DB
    │   ├─→ Yes: Use existing
    │   └─→ No: Insert to DB (public key only)
    │
    ├─→ Private key stays in file
    │
    └─→ Ready for JWT signing

JWT Signing
    │
    ├─→ Read private key from file
    │
    ├─→ Sign JWT
    │
    ├─→ Delete private key from memory
    │
    └─→ Return signed JWT

Key Expiry
    │
    ├─→ Fatal error logged
    │
    ├─→ Graceful shutdown initiated
    │
    └─→ Process exits
```

---

## 5. Authentication Flow

### 5.1 Signup Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  POST /auth/v1/register                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Request Body:                                                              │
│  {                                                                          │
│    "username": "string (unique)",                                          │
│    "email": "string (unique)",                                             │
│    "password": "string"                                                    │
│  }                                                                          │
│                                                                             │
│  1. Validate username/email uniqueness                                      │
│  2. Hash password (bcrypt, cost=10)                                         │
│  3. Create user with defaults                                               │
│  4. Generate tokens                                                         │
│  5. Return { accessToken, refreshToken (cookie) }                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Login Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  POST /auth/v1/authenticate                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Request Body:                                                              │
│  {                                                                          │
│    "usernameOrEmail": "string",                                            │
│    "password": "string"                                                    │
│  }                                                                          │
│                                                                             │
│  1. Lookup user by email OR username                                        │
│  2. Check if user is blocked                                                │
│  3. Validate password (bcrypt)                                              │
│  4. Generate tokens                                                         │
│  5. Return { accessToken, refreshToken (cookie) }                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Token Refresh Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  POST /auth/v1/refresh                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Cookie: refreshToken                                                       │
│                                                                             │
│  1. Validate refresh token from cookie                                      │
│  2. Check if token exists in DB (not revoked)                               │
│  3. Rotate: delete old + insert new                                         │
│  4. Generate new access token                                               │
│  5. Return { accessToken, refreshToken (new cookie) }                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Logout Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  POST /auth/v1/logout                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Get access token from request                                           │
│  2. Verify access token                                                     │
│  3. Extract user_id                                                         │
│  4. Delete refresh token from DB by user_id (PostgreSQL first)              │
│  5. Add access token to Redis blacklist (TTL = token expiry) (Redis second) │
│  6. Clear refresh token cookie                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Token Strategy

### 6.1 JWT Structure

```typescript
// Access Token Payload
interface AccessTokenPayload {
  sub: string;           // user_id
  role: string;          // 'admin' | 'user' | 'client'
  iat: number;           // authenticated_at
  iss: string;           // server_id
  kid: string;           // key ID for rotation
  exp: number;           // 1 day (tunable)
}

// Refresh Token
// Stored in cookie (httpOnly, secure, sameSite=strict)
// Also stored in DB (bcrypt hashed)
```

### 6.2 Token Expiry (Tunable Constants)

```typescript
class TokenConfig {
  static readonly ACCESS_TOKEN_EXPIRY = '1d';   // 1 day
  static readonly REFRESH_TOKEN_EXPIRY = '7d';  // 1 week
  static readonly RESET_TOKEN_EXPIRY = '1h';    // 1 hour
}
```

### 6.3 Cookie Configuration

```typescript
const REFRESH_TOKEN_COOKIE = {
  httpOnly: true,         // Prevent XSS access
  secure: true,           // HTTPS only (prod)
  sameSite: 'strict',     // CSRF protection
  path: '/auth',          // Limit scope
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
};
```

---

## 7. Environment Management

### 7.1 Configuration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  .env File                                                                 │
│  (same for dev and production)                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  env reader                                                                 │
│  (reads .env file)                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  validator                                                                  │
│  (validates required env vars + type checks)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Modules                                                                    │
│  └── setup() calls appContext to get env vars                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/authservice
MONGODB_URL=mongodb://localhost:27017/authservice
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_EXPIRY=1d
JWT_REFRESH_EXPIRY=7d
JWT_RESET_EXPIRY=1h
BCRYPT_COST=10

# Server
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=debug  # debug | info | warn | error | fatal
```

---

## 8. Logging Architecture

### 8.1 Layered Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Modules                                                                    │
│  └── appContext.logManager.getLogger('ModuleName') → ILogger               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  loggerService                                                              │
│  ├── debug()                                                                │
│  ├── warn()                                                                 │
│  ├── info()                                                                 │
│  ├── error()                                                                │
│  └── fatal()  → triggers graceful shutdown                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  logProvider                                                                │
│  (pino + chalk for color)                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Telemetry Factory                                                          │
│  (logs only for now)                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                      ┌───────────────┴───────────────┐
                      ▼                               ▼
            ┌─────────────────┐             ┌─────────────────┐
            │ metricsProvider │             │ tracerService   │
            │ (Future)        │             │ (Future)        │
            └─────────────────┘             └─────────────────┘
```

### 8.2 Module Lifecycle

```typescript
interface IModule {
  setup(): Promise<void>;      // Initialize, get env vars
  run(): Promise<void>;        // Normal operation
  shutdown(): Promise<void>;   // Cleanup (optional)
}

// Example
class AuthModule implements IModule {
  async setup() {
    this.config = appContext.config;
    this.logger = appContext.logManager.getLogger('AuthModule');
    // ... initialization
  }

  async run() {
    this.logger.info('AuthModule started');
    // ... normal operation
  }

  async shutdown() {
    this.logger.info('AuthModule shutting down');
    // ... cleanup
  }
}
```

---

## 9. Vault Abstraction (Future)

### 9.1 Port Interface

```typescript
interface ISecretProvider {
  getSecret(key: string): Promise<string>;
  setSecret(key: string, value: string): Promise<void>;
  deleteSecret(key: string): Promise<void>;
}
```

### 9.2 Adapter Implementations

```typescript
// Current: File-based
class FileSecretProvider implements ISecretProvider {
  async getSecret(key: string): Promise<string> {
    // Read from .env or file
  }
}

// Future: HashiCorp Vault
class VaultSecretProvider implements ISecretProvider {
  async getSecret(key: string): Promise<string> {
    // Read from Vault
  }
}

// Future: AWS Secrets Manager
class AwsSecretsManagerProvider implements ISecretProvider {
  async getSecret(key: string): Promise<string> {
    // Read from AWS
  }
}
```

**Key Point:** Only the adapter changes — core domain stays the same.

---

## 10. RBAC Model (Planned)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Role Hierarchy                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  admin                                                                      │
│  ├── Full system access                                                     │
│  ├── User management                                                        │
│  └── Analytics access                                                       │
│                                                                             │
│  user                                                                       │
│  ├── Profile management                                                     │
│  ├── Own data access                                                        │
│  └── Limited API access                                                     │
│                                                                             │
│  client                                                                     │
│  ├── Read-only API access                                                   │
│  └── Public endpoints only                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. API Routes

### 11.1 Base Path: `/auth/v1`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/authenticate` | Serve login HTML | No |
| POST | `/authenticate` | Login → tokens | No |
| GET | `/register` | Serve signup HTML | No |
| POST | `/register` | Signup → tokens | No |
| POST | `/refresh` | Refresh access token | Yes (cookie) |
| POST | `/logout` | Logout + blacklist | Yes |

### 11.2 Response Format

```typescript
// Success Response
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "role": "string"
    }
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid username or password"
  }
}
```

---

## 12. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Password storage | bcrypt (cost=10) |
| Token storage | bcrypt (refresh), JWT (access) |
| Private key exposure | File permissions, memory cleanup |
| CSRF | SameSite=strict cookie |
| XSS | HttpOnly cookie |
| Brute force | Rate limiting (planned) |
| Token revocation | Redis blacklist |

---

## 13. Deployment Architecture

### 13.1 Single Instance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Server                                                                     │
│  ├── NestJS Application                                                     │
│  │   ├── Auth Module                                                        │
│  │   ├── User Module                                                        │
│  │   └── Token Module                                                       │
│  ├── keys.json (file permissions)                                           │
│  └── .env                                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              ┌──────────┐     ┌──────────┐     ┌──────────┐
              │ PostgreSQL│     │ MongoDB  │     │  Redis   │
              └──────────┘     └──────────┘     └──────────┘
```

### 13.2 Multi-Instance (Future)

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  Instance 1         │  │  Instance 2         │  │  Instance 3         │
│  ├── keys.json      │  │  ├── keys.json      │  │  ├── keys.json      │
│  └── Same DB        │  │  └── Same DB        │  │  └── Same DB        │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
                                      │
                                      ▼
                        ┌──────────────────────────┐
                        │  Shared Databases         │
                        │  ├── PostgreSQL           │
                        │  ├── MongoDB              │
                        │  └── Redis                │
                        └──────────────────────────┘
```

---

## 14. Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | NestJS | TypeScript, modular, DI |
| Language | TypeScript | Type safety, IDE support |
| Database (Core) | PostgreSQL | ACID, RBAC, mature |
| Database (Log) | MongoDB | Flexible schema, fast writes |
| Cache | Redis | Blacklist, future caching |
| JWT Library | jose | RSA signing, JWK support |
| Password Hash | bcrypt | Industry standard |
| Logger | pino + chalk | Fast, colorful console output |
| Validation | Zod (strictly) | Runtime validation with TypeScript type inference |
| ORM | Prisma or TypeORM | Database abstraction |

---

## 15. Implementation Phases

### Phase 1: Core Auth (Current)
- [ ] Project setup (NestJS)
- [ ] Environment management
- [ ] Key management (setup script)
- [ ] User entity + repository
- [ ] Signup flow
- [ ] Login flow
- [ ] Token generation (JWT)
- [ ] Refresh token rotation
- [ ] Logout + blacklisting
- [ ] Logging infrastructure

### Phase 2: Security Hardening
- [ ] Rate limiting
- [ ] Password reset flow
- [ ] Email verification
- [ ] Input validation
- [ ] Security headers

### Phase 3: Admin & Analytics
- [ ] RBAC implementation
- [ ] Admin endpoints
- [ ] Analytics dashboard
- [ ] User demographics logging

### Phase 4: OAuth (Future)
- [ ] OAuth consumer (Google, GitHub)
- [ ] OAuth provider
- [ ] SSO client library

---

*Architecture approved. Ready for implementation.*
