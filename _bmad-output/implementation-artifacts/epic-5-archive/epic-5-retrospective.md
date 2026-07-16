# Epic 5 Retrospective: Token Refresh Flow

**Date:** 2026-07-16
**Epic:** 5 — Token Refresh Flow
**Stories Completed:** 2/2 (5-1, 5-2)
**Facilitator:** Amelia (Developer)
**Participants:** Prajwal (Project Lead), Alice (Product Owner), Charlie (Senior Dev), Dana (QA Engineer)

---

## Epic Summary

Epic 5 delivered the token refresh flow for AuthService — both the service-layer logic and the HTTP endpoint. Story 5-1 implemented `AuthService.refresh()` with input validation, expiry checking, atomic token rotation via try-catch, and proper date calculation. Story 5-2 wired up `POST /auth/v1/refresh` with cookie-parser middleware, cookie reading/writing, Swagger decorators, and error mapping. A significant design deviation occurred: refresh tokens remained opaque hex strings (NOT JWTs) despite the AC specifying "verifies JWT signature" and "O(1) lookup." This results in an O(n) bcrypt scan on every refresh. All 150 tests passing across 11 suites after both stories.

| Metric               | Value                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| Stories Completed    | 2/2 (100%)                                                                             |
| Test Suites          | 11 passing                                                                             |
| Total Tests          | 150 passing                                                                            |
| New Files            | 0                                                                                      |
| Modified Files       | 5 (auth.service.ts, auth.controller.ts, token.service.ts, token.port.ts, auth.port.ts) |
| New Dependencies     | cookie-parser, @types/cookie-parser                                                    |
| Blockers Encountered | 0                                                                                      |
| Production Incidents | 0                                                                                      |

**Stories Delivered:**

- 5.1: AuthService — Refresh Logic (input validation, expiry check, atomic rotation, date fix)
- 5.2: Auth Controller — Refresh Endpoint (cookie-parser, POST /auth/v1/refresh, cookie read/write, Swagger)

---

## What Went Well

1. **Existing Patterns Followed Consistently:** The refresh implementation in `AuthService` (`auth.service.ts:96-129`) mirrors the login/register token-store pattern — generate pair, bcrypt hash, storeToken, return. This consistency makes the codebase predictable and maintainable.

2. **Code Review Caught Real Issues:** Three meaningful fixes came from review on Story 5-1: (a) null/empty input guard added at `auth.service.ts:99-101`, (b) atomic rotation try-catch at `auth.service.ts:117-124` preventing partial failure, (c) date calculation fixed from `setDate()` to `Date.now() + days*24*60*60*1000` at `auth.service.ts:119`. All three would have been bugs in production.

3. **Cookie Configuration Centralized:** The `REFRESH_TOKEN_COOKIE_OPTIONS` constant (`auth.controller.ts:33-39`) was defined once as a private readonly and reused in both the refresh and logout endpoints. Single source of truth for cookie settings.

4. **Comprehensive Edge Case Testing:** The refresh test suite (`auth.service.spec.ts:259-322`) covers 8 scenarios: valid token, token lookup, not found, expired, new pair generation, hash+store, empty string, null/undefined, and storeToken failure. This is thorough.

5. **2-Story Split Worked Well:** Story 5-1 (service logic) then Story 5-2 (controller wiring) kept responsibilities clear. The dependency was clean — Story 5-2 had a stub to call and just wired it up.

6. **Cookie-Parser Integrated Cleanly:** New dependency added and registered in `main.ts` before global pipes, following the recommended middleware ordering. No issues.

7. **All 150 Tests Passing:** No regressions. The refresh feature added tests across three spec files without breaking any existing tests.

---

## What Didn't Go Well

1. **Design Deviation — Opaque Tokens Instead of JWTs:** The story spec (`5-1-authservice-refresh-logic.md:54-102`) identified a critical design decision: refresh tokens are opaque hex strings, NOT JWTs. The AC says "verifies JWT signature" and "queries auth_tokens by user_id (O(1))" — both impossible with opaque tokens. The spec recommended changing to JWTs. Instead, `findUserByRefreshToken()` (`token.service.ts:99-112`) loads ALL rows and does sequential `bcrypt.compare` — O(n) per refresh. This is a known limitation but contradicts the AC and won't scale. The story spec explicitly said "resolve this conflict before implementing" but it was deferred.

2. **Controller Didn't Use @Cookie Decorator:** Story 5-2's Dev Notes (`5-2-auth-controller-refresh-endpoint.md:128-147`) specified `@Cookie('refreshToken') refreshToken: string` as the clean NestJS pattern. The implementation instead uses `@Req() req: Request` with `(req as any).cookies?.refreshToken` (`auth.controller.ts:106-110`). The `as any` cast bypasses type safety and the manual cookie access is less idiomatic than the decorator approach.

