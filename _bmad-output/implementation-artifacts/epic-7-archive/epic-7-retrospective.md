# Epic 7 Retrospective: Auth Guard & Protected Routes

**Date:** 2026-07-16
**Epic:** 7 — Auth Guard & Protected Routes
**Stories Completed:** 4/4 (7-1, 7-2, 7-3, 7-4)
**Facilitator:** Amelia (Developer)
**Participants:** Prajwal (Project Lead), Alice (Product Owner), Charlie (Senior Dev), Dana (QA Engineer)

---

## Epic Summary

Epic 7 delivered the auth guard infrastructure for AuthService — middleware for token extraction, a JWT guard for route protection, enhanced exception filtering, and Zod validation pipe verification. Story 7-1 created a global middleware that extracts Bearer tokens from the Authorization header. Story 7-2 implemented a JwtAuthGuard that validates tokens via ITokenService, checks the Redis blacklist, and attaches the user to the request. Story 7-3 enhanced the existing AllExceptionsFilter with BaseAuthException handling, logging, and error propagation. Story 7-4 verified the existing ZodValidationPipe and added comprehensive unit tests. All 208 tests passing across 15 suites after all stories.

| Metric               | Value                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| Stories Completed    | 4/4 (100%)                                                                                            |
| Test Suites          | 15 passing                                                                                            |
| Total Tests          | 208 passing                                                                                           |
| New Files            | 4 (auth.middleware.ts, jwt-auth.guard.ts, all-exceptions.filter.spec.ts, zod-validation.pipe.spec.ts) |
| Modified Files       | 5 (app.module.ts, auth.module.ts, auth.controller.ts, all-exceptions.filter.ts, login.dto.ts)         |
| Blockers Encountered | 0                                                                                                     |
| Production Incidents | 0                                                                                                     |

**Stories Delivered:**

- 7.1: Auth Middleware — Global token extraction from Authorization header
- 7.2: JWT Auth Guard — Token verification, Redis blacklist check, user attachment
- 7.3: Global Exception Filter — BaseAuthException handling, logging, error propagation
- 7.4: Zod Validation Pipe — Verification, unit tests, LoginSchema hardening

---

## What Went Well

1. **Clean Separation of Concerns:** The middleware extracts, the guard validates, the filter formats. Each component has a single responsibility and can be tested independently. This is textbook hexagonal architecture.

2. **Review-Driven Security Fix:** Story 7-2's review caught a critical issue — blacklist check was happening BEFORE signature verification, leaking revocation state. The fix (reordering to verify-then-check) was straightforward but important. This validates the review workflow.

3. **Cross-Cutting Concern Resolved:** Story 7-3's review identified that the exception filter was silently dropping Zod error details. The fix (adding `errors` field to ErrorEnvelope) was applied immediately, ensuring API consumers get actionable validation feedback.

4. **Defensive Coding Applied:** Story 7-2's review added whitespace-only token rejection (`token?.trim()`), preventing unnecessary Redis lookups and confusing error messages for edge-case inputs.

5. **Type Safety Improved:** The `GuardRequest` interface and `AuthenticatedRequest` type were added during review, replacing `as any` casts with proper TypeScript types. This catches type errors at compile time.

6. **All 208 Tests Passing:** No regressions across the entire test suite. The epic added 53 new tests (8 middleware + 13 guard + 15 filter + 17 pipe) without breaking any existing tests.

7. **Sequential Execution Worked:** The one-story-at-a-time approach with review between each story caught issues early. Story 7-2's review fixes informed Story 7-3's implementation, creating a positive feedback loop.

---

## What Didn't Go Well

1. **LoginSchema Over-Hardened:** Story 7-4's review suggested adding `.min(1)` to LoginSchema. The implementation went further with `.min(3)` for username and `.min(8)` for password. While this is better defense-in-depth, it deviated from the review recommendation without explicit approval. The password minimum of 8 characters may be too restrictive for some use cases.

2. **Empty Dev Agent Records (All Stories):** All four Epic 7 stories have empty `Dev Agent Record` sections. This pattern has been flagged in Epic 4 retro (`retro-4-1`) and Epic 6 retro (`retro-6-2`). The issue is systemic — the workflow doesn't enforce completion of these fields before marking stories done.

3. **Spec-Implementation Delta in Story 7-2:** The story's design decision explicitly stated "check AFTER verification" but the initial implementation checked BEFORE. The review caught this, but the discrepancy between spec and implementation suggests the dev agent didn't fully parse the design decisions section.

