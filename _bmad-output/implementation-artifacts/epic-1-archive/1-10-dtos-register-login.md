---
story_id: 1.10
story_key: 1-10-dtos-register-login
story_title: "DTOs — Register & Login"
epic_num: 1
story_num: 10
status: done
created_date: 2025-01-01
---

# Story 1.10: DTOs — Register & Login

## Story Summary
As a developer, I want Zod schemas for registration and login validation, so that input is validated before reaching service logic.

## User Story
**As a** developer,  
**I want** Zod schemas for registration and login validation,  
**So that** input is validated before reaching service logic.

## Acceptance Criteria

### Given the project
- When I check `src/modules/auth/dto/register.dto.ts`
- Then `RegisterSchema` is defined with `z.object({ username: z.string().min(3), email: z.string().email(), password: z.string().min(8) })`
- And the schema infers the TypeScript type (`z.infer<typeof RegisterSchema>`)
- And the schema is exported for use in controller

### Given the project
- When I check `src/modules/auth/dto/login.dto.ts`
- Then `LoginSchema` is defined with `z.object({ usernameOrEmail: z.string(), password: z.string() })`
- And the schema infers the TypeScript type

## Technical Requirements

### Zod Schema Validation
- Use Zod (already a project dependency) for runtime input validation
- Define schemas as `z.object()` for structured validation
- Export both the schema and the inferred TypeScript type from each file

### Register Schema
- `username`: `z.string().min(3)` — minimum 3 characters
- `email`: `z.string().email()` — valid email format
- `password`: `z.string().min(8)` — minimum 8 characters

### Login Schema
- `usernameOrEmail`: `z.string()` — accepts either username or email (no format constraint)
- `password`: `z.string()` — raw password (validated by service layer)

### Exports
- Each file exports `RegisterSchema` / `LoginSchema` as a named constant
- Each file exports the inferred type as `RegisterDto` / `LoginDto`
- Types are inferred via `z.infer<typeof SchemaName>`

### File Locations
```
src/modules/auth/dto/
├── register.dto.ts    # RegisterSchema + RegisterDto
└── login.dto.ts       # LoginSchema + LoginDto
```

## Developer Context

### File Structure Requirements
```
src/
└── modules/
    └── auth/
        └── dto/
            ├── register.dto.ts    # THIS STORY
            └── login.dto.ts       # THIS STORY
```

### Code Patterns to Follow
```typescript
// register.dto.ts
import { z } from 'zod';

export const RegisterSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
```

```typescript
// login.dto.ts
import { z } from 'zod';

export const LoginSchema = z.object({
  usernameOrEmail: z.string(),
  password: z.string(),
});

export type LoginDto = z.infer<typeof LoginSchema>;
```

### Directory Setup
- Create `src/modules/auth/dto/` directory if it does not exist
- No barrel exports (`index.ts`) are required at this stage unless project convention dictates otherwise

## Architecture Compliance

### Hexagonal Architecture
- DTOs live in the adapter layer as input validation schemas
- Schemas validate incoming data before it reaches the service port
- No business logic in DTO files — pure schema definitions

### Type Safety
- Use `z.infer` for type derivation — single source of truth
- Exported types ensure controllers, services, and tests share the same shape
- Schemas serve as both runtime validators and compile-time type definitions

### Separation of Concerns
- DTOs define shape only — no validation logic beyond schema rules
- Service layer handles business rule validation (e.g., username uniqueness)
- Controller layer uses DTOs to parse and validate request bodies

## Testing Requirements

### Unit Tests
- Test that `RegisterSchema` accepts valid input (3-char username, valid email, 8-char password)
- Test that `RegisterSchema` rejects short username (< 3 chars)
- Test that `RegisterSchema` rejects invalid email format
- Test that `RegisterSchema` rejects short password (< 8 chars)
- Test that `LoginSchema` accepts any non-empty string for `usernameOrEmail` and `password`
- Test that inferred types match expected shapes

### Test File Locations
```
src/modules/auth/dto/__tests__/
├── register.dto.spec.ts
└── login.dto.spec.ts
```

### Test Framework
- Jest (already configured in project)
- Use `describe` / `it` blocks with clear naming
- Test both valid and invalid input cases

## Business Context

### Project Goals
- DTOs are the first line of defense for input validation
- Zod schemas provide a consistent validation approach across the auth module
- Inferred TypeScript types eliminate duplication between runtime and compile-time definitions

### Success Criteria
- `RegisterSchema` validates registration input with correct constraints
- `LoginSchema` validates login input
- Both schemas and inferred types are exported
- No business logic leaks into DTO files
- DTOs are ready for integration with controllers (future stories)

## Implementation Notes

### Key Considerations
- Keep DTOs minimal — schema + type only
- Avoid importing NestJS decorators (class-validator) — Zod replaces them for validation
- The `usernameOrEmail` field is intentionally loose — the service layer determines whether the input is a username or email
- Zod is already a project dependency (installed in Story 1.1)

### Common Pitfalls
- Don't add business validation rules (e.g., uniqueness checks) in DTOs
- Don't forget to export the inferred type alongside the schema
- Ensure `z.string().min(3)` is used for username (not `.min(1)`)
- Ensure `z.string().email()` is used for email (not just `z.string()`)
- Create the `dto/` directory before writing files

## Dependencies

### Epic Dependencies
- Story 1.1: NestJS Project Initialization (Zod dependency installed)
- Story 1.2: TypeScript Configuration (strict mode enabled)
- Story 1.6: User Entity Definition (user fields inform DTO shape)

### External Dependencies
- `zod` package (already installed in Story 1.1)

## Checklist

- [ ] Create `src/modules/auth/dto/` directory
- [ ] Create `register.dto.ts` with `RegisterSchema`
- [ ] Export `RegisterDto` type via `z.infer`
- [ ] Create `login.dto.ts` with `LoginSchema`
- [ ] Export `LoginDto` type via `z.infer`
- [ ] Write unit tests for `RegisterSchema` (valid + invalid cases)
- [ ] Write unit tests for `LoginSchema` (valid + invalid cases)
- [ ] Verify TypeScript compilation
- [ ] Run lint and typecheck

---

*Story created using bmad-create-story workflow*  
*Status: ready-for-dev*  
*Next: Developer will implement Register and Login DTOs with Zod schemas*
