# Story 5.2: Auth Controller — Refresh Endpoint

Status: ready-for-dev

## Story

As a developer,
I want the refresh endpoint wired up,
so that users can refresh tokens via HTTP.

## Acceptance Criteria

1. **Given** the project
   **When** I check AuthController
   **Then** POST /auth/v1/refresh endpoint exists

2. **Given** the project
   **When** I check the endpoint handler
   **Then** it reads refresh token from httpOnly cookie

3. **Given** the project
   **When** I check the endpoint response
   **Then** it returns 200 with new tokens on success

4. **Given** the project
   **When** I check the endpoint decorators
   **Then** it has Swagger decorators

## Tasks / Subtasks

- [ ] Task 1: Install and configure cookie-parser middleware (AC: #2)
  - [ ] Subtask 1.1: Run `npm install cookie-parser && npm install -D @types/cookie-parser`
  - [ ] Subtask 1.2: Register `cookie-parser` middleware in `src/main.ts` before `app.useGlobalPipes(...)` — `app.use(cookieParser())`
  - [ ] Subtask 1.3: Import `cookie-parser` in `src/main.ts`

- [ ] Task 2: Add refresh endpoint to AuthController (AC: #1, #2, #3, #4)
  - [ ] Subtask 2.1: Import `Req`, `Res`, `Cookie`, `TokenExpiredException`, `TokenRevokedException` from `@nestjs/common`
  - [ ] Subtask 2.2: Import `Request`, `Response` from `express`
  - [ ] Subtask 2.3: Import `ApiCookieAuth` from `@nestjs/swagger`
  - [ ] Subtask 2.4: Add `REFRESH_TOKEN_COOKIE` constant to the controller (or a shared config)
  - [ ] Subtask 2.5: Implement `refresh()` method with `@Version('v1')`, `@Post('refresh')`, `@HttpCode(HttpStatus.OK)`
  - [ ] Subtask 2.6: Read refresh token from cookie via `@Cookie('refreshToken') refreshToken: string`
  - [ ] Subtask 2.7: Delegate to `this.authService.refresh(refreshToken)`
  - [ ] Subtask 2.8: Use `@Res({ passthrough: true })` to set new refresh token cookie on response
  - [ ] Subtask 2.9: Return 200 with `TokenResponseDto`

- [ ] Task 3: Add Swagger decorators (AC: #4)
  - [ ] Subtask 3.1: `@ApiOperation({ summary: 'Refresh access token' })`
  - [ ] Subtask 3.2: `@ApiCookieAuth('refreshToken')` to document cookie auth
  - [ ] Subtask 3.3: `@ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })`
  - [ ] Subtask 3.4: `@ApiResponse({ status: 401, description: 'Token expired or invalid' })`

- [ ] Task 4: Add error mapping in the handler (AC: #3)
  - [ ] Subtask 4.1: Catch `TokenExpiredException` → throw `UnauthorizedException`
  - [ ] Subtask 4.2: Catch `TokenRevokedException` → throw `UnauthorizedException`
  - [ ] Subtask 4.3: Catch `InvalidCredentialsException` → throw `UnauthorizedException`
  - [ ] Subtask 4.4: Catch unexpected errors → throw `InternalServerErrorException`

- [ ] Task 5: Update controller tests (AC: #1, #2, #3)
  - [ ] Subtask 5.1: Add `refresh` mock to `authService` in test setup
  - [ ] Subtask 5.2: Test successful refresh returns 200 with new tokens
  - [ ] Subtask 5.3: Test TokenExpiredException maps to UnauthorizedException
  - [ ] Subtask 5.4: Test TokenRevokedException maps to UnauthorizedException
  - [ ] Subtask 5.5: Test unexpected errors map to InternalServerErrorException

## Dev Notes

### Existing Code Context

**`src/modules/auth/auth.controller.ts`** — The main file to modify. Currently has two endpoints:

- `POST /auth/v1/register` (returns 201)
- `POST /auth/v1/authenticate` (returns 200)

Both follow the same pattern: try/catch with domain exception mapping to NestJS HTTP exceptions. The refresh endpoint follows this same pattern but reads input from a cookie instead of the body, and sets a cookie on the response.

**`src/modules/auth/auth.service.ts`** — Has a stub `refresh(_refreshToken: string): Promise<TokenResponseDto>` that throws `"Not implemented"`. This story depends on Story 5-1 implementing the real `refresh()` logic. This story only wires the controller to the service.

**`src/shared/exceptions/authentication.exception.ts`** — Contains the token-specific exceptions already defined:

- `TokenExpiredException` (errorCode: `TOKEN_EXPIRED`)
- `TokenRevokedException` (errorCode: `TOKEN_REVOKED`)
- `TokenInvalidSignatureException` (errorCode: `TOKEN_INVALID_SIGNATURE`)
- `InvalidCredentialsException` (errorCode: `AUTH_INVALID_CREDENTIALS`)

**`src/common/ports/auth.port.ts`** — The `IAuthService` interface already declares `refresh(refreshToken: string): Promise<TokenResponseDto>`.

**`src/modules/auth/dto/token-response.dto.ts`** — The response shape:

```typescript
{ accessToken: string, refreshToken: string, expiresIn: number }
```

**`src/main.ts`** — No cookie-parser middleware currently configured. The `app.use(...)` middleware registration slot is available before `app.useGlobalPipes(...)`.

**`package.json`** — No `cookie-parser` or `@types/cookie-parser` in dependencies.

### Key Decisions

#### Cookie Reading: Install `cookie-parser`

The codebase has zero cookie-related code. `cookie-parser` is not installed, not configured in `main.ts`, and no cookie references exist anywhere in `src/`. The project uses `@nestjs/platform-express` (Express under the hood), so `cookie-parser` is the standard approach.

**Approach:** Install `cookie-parser` and `@types/cookie-parser`, then register it in `main.ts`:

```typescript
import * as cookieParser from 'cookie-parser';
// ...
app.use(cookieParser());
```

This should be placed **before** `app.useGlobalPipes(...)` so cookies are parsed before validation runs.

**Alternative if cookie-parser is rejected:** Parse the `Cookie` header manually from `req.headers.cookie`. This is fragile and not recommended, but would look like:

```typescript
const cookies = req.headers.cookie?.split(';').reduce(
  (acc, c) => {
    const [key, val] = c.trim().split('=');
    acc[key] = val;
    return acc;
  },
  {} as Record<string, string>,
);
const refreshToken = cookies?.refreshToken;
```

Document this as a fallback only if there's a constraint against adding `cookie-parser`.

#### Cookie Setting: `@Res({ passthrough: true })`

The existing endpoints return `TokenResponseDto` as the response body (handled by NestJS serialization). The refresh endpoint needs to **both** set a `Set-Cookie` header **and** return the JSON body. Using `@Res({ passthrough: true })` from `@nestjs/common` allows:

1. Access to the raw Express `Response` object to call `res.cookie(...)`
2. Returning the `TokenResponseDto` from the method (NestJS will serialize it)

```typescript
async refresh(
  @Cookie('refreshToken') refreshToken: string,
  @Res({ passthrough: true }) res: Response,
): Promise<TokenResponseDto> {
  const tokens = await this.authService.refresh(refreshToken);

  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return tokens;
}
```

**Important:** `@Cookie('refreshToken')` requires `cookie-parser` to be registered (it populates `req.cookies`). Without it, the parameter will be `undefined`.

#### Refresh Token Cookie Configuration

From `architecture.md`:

```typescript
const REFRESH_TOKEN_COOKIE = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
```

Define this as a private constant in the controller or extract to a shared constants file. Recommend a private constant in the controller to keep scope narrow:

```typescript
private readonly REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict' as const,
  path: '/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
```

### Error Mapping

| Service Exception             | Controller → NestJS Exception  | HTTP Status |
| ----------------------------- | ------------------------------ | ----------- |
| `TokenExpiredException`       | `UnauthorizedException`        | 401         |
| `TokenRevokedException`       | `UnauthorizedException`        | 401         |
| `InvalidCredentialsException` | `UnauthorizedException`        | 401         |
| Unexpected error              | `InternalServerErrorException` | 500         |

All token-related auth failures map to 401. This follows the existing pattern where `InvalidCredentialsException` already maps to `UnauthorizedException` in the login handler.

### Response Format

The endpoint returns the standard `TokenResponseDto` body. The refresh token is also set as an httpOnly cookie via `Set-Cookie` header. The caller receives:

- **Body:** `{ "accessToken": "...", "refreshToken": "...", "expiresIn": 3600 }`
- **Header:** `Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=604800`

### Swagger Decorators Pattern

Follow the existing register/login pattern. Add these decorators:

```typescript
@Version('v1')
@Post('refresh')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Refresh access token' })
@ApiCookieAuth('refreshToken')
@ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
@ApiResponse({ status: 401, description: 'Token expired or invalid' })
```

`@ApiCookieAuth` documents that the endpoint requires a cookie for authentication in Swagger UI.

### Project Structure Notes

- No new files are created. All changes are to existing files.
- `src/main.ts` — add cookie-parser import and middleware registration
- `src/modules/auth/auth.controller.ts` — add the `refresh()` method
- `src/modules/auth/__tests__/auth.controller.spec.ts` — add tests for refresh

### References

- Epic 5 Story 5.2 in `_bmad-output/planning-artifacts/epics.md:628`
- Architecture token refresh flow in `_bmad-output/planning-artifacts/architecture.md`
- Cookie config spec in architecture.md (REFRESH_TOKEN_COOKIE constant)
- `IAuthService` port: `src/common/ports/auth.port.ts:8` — already declares `refresh()`
- Token exceptions: `src/shared/exceptions/authentication.exception.ts:20-34`
- All exceptions filter: `src/shared/exceptions/all-exceptions.filter.ts` — ensures error responses follow `{ success: false, error: { code, message, timestamp, path } }` envelope

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

| File                                                 | Action | Description                                                                                       |
| ---------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| `src/main.ts`                                        | Modify | Add cookie-parser import and `app.use(cookieParser())`                                            |
| `src/modules/auth/auth.controller.ts`                | Modify | Add `refresh()` method with cookie reading, cookie setting, error mapping, and Swagger decorators |
| `src/modules/auth/__tests__/auth.controller.spec.ts` | Modify | Add test cases for refresh endpoint success and error paths                                       |

---

## Retrospective

**Epic 5 Retrospective:** [epic-5-retrospective.md](./epic-5-retrospective.md)
**Status:** Done — reviewed 2026-07-16
