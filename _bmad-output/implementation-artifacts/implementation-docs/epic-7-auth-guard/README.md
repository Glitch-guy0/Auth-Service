# Epic 7: Auth Guard & Protected Routes — Implementation Documentation

**Goal:** Implement auth guards, middleware, and exception filters. Routes can be protected.

**Depends on:** Epic 4 (TokenService.verifyAccessToken works), Epic 6 (logout/blacklist logic exists), Epic 1 (exception hierarchy, response types, JwtPayload type)

**Deliverable:** Request authentication pipeline — middleware extracts tokens, guard validates them, exception filter formats all errors, validation pipe rejects bad input.

---

## Story 7.1: Auth Middleware

### Overview

NestJS middleware that runs before guards. Parses the `Authorization` header, extracts the Bearer token, and attaches it to the request object. Guards downstream read the pre-extracted token from `req.accessToken` instead of re-parsing the header on every request. The middleware is a thin extraction layer — it does not verify signatures or check blacklists; that responsibility belongs to the guard (Story 7.2).

### Architecture References

| AD | Title | Relevance |
|----|-------|-----------|
| AD-1 | Hexagonal Module Boundary | The middleware is an inbound adapter. It lives in the auth module, depends on no outbound adapters, and does not call other adapters directly — it only mutates the request object for downstream consumers. |

### Acceptance Criteria

- [ ] Middleware implements `NestMiddleware`.
- [ ] Extracts token from `Authorization: Bearer <token>` header.
- [ ] Attaches the raw token string to `req.accessToken` (typed via a request augmentation interface).
- [ ] If the `Authorization` header is missing or does not use the `Bearer` scheme, the middleware calls `next()` without attaching a token — the guard downstream is responsible for rejecting unauthenticated requests.
- [ ] The middleware does not throw exceptions — it is a best-effort extraction layer.
- [ ] Registered globally via `AppModule.configure()` so it applies to every route.

### Test Acceptance Criteria

- [ ] **Given** a request with `Authorization: Bearer abc123`, **when** the middleware processes it, **then** `req.accessToken` is set to `abc123`.
- [ ] **Given** a request with `Authorization: Basic abc123`, **when** the middleware processes it, **then** `req.accessToken` is undefined.
- [ ] **Given** a request with no `Authorization` header, **when** the middleware processes it, **then** `req.accessToken` is undefined and `next()` is called.
- [ ] **Given** a request with `Authorization: Bearer ` (empty token), **when** the middleware processes it, **then** `req.accessToken` is an empty string (guard will reject).

### Implementation Guidance

