# Story 9.5: Docker Configuration

Status: review

## Story

As a developer,
I want Docker Compose configuration, multi-stage Dockerfile, and `.dockerignore`,
so that the application can run consistently in local development and production using Docker.

## Acceptance Criteria

1. **Given** no Docker infrastructure exists
   **When** `docker compose up --build` is executed
   **Then** all four services (`app`, `postgres`, `mongodb`, `redis`) start without errors

2. **Given** the application is running via Docker Compose
   **When** the app container is ready
   **Then** the NestJS application responds on port 3000

3. **Given** the Postgres service is running
   **When** its health check runs
   **Then** `pg_isready -U authuser -d authservice` passes within 10 seconds

4. **Given** the MongoDB service is running
   **When** its health check runs
   **Then** `mongosh --eval "db.runCommand({ping:1})"` passes

5. **Given** the Redis service is running
   **When** its health check runs
   **Then** `redis-cli ping` returns `PONG`

6. **Given** the app container connects to PostgreSQL
   **When** the registration endpoint is called
   **Then** a user is created in the PostgreSQL database

7. **Given** the app container connects to MongoDB
   **When** a user logs in
   **Then** demographics data is logged to MongoDB

8. **Given** the app container connects to Redis
   **When** a user logs out
   **Then** the token is blacklisted in Redis

9. **Given** all services are running
   **When** `docker compose down` is executed
   **Then** all services stop cleanly

10. **Given** a Dockerfile exists
    **When** `docker build` is run
    **Then** the build uses multi-stage (build stage + production stage) and runs as a non-root user

11. **Given** a `.dockerignore` exists
    **When** Docker context is built
    **Then** `node_modules`, `.git`, `coverage`, `.env`, and build artifacts are excluded

12. **Given** the `docker-compose.test.yml` override
    **When** `docker compose -f docker-compose.yml -f docker-compose.test.yml up`
    **Then** the app uses test database names and lower bcrypt cost

## Tasks / Subtasks

- [x] Task 1: Create multi-stage Dockerfile (AC: 10)
  - [x] Create `Dockerfile` at project root
  - [x] Build stage: `FROM node:18-alpine AS builder`, copy `package.json` + `package-lock.json`, run `npm ci`, copy source, run `npm run build`, prune devDependencies
  - [x] Production stage: `FROM node:18-alpine AS production`, create non-root `appuser`, copy built artifacts from builder, set permissions, expose port 3000, add health check, run `node dist/main`

- [x] Task 2: Create docker-compose.yml (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9)
  - [x] Create `docker-compose.yml` at project root (version: '3.8')
  - [x] Define `app` service: build from Dockerfile targeting production, expose port 3000, pass env vars (DATABASE_URL, MONGODB_URL, REDIS_URL, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY, BCRYPT_COST, PORT, NODE_ENV, LOG_LEVEL), depends_on with condition: service_healthy for all databases, mount keys.json read-only, restart: unless-stopped
  - [x] Define `postgres` service: image `postgres:16-alpine`, POSTGRES_USER/PASSWORD/DB, port 5432, named volume `postgres_data`, health check with `pg_isready`
  - [x] Define `mongodb` service: image `mongo:7`, port 27017, named volume `mongo_data`, health check with `mongosh --eval "db.runCommand({ping:1})"`
  - [x] Define `redis` service: image `redis:7-alpine`, port 6379, named volume `redis_data`, health check with `redis-cli ping`
  - [x] Declare named volumes: `postgres_data`, `mongo_data`, `redis_data`

- [x] Task 3: Create .dockerignore (AC: 11)
  - [x] Create `.dockerignore` at project root
  - [x] Exclude: `node_modules`, `dist`, `coverage`, `.env`, `.env.*`, `.git`, `.gitignore`, `*.md`, `docker-compose.yml`, `Dockerfile`, `.dockerignore`, `test/`, `*.spec.ts`, `*.e2e-spec.ts`, `.ok/`, `_bmad-output/`
  - [x] Keep `.env.example` via `!.env.example`

