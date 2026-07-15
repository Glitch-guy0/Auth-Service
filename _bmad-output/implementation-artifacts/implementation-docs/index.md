# AuthService — Implementation Documentation Index

**Project:** AuthService
**Date:** 2026-07-15
**Total Epics:** 9 | **Total Stories:** 45 | **Architecture Decisions:** 17

---

## Source Documents

All implementation documentation is derived from the following planning artifacts:

| Document | Path | Purpose |
|----------|------|---------|
| PRD | `planning-artifacts/prds/prd-AuthService-2026-07-12/prd.md` | Product requirements, functional/non-functional requirements, API contracts |
| Architecture | `planning-artifacts/architecture.md` | Technical architecture, database schemas, module structure |
| Architecture Spine | `planning-artifacts/architecture/architecture-AuthService-2026-07-14/ARCHITECTURE-SPINE.md` | 17 architecture decisions (ADs), invariants, design rules |
| Epics | `planning-artifacts/epics.md` | 9 epics, 45 stories with acceptance criteria |
| Sprint Status | `implementation-artifacts/sprint-status.yaml` | Story status tracking |
| Project Context | `project-context.md` | Technology stack, version constraints, conventions |
| Readiness Report | `planning-artifacts/implementation-readiness-report-2026-07-14-v2.md` | Implementation readiness assessment |

---

## Epic Documentation

| Epic | Title | Stories | Documentation |
|------|-------|---------|---------------|
| 1 | Foundation & Types | 16 | [epic-1-foundation/README.md](epic-1-foundation/README.md) |
| 2 | Key Management | 3 | [epic-2-key-management/README.md](epic-2-key-management/README.md) |
| 3 | Registration Flow | 6 | [epic-3-registration/README.md](epic-3-registration/README.md) |
| 4 | Login Flow | 3 | [epic-4-login/README.md](epic-4-login/README.md) |
| 5 | Token Refresh Flow | 2 | [epic-5-refresh/README.md](epic-5-refresh/README.md) |
| 6 | Logout Flow | 2 | [epic-6-logout/README.md](epic-6-logout/README.md) |
| 7 | Auth Guard & Protected Routes | 4 | [epic-7-auth-guard/README.md](epic-7-auth-guard/README.md) |
| 8 | Logging & Observability | 4 | [epic-8-logging/README.md](epic-8-logging/README.md) |
| 9 | Testing & Documentation | 5 | [epic-9-testing/README.md](epic-9-testing/README.md) |

---

## Story → Documentation Mapping

### Epic 1: Foundation & Types

