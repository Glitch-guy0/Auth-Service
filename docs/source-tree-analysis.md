# AuthService — Source Tree Analysis

**Generated:** 2026-07-12  
**Scan Level:** Quick  
**Project Type:** Backend (NestJS)

---

## Project Structure

```
AuthService/
├── src/                          # Application source code
│   ├── main.ts                   # Entry point - Bootstrap NestJS app
│   ├── app.module.ts             # Root module - ConfigModule setup
│   ├── app.controller.ts         # Default controller (health check)
│   ├── app.service.ts            # Default service
│   └── app.controller.spec.ts    # Unit test for controller
│
├── test/                         # E2E test directory
│   └── jest-e2e.json            # E2E test configuration
│
├── dist/                         # Compiled output (gitignored)
│
├── _bmad/                        # BMAD configuration
│   ├── bmm/                     # Module configuration
│   │   └── config.yaml          # Project settings
│   └── custom/                  # Custom overrides
│
├── _bmad-output/                 # Planning artifacts
│   ├── brainstorming/           # Brainstorming session logs
│   ├── planning-artifacts/      # Architecture & technical docs
│   │   ├── architecture.md      # Full technical architecture
│   │   ├── technical-documentation.md  # Implementation guide
│   │   ├── auth-service-plan.md # Initial plan
│   │   └── README.md           # Artifacts overview
│   └── project-context.md       # AI agent context rules
│
├── docs/                         # Project documentation (generated)
│   ├── index.md                 # Master index
│   ├── project-overview.md      # Project overview
│   ├── source-tree-analysis.md  # This file
│   └── development-guide.md     # Development setup
│
├── .agents/                      # Agent skills
│   └── skills/                  # Installed skills
│
├── .opencode/                    # OpenCode configuration
│
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript configuration
├── tsconfig.build.json           # Build-specific TS config
├── nest-cli.json                 # NestJS CLI configuration
├── .eslintrc.js                  # ESLint rules
├── .prettierrc                   # Prettier formatting
└── .gitignore                    # Git ignore rules
```

---

## Critical Directories

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `src/` | Application source | All `.ts` files |
| `src/modules/` | Feature modules (planned) | `auth/`, `user/`, `token/`, `logging/` |
| `src/shared/` | Shared utilities (planned) | `interfaces/`, `decorators/`, `guards/` |
| `src/config/` | Configuration (planned) | `env.validator.ts`, `app-context.ts` |
| `test/` | E2E tests | `jest-e2e.json` |
| `_bmad-output/` | Planning artifacts | Architecture, technical docs |

---

## Entry Points

| Entry Point | File | Purpose |
|-------------|------|---------|
| Application | `src/main.ts` | Bootstrap NestJS, start HTTP server |
| Root Module | `src/app.module.ts` | Import ConfigModule, register features |
| Test Runner | `npm run test` | Jest unit tests |
| E2E Tests | `npm run test:e2e` | Integration tests |

---

## Planned Module Structure (from Architecture)

```
src/modules/
├── auth/                        # Authentication module
│   ├── auth.module.ts          # Module definition
│   ├── auth.controller.ts      # HTTP endpoints
│   ├── auth.service.ts         # Business logic
│   └── auth.guard.ts           # JWT verification
│
├── user/                        # User management module
│   ├── user.module.ts          # Module definition
│   ├── user.entity.ts          # Data entity
│   └── user.service.ts         # User operations
│
├── token/                       # Token management module
│   ├── token.module.ts         # Module definition
│   ├── token.service.ts        # JWT signing/rotation
│   └── token.config.ts         # Token configuration
│
└── logging/                     # Logging module
    ├── logging.module.ts       # Module definition
    ├── logger.service.ts       # Logger service
    └── log.provider.ts         # Pino + chalk output
```

---

## File Inventory (Current)

| File | LOC | Purpose | Exports |
|------|-----|---------|---------|
| `src/main.ts` | 18 | Bootstrap app, enable CORS, validation pipe | — |
| `src/app.module.ts` | 11 | Root module with ConfigModule | `AppModule` |
| `src/app.controller.ts` | 12 | Health check endpoint | `AppController` |
| `src/app.service.ts` | 8 | Default service | `AppService` |
| `src/app.controller.spec.ts` | 16 | Unit test | — |

---

## Configuration Files

| File | Purpose | Key Settings |
|------|---------|--------------|
| `package.json` | Dependencies | NestJS 11.x, TypeScript 5.8 |
| `tsconfig.json` | TypeScript | Strict mode, ES2021 target |
| `tsconfig.build.json` | Build config | Excludes decorators |
| `nest-cli.json` | CLI config | Source root: `src/` |
| `.eslintrc.js` | Linting | No explicit-any, no return-type |
| `.prettierrc` | Formatting | Single quotes, trailing commas |

---

*Source tree analysis complete. Ready for project documentation.*
