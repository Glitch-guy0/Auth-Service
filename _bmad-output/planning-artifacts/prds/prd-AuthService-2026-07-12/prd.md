---
title: AuthService
created: 2026-07-12
updated: 2026-07-12
status: final
version: 1.0
---

# PRD: AuthService
*Production-Ready Authentication Service*

---

## 0. Document Purpose

This PRD defines the complete feature set and milestone plan for AuthService — a scalable, production-ready authentication service built with NestJS. It is intended for:

- **Product Manager**: Feature prioritization and milestone planning
- **Development Team**: Implementation roadmap and acceptance criteria
- **Stakeholders**: Project scope and timeline visibility

The document references existing architecture and technical documentation in `_bmad-output/planning-artifacts/`. Features are grouped by milestones with clear acceptance criteria for production readiness.

---

## 1. Vision

AuthService is a scalable authentication service built with NestJS, following hexagonal architecture principles. The system supports:

- **Simple Auth**: Username/password authentication with JWT tokens
- **Production Ready**: Proper development setup, documentation, and deployment scripts
- **Scalable Design**: Hexagonal architecture for future OAuth provider support

**Why It Matters:**
- Provides a secure, production-ready authentication foundation
- Enables future OAuth consumer/provider integration without major refactoring
- Follows industry best practices for security and scalability

---

## 2. Target User

### 2.1 Jobs To Be Done

- **As a developer**, I need a reliable authentication service so that I can secure my applications without building auth from scratch
- **As a system administrator**, I need proper deployment scripts and documentation so that I can deploy and maintain the service in production
- **As a product owner**, I need a scalable auth solution so that I can add OAuth providers in the future without major refactoring

### 2.2 Non-Users (v1)

- **End users**: This is a backend service, not a user-facing application
- **Mobile apps**: v1 focuses on web/HTTP API; mobile SDK is future work
- **Enterprise SSO**: SAML/enterprise SSO is not in scope for v1

---

## 3. Glossary

- **JWT** — JSON Web Token; compact, URL-safe means of representing claims between two parties
- **Access Token** — Short-lived JWT (1 day) used to authenticate API requests
- **Refresh Token** — Long-lived token (1 week) stored in httpOnly cookie, used to obtain new access tokens
- **Blacklist** — Redis-based revocation list for access tokens (keyed by token JTI)
- **Hexagonal Architecture** — Ports and adapters pattern; core domain logic isolated from infrastructure
- **Module Lifecycle** — `setup()` → `run()` → `shutdown()` pattern for NestJS modules
- **Key Management** — RSA key pair generation and storage for JWT signing

---

## 4. Features

### 4.1 Core Authentication

**Description:** Fundamental authentication capabilities including user registration, login, logout, and token management. This is the foundation of the entire service.

**Functional Requirements:**

#### FR-1: User Registration

System can create new user accounts with username, email, and password.

**Consequences (testable):**
- System returns HTTP 201 with access token on successful registration
- System returns HTTP 400 with error code `AUTH_USER_EXISTS` if username or email already exists
- Password is hashed with bcrypt (cost=10) before storage

#### FR-2: User Login

System can authenticate users with username/email and password.

**Consequences (testable):**
- System returns HTTP 200 with access token on successful login
- System returns HTTP 401 with error code `AUTH_INVALID_CREDENTIALS` on invalid credentials
- Refresh token is set in httpOnly cookie

#### FR-3: Token Refresh

System can issue new access tokens using refresh tokens.

**Consequences (testable):**
- System returns HTTP 200 with new access token
- Old refresh token is deleted from DB (rotation)
- New refresh token is set in httpOnly cookie

#### FR-4: User Logout

System can invalidate tokens and clear sessions.

**Consequences (testable):**
- Access token is added to Redis blacklist (TTL = token expiry)
- Refresh token is deleted from DB
- Refresh token cookie is cleared

---

### 4.2 Token Management

**Description:** JWT token generation, signing, rotation, and key management for secure authentication.

