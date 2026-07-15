---
type: review
target: ARCHITECTURE-SPINE.md
created: '2026-07-14'
verdict: FAIL
---

# Reality Check — Architecture Spine

## Verdict: **FAIL**

The architecture is structurally sound and the hexagonal pattern is correctly applied. However, the stack table contains multiple outdated version numbers that, if implemented as-is, would require immediate upgrades. Two versions are significantly behind their current releases.

---

## Findings

### 1. TypeScript 5.8.3 → actual latest: 7.0.2

**Severity: CRITICAL**
**Location:** Stack table line 119

TypeScript 5.8.3 was released March 2025. TS 7.0.2 is current (July 2026). The architecture is two major versions behind. TS 5.8 does not include TS 6.x or 7.x features, improved type inference, or performance gains from the newer compiler pipeline.

**Fix:** Update to `7.0.x` (or latest stable 7.x). NestJS 11 fully supports TS 7.x.

### 2. Jest 29.7.0 → actual latest: 30.4.2

**Severity: HIGH**
**Location:** Stack table line 130

Jest 29.7.0 was the last 29.x release. Jest 30.0 was released June 2025. The architecture pins a version that is now 12+ months behind. Jest 30 includes native ESM improvements, better TypeScript support, and performance improvements.

**Fix:** Update to `30.x`. Pin to `30.4.2` (latest stable) or latest 30.x.

### 3. ESLint 9.25.1 → actual latest: 10.7.0

**Severity: HIGH**
**Location:** Stack table line 131

ESLint 9.25.1 exists (April 2025) but ESLint 10 was released February 2026. The flat config format is now the default and legacy `.eslintrc` support is removed in v10.

**Fix:** Update to `10.x`. If the project uses flat config already (likely with NestJS 11), ESLint 10 is a clean upgrade.

### 4. Prettier 3.5.3 → actual latest: 3.9.5

**Severity: MEDIUM**
**Location:** Stack table line 132

Prettier 3.5.3 was released March 2025. Current stable is 3.9.5 (July 2026). Four minor versions behind with formatting improvements and new syntax support.

**Fix:** Update to `3.9.x`.

### 5. NestJS 11.1.3 → actual latest: 11.1.28

**Severity: MEDIUM**
**Location:** Stack table line 118

11.1.3 exists but is 13 patch versions behind the latest 11.x. Missing security patches and bug fixes from the last year.

**Fix:** Update to `11.1.x` (latest patch). Or remove the specific patch version and just say `11.x`.

### 6. TypeORM "latest" is now 1.0.0

**Severity: MEDIUM**
**Location:** Stack table line 129

TypeORM reached 1.0.0 stable in May 2026. The architecture says "latest" without pinning — if implemented today, this pulls 1.0.0 which is a major version jump from the 0.3.x line. Breaking changes likely exist between 0.3.x and 1.0.0.

**Fix:** Pin explicitly to `1.0.0` or `^1.0.0`. Review TypeORM 1.0 migration guide if upgrading from 0.3.x.

### 7. @nestjs/config version mismatch in project-context.md

**Severity: LOW**
**Location:** project-context.md lists `@nestjs/config: 4.0.2`; architecture spine doesn't list it explicitly but references it in conventions.

Actual latest is 4.0.4. Minor discrepancy but shows the project-context.md is slightly stale.

**Fix:** Update project-context.md to 4.0.4.

### 8. bcrypt "latest" — maintenance concern

**Severity: LOW**
**Location:** Stack table line 125

bcrypt 6.0.0 is the latest (May 2026), but the package has had maintenance concerns (long-standing open issues, historical vulnerability CVE-2020-7689 in versions <5.0.0). The architecture should pin to `6.0.0` explicitly rather than leaving it as "latest".

**Fix:** Pin to `6.0.0`. Consider noting `bcryptjs` as a lighter alternative with no native dependencies.

### 9. chalk not in stack table

**Severity: LOW**
**Location:** Consistency Conventions reference "pino + chalk via LogManager" but chalk is not in the Stack table.

Chalk 5.x is ESM-only and widely used. Should be listed if it's part of the stack.

**Fix:** Add `chalk | 5.x` to the Stack table, or clarify if it's optional.

---

## What's Correct

| Technology | Architecture Claim | Verified |
| --- | --- | --- |
| Node.js | 22.x | ✅ Valid (Maintenance LTS) |
| PostgreSQL | 16+ | ✅ Reasonable |
| MongoDB | 7+ | ✅ Reasonable |
| Redis | 7+ | ✅ Reasonable |
| Zod | 4.4.3 | ✅ Current stable |
| nestjs-zod | 5.4.0 | ✅ Current stable |
| jose | latest | ✅6.2.3 is current |
| pino | latest | ✅10.x is current |

---

## Architecture Pattern Assessment

The hexagonal (Ports & Adapters) pattern is correctly applied:

- **AD-1** correctly enforces that core domain owns ports and adapters implement them
- **AD-3** hybrid database architecture is well-reasoned (PostgreSQL for auth, MongoDB for logging, Redis for blacklist)
- **AD-5** single active session per user is a clean design choice
- **AD-11** Zod-only validation (no class-validator) is consistent and modern
- **AD-12** transaction pattern with auto-commit/rollback is well-specified
- Deferred items (rate limiting, password reset, email verification, RBAC) are reasonable for Phase 1

No structural issues found in the invariants or capability map.

---

## Required Actions

1. **Update TypeScript** from 5.8.3 to 7.0.x — blocks all downstream tooling
2. **Update Jest** from 29.7.0 to 30.x — test runner must be current
3. **Update ESLint** from 9.25.1 to 10.x — linter should match current ecosystem
4. **Update Prettier** from 3.5.3 to 3.9.x — minor but should stay current
5. **Pin TypeORM** explicitly to 1.0.0 instead of "latest"
6. **Pin bcrypt** explicitly to 6.0.0
7. **Add chalk** to stack table or remove from conventions