Create `src/modules/auth/auth.middleware.ts`:

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  accessToken?: string;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      req.accessToken = authHeader.slice(7);
    }
    next();
  }
}
```

Register globally in `src/app.module.ts`:

```typescript
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes('*');  // apply to every route
  }
}
```

**Key considerations:**

- **No exceptions thrown.** The middleware is purely extractive. An unauthenticated request simply has `req.accessToken === undefined`, and the guard (Story 7.2) rejects it.
- **Global registration.** Apply to `*` so every route goes through extraction. Individual routes that don't need auth are simply not guarded — the guard is the access control decision point, not the middleware.
- **Request augmentation.** Define `AuthenticatedRequest` extending `Request` so downstream guards have type-safe access to `req.accessToken`. Export this interface for guard consumption.

### Dependencies

- None (standalone extraction; guard consumes the output in Story 7.2).

---

## Story 7.2: JWT Auth Guard

### Overview

NestJS guard (`JwtAuthGuard`) that validates access tokens for protected routes. Reads the pre-extracted token from `req.accessToken` (set by the middleware in Story 7.1), decodes the JWT header to extract `kid`, retrieves the matching public key from `KeyManager`, verifies the signature and expiry via `TokenService.verifyAccessToken()`, checks the Redis blacklist, and attaches the decoded `JwtPayload` to `req.user`. Throws the appropriate exception (from the Epic 1 hierarchy) for every failure mode.

### Architecture References

| AD | Title | Relevance |
|----|-------|-----------|
| AD-15 | JWT Payload Contract | Defines the claims the guard expects in the decoded payload: `sub` (user_id), `iat`, `iss`, `kid`, `exp`. The guard trusts `TokenService.verifyAccessToken()` to validate these claims and returns the typed `JwtPayload` to the request. |
| AD-9 | KeyManager Takes kid Parameter | The guard relies on `TokenService` to extract `kid` from the JWT protected header and pass it to `KeyManager.getPublicKey(kid)` for the correct public key lookup. This enables key rotation without invalidating existing tokens. |

### Acceptance Criteria

- [ ] Guard implements `CanActivate`.
- [ ] Reads the token from `req.accessToken` (attached by the middleware in Story 7.1).
- [ ] If `req.accessToken` is undefined/empty, throws `AuthenticationException` with code `AUTH_MISSING_TOKEN` (HTTP 401).
- [ ] Delegates verification to `TokenService.verifyAccessToken(token)`, which internally extracts `kid` from the JWT header and fetches the public key from `KeyManager` per AD-9.
- [ ] `TokenService.verifyAccessToken()` validates the RS256 signature, checks `exp`, and returns the decoded `JwtPayload` per AD-15.
- [ ] After verification, checks the Redis blacklist for the token. If blacklisted, throws `TokenRevokedException` (HTTP 401).
- [ ] Attaches the decoded `JwtPayload` to `req.user` for downstream use by controllers and other guards.
- [ ] Throws `TokenExpiredException` (HTTP 401) if the token has expired.
- [ ] Throws `TokenInvalidSignatureException` (HTTP 401) if the signature is invalid.
- [ ] Throws `TokenRevokedException` (HTTP 401) if the token is blacklisted.
- [ ] Can be applied per-route via `@UseGuards(JwtAuthGuard)` or globally via `APP_GUARD` provider.

### Test Acceptance Criteria

- [ ] **Given** a valid, non-blacklisted token, **when** the guard runs, **then** `req.user` is set to the decoded `JwtPayload` and the request proceeds.
- [ ] **Given** a request with no token (`req.accessToken` is undefined), **when** the guard runs, **then** it throws `AuthenticationException` with code `AUTH_MISSING_TOKEN`.
- [ ] **Given** an expired token, **when** the guard runs, **then** it throws `TokenExpiredException`.
- [ ] **Given** a token signed with an unknown key, **when** the guard runs, **then** it throws `TokenInvalidSignatureException`.
- [ ] **Given** a blacklisted token (exists in Redis), **when** the guard runs, **then** it throws `TokenRevokedException`.
- [ ] **Given** a valid token, **when** the guard runs and Redis is unreachable, **then** it fails open (proceeds without blacklist check — self-healing via JWT expiry; log the Redis error).
- [ ] **Given** a valid token, **when** the guard runs and `KeyManager.getPublicKey(kid)` throws, **then** it throws `TokenInvalidSignatureException`.
- [ ] **Guard order:** Verify `verifyAccessToken` is called before the blacklist check (token must be valid before checking revocation).

### Implementation Guidance

Create `src/modules/auth/guards/jwt-auth.guard.ts`:

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '@modules/token/token.service';
import { RedisClient } from '@shared/redis/redis.client';
import { AuthenticatedRequest } from '../auth.middleware';
import {
  AuthenticationException,
  TokenExpiredException,
  TokenInvalidSignatureException,
  TokenRevokedException,
} from '@shared/exceptions';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly redisClient: RedisClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = req.accessToken;

    if (!token) {
      throw new AuthenticationException(
        'Missing Authorization header or Bearer token',
        'AUTH_MISSING_TOKEN',
      );
    }

    // 1. Verify signature + expiry via TokenService (extracts kid per AD-9, AD-15)
    let payload;
    try {
      payload = await this.tokenService.verifyAccessToken(token);
    } catch (error) {
      if (error instanceof TokenExpiredException) throw error;
      if (error instanceof TokenInvalidSignatureException) throw error;
      throw new TokenInvalidSignatureException();
    }

    // 2. Check Redis blacklist (fail open — if Redis is down, skip check)
    try {
      const isBlacklisted = await this.redisClient.exists(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new TokenRevokedException();
      }
    } catch (error) {
      if (error instanceof TokenRevokedException) throw error;
      // Redis failure — log and fail open (token expires naturally via exp claim)
    }

    // 3. Attach payload to request
    req.user = payload;
    return true;
  }
}
```

Register as a global guard in `src/app.module.ts` (or in the auth module):

```typescript
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
```

Alternatively, apply per-route with `@UseGuards(JwtAuthGuard)` on specific controllers or methods.

**Key considerations:**