**Functional Requirements:**

#### FR-5: JWT Token Generation

System generates RSA-signed JWT access tokens.

**Consequences (testable):**
- Token contains: sub (user_id), role, iat, iss, kid, exp
- Token is signed with RSA private key from keys.json
- Token expiry is configurable (default: 1 day)

#### FR-6: Refresh Token Rotation

System rotates refresh tokens on each use.

**Consequences (testable):**
- Old refresh token is deleted from DB
- New refresh token is generated and stored
- Refresh token is bcrypt hashed in DB

#### FR-7: Key Management

System manages RSA key pairs for JWT signing.

**Consequences (testable):**
- `npm run setup:keys` generates key pair
- Private key stored in keys.json (chmod 600)
- Public key stored in keys.json and PostgreSQL
- Private key is cleared from memory after each use

---

### 4.3 Security Hardening

**Description:** Security features to protect against common attacks and ensure production readiness.

**Functional Requirements:**

#### FR-8: Rate Limiting

System limits request rate per IP/endpoint.

**Consequences (testable):**
- System returns HTTP 429 when rate limit exceeded
- Rate limits configurable per endpoint
- Default: 100 requests/minute for auth endpoints

#### FR-9: Password Reset

System supports secure password reset flow.

**Consequences (testable):**
- System generates reset token (1 hour expiry)
- Reset token is bcrypt hashed in DB
- Password is updated on valid reset token

#### FR-10: Email Verification

System verifies user email addresses.

**Consequences (testable):**
- System generates verification token on registration
- User is marked as verified after token validation
- Unverified users have limited access

#### FR-11: Input Validation

System validates all input data.

**Consequences (testable):**
- System rejects invalid email formats
- System enforces password strength requirements
- System sanitizes input to prevent injection attacks

#### FR-12: Security Headers

System sets appropriate security headers.

**Consequences (testable):**
- CORS headers configured properly
- Content-Security-Policy headers set
- X-Content-Type-Options: nosniff

---

### 4.4 User Management

**Description:** User account management, profile operations, and user lifecycle.

**Functional Requirements:**

#### FR-13: User Entity

System maintains user records with required fields.

**Consequences (testable):**
- User has: id (UUID), username, email, password, blocked, is_verified, created_at, updated_at
- Username and email are unique
- Password is bcrypt hashed

#### FR-14: User Lookup

System can find users by email or username.

**Consequences (testable):**
- System returns user by email (unique)
- System returns user by username (unique)
- System supports login with either email or username

#### FR-15: User Blocking

System can block/unblock user accounts.

**Consequences (testable):**
- Blocked users cannot login
- Blocked users receive HTTP 403 with error code `AUTH_USER_BLOCKED`

---

### 4.5 Logging & Observability

**Description:** Structured logging for debugging, auditing, and monitoring.

**Functional Requirements:**

#### FR-16: Structured Logging

System logs structured events with levels.

**Consequences (testable):**
- System uses pino + chalk for console output
- Log levels: debug, info, warn, error, fatal
- Fatal errors trigger graceful shutdown

#### FR-17: Request Logging

System logs HTTP requests and responses.

**Consequences (testable):**
- System logs method, path, status code, duration
- System logs request ID for tracing
- Sensitive data (passwords, tokens) are redacted

#### FR-18: User Demographics Logging

System logs user demographics to MongoDB.

**Consequences (testable):**
- System logs: user_id, last_ip, location (country, city)
- Logs are written asynchronously
- MongoDB connection is optional (graceful fallback)

---

### 4.6 Development Experience

**Description:** Developer tooling, documentation, and setup scripts for productive development.

**Functional Requirements:**

#### FR-19: Development Setup

System provides easy development setup.

**Consequences (testable):**
- `npm install` installs all dependencies
- `npm run setup:keys` generates key pair
- `npm run start:dev` starts development server
- `.env.example` provides environment template

#### FR-20: Documentation

System has comprehensive documentation.

