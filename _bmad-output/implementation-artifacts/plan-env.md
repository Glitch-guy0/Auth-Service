# Plan: Restructure Docker Files + npm Scripts

## Goal

Split monolithic `docker-compose.yml` into 3 focused files under `infra/`, add npm scripts with `container:` prefix.

## Target State

```
infra/
├── docker-compose.dev.yml      # infrastructure only (no app container)
├── docker-compose.prod.yml     # full stack with production app
└── docker-compose.test.yml     # infrastructure + app running e2e tests
```

---

## Changes

### 1. Create `infra/` directory

```bash
mkdir -p infra
```

### 2. Create `infra/docker-compose.dev.yml`

Infrastructure only — no app container. Dev runs locally via `npm run start:dev`.

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: authuser
      POSTGRES_PASSWORD: authpass
      POSTGRES_DB: authservice
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U authuser -d authservice']
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  mongodb:
    image: mongo:7
    ports:
      - '27017:27017'
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ['CMD', 'mongosh', '--eval', 'db.runCommand({ping:1})']
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 5s

volumes:
  postgres_data:
  mongo_data:
  redis_data:
```

### 3. Create `infra/docker-compose.prod.yml`

Full stack — app built from Dockerfile, infrastructure, healthchecks.

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: authuser
      POSTGRES_PASSWORD: authpass
      POSTGRES_DB: authservice
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U authuser -d authservice']
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  mongodb:
    image: mongo:7
    ports:
      - '27017:27017'
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ['CMD', 'mongosh', '--eval', 'db.runCommand({ping:1})']
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 5s

  app:
    build:
      context: ..
      dockerfile: Dockerfile
      target: production
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgresql://authuser:authpass@postgres:5432/authservice
      MONGODB_URL: mongodb://mongodb:27017/authservice
      REDIS_URL: redis://redis:6379
      JWT_ACCESS_EXPIRY: ${JWT_ACCESS_EXPIRY:-1d}
      JWT_REFRESH_EXPIRY: ${JWT_REFRESH_EXPIRY:-7d}
      BCRYPT_COST: ${BCRYPT_COST:-10}
      PORT: ${PORT:-3000}
      NODE_ENV: ${NODE_ENV:-production}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    depends_on:
      postgres:
        condition: service_healthy
      mongodb:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ../keys.json:/app/keys.json:ro
    restart: unless-stopped
    healthcheck:
      test:
        [
          'CMD-SHELL',
          'wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1',
        ]
      interval: 30s
      timeout: 5s
      start_period: 10s
      retries: 3

volumes:
  postgres_data:
  mongo_data:
  redis_data:
```

### 4. Create `infra/docker-compose.test.yml`

Infrastructure + app running e2e tests. Extends dev infra.

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: authuser
      POSTGRES_PASSWORD: authpass
      POSTGRES_DB: authservice_test
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U authuser -d authservice_test']
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  mongodb:
    image: mongo:7
    ports:
      - '27017:27017'
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ['CMD', 'mongosh', '--eval', 'db.runCommand({ping:1})']
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 5s

  app:
    build:
      context: ..
      dockerfile: Dockerfile
      target: production
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgresql://authuser:authpass@postgres:5432/authservice_test
      MONGODB_URL: mongodb://mongodb:27017/authservice_test
      REDIS_URL: redis://redis:6379/1
      JWT_ACCESS_EXPIRY: ${JWT_ACCESS_EXPIRY:-1d}
      JWT_REFRESH_EXPIRY: ${JWT_REFRESH_EXPIRY:-7d}
      BCRYPT_COST: 4
      PORT: ${PORT:-3000}
      NODE_ENV: test
      LOG_LEVEL: warn
    command: npm run test:e2e
    depends_on:
      postgres:
        condition: service_healthy
      mongodb:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ../keys.json:/app/keys.json:ro

volumes:
  postgres_data:
  mongo_data:
  redis_data:
```

### 5. Delete old docker files from root

```bash
rm docker-compose.yml docker-compose.test.yml
```

### 6. Update npm scripts in `package.json`

Separate concerns — each script does one thing. Start scripts call infra scripts via `npm run`.

```json
"start:dev:infra": "docker compose -f infra/docker-compose.dev.yml up -d",
"stop:dev:infra": "docker compose -f infra/docker-compose.dev.yml down -v",
"start:dev": "npm run start:dev:infra && nest start --watch",

"start:prod:infra": "docker compose -f infra/docker-compose.prod.yml up -d --build",
"stop:prod:infra": "docker compose -f infra/docker-compose.prod.yml down -v",
"start:prod": "npm run start:prod:infra && node dist/main",

"start:test:infra": "docker compose -f infra/docker-compose.test.yml up -d --build",
"stop:test:infra": "docker compose -f infra/docker-compose.test.yml down -v",
"test:e2e": "npm run start:test:infra && jest --config ./test/jest-e2e.json && npm run stop:test:infra"
```

**How it works:**

| Command              | Chain                                           |
| -------------------- | ----------------------------------------------- |
| `npm run start:dev`  | `start:dev:infra` → `nest start --watch`        |
| `npm run start:prod` | `start:prod:infra` → `node dist/main`           |
| `npm run test:e2e`   | `start:test:infra` → `jest` → `stop:test:infra` |

**Keep these utility scripts:**

```json
"container:logs": "docker compose -f infra/docker-compose.dev.yml logs -f"
```

### 7. Update `.gitignore`

Ensure `infra/` is NOT gitignored (it's source code, not generated).

### 8. Update `Dockerfile` context references

No change needed — `docker-compose.prod.yml` uses `context: ..` since it's inside `infra/`.

---

## File Operations

| #   | File                            | Action                                    |
| --- | ------------------------------- | ----------------------------------------- |
| 1   | `infra/docker-compose.dev.yml`  | **NEW** — infrastructure only             |
| 2   | `infra/docker-compose.prod.yml` | **NEW** — full stack                      |
| 3   | `infra/docker-compose.test.yml` | **NEW** — test stack                      |
| 4   | `docker-compose.yml`            | **DELETE**                                |
| 5   | `docker-compose.test.yml`       | **DELETE**                                |
| 6   | `package.json`                  | Rewrite start scripts with pre/post hooks |

---

## npm Scripts Summary

| Command                    | What it does                             |
| -------------------------- | ---------------------------------------- |
| `npm run start:dev:infra`  | Start dev infra (postgres, mongo, redis) |
| `npm run stop:dev:infra`   | Stop dev infra + wipe volumes            |
| `npm run start:dev`        | Start infra → nest watch                 |
| `npm run start:prod:infra` | Build + start full prod stack            |
| `npm run stop:prod:infra`  | Stop prod stack + wipe volumes           |
| `npm run start:prod`       | Start prod stack → node dist/main        |
| `npm run start:test:infra` | Build + start test stack                 |
| `npm run stop:test:infra`  | Stop test stack + wipe volumes           |
| `npm run test:e2e`         | Start test stack → run e2e → tear down   |
| `npm run container:logs`   | Tail dev infra logs                      |

---

## Verification

1. `npm run start:dev` — infra starts, nest watches
2. `npm run stop:dev:infra` — infra stops, volumes wiped
3. `npm run start:prod` — full stack builds and runs
4. `npm run test:e2e` — e2e tests pass, volumes cleaned up
5. `npm run lint` — no issues