- **Token extraction is pre-done.** The guard reads `req.accessToken` from the middleware (Story 7.1). It does not re-parse the `Authorization` header.
- **kid lookup is delegated.** The guard calls `TokenService.verifyAccessToken()`, which internally extracts `kid` from the JWT protected header and calls `KeyManager.getPublicKey(kid)` per AD-9. The guard does not call `KeyManager` directly.
- **Redis failure is fail-open.** If the Redis `exists` call throws (connection refused, timeout), swallow the error and proceed. The access token will naturally expire via its `exp` claim (self-healing). This mirrors the same resilience pattern used in logout (AD-17).
- **Blacklist key format.** Use `blacklist:{token}` as the Redis key. The TTL is set during logout (Story 6.1) to match the token's remaining expiry.
- **Guard ordering.** If registered as `APP_GUARD`, the guard runs on every route. Routes that don't need auth (e.g., `/auth/v1/register`, `/auth/v1/authenticate`) should either skip the guard via a `@Public()` decorator or be excluded in the guard logic (check for a metadata flag). A lightweight `@Public()` decorator approach:
  ```typescript
  import { SetMetadata } from '@nestjs/common';
  export const IS_PUBLIC_KEY = 'isPublic';
  export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
  ```
  Then in the guard: `const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]); if (isPublic) return true;`

### Dependencies

- `TokenService.verifyAccessToken()` — from Story 4.1 (Epic 4). Verifies RS256 signature, extracts kid per AD-9, returns typed `JwtPayload`.
- `RedisClient` — for blacklist lookup. Must be available from Epic 1/2 infrastructure.
- `AuthenticatedRequest` interface — from Story 7.1 (the middleware that attaches `req.accessToken`).
- Exception hierarchy (`AuthenticationException`, `TokenExpiredException`, `TokenInvalidSignatureException`, `TokenRevokedException`) — from Story 1.13 (Epic 1).
- `JwtPayload` type — from Story 1.15 (Epic 1).

---

## Story 7.3: Global Exception Filter

### Overview

NestJS exception filter (`AllExceptionsFilter`) that catches all exceptions thrown anywhere in the application and formats them into the standard error envelope defined by the architecture: `{ success: false, error: { code, message, timestamp, path } }`. This is the single point of error formatting — controllers and services never construct error responses manually. The filter maps the exception's `statusCode` to the correct HTTP status code and the exception's `code` to the error code field.

### Architecture References

| AD | Title | Relevance |
|----|-------|-----------|
| AD-1 | Hexagonal Module Boundary | The filter is a cross-cutting inbound adapter. It does not depend on any specific module — it catches `HttpException`, `BaseAuthException`, `ZodError`, and unknown errors uniformly. |

### Acceptance Criteria

- [ ] Filter implements `ExceptionFilter`.
- [ ] Catches all exception types: `BaseAuthException` subclasses (from Epic 1), NestJS `HttpException`, `ZodError` (from validation in Story 7.4), and unknown/unexpected errors.
- [ ] Returns `{ success: false, error: { code, message, timestamp, path } }` for every error.
- [ ] Sets the correct HTTP status code: uses `exception.statusCode` for `BaseAuthException`, `exception.getStatus()` for NestJS `HttpException`, `400` for `ZodError`, `500` for unknown errors.
- [ ] `timestamp` is an ISO 8601 string (`new Date().toISOString()`).
- [ ] `path` is the request URL from `req.url`.
- [ ] `code` is the exception's error code (e.g., `AUTH_INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `VALIDATION_ERROR`), or a fallback (`UNKNOWN_ERROR`) for unexpected exceptions.
- [ ] Registered globally via `APP_FILTER` provider in `AppModule`.
- [ ] For unknown exceptions, logs the full error internally (for debugging) but returns only the sanitized envelope to the client (no stack traces in production).

### Test Acceptance Criteria

- [ ] **Given** a `TokenExpiredException`, **when** the filter catches it, **then** the response is `{ success: false, error: { code: 'TOKEN_EXPIRED', message: 'Token has expired', timestamp: '...', path: '/auth/v1/protected' } }` with HTTP 401.
- [ ] **Given** a `ValidationException` (NestJS HttpException), **when** the filter catches it, **then** the response has HTTP 400 and the correct error code.
- [ ] **Given** a `ZodError`, **when** the filter catches it, **then** the response has HTTP 400, code `VALIDATION_ERROR`, and the message includes the Zod validation details.
- [ ] **Given** an unexpected `Error` (not a BaseAuthException), **when** the filter catches it, **then** the response has HTTP 500, code `UNKNOWN_ERROR`, and the message is generic (no stack trace).
- [ ] **Given** any exception, **when** the filter catches it, **then** `timestamp` is a valid ISO 8601 string and `path` matches the request URL.
- [ ] **Given** a `ZodError` with multiple field errors, **when** the filter catches it, **then** the error details include an `issues` array with field-level validation messages.

