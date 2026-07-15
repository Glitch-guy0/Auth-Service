---
story_id: 2.3
story_key: 2-3-keymanager-module-registration
story_title: "KeyManager Module Registration"
epic_num: 2
story_num: 3
status: done
created_date: 2025-01-01
---

# Story 2.3: KeyManager Module Registration

## Story Summary
As a developer, I want KeyManager registered in the NestJS module system, so that it can be injected into other services.

## User Story
**As a** developer,
**I want** KeyManager registered in the NestJS module system,
**So that** it can be injected into other services.

## Acceptance Criteria

### Given the project
- When I check the module registration
- Then KeyManager is provided in the appropriate module
- And it can be injected via `@Inject(IKeyManager)`

## Technical Requirements

### NestJS Module Registration
- Create `KeyManagerModule` as a feature module
- Provide `KeyManagerService` with interface binding
- Export the module for use in other modules
- Register module in the application module graph

### Module Configuration
```typescript
import { Module } from '@nestjs/common';
import { KeyManagerService } from './key-manager.service';
import { IKeyManager } from '@/common/ports';

@Module({
  providers: [
    {
      provide: IKeyManager,
      useClass: KeyManagerService,
    },
  ],
  exports: [IKeyManager],
})
export class KeyManagerModule {}
```

### Application Module Integration
- Register `KeyManagerModule` in `AppModule` or relevant feature modules
- Ensure module is available for injection where needed

### Dependency Injection Setup
- Use `@Inject(IKeyManager)` for injecting into consuming services
- Interface token must be defined in common/ports (from Story 1.12)
- No direct class imports — only interface injection

## Developer Context

### File Structure Requirements
```
src/
├── modules/
│   └── key-manager/
│       ├── key-manager.module.ts     # Module definition
│       ├── key-manager.service.ts    # Service implementation (from Story 2.2)
│       └── index.ts                  # Barrel export
├── app.module.ts                     # Root module (update imports)
├── common/
│   └── ports/
│       └── key-manager.port.ts       # IKeyManager interface (from Story 1.12)
```

### Implementation Details
- Create `KeyManagerModule` with proper provider binding
- Export module for consumption by other modules
- Update `AppModule` to import `KeyManagerModule`
- Ensure interface token is properly registered

### Module Registration Pattern
```typescript
// key-manager.module.ts
import { Module } from '@nestjs/common';
import { KeyManagerService } from './key-manager.service';
import { IKeyManager } from '@/common/ports';

@Module({
  providers: [
    {
      provide: IKeyManager,
      useClass: KeyManagerService,
    },
  ],
  exports: [IKeyManager],
})
export class KeyManagerModule {}
```

### Application Module Update
```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { KeyManagerModule } from './modules/key-manager/key-manager.module';

@Module({
  imports: [
    KeyManagerModule,
    // ... other modules
  ],
})
export class AppModule {}
```

## Architecture Compliance

### Hexagonal Architecture
- Module registers implementation (adapter) to interface (port)
- Consuming services depend only on IKeyManager interface
- Implementation can be swapped without changing consumers
- Clean separation between module boundaries

### Dependency Injection
- Use NestJS DI container for service resolution
- Interface tokens enable swappable implementations
- No hard-coded class references in consuming services
- Support for testing with mock implementations

### Module Boundaries
- KeyManagerModule is self-contained
- Exports only the interface (not the concrete class)
- Other modules import KeyManagerModule for DI access
- No circular dependencies between modules

## Testing Requirements

### Unit Tests
- Test that KeyManagerModule provides IKeyManager
- Test that KeyManagerService can be injected via @Inject(IKeyManager)
- Test that module exports IKeyManager correctly
- Verify no circular dependency issues

### Integration Tests
- Test module registration in application context
- Test DI resolution in consuming services
- Verify service works end-to-end with real keys.json

### Test Configuration
- Use NestJS TestingModule for isolated module testing
- Mock dependencies for unit tests
- Test module in application context for integration

## Business Context

### Project Goals
- Enable clean dependency injection for KeyManager
- Support swappable implementations (e.g., for testing)
- Maintain hexagonal architecture boundaries
- Prepare for TokenService consumption in Epic 3

### Success Criteria
- KeyManagerModule correctly provides IKeyManager
- Service can be injected via @Inject(IKeyManager)
- Module is registered in application module graph
- No circular dependency issues

## Implementation Notes

### Key Considerations
- Use interface tokens (not class references) for DI
- Export module only (not concrete class) to enforce boundaries
- Test module registration in isolation
- Consider module configuration options (e.g., custom key path)

### Common Pitfalls
- Don't import concrete class directly in consuming services
- Ensure interface token is exported from common/ports
- Don't forget to register module in AppModule
- Test that DI works before implementing consuming services

## Dependencies

### Epic Dependencies
- Story 1.12: Service Interfaces (IKeyManager interface token)
- Story 2.2: KeyManager Service (service implementation)
- Story 1.9: NestJS App Module Structure (module registration)

### External Dependencies
- NestJS `@nestjs/common` for module and DI decorators
- TypeScript for interface token definition

## Checklist

- [ ] Create KeyManagerModule with IKeyManager provider binding
- [ ] Export IKeyManager from module
- [ ] Update AppModule to import KeyManagerModule
- [ ] Verify interface token is properly registered
- [ ] Test DI resolution via @Inject(IKeyManager)
- [ ] Test module registration in application context
- [ ] Verify no circular dependency issues
- [ ] Create barrel export for module
- [ ] Update implementation-docs with module registration

---

*Story created using bmad-create-story workflow*
*Status: ready-for-dev*
*Next: Developer will implement KeyManager module registration*
