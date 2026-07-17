# AuthService — Project Overview

**Production-Ready NestJS Authentication Service**
Hexagonal architecture | 262 tests | 9 epics complete

---

## Description

AuthService is a backend authentication microservice built with NestJS 11. It provides secure user registration, login, token refresh, and logout functionality using RSA-signed JWTs. The system is designed for extensibility: the current username/password core is production-ready today, with planned paths toward OAuth consumer/provider integration and role-based access control. The service follows hexagonal (Ports and Adapters) architecture, keeping domain logic fully isolated from infrastructure concerns.

---

## Key Features

| Feature | Status | Description |
|---------|--------|-------------|
| User Registration | COMPLETE | Username + email + password signup with bcrypt hashing |
| User Login | COMPLETE | Username or email + password authentication |
| Token Generation | COMPLETE | RSA-signed access and refresh JWTs via jose |
| Token Refresh | COMPLETE | Refresh token rotation with single-use enforcement |
| Logout | COMPLETE | Token blacklisting via Redis + database cleanup |
| Key Management | COMPLETE | RSA key pair generation, storage, and rotation |
| Structured Logging | COMPLETE | pino logger with MongoDB persistence |
| Input Validation | COMPLETE | Zod schemas for all request payloads |
| Error Handling | COMPLETE | Domain-specific exception hierarchy |
| Auth Guard | COMPLETE | NestJS guard for protected route authorization |
| E2E Test Suite | COMPLETE | 14 end-to-end tests across all core flows |
| Unit Test Suite | COMPLETE | 248 unit tests with full domain coverage |
| OAuth Integration | PLANNED | Google, GitHub, and generic OAuth2 providers |
| Role-Based Access Control | PLANNED | Admin, user, and client role tiers |
| Password Reset | PLANNED | Email-based password recovery flow |
| Email Verification | PLANNED | Account activation via email confirmation |
| Rate Limiting | PLANNED | Request throttling per IP and per user |

---

## Technology Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Framework | NestJS | 11.1.3 | Application framework with DI |
| Language | TypeScript | 5.8.3 | Type-safe development |
| Runtime | Node.js | 22.x | Server runtime |
| Core Database | PostgreSQL | 16+ | Users, tokens, keys |
| Log Database | MongoDB | 7+ | Audit logs, demographics |
| Cache / Blacklist | Redis | 7+ | Token blacklisting |
| JWT Library | jose | — | RSA JWT signing and verification |
| Password Hashing | bcrypt | — | Cost factor 10 |
| Logging | pino + chalk | — | High-performance structured logging |
| Validation | Zod | — | Runtime schema validation |
| Core ORM | TypeORM | — | PostgreSQL data access |
| Log ORM | Mongoose | — | MongoDB document modeling |
| Cache Client | ioredis | — | Redis connection management |

---

## Architecture Pattern

**Hexagonal (Ports and Adapters)**

The service separates concerns into inbound adapters (HTTP controllers, auth guards), port interfaces (service contracts), core domain logic (use cases, entities), and outbound adapters (database repositories, cache clients). This ensures the domain layer has zero dependency on infrastructure frameworks. See [architecture.md](./architecture.md) for the complete design.

---

## Database Architecture

The service uses three databases, each serving a distinct purpose:

| Database | Technology | Responsibility | Data |
|----------|------------|----------------|------|
| Core | PostgreSQL 16+ | Persistent user records, tokens, and signing keys | Users, refresh tokens, key pairs |
| Audit | MongoDB 7+ | Append-only operational logs and demographics | Login events, user metadata |
| Cache | Redis 7+ | Ephemeral token revocation list | Blacklisted JWT IDs |

See [database-schema.md](./database-schema.md) for full table and collection definitions.

---

## API Endpoints

**Base Path:** `/v1/auth/`
**URI Versioning:** Enabled with empty prefix (version in path, not header)
**Swagger:** Available at `/api`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Create new user account, return tokens | No |
| POST | `/authenticate` | Verify credentials, return tokens | No |
| POST | `/refresh` | Rotate refresh token, return new access token | Yes (cookie) |
| POST | `/logout` | Invalidate tokens, blacklist access JWT | Yes |

See [api-reference.md](./api-reference.md) for request/response schemas and error codes.

---

## Implementation Phases

| Phase | Status | Scope |
|-------|--------|-------|
| Phase 1: Core Authentication | COMPLETE | Registration, login, token management, logout, key management, logging, error handling, input validation, auth guard, full test coverage |
| Phase 2: Security Hardening | PLANNED | Rate limiting, password reset, email verification, security headers, brute-force protection |
| Phase 3: Admin and Analytics | PLANNED | RBAC implementation, admin endpoints, analytics dashboard, user demographics enrichment |
| Phase 4: OAuth Integration | PLANNED | OAuth consumer (Google, GitHub), OAuth provider, SSO client library |

---

## Security Features

| Feature | Implementation | Status |
|---------|----------------|--------|
| Password Hashing | bcrypt with cost factor 10 | COMPLETE |
| JWT Signing | RSA-256 via jose library | COMPLETE |
| Token Rotation | Single-use refresh tokens | COMPLETE |
| Access Token Blacklisting | Redis-backed revocation | COMPLETE |
| Key Rotation | Automated RSA key pair lifecycle | COMPLETE |
| Input Validation | Zod schema enforcement | COMPLETE |
| Domain Exceptions | Structured error responses, no stack leaks | COMPLETE |
| Cookie-Based Refresh | HttpOnly, Secure cookie transport | COMPLETE |
| Rate Limiting | Per-IP and per-user throttling | PLANNED |
| Brute-Force Protection | Account lockout after failed attempts | PLANNED |
| CORS Configuration | Origin allowlist | PLANNED |
| Security Headers | Helmet middleware | PLANNED |

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | Hexagonal architecture deep-dive |
| [API Reference](./api-reference.md) | Endpoint specifications |
| [Database Schema](./database-schema.md) | Data model definitions |
| [Authentication Flows](./authentication-flows.md) | Sequence diagrams and flow details |
| [Key Management](./key-management.md) | JWT RSA key lifecycle |
| [Deployment](./deployment.md) | Production deployment guide |
| [Development Guide](./development-guide.md) | Local setup and workflow |
| [Documentation Hub](./index.md) | Master documentation index |

---

*Last updated: 2026-07-18*