### Implementation Guidance

Create `src/shared/filters/all-exceptions.filter.ts`:

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BaseAuthException } from '@shared/exceptions';
import { ZodError } from 'zod';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'UNKNOWN_ERROR';
    let message = 'Internal server error';

    if (exception instanceof BaseAuthException) {
      status = exception.statusCode;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      code = 'HTTP_ERROR';
      message = typeof res === 'string' ? res : (res as any).message || exception.message;
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = exception.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
    } else if (exception instanceof Error) {
      message = exception.message;
      // Log full error internally for debugging
      console.error('Unhandled exception:', exception);
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
```

Register globally in `src/app.module.ts`:

```typescript
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
```

**Key considerations:**

- **Catch-all semantics.** The `@Catch()` decorator with no arguments catches every exception type. This is intentional — the filter is the single point of error formatting.
- **ZodError handling.** When the Zod validation pipe (Story 7.4) rejects a request, it throws a `ZodError`. The filter formats this into the standard envelope with field-level details in the `message` field.
- **Unknown error sanitization.** For unexpected errors, never expose the stack trace or internal error message to the client. Log it internally and return a generic `Internal server error` message. In development, you may include the error message; in production, sanitize it.
- **BaseAuthException first.** Check `BaseAuthException` before the generic `HttpException` since all custom exceptions extend `BaseAuthException` and carry a specific `code`.
- **Consistent envelope.** Every error response from every endpoint will have the same shape. Clients can reliably parse `{ success, error: { code, message, timestamp, path } }`.

### Dependencies

- `BaseAuthException` and all subclasses — from Story 1.13 (Epic 1). The filter reads `statusCode` and `code` from these exceptions.
- `ZodError` — from the `zod` package. Thrown by the validation pipe in Story 7.4.
- `ErrorResponse` type — from Story 1.16 (Epic 1). Use this type to validate the response shape.

---

## Story 7.4: Zod Validation Pipe

### Overview

Global NestJS validation pipe that integrates Zod schemas with the NestJS request lifecycle via `nestjs-zod`. Parses and validates incoming request bodies against route-specific Zod schemas, rejecting requests with HTTP 400 and structured Zod error details when validation fails. This replaces NestJS's default `class-validator`/`class-transformer` pipe with a Zod-native approach per AD-11.

### Architecture References

| AD | Title | Relevance |
|----|-------|-----------|
| AD-11 | Zod Validation (Strictly) | All input validation uses Zod schemas with `nestjs-zod` integration. No class-validator or class-transformer. Runtime validation with TypeScript type inference via `z.infer<>`. This pipe is the enforcement mechanism for AD-11. |

### Acceptance Criteria

- [ ] Global validation pipe is registered via `APP_PIPE` in `AppModule` or applied in `main.ts`.
- [ ] Parses request bodies with the Zod schema specified on the route's DTO.
- [ ] Rejects requests with HTTP 400 if validation fails.
- [ ] Returns Zod error details: an array of issues, each with `field` (path), `message`, and `code`.
- [ ] Uses `nestjs-zod` `ZodValidationPipe` or a custom pipe that calls `schema.parse()` and maps `ZodError` to the standard error envelope.
- [ ] The pipe works with the global exception filter (Story 7.3) — `ZodError` thrown by the pipe is caught and formatted into `{ success: false, error: { code: 'VALIDATION_ERROR', message: '...', ... } }`.
- [ ] Strips unknown properties from the request body (Zod default behavior with `z.object()`).
- [ ] Does not affect routes that don't define a Zod schema (passes through without validation).

### Test Acceptance Criteria

- [ ] **Given** a request with a valid body matching the Zod schema, **when** the pipe processes it, **then** the request proceeds to the controller with the parsed/typed body.
- [ ] **Given** a request with a missing required field, **when** the pipe processes it, **then** it throws a `ZodError` and the response (via the exception filter) is HTTP 400 with `VALIDATION_ERROR` code.
- [ ] **Given** a request with an invalid field type (e.g., string where number expected), **when** the pipe processes it, **then** it throws a `ZodError` with the field path and message.
- [ ] **Given** a request with extra unknown fields, **when** the pipe processes it, **then** the unknown fields are stripped (not passed to the controller).
- [ ] **Given** a request with no body on a POST route, **when** the pipe processes it, **then** it throws a `ZodError` if the schema requires body fields.
- [ ] **Given** a route without a Zod schema decorator, **when** the pipe processes it, **then** it passes through without validation.

### Implementation Guidance

Option A — use `nestjs-zod` built-in pipe (recommended if compatible with Zod v4):

```typescript
// In main.ts or AppModule
import { ZodValidationPipe } from 'nestjs-zod';

app.useGlobalPipes(new ZodValidationPipe({
  whitelist: true,       // strip unknown properties
  forbidNonWhitelisted: false,  // strip, don't throw
}));
```

Option B — custom Zod pipe (if `nestjs-zod` pipe has compatibility issues with Zod v4):

```typescript
// src/shared/pipes/zod-validation.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw error; // let the global exception filter format it
      }
      throw error;
    }
  }
}
```

Usage per-route with explicit schema:

```typescript
@Post('register')
@UsePipes(new ZodValidationPipe(RegisterSchema))
async register(@Body() body: RegisterDto) {
  return this.authService.register(body);
}
```

Or integrate with `nestjs-zod`'s `@ZodValidator` decorator if available:

```typescript
import { ZodValidator } from 'nestjs-zod';

