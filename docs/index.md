# AuthService — Documentation Hub

**Production-Ready NestJS Authentication Service**
Hexagonal architecture | 262 tests passing | 9 epics complete

---

## Quick Reference

| Property | Value |
|----------|-------|
| Entry Point | `src/main.ts` |
| Root Module | `src/app.module.ts` |
| Port | 3000 |
| Node Version | 22.x |
| TypeScript | 5.8.3 |
| API Base Path | `/v1/auth/` |

---

## Documentation Map

| Document | Description |
|----------|-------------|
| [Project Overview](./project-overview.md) | Executive summary, features, tech stack, phases |
| [Architecture](./architecture.md) | Hexagonal architecture deep-dive |
| [API Reference](./api-reference.md) | Endpoint specs, request/response schemas |
| [Database Schema](./database-schema.md) | PostgreSQL, MongoDB, Redis schemas |
| [Authentication Flows](./authentication-flows.md) | Registration, login, refresh, logout sequences |
| [Key Management](./key-management.md) | JWT RSA key lifecycle and rotation |
| [Deployment](./deployment.md) | Production deployment guide |
| [Development Guide](./development-guide.md) | Local setup, scripts, workflow |
| [Retrospective Report](./retrospective-report.md) | Epic completion analysis |

---

## Diagrams Index

| Diagram | File | Description |
|---------|------|-------------|
| Registration Flow | [01-sequence-registration.mmd](./diagrams/01-sequence-registration.mmd) | User signup sequence |
| Login Flow | [02-sequence-login.mmd](./diagrams/02-sequence-login.mmd) | Authentication sequence |
| Refresh Flow | [03-sequence-refresh.mmd](./diagrams/03-sequence-refresh.mmd) | Token refresh sequence |
| Logout + Blacklist | [04-sequence-logout.mmd](./diagrams/04-sequence-logout.mmd) | Logout and token revocation |
| Redis Blacklist | [04-redis-blacklist.mmd](./diagrams/04-redis-blacklist.mmd) | Blacklist data flow |
| Entity Classes | [05-class-entities.mmd](./diagrams/05-class-entities.mmd) | Domain entity model |
| Type Interfaces | [06-types-interfaces.mmd](./diagrams/06-types-interfaces.mmd) | Core type definitions |
| Service Classes | [06-class-services.mmd](./diagrams/06-class-services.mmd) | Service layer classes |
| Exception Classes | [07-class-exceptions.mmd](./diagrams/07-class-exceptions.mmd) | Error hierarchy |
| Hexagonal Architecture | [08-component-hexagonal.mmd](./diagrams/08-component-hexagonal.mmd) | Ports and adapters overview |
| Package Modules Tree | [09-package-modules-tree.mmd](./diagrams/09-package-modules-tree.mmd) | Module dependency tree |
| Package Modules Flow | [09-package-modules-flowchart.mmd](./diagrams/09-package-modules-flowchart.mmd) | Module interaction flow |
| Runtime Objects | [10-object-runtime.mmd](./diagrams/10-object-runtime.mmd) | Runtime object graph |
| Auth Guard Flow | [11-sequence-auth-guard.mmd](./diagrams/11-sequence-auth-guard.mmd) | Guard middleware sequence |
| Requirements | [requirements.mmd](./diagrams/requirements.mmd) | Functional requirements |

---

## Architecture Summary

AuthService implements a hexagonal (Ports and Adapters) architecture where the core domain logic is isolated from all external concerns. Inbound adapters (HTTP controllers and auth guards) receive requests and translate them into port operations. The core domain handles authentication use cases -- registration, login, token refresh, and logout -- through defined service interfaces. Outbound adapters persist data to PostgreSQL for core records, MongoDB for audit logging, and Redis for token blacklisting. This separation ensures the domain logic remains testable and decoupled from infrastructure. See [architecture.md](./architecture.md) for the full technical design.

---

## Implementation Status

| Metric | Value |
|--------|-------|
| Epics Completed | 9 of 9 |
| Total Tests | 262 |
| Unit Tests | 248 |
| E2E Tests | 14 |
| Test Suites | 20 |
| Phase 1 (Core Auth) | COMPLETE |

---

## Technology Stack

| Category | Technology | Version |
|----------|------------|---------|
| Framework | NestJS | 11.1.3 |
| Language | TypeScript | 5.8.3 |
| Runtime | Node.js | 22.x |
| Core Database | PostgreSQL | 16+ |
| Log Database | MongoDB | 7+ |
| Cache / Blacklist | Redis | 7+ |
| JWT Signing | jose | — |
| Password Hashing | bcrypt | — |
| Logging | pino + chalk | — |
| Validation | Zod | — |
| Core ORM | TypeORM | — |
| Log ORM | Mongoose | — |
| Cache Client | ioredis | — |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/main.ts` | Application bootstrap and NestFactory setup |
| `src/app.module.ts` | Root module, imports all feature modules |
| `src/modules/auth/` | Registration, login, logout use cases |
| `src/modules/user/` | User entity and repository |
| `src/modules/token/` | JWT generation and refresh logic |
| `src/modules/key/` | RSA key management and rotation |
| `src/modules/redis/` | Redis blacklist service |
| `src/modules/logging/` | Structured logging with MongoDB sink |
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript compiler configuration |
| `nest-cli.json` | NestJS CLI configuration |
| `.env.example` | Environment variable template |

---

*Last updated: 2026-07-18*