| Story | Title | Doc | ADs | Source |
|-------|-------|-----|-----|--------|
| 1.1 | NestJS Project Initialization | [1.1](epic-1-foundation/README.md#story-11-nestjs-project-initialization) | — | PRD FR-19, FR-22 |
| 1.2 | TypeScript Configuration | [1.2](epic-1-foundation/README.md#story-12-typescript-configuration) | AD-1 | PRD NFR-6 |
| 1.3 | Environment Configuration | [1.3](epic-1-foundation/README.md#story-13-environment-configuration) | AD-1 | PRD FR-19 |
| 1.4 | AppContext Global State | [1.4](epic-1-foundation/README.md#story-14-appcontext-global-state) | AD-1, AD-4 | Architecture §5.1 |
| 1.5 | NestJS App Module Structure | [1.5](epic-1-foundation/README.md#story-15-nestjs-app-module-structure) | AD-1, AD-4 | Architecture §5.1 |
| 1.6 | User Entity Definition | [1.6](epic-1-foundation/README.md#story-16-user-entity-definition) | AD-14 | PRD FR-13, Spine AD-14 |
| 1.7 | Auth Token Entity Definition | [1.7](epic-1-foundation/README.md#story-17-auth-token-entity-definition) | AD-5 | PRD FR-23, Spine AD-5 |
| 1.8 | Public Key Registry Entity | [1.8](epic-1-foundation/README.md#story-18-public-key-registry-entity) | AD-2 | PRD FR-7, Spine AD-2 |
| 1.9 | Demographics Document (MongoDB) | [1.9](epic-1-foundation/README.md#story-19-demographics-document-mongodb) | AD-3, AD-10 | PRD FR-24, Spine AD-3 |
| 1.10 | DTOs — Register & Login | [1.10](epic-1-foundation/README.md#story-110-dtos--register--login) | AD-11 | PRD FR-11, Spine AD-11 |
| 1.11 | DTOs — Token Response | [1.11](epic-1-foundation/README.md#story-111-dtos--token-response) | AD-11 | PRD FR-11 |
| 1.12 | Service Interfaces (Ports) | [1.12](epic-1-foundation/README.md#story-112-service-interfaces-ports) | AD-1 | Architecture §3.2 |
| 1.13 | Exception Hierarchy | [1.13](epic-1-foundation/README.md#story-113-exception-hierarchy) | AD-1 | Architecture §7.1 |
| 1.14 | Transaction Pattern | [1.14](epic-1-foundation/README.md#story-114-transaction-pattern) | AD-12 | Spine AD-12 |
| 1.15 | JWT Payload Type | [1.15](epic-1-foundation/README.md#story-115-jwt-payload-type) | AD-15 | Spine AD-15 |
| 1.16 | API Response Types | [1.16](epic-1-foundation/README.md#story-116-api-response-types) | AD-1 | Architecture §7.2 |

### Epic 2: Key Management

| Story | Title | Doc | ADs | Source |
|-------|-------|-----|-----|--------|
| 2.1 | Key Generation Script | [2.1](epic-2-key-management/README.md#story-21-key-generation-script) | AD-2 | PRD FR-7, Spine AD-2 |
| 2.2 | KeyManager Service | [2.2](epic-2-key-management/README.md#story-22-keymanager-service) | AD-2, AD-9 | Spine AD-2, AD-9 |
| 2.3 | KeyManager Module Registration | [2.3](epic-2-key-management/README.md#story-23-keymanager-module-registration) | AD-1 | Architecture §3.2 |

### Epic 3: Registration Flow

| Story | Title | Doc | ADs | Source |
|-------|-------|-----|-----|--------|
| 3.1 | TokenService — JWT Generation | [3.1](epic-3-registration/README.md#story-31-tokenservice--jwt-generation) | AD-8, AD-15 | Spine AD-8, AD-15 |
| 3.2 | TokenService — Refresh Token | [3.2](epic-3-registration/README.md#story-32-tokenservice--refresh-token) | AD-5 | Spine AD-5 |
| 3.3 | TokenService — Token Storage | [3.3](epic-3-registration/README.md#story-33-tokenservice--token-storage) | AD-5, AD-12 | Spine AD-5, AD-12 |
| 3.4 | UserService — User CRUD | [3.4](epic-3-registration/README.md#story-34-userservice--user-crud) | AD-14, AD-16 | Spine AD-14, AD-16 |
| 3.5 | AuthService — Registration Logic | [3.5](epic-3-registration/README.md#story-35-authservice--registration-logic) | AD-12, AD-14, AD-16 | Spine AD-12, AD-14, AD-16 |
| 3.6 | Auth Controller — Register Endpoint | [3.6](epic-3-registration/README.md#story-36-auth-controller--register-endpoint) | AD-11 | PRD FR-1, Spine AD-11 |

### Epic 4: Login Flow

| Story | Title | Doc | ADs | Source |
|-------|-------|-----|-----|--------|
| 4.1 | TokenService — Token Verification | [4.1](epic-4-login/README.md#story-41-tokenservice--token-verification) | AD-15, AD-9 | Spine AD-15, AD-9 |
| 4.2 | AuthService — Login Logic | [4.2](epic-4-login/README.md#story-42-authservice--login-logic) | AD-5, AD-10, AD-14, AD-16 | Spine AD-5, AD-10, AD-14, AD-16 |
| 4.3 | Auth Controller — Login Endpoint | [4.3](epic-4-login/README.md#story-43-auth-controller--login-endpoint) | AD-11 | PRD FR-2, Spine AD-11 |

### Epic 5: Token Refresh Flow

| Story | Title | Doc | ADs | Source |
|-------|-------|-----|-----|--------|
| 5.1 | AuthService — Refresh Logic | [5.1](epic-5-refresh/README.md#story-51-authservice--refresh-logic) | AD-5, AD-6, AD-12 | Spine AD-5, AD-6, AD-12 |
| 5.2 | Auth Controller — Refresh Endpoint | [5.2](epic-5-refresh/README.md#story-52-auth-controller--refresh-endpoint) | AD-11 | PRD FR-3, Spine AD-11 |

### Epic 6: Logout Flow

| Story | Title | Doc | ADs | Source |
|-------|-------|-----|-----|--------|
| 6.1 | AuthService — Logout Logic | [6.1](epic-6-logout/README.md#story-61-authservice--logout-logic) | AD-7, AD-17 | Spine AD-7, AD-17 |
| 6.2 | Auth Controller — Logout Endpoint | [6.2](epic-6-logout/README.md#story-62-auth-controller--logout-endpoint) | AD-11 | PRD FR-4, Spine AD-11 |

### Epic 7: Auth Guard & Protected Routes

| Story | Title | Doc | ADs | Source |
|-------|-------|-----|-----|--------|
| 7.1 | Auth Middleware | [7.1](epic-7-auth-guard/README.md#story-71-auth-middleware) | AD-1 | Architecture §6.1 |
| 7.2 | JWT Auth Guard | [7.2](epic-7-auth-guard/README.md#story-72-jwt-auth-guard) | AD-15, AD-9 | Spine AD-15, AD-9 |
| 7.3 | Global Exception Filter | [7.3](epic-7-auth-guard/README.md#story-73-global-exception-filter) | AD-1 | Architecture §7.1 |
| 7.4 | Zod Validation Pipe | [7.4](epic-7-auth-guard/README.md#story-74-zod-validation-pipe) | AD-11 | Spine AD-11 |

### Epic 8: Logging & Observability

| Story | Title | Doc | ADs | Source |
|-------|-------|-----|-----|--------|
| 8.1 | Logging Module | [8.1](epic-8-logging/README.md#story-81-logging-module) | AD-4 | PRD FR-16, Spine AD-4 |
| 8.2 | Pino Logger Provider | [8.2](epic-8-logging/README.md#story-82-pino-logger-provider) | AD-4 | PRD NFR-5 |
| 8.3 | Request Logging Interceptor | [8.3](epic-8-logging/README.md#story-83-request-logging-interceptor) | AD-4 | PRD FR-17 |
| 8.4 | Demographics Collection | [8.4](epic-8-logging/README.md#story-84-demographics-collection) | AD-3, AD-10 | PRD FR-18, Spine AD-3, AD-10 |

### Epic 9: Testing & Documentation

| Story | Title | Doc | ADs | Source |
|-------|-------|-----|-----|--------|
| 9.1 | Unit Tests — Services | [9.1](epic-9-testing/README.md#story-91-unit-tests--services) | — | PRD FR-21 |
| 9.2 | Unit Tests — Guards & Filters | [9.2](epic-9-testing/README.md#story-92-unit-tests--guards--filters) | — | PRD FR-21 |
| 9.3 | Integration Tests | [9.3](epic-9-testing/README.md#story-93-integration-tests) | — | PRD FR-21 |
| 9.4 | Documentation | [9.4](epic-9-testing/README.md#story-94-documentation) | — | PRD FR-20 |
| 9.5 | Docker Configuration | [9.5](epic-9-testing/README.md#story-95-docker-configuration) | — | PRD FR-22 |

---

## Architecture Decision → Story Mapping

| AD | Decision | Stories |
|----|----------|---------|
| AD-1 | Hexagonal Module Boundary | 1.2, 1.3, 1.4, 1.5, 1.12, 1.13, 1.16, 2.3, 7.1, 7.3 |
| AD-2 | Per-Instance RSA Key Pairs | 1.8, 2.1, 2.2 |
| AD-3 | Hybrid Database Architecture | 1.9, 8.4 |
| AD-4 | Module Lifecycle Pattern | 1.4, 1.5, 8.1, 8.2, 8.3 |
| AD-5 | Single Active Session (AUTH_TOKENS) | 1.7, 3.2, 3.3, 3.5, 4.2, 5.1 |
| AD-6 | Refresh Token Rotation Strategy | 5.1 |
| AD-7 | Logout accessToken-only + Redis Blacklist | 6.1 |
| AD-8 | TokenService Returns Complete JWT Payload | 3.1 |
| AD-9 | KeyManager Takes kid Parameter | 2.2, 4.1, 7.2 |
| AD-10 | Demographics Logging via UserService | 1.9, 4.2, 8.4 |
| AD-11 | Zod Validation (Strictly) | 1.10, 1.11, 3.6, 4.3, 5.2, 6.2, 7.4 |
| AD-12 | Transaction Pattern | 1.14, 3.3, 3.5, 5.1 |
| AD-13 | Role Field Deferred | 1.15 |
| AD-14 | Users Table Schema Contract | 1.6, 3.4, 3.5, 4.2 |
| AD-15 | JWT Payload Contract | 1.15, 3.1, 4.1, 7.2 |
| AD-16 | Repository Ownership & Orchestration | 3.4, 3.5, 4.2 |
| AD-17 | Cross-Database Mutation Ordering | 6.1 |

---

## Sprint Dependency Chain

```
Epic 1: Foundation & Types (16 stories)
    ↓ (all types defined)
Epic 2: Key Management (3 stories)
    ↓ (RSA keys ready for JWT)
Epic 3: Registration Flow (6 stories)
    ↓ (users can sign up)
Epic 4: Login Flow (3 stories)
    ↓ (users can authenticate)
Epic 5: Token Refresh Flow (2 stories)
    ↓ (sessions can be maintained)
Epic 6: Logout Flow (2 stories)
    ↓ (sessions can be terminated)
Epic 7: Auth Guard & Protected Routes (4 stories)
    ↓ (routes can be protected)
Epic 8: Logging & Observability (4 stories)
    ↓ (system is observable)
Epic 9: Testing & Documentation (5 stories)
    ↓ (system is production-ready)
```

| Epic | Depends On | Blocked By |
|------|-----------|------------|
| 1 | — | — |
| 2 | Epic 1 | — |
| 3 | Epic 1, Epic 2 | — |
| 4 | Epic 3 | — |
| 5 | Epic 4 | — |
| 6 | Epic 4 | — |
| 7 | Epic 4 | — |
| 8 | Epic 3 | — |
| 9 | Epic 7 | — |

---

## References

### Primary Sources

1. **PRD** — `_bmad-output/planning-artifacts/prds/prd-AuthService-2026-07-12/prd.md`
   - 25 Functional Requirements (FR-1 through FR-25)
   - 7 Non-Functional Requirements (NFR-1 through NFR-7)
   - API contracts, database schemas, module structure

2. **Architecture** — `_bmad-output/planning-artifacts/architecture.md`
   - Hexagonal architecture design
   - Database schemas (PostgreSQL, MongoDB, Redis)
   - Module structure and dependencies
   - API endpoint definitions

3. **Architecture Spine** — `_bmad-output/planning-artifacts/architecture/architecture-AuthService-2026-07-14/ARCHITECTURE-SPINE.md`
   - 17 Architecture Decisions (AD-1 through AD-17)
   - Invariants and design rules
   - Consistency conventions
   - Structural seed (file structure)

4. **Epics** — `_bmad-output/planning-artifacts/epics.md`
   - 9 epics, 45 stories
   - Acceptance criteria for each story
   - Test acceptance criteria

5. **Sprint Status** — `_bmad-output/implementation-artifacts/sprint-status.yaml`
   - Story status tracking
   - Epic progress

6. **Project Context** — `_bmad-output/project-context.md`
   - Technology stack and versions
   - Version constraints
   - Existing patterns

7. **Readiness Report** — `_bmad-output/planning-artifacts/implementation-readiness-report-2026-07-14-v2.md`
   - FR coverage: 84% (21/25 covered, 4 deferred)
   - NFR coverage: 100% (7/7)
   - Architecture spine validation: PASS

### Supplementary Sources

8. **Architecture Validation Report** — `_bmad-output/planning-artifacts/architecture/architecture-AuthService-2026-07-14/validation-report.html`
9. **Adversarial Divergence Review** — `_bmad-output/planning-artifacts/architecture/architecture-AuthService-2026-07-14/reviews/adversarial-divergence.md`
10. **Reality Check Review** — `_bmad-output/planning-artifacts/architecture/architecture-AuthService-2026-07-14/reviews/reality-check.md`
11. **Architecture Memlog** — `_bmad-output/planning-artifacts/architecture/architecture-AuthService-2026-07-14/.memlog.md`

---

## Citation Format

When referencing implementation documentation, use:

```
[AuthService] Implementation Documentation — Epic X, Story X.X
Source: PRD FR-XX, Architecture Spine AD-XX
Path: _bmad-output/implementation-artifacts/implementation-docs/epic-X-name/README.md
```

Example:
```
[AuthService] Implementation Documentation — Epic 3, Story 3.5
Source: PRD FR-1, Architecture Spine AD-12, AD-14, AD-16
Path: _bmad-output/implementation-artifacts/implementation-docs/epic-3-registration/README.md
```