@Post('register')
@ZodValidator(RegisterSchema)
async register(@Body() body: RegisterDto) {
  return this.authService.register(body);
}
```

Register globally in `src/app.module.ts`:

```typescript
import { APP_PIPE } from '@nestjs/core';

@Module({
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,  // or new ZodValidationPipe() with config
    },
  ],
})
export class AppModule {}
```

**Key considerations:**

- **Zod v4 compatibility.** The project uses `zod@4.4.3` and `nestjs-zod@5.4.0`. Verify that `nestjs-zod`'s `ZodValidationPipe` works with Zod v4's API. If it doesn't (Zod v4 changed some internals), use the custom pipe approach (Option B) which is a thin wrapper around `schema.parse()`.
- **Exception filter integration.** When the pipe calls `schema.parse()` and it throws a `ZodError`, the global exception filter (Story 7.3) catches it and formats it into the standard error envelope. The pipe should NOT catch `ZodError` itself — let it propagate.
- **Schema-per-route vs global.** For maximum flexibility, define the Zod schema on each route via `@UsePipes(new ZodValidationPipe(SomeSchema))`. This way each route controls its own validation. A global pipe with automatic schema detection (via metadata) is possible but requires `nestjs-zod` decorators on DTOs.
- **Type inference.** Use `z.infer<typeof Schema>` to derive the TypeScript type for each DTO. The pipe ensures runtime validation matches compile-time types.
- **Stripping unknowns.** Zod's default behavior is to strip unknown keys from objects. This is the desired behavior per AD-11 — reject unknown fields silently (or throw if `forbidNonWhitelisted` is set).

### Dependencies

- Zod schemas from Story 1.10 (Epic 1) — `RegisterSchema`, `LoginSchema`, etc.
- `ZodError` type — from the `zod` package. Thrown by `schema.parse()`.
- Global exception filter from Story 7.3 — catches and formats `ZodError` into the standard error envelope.
- `nestjs-zod` package — already in `package.json` (v5.4.0). Provides `ZodValidationPipe` and related utilities.

---

## Summary

| Story | Key Deliverable | File Location |
|-------|----------------|---------------|
| 7.1 | Auth Middleware — extracts Bearer token from header | `src/modules/auth/auth.middleware.ts` |
| 7.2 | JwtAuthGuard — validates access tokens, checks blacklist | `src/modules/auth/guards/jwt-auth.guard.ts` |
| 7.3 | AllExceptionsFilter — formats all errors consistently | `src/shared/filters/all-exceptions.filter.ts` |
| 7.4 | ZodValidationPipe — rejects invalid input via Zod schemas | `src/shared/pipes/zod-validation.pipe.ts` |

**Note:** This epic completes the request authentication pipeline. All subsequent epics (logging, testing) can apply `@UseGuards(JwtAuthGuard)` to protect routes. The middleware → guard → filter → pipe pipeline is the cross-cutting infrastructure that every protected endpoint relies on.
