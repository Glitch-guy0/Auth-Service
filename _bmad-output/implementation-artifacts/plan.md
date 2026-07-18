# Implementation Plan: Codebase Restructuring

## Current State

```
src/
├── common/ports/          ← interfaces (ports) + DI tokens
├── shared/
│   ├── exceptions/
│   ├── interceptors/
│   ├── logging/
│   ├── transaction/
│   ├── types/
│   └── utils/
├── types/                 ← app-level types (jwt, api-response, keys)
└── modules/
```

## Target State

```
src/
├── shared/
│   ├── utils/
│   ├── lib/
│   │   ├── interfaces/   ← renamed from common/ports
│   │   └── types/        ← moved from src/types
│   ├── exceptions/
│   ├── interceptors/
│   ├── logging/
│   └── transaction/
└── modules/
```

## Path Aliases

No config change needed — `@shared/*` already maps to `src/shared/*` in both `tsconfig.json` and `jest.moduleNameMapper`.

---

## Phase 1: Create Directory Structure

```bash
mkdir -p src/shared/lib/interfaces
mkdir -p src/shared/lib/types
```

---

## Phase 2: Move & Rename Files

### 2.1 — Ports → Interfaces

```bash
mv src/common/ports/auth.port.ts        src/shared/lib/interfaces/auth.interface.ts
mv src/common/ports/user.port.ts        src/shared/lib/interfaces/user.interface.ts
mv src/common/ports/token.port.ts       src/shared/lib/interfaces/token.interface.ts
mv src/common/ports/key-manager.port.ts src/shared/lib/interfaces/key-manager.interface.ts
mv src/common/ports/key-manager.token.ts src/shared/lib/interfaces/key-manager.token.ts
mv src/common/ports/token.token.ts      src/shared/lib/interfaces/token.token.ts
mv src/common/ports/user.token.ts       src/shared/lib/interfaces/user.token.ts
```

### 2.2 — Types → lib/types

```bash
mv src/types/jwt.types.ts         src/shared/lib/types/jwt.types.ts
mv src/types/api-response.types.ts src/shared/lib/types/api-response.types.ts
mv src/types/keys.types.ts        src/shared/lib/types/keys.types.ts
```

### 2.3 — Create barrel exports

`src/shared/lib/interfaces/index.ts`:
```typescript
export { IAuthService } from './auth.interface';
export { IUserService } from './user.interface';
export { ITokenService } from './token.interface';
export { IKeyManager } from './key-manager.interface';
export { KEY_MANAGER } from './key-manager.token';
export { TOKEN_SERVICE } from './token.token';
export { USER_SERVICE } from './user.token';
```

`src/shared/lib/types/index.ts`:
```typescript
export { JwtPayload } from './jwt.types';
export { SuccessResponse, ErrorDetail, ErrorResponse, ApiResponse } from './api-response.types';
export { KeyMetadata, KeyPair } from './keys.types';
```

### 2.4 — Remove old directories

```bash
rm -rf src/common
rm -rf src/types
```

---

## Phase 3: Per-File Import Updates

### 3.1 — Source files (11 files)

#### `src/modules/auth/auth.service.ts`

```
L3:  import { IAuthService } from '../../common/ports/auth.port';
L4:  import { IUserService } from '../../common/ports/user.port';
L5:  import { ITokenService } from '../../common/ports/token.port';
L9:  import { UserExistsException } from '../../shared/exceptions/validation.exception';
L10-13: import { InvalidCredentialsException, TokenExpiredException } from '../../shared/exceptions/authentication.exception';
L14: import { UserBlockedException } from '../../shared/exceptions/authorization.exception';
L15: import { USER_SERVICE } from '../../common/ports/user.token';
L16: import { TOKEN_SERVICE } from '../../common/ports/token.token';
```

Replace with:
```typescript
import { IAuthService } from '@shared/lib/interfaces/auth.interface';
import { IUserService } from '@shared/lib/interfaces/user.interface';
import { ITokenService } from '@shared/lib/interfaces/token.interface';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { UserExistsException } from '@shared/exceptions/validation.exception';
import {
  InvalidCredentialsException,
  TokenExpiredException,
} from '@shared/exceptions/authentication.exception';
import { UserBlockedException } from '@shared/exceptions/authorization.exception';
import { USER_SERVICE } from '@shared/lib/interfaces/user.token';
import { TOKEN_SERVICE } from '@shared/lib/interfaces/token.token';
```

---

#### `src/modules/auth/auth.controller.ts`

```
L26: import { AuthenticationException } from '../../shared/exceptions/authentication.exception';
```

Replace with:
```typescript
import { AuthenticationException } from '@shared/exceptions/authentication.exception';
```

---

#### `src/modules/auth/guards/jwt-auth.guard.ts`

