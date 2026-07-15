---
story_id: 2.1
story_key: 2-1-key-generation-script
story_title: "Key Generation Script"
epic_num: 2
story_num: 1
status: done
created_date: 2025-01-01
---

# Story 2.1: Key Generation Script

## Story Summary
As a developer, I want a setup script that generates RSA key pairs, so that JWT signing works without manual key generation.

## User Story
**As a** developer,
**I want** a setup script that generates RSA key pairs,
**So that** JWT signing works without manual key generation.

## Acceptance Criteria

### Given the project
- When I run `npm run setup:keys`
- Then `keys.json` is created with kid (UUID v7), publicKey, privateKey, createdAt, expiresAt
- And file permissions are set to 600 (owner read/write only)
- And platform architecture and OS are recorded
- And time to complete is measured and stored

### Given `keys.json` exists
- When I run `npm run setup:keys` again
- Then it does not overwrite existing keys (or warns before overwriting)

### Test Acceptance Criteria

#### Given no keys.json exists
- When setupKeys() is called
- Then keys.json is created with all required fields
- And file has correct permissions (600)

#### Given keys.json already exists
- When setupKeys() is called again
- Then it throws an error or warns (does not overwrite)

## Technical Requirements

### RSA Key Generation
- Generate 2048-bit RSA key pair using Node.js `crypto` module
- Generate UUID v7 for key ID (kid)
- Include publicKey and privateKey in PEM format
- Include createdAt and expiresAt timestamps
- Record platform architecture (e.g., arm64, x64) and OS (e.g., darwin, linux)
- Measure and store time to complete key generation

### Key File Format
```json
{
  "kid": "uuid-v7",
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "expiresAt": "2026-01-01T00:00:00.000Z",
  "metadata": {
    "algorithm": "RSA",
    "keySize": 2048,
    "platform": "darwin",
    "architecture": "arm64",
    "generatedAt": "2025-01-01T00:00:00.000Z",
    "generationTimeMs": 150
  }
}
```

### File Permissions
- Set file permissions to 600 (owner read/write only) using `fs.chmod`
- Validate permissions after creation

### npm Script
- Add `setup:keys` script to package.json
- Script should be runnable via `npm run setup:keys`

## Developer Context

### File Structure Requirements
```
src/
├── scripts/
│   └── setup-keys.ts          # Key generation script
├── common/
│   └── types/
│       └── keys.ts            # Keys JSON type definition
```

### Implementation Details
- Use `crypto.generateKeyPairSync` for RSA key generation
- Use `uuid.v7()` for key ID generation
- Use `os.arch()` and `os.platform()` for platform info
- Use `fs.writeFileSync` and `fs.chmodSync` for file operations
- Handle errors gracefully (missing directory, permission issues)

### Package.json Entry
```json
{
  "scripts": {
    "setup:keys": "ts-node src/scripts/setup-keys.ts"
  }
}
```

## Architecture Compliance

### Hexagonal Architecture
- Key generation is a standalone script, not part of the domain
- Script outputs to `keys.json` which will be consumed by KeyManager
- No coupling to NestJS module system

### Security
- Private key must not be logged or exposed
- File permissions restrict access to owner only
- Keys should have expiration dates

## Testing Requirements

### Unit Tests
- Test that setupKeys() creates keys.json with all required fields
- Test that file permissions are set to 600
- Test that calling setupKeys() when keys.json exists throws/warns
- Test that metadata includes platform and architecture info

### Test Configuration
- Mock `fs` module for file system operations
- Mock `crypto` module for deterministic key generation
- Use temp directory for test key files

## Business Context

### Project Goals
- Automate RSA key generation for JWT signing
- Ensure consistent key format across environments
- Provide metadata for key management and auditing

### Success Criteria
- `npm run setup:keys` generates valid RSA key pair
- keys.json contains all required fields
- File permissions are restricted to owner
- Repeated runs do not overwrite existing keys

## Implementation Notes

### Key Considerations
- Use `crypto.generateKeyPairSync` for synchronous generation
- Ensure PEM format for keys (compatible with jose library)
- Handle edge cases: missing `src/scripts/` directory, invalid permissions
- Consider key rotation in future stories

### Common Pitfalls
- Don't forget to set file permissions to 600
- Ensure UUID v7 is used (not v4) for sortable key IDs
- Don't log private key content
- Handle platform-specific path separators

## Dependencies

### Epic Dependencies
- Story 1.1: NestJS Project Initialization (npm scripts setup)
- Story 1.12: Service Interfaces (IKeyManager interface defines contract)

### External Dependencies
- Node.js `crypto` module for RSA key generation
- `uuid` package for UUID v7 generation
- `os` module for platform info

## Checklist

- [ ] Create setup-keys.ts script
- [ ] Implement RSA 2048-bit key pair generation
- [ ] Generate UUID v7 for kid
- [ ] Include metadata (platform, architecture, timing)
- [ ] Set file permissions to 600
- [ ] Add npm script to package.json
- [ ] Handle existing keys.json (warn/no overwrite)
- [ ] Create keys type definition
- [ ] Write unit tests for setupKeys()
- [ ] Verify keys.json format matches specification

---

*Story created using bmad-create-story workflow*
*Status: ready-for-dev*
*Next: Developer will implement key generation script*
