---
story_id: 3.5
story_key: 3-5-auth-service-registration
story_title: "AuthService — Registration Logic"
epic_num: 3
story_num: 5
status: ready-for-dev
created_date: 2025-07-15
---

# Story 3.5: AuthService — Registration Logic

## Story Summary
As a developer, I want the AuthService to handle user registration, so that new users can create accounts.

## User Story
**As a** developer,
**I want** the AuthService to handle user registration,
**So that** new users can create accounts.

## Acceptance Criteria

### Given a RegisterDto with valid data
- When `AuthService.register(dto)` is called
- Then it checks username uniqueness via `IUserService.findByUsername(dto.username)`
- And checks email uniqueness via `IUserService.findByEmail(dto.email)`
- And hashes the password with bcrypt (12 salt rounds)
- And creates the user via `IUserService.create()` in Transaction 1
- And generates a token pair via `ITokenService.generateTokenPair(user.id)`
- And stores the refresh token via `ITokenService.storeToken(user.id, tokenHash)` in Transaction 2
- And returns `{ accessToken, refreshToken }`

### Given a RegisterDto with existing username
- When `AuthService.register(dto)` is called
- Then it throws `UserExistsException` with message "User already exists with this username"

### Given a RegisterDto with existing email
- When `AuthService.register(dto)` is called
- Then it throws `UserExistsException` with message "User already exists with this email"

## Technical Requirements

### AuthService
- Implement the `IAuthService` port from `src/common/ports/auth.port.ts`
- This story covers only the `register` method
- `login`, `refresh`, and `logout` are covered in subsequent stories

### Interface (from Story 1.12)
```typescript
export interface IAuthService {
  register(dto: RegisterDto): Promise<TokenResponseDto>;
  login(dto: LoginDto): Promise<TokenResponseDto>;
  refresh(refreshToken: string): Promise<TokenResponseDto>;
  logout(userId: string): Promise<void>;
}
```

### RegisterDto (from Story 1.8)
```typescript
export const RegisterSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
```

### TokenResponseDto (from Story 1.9)
```typescript
export const TokenResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
});

export type TokenResponseDto = z.infer<typeof TokenResponseSchema>;
```

> **Note:** `TokenResponseDto` may need a `refreshToken` field added in Story 3-2. The registration flow should destructure whatever `generateTokenPair` returns. If the DTO does not yet include `refreshToken`, the return type must be updated accordingly.

### Registration Flow Logic
1. **Check uniqueness** — query `IUserService.findByUsername()` and `IUserService.findByEmail()` in parallel
2. **Reject duplicates** — if either exists, throw `UserExistsException`
3. **Hash password** — use `bcrypt.hash(dto.password, 12)`
4. **Create user (Transaction 1)** — call `IUserService.create({ ...dto, password: hashedPassword })` inside `createTransaction`
5. **Generate tokens** — call `ITokenService.generateTokenPair(user.id)` to get the token pair
6. **Store refresh token (Transaction 2)** — hash the refresh token with bcrypt, then call `ITokenService.storeToken(user.id, refreshTokenHash)` inside `createTransaction`
7. **Return** — return the `TokenResponseDto` from `generateTokenPair`

### UserExistsException
Already defined in `src/shared/exceptions/validation.exception.ts`:
```typescript
export class UserExistsException extends ValidationException {
  readonly errorCode = "VALIDATION_USER_EXISTS";

  constructor(message = "User already exists with this email") {
    super(message);
  }
}
```
- Extend the default message logic to cover both username and email duplicates
- Throw with `"User already exists with this username"` when username check fails first
- Throw with `"User already exists with this email"` when email check fails first

### Dependencies to Inject
- `IUserService` — user lookup and creation (`@Inject` via `USER_SERVICE` token or class injection)
- `ITokenService` — token generation and storage (`@Inject` via class injection)
- `IKeyManager` — key access if needed for token hashing (`@Inject` via `KEY_MANAGER` token)
- `DataSource` — TypeORM DataSource for `createTransaction` calls

### Transaction Pattern
Use the existing `createTransaction` utility from `src/shared/transaction/`:
```typescript
import { createTransaction } from '@/shared/transaction';

// Transaction 1: Create user
const user = await this.dataSource.transaction((trx) => {
  const userRepo = trx.getRepository(User);
  // ... create and save user
});

// Transaction 2: Store refresh token
await this.dataSource.transaction((trx) => {
  const tokenRepo = trx.getRepository(AuthToken);
  // ... store refresh token hash
});
```