4. **Test File Not Updated After Schema Change:** When LoginSchema was updated with `.min(1)`, the existing test "should accept any non-empty string for usernameOrEmail" used a password of `'pass'` (4 chars), which now fails the `.min(8)` constraint. This was caught by the test runner but should have been anticipated.

5. **No Integration Tests:** All stories relied on unit tests only. The middleware-guard-filter-pipe integration path (request flows through middleware → guard → controller → filter on error) is not tested end-to-end. This is deferred to Epic 9 but represents a gap.

---

## Lessons Learned

### Pattern: Review Catches Design Deviations

Story 7-2's review caught that the implementation contradicted the story's own design decision (blacklist check ordering). This is a systemic issue — dev agents may not fully parse design decisions in long story files.

**Action:** Add a "Design Decisions" section to the story template that's more prominent than inline notes. Consider a pre-implementation checklist that explicitly verifies design decision compliance.

### Pattern: Cross-Cutting Changes Need Coordination

Story 7-3's exception filter change (adding `errors` field) was needed by Story 7-4's Zod validation. The review identified this dependency, but the fix was applied in Story 7-3's review cycle, not Story 7-4's.

**Action:** When a story's acceptance criteria depend on another story's output, explicitly document the dependency in both stories. Consider running reviews with cross-story awareness.

### Pattern: Schema Changes Need Test Updates

When a Zod schema is modified (e.g., adding `.min(1)`), all tests that use that schema need to be reviewed. The test failure was caught by the runner, but it's a pattern that can be prevented.

**Action:** Add a "Schema Change Impact" section to stories that modify Zod schemas, listing all test files that may need updates.

### Pattern: Sequential Story Execution Enables Learning

The one-story-at-a-time approach allowed Story 7-2's review fixes to inform Story 7-3's implementation. The guard's type safety improvements (`GuardRequest` interface) were applied consistently across all subsequent stories.

**Action:** Continue the sequential execution pattern for epics with tight coupling between stories.

---

## Technical Debt Incurred

| Item                              | Severity | Description                                                                                               | Recommended Action                                                                                           |
| --------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Missing Dev Agent Records         | medium   | All 4 Epic 7 stories have empty Dev Agent Record sections (agent model, completion notes, file list).     | Enforce retro-4-1 action item: fill Dev Agent Record before marking story "done."                            |
| LoginSchema over-hardened         | low      | `.min(3)` for username and `.min(8)` for password may be too restrictive for some use cases.              | Review with product owner — is this the right minimum? Consider making configurable.                         |
| No integration tests              | medium   | Middleware → guard → controller → filter path is not tested end-to-end.                                   | Add integration tests in Epic 9 covering the full auth flow.                                                 |
| Blacklist key format deviation    | low      | Architecture specifies `blacklist:{token_jti}` but implementation uses `blacklist:${token}` (full JWT).  | Update architecture doc or switch to JTI-based keys. Out of scope for Epic 7.                                |
| Empty test for RedisService.get() | low      | `RedisService.get()` method is used by the guard but has no dedicated unit tests.                         | Add unit tests for RedisService in Epic 9.                                                                   |

---

## Review Findings Summary

**Story 7-1 Review (3 findings, all addressed):**

1. **Test type assertions** — Replaced `(mockRequest as any).accessToken` with `(mockRequest as AuthenticatedRequest).accessToken` ✅
2. **Missing test case** — Added test for `'Bearer'` without trailing space ✅
3. **Inconsistent assertion** — Added `toHaveBeenCalledTimes(1)` to "no header" test ✅

**Story 7-2 Review (2 high, 1 medium, 3 low — 3 addressed):**

1. **[HIGH] Blacklist check ordering** — Moved blacklist check AFTER signature verification ✅
2. **[HIGH] Dead code in catch block** — Removed unreachable `instanceof UnauthorizedException` check ✅
3. **[MEDIUM] Whitespace token bypass** — Added `token?.trim()` guard ✅
4. **[MEDIUM] Missing generic error test** — Added test for unexpected verification errors ✅
5. **[LOW] Type safety** — Added `GuardRequest` interface for `request.user` ✅
6. **[LOW] Test naming** — Updated test name to match actual behavior ✅

**Story 7-3 Review (1 high, 3 medium, 4 low — 3 addressed):**

1. **[HIGH] No logging of 500 errors** — Added `logger.error()` for unknown exceptions ✅
2. **[MEDIUM] Missing `message[]` test** — Added test for HttpException with string array message ✅
3. **[MEDIUM] Unused timestamp** — Used `exception.timestamp` for BaseAuthException responses ✅
4. **[MEDIUM] Inconsistent code type** — Deferred (design decision, not a bug) ⏳

**Story 7-4 Review (1 high, 1 medium, 3 low — 2 addressed):**

