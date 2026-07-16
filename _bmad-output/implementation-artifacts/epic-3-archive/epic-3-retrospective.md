# Epic 3 Retrospective: Registration Flow

**Date:** 2026-07-15
**Facilitator:** Amelia (Developer)
**Participants:** Prajwal (Project Lead), Alice (Product Owner), Charlie (Senior Dev), Dana (QA Engineer)

---

## Epic Summary

| Metric | Value |
|--------|-------|
| Stories Completed | 6/6 (100%) |
| Test Suites | 11 passing |
| Total Tests | 108 passing |
| TypeCheck | Clean |
| Blockers Encountered | 1 |
| Technical Debt Items | 0 |
| Production Incidents | 0 |

**Vertical Slice Delivered:** `POST /auth/v1/register → AuthController → AuthService → UserService + TokenService → PostgreSQL`

---

## What Went Well

1. **Story Sizing Improvement:** 6 focused stories was far more manageable than Epic 1's 16 tiny ones. Each story had clear scope and deliverables. (retro-1-1 partially addressed)

2. **Vertical Slice Architecture:** Building end-to-end (controller → service → DB) in one epic gave immediate feedback on the full request lifecycle. No integration surprises.

3. **Hexagonal Ports Pattern:** Port-based DI (`IUserService`, `ITokenService` via injection tokens) kept service dependencies clean and testable. AuthService doesn't know about concrete implementations.

4. **Test Coverage Foundation:** 108 tests across 11 suites — all passing. Unit tests are comprehensive with proper mocking (jose, bcrypt, TypeORM repositories).

5. **Clean Typecheck:** Zero TypeScript errors throughout. Strict mode caught issues early.

6. **Consistent Code Quality:** All stories followed the same patterns — Zod validation pipes, structured logging, NestJS decorators. Code reads consistently across modules.

---

## Challenges & Lessons

### Blocker: Story 3-6 — Missing Error Handling
- **Issue:** AuthController initially re-threw unexpected errors without wrapping in `InternalServerErrorException`. Test expected original error message but got "Unexpected error" instead of a safe HTTP response.
- **Root Cause:** Story spec didn't explicitly require wrapping unexpected errors. The code review caught it.
- **Resolution:** Added `InternalServerErrorException` catch for unexpected errors, updated test to expect the wrapped exception.
- **Lesson:** Controller layer must always wrap unexpected service errors in HTTP-appropriate exceptions. Add this to story specs as a standard acceptance criterion.

### Port Interface Instability
- **Issue:** Story 3-3 required updating `ITokenService.storeToken()` signature to add `expiresAt: Date` parameter. This affected Story 3-5 which depended on the port.
- **Root Cause:** Port interfaces were designed before full implementation context was known.
- **Resolution:** Updated port before implementing dependent stories. Worked because stories were sequential.
- **Lesson:** For Epic 4+, finalize port interfaces in a dedicated story or as part of the first story that defines the contract.

### Zod Types vs Swagger Decorators
- **Issue:** Story 3-6 attempted to use `type: TokenResponseDto` in `@ApiResponse`, but `TokenResponseDto` is a Zod-inferred type (not a class), so it can't be used as a runtime value in decorators.
- **Root Cause:** Zod-inferred types are TypeScript-only constructs. Swagger decorators need class metadata.
- **Resolution:** Removed `type` from `@ApiResponse` and kept it as a value-only type import.
- **Lesson:** When using Zod DTOs with Swagger, either create separate class DTOs for Swagger metadata, or accept that `@ApiResponse` won't have type information.

---

## Previous Retro Follow-Through

| ID | Action | Status | Notes |
|----|--------|--------|-------|
| retro-1-1 | Batch small foundation stories | ✅ Applied | Epic 3 had 6 well-sized stories vs Epic 1's 16 |
| retro-1-2 | Add integration test coverage in Epic 9 | ⏳ Pending | Still scheduled for Epic 9 |
| retro-2-1 | Integration test for `npm run setup:keys` | ⏳ Pending | Still scheduled for Epic 9 |
| retro-2-2 | Document key rotation strategy | ⏳ Pending | Still open |

---

## Action Items

### Process Improvements

1. **Add "unexpected error wrapping" as standard controller acceptance criterion**
   - Owner: Charlie (Dev)
   - Deadline: Before Epic 4 kickoff
   - Success criteria: Updated story template includes this criterion for all controller stories

2. **Finalize port interfaces before implementing dependent stories**
   - Owner: Amelia (Dev)
   - Deadline: Epic 4 Story 4-1
   - Success criteria: Port interface for token verification is stable before Story 4-2

### Technical Debt

None identified. Clean epic.

### Team Agreements

- Controllers must always wrap unexpected errors in `InternalServerErrorException` — never propagate raw errors to HTTP responses
- Port interface changes require updating all dependent stories before proceeding
- Zod DTOs used with Swagger should note decorator limitations in story specs

---

## Epic 4 Preparation

**Next Epic:** Epic 4 — Login Flow (Stories 4-1, 4-2, 4-3)

**Dependencies on Epic 3:**
- TokenService JWT generation (Story 3-1) — ✅ Complete
- TokenService refresh token (Story 3-2) — ✅ Complete
- TokenService token storage (Story 3-3) — ✅ Complete
- UserService CRUD (Story 3-4) — ✅ Complete
- AuthService registration (Story 3-5) — ✅ Complete
- AuthController register endpoint (Story 3-6) — ✅ Complete

**Preparation Needed:**
- Story 4-1 needs `verifyAccessToken` method on TokenService — port interface update required
- Story 4-2 needs `login` method on AuthService — port interface for user lookup by email/username
- Ensure `ITokenService` and `IUserService` ports accommodate login-specific operations

**No Significant Changes Required:** Epic 3's plan for Epic 4 remains valid. All prerequisites are in place.