### Password Hashing
- Use `bcrypt` (already in `package.json`: `bcrypt@^6.0.0`)
- Salt rounds: 12
- Hash the password before creating the user entity
- Hash the refresh token before storing it via `ITokenService.storeToken()`

### Error Handling
- Throw `UserExistsException` for duplicate username or email (status 400)
- Log registration attempts with structured logging (pino via NestJS Logger)
- Log duplicate user attempts at WARN level
- Let transaction failures propagate naturally (rolled back by `createTransaction`)

## Developer Context

### File Structure Requirements
```
src/
├── modules/
│   └── auth/
│       ├── auth.service.ts              # Service implementation (this story)
│       ├── auth.module.ts               # NestJS module (update with providers)
│       └── __tests__/
│           └── auth.service.spec.ts     # Unit tests
├── common/
│   └── ports/
│       ├── auth.port.ts                 # IAuthService interface (from Story 1.12)
│       ├── user.port.ts                 # IUserService interface (from Story 1.12)
│       ├── token.port.ts                # ITokenService interface (from Story 1.12)
│       └── key-manager.token.ts         # KEY_MANAGER injection token
├── shared/
│   ├── exceptions/
│   │   └── validation.exception.ts      # UserExistsException (already exists)
│   └── transaction/
│       └── index.ts                     # createTransaction utility (already exists)
└── modules/
    ├── user/
    │   └── user.entity.ts               # User entity (reference only)
    └── token/
        └── auth-token.entity.ts          # AuthToken entity (reference only)
```

### Implementation Details
- Use `import * as bcrypt from 'bcrypt'` for password hashing
- Use `@InjectRepository(User)` or inject `IUserService` port — follow hexagonal pattern, prefer port injection
- Use `Logger` from `@nestjs/common` for structured logging
- Use `createTransaction` from `@/shared/transaction` for transactional operations
- Keep the `register` method focused — single responsibility for registration flow
- Use `Promise.all` for parallel uniqueness checks (username + email)

### Service Skeleton
```typescript
import { Injectable, Logger, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { IAuthService } from '@/common/ports/auth.port';
import { IUserService } from '@/common/ports/user.port';
import { ITokenService } from '@/common/ports/token.port';
import { RegisterDto } from '@modules/auth/dto/register.dto';
import { TokenResponseDto } from '@modules/auth/dto/token-response.dto';
import { UserExistsException } from '@/shared/exceptions/validation.exception';
import { createTransaction } from '@/shared/transaction';
import { User } from '@modules/user/user.entity';
import { AuthToken } from '@modules/token/auth-token.entity';

@Injectable()
export class AuthService implements IAuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_SALT_ROUNDS = 12;

  constructor(
    private readonly userService: IUserService,
    private readonly tokenService: ITokenService,
    private readonly dataSource: DataSource,
  ) {}

  async register(dto: RegisterDto): Promise<TokenResponseDto> {
    // 1. Check uniqueness
    const [existingUsername, existingEmail] = await Promise.all([
      this.userService.findByUsername(dto.username),
      this.userService.findByEmail(dto.email),
    ]);

    if (existingUsername) {
      throw new UserExistsException('User already exists with this username');
    }
    if (existingEmail) {
      throw new UserExistsException('User already exists with this email');
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(dto.password, this.BCRYPT_SALT_ROUNDS);

    // 3. Create user (Transaction 1)
    const user = await createTransaction(this.dataSource, async (trx) => {
      const userRepo = trx.getRepository(User);
      const userRecord = userRepo.create({
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
      });
      return userRepo.save(userRecord);
    });

    this.logger.log(`User created: ${user.id}`);

    // 4. Generate token pair
    const tokens = await this.tokenService.generateTokenPair(user.id);

    // 5. Store refresh token (Transaction 2)
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, this.BCRYPT_SALT_ROUNDS);
    await this.tokenService.storeToken(user.id, refreshTokenHash);

    this.logger.log(`Registration complete for user: ${user.id}`);

    // 6. Return tokens
    return tokens;
  }

  async login(_dto: any): Promise<TokenResponseDto> {
    // Covered in Story 3-6
    throw new Error('Not implemented');
  }

  async refresh(_refreshToken: string): Promise<TokenResponseDto> {
    // Covered in Story 3-7
    throw new Error('Not implemented');
  }

  async logout(_userId: string): Promise<void> {
    // Covered in Story 3-8
    throw new Error('Not implemented');
  }
}
```

