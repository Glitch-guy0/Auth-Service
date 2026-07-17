# Database Schema

## 1. Overview

AuthService uses a three-database architecture, each chosen for its specific strengths:

- **PostgreSQL 16+** — Primary relational store for users, authentication tokens, and refresh token key registry. Enforces ACID constraints, foreign keys, and cascading deletes.
- **MongoDB 7+** — Flexible document store for user demographics. Schema varies across users; async writes avoid blocking authentication flows.
- **Redis 7+** — In-memory store for token blacklisting. TTL-based expiry aligns with access token lifetimes, eliminating manual cleanup.

Entity relationships are documented in the ER diagram: [Entity Relationships](diagrams/05-class-entities.mmd).

---

## 2. PostgreSQL Schema

### 2.1 users

Core user identity table.

| Column       | Type                     | Constraints                          |
|--------------|--------------------------|--------------------------------------|
| id           | UUID                     | PRIMARY KEY, DEFAULT gen_random_uuid() |
| username     | VARCHAR(255)             | UNIQUE NOT NULL                      |
| email        | VARCHAR(255)             | UNIQUE NOT NULL                      |
| password     | VARCHAR(255)             | NOT NULL                             |
| blocked      | BOOLEAN                  | DEFAULT FALSE                        |
| is_verified  | BOOLEAN                  | DEFAULT FALSE                        |
| created_at   | TIMESTAMP                | DEFAULT NOW()                        |
| updated_at   | TIMESTAMP                | DEFAULT NOW()                        |

**DDL:**

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    blocked BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_username ON users (username);
```

**TypeORM Entity:** `src/modules/user/user.entity.ts`

### 2.2 auth_tokens

Stores hashed access tokens, one per user. Cascades on user deletion.

| Column     | Type         | Constraints                             |
|------------|--------------|-----------------------------------------|
| user_id    | UUID         | PRIMARY KEY, REFERENCES users(id) ON DELETE CASCADE |
| token_hash | VARCHAR(255) | NOT NULL                                |
| expires_at | TIMESTAMP    | NOT NULL                                |
| updated_at | TIMESTAMP    | DEFAULT NOW()                           |

**DDL:**

```sql
CREATE TABLE auth_tokens (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**TypeORM Entity:** `src/modules/token/auth-token.entity.ts`

### 2.3 refresh_token_keys

Registry of public keys used to sign and verify refresh tokens (JWKS pattern).

| Column                | Type      | Constraints |
|-----------------------|-----------|-------------|
| kid                   | UUID      | PRIMARY KEY |
| public_key            | TEXT      | NOT NULL    |
| created_at            | TIMESTAMP | DEFAULT NOW() |
| expires_at            | TIMESTAMP | NOT NULL    |
| platform_architecture | VARCHAR(100) | NULL     |
| platform_os           | VARCHAR(100) | NULL     |
| time_to_complete      | INTERVAL  | NULL        |

**DDL:**

```sql
CREATE TABLE refresh_token_keys (
    kid UUID PRIMARY KEY,
    public_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    platform_architecture VARCHAR(100),
    platform_os VARCHAR(100),
    time_to_complete INTERVAL
);
```

**TypeORM Entity:** `src/modules/key/public-key-registry.entity.ts`

---

## 3. MongoDB Schema

### 3.1 user_demographics

Flexible document collection for user metadata that varies in shape across users.

```typescript
{
  _id: ObjectId,          // MongoDB auto-generated
  user_id: UUID,          // References users.id (application-level FK)
  last_ip: string,        // Most recent request IP
  location: {
    country: string,      // Resolved from IP
    city: string          // Resolved from IP
  },
  created_at: Date        // First record timestamp
}
```

**Why MongoDB:** Demographics data is append-heavy and schema-variant. Some users may have additional fields in the future (device info, preferences) without requiring migrations. Writes are async and non-blocking.

**Mongoose Schema:** `src/modules/logging/demographics.schema.ts`

---

## 4. Redis Schema

### 4.1 Token Blacklist

Revoked access tokens are blacklisted in Redis to prevent reuse before natural expiry.

| Property | Detail |
|----------|--------|
| Key pattern | `blacklist:{access_token_jti}` |
| Value | `{ "expires_at": <unix_timestamp>, "user_id": "<uuid>" }` |
| TTL | Matches remaining token expiry at time of revocation |

**Operations:**

- `SET blacklist:{jti} {json} EX {ttl_seconds}` — Blacklist a token on revocation
- `GET blacklist:{jti}` — Check if a token is blacklisted during validation
- `DEL blacklist:{jti}` — Manual removal (rare; TTL handles natural expiry)

**Diagram:** [Redis Blacklist](diagrams/04-redis-blacklist.mmd)

---

## 5. Entity Relationships

| Relationship | Type | Details |
|---|---|---|
| users → auth_tokens | 1:1 | Foreign key on `auth_tokens.user_id` references `users.id`. Cascade delete removes the token row when a user is deleted. |
| users → user_demographics | 1:1 | Application-level reference via `user_demographics.user_id`. No database-level FK (cross-database). |
| users → refresh_token_keys | N:1 | Multiple users may share a key during key rotation. Each user's refresh token is signed with the active key identified by `kid`. |

---

## 6. Entity Source Files

| Database | Entity File | ORM |
|----------|------------|-----|
| PostgreSQL | `src/modules/user/user.entity.ts` | TypeORM |
| PostgreSQL | `src/modules/token/auth-token.entity.ts` | TypeORM |
| PostgreSQL | `src/modules/key/public-key-registry.entity.ts` | TypeORM |
| MongoDB | `src/modules/logging/demographics.schema.ts` | Mongoose |
