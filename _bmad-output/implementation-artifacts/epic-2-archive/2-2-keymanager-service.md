---
story_id: 2.2
story_key: 2-2-keymanager-service
story_title: "KeyManager Service"
epic_num: 2
story_num: 2
status: done
created_date: 2025-01-01
---

# Story 2.2: KeyManager Service

## Story Summary
As a developer, I want the KeyManager service to read RSA keys from keys.json, so that JWT signing and verification works.

## User Story
**As a** developer,
**I want** the KeyManager service to read RSA keys from keys.json,
**So that** JWT signing and verification works.

## Acceptance Criteria

### Given keys.json exists
- When KeyManager.getPublicKey(kid) is called
- Then it reads the public key for the specified kid
- And returns the public key as a string

### Given keys.json exists
- When KeyManager.getPrivateKey() is called
- Then it reads the private key from file
- And clears the key from memory after use

## Technical Requirements

### KeyManager Service
- Implement `IKeyManager` interface from Story 1.12
- Read keys from `keys.json` file
- Support lookup by `kid` for public keys
- Clear private key from memory after each use

### Interface Implementation
```typescript
export interface IKeyManager {
  getPublicKey(kid?: string): Promise<string>;
  getPrivateKey(): Promise<string>;
}
```

### Key Reading Logic
- Read keys.json on service initialization or first access
- Cache public keys in memory (they don't need to be cleared)
- Read private key fresh from file each time
- Clear private key from memory after returning

### Error Handling
- Throw error if keys.json does not exist
- Throw error if specified kid is not found
- Throw error if keys.json is malformed
- Log errors with structured logging (pino)

## Developer Context

### File Structure Requirements
```
src/
├── modules/
│   └── key-manager/
│       ├── key-manager.service.ts    # Service implementation
│       ├── key-manager.module.ts     # NestJS module
│       └── key-manager.service.spec.ts # Unit tests
├── common/
│   └── ports/
│       └── key-manager.port.ts       # IKeyManager interface (from Story 1.12)
```

### Implementation Details
- Use `fs.readFileSync` or `fs.promises.readFile` for key file access
- Store public keys in a Map<kid, publicKey> for fast lookup
- Read private key from file, return it, then nullify local reference
- Implement NestJS injectable service with proper DI

### Service Skeleton
```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { IKeyManager } from '@/common/ports';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class KeyManagerService implements IKeyManager, OnModuleInit {
  private keysData: KeysJson | null = null;

  onModuleInit() {
    this.loadKeys();
  }

  private loadKeys() {
    const keysPath = path.join(process.cwd(), 'keys.json');
    this.keysData = JSON.parse(fs.readFileSync(keysPath, 'utf-8'));
  }

  async getPublicKey(kid?: string): Promise<string> {
    if (!this.keysData) throw new Error('Keys not loaded');
    const targetKid = kid || this.keysData.kid;
    if (this.keysData.kid !== targetKid) throw new Error('Key not found');
    return this.keysData.publicKey;
  }

  async getPrivateKey(): Promise<string> {
    if (!this.keysData) throw new Error('Keys not loaded');
    const privateKey = this.keysData.privateKey;
    // Clear from memory after use
    this.keysData = null;
    return privateKey;
  }
}
```

## Architecture Compliance

### Hexagonal Architecture
- KeyManager implements `IKeyManager` port (from Story 1.12)
- Service depends on file system (adapter) for key storage
- Domain logic (JWT signing) will consume IKeyManager interface
- Implementation is swappable (e.g., could use Vault, AWS KMS)

### Security Considerations
- Private key must not be logged
- Private key should be cleared from memory after use
- Public keys can be cached (they are not secret)
- File read errors should not expose key content

### Module Boundaries
- KeyManager is a standalone service
- No dependencies on other domain services
- Provides keys to TokenService and other consumers

## Testing Requirements

### Unit Tests
- Test that getPublicKey returns correct public key for valid kid
- Test that getPublicKey throws error for invalid kid
- Test that getPrivateKey returns private key and clears memory
- Test error handling when keys.json is missing or malformed
- Test that keys are loaded on module initialization

### Mock Strategy
- Mock `fs` module for file system operations
- Create test keys.json fixtures
- Verify private key is cleared from memory after getPrivateKey()

### Test Configuration
- Use Jest for unit testing
- Create test fixtures for keys.json
- Mock file system operations for isolated testing

## Business Context

### Project Goals
- Provide secure key access for JWT signing
- Implement key caching for performance
- Ensure private key security (clear from memory)
- Support key rotation in future stories

### Success Criteria
- KeyManager correctly reads keys from keys.json
- Public key lookup by kid works
- Private key is cleared from memory after use
- Error handling covers all edge cases

## Implementation Notes

### Key Considerations
- Load keys once, cache public keys for performance
- Private key should be read fresh each time (for security)
- Consider key rotation: service should support loading new keys
- Use structured logging for key operations

### Common Pitfalls
- Don't cache private key in memory longer than necessary
- Handle missing keys.json gracefully
- Don't expose key content in error messages
- Ensure keys.json is loaded before any key operations

## Dependencies

### Epic Dependencies
- Story 1.12: Service Interfaces (IKeyManager interface)
- Story 2.1: Key Generation Script (creates keys.json)

### External Dependencies
- Node.js `fs` module for file access
- NestJS `@nestjs/common` for injectable service
- `path` module for file path resolution

## Checklist

- [ ] Implement KeyManagerService class
- [ ] Implement IKeyManager interface methods
- [ ] Load keys from keys.json on initialization
- [ ] Implement getPublicKey(kid) with caching
- [ ] Implement getPrivateKey() with memory clearing
- [ ] Handle error cases (missing file, invalid kid, malformed data)
- [ ] Add structured logging for key operations
- [ ] Create unit tests for all methods
- [ ] Verify private key is cleared from memory
- [ ] Test error scenarios

---

*Story created using bmad-create-story workflow*
*Status: ready-for-dev*
*Next: Developer will implement KeyManager service*
