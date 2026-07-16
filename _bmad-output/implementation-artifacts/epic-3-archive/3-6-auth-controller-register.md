---
story_id: 3.6
story_key: 3-6-auth-controller-register
story_title: "Auth Controller — Register Endpoint"
epic_num: 3
story_num: 6
status: ready-for-dev
created_date: 2025-07-15
---

# Story 3.6: Auth Controller — Register Endpoint

## Story Summary
As a developer, I want the register endpoint wired up, so that users can register via HTTP.

## User Story
**As a** developer,
**I want** the register endpoint wired up,
**So that** users can register via HTTP.

## Acceptance Criteria

### Given the project
- When I check `AuthController`, then `POST /auth/v1/register` endpoint exists
- And it validates input with `RegisterSchema.parse(body)`
- And it returns `201` with tokens on success
- And it has Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`)

## Technical Requirements

### AuthController
- Implement the `AuthController` in `src/modules/auth/auth.controller.ts`
- Use `@Controller('auth')` decorator to set the route prefix
- The register endpoint is `POST /auth/v1/register`
- Use versioning via `@Version('v1')` on the method or controller

### Register Endpoint
- Route: `POST /register` (under controller prefix `auth`, with version `v1`)
- Full path: `/auth/v1/register`
- Accepts JSON body matching `RegisterSchema`
- Validates input using `RegisterSchema.parse(body)` via a Zod validation pipe or inline parse
- Returns `201 Created` with `TokenResponseDto` on success

### Zod Validation
- Use `RegisterSchema.parse(body)` to validate the incoming request body
- Implement a `ZodValidationPipe` (custom NestJS pipe) that wraps `schema.parse(value)` and throws `BadRequestException` on failure
- The pipe throws a structured error with the Zod validation issues

### Swagger Documentation
- `@ApiTags('auth')` on the controller class
- `@ApiOperation({ summary: 'Register a new user' })` on the register method
- `@ApiResponse({ status: 201, description: 'User registered successfully', type: TokenResponseDto })` on the register method
- `@ApiResponse({ status: 400, description: 'Invalid input' })` on the register method

### Dependency Injection
- Inject `AuthService` (from Story 3-5) via constructor
- The `AuthService.register(dto)` method handles the business logic and returns `TokenResponseDto`

### Error Handling
- `BadRequestException` for validation errors (from ZodValidationPipe)
- `ConflictException` if the user already exists (propagated from AuthService)
- `InternalServerErrorException` for unexpected errors

## Developer Context

### File Structure Requirements
```
src/
├── modules/
│   └── auth/
│       ├── auth.controller.ts          # Controller implementation (this story)
│       ├── auth.module.ts              # NestJS module (update imports)
│       ├── auth.service.ts             # Service (from Story 3-5, injected)
│       ├── dto/
│       │   ├── register.dto.ts         # RegisterDto/RegisterSchema (already exists)
│       │   └── token-response.dto.ts   # TokenResponseDto (already exists)
│       ├── pipes/
│       │   └── zod-validation.pipe.ts  # Custom Zod validation pipe
│       └── __tests__/
│           └── auth.controller.spec.ts  # Unit tests
```

### Implementation Details
- Use `@Controller('auth')` with `@Version('v1')` for versioned routes
- Use `@Post('register')` for the endpoint
- Use `@Body(new ZodValidationPipe(RegisterSchema))` to validate the body
- Return `new TokenResponseDto(...)` or the plain object matching `TokenResponseDto`
- Use `@HttpCode(201)` or the implicit 201 from `@Post` + `created()` response

### Controller Skeleton
```typescript
import { Controller, Post, Body, HttpCode, HttpStatus, Version } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterSchema, RegisterDto } from './dto/register.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Version('v1')
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: TokenResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto,
  ): Promise<TokenResponseDto> {
    return this.authService.register(dto);
  }
}
```

### Zod Validation Pipe
```typescript
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

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

### Module Updates
```typescript
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenModule } from '../token/token.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TokenModule, UserModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

## Architecture Compliance

### Hexagonal Architecture
- AuthController is an adapter (inbound HTTP adapter) — it translates HTTP requests into service calls
- AuthController depends on `AuthService` port (service layer) — no direct dependency on repositories or entities
- Validation is handled by the pipe, keeping the controller thin

### Security Considerations
- Password is received in the request body and passed to AuthService for hashing — never logged or stored in plain text
- Validation ensures password meets minimum length (8 chars) before reaching the service
- Input validation prevents injection attacks at the boundary

### Module Boundaries
- AuthController belongs to AuthModule
- AuthModule imports TokenModule and UserModule for service dependencies
- No direct dependency on database or external services

## Testing Requirements

### Unit Tests (`src/modules/auth/__tests__/auth.controller.spec.ts`)
- Test that `POST /auth/v1/register` returns `201` with valid body
- Test that `POST /auth/v1/register` returns `400` with invalid body (missing fields, bad email, short password)
- Test that `POST /auth/v1/register` calls `AuthService.register` with correct DTO
- Test that `POST /auth/v1/register` returns the `TokenResponseDto` from `AuthService.register`
- Test that `POST /auth/v1/register` throws `ConflictException` when user already exists
- Test that validation pipe rejects invalid input before reaching the controller

### Mock Strategy
- Mock `AuthService` — provide fake `register()` returning a `TokenResponseDto`
- Mock should be injected via NestJS testing module
- Use `@nestjs/testing` `Test.createTestingModule` for controller tests

### Test Configuration
- Use Jest for unit testing
- Use `Test.createTestingModule` to build the controller test module
- Mock `AuthService` with `jest.mock` or `useMockValue`

## Dependencies

### Epic Dependencies
- Story 3-5: Auth Service (Register) — `AuthService.register()` method
- Story 3-1: TokenService — generates tokens (used by AuthService)
- Story 1.12: Service Interfaces (`ITokenService`)

### External Dependencies
- `@nestjs/common` — Controller, Post, Body, HttpCode, HttpStatus, Version, PipeTransform, Injectable, BadRequestException, NotFoundException
- `@nestjs/swagger` — ApiTags, ApiOperation, ApiResponse
- `zod` — RegisterSchema validation (already in `package.json`)

## Checklist

- [ ] Create `AuthController` class with `@Controller('auth')` decorator
- [ ] Implement `POST /register` endpoint with `@Post('register')`
- [ ] Add `@Version('v1')` for API versioning
- [ ] Add `@HttpCode(HttpStatus.CREATED)` for 201 response
- [ ] Add Swagger decorators: `@ApiTags('auth')`, `@ApiOperation`, `@ApiResponse`
- [ ] Create `ZodValidationPipe` that wraps `schema.safeParse()` and throws `BadRequestException`
- [ ] Inject `AuthService` via constructor
- [ ] Wire `@Body(new ZodValidationPipe(RegisterSchema))` for input validation
- [ ] Return `TokenResponseDto` from `this.authService.register(dto)`
- [ ] Update `AuthModule` to include `AuthController` in controllers array
- [ ] Create unit tests with mocked `AuthService`
- [ ] Test valid registration returns 201 with tokens
- [ ] Test invalid input returns 400 with validation errors
- [ ] Test user conflict returns 409
- [ ] Run lint and typecheck

---

*Story created using bmad-create-story workflow*
*Status: ready-for-dev*
*Next: Developer will implement AuthController register endpoint*
