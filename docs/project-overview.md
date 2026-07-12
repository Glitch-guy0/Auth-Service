# AuthService — Project Overview

**Author:** BMAD Documentation Workflow  
**Date:** 2026-07-12  
**Status:** Generated  
**Project Type:** Backend Service  
**Architecture:** Hexagonal (Ports & Adapters)

---

## Executive Summary

AuthService is a scalable authentication service built with NestJS, following hexagonal architecture principles. The system supports simple auth (username/password) now, with a clear path to OAuth consumer/provider in the future.

### Key Features

| Feature | Status | Description |
|---------|--------|-------------|
| Signup | ✅ Planned | Username + Email + Password |
| Login | ✅ Planned | Username/Email + Password |
| Logout | ✅ Planned | Token blacklisting + DB cleanup |
| Refresh | ✅ Planned | Token rotation on each use |
| RBAC | 🔜 Future | Admin / User / Client roles |
| OAuth | 🔜 Future | Consumer + Provider |

---

## Technology Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Framework | NestJS | 11.1.3 | Application framework |
| Language | TypeScript | 5.8.3 | Type safety |
| Runtime | Node.js | 22.x | Server runtime |
| Database (Core) | PostgreSQL | 16+ | Users, tokens, keys |
| Database (Log) | MongoDB | 7+ | Logging, demographics |
| Cache | Redis | 7+ | Token blacklisting |
| JWT Library | jose | — | RSA signing |
| Password Hash | bcrypt | — | Cost factor: 10 |
| Logger | pino + chalk | — | Fast console output |
| Validation | class-validator | 0.14.2 | Input validation |
| ORM | Prisma/TypeORM | — | Database abstraction |

---

## Architecture Pattern

**Hexagonal (Ports & Adapters)**

```
┌─────────────────────────────────────────────────────┐
│  INBOUND ADAPTERS                                   │
│  HTTP Controller │ Auth Guard │ Admin Controller     │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  PORTS (Interfaces)                                 │
│  IAuthService │ IUserService │ ITokenService        │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  CORE DOMAIN                                        │
│  Auth Use Cases │ User Entity │ Token Service       │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  OUTBOUND ADAPTERS                                  │
│  PostgreSQL │ MongoDB │ Redis │ Vault (Future)      │
└─────────────────────────────────────────────────────┘
```

---

## Repository Structure

- **Type:** Monolith (single codebase)
- **Entry Point:** `src/main.ts`
- **Module System:** NestJS modules with DI
- **Build Output:** `dist/`

---

## Database Architecture

### PostgreSQL (Core Data)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts | id, username, email, password |
| `user_tokens` | Refresh/reset tokens | user_id, refresh_token, expiry |
| `refresh_token_keys` | JWT signing keys | kid, public_key, expires_at |

### MongoDB (Logging)

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `user_demographics` | Login tracking | user_id, last_ip, location |

### Redis (Cache)

| Pattern | Purpose | TTL |
|---------|---------|-----|
| `blacklist:{jti}` | Access token revocation | Token expiry |

---

## API Endpoints

**Base Path:** `/auth/v1`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/authenticate` | Serve login HTML | No |
| POST | `/authenticate` | Login → tokens | No |
| GET | `/register` | Serve signup HTML | No |
| POST | `/register` | Signup → tokens | No |
| POST | `/refresh` | Refresh access token | Yes (cookie) |
| POST | `/logout` | Logout + blacklist | Yes |

---

## Implementation Phases

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

## Quick Reference

### Development Commands

```bash
npm install          # Install dependencies
npm run start:dev    # Start development server
npm run test         # Run unit tests
npm run test:e2e     # Run e2e tests
npm run build        # Build for production
npm run lint         # Lint code
```

### Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/authservice
MONGODB_URL=mongodb://localhost:27017/authservice
REDIS_URL=redis://localhost:6379
JWT_ACCESS_EXPIRY=1d
JWT_REFRESH_EXPIRY=7d
BCRYPT_COST=10
PORT=3000
NODE_ENV=development
```

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | Full technical architecture |
| [Technical Documentation](./technical-documentation.md) | Implementation guide |
| [Source Tree](./source-tree-analysis.md) | Project structure |
| [Development Guide](./development-guide.md) | Setup instructions |

---

*Project overview generated from planning artifacts.*