- [x] Task 4: Create docker-compose.test.yml (AC: 12)
  - [x] Create `docker-compose.test.yml` at project root
  - [x] Override app environment: test database names (`authservice_test` for postgres/mongo, `redis://redis:6379/1` for redis), `BCRYPT_COST=4`, `NODE_ENV=test`, `LOG_LEVEL=warn`
  - [x] Override app command: `npm run test:e2e`
  - [x] Override postgres environment: `POSTGRES_DB: authservice_test`

## Dev Notes

### Existing Code Context

**App Entry Point** (`src/main.ts:1-47`):

- `bootstrap()` reads env via `getValidatedEnv()`, creates NestJS app, sets up `LogManagerService`, applies `ValidationPipe`, `AllExceptionsFilter`, Swagger docs, and CORS
- Listens on `env.PORT` (default 3000)
- Entry command: `node dist/main`
- No health check endpoint exists — the Dockerfile health check tests the app responds; if a `/health` route is needed, it must be added separately

**Environment Variables** (`src/config/env.validator.ts:1-37`):

- Required by Zod schema: `DATABASE_URL`, `MONGODB_URL`, `REDIS_URL`
- Optional with defaults: `JWT_ACCESS_EXPIRY` (1d), `JWT_REFRESH_EXPIRY` (7d), `BCRYPT_COST` (10), `PORT` (3000), `NODE_ENV` (development)
- Docker service names as hosts: `postgres`, `mongodb`, `redis`
- Default connection strings must match Docker service names:
  - `DATABASE_URL=postgresql://authuser:authpass@postgres:5432/authservice`
  - `MONGODB_URL=mongodb://mongodb:27017/authservice`
  - `REDIS_URL=redis://redis:6379`

**Log Level** (from `src/shared/logging/log-manager.ts:5-6`, `src/logging/log-manager.service.ts:17`):

- `LOG_LEVEL` env var: `debug | info | warn | error | fatal`
- Default: `info`
- Docker compose sets `LOG_LEVEL=${LOG_LEVEL:-info}`

**Keys** (`keys.json:1-15`):

- JSON file with `kid`, `publicKey`, `privateKey`, `createdAt`, `expiresAt`, `metadata`
- Generated by `npm run setup:keys`
- Mounted as read-only volume in Docker Compose: `./keys.json:/app/keys.json:ro`
- Never baked into the Docker image — must be present on the host before `docker compose up`

**Package Scripts** (`package.json:6-21`):

- `build` -> `nest build` (compiles to `dist/`)
- `start:prod` -> `node dist/main` (production start command)
- `test:e2e` -> `jest --config ./test/jest-e2e.json`
- `setup:keys` -> generates `keys.json`
- The Dockerfile uses `npm run build` then runs `node dist/main`

**Node Version** (`package.json:56`, `engines` not declared):

- Dev dependencies list `@types/node: ^22.15.3`
- Docker image: `node:18-alpine` (LTS, stable for production)

### Deployment Architecture

**Architecture §13.1** (`architecture.md:593-613`) — Single Instance Deployment:

```
┌─────────────────────────────────────────────────────────────┐
│  Server                                                     │
│  ├── NestJS Application                                     │
│  │   ├── Auth Module                                        │
│  │   ├── User Module                                        │
│  │   └── Token Module                                       │
│  ├── keys.json (file permissions)                           │
│  └── .env                                                   │
└─────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ PostgreSQL│     │ MongoDB  │     │  Redis   │
  └──────────┘     └──────────┘     └──────────┘
```

- The Docker Compose replicates this topology: one `app` container (NestJS) + three database containers
- `keys.json` is mounted as a volume, not baked into the image — consistent with the per-instance RSA key design (Architecture §13.1 shows keys.json as a separate file alongside .env)
- Named volumes (`postgres_data`, `mongo_data`, `redis_data`) persist database data across restarts

**Architecture §7.2** (`architecture.md:377-397`) — Environment Variables:

