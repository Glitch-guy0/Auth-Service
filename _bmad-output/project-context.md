---
project_name: 'AuthService'
user_name: 'Prajwal'
date: '2026-07-12'
sections_completed: ['technology_stack', 'prd']
existing_patterns_found: 8
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| NestJS | 11.1.3 | Framework |
| TypeScript | 5.8.3 | Language |
| Node.js | 22.x | Runtime |
| PostgreSQL | 16+ | Core DB (users, tokens, keys) |
| MongoDB | 7+ | Logging DB (demographics) |
| Redis | 7+ | Blacklisting (access tokens) |

### Key Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| @nestjs/config | 4.0.2 | Environment management |
| class-validator | 0.14.2 | Input validation |
| class-transformer | 0.5.1 | Object transformation |
| Jest | 29.7.0 | Testing |
| ESLint | 9.25.1 | Linting |
| Prettier | 3.5.3 | Formatting |

### Version Constraints

- **TypeScript:** Strict mode enabled (`"strict": true` in tsconfig.json)
- **Node.js:** Use LTS version (22.x)
- **NestJS:** Follow official NestJS conventions and patterns
- **PostgreSQL:** Use UUID v7 for primary keys (via `gen_random_uuid()`)
