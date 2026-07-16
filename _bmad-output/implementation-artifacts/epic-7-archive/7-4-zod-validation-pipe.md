# Story 7.4: Zod Validation Pipe

Status: review

## Story

As a developer,
I want a global validation pipe that uses Zod schemas,
so that invalid input is rejected before reaching controllers.

## Acceptance Criteria

1. **Given** a request with invalid body
   **When** ValidationPipe processes it
   **Then** it parses the body with the route's Zod schema
   **Then** it rejects the request with 400 status if validation fails
   **And** returns Zod error details (field, message, code)

## Tasks / Subtasks

- [x] Task 1: Verify existing ZodValidationPipe implementation (AC: 1)
  - [x] Read `src/modules/auth/pipes/zod-validation.pipe.ts` — confirm it implements `PipeTransform`, accepts `ZodSchema` in constructor, uses `safeParse`, throws `BadRequestException` on failure
  - [x] Confirm pipe returns `result.data` on success (parsed/transformed value)
  - [x] Confirm pipe throws `BadRequestException` with `{ message: 'Validation failed', errors: result.error.issues }` on failure
- [x] Task 2: Verify per-route pipe usage in controller (AC: 1)
  - [x] Read `src/modules/auth/auth.controller.ts` — confirm `@Body(new ZodValidationPipe(RegisterSchema))` on register endpoint (line 54)
  - [x] Confirm `@Body(new ZodValidationPipe(LoginSchema))` on login endpoint (line 71)
  - [x] Confirm imports: `ZodValidationPipe` from `./pipes/zod-validation.pipe`, `RegisterSchema` from `./dto/register.dto`, `LoginSchema` from `./dto/login.dto`
- [x] Task 3: Evaluate error response format alignment (AC: 1)
  - [x] Read `src/shared/exceptions/all-exceptions.filter.ts` — the filter wraps `HttpException` responses into `{ success: false, error: { code, message, timestamp, path } }`
  - [x] Confirm that `BadRequestException({ message: 'Validation failed', errors: result.error.issues })` produces a 400 response through the exception filter
  - [x] Document: the `errors` array with Zod issue details (field path, message, code) is included in the exception response body — the exception filter extracts `.message` as the top-level message string, but the full `errors` array is available in the raw exception response
  - [x] If response format needs adjustment to match architecture Section 11.2 error envelope, note as enhancement — the core pipe behavior (reject with 400 + Zod details) is already correct
- [x] Task 4: Evaluate global vs per-route registration (AC: 1)
  - [x] Read `src/main.ts` lines 31-37 — currently registers NestJS `ValidationPipe` as global (class-validator based, `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`)
  - [x] Document: the Zod pipe is per-route (applied via `@Body(new ZodValidationPipe(...))`), NOT registered globally — this is the intentional pattern because each route has a different Zod schema
  - [x] Confirm: NestJS global pipes cannot accept constructor arguments per-route, so per-route usage is the correct pattern for Zod validation
  - [x] No change needed — per-route is correct
- [x] Task 5: Verify Zod schemas used by the pipe (AC: 1)
  - [x] Read `src/modules/auth/dto/register.dto.ts` — confirms `RegisterSchema` is a `z.object` with `username` (string, min 3), `email` (string, email), `password` (string, min 8)
  - [x] Read `src/modules/auth/dto/login.dto.ts` — confirms `LoginSchema` is a `z.object` with `usernameOrEmail` (string), `password` (string)
  - [x] Confirm both schemas export both the schema const and the inferred TypeScript type
  - [x] Confirm: pipe correctly validates and narrows types for both register and login flows
- [x] Task 6: Write unit tests for ZodValidationPipe (AC: 1)
  - [x] Create test file `src/modules/auth/pipes/__tests__/zod-validation.pipe.spec.ts`
  - [x] Test: returns parsed data when input matches schema
  - [x] Test: throws BadRequestException with 400 status when input is invalid
  - [x] Test: error response includes Zod issue details (field path via `path`, error `message`, error `code`)
  - [x] Test: works with different schemas (RegisterSchema, LoginSchema)
  - [x] Test: handles empty/missing body
  - [x] Test: handles extra fields (confirms Zod strips or ignores them per schema config)