- All required env vars (`DATABASE_URL`, `MONGODB_URL`, `REDIS_URL`) are provided to the app container
- Docker service names (`postgres`, `mongodb`, `redis`) replace `localhost` from the dev defaults
- The `LOG_LEVEL` env var from architecture §7.2 is wired through to the app container

### Docker Patterns

**Multi-stage Build:**

| Stage | Base Image | Purpose | Key Operations |
|-------|-----------|---------|----------------|
| `builder` | `node:18-alpine` | Compile TypeScript + install deps | `npm ci`, `npm run build`, `npm prune --production` |
| `production` | `node:18-alpine` | Run the app (minimal footprint) | Copy `dist/`, `node_modules/`, `package.json`; set non-root user |

- Build stage includes devDependencies (TypeScript, ts-node, etc.) needed for `nest build`
- Production stage copies only the minimal runtime: compiled JS, production node_modules, package.json
- Builder stage runs `npm prune --production` after build to strip devDependencies before copying to production

**Service Dependencies:**

```
app → postgres (condition: service_healthy)
app → mongodb (condition: service_healthy)
app → redis   (condition: service_healthy)
```

- `depends_on` with `condition: service_healthy` ensures the app container only starts after all databases pass their health checks
- Health check intervals: databases check every 5s, app checks every 30s
- Health check `start_period` gives databases time to initialize before health checks begin

**Security Considerations:**

- **Non-root user**: Production stage creates `appuser` (UID 1001) and runs as that user — security best practice (prevents container escape via compromised Node process)
- **File permissions**: `chmod -R 750 /app` restricts access to owner/group only
- **Read-only keys volume**: `./keys.json:/app/keys.json:ro` — private key never writable from inside the container
- **Alpine base**: `node:18-alpine` minimizes attack surface (~120MB vs ~350MB for full Debian-based Node image)
- **Dependency pruning**: Dev dependencies (linters, test frameworks, TypeScript compiler) are stripped via `npm prune --production` — not present in the production image

**Layer Caching Strategy:**

1. `COPY package.json package-lock.json ./` — changes infrequently, cached across builds
2. `RUN npm ci` — cached until package.json changes
3. `COPY tsconfig.json tsconfig.build.json ./` — cached until tsconfig changes
4. `COPY src/ ./src/` — invalidates when source code changes (most frequent change)
5. `RUN npm run build` — runs when source changes
6. `RUN npm prune --production` — runs after build

This ordering maximizes Docker layer cache hits during development iterations.

**Health Check Design:**

| Service | Command | Interval | Timeout | Retries | Start Period |
|---------|---------|----------|---------|---------|-------------|
| postgres | `pg_isready -U authuser -d authservice` | 5s | 5s | 5 | 10s |
| mongodb | `mongosh --eval "db.runCommand({ping:1})"` | 5s | 5s | 5 | 10s |
| redis | `redis-cli ping` | 5s | 5s | 5 | 5s |
| app | `wget --no-verbose --tries=1 --spider http://localhost:3000/health` | 30s | 5s | 3 | 10s |

- Database health checks use the native CLI tools (`pg_isready`, `mongosh`, `redis-cli`)
- App health check uses `wget --spider` (no download, just checks response)
- Start periods allow databases to initialize before health checking begins

### What This Story Creates

| File | Action | Description |
|------|--------|-------------|
| `Dockerfile` | **CREATE** | Multi-stage build: builder + production, non-root user, health check |
| `docker-compose.yml` | **CREATE** | 4 services (app, postgres, mongodb, redis), named volumes, health checks |
| `.dockerignore` | **CREATE** | Excludes node_modules, .git, coverage, env, build artifacts |
| `docker-compose.test.yml` | **CREATE** | Test override: test databases, low bcrypt cost, e2e command |

### What Must Be Preserved

- The app must continue to start via `npm run start:dev` outside Docker (backward compatibility)
- `keys.json` must remain excluded from version control (in `.gitignore`)
- The `.env` file must not be copied into the Docker image
- All three database connection strings must use Docker service names (`postgres`, `mongodb`, `redis`) as hosts
- Existing `package.json` scripts (`build`, `start:prod`, `test:e2e`) must remain unchanged
- The Dockerfile `npm ci` depends on `package-lock.json` existing — if it does not, run `npm install` first to generate it
- The app's Zod env validation (`src/config/env.validator.ts`) must accept the Docker compose env vars

