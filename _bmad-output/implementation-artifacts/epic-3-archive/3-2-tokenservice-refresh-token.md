---
story_id: 3.2
story_key: 3-2-tokenservice-refresh-token
story_title: "TokenService — Refresh Token"
epic_num: 3
story_num: 2
status: ready-for-dev
created_date: 2025-07-15
---

# Story 3.2: TokenService — Refresh Token

## Story Summary
As a developer, I want the TokenService to generate and hash refresh tokens, so that refresh token rotation works.

## User Story
**As a** developer,
**I want** the TokenService to generate and hash refresh tokens,
**So that** refresh token rotation works.

## Acceptance Criteria

### Given TokenService is configured
- When `TokenService.generateRefreshToken()` is called
- Then it generates a cryptographically random token using `crypto.randomBytes`
- And hashes it with bcrypt (cost factor 10)
- And returns both the raw token (for cookie) and hash (for DB) as `{ rawToken: string, tokenHash: string }`

## Technical Requirements

### TokenService
- Implement `generateRefreshToken` as a **private** method on `TokenService` (from Story 3-1)
- This story covers only `generateRefreshToken` — token pair assembly (`generateTokenPair`) is covered in Story 3-3
- Token storage (`storeToken`) is covered in Story 3-4
- Token verification (`verifyAccessToken`) is covered in Story 3-5

### Interface Reference (from Story 1.12)
```typescript
export interface ITokenService {
  generateTokenPair(userId: string): Promise<TokenResponseDto>;
  storeToken(userId: string, tokenHash: string): Promise<void>;
  verifyAccessToken(token: string): Promise<{ userId: string }>;
}
```

Note: `generateRefreshToken` is a private implementation detail, not exposed on the port interface.

### Return Type
```typescript
interface RefreshTokenResult {
  rawToken: string;   // Token to send to client via cookie (hex-encoded)
  tokenHash: string;  // Bcrypt hash to store in database
}
```

### Refresh Token Generation Logic
1. Generate 64 random bytes via `crypto.randomBytes(64)`
2. Convert to hex string — this is the `rawToken`
3. Hash the `rawToken` with bcrypt (cost factor 10) — this is the `tokenHash`
4. Return `{ rawToken, tokenHash }`

### Configuration
- `REFRESH_TOKEN_BYTES`: Number of random bytes to generate (default: 64)
- `BCRYPT_SALT_ROUNDS`: Bcrypt cost factor (default: 10)

### Error Handling
- Throw error if `crypto.randomBytes` fails
- Throw error if bcrypt hashing fails
- Log errors with structured logging (pino via NestJS Logger)

## Developer Context

### File Structure Requirements
```
src/
├── modules/
│   └── token/
│       ├── token.service.ts              # Service implementation (extend from Story 3-1)
│       ├── token.module.ts               # NestJS module (update from Story 3-1)
│       ├── auth-token.entity.ts          # Entity (already exists, untouched)
│       └── __tests__/
│           └── token.service.spec.ts     # Unit tests (extend from Story 3-1)
├── common/
│   └── ports/
│       ├── token.port.ts                 # ITokenService interface (from Story 1.12)
│       └── key-manager.token.ts          # KEY_MANAGER injection token
└── types/
    └── jwt.types.ts                      # JwtPayload interface
```

### Implementation Details
- Use `crypto.randomBytes` from Node.js `crypto` module for cryptographic randomness
- Use `bcrypt.hash` from `bcrypt` library (already in `package.json`) for hashing
- Use `import * as crypto from 'crypto'` and `import * as bcrypt from 'bcrypt'`
- Keep `generateRefreshToken` as a `private` method — public API is `generateTokenPair`
- Use `Logger` from `@nestjs/common` for structured logging
- Hex-encode the random bytes for a clean string token

### Service Skeleton
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { ITokenService } from '@/common/ports/token.port';
import { TokenResponseDto } from '@modules/auth/dto/token-response.dto';

interface RefreshTokenResult {
  rawToken: string;
  tokenHash: string;
}

