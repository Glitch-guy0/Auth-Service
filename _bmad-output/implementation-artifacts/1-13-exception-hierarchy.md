---
story_id: 1.13
story_key: 1-13-exception-hierarchy
story_title: "Exception Hierarchy"
epic_num: 1
story_num: 13
status: ready-for-dev
created_date: 2025-01-01
---

# Story 1.13: Exception Hierarchy

## Story Summary
As a developer, I want the complete exception hierarchy defined, so that error handling is consistent across the application.

## User Story
**As a** developer,  
**I want** the complete exception hierarchy defined,  
**So that** error handling is consistent across the application.

## Acceptance Criteria

### Given the project
- When I check the exception files
- Then BaseAuthException exists as the root exception class

### Given the project
- When I check the exception files
- Then AuthenticationException exists with HTTP status 401
- And InvalidCredentialsException extends AuthenticationException
- And TokenExpiredException extends AuthenticationException
- And TokenRevokedException extends AuthenticationException
- And TokenInvalidSignatureException extends AuthenticationException

### Given the project
- When I check the exception files
- Then AuthorizationException exists with HTTP status 403
- And UserBlockedException extends AuthorizationException

### Given the project
- When I check the exception files
- Then ValidationException exists with HTTP status 400
- And UserExistsException extends ValidationException

### Given the project
- When I check the exception files
- Then each exception has a unique error code matching the pattern (AUTH_*, TOKEN_*, VALIDATION_*)

## Technical Requirements

### BaseAuthException (Root Class)
```typescript
export abstract class BaseAuthException extends Error {
  public readonly errorCode: string;
  public readonly statusCode: number;
  public readonly timestamp: string;

  constructor(message: string, errorCode: string, statusCode: number) {
    super(message);
    this.name = this.constructor.name;
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();
  }
}
```

### AuthenticationException Tree (401)
```typescript
export class AuthenticationException extends BaseAuthException {
  constructor(message: string, errorCode: string) {
    super(message, errorCode, 401);
  }
}

export class InvalidCredentialsException extends AuthenticationException {
  constructor(message = 'Invalid credentials provided') {
    super(message, 'AUTH_INVALID_CREDENTIALS');
  }
}

export class TokenExpiredException extends AuthenticationException {
  constructor(message = 'Token has expired') {
    super(message, 'TOKEN_EXPIRED');
  }
}

export class TokenRevokedException extends AuthenticationException {
  constructor(message = 'Token has been revoked') {
    super(message, 'TOKEN_REVOKED');
  }
}

export class TokenInvalidSignatureException extends AuthenticationException {
  constructor(message = 'Token signature is invalid') {
    super(message, 'TOKEN_INVALID_SIGNATURE');
  }
}
```

### AuthorizationException Tree (403)
```typescript
export class AuthorizationException extends BaseAuthException {
  constructor(message: string, errorCode: string) {
    super(message, errorCode, 403);
  }
}

export class UserBlockedException extends AuthorizationException {
  constructor(message = 'User account is blocked') {
    super(message, 'AUTH_USER_BLOCKED');
  }
}
```

### ValidationException Tree (400)
```typescript
export class ValidationException extends BaseAuthException {
  constructor(message: string, errorCode: string) {
    super(message, errorCode, 400);
  }
}

export class UserExistsException extends ValidationException {
  constructor(message = 'User with this email or username already exists') {
    super(message, 'VALIDATION_USER_EXISTS');
  }
}
```

### Error Code Table
| Exception | Error Code | HTTP Status |
|---|---|---|
| InvalidCredentialsException | AUTH_INVALID_CREDENTIALS | 401 |
| TokenExpiredException | TOKEN_EXPIRED | 401 |
| TokenRevokedException | TOKEN_REVOKED | 401 |
| TokenInvalidSignatureException | TOKEN_INVALID_SIGNATURE | 401 |
| UserBlockedException | AUTH_USER_BLOCKED | 403 |
| UserExistsException | VALIDATION_USER_EXISTS | 400 |

### Exception Filter (NestJS Global Filter)
- Create a global exception filter that catches `BaseAuthException`
- Return structured JSON responses with error code, message, status code, and timestamp
- Implement `ExceptionFilter` interface from `@nestjs/common`

### Response Shape
```typescript
{
  statusCode: number,
  errorCode: string,
  message: string,
  timestamp: string,
  path: string
}
```

### Export Requirements
- All exceptions must be exported from individual files
- Barrel export file at `src/common/exceptions/index.ts`
- Import paths should use the configured path aliases

## Developer Context

### File Structure Requirements
```
src/
└── common/
    └── exceptions/
        ├── base.exception.ts              # BaseAuthException
        ├── authentication.exception.ts     # AuthenticationException + subclasses
        ├── authorization.exception.ts      # AuthorizationException + subclasses
        ├── validation.exception.ts          # ValidationException + subclasses
        ├── exception.filter.ts             # Global exception filter
        └── index.ts                        # Barrel export
```

