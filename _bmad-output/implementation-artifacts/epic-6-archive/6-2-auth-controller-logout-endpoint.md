# Story 6.2: Auth Controller — Logout Endpoint

Status: ready-for-dev

## Story

As a developer,
I want the logout endpoint wired up,
so that users can logout via HTTP.

## Acceptance Criteria

1. **Given** the project
   **When** I check AuthController
   **Then** POST /auth/v1/logout endpoint exists

2. **Given** the project
   **When** I check the endpoint handler
   **Then** it reads access token from Authorization header

3. **Given** the project
   **When** I check the endpoint handler
   **Then** it delegates to `authService.logout(accessToken)` — which deletes refresh token from DB first (per AD-17) and adds access token to Redis blacklist

4. **Given** the project
   **When** I check the endpoint handler
   **Then** it clears refresh token cookie

5. **Given** the project
   **When** I check the endpoint response
   **Then** it returns 200 on success

6. **Given** the project
   **When** I check the endpoint decorators
   **Then** it has Swagger decorators

## Tasks / Subtasks

- [ ] Task 1: Add `POST /auth/v1/logout` endpoint to AuthController (AC: 1, 2, 3, 5, 6)
  - [ ] Add `@Version('v1')` and `@Post('logout')` decorators
  - [ ] Add `@HttpCode(HttpStatus.OK)` decorator (200)
  - [ ] Add Swagger decorators: `@ApiOperation({ summary: 'Logout' })`, `@ApiResponse` for 200, 401
  - [ ] Add `@ApiBearerAuth()` decorator to document that Authorization header is required
  - [ ] Add method parameter: `@Headers('authorization') authHeader: string` and `@Res({ passthrough: true }) res: Response`
  - [ ] Extract Bearer token from header: `authHeader?.replace('Bearer ', '')`
  - [ ] Return type: `Promise<{ success: true; data: null }>`
  - [ ] Delegate to `this.authService.logout(accessToken)` — after Story 6-1 changes signature from `(userId: string)` to `(accessToken: string)`
  - [ ] Clear refresh token cookie via `res.clearCookie('refreshToken', { path: '/auth' })`
  - [ ] Return `{ success: true, data: null }`
  - [ ] Add error handling: catch unexpected errors → `InternalServerErrorException`
  - [ ] Import `Headers`, `Res` from `@nestjs/common`, `Response` from `express`
- [ ] Task 2: Update controller unit tests for logout endpoint (AC: 1)
  - [ ] Add `logout` to the mock AuthService object in `beforeEach`
  - [ ] Add describe block for `logout` in `auth.controller.spec.ts`
  - [ ] Test: returns 200 with `{ success: true, data: null }` on valid logout
  - [ ] Test: calls `authService.logout()` with extracted token (no `Bearer ` prefix)
  - [ ] Test: clears refresh token cookie with correct path
  - [ ] Test: throws `InternalServerErrorException` for unexpected service errors

## Dev Notes

### Existing Code Context

**Auth Controller** (`src/modules/auth/auth.controller.ts`):

- Currently has `register` (POST /auth/v1/register, 201) and `login` (POST /auth/v1/authenticate, 200)
- Uses `@ApiTags('auth')` at class level, `@Controller('auth')` base path
- Pattern: `@Version('v1')` + `@Post('<route>')` + `@HttpCode()` + Swagger decorators
- Error handling: specific exception catch → NestJS exception mapping, fallback to `InternalServerErrorException`
- Uses `ZodValidationPipe` from `./pipes/zod-validation.pipe` — NOT needed for logout (input is from header, not body)

**Auth Service** (`src/modules/auth/auth.service.ts:100-102`):

- `logout(_userId: string)` currently throws `Error('Not implemented')`
- **Story 6-1 must change signature** to `logout(accessToken: string): Promise<void>` before this story works end-to-end
- The controller only wires up the HTTP layer; it delegates to `authService.logout(accessToken)`

**IAuthService Port** (`src/common/ports/auth.port.ts:9`):

- Current: `logout(userId: string): Promise<void>`
- After Story 6-1: `logout(accessToken: string): Promise<void>`
- Controller must match the post-6-1 signature

**Exception Classes** (all in `src/shared/exceptions/`):

- For logout, the only expected error path is unexpected service failure → `InternalServerErrorException`
- Invalid/expired tokens should silently succeed (handled inside `authService.logout()`)

**Controller Test File** (`src/modules/auth/__tests__/auth.controller.spec.ts`):