@Injectable()
export class TokenService implements ITokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly configService: ConfigService,
  ) {}

  async generateTokenPair(userId: string): Promise<TokenResponseDto> {
    // Covered in Story 3-3
    throw new Error('Not implemented');
  }

  async storeToken(_userId: string, _tokenHash: string): Promise<void> {
    // Covered in Story 3-4
    throw new Error('Not implemented');
  }

  async verifyAccessToken(_token: string): Promise<{ userId: string }> {
    // Covered in Story 3-5
    throw new Error('Not implemented');
  }

  private async generateAccessToken(userId: string): Promise<string> {
    // Implemented in Story 3-1
    throw new Error('Not implemented');
  }

  private async generateRefreshToken(): Promise<RefreshTokenResult> {
    const bytes = this.configService.get<number>('REFRESH_TOKEN_BYTES', 64);
    const saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS', 10);

    const rawToken = crypto.randomBytes(bytes).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, saltRounds);

    this.logger.debug('Refresh token generated');
    return { rawToken, tokenHash };
  }
}
```

### Module Updates
```typescript
import { Module } from '@nestjs/common';
import { TokenService } from './token.service';
import { KeyManagerModule } from '../key/key-manager.module';

@Module({
  imports: [KeyManagerModule],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}
```

Note: Module may already be configured from Story 3-1; only add if not yet present.

## Architecture Compliance

### Hexagonal Architecture
- TokenService implements `ITokenService` port (from Story 1.12)
- `generateRefreshToken` is a private implementation detail — not exposed on the port
- Refresh token generation is domain-level logic (security-critical randomness)
- Implementation is swappable (e.g., could use a different hash library)

### Security Considerations
- Use `crypto.randomBytes` for cryptographically secure randomness (CSPRNG)
- 64 bytes = 512 bits of entropy — well above minimum for token security
- Bcrypt cost factor 10 balances security with performance (~100ms per hash)
- Raw token is returned to caller for cookie; only hash is persisted to DB
- If DB is compromised, raw tokens cannot be recovered from bcrypt hashes

### Module Boundaries
- TokenService belongs to TokenModule
- TokenModule imports KeyManagerModule for key access (from Story 3-1)
- No direct dependency on auth or user modules

## Testing Requirements

### Unit Tests (`src/modules/token/__tests__/token.service.spec.ts`)
- Test that `generateRefreshToken` returns an object with `rawToken` and `tokenHash` keys
- Test that `rawToken` is a hex string of expected length (64 bytes = 128 hex chars)
- Test that `rawToken` is different on each call (randomness check)
- Test that `tokenHash` is a valid bcrypt hash (starts with `$2b$` or `$2a$`)
- Test that `tokenHash` is different from `rawToken` (hashing actually happened)
- Test that `rawToken` can be verified against `tokenHash` using `bcrypt.compare`
- Test that `generateTokenPair`, `storeToken`, `verifyAccessToken` throw "Not implemented"
- Test error handling when `crypto.randomBytes` fails (mock to throw)
- Test error handling when `bcrypt.hash` fails (mock to throw)
- Test configurable bytes and salt rounds via ConfigService

### Mock Strategy
- Mock `ConfigService` — return configured byte count and salt rounds
- Mock `crypto.randomBytes` — inject known buffer for deterministic tests
- Mock `bcrypt.hash` — inject known hash value for deterministic tests
- Use real `bcrypt.compare` to verify hash matches raw token in integration-style assertions

### Test Configuration
- Use Jest for unit testing
- Mock `crypto` and `bcrypt` modules with `jest.mock`
- Use `configServiceMock` factory from Story 3-1

### Test Skeleton
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '../token.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

jest.mock('crypto');
jest.mock('bcrypt');

describe('TokenService - generateRefreshToken', () => {
  let service: TokenService;
  let configServiceMock: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    configServiceMock = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          REFRESH_TOKEN_BYTES: 64,
          BCRYPT_SALT_ROUNDS: 10,
        };
        return config[key] ?? defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    (crypto.randomBytes as jest.Mock).mockReturnValue(
      Buffer.from('a'.repeat(64)),
    );
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashedvalue');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get(TokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return rawToken and tokenHash', async () => {
    const result = await (service as any).generateRefreshToken();
    expect(result).toHaveProperty('rawToken');
    expect(result).toHaveProperty('tokenHash');
  });

  it('should return hex-encoded rawToken of expected length', async () => {
    const result = await (service as any).generateRefreshToken();
    expect(result.rawToken).toMatch(/^[0-9a-f]{128}$/);
  });

  it('should call crypto.randomBytes with configured byte count', async () => {
    await (service as any).generateRefreshToken();
    expect(crypto.randomBytes).toHaveBeenCalledWith(64);
  });

  it('should call bcrypt.hash with rawToken and configured salt rounds', async () => {
    const result = await (service as any).generateRefreshToken();
    expect(bcrypt.hash).toHaveBeenCalledWith(result.rawToken, 10);
  });

  it('should return tokenHash from bcrypt.hash', async () => {
    const result = await (service as any).generateRefreshToken();
    expect(result.tokenHash).toBe('$2b$10$hashedvalue');
  });

  it('should generate different tokens on each call', async () => {
    (crypto.randomBytes as jest.Mock)
      .mockReturnValueOnce(Buffer.from('a'.repeat(64)))
      .mockReturnValueOnce(Buffer.from('b'.repeat(64)));

    const result1 = await (service as any).generateRefreshToken();
    const result2 = await (service as any).generateRefreshToken();
    expect(result1.rawToken).not.toBe(result2.rawToken);
  });

  it('should throw when crypto.randomBytes fails', async () => {
    (crypto.randomBytes as jest.Mock).mockImplementation(() => {
      throw new Error('entropy exhausted');
    });
    await expect((service as any).generateRefreshToken()).rejects.toThrow(
      'entropy exhausted',
    );
  });

  it('should throw when bcrypt.hash fails', async () => {
    (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('hash failed'));
    await expect((service as any).generateRefreshToken()).rejects.toThrow(
      'hash failed',
    );
  });

  it('should throw "Not implemented" for generateTokenPair', async () => {
    await expect(service.generateTokenPair('user-id')).rejects.toThrow(
      'Not implemented',
    );
  });

  it('should throw "Not implemented" for storeToken', async () => {
    await expect(service.storeToken('user-id', 'hash')).rejects.toThrow(
      'Not implemented',
    );
  });

  it('should throw "Not implemented" for verifyAccessToken', async () => {
    await expect(service.verifyAccessToken('token')).rejects.toThrow(
      'Not implemented',
    );
  });
});
```

## Dependencies

### Epic Dependencies
- Story 1.12: Service Interfaces (`ITokenService` interface)
- Story 3-1: TokenService JWT Generation (service skeleton, module setup, test structure)

### External Dependencies
- `bcrypt@^5.x` — password/token hashing (already in `package.json`)
- `crypto` — Node.js built-in module for cryptographic randomness
- `@nestjs/config` — ConfigService for byte count and salt rounds
- `@nestjs/common` — Injectable, Logger decorators

## Checklist

- [ ] Add `RefreshTokenResult` interface to `token.service.ts`
- [ ] Implement `generateRefreshToken()` private method
- [ ] Use `crypto.randomBytes` to generate cryptographically random token
- [ ] Hex-encode random bytes for clean string token
- [ ] Hash raw token with `bcrypt.hash(rawToken, saltRounds)`
- [ ] Return `{ rawToken, tokenHash }` object
- [ ] Add structured logging for refresh token generation
- [ ] Add configurable `REFRESH_TOKEN_BYTES` and `BCRYPT_SALT_ROUNDS` via ConfigService
- [ ] Extend unit tests in `token.service.spec.ts` with refresh token tests
- [ ] Test randomness (different tokens on each call)
- [ ] Test hash verification with `bcrypt.compare`
- [ ] Test error cases (crypto failure, bcrypt failure)
- [ ] Test "Not implemented" stubs still throw for other methods
- [ ] Run lint and typecheck

---

*Story created using bmad-create-story workflow*
*Status: ready-for-dev*
*Next: Developer will implement TokenService refresh token generation*
