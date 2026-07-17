# Deployment

## Overview

AuthService uses Docker Compose to orchestrate its infrastructure dependencies and the application itself. Three backing services are required: PostgreSQL 16, MongoDB 7, and Redis 7.

## Prerequisites

- Node.js 22.x
- Docker and Docker Compose v2

## Local Development

```bash
git clone <repository-url>
cd AuthService
npm install
npm run setup:keys
docker-compose up -d
npm run start:dev
```

Copy `.env.example` to `.env` and adjust values as needed. See [Environment Variables](#environment-variables) for the full reference.

## Docker Compose

```yaml
version: "3.9"

services:
  auth-service:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - postgres
      - mongo
      - redis
    volumes:
      - ./keys.json:/app/keys.json:ro
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-authuser}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-authpass}
      POSTGRES_DB: ${POSTGRES_DB:-authdb}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  mongo_data:
  redis_data:
```

Named volumes persist data across container restarts and recreations. The `keys.json` file is mounted read-only into the application container.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://authuser:authpass@localhost:5432/authdb` |
| `MONGODB_URL` | MongoDB connection string | `mongodb://localhost:27017/authservice` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_ACCESS_EXPIRY` | Access token lifetime | `15m` |
| `JWT_REFRESH_EXPIRY` | Refresh token lifetime | `7d` |
| `BCRYPT_COST` | Bcrypt hashing rounds | `12` |
| `PORT` | Application listen port | `3000` |
| `NODE_ENV` | Runtime environment | `development` |
| `LOG_LEVEL` | Logging verbosity | `debug` |

## Production Checklist

- Set `NODE_ENV=production`
- Enable `secure: true` and `httpOnly: true` on cookies
- Terminate TLS at a reverse proxy or load balancer (HTTPS required)
- Increase `BCRYPT_COST` to 14 or higher for slower hashing
- Set `LOG_LEVEL` to `info` or `warn`
- Schedule regular PostgreSQL and MongoDB backups
- Monitor key expiry dates — see [Key Management](key-management.md)

## Troubleshooting

### Stale Docker volumes

If the database is in an inconsistent state after schema changes:

```bash
docker-compose down -v
docker-compose up -d
```

This removes all named volumes and recreates them from scratch.

### ESM issues with NestJS

Ensure `"type": "module"` is set in `package.json` and TypeScript targets ES2022 or later. If import errors occur, verify that `tsconfig.json` has `"module": "Node16"` or `"moduleResolution": "Node16"`.

### Port conflicts

If ports 3000, 5432, 27017, or 6379 are already in use, either stop the conflicting service or remap ports in `docker-compose.yml` (e.g., `"5433:5432"`).