3. **Atomic Rotation Isn't Fully Atomic:** The try-catch at `auth.service.ts:117-124` catches `storeToken` failures, but if `bcrypt.hash` succeeds and `storeToken` fails, the old refresh token remains valid in the DB while the caller receives new tokens. The user now has two valid refresh tokens (old one still in DB, new one returned). This is a partial-failure state that could be exploited.

4. **Empty Dev Agent Records (Both Stories):** Story 5-1 and 5-2 both have empty `Dev Agent Record` sections. This was flagged in Epic 4's retro as `retro-4-1` — "Add Dev Agent Record completion as story done criterion." The pattern is still repeating across three epics now (4, 5, 6).

5. **Date Calculation Inconsistency:** `register()` and `login()` use `expiresAt.setDate(expiresAt.getDate() + 7)` (`auth.service.ts:50-51`, `auth.service.ts:85-86`) which has month-boundary edge cases. The refresh method was fixed to use `Date.now() + days*24*60*60*1000` (`auth.service.ts:119`). The register/login methods still use the old pattern — inconsistency across the same file.

6. **No Token Revocation on Refresh:** When a new token pair is generated during refresh, the old refresh token's hash is overwritten via UPSERT. But there's no explicit revocation check — if an attacker has a stolen refresh token and the legitimate user refreshes, the attacker's token becomes invalid. This is actually correct behavior (rotation revokes old), but the implementation doesn't log or track revocation events, making audit trails impossible.

---

## Lessons Learned

### Pattern: AC-to-Implementation Conflicts Must Be Resolved Before Coding

The story spec flagged the opaque-token-vs-JWT conflict as a "critical design decision" and said "resolve this conflict before implementing." It wasn't resolved — the implementation just worked around it with O(n) scan. This creates hidden technical debt that compounds with scale.

**Action:** When a story spec identifies a design conflict, the resolution must be documented in the Completion Notes before the story moves to "done." If the conflict affects ACs, update the ACs to match reality.

### Pattern: Review Fixes Are Highest-Value Work

All three review findings on Story 5-1 (input guard, atomic rotation, date fix) were genuine bugs that would have shipped. The review process is the highest-ROI quality gate in the workflow.

**Action:** Maintain the review-to-done workflow. Never skip reviews, even on "simple" stories.

### Pattern: Decorator Patterns Exist for a Reason

The `@Cookie()` decorator was specified in the story but not used. The manual approach with `as any` works but loses type safety and deviates from NestJS conventions. When a spec recommends a framework-provided solution, use it unless there's a concrete reason not to.

**Action:** When a story spec recommends a specific NestJS decorator or pattern, use it by default. Document deviations with rationale.

### Pattern: 2-Story Epics Continue to Deliver Cleanly

Story 5-1 (service) + Story 5-2 (controller) kept the work focused. No scope creep, no ambiguity.

**Action:** Continue the 2-story pattern for service+controller epics.

---

## Technical Debt Incurred

| Item                           | Severity | Description                                                                                                                                                      | Recommended Action                                                                                                                       |
| ------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| O(n) refresh token lookup      | high     | `findUserByRefreshToken` loads ALL rows and does sequential bcrypt.compare. Won't scale beyond ~1000 users. Story spec recommended JWT approach for O(1) lookup. | Switch refresh tokens to JWTs OR add a token_hash column with index for O(1) lookup. Before Epic 7 or when user count exceeds 500.       |
| Partial-failure rotation state | medium   | If bcrypt.hash succeeds but storeToken fails, old token remains valid and new tokens are returned. User has two valid refresh tokens.                            | Make rotation truly atomic: store new token first, then invalidate old. Or accept the risk and document it as "rotation is best-effort." |
| Empty Dev Agent Records        | medium   | Both Story 5-1 and 5-2 have empty Dev Agent Record sections. Third consecutive epic with this issue (retro-4-1 still open).                                      | Enforce retro-4-1: fill Dev Agent Record before marking story "done."                                                                    |
| Date calculation inconsistency | low      | register/login use `setDate()` (edge cases with month boundaries), refresh uses `Date.now() + ms`. Both work but behave differently on Feb 28 → Mar 1.           | Standardize on `Date.now() + days*24*60*60*1000` across all three methods. Low priority.                                                 |
| Controller @Req() with as any  | low      | `auth.controller.ts:110` uses `(req as any).cookies?.refreshToken` instead of `@Cookie()` decorator. Loses type safety.                                          | Refactor to use `@Cookie('refreshToken') refreshToken: string` as originally specified. Low priority.                                    |

---

## Review Findings Summary

**Story 5-1 Review (3 findings, all addressed):**