### Key Design Decisions

1. **`node:18-alpine` base image.** Matches the Node.js version parity target. Alpine provides the smallest production image (~120MB). If native bcrypt compilation fails on Alpine (requires `python3` + `make` + `g++`), switch to `node:18-slim` (Debian-based, ~250MB) and use `bcrypt` npm package's prebuilt binaries. The `bcrypt` package includes prebuilt binaries for most platforms, so Alpine should work.

2. **Health checks with `condition: service_healthy`.** This is the Docker Compose v3.8+ pattern for ordered service startup. The alternative (`depends_on` without condition) only waits for the container to start, not for the database to be ready. Without health checks, the app would crash-loop until databases accept connections.

3. **Named volumes for data persistence.** Using named volumes (`postgres_data`, `mongo_data`, `redis_data`) rather than bind mounts ensures data survives container restarts and is managed by Docker. Bind mounts would tie data to the host filesystem layout and potentially leak database files into the project directory.

4. **`keys.json` mounted as a bind volume.** Per Architecture §13.1, keys are per-instance and never in the database. Mounting from the host ensures keys are never baked into the image (security) and can be regenerated without rebuilding. A missing `keys.json` will cause the app container to fail at startup — the user must run `npm run setup:keys` before `docker compose up`.

5. **Standard `.dockerignore` excludes test and doc files.** Test files (`*.spec.ts`, `test/`), documentation (`*.md`, `_bmad-output/`, `.ok/`), and CI artifacts (`coverage/`) are excluded from the build context. This reduces the build context sent to the Docker daemon and prevents unnecessary cache invalidation.

6. **`docker-compose.test.yml` as an override file.** Docker Compose supports multiple `-f` flags to layer configurations. The test override changes only the environment variables and command — it does not duplicate the service definitions from `docker-compose.yml`. Usage: `docker compose -f docker-compose.yml -f docker-compose.test.yml up --build`. The `npm run test:e2e` command runs inside the app container, connecting to the test databases.

7. **Environment variable defaults with `${VAR:-default}` syntax.** This allows a `.env` file to override values without modifying the `docker-compose.yml`. For variables without defaults (`DATABASE_URL`, `MONGODB_URL`, `REDIS_URL`), the values are hardcoded in the compose file because Docker service names (hosts) must be fixed. If the `.env` file overrides these, the connection will likely fail (wrong host). The architecture's single-instance deployment (§13.1) means hardcoded service names are acceptable — multi-instance would require env vars.

### Dependencies

- Epic 1–8 (all features implemented and runnable)
- Story 9.3 (integration tests define the test database configuration that `docker-compose.test.yml` references)
- `keys.json` must exist on the host before `docker compose up` (generated by `npm run setup:keys` — Epic 2)
- Docker Engine 20.10+ (for Compose v3.8 health check support)
- Docker Compose v2+ (for `docker compose` CLI, not `docker-compose`)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#7.2 — Environment Variables (env var schema)]
- [Source: _bmad-output/planning-artifacts/architecture.md#13.1 — Single Instance Deployment Architecture]
- [Source: _bmad-output/implementation-artifacts/implementation-docs/epic-9-testing/README.md#Story 9.5 — Implementation Guidance (Dockerfile, compose, ignore)]
- [Source: src/config/env.validator.ts:1-37 — Zod env schema (required vars, defaults)]
- [Source: src/main.ts:1-47 — App bootstrap (port, middleware, entry point)]
- [Source: package.json:6-21 — Build and test scripts]
- [Source: keys.json:1-15 — RSA key pair format]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

| File | Action |
| ---- | ------ |
| `Dockerfile` | CREATE |
| `docker-compose.yml` | CREATE |
| `.dockerignore` | CREATE |
| `docker-compose.test.yml` | CREATE |
