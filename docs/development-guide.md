# AuthService — Development Guide

**Generated:** 2026-07-12  
**Framework:** NestJS 11.x  
**Language:** TypeScript 5.8

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22.x (LTS) | Runtime |
| PostgreSQL | 16+ | Core database |
| MongoDB | 7+ | Logging database |
| Redis | 7+ | Cache/blacklist |
| npm | 10+ | Package manager |

---

## Quick Start

### 1. Clone & Install

```bash
git clone <repository-url>
cd AuthService
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values
```

**Required Environment Variables:**

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/authservice
MONGODB_URL=mongodb://localhost:27017/authservice
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_EXPIRY=1d
JWT_REFRESH_EXPIRY=7d
JWT_RESET_EXPIRY=1h
BCRYPT_COST=10

# Server
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=debug
```

### 3. Generate Keys

```bash
npm run setup:keys
```

This creates `keys.json` with RSA key pair for JWT signing.

### 4. Start Development

```bash
npm run start:dev
```

Server starts at `http://localhost:3000`

---

## Available Scripts

| Script | Description | Use Case |
|--------|-------------|----------|
| `npm run start:dev` | Start dev server with watch | Development |
| `npm run start:debug` | Start with debugger | Debugging |
| `npm run start:prod` | Start production server | Production |
| `npm run build` | Build for production | Deployment |
| `npm run test` | Run unit tests | CI/CD |
| `npm run test:watch` | Run tests in watch mode | TDD |
| `npm run test:cov` | Run tests with coverage | Coverage reports |
| `npm run test:e2e` | Run end-to-end tests | Integration testing |
| `npm run lint` | Lint code | Code quality |
| `npm run lint:fix` | Lint and auto-fix | Code formatting |

---

## Project Structure

```
AuthService/
├── src/                          # Source code
│   ├── main.ts                   # Entry point
│   ├── app.module.ts             # Root module
│   ├── app.controller.ts         # Health check
│   ├── app.service.ts            # Default service
│   └── modules/                  # Feature modules (planned)
│       ├── auth/                 # Authentication
│       ├── user/                 # User management
│       ├── token/                # Token management
│       └── logging/              # Logging infrastructure
│
├── test/                         # E2E tests
├── dist/                         # Compiled output
├── docs/                         # Documentation
└── _bmad-output/                 # Planning artifacts
```

---

## Development Workflow

### 1. Create a Module

```bash
# Generate module
nest g module modules/auth

# Generate controller
nest g controller modules/auth

# Generate service
nest g service modules/auth
```

### 2. Module Pattern

Follow hexagonal architecture:

```typescript
// modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

### 3. Dependency Injection

```typescript
// Use NestJS DI throughout
@Injectable()
class AuthService {
  constructor(
    @Inject('LogManager') private logManager: LogManager,
    @InjectRepository(User) private userRepo: UserRepository,
  ) {}
}
```

---

## Testing

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run specific test file
npm run test -- --testPathPattern=auth.service

# Run with coverage
npm run test:cov
```

### E2E Tests

```bash
# Run e2e tests
npm run test:e2e

# Run specific e2e test
npm run test:e2e -- --testPathPattern=auth
```

### Test File Convention

```
src/modules/auth/
├── auth.service.ts
├── auth.service.spec.ts      # Unit test
└── auth.controller.spec.ts   # Controller test

test/
└── auth.e2e-spec.ts          # E2E test
```

---

## Code Style

### ESLint Rules

- `@typescript-eslint/no-explicit-any: off`
- `@typescript-eslint/explicit-function-return-type: off`
- Follow NestJS conventions

### Prettier Config

```json
{
  "singleQuote": true,
  "trailingComma": "all"
}
```

### TypeScript Config

- Strict mode enabled
- Target: ES2021
- Module: CommonJS

---

## Database Setup

### PostgreSQL

```bash
# Create database
createdb authservice

# Run migrations (when implemented)
npm run migration:run

# Generate migration
npm run migration:generate -- --name=CreateUsers
```

### MongoDB

```bash
# Start MongoDB
mongod --dbpath /data/db

# Collections created automatically
```

### Redis

```bash
# Start Redis
redis-server

# Default port: 6379
```

---

## Debugging

### VS Code

1. Open VS Code
2. Press F5 (or Run > Start Debugging)
3. Server starts in debug mode

### Node Inspector

```bash
npm run start:debug
```

Then open `chrome://inspect` in Chrome.

---

## Common Tasks

### Add New Endpoint

1. Create controller method in relevant module
2. Add DTO for request validation
3. Implement service method
4. Add unit tests
5. Add e2e test if needed

### Add New Entity

1. Create entity file in module
2. Define database schema
3. Create repository
4. Add CRUD operations
5. Write tests

### Update Environment

1. Add variable to `.env`
2. Update `env.validator.ts`
3. Update `.env.example`
4. Restart server (required)

---

## Troubleshooting

### Port Already in Use

```bash
# Find process on port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Database Connection Failed

1. Check PostgreSQL/MongoDB/Redis is running
2. Verify connection strings in `.env`
3. Check firewall/network settings

### Build Errors

```bash
# Clean build
rm -rf dist
npm run build

# Check TypeScript errors
npx tsc --noEmit
```

---

## Production Deployment

See [Technical Documentation - Deployment](./technical-documentation.md#11-deployment) for Docker Compose and production checklist.

---

*Development guide generated.*