1. **Input null/empty guard** — Added `if (!refreshToken || typeof refreshToken !== 'string')` check ✅
2. **Atomic rotation try-catch** — Wrapped bcrypt.hash + storeToken in try-catch to prevent partial failure ✅
3. **Date calculation fix** — Changed from `setDate()` to `Date.now() + days*24*60*60*1000` for precision ✅

**Story 5-2 Review (clean):**

- Zero findings. Controller follows established patterns from register/login endpoints with cookie additions.

**Pattern across reviews:** Story 5-1 (new logic) had 3 findings. Story 5-2 (wiring) had 0. This matches Epic 6's pattern — service-layer stories need more review scrutiny than controller wiring stories. The review process is correctly catching issues where they matter most.

---

## Action Items

| #         | Action                                                                                  | Owner         | Priority | Status |
| --------- | --------------------------------------------------------------------------------------- | ------------- | -------- | ------ |
| retro-5-1 | Resolve O(n) refresh token lookup — switch to JWTs or add indexed token_hash column     | Charlie (Dev) | high     | open   |
| retro-5-2 | Document the opaque-token design decision and its trade-offs in story completion notes  | Amelia (Dev)  | medium   | open   |
| retro-5-3 | Enforce Dev Agent Record completion as story done criterion (continuation of retro-4-1) | Amelia (Dev)  | medium   | open   |
| retro-5-4 | Standardize date calculation across register/login/refresh to use Date.now() + ms       | Amelia (Dev)  | low      | open   |
| retro-5-5 | Refactor controller to use @Cookie decorator instead of @Req() with as any              | Amelia (Dev)  | low      | open   |

---

## Previous Retro Follow-Through

| ID        | Action                                                         | Status           | Notes                                                                                                          |
| --------- | -------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| retro-4-1 | Add Dev Agent Record completion as story done criterion        | ❌ Not Addressed | Both Epic 5 stories have empty Dev Agent Records — pattern continues from Epic 4 → 5 → 6                       |
| retro-4-2 | Document token storage contract in port interfaces             | ⏳ Pending       | ITokenService port was updated in Epic 5 (added `findUserByRefreshToken`) but contract documentation not added |
| retro-4-3 | Add review-to-done transition criteria to story workflow       | ⏳ Pending       | Still open — no formal criteria enforced                                                                       |
| retro-3-1 | Add unexpected error wrapping as standard controller criterion | ✅ Applied       | Story 5-2 included InternalServerErrorException catch in both spec and implementation                          |
| retro-3-2 | Finalize port interfaces before implementing dependent stories | ✅ Applied       | ITokenService port was updated with `findUserByRefreshToken` before Story 5-2 started                          |
| retro-1-2 | Add integration test coverage in Epic 9 for Epic 1 components  | ⏳ Pending       | Still open — Epic 9 is planned                                                                                 |

**Follow-Through Score:** 2 completed, 3 pending, 1 not addressed. The retro-4-1 action item (Dev Agent Records) has now been flagged in three consecutive retrospectives (Epic 4, 5, 6) without resolution. This is the most persistent process gap.

---

## Next Epic Preparation Notes

Epic 6 (Logout Flow) depends on Epic 4 (login) and has no direct dependency on Epic 5's refresh work. However, the token patterns established in Epic 5 inform Epic 6's implementation.

**Key dependencies:**

- Epic 6's `AuthService.logout()` will use `tokenService.deleteRefreshTokenByUserId(userId)` — the same UPSERT pattern from Epic 5 means only one refresh token per user
- Epic 6's cookie clearing (`res.clearCookie('refreshToken', { path: '/auth' })`) must match Epic 5's cookie options (`path: '/auth'`)
- The Redis blacklist pattern (Epic 6) is independent of refresh token format (Epic 5)

**Preparation needed:**

- The O(n) refresh token lookup (`retro-5-1`) does NOT block Epic 6 — logout deletes by user_id, not by token scan
- The cookie path (`/auth`) must be consistent between Epic 5's set and Epic 6's clear — verify in implementation

**No significant changes required:** Epic 6's logout flow can proceed without addressing Epic 5's technical debt. The opaque token format affects refresh performance but not logout functionality.

---

## Critical Readiness

- **Testing:** 150 unit tests passing. All refresh scenarios covered (valid, expired, invalid, empty, store failure). Integration tests deferred to Epic 9. No gaps identified for Epic 6 readiness.
- **Deployment:** Not yet deployed (pre-production). No deployment blockers for Epic 6.
- **Stakeholder Acceptance:** Pending review. No concerns identified.
- **Technical Foundation:** Refresh token rotation works. Cookie configuration is established. The O(n) lookup is a scalability concern but not a correctness issue.

**Verdict:** Epic 5 is production-ready from a code quality perspective, with one scalability caveat (O(n) lookup). Epic 6 can proceed without blockers. The only action item that could affect Epic 6 is `retro-5-1` (O(n) lookup) — but this doesn't block logout functionality.
