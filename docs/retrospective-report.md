# AuthService Retrospective Report

**Date:** 2026-07-17
**Sprint:** Initial Build Sprint (Epics 1-9)

---

## 1. Executive Summary

45 stories delivered across 9 epics with 262 tests (248 unit, 14 e2e). Seven retrospectives ran from Epic 3 through Epic 9 (Epics 1-2 had no retrospectives). Test count grew steadily from 108 to 262 across the sprint.

The retrospective feedback loop proved effective: Epic 4 applied both action items from Epic 3, and each subsequent retro surfaced issues that were either resolved immediately or added to the tracking system. Epic 9's e2e suite uncovered critical production issues that had been latent since Epic 2, validating the investment in integration-level testing.

---

## 2. Epic-by-Epic Summary

| Epic | Date | Stories | Tests | Suites | Blockers | Key Finding |
|------|------|---------|-------|--------|----------|-------------|
| 3 - Registration | 2026-07-15 | 6/6 | 108 | 11 | 0 | Story sizing improved; port interface instability mid-epic |
| 4 - Login | 2026-07-16 | 3/3 | 128 | 14 | 0 | First clean review (Story 4.3); retro-3 items applied |
| 5 - Token Refresh | 2026-07-16 | 2/2 | 150 | - | 0 | Review caught 3 real bugs; opaque tokens vs JWTs (design deviation) |
| 6 - Logout | 2026-07-16 | 2/2 | 155 | - | 0 | Redis module with @Global(); PostgreSQL-first/Redis-second pattern |
| 7 - Auth Guard | 2026-07-16 | 4/4 | 208 | - | 0 | Review caught security issue (blacklist before signature verify) |
| 8 - Logging | 2026-07-17 | 4/4 | 246 | - | 0 | 3-layer error containment for demographics; graceful MongoDB degradation |
| 9 - Testing & Doc | 2026-07-17 | 5/5 | 262 | - | 5 (resolved) | E2E found TypeOrmModule unregistered, URI versioning broken |

---

## 3. Cross-Cutting Themes

### Systemic Gap: Dev Agent Records

Flagged in Epic 4 and repeated every subsequent epic (5, 6, 7, 8, 9) without resolution. Six consecutive epics reported empty Dev Agent Records as an issue. This is the single largest process gap in the sprint and has been escalated to retro-9-1 (HIGH priority).

### Review Value Confirmed

Every retrospective highlighted the code review process catching real defects before they reached production:
- Epic 5: 3 real bugs caught
- Epic 7: Security bypass risk caught (blacklist check before signature verification)
- Epic 9: Multiple critical issues caught during e2e test authoring

### Test Growth Trajectory

Tests grew from 108 to 262 with zero regressions across all epics. The introduction of e2e tests in Epic 9 uncovered critical production issues that unit tests had missed entirely.

### Design Deviations

Three design decisions deviated from the original architecture:
- **Epic 5:** Refresh tokens stored as opaque hex strings instead of JWTs, creating O(n) bcrypt scan per refresh
- **Epic 7:** LoginSchema over-hardened beyond the spec
- **Epic 9:** URI versioning was silently broken; TransformResponseInterceptor was created during implementation but not in spec

---

## 4. Technical Debt Inventory

| Severity | Item | Epic | Status |
|----------|------|------|--------|
| **HIGH** | O(n) refresh token lookup (opaque tokens vs JWTs) | 5 | Open |
| Medium | Partial-failure rotation state | 5 | Open |
| Medium | Empty Dev Agent Records (process debt) | 4-9 | Open |
| Medium | Missing combined DB + Redis failure test | 6 | Open |
| Medium | LoggingModule.forRoot() complexity | 8 | Open |
| Low | Date calculation inconsistency | 5 | Open |
| Low | Indentation inconsistencies | 5 | Open |
| Low | Stale spec snippets in code | 5 | Open |

---

## 5. Critical Infrastructure Fixes (Epic 9 Discovery)

Epic 9's e2e tests uncovered four critical issues that were immediately resolved:

1. **TypeOrmModule.forRoot() never registered** -- The database module was never initialized in the import chain. Application ran only because in-memory SQLite was configured via TypeOrmModule and NestJS deferred connection errors.

2. **URI versioning silently broken** -- The `/api/v1` prefix required `prefix: ''` in the global prefix configuration. The application started without errors but served routes at unexpected paths.

3. **TransformResponseInterceptor missing from original spec** -- Created during implementation. Needs documentation update to align the architecture document with the codebase.

4. **Docker compose stale volume issues** -- Repeated container builds reused stale volumes, causing test failures that disappeared after `docker compose down -v`.

---

## 6. Recommended Next Steps

### Immediate (Phase 2 - Security Hardening)

1. **Resolve O(n) refresh token lookup** -- Evaluate migrating to JWT refresh tokens or implementing indexed database lookup for the current opaque token scheme.
2. **Add rate limiting** -- Planned in Epic 9 retrospective. Essential for production readiness.
3. **Password reset flow** -- Standard auth feature not yet implemented.
4. **Email verification** -- Required for production user registration.

### Process Improvements

| Priority | ID | Action | Owner |
|----------|----|--------|-------|
| HIGH | retro-9-1 | Enforce Dev Agent Record completion as done criterion | Amelia |
| Medium | retro-9-2 | Document URI versioning pattern in architecture docs | Charlie |
| Medium | retro-9-3 | Add TransformResponseInterceptor to architecture document | Charlie |
| Medium | retro-3-1 | Add unexpected error wrapping as done criterion | Charlie |
| Medium | retro-3-2 | Finalize port interfaces before dependent stories | Amelia |
| Medium | retro-4-1 | Make Dev Agent Record a done criterion | Amelia |
| Medium | retro-4-2 | Document token storage contract in ports | Charlie |
| Low | retro-4-3 | Define review-to-done transition criteria | Prajwal |
| Low | retro-1-1 | Batch small foundation stories | Amelia |
| Low | retro-1-2 | Integration test coverage for Epic 1 | Dana |
| Low | retro-2-1 | Integration test for npm run setup:keys | Dana |
| Low | retro-2-2 | Document key rotation strategy | Charlie |
| Low | retro-9-4 | Document Docker troubleshooting guide | Dana |
| Low | retro-9-5 | Make generateTokenPair an official utility | Amelia |

### Future Phases

- **Phase 3: Admin & Analytics** -- RBAC, admin endpoints, usage analytics
- **Phase 4: OAuth** -- Consumer (login with Google/GitHub) and provider (issue tokens to third-party apps)

---

## 7. Metrics Summary

| Metric | Value |
|--------|-------|
| Total stories | 45 |
| Total epics | 9 |
| Total tests | 262 (248 unit + 14 e2e) |
| Total retrospectives | 7 |
| Open action items | 15 |
| Critical debt items (HIGH) | 1 (O(n) refresh token lookup) |
| Systemic process gaps | 1 (Dev Agent Records) |
| Zero-regression epics | 7 of 7 (with retros) |
| Review-caught defects | 4+ security/functional issues |