**Consequences (testable):**
- README.md with quick start guide
- Architecture documentation in docs/
- API reference in technical-documentation.md
- JSDoc comments in source code

#### FR-21: Testing

System has unit and integration tests.

**Consequences (testable):**
- `npm run test` runs unit tests
- `npm run test:e2e` runs integration tests
- Test coverage reports available

#### FR-22: Build & Deployment

System has production build and deployment scripts.

**Consequences (testable):**
- `npm run build` creates production build
- `npm run start:prod` starts production server
- Docker Compose configuration provided
- Production checklist documented

---

### 4.7 Database Architecture

**Description:** Database schema, migrations, and data management.

**Functional Requirements:**

#### FR-23: PostgreSQL Schema

System maintains core data in PostgreSQL.

**Consequences (testable):**
- Tables: users, user_tokens, refresh_token_keys
- UUID primary keys (gen_random_uuid())
- Proper indexes on unique columns
- Foreign key constraints enforced

#### FR-24: MongoDB Collection

System logs demographics to MongoDB.

**Consequences (testable):**
- Collection: user_demographics
- Fields: user_id, last_ip, location
- Optional connection (graceful fallback)

#### FR-25: Redis Cache

System uses Redis for token blacklisting.

**Consequences (testable):**
- Pattern: `blacklist:{jti}` → `{expires_at, user_id}`
- TTL set to token expiry
- Automatic cleanup on expiry

---

## 5. Non-Goals (Explicit)

- **SSO/SAML**: Enterprise single sign-on is not in scope for v1
- **Mobile SDK**: Native mobile authentication libraries are future work
- **Multi-factor Authentication**: MFA is not required for v1
- **Social Login**: OAuth social login (Google, GitHub) is Phase 4
- **Multi-tenancy**: Single-tenant deployment only for v1
- **Real-time Events**: WebSocket-based real-time notifications are out of scope

---

## 6. MVP Scope

### 6.1 In Scope

**Phase 1: Core Auth (MVP)**
- User registration and login
- JWT access tokens with RSA signing
- Refresh token rotation with httpOnly cookies
- Token blacklisting with Redis
- PostgreSQL user storage
- Basic logging with pino

**Phase 2: Security Hardening**
- Rate limiting
- Password reset flow
- Email verification
- Input validation
- Security headers

**Phase 3: Admin & Analytics**
- RBAC (admin/user/client roles)
- Admin endpoints
- Analytics dashboard
- User demographics logging

**Phase 4: OAuth (Future)**
- OAuth consumer (Google, GitHub)
- OAuth provider capability
- SSO client library

### 6.2 Out of Scope for MVP

- **Social Login** (Phase 4): Deferred to avoid complexity in initial launch
- **MFA** (Phase 4): Security enhancement for later
- **Mobile SDK** (Phase 5): Native libraries require separate project
- **Multi-tenancy** (Phase 5): Single-tenant simplifies initial deployment
- **Real-time Events** (Phase 5): WebSocket infrastructure is separate concern

---

## 7. Success Metrics

**Primary:**
- **SM-1**: Authentication success rate > 99.9% — validates FR-1, FR-2, FR-3
- **SM-2**: Token refresh success rate > 99.9% — validates FR-3, FR-6
- **SM-3**: Setup time < 5 minutes — validates FR-19

**Secondary:**
- **SM-4**: Documentation coverage 100% — validates FR-20
- **SM-5**: Test coverage > 80% — validates FR-21
- **SM-6**: Zero critical security vulnerabilities — validates FR-8, FR-9, FR-11

**Counter-metrics (do not optimize):**
- **SM-C1**: Response time — do not sacrifice security for speed
- **SM-C2**: Token expiry — do not extend expiry for convenience

---

## 8. Resolved Decisions

1. **ORM Choice**: TypeORM — mature, good NestJS integration, supports PostgreSQL UUID
2. **Email Service**: None for v1 — password reset will use in-memory tokens only
3. **Deployment Target**: Self-hosted — Docker Compose configuration
4. **Monitoring**: Console logging only (pino + chalk) — no external monitoring for v1

