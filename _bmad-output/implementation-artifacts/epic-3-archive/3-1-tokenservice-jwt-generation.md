---
story_id: 3.1
story_key: 3-1-tokenservice-jwt-generation
story_title: "TokenService — JWT Generation"
epic_num: 3
story_num: 1
status: ready-for-dev
created_date: 2025-07-15
---

# Story 3.1: TokenService — JWT Generation

## Story Summary
As a developer, I want the TokenService to generate RSA-signed JWT access tokens, so that authentication tokens are cryptographically secure.

## User Story
**As a** developer,
**I want** the TokenService to generate RSA-signed JWT access tokens,
**So that** authentication tokens are cryptographically secure.

## Acceptance Criteria

### Given KeyManager is configured
- When `TokenService.generateAccessToken(user)` is called
- Then it creates a JWT with payload: `sub` (user_id), `iat`, `iss`, `kid`, `exp`
- And signs it with the RSA private key via `jose.SignJWT`
- And returns the signed JWT string

## Technical Requirements

### TokenService
- Implement the `ITokenService` port from `src/common/ports/token.port.ts`
- This story covers only `generateAccessToken` — the private method responsible for access token creation
- `generateTokenPair`, `storeToken`, and `verifyAccessToken` are covered in subsequent stories

### Interface (from Story 1.12)
```typescript
export interface ITokenService {
  generateTokenPair(userId: string): Promise<TokenResponseDto>;
  storeToken(userId: string, tokenHash: string): Promise<void>;
  verifyAccessToken(token: string): Promise<{ userId: string }>;
}
```

### JWT Payload Shape (from `src/types/jwt.types.ts`)
```typescript
export interface JwtPayload {
  sub: string;    // user_id
  iat: number;    // issued at (unix timestamp)
  iss: string;    // issuer (from env/config)
  kid: string;    // key id (from KeyManager)
  exp: number;    // expiry (unix timestamp)
}
```

### JWT Generation Logic
1. Retrieve the private key via `IKeyManager.getPrivateKey()`
2. Retrieve the current `kid` from `IKeyManager.getPublicKey()` or from a config/env value
3. Build the JWT payload with `sub`, `iat`, `iss`, `kid`, `exp`
4. Sign using `jose.SignJWT` with RS256 algorithm
5. Return the compact serialized JWT string

