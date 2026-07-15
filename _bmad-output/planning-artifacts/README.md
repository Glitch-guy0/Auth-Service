# AuthService — Planning Artifacts

**Created:** 2026-07-12  
**Status:** APPROVED  
**Project:** AuthService  
**Framework:** NestJS  
**Architecture:** Hexagonal (Ports & Adapters)

---

## 📋 Artifacts Overview

| Document | Author | Purpose |
|----------|--------|---------|
| [Architecture](./architecture.md) | Winston (Architect) | Technical architecture decisions |
| [Technical Documentation](./technical-documentation.md) | Paige (Tech Writer) | Implementation guide |
| [Brainstorming Session](../brainstorming/brainstorm-auth-service-design-2026-07-11/) | Mary (BA) | Design decisions log |

---

## 🎯 Project Summary

**AuthService** is a scalable authentication service built with NestJS, following hexagonal architecture principles for future OAuth provider support.

### Key Design Decisions

| Area | Decision |
|------|----------|
| **Architecture** | Hexagonal (Ports & Adapters) |
| **Framework** | NestJS |
| **Database** | PostgreSQL (core) + MongoDB (logging) |
| **Cache** | Redis (blacklisting only) |
| **Token Strategy** | JWT with RSA signing |
| **Key Management** | Per-instance keys.json, file permissions |
| **Security** | bcrypt (cost=10), httpOnly cookies |

### Module Lifecycle

```
setup() → run() → shutdown() (optional)
```

---

## 🚀 Implementation Roadmap

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

## 📚 Quick Reference

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/v1/register` | Create account |
| POST | `/auth/v1/authenticate` | Login |
| POST | `/auth/v1/refresh` | Refresh tokens |
| POST | `/auth/v1/logout` | Logout |

### Database Tables

| Table | Database | Purpose |
|-------|----------|---------|
| `users` | PostgreSQL | User accounts |
| `user_tokens` | PostgreSQL | Refresh/reset tokens |
| `refresh_token_keys` | PostgreSQL | RSA public keys |
| `user_demographics` | MongoDB | Login logging |

### Environment Variables

```bash
DATABASE_URL=postgresql://...
MONGODB_URL=mongodb://...
REDIS_URL=redis://...
JWT_ACCESS_EXPIRY=1d
JWT_REFRESH_EXPIRY=7d
BCRYPT_COST=10
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug
```

---

## 🔗 Related Documents

- [Brainstorming Session Log](../brainstorming/brainstorm-auth-service-design-2026-07-11/.memlog.md)
- [Original Plan](./auth-service-plan.md)

---

## 👥 Team

| Role | Agent | Contribution |
|------|-------|--------------|
| Business Analyst | Mary (📊) | Requirements gathering, brainstorming |
| System Architect | Winston (🏗️) | Architecture decisions |
| Technical Writer | Paige (📚) | Documentation |

---

*All planning artifacts complete.*
---

# AuthService UML Diagrams

This directory contains Mermaid diagrams for the AuthService project. These diagrams can be imported into Excalidraw for visualization and editing.

## Diagram Index

### Sequence Diagrams
| File | Description | Maps to FRs |
|------|-------------|-------------|
| `01-sequence-registration.mmd` | User registration flow | FR-1, FR-5, FR-13 |
| `02-sequence-login.mmd` | User login flow | FR-2, FR-5, FR-6, FR-13, FR-15 |
| `03-sequence-refresh.mmd` | Token refresh flow | FR-3, FR-6, FR-7 |
| `04-sequence-logout.mmd` | User logout flow | FR-4, FR-25 |

### Class Diagrams
| File | Description | Maps to |
|------|-------------|---------|
| `05-class-entities.mmd` | Entity relationships (User, RefreshToken, UserDemographics) | FR-13, FR-23, FR-24, FR-25 |
| `06-class-services.mmd` | Service hierarchy and interfaces | Hexagonal Architecture |
| `07-class-exceptions.mmd` | Exception hierarchy | Section 11.1 |

### Component Diagrams
| File | Description | Maps to |
|------|-------------|---------|
| `08-component-hexagonal.mmd` | Hexagonal architecture layers | Section 11.4 |

### Package Diagrams
| File | Description | Maps to |
|------|-------------|---------|
| `09-package-modules.mmd` | Module dependencies and folder structure | Section 11.4, 11.5 |

### Object Diagrams
| File | Description | Maps to |
|------|-------------|---------|
| `10-object-runtime.mmd` | Runtime instances during auth flow | Runtime state |

## How to Use with Excalidraw

1. **Import Mermaid diagrams:**
   - Open Excalidraw
   - Click `+` → `Mermaid to Excalidraw`
   - Paste the `.mmd` file content
   - Click "Create"

2. **Edit diagrams:**
   - Drag and drop elements
   - Add notes and annotations
   - Export as PNG/SVG

## Diagram Conventions

- **Green** = Inbound adapters (HTTP, Guards)
- **Blue** = Ports (Interfaces)
- **Orange** = Core domain (Services)
- **Purple** = Outbound adapters (Databases)
- **Red** = Root configuration
- **Gray** = Infrastructure (Config, Validation)

## Related Documentation

- [PRD](../../_bmad-output/planning-artifacts/prds/prd-AuthService-2026-07-12/prd.md)
- [Architecture](../../_bmad-output/planning-artifacts/architecture.md)
- [Technical Documentation](../../_bmad-output/planning-artifacts/technical-documentation.md)