---

## 9. Assumptions

1. **ASSUMPTION**: PostgreSQL 16+ is available for core data storage
2. **ASSUMPTION**: MongoDB 7+ is available for logging (optional)
3. **ASSUMPTION**: Redis 7+ is available for token blacklisting
4. **ASSUMPTION**: Node.js 22.x LTS is the target runtime
5. **ASSUMPTION**: Single-instance deployment for v1 (multi-instance is future)
6. **ASSUMPTION**: HTTPS is terminated at load balancer/reverse proxy

---

## 10. Milestone Plan

### Milestone 1: Foundation (Day 1-2)
**Goal:** Project setup and core infrastructure

**Features:**
- Project scaffolding (NestJS)
- Environment management (.env validation)
- Key management (setup script)
- PostgreSQL schema and migrations
- Basic module structure

**Acceptance Criteria:**
- `npm install` works
- `npm run setup:keys` generates keys
- `npm run start:dev` starts server
- Database connection established
- All modules have setup/run/shutdown lifecycle

---

### Milestone 2: Core Auth (Day 3-5)
**Goal:** Working authentication flows

**Features:**
- User registration (FR-1)
- User login (FR-2)
- Token refresh (FR-3)
- User logout (FR-4)
- JWT generation (FR-5)
- Refresh token rotation (FR-6)

**Acceptance Criteria:**
- POST /auth/v1/register creates user and returns tokens
- POST /auth/v1/authenticate returns tokens
- POST /auth/v1/refresh rotates tokens
- POST /auth/v1/logout blacklists token
- Unit tests pass for all endpoints

---

### Milestone 3: Security (Day 6-7)
**Goal:** Production security hardening

**Features:**
- Rate limiting (FR-8)
- Password reset (FR-9) — token-based, no email
- Input validation (FR-11)
- Security headers (FR-12)

**Acceptance Criteria:**
- Rate limit returns HTTP 429
- Password reset flow works end-to-end (token displayed in response)
- Invalid input rejected with proper errors
- Security headers present on all responses

---

### Milestone 4: Admin & Analytics (Day 8-9)
**Goal:** Administrative capabilities

**Features:**
- RBAC implementation (admin/user/client)
- Admin endpoints
- User demographics logging (FR-18)
- Basic analytics

**Acceptance Criteria:**
- Role-based access control works
- Admin can manage users
- Demographics logged to MongoDB
- Admin endpoints protected

---

### Milestone 5: Documentation & Deployment (Day 10)
**Goal:** Production readiness

**Features:**
- Documentation (FR-20)
- Testing (FR-21)
- Build & deployment (FR-22)
- Docker Compose
- Production checklist

**Acceptance Criteria:**
- README.md complete
- Architecture docs complete
- All tests pass
- Docker build works
- Production deployment tested

---

## 11. Technical Architecture

### 11.1 Exception Handling Strategy

**Global Exception Filter:**

```typescript
// src/shared/filters/http-exception.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = this.getHttpStatus(exception);
    const errorResponse = {
      success: false,
      error: {
        code: this.getErrorCode(exception),
        message: this.getErrorMessage(exception),
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    response.status(status).json(errorResponse);
  }
}
```

**Custom Exception Hierarchy:**

```
BaseAuthException
├── AuthenticationException (401)
│   ├── InvalidCredentialsException
│   ├── TokenExpiredException
│   └── TokenRevokedException
├── AuthorizationException (403)
│   └── UserBlockedException
├── ValidationException (400)
│   ├── UserExistsException
│   ├── InvalidEmailException
│   └── WeakPasswordException
├── NotFoundException (404)
│   └── UserNotFoundException
└── RateLimitException (429)
    └── TooManyRequestsException
```

**Error Code Convention:**

