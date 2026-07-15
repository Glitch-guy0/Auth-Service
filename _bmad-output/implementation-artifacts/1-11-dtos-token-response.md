---
story_id: 1.11
story_key: 1-11-dtos-token-response
story_title: "DTOs — Token Response"
epic_num: 1
story_num: 11
status: ready-for-dev
created_date: 2026-07-15
---

# Story 1.11: DTOs — Token Response

## Story Summary
As a developer, I want Zod schema for token responses, so that API responses have consistent structure.

## User Story
**As a** developer,  
**I want** Zod schema for token responses,  
**So that** API responses have consistent structure.

## Acceptance Criteria

### Given the project
- When I check the token DTOs
- Then `TokenResponseSchema` is defined with `z.object({ accessToken: z.string(), expiresIn: z.number() })`
- And the schema infers the TypeScript type (`z.infer<typeof TokenResponseSchema>`)

## Technical Requirements

### Zod Schema Validation
- Use Zod (already a project dependency) for response schema definition
- Define `TokenResponseSchema` as `z.object()` for structured response typing
- Export both the schema and the inferred TypeScript type

### Token Response Schema
- `accessToken`: `z.string()` — the signed JWT access token
- `expiresIn`: `z.number()` — token expiry duration in seconds

### Exports
- Export `TokenResponseSchema` as a named constant
- Export the inferred type as `TokenResponseDto`
- Type is inferred via `z.infer<typeof TokenResponseSchema>`

### File Location
```
src/modules/auth/dto/token-response.dto.ts    # TokenResponseSchema + TokenResponseDto
```

## Developer Context

### File Structure Requirements
```
src/
└── modules/
    └── auth/
        └── dto/
            ├── register.dto.ts    # Story 1.10
            ├── login.dto.ts       # Story 1.10
            └── token-response.dto.ts    # THIS STORY
```

### Code Patterns to Follow
```typescript
// token-response.dto.ts
import { z } from 'zod';

export const TokenResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
});

export type TokenResponseDto = z.infer<typeof TokenResponseSchema>;
```

### Directory Setup
- `src/modules/auth/dto/` directory should already exist from Story 1.10
- No barrel exports (`index.ts`) are required at this stage unless project convention dictates otherwise

## Architecture Compliance

### Hexagonal Architecture
- Token response DTO lives in the adapter layer as output schema definition
- Schema defines the shape of API responses sent to clients
- No business logic in DTO files — pure schema definitions

### Type Safety
- Use `z.infer` for type derivation — single source of truth
- Exported type ensures controllers, services, and tests share the same response shape
- Schema serves as both documentation and compile-time type definition

### Separation of Concerns
- DTO defines response shape only — no transformation logic
- Service layer generates the token and expiry values
- Controller layer uses DTO to type the response body

## Testing Requirements

### Unit Tests
- Test that `TokenResponseSchema` accepts valid input (string accessToken, number expiresIn)
- Test that `TokenResponseSchema` rejects non-string accessToken
- Test that `TokenResponseSchema` rejects non-number expiresIn
- Test that inferred type matches expected shape

### Test File Location
```
src/modules/auth/dto/__tests__/
└── token-response.dto.spec.ts
```

### Test Framework
- Jest (already configured in project)
- Use `describe` / `it` blocks with clear naming
- Test both valid and invalid input cases

## Business Context

### Project Goals
- Token response DTO defines the standard shape for all auth-related API responses
- Ensures consistency across registration, login, and refresh endpoints
- `expiresIn` as a number (seconds) allows clients to calculate exact expiry times
- Zod schema enables runtime validation if needed for response testing

### Success Criteria
- `TokenResponseSchema` correctly defines `{ accessToken: string, expiresIn: number }`
- Schema and inferred type are exported
- No business logic leaks into DTO file
- DTO is ready for integration with controllers and services (future stories)

## Implementation Notes

### Key Considerations
- Keep DTO minimal — schema + type only
- The `accessToken` is the signed JWT string (not the payload)
- The `expiresIn` is the TTL in seconds (number), matching the JWT `exp` claim convention
- This DTO is used by registration (Story 3.6), login (Story 4.3), and refresh (Story 5.2) endpoints

### Common Pitfalls
- Don't add business logic (e.g., token generation) in DTO
- Don't forget to export the inferred type alongside the schema
- Ensure `expiresIn` is `z.number()` (not `z.string()`) — it represents seconds as a number
- Follow the same export pattern as Stories 1.10 (schema + inferred type)

## Dependencies

### Epic Dependencies
- Story 1.1: NestJS Project Initialization (Zod dependency installed)
- Story 1.2: TypeScript Configuration (strict mode enabled)
- Story 1.10: DTOs — Register & Login (dto directory created, pattern established)

### External Dependencies
- `zod` package (already installed in Story 1.1)

## Checklist

- [ ] Create `token-response.dto.ts` in `src/modules/auth/dto/`
- [ ] Define `TokenResponseSchema` with `accessToken` (string) and `expiresIn` (number)
- [ ] Export `TokenResponseDto` type via `z.infer`
- [ ] Write unit tests for `TokenResponseSchema` (valid + invalid cases)
- [ ] Verify TypeScript compilation
- [ ] Run lint and typecheck

---

*Story created using bmad-create-story workflow*  
*Status: ready-for-dev*  
*Next: Developer will implement Token Response DTO with Zod schema*