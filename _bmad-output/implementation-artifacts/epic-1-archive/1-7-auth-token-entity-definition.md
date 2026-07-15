---
story_id: 1.7
story_key: 1-7-auth-token-entity-definition
story_title: "Auth Token Entity Definition"
epic_num: 1
story_num: 7
status: done
created_date: 2025-01-01
---

# Story 1.7: Auth Token Entity Definition

## Story Summary
As a developer, I want the AuthToken entity defined for refresh token storage, so that token operations have type safety.

## User Story
**As a** developer,  
**I want** the AuthToken entity defined for refresh token storage,  
**So that** token operations have type safety.

## Acceptance Criteria

### Given the project
- When I check the token entity file
- Then AuthToken entity has fields: user_id (UUID PK, FK to users), token_hash (string), expires_at (timestamp), updated_at (timestamp)
- And user_id is primary key (one row per user)
- And ON DELETE CASCADE is configured

### Given the AuthToken entity
- When I inspect the entity definition
- Then it uses TypeORM decorators for database mapping
- And user_id uses UUID type with primary column and foreign key constraint
- And token_hash stores the bcrypt-hashed refresh token

### Given the AuthToken entity
- When I check the entity exports
- Then it is properly exported for use in other modules

## Technical Requirements

### TypeORM Entity Definition
- Use `@Entity()` decorator to define the table name (`auth_tokens`)
- Use `@PrimaryColumn('uuid')` for user_id (not auto-generated — one row per user)
- Use `@Column()` for token_hash and expires_at
- Use `@UpdateDateColumn()` for updated_at
- Use `@ManyToOne()` or `@OneToOne()` with `@JoinColumn()` for the foreign key to users
- Configure `onDelete: 'CASCADE'` on the relationship

### Field Specifications
- **user_id**: UUID, primary key, foreign key to `users.id`, one row per user
- **token_hash**: string, not nullable (bcrypt-hashed refresh token)
- **expires_at**: timestamp, not nullable (token expiration time)
- **updated_at**: timestamp, auto-generated on update

### Database Configuration
- Table name: `auth_tokens`
- Use snake_case for column names
- Primary key is `user_id` (not auto-generated UUID)
- ON DELETE CASCADE ensures tokens are removed when user is deleted
- Single active session per user (AD-5 compliance)

### Relationship Configuration
- Foreign key: `user_id` references `users(id)`
- Cascade delete: when a user is deleted, their token is automatically removed
- One-to-one relationship: each user has at most one active refresh token

## Developer Context

### File Structure Requirements
```
src/modules/token/
├── auth-token.entity.ts      # AuthToken entity definition
├── token.module.ts           # Token module (future)
├── token.service.ts          # Token service (future)
└── token.controller.ts       # Token controller (future)
```

### Entity Code Structure
```typescript
import { Entity, PrimaryColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../user/user.entity';

@Entity('auth_tokens')
export class AuthToken {
  @PrimaryColumn('uuid')
  user_id: string;

  @Column()
  token_hash: string;

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
```

### Import Paths
- Import from `typeorm` for decorators
- Import `User` entity from `@modules/user/user.entity`
- Use path alias `@modules/token` for cross-module imports

### Design Rationale (AD-5)
- `user_id` as PK ensures one row per user (single active session)
- Login uses `INSERT ... ON CONFLICT (user_id) DO UPDATE` (UPSERT)
- Refresh rotates the single token (delete old, insert new)
- No `token_type` column — each user has exactly one refresh token

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
- Place entity in token module directory
- Follow NestJS module conventions
- Prepare for future module expansion

### Architecture Spine Compliance
- **AD-3**: AuthToken lives in PostgreSQL (core auth data)
- **AD-5**: user_id PK enforces single active session per user
- **AD-16**: TokenRepository owns all writes to auth_tokens table

## Testing Requirements

### Unit Tests
- Test entity instantiation with valid data
- Test field types and constraints
- Test UUID format for user_id
- Test timestamp auto-generation for updated_at

### Integration Tests
- Verify entity maps correctly to database schema
- Test foreign key constraint to users table
- Test ON DELETE CASCADE behavior
- Test UPSERT behavior (INSERT ... ON CONFLICT)

### Test File Location
```
src/modules/token/
└── __tests__/
    └── auth-token.entity.spec.ts
```

## Business Context

### Project Goals
- Build a secure, scalable authentication service
- Implement JWT-based authentication with refresh tokens
- Support user registration, login, logout, and token refresh

### Success Criteria
- AuthToken entity defined with all required fields
- user_id as primary key (one row per user)
- Foreign key to users table with ON DELETE CASCADE
- Type-safe entity for database operations
- Compatible with UPSERT pattern for login/refresh

### Token Management
- AuthToken stores hashed refresh tokens (not raw tokens)
- Single active session per user (enforced by PK)
- Token rotation on each refresh (delete old, insert new)
- Automatic cleanup when user is deleted (cascade)

## Implementation Notes

### Key Considerations
- Use TypeORM decorators for database mapping
- Keep entity definition simple and focused
- No business logic in entity
- user_id is NOT auto-generated (it's a foreign key)
- expires_at should use timestamp type for proper date handling
- token_hash stores bcrypt-hashed token (not the raw token)

### Common Pitfalls
- Don't use PrimaryGeneratedColumn — user_id is a foreign key, not auto-generated
- Ensure ON DELETE CASCADE is configured on the relationship
- Use @PrimaryColumn, not @Column with unique constraint
- Use @UpdateDateColumn, not @CreateDateColumn (token is updated on rotation)
- Don't store raw tokens — always store hashed tokens

### Future Enhancements
- Add index on expires_at for cleanup queries
- Add soft delete capability
- Add token metadata (IP, user agent) for security auditing
- Consider adding created_at for token creation tracking

## Dependencies

### Epic Dependencies
- Depends on story 1.1 (NestJS Project Initialization)
- Depends on story 1.2 (TypeScript Configuration)
- Depends on story 1.6 (User Entity Definition) — foreign key reference
- Foundation for token module implementation

### External Dependencies
- TypeORM v0.3.x for entity decorators
- PostgreSQL for UUID generation
- No additional npm packages required

## Checklist

- [ ] Create token module directory structure
- [ ] Define AuthToken entity with TypeORM decorators
- [ ] Add user_id as PrimaryColumn (UUID, FK to users)
- [ ] Add token_hash field (string, not nullable)
- [ ] Add expires_at field (timestamp, not nullable)
- [ ] Add updated_at field (UpdateDateColumn)
- [ ] Configure ManyToOne relationship to User entity
- [ ] Set ON DELETE CASCADE on foreign key
- [ ] Export entity for module use
- [ ] Write unit tests for entity definition
- [ ] Verify entity compiles with TypeScript
- [ ] Document entity structure

---

*Story created using bmad-create-story workflow*  
*Status: ready-for-dev*  
*Next: Developer will implement Auth Token entity definition*
