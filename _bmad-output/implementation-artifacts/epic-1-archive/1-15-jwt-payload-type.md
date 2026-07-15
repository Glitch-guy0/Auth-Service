---
story_id: 1.15
story_key: 1-15-jwt-payload-type
story_title: "JWT Payload Type"
epic_num: 1
story_num: 15
status: done
created_date: 2025-01-01
---

# Story 1.15: JWT Payload Type

## Story Summary
As a developer, I want the JwtPayload interface defined, so that JWT operations have type safety.

## User Story
**As a** developer,  
**I want** the JwtPayload interface defined,  
**So that** JWT operations have type safety.

## Acceptance Criteria

### Given the project
- When I check the JWT types
- Then JwtPayload has fields: sub (string, user_id), iat (number), iss (string), kid (string), exp (number)
- And role field has TODO comment for Phase 4 RBAC

## Technical Requirements

### Interface Definition
- Define `JwtPayload` interface in `src/types/jwt.types.ts`
- Export interface for use across the application
- Use TypeScript strict typing

### Required Fields
- `sub`: string (user_id - the subject of the token)
- `iat`: number (issued at - token creation timestamp)
- `iss`: string (issuer - the entity that issued the token)
- `kid`: string (key ID - identifies the signing key used)
- `exp`: number (expiration - token expiration timestamp)

### Optional/Deferred Fields
- `role`: string with TODO comment for Phase 4 RBAC implementation

### Field Types
- All numeric fields (iat, exp) should be Unix timestamps
- String fields should be properly typed
- Consider using branded types for additional type safety

## Developer Context

### File Structure Requirements
```
src/
├── types/
│   └── jwt.types.ts          # JwtPayload interface definition
```

### Interface Pattern
```typescript
export interface JwtPayload {
  sub: string;      // user_id - the subject of the token
  iat: number;      // issued at - token creation timestamp
  iss: string;      // issuer - the entity that issued the token
  kid: string;      // key ID - identifies the signing key used
  exp: number;      // expiration - token expiration timestamp
  // TODO: Add role field for Phase 4 RBAC
}
```

### Type Safety Considerations
- Consider using `Readonly<>` if the interface should be immutable
- Add JSDoc comments for each field for IDE support
- Export from `src/types/index.ts` for barrel imports

## Architecture Compliance

### Hexagonal Architecture
- Define types in the types directory (shared domain)
- Keep interface pure - no business logic
- Types are used by both ports and adapters

### Type Safety
- Enable TypeScript strict mode
- Use explicit types for all public APIs
- No `any` types allowed

### Module Organization
- Types are shared across modules
- Import from `@/types` using path aliases
- Maintain clean import hierarchy

## Testing Requirements

### Unit Tests
- Verify interface can be instantiated with required fields
- Test that all fields are accessible
- Validate TypeScript compilation

### Type Tests
- Ensure interface enforces required fields
- Verify type errors for missing fields
- Test compatibility with JWT libraries

### Test File Location
```
src/types/__tests__/
└── jwt.types.spec.ts
```

## Business Context

### Project Goals
- Build a secure, scalable authentication service
- Implement JWT-based authentication with refresh tokens
- Maintain type safety throughout the codebase

### Why This Matters
- JWT operations are core to the authentication service
- Type safety prevents runtime errors
- Clear payload structure enables consistent token handling
- TODO comment ensures RBAC is not forgotten in Phase 4

### Success Criteria
- JwtPayload interface is defined with all required fields
- Interface compiles without TypeScript errors
- Interface is exported and accessible from other modules
- Role field has clear TODO comment for Phase 4

## Implementation Notes

### Key Considerations
- Use descriptive JSDoc comments for each field
- Consider creating a type for user_id specifically
- Think about future extensibility without breaking changes

### Common Pitfalls
- Don't forget to export the interface
- Ensure all fields are required (not optional)
- Don't implement business logic in type definitions
- Keep interface simple - no methods, just data

### Best Practices
- Use descriptive field names matching JWT spec
- Add comments explaining the purpose of each field
- Consider creating a factory function for creating payloads
- Keep interface stable - changes affect all JWT operations

## Dependencies

### Epic Dependencies
- Part of Epic 1: Foundation & Types
- Depends on: Story 1.1 (NestJS Project Initialization)
- Depends on: Story 1.2 (TypeScript Configuration)
- Foundation for: Story 1.16 (JWT Operations)

### External Dependencies
- TypeScript 5.x (for interface features)
- None - this is a pure type definition

## Checklist

- [ ] Create `src/types/jwt.types.ts`
- [ ] Define `JwtPayload` interface with all required fields
- [ ] Add JSDoc comments for each field
- [ ] Add TODO comment for role field (Phase 4 RBAC)
- [ ] Export interface
- [ ] Update barrel exports in `src/types/index.ts`
- [ ] Create unit tests for type validation
- [ ] Verify TypeScript compilation
- [ ] Update dependencies if needed
- [ ] Document implementation decisions

---

*Story created using bmad-create-story workflow*  
*Status: ready-for-dev*  
*Next: Developer will implement JWT Payload Type interface*
