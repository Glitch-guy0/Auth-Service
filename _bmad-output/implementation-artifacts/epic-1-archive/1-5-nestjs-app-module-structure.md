---
story_id: 1.5
story_key: 1-5-nestjs-app-module-structure
story_title: "NestJS App Module Structure"
epic_num: 1
story_num: 5
status: done
created_date: 2025-01-01
---

# Story 1.5: NestJS App Module Structure

## Story Summary
As a developer, I want the root AppModule with proper module imports, so that the application boots correctly with global validation, exception handling, and Swagger documentation.

## User Story
**As a** developer,
**I want** the root AppModule with proper module imports,
**So that** the application boots correctly with global validation, exception handling, and Swagger documentation.

## Acceptance Criteria

### Given the project
- When I check `src/app.module.ts`
- Then it imports ConfigModule, AuthModule, UserModule, TokenModule, LoggingModule
- And it uses global validation pipe
- And it registers the global exception filter

### Given the project
- When I check `src/main.ts`
- Then it bootstraps NestJS with AppModule
- And it sets up Swagger documentation
- And it listens on the configured PORT

## Technical Requirements

### AppModule Configuration
- Root `@Module` decorator imports all feature modules and ConfigModule
- ConfigModule uses `forRoot({ isGlobal: true })` for app-wide config access
- AuthModule, UserModule, TokenModule, LoggingModule registered as imports
- No controllers or providers at root level — delegates to feature modules

### Global Validation Pipe
- Register `ValidationPipe` globally via `app.useGlobalPipes(new ValidationPipe())` in `main.ts`
- Use Zod-based validation pipe via `nestjs-zod` (per AD-11)
- Configure with `whitelist: true` and `forbidNonWhitelisted: true` for strict input
- Transform payloads to match DTO types automatically

### Global Exception Filter
- Register exception filter globally via `app.useGlobalFilters(new AllExceptionsFilter())` in `main.ts`
- Filter catches all exceptions and formats them to the standard error envelope: `{ success: false, error: { code, message, timestamp, path } }`
- Sets correct HTTP status code from exception (or 500 for unhandled)

### Swagger Documentation
- Set up Swagger via `SwaggerModule.setup('api', app, document)` in `main.ts`
- Configure Swagger metadata: title, description, version, tag
- Enable Swagger UI at `/api` endpoint
- Use `DocumentBuilder` for OpenAPI configuration

### Bootstrap Flow
- Validate environment before app creation (fail-fast per Story 1.3)
- Initialize AppContext with validated config and stub LogManager (per Story 1.4)
- Create NestJS app with `NestFactory.create(AppModule)`
- Apply global pipes, filters, and interceptors
- Set up Swagger documentation
- Listen on `env.PORT`

### Stub Modules
- Create minimal module files under `src/modules/` for Auth, User, Token, Logging
- Each module is a bare `@Module({})` — no controllers, services, or providers yet
- Business logic comes in later epics (Epic 2+)
- Modules are placeholders to satisfy AppModule imports

## Developer Context

### File Structure Requirements
```
src/
├── main.ts                    # Application entry point (update)
├── app.module.ts              # Root module (update)
├── config/
│   ├── env.validator.ts       # Story 1.3 — env config
│   └── app-context.ts         # Story 1.4 — global singleton
├── modules/
│   ├── auth/
│   │   └── auth.module.ts     # Stub module
│   ├── user/
│   │   └── user.module.ts     # Stub module
│   ├── token/
│   │   └── token.module.ts    # Stub module
│   └── logging/
│       └── logging.module.ts  # Stub module
└── shared/
    └── exceptions/
        └── all-exceptions.filter.ts  # Global exception filter (create)
```

### app.module.ts
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@modules/auth/auth.module';
import { UserModule } from '@modules/user/user.module';
import { TokenModule } from '@modules/token/token.module';
import { LoggingModule } from '@modules/logging/logging.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UserModule,
    TokenModule,
    LoggingModule,
  ],
})
export class AppModule {}
```

### main.ts
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { getValidatedEnv } from '@config/env.validator';
import { setAppContext } from '@config/app-context';
import { AllExceptionsFilter } from '@shared/exceptions/all-exceptions.filter';

async function bootstrap() {
  // Fail-fast: validate environment before creating the app
  const env = getValidatedEnv();

  // Initialize AppContext with validated config
  setAppContext({
    config: env,
    logManager: createStubLogManager(), // stub until Epic 8
  });

  const app = await NestFactory.create(AppModule);

  // Global validation pipe (Zod via nestjs-zod, per AD-11)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('AuthService API')
    .setDescription('Authentication service with JWT-based auth')
    .setVersion('1.0')
    .addTag('auth')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(env.PORT);
}
bootstrap();

// Temporary stub — replaced by real LogManager in Epic 8
function createStubLogManager() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };
}
```