```
L9:  import { ITokenService } from '../../../common/ports/token.port';
L10: import { TOKEN_SERVICE } from '../../../common/ports/token.token';
```

Replace with:
```typescript
import { ITokenService } from '@shared/lib/interfaces/token.interface';
import { TOKEN_SERVICE } from '@shared/lib/interfaces/token.token';
import { RedisService } from '../../redis/redis.service';
import type { AuthenticatedRequest } from '../auth.middleware';
```

---

#### `src/modules/token/token.service.ts`

```
L8:  import { ITokenService } from '../../common/ports/token.port';
L9:  import { IKeyManager } from '../../common/ports/key-manager.port';
L10: import { KEY_MANAGER } from '../../common/ports/key-manager.token';
L11: import { JwtPayload } from '../../types/jwt.types';
L14-17: import { TokenInvalidSignatureException, TokenExpiredException } from '../../shared/exceptions/authentication.exception';
```

Replace with:
```typescript
import { ITokenService } from '@shared/lib/interfaces/token.interface';
import { IKeyManager } from '@shared/lib/interfaces/key-manager.interface';
import { KEY_MANAGER } from '@shared/lib/interfaces/key-manager.token';
import { JwtPayload } from '@shared/lib/types/jwt.types';
import { TokenResponseDto } from '../auth/dto/token-response.dto';
import { AuthToken } from './auth-token.entity';
import {
  TokenInvalidSignatureException,
  TokenExpiredException,
} from '@shared/exceptions/authentication.exception';
```

---

#### `src/modules/token/token.module.ts`

```
L6: import { TOKEN_SERVICE } from '../../common/ports/token.token';
```

Replace with:
```typescript
import { TOKEN_SERVICE } from '@shared/lib/interfaces/token.token';
```

---

#### `src/modules/key/key-manager.service.ts`

```
L2: import { IKeyManager } from '../../common/ports/key-manager.port';
```

Replace with:
```typescript
import { IKeyManager } from '@shared/lib/interfaces/key-manager.interface';
```

---

#### `src/modules/key/key.module.ts`

```
L3: import { KEY_MANAGER } from '../../common/ports/key-manager.token';
```

Replace with:
```typescript
import { KEY_MANAGER } from '@shared/lib/interfaces/key-manager.token';
```

---

#### `src/modules/user/user.service.ts`

```
L6: import { IUserService } from '../../common/ports/user.port';
```

Replace with:
```typescript
import { IUserService } from '@shared/lib/interfaces/user.interface';
```

---

#### `src/modules/user/user.module.ts`

```
L5: import { USER_SERVICE } from '../../common/ports/user.token';
```

Replace with:
```typescript
import { USER_SERVICE } from '@shared/lib/interfaces/user.token';
```

---

#### `src/modules/logging/demographics.service.ts`

```
L3: import { geoLookup } from '../../shared/utils/geo-lookup';
```

Replace with:
```typescript
import { geoLookup } from '@shared/utils/geo-lookup';
```

---

#### `src/scripts/setup-keys.ts`

```
L6: import { KeyPair } from '../types/keys.types';
```

Replace with:
```typescript
import { KeyPair } from '@shared/lib/types/keys.types';
```

---

### 3.2 — Test files (6 files)

#### `src/modules/auth/__tests__/auth.service.spec.ts`

```
L13: import { USER_SERVICE } from '../../../common/ports/user.token';
L14: import { TOKEN_SERVICE } from '../../../common/ports/token.token';
```

Replace with:
```typescript
import { USER_SERVICE } from '@shared/lib/interfaces/user.token';
import { TOKEN_SERVICE } from '@shared/lib/interfaces/token.token';
```

---

#### `src/modules/auth/__tests__/auth.controller.spec.ts`

```
L8:  import { UserExistsException } from '../../../shared/exceptions/validation.exception';
L9-12: import { InvalidCredentialsException, TokenExpiredException, AuthenticationException } from '../../../shared/exceptions/authentication.exception';
L14: import { UserBlockedException } from '../../../shared/exceptions/authorization.exception';
```

Replace with:
```typescript
import { UserExistsException } from '@shared/exceptions/validation.exception';
import {
  InvalidCredentialsException,
  TokenExpiredException,
  AuthenticationException,
} from '@shared/exceptions/authentication.exception';
import { UserBlockedException } from '@shared/exceptions/authorization.exception';
```

---

#### `src/modules/auth/guards/__tests__/jwt-auth.guard.spec.ts`

```
L4:  import { ITokenService } from '../../../../common/ports/token.port';
L5:  import { TOKEN_SERVICE } from '../../../../common/ports/token.token';
L7-10: import { TokenInvalidSignatureException, TokenExpiredException } from '../../../../shared/exceptions/authentication.exception';
```

