---
story_id: 1.6
story_key: 1-6-user-entity-definition
story_title: "User Entity Definition"
epic_num: 1
story_num: 6
status: done
created_date: 2025-01-01
---

# Story 1.6: User Entity Definition

## Story Summary
As a developer, I want the User entity defined with all fields and relationships, so that database operations have type safety.

## User Story
**As a** developer,  
**I want** the User entity defined with all fields and relationships,  
**So that** database operations have type safety.

## Acceptance Criteria

### Given the project
- When I check `src/modules/user/user.entity.ts`
- Then User entity has fields: id (UUID), username (string, unique), email (string, unique), password (string), blocked (boolean), is_verified (boolean), created_at (timestamp), updated_at (timestamp)
- And username and email have unique constraints

### Given the User entity
- When I inspect the entity definition
- Then it uses TypeORM decorators for database mapping
- And id field uses UUID type with primary column
- And timestamp fields are auto-generated

### Given the User entity
- When I check the entity exports
- Then it is properly exported for use in other modules

## Technical Requirements

### TypeORM Entity Definition
- Use `@Entity()` decorator to define the table name
- Use `@PrimaryGeneratedColumn('uuid')` for id field
- Use `@Column()` with `unique: true` for username and email
- Use `@Column()` for password, blocked, and is_verified
- Use `@CreateDateColumn()` for created_at
- Use `@UpdateDateColumn()` for updated_at

### Field Specifications
- **id**: UUID, auto-generated, primary key
- **username**: string, unique, not nullable
- **email**: string, unique, not nullable
- **password**: string, not nullable (hashed password)
- **blocked**: boolean, default false
- **is_verified**: boolean, default false
- **created_at**: timestamp, auto-generated on creation
- **updated_at**: timestamp, auto-generated on update

### Database Configuration
- Table name: `users`
- Use snake_case for column names
- Enable timestamps for audit trail

## Developer Context

### File Structure Requirements
```
src/modules/user/
├── user.entity.ts          # User entity definition
├── user.module.ts          # User module (future)
├── user.service.ts         # User service (future)
└── user.controller.ts      # User controller (future)
```

### Entity Code Structure
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ default: false })
  blocked: boolean;

  @Column({ default: false })
  is_verified: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

### Import Paths
- Import from `typeorm` for decorators
- Use path alias `@modules/user` for cross-module imports

## Architecture Compliance

### Hexagonal Architecture
- Entity represents the core domain model
- No business logic in entity definition
- Pure data structure for database mapping

### Type Safety
- All fields have explicit TypeScript types
- Use strict mode compatible types
- Export entity for type inference in other modules

### Module Organization
- Place entity in user module directory
- Follow NestJS module conventions
- Prepare for future module expansion

## Testing Requirements

### Unit Tests
- Test entity instantiation with valid data
- Test field types and constraints
- Test default values for boolean fields
- Test timestamp auto-generation

### Integration Tests
- Verify entity maps correctly to database schema
- Test unique constraint enforcement
- Test UUID generation

### Test File Location
```
src/modules/user/
└── __tests__/
    └── user.entity.spec.ts
```

## Business Context

### Project Goals
- Build a secure, scalable authentication service
- Implement JWT-based authentication with refresh tokens
- Support user registration, login, logout, and token refresh

### Success Criteria
- User entity defined with all required fields
- Unique constraints on username and email
- UUID primary key for secure identification
- Timestamps for audit trail
- Type-safe entity for database operations

### User Management
- Users are the core entity in the authentication system
- Entity supports registration, login, and profile management
- Blocked flag enables user suspension
- Verified flag supports email verification flow

## Implementation Notes

### Key Considerations
- Use TypeORM decorators for database mapping
- Keep entity definition simple and focused
- No business logic in entity
- Prepare for future relationships (tokens, roles)

### Common Pitfalls
- Don't forget unique constraints on username and email
- Use UUID instead of auto-increment for security
- Enable strict mode in TypeScript
- Use snake_case for database column names

### Future Enhancements
- Add relationships to Token entity
- Add roles/permissions relationship
- Add profile fields (avatar, bio, etc.)
- Add soft delete capability

## Dependencies

### Epic Dependencies
- Depends on story 1.1 (NestJS Project Initialization)
- Depends on story 1.2 (TypeScript Configuration)
- Foundation for user module implementation

### External Dependencies
- TypeORM v0.3.x for entity decorators
- PostgreSQL for UUID generation
- No additional npm packages required

## Checklist

- [ ] Create user module directory structure
- [ ] Define User entity with TypeORM decorators
- [ ] Add all required fields with proper types
- [ ] Set unique constraints on username and email
- [ ] Configure UUID primary key
- [ ] Add timestamp fields with auto-generation
- [ ] Export entity for module use
- [ ] Write unit tests for entity definition
- [ ] Verify entity compiles with TypeScript
- [ ] Document entity structure

---

*Story created using bmad-create-story workflow*  
*Status: ready-for-dev*  
*Next: Developer will implement User entity definition*