### Stub Module Files

#### auth.module.ts
```typescript
import { Module } from '@nestjs/common';

@Module({})
export class AuthModule {}
```

#### user.module.ts
```typescript
import { Module } from '@nestjs/common';

@Module({})
export class UserModule {}
```

#### token.module.ts
```typescript
import { Module } from '@nestjs/common';

@Module({})
export class TokenModule {}
```

#### logging.module.ts
```typescript
import { Module } from '@nestjs/common';

@Module({})
export class LoggingModule {}
```

### all-exceptions.filter.ts
```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const errorResponse = {
      success: false,
      error: {
        code: (exception as any).code || 'UNKNOWN_ERROR',
        message: typeof message === 'string' ? message : (message as any).message || 'Internal server error',
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    response.status(status).json(errorResponse);
  }
}
```

### Key Design Decisions
- **ConfigModule.forRoot({ isGlobal: true })**: Makes ConfigService available app-wide without importing in each module
- **Stub modules**: Minimal `@Module({})` — no controllers/services/providers yet. Business logic comes in Epic 2+
- **Global pipe in main.ts**: Applied before request reaches controllers — validates all incoming data
- **Global filter in main.ts**: Catches all exceptions uniformly — consistent error envelope
- **Swagger at `/api`**: Standard location — accessible via browser for API exploration
- **Stub LogManager**: `createStubLogManager()` in main.ts — will be replaced by real LoggingModule in Epic 8

## Architecture Compliance

### Hexagonal Architecture (AD-1)
- AppModule is the composition root — it wires modules together
- No business logic in AppModule — delegates to feature modules
- Feature modules will contain controllers (inbound adapters), services (domain), and repositories (outbound adapters)

### Module Lifecycle Pattern (AD-4)
- `setup()` → `run()` → `shutdown()` lifecycle per module
- AppContext is initialized before NestJS creates the app — modules find it ready when `setup()` runs
- Stub modules don't implement lifecycle yet — that comes in Epic 2+

### Zod Validation (AD-11)
- Global ValidationPipe uses Zod for input validation (via nestjs-zod)
- No class-validator or class-transformer — AD-11 forbids them
- All DTO validation goes through Zod schemas

### Configuration Flow
```
.env → process.env → getValidatedEnv() → Env object
                                              ↓
setAppContext({ config: env, logManager: stub })
                                              ↓
NestFactory.create(AppModule)
    ↓
app.useGlobalPipes(ValidationPipe)
app.useGlobalFilters(AllExceptionsFilter)
    ↓
SwaggerModule.setup('api', app, document)
    ↓
app.listen(env.PORT)
```

### Structural Seed Alignment
- AppModule imports match the structural seed module locations
- All feature modules are under `src/modules/` per ARCHITECTURE-SPINE.md
- ConfigModule is global — not under `src/modules/` but under `src/config/`

## Testing Requirements

### Unit Tests
- Test that AppModule imports all required modules (mock module dependencies)
- Test that main.ts bootstrap applies global pipes and filters
- Test that Swagger document is created with correct metadata
- Test that AllExceptionsFilter formats errors correctly

### Integration Tests
- Test that the app boots without errors with valid environment
- Test that Swagger UI is accessible at `/api`
- Test that invalid input is rejected by the global validation pipe
- Test that unhandled exceptions return the standard error envelope

### Test Cases
```typescript
describe('AppModule', () => {
  it('should import ConfigModule', () => {
    // Verify ConfigModule is in imports
  });

  it('should import AuthModule', () => {
    // Verify AuthModule is in imports
  });

  it('should import UserModule', () => {
    // Verify UserModule is in imports
  });

  it('should import TokenModule', () => {
    // Verify TokenModule is in imports
  });

  it('should import LoggingModule', () => {
    // Verify LoggingModule is in imports
  });
});

describe('AllExceptionsFilter', () => {
  it('should format HttpException to standard error envelope', () => {
    // Verify response shape matches { success: false, error: { code, message, timestamp, path } }
  });

  it('should return 500 for unknown exceptions', () => {
    // Verify unhandled exceptions return 500 status
  });

  it('should include the request path in error response', () => {
    // Verify path field matches request URL
  });
});

describe('Bootstrap', () => {
  it('should create NestJS app with AppModule', () => {
    // Verify NestFactory.create is called with AppModule
  });

  it('should apply global ValidationPipe', () => {
    // Verify app.useGlobalPipes is called
  });

  it('should apply global AllExceptionsFilter', () => {
    // Verify app.useGlobalFilters is called
  });

  it('should set up Swagger documentation', () => {
    // Verify SwaggerModule.setup is called with correct path
  });

  it('should listen on configured PORT', () => {
    // Verify app.listen is called with env.PORT
  });
});
```