| Code Pattern | Example | Usage |
|--------------|---------|-------|
| `AUTH_<ACTION>` | `AUTH_USER_EXISTS` | Authentication errors |
| `TOKEN_<ACTION>` | `TOKEN_EXPIRED` | Token-related errors |
| `VALIDATION_<FIELD>` | `VALIDATION_EMAIL` | Input validation |
| `RATE_LIMIT` | `RATE_LIMIT_EXCEEDED` | Rate limiting |

---

### 11.2 Internal Retry Strategy

**Retry Configuration:**

```typescript
// src/shared/retry/retry.config.ts
export const RetryConfig = {
  database: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2,
  },
  redis: {
    maxRetries: 3,
    initialDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
  },
};
```

**Retry Decorator:**

```typescript
// src/shared/decorators/retry.decorator.ts
export function Retry(config: RetryConfig) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      let lastError: Error;
      for (let attempt = 0; attempt < config.maxRetries; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;
          if (attempt < config.maxRetries - 1) {
            const delay = Math.min(
              config.initialDelay * Math.pow(config.backoffMultiplier, attempt),
              config.maxDelay
            );
            await sleep(delay);
          }
        }
      }
      throw lastError;
    };
    return descriptor;
  };
}
```

**Usage in Services:**

```typescript
@Injectable()
class UserRepository {
  @Retry(RetryConfig.database)
  async findById(id: string): Promise<User> {
    // Database call with automatic retry
  }
}
```

---

### 11.3 Caching Strategy

**Cache Manager Setup:**

```typescript
// src/shared/cache/cache.module.ts
@Module({
  providers: [
    {
      provide: 'CACHE_MANAGER',
      useFactory: (configService: ConfigService) => {
        return new Cache({
          store: 'redis',
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
          ttl: 60, // default TTL in seconds
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['CACHE_MANAGER'],
})
export class CacheModule {}
```

**Cache Decorators:**

```typescript
// src/shared/decorators/cache.decorator.ts
export function Cacheable(options: CacheOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheKey = options.keyGenerator(args);
      const cached = await this.cacheManager.get(cacheKey);
      
      if (cached) {
        return cached;
      }
      
      const result = await originalMethod.apply(this, args);
      await this.cacheManager.set(cacheKey, result, options.ttl);
      return result;
    };
    return descriptor;
  };
}

export function CacheInvalidate(options: CacheOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      const cacheKey = options.keyGenerator(args);
      await this.cacheManager.del(cacheKey);
      return result;
    };
    return descriptor;
  };
}
```

**Cache Usage:**

```typescript
@Injectable()
class UserService {
  @Cacheable({
    keyGenerator: (args) => `user:${args[0]}`,
    ttl: 300, // 5 minutes
  })
  async findById(id: string): Promise<User> {
    // Database call - result cached
  }

  @CacheInvalidate({
    keyGenerator: (args) => `user:${args[0]}`,
  })
  async update(id: string, data: UpdateUserDto): Promise<User> {
    // Database update - cache invalidated
  }
}
```

---

### 11.4 Folder Structure

