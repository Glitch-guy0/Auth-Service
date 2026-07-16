# Story 4.3: Auth Controller — Login Endpoint

Status: done

## Story

As a developer,
I want the login endpoint wired up,
so that users can login via HTTP.

## Acceptance Criteria

1. **Given** the project
   **When** I check AuthController
   **Then** POST /auth/v1/authenticate endpoint exists

2. **Given** the project
   **When** I check the endpoint handler
   **Then** it validates input with `LoginSchema.parse(body)` via `ZodValidationPipe(LoginSchema)`

3. **Given** the project
   **When** I check the endpoint response
   **Then** it returns 200 with tokens on success (type `TokenResponseDto`)

4. **Given** the project
   **When** I check the endpoint decorators
   **Then** it has Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`)

## Tasks / Subtasks

- [x] Add `POST /auth/v1/authenticate` endpoint to AuthController (AC: 1, 2, 3, 4)
  - [x] Add `@Version('v1')` and `@Post('authenticate')` decorators
  - [x] Add `@HttpCode(HttpStatus.OK)` decorator (200, not 201)
  - [x] Add `@ApiOperation({ summary: 'Login' })` and `@ApiResponse` decorators for 200, 400, 401, 403
  - [x] Add method parameter: `@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto`
  - [x] Return type: `Promise<TokenResponseDto>`
  - [x] Delegate to `this.authService.login(dto)`
  - [x] Add error handling: catch `InvalidCredentialsException` → 401, `UserBlockedException` → 403, unexpected → 500
  - [x] Import `LoginDto` and `LoginSchema` from `./dto/login.dto`
  - [x] Import exception classes from `../../shared/exceptions`
- [x] Update controller unit tests for the new login endpoint (AC: 1)
  - [x] Add describe block for `login` in `auth.controller.spec.ts`
  - [x] Test: returns 200 with tokens on valid login
  - [x] Test: throws UnauthorizedException for `InvalidCredentialsException`
  - [x] Test: throws ForbiddenException for `UserBlockedException`
  - [x] Test: throws InternalServerErrorException for unexpected errors

## Dev Notes

### Existing Code Context

**Auth Controller** (`src/modules/auth/auth.controller.ts:1-50`):
- Already has register endpoint at `POST /auth/v1/register` returning 201
- Uses `@ApiTags('auth')` at class level
- Uses `@Controller('auth')` base path
- Pattern: `@Version('v1')` + `@Post('<route>')` + `@HttpCode()` + Swagger decorators
- Error handling: specific exception catch → NestJS exception mapping, fallback to `InternalServerErrorException`
- Uses `ZodValidationPipe` from `./pipes/zod-validation.pipe`

**Auth Service** (`src/modules/auth/auth.service.ts:56-58`):
- `login(_dto: any)` currently throws `Error('Not implemented')`
- Story 4.2 (AuthService — Login Logic) must implement this method before this story works
- The controller only wires up the HTTP layer; it delegates to `authService.login(dto)`
- **IMPORTANT:** Even if 4.2 is not yet implemented, this story creates the controller method and error mapping. The endpoint will throw until 4.2 is complete.

**IAuthService Interface** (`src/common/ports/auth.port.ts:7`):
- `login(dto: LoginDto): Promise<TokenResponseDto>` — the controller should match this signature

**LoginDto** (`src/modules/auth/dto/login.dto.ts:3-8`):
```typescript
export const LoginSchema = z.object({
  usernameOrEmail: z.string(),
  password: z.string(),
});
export type LoginDto = z.infer<typeof LoginSchema>;
```

**TokenResponseDto** (`src/modules/auth/dto/token-response.dto.ts:3-9`):
```typescript
export const TokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});
export type TokenResponseDto = z.infer<typeof TokenResponseSchema>;
```

**Exception Classes** (all in `src/shared/exceptions/`):
- `InvalidCredentialsException` (401, errorCode: `AUTH_INVALID_CREDENTIALS`, default message: "Invalid email or password")
- `UserBlockedException` (403, errorCode: `AUTH_USER_BLOCKED`, default message: "User account has been blocked")
- Both extend `BaseAuthException` which has `statusCode`, `errorCode`, `timestamp`, `toJSON()`

**ZodValidationPipe** (`src/modules/auth/pipes/zod-validation.pipe.ts:1-18`):
- Takes a `ZodSchema`, calls `safeParse()`, throws `BadRequestException` with error issues on failure

### Error Mapping Pattern (from register endpoint)

```typescript
// Register endpoint pattern (auth.controller.ts:39-48)
try {
  return await this.authService.register(dto);
} catch (error) {
  if (error instanceof UserExistsException) {
    this.logger.warn(`User conflict: ${error.message}`);
    throw new ConflictException(error.message);
  }
  this.logger.error(`Registration failed for ${dto.username}`, error);
  throw new InternalServerErrorException('Internal server error');
}
```

For login, replicate this pattern:
- `InvalidCredentialsException` → `UnauthorizedException` (401)
- `UserBlockedException` → `ForbiddenException` (403)
- Unexpected errors → `InternalServerErrorException` (500)

### Key Differences from Register Endpoint

| Aspect | Register | Login |
|--------|----------|-------|
| HTTP Status | 201 (Created) | 200 (OK) |
| Route | `POST /auth/v1/register` | `POST /auth/v1/authenticate` |
| DTO | `RegisterSchema` | `LoginSchema` |
| Success exceptions | `UserExistsException` (409) | None |
| Auth exceptions | None | `InvalidCredentialsException` (401), `UserBlockedException` (403) |

### Project Structure Notes

- Controller file: `src/modules/auth/auth.controller.ts` — UPDATE (add new method)
- Test file: `src/modules/auth/__tests__/auth.controller.spec.ts` — UPDATE (add test cases)
- DTO already exists: `src/modules/auth/dto/login.dto.ts` — no changes needed
- Service port already defines `login()` — no changes needed

### Dependencies

- **Story 4.1** (TokenService — Token Verification): Must be implemented for `authService.login()` to work end-to-end
- **Story 4.2** (AuthService — Login Logic): Must be implemented for `authService.login()` to work end-to-end
- This story can be coded independently (controller + error mapping), but integration testing requires 4.1 and 4.2

### Architecture Reference

- API routes: `architecture.md` Section 11.1 — `POST /auth/v1/authenticate` is the login endpoint
- Login flow diagram: `architecture.md` Section 5.2
- Cookie config for refresh token: `architecture.md` Section 6.3
- Response format: `architecture.md` Section 11.2

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Review Findings

No findings — clean review. All acceptance criteria satisfied, all tests pass, patterns consistent with register endpoint.

### File List
