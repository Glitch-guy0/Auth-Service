---
story_id: 1.16
story_key: 1-16-api-response-types
story_title: "API Response Types"
epic_num: 1
story_num: 16
status: ready-for-dev
created_date: 2025-01-01
---

# Story 1.16: API Response Types

## Story Summary
As a developer, I want standardized API response types, so that all endpoints return consistent response shapes.

## User Story
**As a** developer,
**I want** standardized API response types,
**So that** all endpoints return consistent response shapes.

## Acceptance Criteria

### Given the project
- When I check the shared types
- Then `SuccessResponse<T>` type exists with `success` (true) and `data` (T)
- And `ErrorResponse` type exists with `success` (false) and `error` (`code`, `message`, `timestamp`, `path`)

## Technical Requirements

### Response Types
- Define `SuccessResponse<T>` generic type with `success: true` and `data: T`
- Define `ErrorResponse` type with `success: false` and `error` object containing:
  - `code: string` — machine-readable error code (e.g., `AUTH_001`)
  - `message: string` — human-readable error description
  - `timestamp: string` — ISO 8601 timestamp of when the error occurred
  - `path: string` — the request path that triggered the error
- Export all types for use across API endpoints

### Type Utilities
- Consider a union type `ApiResponse<T>` = `SuccessResponse<T> | ErrorResponse` for flexible typing
- Ensure types are compatible with NestJS response interceptors and Swagger decorators

### File Location
- Define types in `src/types/api-response.types.ts`

## Developer Context

### File Structure Requirements
```
src/
├── types/
│   └── api-response.types.ts    # SuccessResponse<T>, ErrorResponse, ApiResponse<T>
```

### Type Definitions
```typescript
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorDetail {
  code: string;
  message: string;
  timestamp: string;
  path: string;
}

export interface ErrorResponse {
  success: false;
  error: ErrorDetail;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
```

### Usage Pattern
```typescript
// Success response
const response: SuccessResponse<UserDto> = {
  success: true,
  data: userDto,
};

// Error response
const response: ErrorResponse = {
  success: false,
  error: {
    code: 'AUTH_001',
    message: 'Invalid credentials',
    timestamp: new Date().toISOString(),
    path: '/auth/login',
  };
};
```

## Architecture Compliance

### Hexagonal Architecture
- Types are pure TypeScript definitions with no external dependencies
- Can be used by both inbound (controllers/interceptors) and outbound (services) adapters
- No coupling to specific frameworks or infrastructure

### Consistency
- All API endpoints should return responses conforming to `ApiResponse<T>`
- Error responses follow a standardized shape for client-side error handling
- Success responses wrap data in a `data` field for uniform access patterns

### Type Safety
- Generic `SuccessResponse<T>` enforces type-safe data payloads
- Discriminated union via `success` boolean allows TypeScript narrowing
- All fields are required — no optional ambiguity in response shapes

## Testing Requirements

### Type Tests
- Verify `SuccessResponse<T>` compiles with various generic types
- Verify `ErrorResponse` compiles with valid `ErrorDetail` fields
- Verify `ApiResponse<T>` union type narrows correctly based on `success` discriminant

### Unit Tests
- Create test file at `src/types/__tests__/api-response.types.test.ts`
- Test type compatibility with mock data shapes
- Ensure types work with NestJS `@nestjs/swagger` decorators if used

## Business Context

### Project Goals
- Establish consistent API response contracts across all endpoints
- Simplify client-side error handling with predictable response shapes
- Enable TypeScript type narrowing for success vs. error responses

### Success Criteria
- `SuccessResponse<T>` and `ErrorResponse` types exist and are exported
- Types include all required fields per acceptance criteria
- Types compile without errors in strict TypeScript mode
- Types are importable from `src/types/api-response.types.ts`

## Implementation Notes

### Key Considerations
- Use a discriminated union (`success` field) for TypeScript type narrowing
- Keep types as plain interfaces — no runtime logic
- Ensure `timestamp` uses ISO 8601 string format for consistency
- `path` should reflect the request route, not the file path

### Common Pitfalls
- Forgetting to export the `ErrorDetail` interface (needed for external consumers)
- Not using a generic for `SuccessResponse` — data type must be flexible
- Mixing up `success` boolean values between the two types

## Dependencies

### Epic Dependencies
- Part of Epic 1: Foundation & Types
- No dependencies on other stories within Epic 1
- Types will be consumed by later stories (interceptors, controllers, filters)

### External Dependencies
- None — pure TypeScript type definitions

## Checklist

- [ ] Create `src/types/api-response.types.ts`
- [ ] Define `SuccessResponse<T>` interface with `success: true` and `data: T`
- [ ] Define `ErrorDetail` interface with `code`, `message`, `timestamp`, `path`
- [ ] Define `ErrorResponse` interface with `success: false` and `error: ErrorDetail`
- [ ] Define `ApiResponse<T>` union type
- [ ] Export all types
- [ ] Verify TypeScript compilation in strict mode
- [ ] Create type tests

---

*Story created using bmad-create-story workflow*
*Status: ready-for-dev*
*Next: Developer will implement API response types*