```
auth-service/
├── src/
│   ├── main.ts                          # Application entry point
│   ├── app.module.ts                    # Root module
│   │
│   ├── modules/                         # Feature modules
│   │   ├── auth/                        # Authentication module
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.guard.ts
│   │   │   ├── strategies/
│   │   │   │   └── jwt.strategy.ts
│   │   │   └── dto/
│   │   │       ├── register.dto.ts
│   │   │       └── login.dto.ts
│   │   │
│   │   ├── user/                        # User module
│   │   │   ├── user.module.ts
│   │   │   ├── user.controller.ts
│   │   │   ├── user.service.ts
│   │   │   ├── user.entity.ts
│   │   │   └── dto/
│   │   │       └── user.dto.ts
│   │   │
│   │   ├── token/                       # Token module
│   │   │   ├── token.module.ts
│   │   │   ├── token.service.ts
│   │   │   ├── token.entity.ts
│   │   │   └── token.config.ts
│   │   │
│   │   └── logging/                     # Logging module
│   │       ├── logging.module.ts
│   │       ├── logger.service.ts
│   │       └── log.provider.ts
│   │
│   ├── shared/                          # Shared utilities
│   │   ├── decorators/                  # Custom decorators
│   │   │   ├── retry.decorator.ts
│   │   │   ├── cache.decorator.ts
│   │   │   └── log.decorator.ts
│   │   │
│   │   ├── filters/                     # Exception filters
│   │   │   ├── http-exception.filter.ts
│   │   │   └── all-exceptions.filter.ts
│   │   │
│   │   ├── guards/                      # Auth guards
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   │
│   │   ├── interceptors/                # Request/response interceptors
│   │   │   ├── logging.interceptor.ts
│   │   │   ├── timeout.interceptor.ts
│   │   │   └── transform.interceptor.ts
│   │   │
│   │   ├── pipes/                       # Validation pipes
│   │   │   └── validation.pipe.ts
│   │   │
│   │   ├── interfaces/                  # Shared interfaces
│   │   │   ├── user.interface.ts
│   │   │   └── token.interface.ts
│   │   │
│   │   └── utils/                       # Utility functions
│   │       ├── hash.util.ts
│   │       └── uuid.util.ts
│   │
│   ├── config/                          # Configuration
│   │   ├── app-context.ts               # Global app context
│   │   ├── env.validator.ts             # Environment validation
│   │   └── database.config.ts           # Database configuration
│   │
│   └── database/                        # Database layer
│       ├── migrations/                  # TypeORM migrations
│       └── seeds/                       # Database seeds
│
├── test/                                # Test files
│   ├── unit/                            # Unit tests
│   ├── integration/                     # Integration tests
│   └── e2e/                             # End-to-end tests
│
├── docs/                                # Documentation
│   ├── api/                             # API documentation
│   ├── architecture/                    # Architecture docs
│   └── uml/                             # UML diagrams (Excalidraw)
│
├── scripts/                             # Setup scripts
│   ├── setup-keys.ts                    # Key generation script
│   └── seed-db.ts                       # Database seeding
│
├── docker/                              # Docker configuration
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── .env.example                         # Environment template
├── package.json                         # Dependencies
├── tsconfig.json                        # TypeScript config
├── nest-cli.json                        # NestJS CLI config
└── README.md                            # Project documentation
```

---

### 11.5 Internal Library Management

**package.json Import Paths:**

```json
{
  "name": "auth-service",
  "version": "1.0.0",
  "imports": {
    "@shared/*": "./src/shared/*",
    "@modules/*": "./src/modules/*",
    "@config/*": "./src/config/*",
    "@database/*": "./src/database/*"
  },
  "scripts": {
    "start:dev": "nest start --watch",
    "build": "nest build",
    "start:prod": "node dist/main",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "setup:keys": "ts-node scripts/setup-keys.ts",
    "db:migrate": "typeorm migration:run",
    "db:generate": "typeorm migration:generate",
    "db:seed": "ts-node scripts/seed-db.ts"
  }
}
```