## Dev Notes

### Existing Code Context

**ZodValidationPipe** (`src/modules/auth/pipes/zod-validation.pipe.ts`):

- **ALREADY EXISTS** with a complete 18-line implementation
- Implements `PipeTransform` from `@nestjs/common`
- Constructor accepts `ZodSchema` (from `zod`)
- `transform(value: unknown)` method:
  - Calls `this.schema.safeParse(value)`
  - On success: returns `result.data` (parsed/typed data)
  - On failure: throws `new BadRequestException({ message: 'Validation failed', errors: result.error.issues })`
- Decorated with `@Injectable()`

```typescript
// Current implementation (complete):
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.issues,
      });
    }
    return result.data;
  }
}
```

**Auth Controller** (`src/modules/auth/auth.controller.ts`):

- Already uses `ZodValidationPipe` as per-route pipe on both body endpoints:
  - Register (line 63): `@Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto`
  - Login (line 89): `@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto`
- Import at line 29: `import { ZodValidationPipe } from './pipes/zod-validation.pipe';`
- The pipe is NOT used on refresh or logout endpoints (they don't take Zod-validated body input)

**Global ValidationPipe** (`src/main.ts` lines 31-37):

- NestJS's built-in `ValidationPipe` is registered globally with class-validator options (`whitelist`, `forbidNonWhitelisted`, `transform`)
- This is a SEPARATE pipe from the Zod pipe — it handles class-validator decorators (not used by this project, which uses Zod exclusively per architecture Section 14)
- The Zod pipe operates per-route at the `@Body()` parameter level, which runs AFTER the global pipe

**AllExceptionsFilter** (`src/shared/exceptions/all-exceptions.filter.ts`):

- Catches ALL exceptions and wraps them in `{ success: false, error: { code, message, timestamp, path } }`
- For `HttpException` (including `BadRequestException`): extracts status code and message
- When `BadRequestException` receives an object like `{ message: 'Validation failed', errors: [...] }`, the filter extracts `.message` as the response message string
- The `errors` array with Zod issue details is included in the exception's response body but the filter formats it into the standard envelope

**Exception Hierarchy** (`src/shared/exceptions/`):

- `BaseAuthException` → abstract base with `statusCode`, `errorCode`, `timestamp`
- `ValidationException` extends `BaseAuthException` (400, `VALIDATION_ERROR`)
- The Zod pipe uses NestJS's built-in `BadRequestException` (not the custom `ValidationException`) — this is correct because the pipe is a generic utility, not auth-specific

### What This Story Changes

**Nothing** — the implementation already exists and is correct. This story is a **verification/documentation story** that confirms:

1. The pipe implementation is correct and complete
2. It is properly used in the controller
3. Error responses include Zod validation details
4. The per-route pattern is intentional and correct
5. Unit tests exist (or need to be written) to cover the pipe

**If tests do not exist**, the dev agent should create them (Task 6).

### What Must Be Preserved

- The per-route pipe pattern (`@Body(new ZodValidationPipe(Schema))`) — do NOT move to global registration
- The `safeParse` usage (not `parse`, which throws and loses structured error info)
- The error shape: `{ message: string, errors: ZodIssue[] }` passed to `BadRequestException`
- The `@Injectable()` decorator (required for NestJS DI)
- The import of `ZodSchema` type from `zod` (not a specific schema — generic)

### Architecture References

- **Zod as validation library**: `architecture.md` Section 14 — "Validation: Zod (strictly) — Runtime validation with TypeScript type inference"
- **Error response format**: `architecture.md` Section 11.2 — `{ success: false, error: { code, message } }` — the exception filter handles this transformation
- **Auth routes requiring validation**: `architecture.md` Section 11.1 — POST /register and POST /authenticate accept body input
- **Signup flow input**: `architecture.md` Section 5.1 — username, email, password
- **Login flow input**: `architecture.md` Section 5.2 — usernameOrEmail, password

### Code Patterns to Follow

- **Pipe pattern**: `implements PipeTransform`, `@Injectable()`, constructor takes `ZodSchema`, `transform(value: unknown)` method
- **Validation**: Use `schema.safeParse(value)` — returns `{ success: true, data }` or `{ success: false, error }`
- **Error throwing**: `throw new BadRequestException({ message: '...', errors: ... })` — NestJS will pass this through `AllExceptionsFilter`
- **Per-route usage**: `@Body(new ZodValidationPipe(Schema)) dto: Type` in controller methods
- **Schema export pattern**: Export both the schema const (`RegisterSchema`) and the inferred type (`RegisterDto`) from DTO files

### Zod Error Issue Shape

Each issue in `result.error.issues` has:

```typescript
{
  code: string;        // e.g. 'too_small', 'invalid_type', 'invalid_string'
  message: string;     // e.g. 'String must contain at least 3 character(s)'
  path: (string | number)[];  // e.g. ['username'] or ['email']
}
```

This is what gets returned in the `errors` array when validation fails.

### Project Structure Notes

- Pipe file: `src/modules/auth/pipes/zod-validation.pipe.ts` — EXISTS, no changes needed
- Controller file: `src/modules/auth/auth.controller.ts` — already uses pipe, no changes needed
- Register DTO: `src/modules/auth/dto/register.dto.ts` — EXISTS with Zod schema
- Login DTO: `src/modules/auth/dto/login.dto.ts` — EXISTS with Zod schema
- Exception filter: `src/shared/exceptions/all-exceptions.filter.ts` — handles error formatting
- Test file: `src/modules/auth/pipes/__tests__/zod-validation.pipe.spec.ts` — CREATE if not exists
- Global pipe (NestJS): `src/main.ts` lines 31-37 — separate from Zod pipe, no changes needed

### Dependencies

- **Epic 4** (Login/Registration): DTOs and schemas already exist from earlier epics
- **Story 7.3** (Global Exception Filter): Already implemented — handles formatting of BadRequestException responses
- No blocking dependencies — the pipe is already functional

## Dev Agent Record

### Agent Model Used

opencode/big-pickle

### Debug Log References

- Verified pipe implementation at `src/modules/auth/pipes/zod-validation.pipe.ts:1-18` — correct PipeTransform, safeParse, BadRequestException pattern
- Confirmed per-route usage in `src/modules/auth/auth.controller.ts:54,71` — RegisterSchema on register, LoginSchema on authenticate
- Confirmed global ValidationPipe in `src/main.ts:31-37` is separate (class-validator), Zod pipe is per-route
- Confirmed AllExceptionsFilter at `src/shared/exceptions/all-exceptions.filter.ts:44-52` wraps HttpException into error envelope
- Zod v4 confirmed: issues have `code`, `message`, `path` fields; extra fields stripped by default

### Completion Notes List

- Task 1: Pipe implementation verified — 18 lines, implements PipeTransform, accepts ZodSchema, uses safeParse, throws BadRequestException with `{ message: 'Validation failed', errors: result.error.issues }`, returns `result.data` on success
- Task 2: Controller uses per-route pipe on register (line 54) and authenticate (line 71); refresh and logout correctly excluded
- Task 3: Exception filter extracts `.message` from BadRequestException response as top-level message; `errors` array available in raw response body. No format changes needed
- Task 4: Per-route is correct pattern — NestJS global pipes cannot accept constructor arguments per-route; Zod requires different schemas per route
- Task 5: RegisterSchema: username (min 3), email (email), password (min 8); LoginSchema: usernameOrEmail (string), password (string). Both export schema + inferred type
- Task 6: Created 17 unit tests covering valid input, invalid input, 400 status, Zod issue details (path, message, code), empty/missing body, extra field stripping, both schemas, and custom schemas

### Review Findings

- None — all verifications passed, tests green

### File List

- `src/modules/auth/pipes/__tests__/zod-validation.pipe.spec.ts` (created)
