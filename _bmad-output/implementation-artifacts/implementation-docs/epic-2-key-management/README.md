# Epic 2: Key Management

**Goal:** Implement RSA key generation and KeyManager service. This must work before any JWT signing.

**Depends on:** Epic 1 (types, entities, service interfaces defined)

**Deliverable:** A `npm run setup:keys` script that generates RSA key pairs and a KeyManager service with NestJS module registration for JWT signing/verification.

---

## Story 2.1: Key Generation Script

### Overview
Create a setup script that generates an RSA-2048 key pair, writes it to `keys.json` with metadata (kid, timestamps, platform info), and sets restrictive file permissions. The script is idempotent — it refuses to overwrite an existing `keys.json`, preventing accidental key loss.

### Architecture References
- AD-2 (Per-Instance RSA Key Pairs): private key stays in `keys.json` (chmod 600), only public key in PostgreSQL
- Architecture §4.1 defines `keys.json` shape: kid (UUID v7), publicKey, privateKey, createdAt, expiresAt, platformArchitecture, platformOs, timeToComplete
- Architecture §13.1 (Single Instance): `keys.json` lives alongside the NestJS application

### Acceptance Criteria
- `npm run setup:keys` creates `keys.json` with kid (UUID v7), publicKey, privateKey, createdAt, expiresAt
- File permissions set to 600 (owner read/write only)
- Platform architecture and OS recorded in JSON
- Time to complete measured and stored
- Does not overwrite existing `keys.json` — exits with warning

### Test Acceptance Criteria
- **Given** no `keys.json` exists, **when** setupKeys() is called, **then** `keys.json` is created with all required fields and correct permissions (600)
- **Given** `keys.json` already exists, **when** setupKeys() is called again, **then** it throws an error or warns (does not overwrite)

### Implementation Guidance
- Create `scripts/setup-keys.ts` as a standalone script (not a NestJS module — runs before the app boots)
- Use Node.js `crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })` to generate the pair
- Use `crypto.randomUUID()` (v4) or install a UUID v7 library — the AC specifies UUID v7 for chronological ordering
- Set expiry: `createdAt` = now, `expiresAt` = createdAt + 1 year
- Use `os.arch()` and `os.platform()` for platform metadata; use `console.time`/`console.timeEnd` for duration
- Write file with `fs.writeFileSync` then `fs.chmodSync(path, 0o600)`
- Guard with `fs.existsSync` check at the top — if exists, log a warning and exit with code 0 (informational, not error)
- Add `"setup:keys": "ts-node scripts/setup-keys.ts"` to `package.json` (or use `tsx` if preferred)

### Dependencies
- Story 1.1 (package.json with script support)
- Story 1.2 (ts-node or tsx for running TypeScript scripts)

---

## Story 2.2: KeyManager Service

### Overview
Implement the `KeyManager` class that reads RSA keys from `keys.json` at runtime. `getPublicKey(kid)` retrieves the public key for a specific kid (enabling key rotation). `getPrivateKey()` reads the private key from file, returns it for JWT signing, then clears it from memory.

### Architecture References
- AD-2 (Per-Instance RSA Key Pairs): private key read from file, cleared from memory after use
- AD-9 (KeyManager Takes `kid` Parameter): `getPublicKey(kid)` enables verification of tokens signed with older keys during rotation
- IKeyManager interface defined in Story 1.12: `getPublicKey(kid: string): Promise<string>`, `getPrivateKey(): Promise<string>`
- Architecture §4.2 (Key Storage): private key in `keys.json` (file only), public key in file + DB

### Acceptance Criteria
- `KeyManager.getPublicKey(kid)` reads the public key for the specified kid, returns it as a string
- `KeyManager.getPrivateKey()` reads the private key from file, clears from memory after use
- Both methods handle file-not-found gracefully with descriptive errors

### Implementation Guidance
- Create `src/modules/key/key.service.ts` implementing `IKeyManager`
- Cache the entire `keys.json` in memory on first read (including both keys) — reduces filesystem IO
- `getPublicKey(kid)`: verify the cached kid matches the requested kid, return `publicKey`
- `getPrivateKey()`: return the cached `privateKey` string, then set the in-memory reference to `null` or overwrite with zeros — implement as: `const key = this.privateKey; this.clearPrivateKey(); return key;`
- For memory clearing, overwrite the cached string: `this.privateKey = '';` (V8 strings are immutable but the reference is removed; if higher assurance is needed, use `Buffer.alloc()` + `buffer.fill(0)` + `buffer.toString()`)
- On error (file missing, parse failure), throw `KeyNotFoundException` or similar (add to exception hierarchy)
- The `kid` parameter in `getPublicKey` enables AD-9 — even with a single key pair, the API is rotation-ready

### Dependencies
- Story 1.12 (IKeyManager interface defined)
- Story 2.1 (keys.json exists — script must be run before the service starts)

---

## Story 2.3: KeyManager Module Registration

### Overview
Register `KeyManager` in a NestJS module so it can be injected via `@Inject(IKeyManager)` throughout the application. Establishes the hexagonal boundary where downstream services (TokenService, AuthGuard) depend on the port interface, not the concrete implementation.

### Architecture References
- AD-1 (Hexagonal Module Boundary): core domain depends on port interfaces; concrete implementations are provided by NestJS DI
- Architecture §2.2 (Module Isolation): each module follows `setup() → run() → shutdown()` lifecycle
- ARCHITECTURE-SPINE.md §Structural Seed: `key/` module lives at `src/modules/key/`
- IKeyManager interface from Story 1.12 is the port; KeyManager class from Story 2.2 is the adapter

### Acceptance Criteria
- `KeyManager` is provided in the `KeyModule`
- Can be injected via `@Inject(IKeyManager)` using a custom provider token
- Module follows the NestJS module convention with `@Module({})` decorator

### Implementation Guidance
- Create `src/modules/key/key.module.ts`:
  ```typescript
  import { Module } from '@nestjs/common';
  import { KeyManager } from './key.service';
  import { IKeyManager } from './key.service.interface';

  @Module({
    providers: [
      {
        provide: IKeyManager,
        useClass: KeyManager,
      },
    ],
    exports: [IKeyManager],
  })
  export class KeyModule {}
  ```
- Use a custom provider token (`@Inject(IKeyManager)`). The `IKeyManager` interface serves as the InjectionToken — this is possible in NestJS because interfaces compile to objects at runtime when used with `@Injectable()`
- Alternatively, create a `KEY_MANAGER_TOKEN` string constant and use `@Inject(KEY_MANAGER_TOKEN)` — this is more portable across JS runtimes but less idiomatic for TypeScript-first teams
- Export `IKeyManager` from the module so importing modules (TokenModule, AuthGuard) can inject it
- Ensure `KeyModule` is imported by `AppModule` or by whichever module needs access to key operations
- Add `onModuleInit` lifecycle hook if eager key loading is desired (warn if `keys.json` is missing on startup)

### Dependencies
- Story 2.2 (KeyManager service implementation)
- Story 1.5 (AppModule structure — KeyModule must be imported)
- Story 1.12 (IKeyManager interface as provider token)

---

## Summary

| Story | Key Deliverable | File Location |
|-------|----------------|---------------|
| 2.1 | Key generation setup script | `scripts/setup-keys.ts` |
| 2.2 | KeyManager service | `src/modules/key/key.service.ts` |
| 2.3 | KeyModule with NestJS DI registration | `src/modules/key/key.module.ts` |