**TypeScript Path Aliases:**

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@modules/*": ["src/modules/*"],
      "@config/*": ["src/config/*"],
      "@database/*": ["src/database/*"]
    }
  }
}
```

**Usage Examples:**

```typescript
// Import from shared
import { Retry } from '@shared/decorators/retry.decorator';
import { Cacheable } from '@shared/decorators/cache.decorator';
import { AllExceptionsFilter } from '@shared/filters/http-exception.filter';

// Import from modules
import { User } from '@modules/user/user.entity';
import { TokenService } from '@modules/token/token.service';

// Import from config
import { AppConfig } from '@config/app-context';
import { validateEnv } from '@config/env.validator';
```

---

### 11.6 API Documentation (Swagger)

**Swagger Setup:**

```typescript
// src/main.ts
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('AuthService API')
    .setDescription('Production-ready authentication service')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000);
}
```

**DTO Documentation:**

```typescript
// src/modules/auth/dto/register.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'john_doe', description: 'Unique username' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: 'john@example.com', description: 'Valid email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securePassword123', description: 'Strong password' })
  @IsString()
  @MinLength(8)
  password: string;
}
```

**Controller Documentation:**

```typescript
// src/modules/auth/auth.controller.ts
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth/v1')
export class AuthController {
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'User already exists' })
  async register(@Body() dto: RegisterDto) {
    // Implementation
  }

  @Post('authenticate')
  @ApiOperation({ summary: 'Login with credentials' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    // Implementation
  }

  @Post('refresh')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  async refresh() {
    // Implementation
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke tokens' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout() {
    // Implementation
  }
}
```

---

### 11.7 UML Diagrams (Excalidraw)

**Diagram Files:**

| Diagram | Location | Purpose |
|---------|----------|---------|
| `_bmad-output/implementation-artifacts/uml/01-sequence-registration.mmd` | Registration flow sequence |
| `_bmad-output/implementation-artifacts/uml/02-sequence-login.mmd` | Login flow sequence |
| `_bmad-output/implementation-artifacts/uml/03-sequence-refresh.mmd` | Token refresh sequence |
| `_bmad-output/implementation-artifacts/uml/04-sequence-logout.mmd` | Logout flow sequence |
| `_bmad-output/implementation-artifacts/uml/05-class-entities.mmd` | Entity relationships |
| `_bmad-output/implementation-artifacts/uml/06-class-services.mmd` | Service hierarchy |
| `_bmad-output/implementation-artifacts/uml/07-class-exceptions.mmd` | Exception hierarchy |
| `_bmad-output/implementation-artifacts/uml/08-component-hexagonal.mmd` | Hexagonal architecture |
| `_bmad-output/implementation-artifacts/uml/09-package-modules.mmd` | Module dependencies |
| `_bmad-output/implementation-artifacts/uml/10-object-runtime.mmd` | Runtime instances |

**Architecture Diagram Elements:**

```
┌─────────────────────────────────────────────────────────────┐
│                    INBOUND ADAPTERS                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ HTTP         │  │ Auth Guard   │  │ Admin        │      │
│  │ Controller   │  │              │  │ Controller   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    PORTS (Interfaces)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ IAuthService │  │ IUserService │  │ ITokenService│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CORE DOMAIN                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Auth Use     │  │ User         │  │ Token        │      │
│  │ Cases        │  │ Entity       │  │ Service      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    OUTBOUND ADAPTERS                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ PostgreSQL   │  │ MongoDB      │  │ Redis        │      │
│  │ (TypeORM)    │  │ (Logging)    │  │ (Cache)      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 12. Technical Decisions Summary

| Area | Decision | Rationale |
|------|----------|-----------|
| **Exception Handling** | Global filter + custom hierarchy | Consistent error responses |
| **Retry** | Exponential backoff decorator | Transient fault tolerance |
| **Caching** | Redis + decorator pattern | Performance + simplicity |
| **Folder Structure** | Feature-based modules | Scalability + maintainability |
| **Imports** | Path aliases via package.json | Clean import statements |
| **API Docs** | Swagger/NestJS plugin | Auto-generated, interactive |
| **UML** | Excalidraw diagrams | Visual architecture docs |

---

### Architecture Decisions
- **Hexagonal Architecture**: Ports and adapters for future OAuth support
- **Module Lifecycle**: setup() → run() → shutdown() for each module
- **Key Management**: Per-instance RSA keys, private key never in DB
- **Database**: PostgreSQL (core) + MongoDB (logging) + Redis (blacklist)
- **ORM**: TypeORM for PostgreSQL — mature, good NestJS integration, supports UUID
- **Logging**: Console only (pino + chalk) — no external monitoring for v1

### Development Setup
```bash
npm install
npm run setup:keys
cp .env.example .env
npm run start:dev
```

### Production Build
```bash
npm run build
npm run start:prod
```

---

*PRD created. Ready for review and refinement.*
