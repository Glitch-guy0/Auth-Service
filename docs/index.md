# AuthService — Documentation Index

**Generated:** 2026-07-12  
**Project Type:** Backend Service (NestJS)  
**Architecture:** Hexagonal (Ports & Adapters)  
**Status:** Initial Scan Complete

---

## Project Overview

- **Type:** Monolith
- **Primary Language:** TypeScript
- **Framework:** NestJS 11.x
- **Architecture Pattern:** Hexagonal (Ports & Adapters)
- **Database:** PostgreSQL (core) + MongoDB (logging) + Redis (cache)

---

## Quick Reference

| Property | Value |
|----------|-------|
| Entry Point | `src/main.ts` |
| Root Module | `src/app.module.ts` |
| Port | 3000 |
| Node Version | 22.x |
| TypeScript | 5.8.3 |

---

## Generated Documentation

### Core Documentation

- [Project Overview](./project-overview.md) — Executive summary, tech stack, architecture overview
- [Architecture](../_bmad-output/planning-artifacts/architecture.md) — Full technical architecture (689 lines)
- [Technical Documentation](../_bmad-output/planning-artifacts/technical-documentation.md) — Implementation guide (726 lines)

### Development Documentation

- [Source Tree Analysis](./source-tree-analysis.md) — Project structure and file inventory
- [Development Guide](./development-guide.md) — Setup, scripts, workflow, testing

### Planning Artifacts

- [Architecture Document](../_bmad-output/planning-artifacts/architecture.md) — Detailed technical architecture
- [Technical Documentation](../_bmad-output/planning-artifacts/technical-documentation.md) — API reference, database schema, flows
- [Auth Service Plan](../_bmad-output/planning-artifacts/auth-service-plan.md) — Initial plan
- [Brainstorming Session](../_bmad-output/brainstorming/brainstorm-auth-service-design-2026-07-11/.memlog.md) — Design decisions log

---

## Existing Documentation

| Document | Location | Description |
|----------|----------|-------------|
| Architecture | `_bmad-output/planning-artifacts/architecture.md` | Complete technical architecture |
| Technical Docs | `_bmad-output/planning-artifacts/technical-documentation.md` | Implementation guide |
| Project Context | `_bmad-output/project-context.md` | AI agent rules |

---

## Getting Started

### For Developers

1. **Read:** [Development Guide](./development-guide.md) — Setup instructions
2. **Understand:** [Project Overview](./project-overview.md) — Architecture overview
3. **Deep Dive:** [Architecture](../_bmad-output/planning-artifacts/architecture.md) — Technical details

### For AI Agents

1. **Start:** [Project Context](../_bmad-output/project-context.md) — Rules and patterns
2. **Reference:** [Architecture](../_bmad-output/planning-artifacts/architecture.md) — Design decisions
3. **Implement:** Follow module patterns in [Technical Documentation](../_bmad-output/planning-artifacts/technical-documentation.md)

---

## Architecture Summary

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

## Implementation Phases

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Core Auth | 🔄 In Progress | Signup, Login, Tokens, Logout |
| Phase 2: Security | ⏳ Pending | Rate limiting, Password reset, Email verification |
| Phase 3: Admin | ⏳ Pending | RBAC, Admin endpoints, Analytics |
| Phase 4: OAuth | ⏳ Future | Consumer, Provider, SSO |

---

## Key Files Reference

| File | Purpose | Location |
|------|---------|----------|
| `package.json` | Dependencies | Root |
| `tsconfig.json` | TypeScript config | Root |
| `.env.example` | Environment template | Root |
| `nest-cli.json` | CLI config | Root |
| `src/main.ts` | Entry point | src/ |
| `src/app.module.ts` | Root module | src/ |

---

## Documentation Quality

| Metric | Value |
|--------|-------|
| Files Generated | 4 |
| Total Lines | ~800 |
| Coverage | Complete (initial scan) |
| Last Updated | 2026-07-12 |

---

## Next Steps

1. **Review** this index to understand documentation structure
2. **Deep dive** into architecture for implementation details
3. **Follow** development guide for setup
4. **Create PRD** when ready to plan new features

---

*Index generated by BMAD Documentation Workflow*
