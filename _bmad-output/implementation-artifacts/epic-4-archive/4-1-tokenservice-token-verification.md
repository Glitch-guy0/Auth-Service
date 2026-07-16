---
story_id: 4.1
story_key: 4-1-tokenservice-token-verification
story_title: "TokenService — Token Verification"
epic_num: 4
story_num: 1
status: review
created_date: 2026-07-16
---

# Story 4.1: TokenService — Token Verification

## Story Summary
As a developer, I want the TokenService to verify JWT access tokens, so that protected endpoints can validate requests.

## User Story
**As a** developer,
**I want** the TokenService to verify JWT access tokens,
**So that** protected endpoints can validate requests.

## Acceptance Criteria

### Given a signed JWT
- When `TokenService.verifyAccessToken(token)` is called
- Then it verifies the signature using the public key from KeyManager
- And checks expiry
- And returns the decoded `JwtPayload`

### Given an invalid JWT
- When `TokenService.verifyAccessToken(token)` is called
- Then it throws the appropriate exception (`TokenInvalidSignatureException` or `TokenExpiredException`)

## Technical Requirements

### TokenService
- Implement the `ITokenService` port from `src/common/ports/token.port.ts`
- This story covers `verifyAccessToken` method — the public method responsible for JWT verification
- `generateTokenPair` and `storeToken` are covered in previous stories (3-2, 3-3)

### Interface (from Story 1.12)
```typescript
export interface ITokenService {
  generateTokenPair(userId: string): Promise<TokenResponseDto>;
  storeToken(userId: string, tokenHash: string): Promise<void>;
  verifyAccessToken(token: string): Promise<JwtPayload>;
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

### Token Verification Logic
1. Extract the `kid` from the JWT header to identify which public key to use
2. Retrieve the public key via `IKeyManager.getPublicKey(kid)`
3. Verify the JWT signature using `jose.jwtVerify` with the public key
4. Check expiry (handled by `jose.jwtVerify` automatically)
5. Return the decoded `JwtPayload` on success
6. Throw appropriate exceptions on failure:
   - `TokenInvalidSignatureException` if signature verification fails
   - `TokenExpiredException` if token is expired

### Exception Hierarchy (from Story 1.13)
```typescript
// Base exception
export class BaseAuthException extends Error { ... }

// Authentication exceptions (401)
export class AuthenticationException extends BaseAuthException { ... }
export class TokenExpiredException extends AuthenticationException { ... }
export class TokenInvalidSignatureException extends AuthenticationException { ... }
export class TokenRevokedException extends AuthenticationException { ... }
```

### Error Handling
- Throw `TokenInvalidSignatureException` when JWT signature is invalid
- Throw `TokenExpiredException` when JWT has expired
- Throw `TokenInvalidSignatureException` for other verification failures (malformed token, missing header, etc.)
- Log verification attempts with structured logging (pino via NestJS Logger)
- Do NOT log the actual token value (security)

## Developer Context

### File Structure Requirements
```
src/
├── modules/
│   └── token/
│       ├── token.service.ts              # Service implementation (update)
│       ├── token.module.ts               # NestJS module (already exists)
│       ├── auth-token.entity.ts          # Entity (already exists, untouched)
│       └── __tests__/
│           └── token.service.spec.ts     # Unit tests (update)
├── common/
│   └── ports/
│       ├── token.port.ts                 # ITokenService interface (from Story 1.12)
│       └── key-manager.token.ts          # KEY_MANAGER injection token
├── types/
│   └── jwt.types.ts                      # JwtPayload interface
└── exceptions/
    └── authentication.exception.ts       # TokenInvalidSignatureException, TokenExpiredException
