# AuthService — Technical Documentation

**Author:** Paige (Technical Writer)  
**Date:** 2026-07-12  
**Status:** COMPLETE  
**Project:** AuthService  
**Framework:** NestJS  
**Architecture:** Hexagonal (Ports & Adapters)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Quick Start](#2-quick-start)
3. [Architecture](#3-architecture)
4. [Database Schema](#4-database-schema)
5. [API Reference](#5-api-reference)
6. [Authentication Flow](#6-authentication-flow)
7. [Key Management](#7-key-management)
8. [Environment Configuration](#8-environment-configuration)
9. [Logging](#9-logging)
10. [Security](#10-security)
11. [Deployment](#11-deployment)
12. [Development Guide](#12-development-guide)

---

## 1. Overview

AuthService is a scalable authentication service built with NestJS, following hexagonal architecture principles. It provides:

- **Simple Auth:** Username/password authentication
- **JWT Tokens:** RSA-signed access tokens with refresh rotation
- **Hybrid Database:** PostgreSQL (core) + MongoDB (logging)
- **Future Ready:** Hexagonal architecture for OAuth provider support

### Key Features

| Feature | Status | Description |
|---------|--------|-------------|
| Signup | ✅ | Username + Email + Password |
| Login | ✅ | Username/Email + Password |
| Logout | ✅ | Token blacklisting + DB cleanup |
| Refresh | ✅ | Token rotation on each use |
| RBAC | 🔜 | Admin / User / Client roles |
| OAuth | 🔜 | Consumer + Provider (future) |

---

## 2. Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- MongoDB 6+
- Redis 7+

### Installation

```bash
# Clone repository
git clone <repository-url>
cd AuthService

# Install dependencies
npm install

# Setup keys
npm run setup:keys

# Configure environment
cp .env.example .env
# Edit .env with your values

# Start development
npm run start:dev
```

### First Steps

1. **Generate keys:** `npm run setup:keys`
2. **Start database:** Docker Compose or local instances
3. **Run migrations:** `npm run migration:run`
4. **Start server:** `npm run start:dev`

---

## 3. Architecture

### Hexagonal Architecture

The project follows hexagonal architecture (ports and adapters):

```
┌─────────────────────────────────────────────────────────────────┐
│                    INBOUND ADAPTERS                              │
│  HTTP Controller │ Auth Guard │ Admin Controller                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PORTS (Interfaces)                            │
│  IAuthService │ IUserService │ ITokenService                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CORE DOMAIN                                   │
│  Auth Use Cases │ User Entity │ Token Service                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OUTBOUND ADAPTERS                             │
│  PostgreSQL │ MongoDB │ Redis │ Vault (Future)                  │
└─────────────────────────────────────────────────────────────────┘
```

### Module Structure

```
src/
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.guard.ts
│   ├── user/
│   │   ├── user.module.ts
│   │   ├── user.entity.ts
│   │   └── user.service.ts
│   ├── token/
│   │   ├── token.module.ts
│   │   ├── token.service.ts
│   │   └── token.config.ts
│   └── logging/
│       ├── logging.module.ts
│       ├── logger.service.ts
│       └── log.provider.ts
├── shared/
│   ├── interfaces/
│   ├── decorators/
│   └── guards/
├── config/
│   ├── env.validator.ts
│   └── app-context.ts
└── main.ts
```

---

## 4. Database Schema

### PostgreSQL

#### users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    blocked BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `idx_users_email` ON `email` (unique)
- `idx_users_username` ON `username` (unique)

#### user_tokens Table

```sql
CREATE TABLE user_tokens (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(255) NOT NULL,
    refresh_token_expiry TIMESTAMP NOT NULL,
    reset_token VARCHAR(255),
    reset_token_expiry TIMESTAMP,
    refresh_token_created_at TIMESTAMP DEFAULT NOW(),
    reset_token_created_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### refresh_token_keys Table

```sql
CREATE TABLE refresh_token_keys (
    kid UUID PRIMARY KEY,
    public_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    platform_architecture VARCHAR(100),
    platform_os VARCHAR(100),
    time_to_complete INTERVAL
);
```

### MongoDB

#### user_demographics Collection

```typescript
{
  _id: ObjectId,
  user_id: UUID,
  last_ip: string,
  location: {
    country: string,
    city: string,
    latitude: number,
    longitude: number
  },
  created_at: Date
}
```

---

## 5. API Reference

### Base URL

```
http://localhost:3000/auth/v1
```

### Endpoints

#### POST /register

Create a new user account.

**Request:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "john_doe",
      "email": "john@example.com",
      "role": "user"
    }
  }
}
```

**Response (400):**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_USER_EXISTS",
    "message": "User with this email or username already exists"
  }
}
```

#### POST /authenticate

Login with existing credentials.

**Request:**
```json
{
  "usernameOrEmail": "john@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "john_doe",
      "email": "john@example.com",
      "role": "user"
    }
  }
}
```

**Cookies Set:**
```
refreshToken=<token>; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=604800
```

#### POST /refresh

Refresh access token using refresh token cookie.

**Headers:**
```
Cookie: refreshToken=<token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "john_doe",
      "role": "user"
    }
  }
}
```

#### POST /logout

Logout and revoke tokens.

**Headers:**
```
Authorization: Bearer <access_token>
Cookie: refreshToken=<token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 6. Authentication Flow

### Signup Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Client                                                         │
│  POST /register { username, email, password }                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Auth Controller                                                 │
│  1. Validate input                                               │
│  2. Check username/email uniqueness                              │
│  3. Call auth service.signup()                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Auth Service                                                    │
│  1. Hash password (bcrypt, cost=10)                              │
│  2. Create user in PostgreSQL                                    │
│  3. Generate tokens                                              │
│  4. Store refresh token in DB                                    │
│  5. Return tokens                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Response                                                        │
│  { accessToken, refreshToken (cookie) }                         │
└─────────────────────────────────────────────────────────────────┘
```

### Login Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Client                                                         │
│  POST /authenticate { usernameOrEmail, password }               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Auth Controller                                                 │
│  1. Validate input                                               │
│  2. Call auth service.login()                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Auth Service                                                    │
│  1. Find user by email OR username                               │
│  2. Check if user is blocked                                     │
│  3. Validate password (bcrypt)                                   │
│  4. Generate tokens                                              │
│  5. Store refresh token in DB                                    │
│  6. Return tokens                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Token Refresh Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Client                                                         │
│  POST /refresh                                                   │
│  Cookie: refreshToken=<token>                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Auth Guard                                                     │
│  1. Extract refresh token from cookie                           │
│  2. Validate token format                                        │
│  3. Pass to controller                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Token Service                                                   │
│  1. Hash token and lookup in DB                                 │
│  2. Check expiry                                                 │
│  3. Delete old token from DB                                    │
│  4. Generate new tokens                                          │
│  5. Store new refresh token                                      │
│  6. Return new tokens                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Logout Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Client                                                         │
│  POST /logout                                                    │
│  Authorization: Bearer <access_token>                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Auth Service                                                    │
│  1. Decode access token to get jti (token ID)                   │
│  2. Add jti to Redis blacklist (TTL = token expiry)             │
│  3. Delete refresh token from DB                                │
│  4. Clear refresh token cookie                                  │
│  5. Log logout event                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Key Management

### Setup Script

```bash
npm run setup:keys
```

**Output:**
```json
{
  "kid": "0190d3e8-7b5c-7e9a-b3c2-123456789abc",
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqh...",
  "privateKey": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADAN...",
  "createdAt": "2026-07-12T00:00:00.000Z",
  "expiresAt": "2027-07-12T00:00:00.000Z",
  "platformArchitecture": "arm64",
  "platformOs": "darwin",
  "timeToComplete": "00:00:02.500"
}
```

### Key Storage Rules

| Content | Storage | Protection |
|---------|---------|------------|
| Private key | `keys.json` | File permissions (chmod 600) |
| Public key | `keys.json` + PostgreSQL | File permissions + DB access |
| Key metadata | PostgreSQL | Audit trail |

### Key Rotation

When keys expire:
1. Fatal error logged
2. Graceful shutdown initiated
3. Module `shutdown()` methods called
4. Process exits

**Action Required:** Run `npm run setup:keys` to generate new keys.

---

## 8. Environment Configuration

### .env File

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
LOG_LEVEL=debug
```

### Validation

The `env.validator.ts` validates:
- Required variables present
- Type validation (PORT must be number)
- Format validation (URLs)
- Range validation (PORT 1-65535)

### Hot Reload

⚠️ **Server restart required** for environment changes.

---

## 9. Logging

### Usage

```typescript
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
class AuthService {
  private logger: ILogger;

  constructor(
    @Inject('LogManager') private logManager: LogManager
  ) {
    this.logger = this.logManager.getLogger('AuthService');
  }

  async login() {
    this.logger.info('Login attempt');
    this.logger.debug('Validating credentials');
    this.logger.warn('Invalid password attempt');
    this.logger.error('Database connection failed');
    this.logger.fatal('Key expired, shutting down');
  }
}
```

### Log Levels

| Level | Usage |
|-------|-------|
| `debug` | Development debugging |
| `info` | Normal operation events |
| `warn` | Potential issues |
| `error` | Recoverable errors |
| `fatal` | Unrecoverable errors (triggers shutdown) |

### Configuration

Set in `.env`:
```bash
LOG_LEVEL=info  # debug | info | warn | error | fatal
```

---

## 10. Security

### Password Hashing

- **Algorithm:** bcrypt
- **Cost Factor:** 10
- **Time:** ~100ms per hash

### Token Security

| Token | Storage | Expiry | Rotation |
|-------|---------|--------|----------|
| Access | Response header | 1 day | No |
| Refresh | HttpOnly cookie + DB | 1 week | Yes (on use) |
| Reset | Response (one-time) | 1 hour | No |

### Cookie Security

```typescript
{
  httpOnly: true,      // Prevent XSS
  secure: true,        // HTTPS only
  sameSite: 'strict',  // CSRF protection
  path: '/auth',       // Scope limit
  maxAge: 604800       // 7 days
}
```

### Revocation

- **Access tokens:** Redis blacklist (TTL = remaining expiry)
- **Refresh tokens:** Deleted from DB

---

## 11. Deployment

### Docker Compose

```yaml
version: '3.8'
services:
  auth-service:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/authservice
      - MONGODB_URL=mongodb://mongodb:27017/authservice
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - mongodb
      - redis

  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: authservice
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  mongodb:
    image: mongo:6
    volumes:
      - mongo_data:/data/db

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  mongo_data:
  redis_data:
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use `secure: true` for cookies
- [ ] Enable HTTPS
- [ ] Set strong bcrypt cost (12+)
- [ ] Configure log level (info or warn)
- [ ] Set up database backups
- [ ] Monitor key expiry dates

---

## 12. Development Guide

### Project Setup

```bash
# Install dependencies
npm install

# Setup database
npm run db:create
npm run db:migrate

# Generate keys
npm run setup:keys

# Start development
npm run start:dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start:prod` | Start production server |
| `npm run migration:run` | Run database migrations |
| `npm run setup:keys` | Generate key pair |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run e2e tests |

### Code Style

- Follow NestJS conventions
- Use dependency injection
- Keep modules isolated
- Write tests for new features

---

*Documentation complete. Ready for implementation.*
