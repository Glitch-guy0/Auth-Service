---
story_id: 3.3
story_key: 3-3-tokenservice-token-storage
story_title: "TokenService — Token Storage"
epic_num: 3
story_num: 3
status: ready-for-dev
created_date: 2025-07-15
---

# Story 3.3: TokenService — Token Storage

## Story Summary
As a developer, I want the TokenService to store refresh tokens in the database, so that refresh tokens can be validated on use.

## User Story
**As a** developer,
**I want** the TokenService to store refresh tokens in the database,
**So that** refresh tokens can be validated on use.

## Acceptance Criteria

### Given a user_id and token_hash
- When `TokenService.storeToken(user_id, token_hash, expires_at)` is called
- Then it inserts a row into `auth_tokens`
- And uses UPSERT (`INSERT ... ON CONFLICT (user_id) DO UPDATE`)

## Technical Requirements

### TokenService
- Implement the `ITokenService` port from `src/common/ports/token.port.ts`
- This story covers only the `storeToken` method
- `generateAccessToken` is covered in Story 3-1, `generateTokenPair` in Story 3-2, `verifyAccessToken` in Story 3-4

### Port Update Required
The current `ITokenService` interface signature for `storeToken` must be updated to include `expiresAt`:

```typescript
// Current (from Story 1.12)
storeToken(userId: string, tokenHash: string): Promise<void>;

// Updated for this story
storeToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
```

### AuthToken Entity (from `src/modules/token/auth-token.entity.ts`)
```typescript
@Entity('auth_tokens')
export class AuthToken {
  @PrimaryColumn({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 255 })
  token_hash!: string;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
```

### UPSERT SQL
Use `QueryBuilder` for raw UPSERT SQL:

```sql
INSERT INTO auth_tokens (user_id, token_hash, expires_at)
VALUES ($1, $2, $3)
ON CONFLICT (user_id)
DO UPDATE SET
  token_hash = EXCLUDED.token_hash,
  expires_at = EXCLUDED.expires_at,
  updated_at = NOW()
```

### storeToken Implementation
1. Inject `Repository<AuthToken>` via `@InjectRepository(AuthToken)`
2. Use `this.authTokenRepository.createQueryBuilder()` to build the UPSERT query
3. Execute the raw SQL with the provided parameters
4. Return `Promise<void>`

### Implementation Skeleton
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ITokenService } from '@/common/ports/token.port';
import { AuthToken } from './auth-token.entity';
import { TokenResponseDto } from '@modules/auth/dto/token-response.dto';

@Injectable()
export class TokenService implements ITokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    @InjectRepository(AuthToken)
    private readonly authTokenRepository: Repository<AuthToken>,
  ) {}

  async generateTokenPair(userId: string): Promise<TokenResponseDto> {
    // Covered in Story 3-2
    throw new Error('Not implemented');
  }

  async storeToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.authTokenRepository
      .createQueryBuilder()
      .insert()
      .into(AuthToken)
      .values({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .onConflict('user_id')
      .orUpdate(['token_hash', 'expires_at', 'updated_at'], 'NOW()')
      .execute();

    this.logger.debug(`Token stored for user ${userId}`);
  }

  async verifyAccessToken(_token: string): Promise<{ userId: string }> {
    // Covered in Story 3-4
    throw new Error('Not implemented');
  }
}
```

### Module Updates
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenService } from './token.service';
import { AuthToken } from './auth-token.entity';
import { KeyManagerModule } from '../key/key-manager.module';

@Module({
  imports: [TypeOrmModule.forFeature([AuthToken]), KeyManagerModule],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}
```

## Developer Context

### File Structure Requirements
```
src/
├── modules/
│   └── token/
│       ├── token.service.ts              # Service implementation (this story)
│       ├── token.module.ts               # NestJS module (update imports)
│       ├── auth-token.entity.ts          # Entity (already exists, untouched)
│       └── __tests__/
│           └── token.service.spec.ts     # Unit tests
├── common/
│   └── ports/
│       └── token.port.ts                 # ITokenService interface (update storeToken signature)
```

### Configuration
- No additional configuration required for this story
- Database connection is handled by TypeORM module registration in the app root

### Error Handling
- Let TypeORM propagate database errors naturally (constraint violations, connection failures)
- Log successful token storage with structured logging (pino via NestJS Logger)
- Log errors with structured logging on failure

## Architecture Compliance

### Hexagonal Architecture
- TokenService implements `ITokenService` port (from Story 1.12)
- Depends on `Repository<AuthToken>` — TypeORM infrastructure adapter
- Storage logic is infrastructure-level (database UPSERT)
- Implementation is swappable (e.g., could use a different ORM or raw SQL)

### Security Considerations
- `token_hash` is stored (not plaintext token) — hash computed upstream by caller
- UPSERT ensures one active refresh token per user (replaces old token on rotation)
- `expires_at` is stored to enable expiry validation without token decoding