```

### Implementation Details
- Use `jose` library (already installed: `jose@^6.2.3`) for JWT verification
- Use `import { jwtVerify, importSPKI } from 'jose'` for verification operations
- Use `@Inject(KEY_MANAGER)` to inject `IKeyManager` via NestJS DI
- Use `Logger` from `@nestjs/common` for structured logging
- The `verifyAccessToken` method should be `public` — it's part of the public API

### Service Skeleton
```typescript
import { Injectable, Logger, Inject } from '@nestjs/common';
import { jwtVerify, importSPKI } from 'jose';
import { ITokenService } from '@/common/ports/token.port';
import { IKeyManager } from '@/common/ports/key-manager.port';
import { KEY_MANAGER } from '@/common/ports/key-manager.token';
import { JwtPayload } from '@/types/jwt.types';
import { TokenResponseDto } from '@modules/auth/dto/token-response.dto';
import { TokenInvalidSignatureException, TokenExpiredException } from '@/exceptions/authentication.exception';

@Injectable()
export class TokenService implements ITokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly algorithm = 'RS256';

  constructor(
    @Inject(KEY_MANAGER) private readonly keyManager: IKeyManager,
  ) {}

  async generateTokenPair(userId: string): Promise<TokenResponseDto> {
    // Covered in Story 3-2
    throw new Error('Not implemented');
  }

  async storeToken(_userId: string, _tokenHash: string): Promise<void> {
    // Covered in Story 3-3
    throw new Error('Not implemented');
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      // Extract kid from JWT header
      const [, headerBase64] = token.split('.');
      const header = JSON.parse(Buffer.from(headerBase64, 'base64url').toString());
      const kid = header.kid;

      if (!kid) {
        throw new TokenInvalidSignatureException('Missing kid in JWT header');
      }

      // Retrieve public key for this kid
      const publicKey = await this.keyManager.getPublicKey(kid);
      if (!publicKey) {
        throw new TokenInvalidSignatureException('Public key not found for kid');
      }

      // Import public key and verify JWT
      const publicKeyObject = await importSPKI(publicKey, this.algorithm);
      const { payload } = await jwtVerify(token, publicKeyObject, {
        algorithms: [this.algorithm],
      });

      this.logger.debug(`Access token verified for user ${payload.sub}`);
      return payload as unknown as JwtPayload;
    } catch (error) {
      if (error instanceof TokenInvalidSignatureException || error instanceof TokenExpiredException) {
        throw error;
      }

      // Handle jose-specific errors
      if (error.name === 'JWTExpired') {
        throw new TokenExpiredException('Token has expired');
      }

      if (error.name === 'JWTClaimValidationFailed' || error.name === 'JWSSignatureVerificationFailed') {
        throw new TokenInvalidSignatureException('Invalid token signature');
      }

      // Generic verification failure
      throw new TokenInvalidSignatureException('Token verification failed');
    }
  }
}
```

### Exception Classes
```typescript
// src/exceptions/authentication.exception.ts
import { BaseAuthException } from './base-auth.exception';

export class AuthenticationException extends BaseAuthException {
  constructor(message: string, errorCode: string = 'AUTH_ERROR') {
    super(message, 401, errorCode);
  }
}

export class TokenExpiredException extends AuthenticationException {
  constructor(message: string = 'Token has expired') {
    super(message, 'TOKEN_EXPIRED');
  }
}

export class TokenInvalidSignatureException extends AuthenticationException {
  constructor(message: string = 'Invalid token signature') {
    super(message, 'TOKEN_INVALID_SIGNATURE');
  }
}

