---
story_id: 4.2
story_key: 4-2-authservice-login-logic
story_title: "AuthService — Login Logic"
epic_num: 4
story_num: 2
status: review
created_date: 2026-07-16
---

# Story 4.2: AuthService — Login Logic

Status: ready-for-dev

## Story

As a developer,
I want the AuthService to handle user login,
so that users can authenticate.

## Acceptance Criteria

1. **Given** valid credentials (email/username + password)
   **When** `AuthService.login(dto)` is called
   **Then** it looks up user by email or username
   **And** checks if user is blocked (throws `UserBlockedException`)
   **And** validates password with bcrypt (`bcrypt.compare`)
   **And** generates access token via `TokenService`
   **And** generates refresh token pair via `TokenService`
   **And** uses UPSERT to store/update refresh token (via `TokenService.storeToken`)
   **And** logs demographics (fire-and-forget via `UserService.logDemographics`)
   **And** returns `{ accessToken, refreshToken }`

2. **Given** invalid credentials (wrong password or non-existent user)
   **When** `AuthService.login(dto)` is called
   **Then** it throws `InvalidCredentialsException`

3. **Given** a blocked user with valid credentials
   **When** `AuthService.login(dto)` is called
   **Then** it throws `UserBlockedException`

## Tasks / Subtasks