### Module Updates
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { TokenModule } from '../token/token.module';
import { User } from '../user/user.entity';
import { AuthToken } from '../token/auth-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AuthToken]),
    UserModule,
    TokenModule,
  ],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

## Architecture Compliance

### Hexagonal Architecture
- AuthService implements `IAuthService` port (from Story 1.12)
- Depends on `IUserService` and `ITokenService` ports — not concrete implementations
- Registration logic is domain-level (user creation + token generation)
- Implementation is swappable (e.g., could use a different auth flow)

### Security Considerations
- Password is hashed with bcrypt (12 salt rounds) before storage
- Refresh token is hashed before storage via `ITokenService.storeToken()`
- Raw password is never logged
- Uniqueness checks prevent duplicate account creation
- Transactional operations ensure data consistency

### Module Boundaries
- AuthService belongs to AuthModule
- AuthModule imports UserModule (for user creation) and TokenModule (for token generation)
- AuthService depends on ports, not concrete implementations
- No direct database access outside of transactions

## Testing Requirements

### Unit Tests (`src/modules/auth/__tests__/auth.service.spec.ts`)
- Test happy path: register with valid data returns `TokenResponseDto`
- Test that `findByUsername` and `findByEmail` are called with correct arguments
- Test that `bcrypt.hash` is called with 12 salt rounds for password
- Test that `createTransaction` is called for user creation
- Test that `generateTokenPair` is called with the created user's ID
- Test that `storeToken` is called with user ID and hashed refresh token
- Test duplicate username: throws `UserExistsException` with correct message
- Test duplicate email: throws `UserExistsException` with correct message
- Test that `createTransaction` is NOT called when user already exists
- Test that `generateTokenPair` is NOT called when user already exists

### Mock Strategy
- Mock `IUserService` — provide fake `findByUsername`, `findByEmail`, `create`
- Mock `ITokenService` — provide fake `generateTokenPair`, `storeToken`
- Mock `DataSource` — return mock query runner for transaction tests
- Mock `bcrypt` — control hash output for deterministic tests
- Use `jest.fn()` for all mocked methods

### Test Configuration
- Use Jest for unit testing
- Mock all external dependencies in `beforeEach`
- Use `jest.spyOn` for bcrypt mocking
- Verify transaction callbacks are called correctly

## Dependencies

### Epic Dependencies
- Story 1.8: RegisterDto (validation schema)
- Story 1.9: TokenResponseDto
- Story 1.12: Service Interfaces (`IAuthService`, `IUserService`, `ITokenService`)
- Story 2.2: KeyManager Service (if needed for key operations)
- Story 3-4: UserService CRUD (`IUserService.create`, `findByUsername`, `findByEmail`)
- Story 3-1 through 3-3: TokenService (generateTokenPair, storeToken)

### External Dependencies
- `bcrypt@^6.0.0` — password hashing (already in `package.json`)
- `@nestjs/common` — Injectable, Logger decorators
- `typeorm` — DataSource for transactions
- `@nestjs/config` — ConfigService (optional, for salt rounds config)

## Checklist

- [ ] Create `AuthService` class implementing `IAuthService`
- [ ] Inject `IUserService`, `ITokenService`, and `DataSource`
- [ ] Implement `register(dto)` method
- [ ] Add parallel uniqueness checks for username and email
- [ ] Throw `UserExistsException` for duplicates
- [ ] Hash password with bcrypt (12 salt rounds)
- [ ] Create user in Transaction 1 via `createTransaction`
- [ ] Generate token pair via `ITokenService.generateTokenPair`
- [ ] Hash refresh token and store in Transaction 2 via `ITokenService.storeToken`
- [ ] Return `TokenResponseDto`
- [ ] Add structured logging for registration flow
- [ ] Implement stub methods for `login`, `refresh`, `logout` (throw "Not implemented")
- [ ] Update `AuthModule` with providers and imports
- [ ] Create unit tests with mocked dependencies
- [ ] Test happy path registration flow
- [ ] Test duplicate username/email error cases
- [ ] Verify transaction isolation (user creation + token storage)
- [ ] Run lint and typecheck

---

*Story created using bmad-create-story workflow*
*Status: ready-for-dev*
*Next: Developer will implement AuthService registration logic*