export class TokenRevokedException extends AuthenticationException {
  constructor(message: string = 'Token has been revoked') {
    super(message, 'TOKEN_REVOKED');
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
- Verification logic is domain-level (JWT validation)
- Implementation is swappable (e.g., could use a different verification library)

### Security Considerations
- Public key is fetched transiently via `getPublicKey(kid)` — not stored in service
- Do NOT log the actual token value (security)
- Verify signature before checking other claims
- Use RS256 for broad compatibility; PS256 is an alternative for higher security
- The `kid` header allows for key rotation support

### Module Boundaries
- TokenService belongs to TokenModule
- TokenModule imports KeyManagerModule for key access
- No direct dependency on auth or user modules

## Testing Requirements

### Unit Tests (`src/modules/token/__tests__/token.service.spec.ts`)
- Test that `verifyAccessToken` returns a valid `JwtPayload` for a signed JWT
- Test that `verifyAccessToken` throws `TokenInvalidSignatureException` for invalid signature
- Test that `verifyAccessToken` throws `TokenExpiredException` for expired token
- Test that `verifyAccessToken` throws `TokenInvalidSignatureException` for malformed token
- Test that `verifyAccessToken` throws `TokenInvalidSignatureException` for missing kid
- Test that `verifyAccessToken` calls `getPublicKey` with the correct kid
- Test that `verifyAccessToken` uses the correct algorithm (RS256)
- Test that `generateTokenPair` and `storeToken` still throw "Not implemented"

### Mock Strategy
- Mock `IKeyManager` — provide fake `getPublicKey()` returning a test RSA public key
- Generate a test RSA key pair at test setup for signing/verification in tests
- Use `jose.SignJWT` to create test tokens for verification tests
- Mock `ConfigService` if needed for configuration values

### Test Configuration
- Use Jest for unit testing
- Generate test RSA keys using `jose.generateKeyPair` in `beforeAll`
- Use `jose.SignJWT` to create test tokens with known payloads
- Use `jose.jwtVerify` to verify that verification works correctly

### Test Cases
```typescript
describe('TokenService', () => {
  describe('verifyAccessToken', () => {
    it('should return JwtPayload for valid signed JWT', async () => {
      // Create a signed JWT with known payload
      // Call verifyAccessToken
      // Expect payload to match
    });

    it('should throw TokenInvalidSignatureException for invalid signature', async () => {
      // Create a JWT signed with wrong key
      // Call verifyAccessToken
      // Expect TokenInvalidSignatureException
    });

    it('should throw TokenExpiredException for expired token', async () => {
      // Create an expired JWT
      // Call verifyAccessToken
      // Expect TokenExpiredException
    });

    it('should throw TokenInvalidSignatureException for malformed token', async () => {
      // Pass malformed token string
      // Call verifyAccessToken
      // Expect TokenInvalidSignatureException
    });

    it('should throw TokenInvalidSignatureException for missing kid', async () => {
      // Create JWT without kid header
      // Call verifyAccessToken
      // Expect TokenInvalidSignatureException
    });

    it('should call getPublicKey with correct kid', async () => {
      // Create JWT with specific kid
      // Call verifyAccessToken
      // Verify getPublicKey was called with that kid
    });
  });
});
```

## Dependencies

### Epic Dependencies
- Story 1.12: Service Interfaces (`ITokenService` interface)
- Story 2.2: KeyManager Service (`IKeyManager` implementation, `KEY_MANAGER` token)
- Story 3-1: TokenService JWT Generation (for understanding JWT structure)

### External Dependencies
- `jose@^6.2.3` — JWT verification (already in `package.json`)
- `@nestjs/common` — Injectable, Logger, Inject decorators

## Checklist

- [x] Update `TokenService` to implement `verifyAccessToken` method
- [x] Inject `IKeyManager` via `KEY_MANAGER` token
- [x] Implement `verifyAccessToken(token)` public method
- [x] Extract `kid` from JWT header
- [x] Retrieve public key via `keyManager.getPublicKey(kid)`
- [x] Use `jose.jwtVerify` with RS256 algorithm for verification
- [x] Handle `jose` errors and map to appropriate exceptions
- [x] Throw `TokenInvalidSignatureException` for signature failures
- [x] Throw `TokenExpiredException` for expired tokens
- [x] Return decoded `JwtPayload` on success
- [x] Add structured logging for verification attempts (without token value)
- [x] Create `TokenInvalidSignatureException` and `TokenExpiredException` classes
- [x] Update exception hierarchy imports if needed
- [x] Create unit tests with mocked KeyManager
- [x] Test valid token verification returns correct payload
- [x] Test invalid signature throws correct exception
- [x] Test expired token throws correct exception
- [x] Test malformed token throws correct exception
- [x] Test missing kid throws correct exception
- [x] Verify `generateTokenPair` and `storeToken` still throw "Not implemented"
- [x] Run lint and typecheck

---

*Story created using bmad-create-story workflow*
*Status: ready-for-dev*
*Next: Developer will implement TokenService token verification*