### Test Configuration
- Unit tests in `src/app.module.spec.ts` and `src/main.spec.ts`
- Integration tests in `test/app.e2e-spec.ts`
- Run with: `npm test -- --testPathPattern=app.module`
- Run e2e with: `npm run test:e2e`

## Business Context

### Project Goals
- Build a secure, scalable authentication service
- AppModule is the composition root that wires all modules together
- Global validation and exception handling ensure consistent API behavior
- Swagger documentation enables API exploration and client integration

### Success Criteria
- `src/app.module.ts` imports all 5 modules (ConfigModule, AuthModule, UserModule, TokenModule, LoggingModule)
- Global validation pipe rejects invalid input with structured error responses
- Global exception filter formats all errors to the standard envelope
- `src/main.ts` bootstraps NestJS with AppModule
- Swagger UI is accessible at `/api`
- Application starts on the configured PORT
- All stub modules exist and compile without errors
- Unit tests pass for AppModule, AllExceptionsFilter, and bootstrap

## Implementation Notes

### Key Considerations
- Start with stub modules — they're placeholders for business logic in Epic 2+
- ConfigModule.forRoot({ isGlobal: true }) is the simplest way to make config app-wide
- The ValidationPipe should use Zod (via nestjs-zod) — not class-validator (AD-11)
- The exception filter handles both HttpException and unknown exceptions
- Swagger setup is straightforward with DocumentBuilder + SwaggerModule
- AppContext must be initialized before NestFactory.create — modules need it in setup()

### Common Pitfalls
- Forgetting to call setAppContext before NestFactory.create — modules won't have access to config
- Using class-validator instead of Zod — violates AD-11
- Not setting isGlobal: true on ConfigModule — each module would need to import ConfigModule individually
- Leaving out the exception filter — unhandled exceptions return NestJS default format, not the standard envelope
- Forgetting to set up Swagger — API documentation won't be available
- Stub modules without the @Module decorator — NestJS won't recognize them as modules

## Dependencies

### Epic Dependencies
- Depends on Story 1.1 (project structure, dependencies installed)
- Depends on Story 1.2 (path aliases for `@modules/*`, `@config/*`, `@shared/*`)
- Depends on Story 1.3 (env config for PORT, NODE_ENV — used in main.ts bootstrap)
- Depends on Story 1.4 (AppContext singleton — initialized in main.ts before NestFactory.create)
- Foundation for Story 1.6 (User entity — requires UserModule to exist)
- Foundation for Story 1.7 (AuthToken entity — requires TokenModule to exist)
- Foundation for Story 1.8 (PublicKeyRegistry entity — requires KeyModule or TokenModule)
- Foundation for Story 1.9 (Demographics interface — requires UserModule to exist)
- Foundation for Story 1.10-1.11 (DTOs — require AuthModule to exist)
- Foundation for Story 1.12 (Service interfaces — require module structure)
- Foundation for Story 1.13 (Exception hierarchy — used by global exception filter)
- Foundation for Story 2.1-2.3 (Key Management — requires module structure)

### External Dependencies
- `@nestjs/core` v11.1.3
- `@nestjs/common` v11.1.3
- `@nestjs/config` v4.0.2
- `@nestjs/swagger` v7.1.16
- `nestjs-zod` v5.4.0
- Node.js v22.x or later

## Checklist

- [ ] Create stub modules: `auth.module.ts`, `user.module.ts`, `token.module.ts`, `logging.module.ts`
- [ ] Each stub module has `@Module({})` decorator
- [ ] Update `src/app.module.ts` with all module imports
- [ ] Configure ConfigModule with `{ isGlobal: true }`
- [ ] Create `src/shared/exceptions/all-exceptions.filter.ts`
- [ ] Implement AllExceptionsFilter with standard error envelope
- [ ] Update `src/main.ts` bootstrap flow
- [ ] Initialize AppContext before NestFactory.create
- [ ] Apply global ValidationPipe with whitelist and forbidNonWhitelisted
- [ ] Apply global AllExceptionsFilter
- [ ] Set up Swagger with DocumentBuilder
- [ ] Listen on env.PORT
- [ ] Create unit tests for AppModule
- [ ] Create unit tests for AllExceptionsFilter
- [ ] Create unit tests for bootstrap flow
- [ ] Verify app boots without errors with valid .env
- [ ] Verify Swagger UI accessible at /api
- [ ] Verify invalid input returns structured error response
- [ ] Run all tests and verify they pass

---

*Story created using bmad-create-story workflow*
*Status: ready-for-dev*
*Next: Developer will implement AppModule structure and bootstrap flow*