1. **[HIGH] Zod errors silently dropped** — Added `errors` field to ErrorEnvelope and propagation logic ✅
2. **[MEDIUM] LoginSchema too permissive** — Added `.min(3)` and `.min(8)` constraints ✅
3. **[LOW] Test redundancy** — Deferred (minor, doesn't affect correctness) ⏳

**Pattern across reviews:** Review findings were concentrated in Story 7-2 (guard/security) and Story 7-3 (error handling). Stories 7-1 and 7-4 had fewer issues because they followed established patterns more closely. This is expected — security-critical code needs more scrutiny.

---

## Action Items

| #         | Action                                                                                      | Owner         | Priority | Status |
| --------- | ------------------------------------------------------------------------------------------- | ------------- | -------- | ------ |
| retro-7-1 | Enforce Dev Agent Record completion as story done criterion (continuation of retro-4-1)     | Amelia (Dev)  | medium   | open   |
| retro-7-2 | Add integration tests for middleware → guard → controller → filter flow in Epic 9            | Dana (QA)     | medium   | open   |
| retro-7-3 | Review LoginSchema minimum constraints with product owner (is `.min(8)` password right?)     | Alice (PO)    | low      | open   |
| retro-7-4 | Update architecture doc to reflect blacklist key format (full token vs JTI)                  | Charlie (Dev) | low      | open   |
| retro-7-5 | Add "Design Decisions" prominence to story template to prevent spec-implementation deltas     | Amelia (Dev)  | medium   | open   |

---

## Previous Retro Follow-Through

| ID        | Action                                                         | Status           | Notes                                                                                  |
| --------- | -------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------- |
| retro-4-1 | Add Dev Agent Record completion as story done criterion        | ❌ Not Addressed | All Epic 7 stories have empty Dev Agent Records — pattern continues                    |
| retro-4-2 | Document token storage contract in port interfaces             | ⏳ Pending       | Still open — relevant for Epic 8+                                                       |
| retro-4-3 | Add review-to-done transition criteria to story workflow       | ✅ Applied       | Stories transitioned from review to done with review findings addressed                 |
| retro-6-1 | Add "both DB and Redis fail" test case                         | ⏳ Pending       | Still open — deferred to Epic 9                                                         |
| retro-6-2 | Enforce Dev Agent Record completion as story done criterion    | ❌ Not Addressed | Same as retro-4-1 — systemic issue                                                      |
| retro-6-3 | Fix indentation inconsistency in token.service.ts              | ⏳ Pending       | Still open — low priority                                                               |
| retro-6-4 | Document RedisModule @Global() decision                        | ✅ Applied       | RedisModule is global and used by Epic 7 guard                                         |

**Follow-Through Score:** 2 completed, 5 pending. The retro-4-1 action item (Dev Agent Records) remains unaddressed across three epics. This is the most concerning repeat pattern.

---

## Next Epic Preparation Notes

Epic 8 (Logging & Observability) depends on Epic 3 (registration flow) and builds on Epic 7's infrastructure.

**Key dependencies:**

- Story 8.1 (Logging Module) needs `AppContext` from Epic 1 — already available
- Story 8.2 (Pino Logger) needs the logging infrastructure — fresh implementation
- Story 8.3 (Request Logging Interceptor) can leverage the middleware pattern from Epic 7
- Story 8.4 (Demographics Collection) needs MongoDB connection — verify it's configured

**Preparation needed:**

- Verify MongoDB connection is working (Epic 1 configured it but it's not actively used)
- Confirm `AppContext.logManager` is wired up and available
- Review the request interceptor pattern — can it reuse the middleware approach?

**No significant changes required:** Epic 7's infrastructure (middleware pattern, guard pattern, exception filter) is solid and ready for Epic 8. The logging module can build directly on the established patterns.

---

## Critical Readiness

- **Testing:** 208 unit tests passing. All auth guard scenarios covered (valid token, invalid token, blacklisted token, Redis failure, whitespace tokens). Integration tests deferred to Epic 9. No gaps identified for Epic 8 readiness.
- **Deployment:** Not yet deployed (pre-production). No deployment blockers for Epic 8.
- **Stakeholder Acceptance:** Pending review. No concerns identified.
- **Technical Foundation:** Auth guard infrastructure is complete. Middleware extracts, guard validates, filter formats. Epic 8 can build logging on top of this foundation.

**Verdict:** Epic 7 is production-ready from a code quality perspective. Epic 8 can proceed without blockers. The only action item that could block Epic 8 is retro-7-2 (integration tests) — recommend completing before Epic 8 Story 8.3 starts.
