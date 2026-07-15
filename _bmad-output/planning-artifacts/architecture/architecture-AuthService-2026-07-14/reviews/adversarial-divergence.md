---
type: adversarial-divergence-review
spine: ARCHITECTURE-SPINE.md
date: '2026-07-14'
verdict: FAIL
---

# Adversarial Divergence Review — AuthService Architecture Spine

## Method

Evaluated every AD pair for scenarios where two teams, each obeying all rules to the letter, could produce implementations that cannot integrate. Focused on: ownership ambiguity, undefined data shapes, incompatible mutation paths, missing interaction contracts, and missing error-handling contracts.

---

## Finding 1 — `users` Table Schema Is Undefined (AD-3 × AD-5)

**AD-5** specifies the `auth_tokens` schema with exact columns (`user_id PK, token_hash, expires_at, updated_at`). **AD-3** places `users` in PostgreSQL but provides zero schema definition.

**Divergence scenario:** Team A (AuthModule) creates `users(id UUID PK, email VARCHAR(255), password_hash VARCHAR(255))`. Team B (UserModule) creates `users(uuid UUID PK, email TEXT, hashed_password TEXT)`. Both comply with AD-3 (PostgreSQL stores core auth data) and AD-5 (auth_tokens references user_id). Neither violates any rule. Both ship. Neither works with the other.

**Impact:** Login, registration, and refresh all join or reference `users` — mismatched schemas cause runtime failures.

**Fix:** Add **AD-14 — Users Table Schema Contract**:

```
The users table schema is defined as:
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()

Only UserRepository may mutate this table. AuthRepository references it
(read-only) for credential verification during login/registration.
```

---

## Finding 2 — JWT Payload Shape Is Undefined (AD-8 × AD-13)

**AD-8** says `TokenService.generateAccessToken(userId, keyId)` returns "the complete JWT string." **AD-13** defers `role` but says nothing about other claims. There is no defined JWT payload schema.

**Divergence scenario:** Team A (TokenService) builds a JWT with `{ sub, iat, exp, iss, aud }`. Team B (auth guard) verifies tokens expecting `{ sub, exp, jti, kid }` in the header. The guard checks `token.sub` as a UUID; TokenService encoded `userId` as a string under `user_id`. Both follow every rule — AD-8 says TokenService returns the complete string, AD-13 defers role — yet the guard fails to extract the subject.

**Impact:** Every authenticated request breaks. The guard and token service disagree on the contract.

**Fix:** Add **AD-15 — JWT Payload Contract**:

```
AccessToken payload MUST contain exactly:
  sub: UUID (the user_id)
  iat: number (issued-at, unix epoch)
  exp: number (expiry, unix epoch)

AccessToken header MUST contain:
  kid: string (key ID for key lookup per AD-9)

TokenService owns payload construction. AuthGuard owns payload extraction.
Any claim not in this list MUST NOT be added without a spine amendment.
```

---

## Finding 3 — `auth_tokens` Ownership Split Between Two Repositories (AD-5 × AD-10 × AD-1)

**AD-5** says `auth_tokens` has `user_id PK` and governs login/refresh. **AD-10** says AuthService calls UserService for demographics. The Capability Map assigns TokenRefresh to "TokenModule → AuthRepository" and Login to "AuthModule → AuthRepository." But AD-1 says adapters don't call each other — coordination goes through the domain.

**Divergence scenario:** Team A builds `AuthRepository` with CRUD methods for `auth_tokens` (insert, upsert, deleteByUserId). Team B builds `TokenRepository` with the same table's methods (findByUserId, rotateToken). Both create TypeORM entities mapped to `auth_tokens`. Both comply with AD-1 (neither adapter calls the other). But NestJS dependency injection resolves two different repositories for the same table. One uses `INSERT ON CONFLICT DO UPDATE`; the other uses `DELETE` then `INSERT` — violating AD-6's three-step atomicity.

**Impact:** Two write paths to the same table with different mutation strategies. Race conditions. Broken AD-6 invariants.

**Fix:** Add **AD-16 — Single-Owner Repository Rule**:

```
Every database table has exactly one repository class that owns all writes.
auth_tokens: owned by AuthRepository (in modules/auth/).
users: owned by UserRepository (in modules/user/).
refresh_token_keys: owned by KeyRepository (in modules/key/).
Other modules may read through injected repository instances but MUST NOT
define their own write methods against another module's table.
```

---

## Finding 4 — Transaction Pattern Is PostgreSQL-Only, But Logout Spans Redis + PostgreSQL (AD-12 × AD-7 × AD-3)

**AD-12** defines `createTransaction(callback)` using TypeORM (PostgreSQL). **AD-7** defines logout as a four-step flow: verify access token → extract user_id → add to Redis blacklist → delete refresh token from DB. These two steps touch different databases. **AD-12** says partial writes must not happen, and auto-rollback applies — but the rollback only covers PostgreSQL.

**Divergence scenario:** Team A implements logout as two sequential calls: `redis.set(blacklist)` then `authRepo.deleteByUserId()`. If the DB delete fails, the Redis blacklist entry persists — the access token is blacklisted but the refresh token is still valid. AD-7 says "fail-closed" but doesn't address cross-database atomicity. AD-12's transaction can't span Redis. Both teams follow all rules yet produce an inconsistent half-logout state.

**Impact:** A compromised refresh token remains usable after logout. Security invariant violated.

**Fix:** Add **AD-17 — Cross-Database Mutation Ordering**:

```
When a use case mutates multiple databases (e.g., Redis + PostgreSQL):
1. Mutate the database with the cheaper rollback first (Redis blacklist
   with TTL is self-healing via expiry).
2. Mutate the authoritative database (PostgreSQL).
3. If step 2 fails, log the orphaned Redis entry — it will self-expire
   via TTL and is not a security risk (it over-restricts, not under-restricts).

This ordering ensures fail-closed behavior. The AD-12 transaction pattern
applies to PostgreSQL-only multi-table mutations.
```

---

## Finding 5 — `logDemographics` Data Shape Is Unconstrained (AD-10)

**AD-10** defines the call signature as `UserService.logDemographics(userId, data)` but `data` has no type definition anywhere in the spine. The `user_demographics` collection in MongoDB has no schema.

**Divergence scenario:** Team A (AuthModule, the caller) builds `data` as `{ age: number, country: string }`. Team B (UserModule, the receiver) expects `{ demographics: { age: number, location: { country: string } } }` and writes it to MongoDB with that nested structure. Both follow AD-10 to the letter — AuthService calls UserService, UserService delegates to DemographicsRepository. But the data shape mismatch means the MongoDB document is malformed or the TypeScript types silently disagree.

**Impact:** Corrupted demographic logs. No runtime error (MongoDB is schemaless), so the bug surfaces months later during analytics.

**Fix:** Add **AD-18 — Demographics Data Contract**:

```
The logDemographics(userId, data) parameter `data` is typed as:
  { age?: number, gender?: string, country?: string }

This type is defined in shared/types/demographics.ts and MUST be imported
by both AuthService (caller) and UserService (receiver). Changes to this
shape require a spine amendment.
```

---

## Summary of Additional Minor Gaps (No Separate Findings)

| Gap | ADs | Severity |
| --- | --- | --- |
| KeyManager lifecycle: who inserts public keys into `refresh_token_keys` after generation? | AD-2, AD-9 | Medium |
| `discard()` call-site: who calls `discard()` — the adapter or the caller? | AD-12 | Low |
| Error envelope shape defined in conventions but not enforced as a typed class/interface | Consistency Conventions | Low |
| MongoDB `user_demographics` TTL/indexing strategy undefined | AD-3, AD-10 | Low |

---

## Verdict: FAIL

5 divergence-inducing gaps found. The spine is well-structured at the AD level but lacks cross-module data contracts and ownership boundaries that would prevent two compliant teams from shipping incompatible code. Findings 1, 2, and 3 are **integration blockers** — they will cause compile-time or runtime failures during integration. Findings 4 and 5 are **correctness gaps** that produce subtle, hard-to-diagnose bugs.