- [x] Task 1: Implement `AuthService.login()` method (AC: #1, #2, #3)
  - [x] Add user lookup by email or username (detect `@` to choose)
  - [x] Add blocked-user check → throw `UserBlockedException`
  - [x] Add password validation with `bcrypt.compare`
  - [x] Throw `InvalidCredentialsException` for null user or bad password
  - [x] Generate access token via `ITokenService.generateTokenPair(user.id)` (or separate methods — see Dev Notes)
  - [x] Generate refresh token pair and store via `ITokenService.storeToken()` (UPSERT)
  - [x] Fire-and-forget demographics via `IUserService.logDemographics()`
  - [x] Return `{ accessToken, refreshToken }`

- [x] Task 2: Add unit tests for login (AC: #1, #2, #3)
  - [x] Test happy path: valid email + password → returns tokens
  - [x] Test happy path: valid username + password → returns tokens
  - [x] Test blocked user → throws `UserBlockedException`
  - [x] Test wrong password → throws `InvalidCredentialsException`
  - [x] Test non-existent user → throws `InvalidCredentialsException`
  - [x] Test UPSERT: refresh token stored with correct hash
  - [x] Test demographics logged (fire-and-forget, errors swallowed)

## Dev Notes

### Current State of `auth.service.ts`

The file at `src/modules/auth/auth.service.ts` already has:
- `register()` method fully implemented (from Story 3-5)
- `login()` stub that throws `'Not implemented'` — **replace this**
- `refresh()` and `logout()` stubs — **leave untouched**
- DI already wired: `IUserService` (via `USER_SERVICE` token), `ITokenService` (via `TOKEN_SERVICE` token)

**Key:** Only modify the `login()` method. Do not change constructor, `register()`, `refresh()`, or `logout()`.

### Current `ITokenService` Port

```typescript
// src/common/ports/token.port.ts
export interface ITokenService {
  generateTokenPair(userId: string): Promise<TokenResponseDto>;
  storeToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  verifyAccessToken(token: string): Promise<{ userId: string }>;
}
```

**Important:** `generateTokenPair` is the public port method. The internal `generateAccessToken()` and `generateRefreshToken()` are private in `token.service.ts`. Use `generateTokenPair(user.id)` for this story — it returns the full `TokenResponseDto` with both tokens. The registration flow (Story 3-5) already uses this pattern successfully.

### Current `IUserService` Port

```typescript
// src/common/ports/user.port.ts
export interface IUserService {
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(dto: RegisterDto): Promise<User>;
  logDemographics(userId: string, ip: string, location?: { country: string; city: string }): Promise<void>;
}
```

### LoginDto (Already Defined)

```typescript
// src/modules/auth/dto/login.dto.ts
export const LoginSchema = z.object({
  usernameOrEmail: z.string(),
  password: z.string(),
});
export type LoginDto = z.infer<typeof LoginSchema>;
```

### Exceptions (Already Defined)

```typescript
// src/shared/exceptions/authentication.exception.ts
export class InvalidCredentialsException extends AuthenticationException {
  readonly errorCode = "AUTH_INVALID_CREDENTIALS";
  constructor(message = "Invalid email or password") { super(message); }
}

// src/shared/exceptions/authorization.exception.ts
export class UserBlockedException extends AuthorizationException {
  readonly errorCode = "AUTH_USER_BLOCKED";
  constructor(message = "User account has been blocked") { super(message); }
}
```

### Implementation Pattern

Follow the existing `register()` method's conventions:
- Use `this.logger.log()` / `this.logger.warn()` for structured logging
- Raw passwords must never be logged
- Inject services via `@Inject(TOKEN)` tokens (already wired)
- Return `TokenResponseDto` consistently

### Login Method Skeleton

```typescript
async login(dto: LoginDto): Promise<TokenResponseDto> {
  // 1. Look up user — email if contains '@', otherwise username
  let user: User | null = null;
  if (dto.usernameOrEmail.includes('@')) {
    user = await this.userService.findByEmail(dto.usernameOrEmail);
  } else {
    user = await this.userService.findByUsername(dto.usernameOrEmail);
  }

  // 2. Invalid credentials check (user not found)
  if (!user) {
    this.logger.warn(`Login failed: user not found for ${dto.usernameOrEmail}`);
    throw new InvalidCredentialsException();
  }

  // 3. Blocked check
  if (user.blocked) {
    this.logger.warn(`Login blocked: user ${user.id} is blocked`);
    throw new UserBlockedException();
  }

  // 4. Password validation
  const valid = await bcrypt.compare(dto.password, user.password);
  if (!valid) {
    this.logger.warn(`Login failed: invalid password for user ${user.id}`);
    throw new InvalidCredentialsException();
  }

  // 5. Generate token pair
  const tokens = await this.tokenService.generateTokenPair(user.id);

  // 6. Store refresh token (UPSERT — TokenService.storeToken handles ON CONFLICT)
  // Note: generateTokenPair returns the raw refreshToken; we need to hash it for storage.
  // If generateTokenPair does NOT hash the refresh token internally, hash it here.
  // If it does (returns tokenHash separately), use that.
  // See "Token Storage Decision" below.

  // 7. Fire-and-forget demographics
  this.userService.logDemographics(user.id, /* ip */, /* location */)
    .catch(() => {}); // swallow — never block login

  // 8. Return tokens
  return tokens;
}
```

### Token Storage Decision

The current `generateTokenPair` returns `TokenResponseDto` which has `{ accessToken, refreshToken, expiresIn }`. The `refreshToken` is the **raw** token (for cookie). For DB storage, you need the **hash**.

**Option A (Recommended):** If `generateTokenPair` already hashes the refresh token internally and stores the hash, no additional hashing is needed — `storeToken` was already called inside `generateTokenPair`.

**Option B:** If `generateTokenPair` returns only the raw token, hash it in `login()` before calling `storeToken`:
```typescript
const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, this.BCRYPT_SALT_ROUNDS);
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);
await this.tokenService.storeToken(user.id, refreshTokenHash, expiresAt);
```

**Check `token.service.ts` implementation** to determine which option applies. The existing `register()` in `auth.service.ts` (lines 44-49) already hashes the refresh token and calls `storeToken` separately — follow this same pattern if `generateTokenPair` does not handle storage internally.

### Demographics Input

The `LoginDto` from the controller will include IP and optional location data. The controller (Story 4-3) will extract `req.ip` and pass it through. For this story's `login()` method, accept the IP/location as part of the DTO or as additional parameters. The `IUserService.logDemographics()` signature is:

```typescript
logDemographics(userId: string, ip: string, location?: { country: string; city: string }): Promise<void>;
```

Since demographics are fire-and-forget, wrap the call in `.catch(() => {})` to prevent MongoDB failures from blocking authentication.

### File Structure

```
src/modules/auth/
├── auth.service.ts              ← MODIFY (replace login stub)
├── auth.module.ts               ← NO CHANGE (DI already wired)
├── dto/
│   ├── login.dto.ts             ← NO CHANGE (already defined)
│   └── token-response.dto.ts    ← NO CHANGE (already defined)
└── __tests__/
    └── auth.service.spec.ts     ← MODIFY (add login tests)
```

### Testing Requirements

Add tests in `src/modules/auth/__tests__/auth.service.spec.ts`. Follow existing test patterns:
- Use `jest.fn()` mocks for `userService` and `tokenService`
- Use `jest.mock('bcrypt')` for password comparison mocking
- `bcrypt.compare` must be mocked to return `true`/`false` for password validation tests

**Test cases:**

| Scenario | Input | Expected |
|----------|-------|----------|
| Valid email login | `{ usernameOrEmail: 'test@example.com', password: 'correct' }` | Returns `TokenResponseDto` |
| Valid username login | `{ usernameOrEmail: 'testuser', password: 'correct' }` | Returns `TokenResponseDto` |
| Non-existent user | `{ usernameOrEmail: 'nobody@example.com', password: 'any' }` | Throws `InvalidCredentialsException` |
| Wrong password | `{ usernameOrEmail: 'test@example.com', password: 'wrong' }` | Throws `InvalidCredentialsException` |
| Blocked user | User with `blocked: true` + valid password | Throws `UserBlockedException` |
| UPSERT verified | Successful login | `tokenService.storeToken` called with user ID and hashed token |
| Demographics logged | Successful login | `userService.logDemographics` called (fire-and-forget) |
| Demographics failure swallowed | `logDemographics` rejects | Login still succeeds |

### Architecture Compliance

- **Hexagonal Architecture:** AuthService depends on `IUserService` and `ITokenService` ports — never on concrete implementations
- **AD-5 (Single Active Session):** UPSERT ensures one refresh token per user; new login overwrites stale sessions
- **AD-10 (Demographics via UserService):** AuthService calls `UserService.logDemographics()`, never touches DemographicsRepository directly
- **AD-16 (Repository Ownership):** AuthService delegates to UserService and TokenService; does not access repositories
- **Security:** Password compared with bcrypt, never logged; refresh token hashed before DB storage

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4: Login Flow]
- [Source: _bmad-output/implementation-artifacts/implementation-docs/epic-4-login/README.md#Story 4.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#5.2 Login Flow]
- [Source: src/modules/auth/auth.service.ts (current implementation)]
- [Source: src/common/ports/token.port.ts (ITokenService interface)]
- [Source: src/common/ports/user.port.ts (IUserService interface)]
- [Source: src/shared/exceptions/authentication.exception.ts (InvalidCredentialsException)]
- [Source: src/shared/exceptions/authorization.exception.ts (UserBlockedException)]

### Previous Story Intelligence

From Story 3-5 (AuthService — Registration Logic):
- **Established pattern:** `register()` uses `Promise.all` for parallel lookups, `bcrypt.hash` with 12 salt rounds, `tokenService.generateTokenPair()` + manual hash + `tokenService.storeToken()` for token storage
- **Token storage flow:** Registration hashes the refresh token separately with `bcrypt.hash(tokens.refreshToken, 12)` before calling `storeToken` — follow same pattern in login if `generateTokenPair` does not handle storage internally
- **Error handling:** Throws `UserExistsException` for duplicates — login uses `InvalidCredentialsException` and `UserBlockedException`
- **Logging:** Uses `this.logger.log()` for success, `this.logger.warn()` for failures — follow same pattern
- **Tests:** Mock `userService` and `tokenService` with factory functions, use `jest.mock('bcrypt')` for hash mocking

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
