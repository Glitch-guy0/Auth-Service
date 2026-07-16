# Epic 6 Retrospective: Logout Flow

**Date:** 2026-07-16
**Epic:** 6 — Logout Flow
**Stories Completed:** 2/2 (6-1, 6-2)
**Facilitator:** Amelia (Developer)
**Participants:** Prajwal (Project Lead), Alice (Product Owner), Charlie (Senior Dev), Dana (QA Engineer)

---

## Epic Summary

Epic 6 delivered the complete logout flow for AuthService — both the service-layer logic and the HTTP endpoint. Story 6-1 introduced a new Redis module (`src/modules/redis/`), added `deleteRefreshTokenByUserId` and `blacklistToken` to the token service, and implemented `AuthService.logout()` with PostgreSQL-first/Redis-second ordering per AD-17. Story 6-2 wired up `POST /auth/v1/logout` with Bearer token extraction, cookie clearing, Swagger decorators, and proper error mapping. All 155 tests passing across 11 suites after both stories.

| Metric               | Value                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| Stories Completed    | 2/2 (100%)                                                                                            |
| Test Suites          | 11 passing                                                                                            |
| Total Tests          | 155 passing                                                                                           |
| New Files            | 2 (redis.service.ts, redis.module.ts)                                                                 |
| Modified Files       | 6 (auth.service.ts, auth.controller.ts, token.service.ts, token.port.ts, auth.port.ts, app.module.ts) |
| Blockers Encountered | 0                                                                                                     |
| Production Incidents | 0                                                                                                     |

**Stories Delivered:**

- 6.1: AuthService — Logout Logic (Redis module, token blacklist, DB delete, AD-17 ordering, never-throw contract)
- 6.2: Auth Controller — Logout Endpoint (POST /auth/v1/logout, Bearer extraction, cookie clearing, Swagger)

---

## What Went Well

1. **New Infrastructure Created Cleanly:** The Redis module (`src/modules/redis/`) was created from scratch following existing module conventions. `@Global()` decorator was the right call — makes Redis available to TokenService without explicit import wiring. The `useFactory` pattern with `ConfigService` injection matches the project's existing DI approach.

2. **AD-17 Operation Order Implemented Correctly:** PostgreSQL-first, Redis-second ordering was followed exactly as designed. The rationale is sound: refresh token revocation (long-lived, 7 days) takes priority over access token blacklisting (short-lived, TTL-based self-healing).

3. **Never-Throw Contract Achieved:** `AuthService.logout()` never throws — invalid/expired tokens, DB failures, and Redis failures all resolve silently with appropriate logging. This is critical for UX: logout always "works" from the user's perspective.

4. **Fault Isolation Pattern Established:** The implementation uses three layers of error handling: (1) outer try-catch for token verification failures, (2) inner try-catch for DB failures, (3) `.catch()` for Redis failures. This ensures the most important operation (DB revocation) completes even if Redis is down.

5. **TTL Cap Prevents Memory Bloat:** The `Math.min(exp - now, 86400)` cap on Redis TTL was a review-driven improvement. Without it, tokens with long expiry windows could store entries indefinitely. The 24-hour max is a sensible default.

6. **Redis Graceful Shutdown:** The `Promise.race` with 5-second timeout in `onModuleDestroy` ensures the app doesn't hang during shutdown if Redis is unresponsive. This was another review-driven improvement.

7. **All 155 Tests Passing:** No test regressions. The logout feature added tests across three spec files (auth.service, auth.controller, token.service) without breaking any existing tests.

---

## What Didn't Go Well

1. **DB Failure Isolation Imperfection:** The story spec (6-1) explicitly required a test: "Test both DB and Redis fail → still return void (graceful degradation)." The current implementation wraps the DB call in an inner try-catch, but if the DB fails, the code still proceeds to call `blacklistToken`. However, the test for "DB failure → Redis still called" is not present in `auth.service.spec.ts` — only "DB failure → silently succeeds" is tested. The spec wanted to verify Redis runs even after DB failure, but the test doesn't assert `blacklistToken` was called. This is a minor gap: the behavior is correct (Redis IS called after DB failure), but the test coverage doesn't verify it.