- Currently mocks `authService` with `register` and `login` methods
- Must add `logout` to mock object
- Pattern: `describe` block per endpoint, mock service methods, assert delegation and error mapping

### Key Differences from Other Endpoints

| Aspect          | Register               | Login                      | Logout                          |
| --------------- | ---------------------- | -------------------------- | ------------------------------- |
| HTTP Status     | 201                    | 200                        | 200                             |
| Route           | POST /auth/v1/register | POST /auth/v1/authenticate | POST /auth/v1/logout            |
| Input           | Body (Zod validated)   | Body (Zod validated)       | Authorization header            |
| Return type     | `TokenResponseDto`     | `TokenResponseDto`         | `{ success: true, data: null }` |
| Auth Required   | No                     | No                         | Yes (Bearer token)              |
| Cookie handling | Sets cookie            | Sets cookie                | Clears cookie                   |
| Zod validation  | Yes (`RegisterSchema`) | Yes (`LoginSchema`)        | No (header input)               |

### How to Extract Bearer Token

```typescript
const token = authHeader?.replace('Bearer ', '');
```

If the header is missing or malformed, `token` will be `undefined` or an empty string. The service layer handles invalid tokens gracefully (silently succeeds). The controller should still guard against missing headers:

```typescript
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  throw new UnauthorizedException('Missing or invalid Authorization header');
}
```

### How to Clear Cookie in NestJS

Use `@Res({ passthrough: true })` to get access to the response object while still returning a value:

```typescript
@Post('logout')
@HttpCode(HttpStatus.OK)
async logout(
  @Headers('authorization') authHeader: string,
  @Res({ passthrough: true }) res: Response,
) {
  // ... extract token, call service
  res.clearCookie('refreshToken', { path: '/auth' });
  return { success: true, data: null };
}
```

### Response Format

```typescript
// Success Response (200)
{ "success": true, "data": null }

// Error Response (500 — unexpected failure)
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

### Error Handling Pattern

```typescript
try {
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    throw new UnauthorizedException('Missing or invalid Authorization header');
  }
  await this.authService.logout(token);
  res.clearCookie('refreshToken', { path: '/auth' });
  return { success: true, data: null };
} catch (error) {
  if (error instanceof UnauthorizedException) {
    throw error; // re-throw known auth errors
  }
  this.logger.error('Logout failed', error);
  throw new InternalServerErrorException('Internal server error');
}
```

**Important:** `authService.logout()` silently succeeds for invalid/expired tokens (per Story 6-1 and AD-7). The controller should never receive those errors — only unexpected infrastructure failures.

### Swagger Decorators

```typescript
@Version('v1')
@Post('logout')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Logout' })
@ApiBearerAuth()
@ApiResponse({ status: 200, description: 'Logout successful' })
@ApiResponse({ status: 401, description: 'Missing or invalid Authorization header' })
@ApiResponse({ status: 500, description: 'Internal server error' })
```

### Cookie Configuration Reference

From `architecture.md` Section 6.3:

```typescript
const REFRESH_TOKEN_COOKIE = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
```

When clearing: `res.clearCookie('refreshToken', { path: '/auth' })`

### Project Structure Notes

- Controller file: `src/modules/auth/auth.controller.ts` — UPDATE (add new method)
- Test file: `src/modules/auth/__tests__/auth.controller.spec.ts` — UPDATE (add test cases)
- Service port: `src/common/ports/auth.port.ts` — will be updated by Story 6-1
- Service implementation: `src/modules/auth/auth.service.ts` — will be updated by Story 6-1

### Architecture Reference

- Logout flow: `architecture.md` Section 5.4 — POST /auth/v1/logout
- API routes: `architecture.md` Section 11.1 — POST /logout, Auth Required: Yes
- Cookie config: `architecture.md` Section 6.3
- Response format: `architecture.md` Section 11.2 — `{ success: true, data: null }`
- Sequence diagram: `approved/04-sequence-logout.mmd`

### Dependencies

- **Story 6-1** (AuthService — Logout Logic): MUST be completed first. Changes `logout()` signature from `(userId: string)` to `(accessToken: string)`. Controller code will not compile against the port until 6-1 merges.
- **Epic 4** (Login): Must be working for end-to-end logout testing
- **Epic 7** (Auth Guard): Not required for this story — the logout endpoint reads the token from the header directly, not via a guard

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Review Findings

### File List

---

## Retrospective

**Epic 6 Retrospective:** [epic-6-retrospective.md](./epic-6-retrospective.md)
**Status:** Done — reviewed 2026-07-16