### Module Boundaries
- TokenService belongs to TokenModule
- TokenModule imports TypeOrmModule for AuthToken repository access
- TokenModule imports KeyManagerModule for key access (from Story 3-1)

## Testing Requirements

### Unit Tests (`src/modules/token/__tests__/token.service.spec.ts`)

#### storeToken Tests
- Test that `storeToken` executes an INSERT when no conflict exists
- Test that `storeToken` executes an UPDATE when `user_id` already exists (upsert behavior)
- Test that the correct `token_hash` and `expires_at` values are passed to the query
- Test that the UPSERT query targets the `auth_tokens` table
- Test that `updated_at` is set to `NOW()` on conflict update
- Test that `storeToken` returns `void` (no return value)

#### Mock Strategy
- Mock `Repository<AuthToken>` — stub `createQueryBuilder` to return a chainable query builder mock
- Use `jest.fn()` for each method in the query builder chain: `insert`, `into`, `values`, `onConflict`, `orUpdate`, `execute`
- Verify that `execute` is called with the correct UPSERT structure
- Mock `Logger` to verify debug logging

#### Test Configuration
- Use Jest for unit testing
- Create a `createQueryBuilderMock` factory that returns a chainable mock object
- Each chain method returns the mock object itself for fluent chaining
- `execute` resolves to `void`

### Test Skeleton
```typescript
import { TokenService } from '../token.service';
import { AuthToken } from '../auth-token.entity';
import { Repository } from 'typeorm';

describe('TokenService', () => {
  let service: TokenService;
  let authTokenRepo: jest.Mocked<Repository<AuthToken>>;

  const createQueryBuilderMock = () => {
    const mock: any = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflict: jest.fn().mockReturnThis(),
      orUpdate: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    return mock;
  };

  beforeEach(() => {
    authTokenRepo = {
      createQueryBuilder: jest.fn(),
    } as any;

    service = new TokenService(authTokenRepo);
  });

  describe('storeToken', () => {
    it('should execute UPSERT with correct parameters', async () => {
      const qbMock = createQueryBuilderMock();
      authTokenRepo.createQueryBuilder.mockReturnValue(qbMock);

      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const tokenHash = 'abc123hash';
      const expiresAt = new Date('2025-08-15T00:00:00Z');

      await service.storeToken(userId, tokenHash, expiresAt);

      expect(authTokenRepo.createQueryBuilder).toHaveBeenCalled();
      expect(qbMock.insert).toHaveBeenCalled();
      expect(qbMock.into).toHaveBeenCalledWith(AuthToken);
      expect(qbMock.values).toHaveBeenCalledWith({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });
      expect(qbMock.onConflict).toHaveBeenCalledWith('user_id');
      expect(qbMock.orUpdate).toHaveBeenCalledWith(
        ['token_hash', 'expires_at', 'updated_at'],
        'NOW()',
      );
      expect(qbMock.execute).toHaveBeenCalled();
    });

    it('should return void', async () => {
      const qbMock = createQueryBuilderMock();
      authTokenRepo.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.storeToken(
        '550e8400-e29b-41d4-a716-446655440000',
        'hash',
        new Date(),
      );

      expect(result).toBeUndefined();
    });

    it('should propagate database errors from execute', async () => {
      const qbMock = createQueryBuilderMock();
      qbMock.execute.mockRejectedValue(new Error('DB connection failed'));
      authTokenRepo.createQueryBuilder.mockReturnValue(qbMock);

      await expect(
        service.storeToken('user-id', 'hash', new Date()),
      ).rejects.toThrow('DB connection failed');
    });
  });
});
```

## Dependencies

### Epic Dependencies
- Story 1.12: Service Interfaces (`ITokenService` interface)
- Story 3-1: TokenService JWT Generation (constructor, module structure)

### External Dependencies
- `@nestjs/typeorm` — TypeORM integration for NestJS (already in `package.json`)
- `typeorm` — QueryBuilder and Repository (already in `package.json`)
- `@nestjs/common` — Injectable, Logger decorators

## Checklist

- [ ] Update `ITokenService.storeToken` signature to include `expiresAt: Date` parameter
- [ ] Inject `Repository<AuthToken>` via `@InjectRepository(AuthToken)`
- [ ] Implement `storeToken(userId, tokenHash, expiresAt)` with QueryBuilder UPSERT
- [ ] Use `onConflict('user_id').orUpdate(...)` for upsert behavior
- [ ] Set `updated_at = NOW()` on conflict
- [ ] Return `Promise<void>`
- [ ] Add structured logging for token storage
- [ ] Update `TokenModule` to import `TypeOrmModule.forFeature([AuthToken])`
- [ ] Create unit tests with mocked Repository and QueryBuilder
- [ ] Verify UPSERT query chain calls are correct
- [ ] Test error propagation from database layer
- [ ] Run lint and typecheck

---

*Story created using bmad-create-story workflow*
*Status: ready-for-dev*
*Next: Developer will implement TokenService token storage*