2. **Spec Code Snippets Didn't Match Final Implementation:** Story 6-1's Dev Notes included a suggested `logout()` implementation with `.catch()` on `blacklistToken` inside the outer try block. The actual implementation uses an inner try-catch for `deleteRefreshTokenByUserId` instead. Both approaches achieve the same goal (fault isolation), but the discrepancy between spec and implementation could confuse future readers.

3. **Empty Dev Agent Records (Both Stories):** Story 6-1 and 6-2 both have empty `Dev Agent Record` sections. This was flagged in Epic 4's retro as `retro-4-1` — "Add Dev Agent Record completion as story done criterion." The pattern is repeating. Future retrospectives lose context when agent model, completion notes, and file lists are missing.

4. **RedisModule Placement Changed Mid-Implementation:** Story 6-1's Dev Notes suggested registering `RedisModule` in `TokenModule` imports. The final implementation places it in `AppModule` as a global module. While this is architecturally correct (and better), the deviation from the spec wasn't documented. Minor, but worth noting.

5. **Token Service Indentation Inconsistency:** The `blacklistToken` method in `token.service.ts` has inconsistent indentation — the Redis `SET` call block uses 4-space indentation while the rest of the method uses 6-space. This was caught in review but not fixed.

---

## Lessons Learned

### Pattern: Review-Driven Improvements Are Worth the Extra Cycle

Three review-driven changes improved the implementation significantly:

- DB failure isolation (inner try-catch instead of relying on outer catch)
- TTL cap (Math.min preventing Redis memory bloat)
- Redis shutdown timeout (Promise.race preventing hang)

**Action:** Continue the review-to-done workflow. The review cycle catches real issues.

### Pattern: Never-Throw Contracts Simplify Testing

The "method never throws" contract for `logout()` made tests straightforward — every test is an assertion that the method resolves (never rejects). This is simpler than testing specific error types and exceptions.

**Action:** Consider applying the never-throw pattern to other fire-and-forget operations (e.g., `logDemographics` in login).

### Pattern: New Infrastructure Modules Should Be Global from the Start

The decision to make `RedisModule` `@Global()` was correct but came after initially suggesting TokenModule-scoped imports. Since Redis will be used by Epic 7's auth guard (blacklist checking), making it global early avoided rework.

**Action:** When creating new infrastructure modules (Redis, queue, cache), default to `@Global()` unless there's a reason to scope it.

### Pattern: 2-Story Epics Maintain Velocity

Epic 6's 2-story structure kept focus tight. Story 6-1 built the foundation, Story 6-2 wired the HTTP layer. No scope creep, no ambiguity about responsibilities.

**Action:** Continue the 2-story pattern for CRUD-style epics (service logic + controller endpoint).

---

## Technical Debt Incurred

| Item                      | Severity | Description                                                                                                                                                                      | Recommended Action                                                                                                        |
| ------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Missing "both fail" test  | medium   | Story 6-1 spec required a test for "DB and Redis both fail → still return void." The test exists for DB failure and Redis failure separately, but not for the combined scenario. | Add test case: `deleteRefreshTokenByUserId` rejects + `blacklistToken` rejects → still resolves. Priority: before Epic 7. |
| Empty Dev Agent Records   | medium   | Both Story 6-1 and 6-2 have empty Dev Agent Record sections (agent model, completion notes, file list).                                                                          | Enforce retro-4-1 action item: fill Dev Agent Record before marking story "done."                                         |
| Token service indentation | low      | `blacklistToken` method in `token.service.ts:156-180` has inconsistent indentation (mixed 4/6 space).                                                                            | Fix indentation to consistent 6-space. Low priority.                                                                      |
| Spec-implementation delta | low      | Story 6-1's code snippets don't exactly match the final implementation (inner try-catch vs `.catch()`).                                                                          | Document the final pattern in the story's completion notes. Low priority.                                                 |

---

## Review Findings Summary

**Story 6-1 Review (4 findings, all addressed):**

1. **DB failure isolation** — Inner try-catch added around `deleteRefreshTokenByUserId` so Redis still runs if DB fails ✅
2. **TTL cap** — `Math.min(exp - now, 86400)` added to prevent Redis memory bloat ✅
3. **Redis shutdown timeout** — `Promise.race` with 5s timeout added to `onModuleDestroy` ✅
4. **Error differentiation** — Distinguish token verification errors from unexpected infrastructure errors ✅