### Configuration
- `iss` (issuer) value from environment or config (e.g., `AUTH_SERVICE_ISSUER`)
- `exp` (expiry) from config (e.g., access token TTL, default 15 minutes)
- Algorithm: `RS256` (RSA PKCS#1 v1.5 SHA-256)

### Error Handling
- Throw error if private key cannot be retrieved from KeyManager
- Throw error if signing fails
- Log errors with structured logging (pino via NestJS Logger)

## Developer Context

### File Structure Requirements
```
src/
├── modules/
│   └── token/
│       ├── token.service.ts              # Service implementation (this story)
│       ├── token.module.ts               # NestJS module (already exists, update)
│       ├── auth-token.entity.ts          # Entity (already exists, untouched)
│       └── __tests__/
│           └── token.service.spec.ts     # Unit tests
├── common/
│   └── ports/
│       ├── token.port.ts                 # ITokenService interface (from Story 1.12)
│       └── key-manager.token.ts          # KEY_MANAGER injection token
└── types/
    └── jwt.types.ts                      # JwtPayload interface
```

### Implementation Details
- Use `jose` library (already installed: `jose@^6.2.3`) for JWT signing
- Use `import { SignJWT, importPKCS8 } from 'jose'` for signing operations
- Use `@Inject(KEY_MANAGER)` to inject `IKeyManager` via NestJS DI
- Use `@Inject(CONFIG_SERVICE)` or NestJS `ConfigService` for issuer and expiry config
- Keep `generateAccessToken` as a `private` method — public API is `generateTokenPair`
- Use `Logger` from `@nestjs/common` for structured logging

### Service Skeleton
```typescript
import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, importPKCS8 } from 'jose';
import { ITokenService } from '@/common/ports/token.port';
import { IKeyManager } from '@/common/ports/key-manager.port';
import { KEY_MANAGER } from '@/common/ports/key-manager.token';
import { JwtPayload } from '@/types/jwt.types';
import { TokenResponseDto } from '@modules/auth/dto/token-response.dto';

@Injectable()
export class TokenService implements ITokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly algorithm = 'RS256';

  constructor(
    @Inject(KEY_MANAGER) private readonly keyManager: IKeyManager,
    private readonly configService: ConfigService,
  ) {}

  async generateTokenPair(userId: string): Promise<TokenResponseDto> {
    // Covered in Story 3-2
    throw new Error('Not implemented');
  }

  async storeToken(_userId: string, _tokenHash: string): Promise<void> {
    // Covered in Story 3-3
    throw new Error('Not implemented');
  }

  async verifyAccessToken(_token: string): Promise<{ userId: string }> {
    // Covered in Story 3-4
    throw new Error('Not implemented');
  }

  private async generateAccessToken(userId: string): Promise<string> {
    const privateKey = await this.keyManager.getPrivateKey();
    const kid = this.configService.get<string>('KEY_KID', 'default');
    const issuer = this.configService.get<string>('AUTH_SERVICE_ISSUER', 'auth-service');
    const expiresIn = this.configService.get<number>('ACCESS_TOKEN_EXPIRY_SECONDS', 900);

    const privateKeyObject = await importPKCS8(privateKey, this.algorithm);

    const payload: JwtPayload = {
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      iss: issuer,
      kid,
      exp: Math.floor(Date.now() / 1000) + expiresIn,
    };

    const jwt = await new SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: this.algorithm, kid })
      .setIssuedAt(payload.iat)
      .setExpirationTime(payload.exp)
      .setIssuer(payload.iss)
      .setSubject(payload.sub)
      .sign(privateKeyObject);

    this.logger.debug(`Access token generated for user ${userId}`);
    return jwt;
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

## Architecture Compliance

### Hexagonal Architecture
- TokenService implements `ITokenService` port (from Story 1.12)
- Depends on `IKeyManager` port — does not depend on concrete KeyManager implementation
- Signing logic is domain-level (JWT generation)
- Implementation is swappable (e.g., could use a different signing library)

### Security Considerations
- Private key is fetched transiently via `getPrivateKey()` — not stored in service
- Private key is cleared from memory by KeyManager after use (Story 2-2)
- `kid` header is set on JWT for key rotation support
- Use RS256 for broad compatibility; PS256 is an alternative for higher security

### Module Boundaries
- TokenService belongs to TokenModule
- TokenModule imports KeyManagerModule for key access
- No direct dependency on auth or user modules

## Testing Requirements

### Unit Tests (`src/modules/token/__tests__/token.service.spec.ts`)
- Test that `generateAccessToken` produces a valid JWT string (3 dot-separated parts)
- Test that JWT payload contains correct `sub`, `iss`, `kid` fields
- Test that JWT `exp` is set to current time + configured expiry
- Test that JWT `iat` is set to current time
- Test that JWT is signed with RS256 algorithm
- Test that calling `getPrivateKey` on KeyManager is invoked
- Test error handling when `getPrivateKey` throws
- Test that `generateTokenPair`, `storeToken`, `verifyAccessToken` throw "Not implemented"

### Mock Strategy
- Mock `IKeyManager` — provide fake `getPrivateKey()` returning a test RSA private key
- Mock `ConfigService` — return configured `iss`, `kid`, and expiry values
- Generate a test RSA key pair at test setup for signing/verification in tests
- Use `jose.jwtVerify` with the test public key to verify generated tokens

### Test Configuration
- Use Jest for unit testing
- Generate test RSA keys using `jose.generateKeyPair` in `beforeAll`
- Mock ConfigService with `configServiceMock` factory

## Dependencies

### Epic Dependencies
- Story 1.12: Service Interfaces (`ITokenService` interface)
- Story 2.2: KeyManager Service (`IKeyManager` implementation, `KEY_MANAGER` token)

### External Dependencies
- `jose@^6.2.3` — JWT creation and signing (already in `package.json`)
- `@nestjs/config` — ConfigService for issuer/expiry values
- `@nestjs/common` — Injectable, Logger, Inject decorators

## Checklist

- [ ] Create `TokenService` class implementing `ITokenService`
- [ ] Inject `IKeyManager` via `KEY_MANAGER` token
- [ ] Inject `ConfigService` for issuer and expiry configuration
- [ ] Implement `generateAccessToken(userId)` private method
- [ ] Use `jose.SignJWT` with RS256 algorithm for signing
- [ ] Set JWT payload fields: `sub`, `iat`, `iss`, `kid`, `exp`
- [ ] Set JWT protected header with `alg` and `kid`
- [ ] Return compact serialized JWT string
- [ ] Add structured logging for token generation
- [ ] Update `TokenModule` to import `KeyManagerModule` and provide `TokenService`
- [ ] Create unit tests with mocked KeyManager and ConfigService
- [ ] Verify generated JWT is valid and correctly signed
- [ ] Test error cases (key retrieval failure, signing failure)
- [ ] Run lint and typecheck

---

*Story created using bmad-create-story workflow*
*Status: ready-for-dev*
*Next: Developer will implement TokenService JWT generation*
