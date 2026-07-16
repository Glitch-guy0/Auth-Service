---
story_id: 3.4
story_key: 3-4-user-service-crud
story_title: "UserService — User CRUD"
epic_num: 3
story_num: 4
status: ready-for-dev
created_date: 2025-07-15
---

# Story 3.4: UserService — User CRUD

## Story Summary
As a developer, I want the UserService to manage user records, so that user operations are properly encapsulated.

## User Story
**As a** developer,
**I want** the UserService to manage user records,
**So that** user operations are properly encapsulated.

## Acceptance Criteria

### Given UserService is configured
- When `UserService.findByEmail(email)` is called
- Then it queries PostgreSQL for the user and returns User entity or null

### Given UserService is configured
- When `UserService.findByUsername(username)` is called
- Then it queries PostgreSQL for the user and returns User entity or null

### Given UserService is configured
- When `UserService.create(userData)` is called
- Then it inserts a new user into PostgreSQL and returns the created User entity

## Technical Requirements

### UserService
- Implement the `IUserService` port from `src/common/ports/user.port.ts`
- This story covers only `findByEmail`, `findByUsername`, and `create` — the core CRUD operations
- `logDemographics` is covered in a subsequent story

### Interface (from Story 1.12)
```typescript
export interface IUserService {
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(dto: RegisterDto): Promise<User>;
  logDemographics(
    userId: string,
    ip: string,
    location?: { country: string; city: string },
  ): Promise<void>;
}
```

### RegisterDto (from `src/modules/auth/dto/register.dto.ts`)
```typescript
export const RegisterSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
```

### User Entity (from `src/modules/user/user.entity.ts`)
```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true, length: 50 })
  username!: string;

  @Column({ type: 'varchar', unique: true, length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  password!: string;

  @Column({ type: 'boolean', default: false })
  blocked!: boolean;

  @Column({ type: 'boolean', default: false })
  is_verified!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
```

### Implementation Details
- Use TypeORM `Repository<User>` injected via `@InjectRepository(User)`
- Use `bcrypt` (already installed) for password hashing in `create`
- Use `Logger` from `@nestjs/common` for structured logging
- `findByEmail` and `findByUsername` use repository `findOne` with `where` clause
- `create` hashes the password before inserting, then returns the saved entity
- `logDemographics` is stubbed with `throw new Error('Not implemented')` — covered in a later story

### Service Skeleton
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '@modules/user/user.entity';
import { IUserService } from '@/common/ports/user.port';
import { RegisterDto } from '@modules/auth/dto/register.dto';

@Injectable()
export class UserService implements IUserService {
  private readonly logger = new Logger(UserService.name);
  private readonly SALT_ROUNDS = 12;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    this.logger.debug(`Looking up user by email: ${email}`);
    return this.userRepository.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<User | null> {
    this.logger.debug(`Looking up user by username: ${username}`);
    return this.userRepository.findOne({ where: { username } });
  }

  async create(dto: RegisterDto): Promise<User> {
    this.logger.debug(`Creating user: ${dto.email}`);
    const hashedPassword = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    const user = this.userRepository.create({
      username: dto.username,
      email: dto.email,
      password: hashedPassword,
    });
    return this.userRepository.save(user);
  }

  async logDemographics(
    _userId: string,
    _ip: string,
    _location?: { country: string; city: string },
  ): Promise<void> {
    // Covered in a subsequent story
    throw new Error('Not implemented');
  }
}
```

### Module Updates
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { User } from './user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

## Developer Context

### File Structure Requirements
```
src/
├── modules/
│   └── user/
│       ├── user.service.ts              # Service implementation (this story)
│       ├── user.module.ts               # NestJS module (already exists, update)
│       ├── user.entity.ts               # Entity (already exists, untouched)
│       └── __tests__/
│           └── user.service.spec.ts     # Unit tests
├── common/
│   └── ports/
│       └── user.port.ts                 # IUserService interface (from Story 1.12)
└── modules/
    └── auth/
        └── dto/
            └── register.dto.ts          # RegisterDto (existing, untouched)
```

### Dependencies

#### Epic Dependencies
- Story 1.12: Service Interfaces (`IUserService` interface)
- Story 1.8: User Entity (`User` entity, `src/modules/user/user.entity.ts`)

#### External Dependencies
- `bcrypt` — password hashing (already in `package.json`)
- `@nestjs/typeorm` — TypeORM integration for NestJS
- `typeorm` — Repository pattern, `findOne`, `create`, `save`
- `@nestjs/common` — Injectable, Logger decorators

## Architecture Compliance

### Hexagonal Architecture
- UserService implements `IUserService` port (from Story 1.12)
- Depends on TypeORM `Repository<User>` — a TypeORM adapter for the User aggregate
- Domain logic (password hashing, user lookup) is encapsulated in the service
- Implementation is swappable (e.g., could replace TypeORM with Prisma)

### Module Boundaries
- UserService belongs to UserModule
- UserModule imports `TypeOrmModule.forFeature([User])` for repository injection
- Exported from UserModule for consumption by other modules (e.g., AuthModule)

## Testing Requirements

### Unit Tests (`src/modules/user/__tests__/user.service.spec.ts`)
- Test that `findByEmail` calls `userRepository.findOne` with correct `where` clause
- Test that `findByEmail` returns the user entity when found
- Test that `findByEmail` returns null when no user is found
- Test that `findByUsername` calls `userRepository.findOne` with correct `where` clause
- Test that `findByUsername` returns the user entity when found
- Test that `findByUsername` returns null when no user is found
- Test that `create` hashes the password before saving (password in DB !== plaintext)
- Test that `create` calls `userRepository.create` and `userRepository.save` with correct data
- Test that `create` returns the saved user entity with generated `id`, `created_at`, `updated_at`
- Test that `logDemographics` throws "Not implemented"

### Mock Strategy
- Mock `Repository<User>` — provide fake `findOne`, `create`, and `save` methods
- Use `bcrypt.compare` in tests to verify password was hashed correctly
- Generate test user data with `faker` or hardcoded values

### Test Configuration
- Use Jest for unit testing
- Mock repository with `repositoryMock` factory returning `User` entities
- Use `beforeEach` to reset mocks between tests

## Checklist

- [ ] Create `UserService` class implementing `IUserService`
- [ ] Inject `Repository<User>` via `@InjectRepository(User)`
- [ ] Implement `findByEmail(email)` — queries repository with `findOne({ where: { email } })`
- [ ] Implement `findByUsername(username)` — queries repository with `findOne({ where: { username } })`
- [ ] Implement `create(dto)` — hashes password with `bcrypt.hash` (12 rounds), then `repository.create` + `repository.save`
- [ ] Stub `logDemographics` with "Not implemented" error
- [ ] Add structured logging for all methods
- [ ] Update `UserModule` to import `TypeOrmModule.forFeature([User])` and export `UserService`
- [ ] Create unit tests for all 3 CRUD methods
- [ ] Test password hashing (hash is not plaintext, bcrypt.compare succeeds)
- [ ] Test null returns for find methods when no user exists
- [ ] Run lint and typecheck

---

*Story created using bmad-create-story workflow*
*Status: ready-for-dev*
*Next: Developer will implement UserService CRUD operations*