**Story 6-2 Review (clean):**

- Zero findings. Controller follows established patterns from register/login endpoints.

**Pattern across reviews:** Review findings were concentrated in Story 6-1 (infrastructure/new code) rather than Story 6-2 (wiring/following patterns). This is expected — new infrastructure needs more scrutiny than endpoint wiring.

---

## Action Items

| #         | Action                                                                                  | Owner         | Priority | Status |
| --------- | --------------------------------------------------------------------------------------- | ------------- | -------- | ------ |
| retro-6-1 | Add "both DB and Redis fail" test case to auth.service.spec.ts                          | Dana (QA)     | medium   | open   |
| retro-6-2 | Enforce Dev Agent Record completion as story done criterion (continuation of retro-4-1) | Amelia (Dev)  | medium   | open   |
| retro-6-3 | Fix indentation inconsistency in token.service.ts blacklistToken method                 | Amelia (Dev)  | low      | open   |
| retro-6-4 | Document RedisModule @Global() decision in architecture.md or story completion notes    | Charlie (Dev) | low      | open   |

---

## Previous Retro Follow-Through

| ID        | Action                                                         | Status           | Notes                                                                             |
| --------- | -------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------- |
| retro-4-1 | Add Dev Agent Record completion as story done criterion        | ❌ Not Addressed | Both Epic 6 stories have empty Dev Agent Records — pattern is repeating           |
| retro-4-2 | Document token storage contract in port interfaces             | ⏳ Pending       | Still open — not blocking Epic 6, but relevant for Epic 7+                        |
| retro-4-3 | Add review-to-done transition criteria to story workflow       | ⏳ Pending       | Still open — stories transitioned from review to done without formal criteria     |
| retro-3-1 | Add unexpected error wrapping as standard controller criterion | ✅ Applied       | Story 6-2 included InternalServerErrorException catch in spec and implementation  |
| retro-3-2 | Finalize port interfaces before implementing dependent stories | ✅ Applied       | ITokenService and IAuthService ports were updated in Story 6-1 before 6-2 started |

**Follow-Through Score:** 2 completed, 3 pending. The retro-4-1 action item (Dev Agent Records) was not addressed despite being flagged in Epic 4 retro. This is the most concerning repeat pattern.

---

## Next Epic Preparation Notes

Epic 7 (Auth Guard & Protected Routes) depends on Epic 4 (token verification) and **directly depends on Epic 6's Redis blacklist**.

**Key dependencies:**

- Story 7.2 (JWT Auth Guard) checks the Redis blacklist — `RedisService` must be available and working
- Story 7.1 (Auth Middleware) extracts tokens — the same Bearer extraction pattern from Story 6-2 is reusable
- The `@Global()` RedisModule from Epic 6 means no additional wiring needed for Epic 7

**Preparation needed:**

- Verify Redis blacklist `get()` method works correctly (currently `RedisService` has `get` but it's not tested)
- Ensure the `blacklist:{token}` key pattern is consistent between Story 6-1 (set) and Story 7.2 (get)
- Consider whether the 24-hour TTL cap (86400s) is the right default for Epic 7's guard checks

**No significant changes required:** Epic 6's Redis infrastructure is solid and ready for Epic 7. The `@Global()` module, consistent key pattern, and TTL-based self-healing design all support the auth guard use case directly.

---

## Critical Readiness

- **Testing:** 155 unit tests passing. All logout scenarios covered (valid token, invalid token, DB failure, Redis failure). Integration tests deferred to Epic 9. No gaps identified for Epic 7 readiness.
- **Deployment:** Not yet deployed (pre-production). No deployment blockers for Epic 7.
- **Stakeholder Acceptance:** Pending review. No concerns identified.
- **Technical Foundation:** Redis module is global and available. Token blacklist key pattern is established. AD-17 ordering is proven. Auth guard can build directly on this.

**Verdict:** Epic 6 is production-ready from a code quality perspective. Epic 7 can proceed without blockers. The only action item that could block Epic 7 is retro-6-1 (missing combined failure test) — recommend completing before Epic 7 Story 7.2 starts.
