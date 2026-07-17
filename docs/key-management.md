# Key Management

## Overview

AuthService uses RSA asymmetric key pairs for JWT signing. Each instance manages its own key pair independently — keys are not shared across instances. The public key is registered in PostgreSQL for token verification; the private key resides in memory only during signing operations.

## Key Generation

Generate a new RSA key pair:

```bash
npm run setup:keys
```

This executes `src/scripts/setup-keys.ts`, which produces a `keys.json` file at the project root containing:

| Field | Description |
|-------|-------------|
| `kid` | Unique key identifier (UUIDv7) |
| `publicKey` | RSA public key (PEM) |
| `privateKey` | RSA private key (PEM) |
| `createdAt` | Generation timestamp |
| `expiresAt` | Expiration timestamp |
| `platform` | Architecture, OS, time to complete |

File permissions are set to `chmod 600` — owner read/write only.

## Key Storage

Keys are stored in three locations, each with a specific security rationale:

| Location | Contents | Rationale |
|----------|----------|-----------|
| `keys.json` | Public + private key | Persistent source of truth; restricted file permissions |
| PostgreSQL (`refresh_token_keys` table) | Public key only | Enables token verification without filesystem access |
| Application memory | Private key (temporary) | Minimizes exposure window; cleared after each signing operation |

## Key Lifecycle

### Startup

1. Read `keys.json` from disk
2. Check if the `kid` exists in the `refresh_token_keys` table
3. If new, register the public key in PostgreSQL

### JWT Signing

1. Load private key from `keys.json` into memory
2. Sign the JWT
3. Clear the private key from memory immediately

### Key Expiry

When the key expires (`expiresAt` in the future), the application logs a fatal error and initiates a graceful shutdown. A new key pair must be generated before the service can resume.

## Key Rotation

**Current approach:** Manual rotation. Key expiry triggers a fatal error, requiring an operator to run `npm run setup:keys` and restart the service.

**Future:** Automatic rotation is planned. The service will detect an upcoming expiry window, generate a new key pair, register it, and retire the old key without downtime.

## Source Files

- `src/scripts/setup-keys.ts` — Key generation script
- `src/modules/key/key-manager.service.ts` — Key lifecycle management
- `src/modules/key/public-key-registry.entity.ts` — PostgreSQL entity for public key storage
- `src/modules/key/key.module.ts` — NestJS module wiring
