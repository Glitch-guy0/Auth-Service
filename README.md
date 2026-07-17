# AuthService

> Scalable NestJS authentication service with hexagonal architecture, RSA-signed JWTs, refresh token rotation, and per-instance key management.

## Quick Start

### Prerequisites

- **Node.js** >= 18
- **PostgreSQL** >= 14
- **MongoDB** >= 6
- **Redis** >= 7

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd AuthService

# Install dependencies
npm install

# Copy environment template and configure
cp .env.example .env
# Edit .env with your database and Redis connection strings

# Generate RSA key pair for JWT signing
npm run setup:keys

# Run database migrations
npm run db:migrate

# Start the development server
npm run start:dev
```

The server starts at `http://localhost:3000`. Swagger UI is available at `/api`.

### Docker (Alternative)

```bash
docker compose up -d
docker compose exec app npm run db:migrate
```

## Architecture

AuthService follows **Hexagonal Architecture** (Ports & Adapters). The core domain is isolated from infrastructure concerns through port interfaces.

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

### Ports & Adapters

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| **Inbound** | HTTP Controller | Route handling, request validation |
| **Inbound** | JwtAuthGuard | Bearer token verification, blacklist check |
| **Ports** | `IAuthService` | Registration, login, refresh, logout contract |
| **Ports** | `IUserService` | User CRUD, lookup, demographics logging contract |
| **Ports** | `ITokenService` | JWT generation, verification, storage, revocation contract |
| **Core** | AuthService | Orchestrates use cases via port interfaces |
| **Core** | UserService | User entity management with bcrypt hashing |
| **Core** | TokenService | RSA-signed JWT creation, refresh token rotation |
| **Outbound** | PostgreSQL | Core data (users, auth_tokens, refresh_token_keys) |
| **Outbound** | MongoDB | Demographics logging |
| **Outbound** | Redis | Token blacklisting |

## API Reference

Base path: `/auth/v1`

### POST `/auth/v1/register`

Create a new user account and receive a token pair.

**Request:**

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "securepass123"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "a1b2c3d4e5...",
    "expiresIn": 86400
  }
}
```

**Errors:**

| Code | Description |
|------|-------------|
| `VALIDATION_USER_EXISTS` | Username or email already taken |
| `VALIDATION_ERROR` | Input failed schema validation |

---

### POST `/auth/v1/authenticate`

Log in with username/email and password.

**Request:**

```json
{
  "usernameOrEmail": "alice",
  "password": "securepass123"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "f6g7h8i9j0...",
    "expiresIn": 86400
  }
}
```

**Errors:**

| Code | Description |
|------|-------------|
| `AUTH_INVALID_CREDENTIALS` | Invalid username/email or password |
| `AUTH_USER_BLOCKED` | User account has been blocked |

---

### POST `/auth/v1/refresh`

Rotate the refresh token and receive a new access token. The refresh token is sent as an `httpOnly` cookie.

**Request:**

Cookie: `refreshToken=<token>`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "k1l2m3n4o5...",
    "expiresIn": 86400
  }
}
```

**Errors:**

| Code | Description |
|------|-------------|
| `AUTH_INVALID_CREDENTIALS` | Invalid or missing refresh token |
| `TOKEN_EXPIRED` | Refresh token has expired |

---

### POST `/auth/v1/logout`

Invalidate the user's session. Deletes the refresh token from the database and blacklists the access token in Redis (best-effort).

**Request:**

Header: `Authorization: Bearer <accessToken>`

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
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/authservice` |
| `MONGODB_URL` | MongoDB connection string | `mongodb://localhost:27017/authservice` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_ACCESS_EXPIRY` | Access token lifetime | `1d` |
| `JWT_REFRESH_EXPIRY` | Refresh token lifetime | `7d` |
| `JWT_RESET_EXPIRY` | Password reset token lifetime | `1h` |
| `BCRYPT_COST` | Bcrypt salt rounds | `10` |
| `PORT` | HTTP server port | `3000` |
| `NODE_ENV` | Runtime environment | `development` |
| `LOG_LEVEL` | Pino log level | `debug` |

## Development

```bash
# Start in watch mode
npm run start:dev

# Run all tests
npm run test

# Run tests with coverage
npm run test:cov

# Run end-to-end tests
npm run test:e2e

# Lint and auto-fix
npm run lint

# Build for production
npm run build

# Generate RSA key pair
npm run setup:keys

# Run database migrations
npm run db:migrate

# Seed database
npm run db:seed
```

## License

ISC