### Implementation Order
1. `base.exception.ts` — abstract root class
2. `authentication.exception.ts` — 401 tree (export all 4 subclasses + parent)
3. `authorization.exception.ts` — 403 tree (export UserBlockedException + parent)
4. `validation.exception.ts` — 400 tree (export UserExistsException + parent)
5. `exception.filter.ts` — global NestJS filter for BaseAuthException
6. `index.ts` — barrel export

### Class Design Decisions
- `BaseAuthException` is abstract — never instantiated directly
- Each subclass provides a sensible default message
- Error codes use UPPER_SNAKE_CASE with prefixes (AUTH_, TOKEN_, VALIDATION_)
- Status codes align with HTTP semantics (400, 401, 403)
- `timestamp` is ISO 8601 string set at exception construction time

### NestJS Integration
- Global exception filter registered in `app.module.ts` providers
- Filter implements `ExceptionFilter<BaseAuthException>`
- Filter catches `BaseAuthException` and returns structured JSON
- Unhandled non-auth exceptions should fall through to NestJS default handler

## Architecture Compliance

### Hexagonal Architecture
- Exceptions are domain artifacts — part of the core business logic layer
- No infrastructure dependencies in exception classes
- Exception filter bridges domain exceptions to HTTP responses (adapter layer)

### Error Handling Strategy
- Domain layer throws typed exceptions
- Adapter layer (filter) catches and transforms to HTTP responses
- Consumers can catch specific exception types for granular error handling
- Consistent response format across all API endpoints

### Type Safety
- Extend native `Error` for instanceof compatibility
- All properties are `readonly` for immutability
- `errorCode` is a string literal (not enum) for flexibility
- Constructor defaults ensure consistent error messages

## Testing Requirements

### Unit Tests
- Verify each exception class can be instantiated
- Confirm instanceof checks work correctly across the hierarchy
- Verify default messages for each subclass
- Confirm error codes and status codes are correct
- Test that `timestamp` is set on construction

### Exception Filter Tests
- Verify filter catches BaseAuthException subclasses
- Confirm response shape matches the contract
- Test that non-auth exceptions are not caught by the filter

### Test Examples
```typescript
describe('AuthenticationException', () => {
  it('should create InvalidCredentialsException with correct error code', () => {
    const error = new InvalidCredentialsException();
    expect(error).toBeInstanceOf(BaseAuthException);
    expect(error).toBeInstanceOf(AuthenticationException);
    expect(error.statusCode).toBe(401);
    expect(error.errorCode).toBe('AUTH_INVALID_CREDENTIALS');
  });
});
```

## Business Context

### Project Goals
- Establish consistent error handling patterns across the entire application
- Enable clients to programmatically handle specific error conditions
- Provide clear, actionable error messages to API consumers
- Differentiate between client errors (4xx) for appropriate HTTP response codes

### Success Criteria
- All exception classes defined with correct inheritance
- Each exception has a unique error code
- Global exception filter returns structured JSON responses
- Exception instances pass instanceof checks correctly
- TypeScript compilation succeeds with no errors

## Implementation Notes

### Key Considerations
- Keep exception classes simple — no business logic, just error metadata
- Use default parameter values for messages to reduce boilerplate
- Error codes should be descriptive enough for clients to handle programmatically
- Register the global filter in `app.module.ts` providers array
- Consider adding Zod validation pipe integration for ValidationException later

### Common Pitfalls
- Don't make exception properties mutable — use `readonly`
- Don't forget to call `super(message)` in every constructor
- Ensure each subclass passes instanceof checks for all ancestors
- Don't put business logic in exception classes
- Remember to export all classes from the barrel file

## Dependencies

### Epic Dependencies
- Story 1.1: NestJS Project Initialization (project is set up)
- Story 1.2: TypeScript Configuration (strict mode enabled)

### External Dependencies
- `@nestjs/common` for the ExceptionFilter interface and HttpException
- TypeScript 5.x for class inheritance

## Checklist

- [ ] Create BaseAuthException abstract class in `base.exception.ts`
- [ ] Create AuthenticationException with InvalidCredentialsException, TokenExpiredException, TokenRevokedException, TokenInvalidSignatureException in `authentication.exception.ts`
- [ ] Create AuthorizationException with UserBlockedException in `authorization.exception.ts`
- [ ] Create ValidationException with UserExistsException in `validation.exception.ts`
- [ ] Create global exception filter for BaseAuthException in `exception.filter.ts`
- [ ] Create barrel export file `index.ts`
- [ ] Verify instanceof checks work across the hierarchy
- [ ] Verify TypeScript compilation succeeds
- [ ] Verify exception filter returns correct JSON shape
- [ ] Register exception filter in app.module.ts

---

*Story created using bmad-create-story workflow*
*Status: ready-for-dev*
*Next: Developer will implement the complete exception hierarchy*