Replace with:
```typescript
import { ITokenService } from '@shared/lib/interfaces/token.interface';
import { TOKEN_SERVICE } from '@shared/lib/interfaces/token.token';
import { RedisService } from '../../../redis/redis.service';
import {
  TokenInvalidSignatureException,
  TokenExpiredException,
} from '@shared/exceptions/authentication.exception';
```

---

#### `src/modules/token/__tests__/token.service.spec.ts`

```
L14: import { IKeyManager } from '../../../common/ports/key-manager.port';
L15: import { KEY_MANAGER } from '../../../common/ports/key-manager.token';
L19-22: import { TokenInvalidSignatureException, TokenExpiredException } from '../../../shared/exceptions/authentication.exception';
```

Replace with:
```typescript
import { IKeyManager } from '@shared/lib/interfaces/key-manager.interface';
import { KEY_MANAGER } from '@shared/lib/interfaces/key-manager.token';
import { AuthToken } from '../auth-token.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  TokenInvalidSignatureException,
  TokenExpiredException,
} from '@shared/exceptions/authentication.exception';
```

---

#### `src/modules/key/__tests__/key-manager.service.spec.ts`

No import changes needed — this file only imports from its own module (`../key-manager.service`).

---

#### `src/modules/user/__tests__/user.service.spec.ts`

No import changes needed — this file only imports from its own module and sibling modules.

---

## Phase 4: JSDoc Updates

### Token files — add JSDoc

```typescript
// key-manager.token.ts
/** DI token for injecting IKeyManager implementation. */
export const KEY_MANAGER = Symbol('KEY_MANAGER');

// token.token.ts
/** DI token for injecting ITokenService implementation. */
export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

// user.token.ts
/** DI token for injecting IUserService implementation. */
export const USER_SERVICE = Symbol('USER_SERVICE');
```

### Interface files — verify existing JSDoc

| File | Status |
|------|--------|
| `auth.interface.ts` | ✅ Fully documented |
| `user.interface.ts` | ✅ Fully documented |
| `token.interface.ts` | ✅ Fully documented |
| `key-manager.interface.ts` | ✅ Fully documented |

---

## Phase 5: Update Architecture Docs

In `docs/architecture.md` update section 2 "Port Interfaces":

| Line | Old | New |
|------|-----|-----|
| 26 | `src/common/ports/` | `src/shared/lib/interfaces/` |
| 30 | `src/common/ports/auth.port.ts` | `src/shared/lib/interfaces/auth.interface.ts` |
| 31 | `src/common/ports/user.port.ts` | `src/shared/lib/interfaces/user.interface.ts` |
| 32 | `src/common/ports/token.port.ts` | `src/shared/lib/interfaces/token.interface.ts` |
| 33 | `src/common/ports/key-manager.port.ts` | `src/shared/lib/interfaces/key-manager.interface.ts` |

---

## Phase 6: Verify

```bash
npx tsc --noEmit        # TypeScript compiles
npm test                 # Tests pass
npm run build           # Build succeeds
npm run lint            # Lint passes
```

---

## Summary: All Affected Files

| # | File | Change Type |
|---|------|-------------|
| 1 | `src/shared/lib/interfaces/index.ts` | **NEW** — barrel export |
| 2 | `src/shared/lib/types/index.ts` | **NEW** — barrel export |
| 3 | `src/modules/auth/auth.service.ts` | 8 imports updated |
| 4 | `src/modules/auth/auth.controller.ts` | 1 import updated |
| 5 | `src/modules/auth/guards/jwt-auth.guard.ts` | 2 imports updated |
| 6 | `src/modules/token/token.service.ts` | 5 imports updated |
| 7 | `src/modules/token/token.module.ts` | 1 import updated |
| 8 | `src/modules/key/key-manager.service.ts` | 1 import updated |
| 9 | `src/modules/key/key.module.ts` | 1 import updated |
| 10 | `src/modules/user/user.service.ts` | 1 import updated |
| 11 | `src/modules/user/user.module.ts` | 1 import updated |
| 12 | `src/modules/logging/demographics.service.ts` | 1 import updated |
| 13 | `src/scripts/setup-keys.ts` | 1 import updated |
| 14 | `src/modules/auth/__tests__/auth.service.spec.ts` | 2 imports updated |
| 15 | `src/modules/auth/__tests__/auth.controller.spec.ts` | 3 imports updated |
| 16 | `src/modules/auth/guards/__tests__/jwt-auth.guard.spec.ts` | 3 imports updated |
| 17 | `src/modules/token/__tests__/token.service.spec.ts` | 3 imports updated |
| 18 | `docs/architecture.md` | 5 path references updated |

**Total: 16 source/test files + 1 doc file + 2 new barrel files = 19 file operations**
