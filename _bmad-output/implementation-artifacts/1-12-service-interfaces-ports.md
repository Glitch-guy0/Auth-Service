---
story_id: 1.12
story_key: 1-12-service-interfaces-ports
story_title: "Service Interfaces (Ports)"
epic_num: 1
story_num: 12
status: ready-for-dev
created_date: 2025-01-01
---

# Story 1.12: Service Interfaces (Ports)

## Story Summary
As a developer, I want interfaces for all services (hexagonal ports), so that implementations are swappable and testable.

## User Story
**As a** developer,
**I want** interfaces for all services (hexagonal ports),
**So that** implementations are swappable and testable.

## Acceptance Criteria

### Given the project
- When I check the service interfaces
- Then IAuthService interface exists with methods: register, login, refresh, logout

### Given the project
- When I check the service interfaces
- Then IUserService interface exists with methods: findByEmail, findByUsername, create, logDemographics

### Given the project
- When I check the service interfaces
- Then ITokenService interface exists with methods: generateTokenPair, storeToken, verifyAccessToken

### Given the project
- When I check the service interfaces
- Then IKeyManager interface exists with methods: getPublicKey, getPrivateKey

## Technical Requirements

### Hexagonal Architecture (Ports & Adapters)
- Define all service interfaces as hexagonal ports
- Ports represent the contract that adapters must fulfill
- Enable swapping implementations without changing consuming code
- Separate domain contracts from infrastructure details

### Interface Definitions

#### IAuthService
```typescript
export interface IAuthService {
  register(dto: RegisterDto): Promise<AuthResult>;
  login(dto: LoginDto): Promise<AuthResult>;
  refresh(dto: RefreshDto): Promise<AuthResult>;
  logout(userId: string): Promise<void>;
}
```

#### IUserService
```typescript
export interface IUserService {
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(dto: CreateUserDto): Promise<User>;
  logDemographics(userId: string, demographics: DemographicsDto): Promise<void>;
}
```

#### ITokenService
```typescript
export interface ITokenService {
  generateTokenPair(user: User): Promise<TokenPair>;
  storeToken(userId: string, refreshToken: string): Promise<void>;
  verifyAccessToken(token: string): Promise<TokenPayload>;
}
```

#### IKeyManager
```typescript
export interface IKeyManager {
  getPublicKey(): Promise<string>;
  getPrivateKey(): Promise<string>;
}
```

### Type Definitions Required
- `RegisterDto`, `LoginDto`, `RefreshDto` — authentication request DTOs
- `AuthResult` — authentication response with tokens
- `User` — user entity type
- `CreateUserDto` — user creation input
- `DemographicsDto` — demographics input data
- `TokenPair` — access and refresh token pair
- `TokenPayload` — decoded JWT payload

### Export Requirements
- All interfaces must be exported from their respective files
- Central barrel export file for all ports
- Import paths should use the configured path aliases

## Developer Context

### File Structure Requirements
```
src/
├── common/
│   └── ports/
│       ├── auth.port.ts          # IAuthService interface
│       ├── user.port.ts          # IUserService interface
│       ├── token.port.ts         # ITokenService interface
│       ├── key-manager.port.ts   # IKeyManager interface
│       └── index.ts              # Barrel export
```

### Method Signatures
- All methods must return Promises (async by default)
- Use the type definitions from Story 1.5 (Type Definitions)
- Use the entity types from Story 1.11 (Core Entities)
- DTOs should reference schemas validated by Zod (from Story 1.4)

### Import Conventions
- Import types from `@/common/types` (path alias)
- Import entities from `@/common/entities` (path alias)
- Export all interfaces from `@/common/ports` (path alias)

## Architecture Compliance

### Hexagonal Architecture
- Ports define the boundary between domain and infrastructure
- Implementations (adapters) will conform to these interfaces in later stories
- Domain logic depends only on port interfaces, never on concrete implementations

### Dependency Injection
- NestJS will bind implementations to these interfaces
- Use `@Inject()` tokens or custom decorators for interface binding
- Enable swapping implementations for testing or alternative stores

### Module Boundaries
- Each port represents a module's public contract
- Modules consume services through their ports
- No module should import another module's internal types directly

## Testing Requirements

### Unit Tests
- Verify all interfaces exist and are properly typed
- Confirm each interface has all required methods
- Test that interfaces are exported correctly
- Validate method signatures match expected types

### Interface Contracts
- No implementation logic to test (pure type definitions)
- Focus on TypeScript compilation correctness
- Ensure interfaces are compatible with planned implementations

### Test Configuration
- Tests should verify type compatibility
- Use TypeScript compiler to validate interface shapes

## Business Context

### Project Goals
- Establish clear contracts for all service boundaries
- Enable testability through mockable interfaces
- Support future refactoring without breaking consumers
- Lay groundwork for the adapter implementations in later epics

### Success Criteria
- All four interfaces exist with correct method signatures
- All interfaces are exported and importable
- TypeScript compilation succeeds with no type errors
- Interfaces are ready for implementation binding in later stories

## Implementation Notes

### Key Considerations
- Interfaces should be minimal — only methods the domain needs
- Avoid leaking infrastructure concerns into port definitions
- Keep DTO types aligned with Zod schemas (Story 1.4)
- Keep entity types aligned with TypeORM entities (Story 1.11)

### Common Pitfalls
- Don't include implementation details in interfaces
- Don't create circular type dependencies between ports
- Ensure all referenced types exist from earlier stories
- Don't use concrete classes where interfaces suffice

## Dependencies

### Epic Dependencies
- Story 1.5: Type Definitions (DTOs and shared types)
- Story 1.9: Module Structure (NestJS module scaffolding)
- Story 1.10: Entity Base Classes (base entity patterns)
- Story 1.11: Core Entities (User entity and related types)

### External Dependencies
- TypeScript 5.x for interface definitions
- NestJS DI container for interface binding (used in later stories)

## Checklist

- [ ] Create IAuthService interface with register, login, refresh, logout methods
- [ ] Create IUserService interface with findByEmail, findByUsername, create, logDemographics methods
- [ ] Create ITokenService interface with generateTokenPair, storeToken, verifyAccessToken methods
- [ ] Create IKeyManager interface with getPublicKey, getPrivateKey methods
- [ ] Define or import all referenced DTOs and entity types
- [ ] Create barrel export file for all ports
- [ ] Verify TypeScript compilation succeeds
- [ ] Verify all interfaces are importable via path aliases

---

*Story created using bmad-create-story workflow*
*Status: ready-for-dev*
*Next: Developer will implement service interfaces (hexagonal ports)*
