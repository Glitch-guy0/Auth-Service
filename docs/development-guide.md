# AuthService Development Guide

## 1. Prerequisites

- **Node.js** 22.x
- **npm** 10+
- **PostgreSQL** 16+
- **MongoDB** 7+
- **Redis** 7+
- **Docker** and Docker Compose (for infrastructure services)

## 2. Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd AuthService

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Generate RSA key pair for JWT signing
npm run setup:keys

# Start infrastructure services (PostgreSQL, MongoDB, Redis)
docker-compose up -d

# Start the application in development mode
npm run start:dev
```

The application will be available at `http://localhost:3000` by default.

## 3. Project Structure

```
src/
├── common/
│   └── ports/              # Port interfaces for dependency inversion
├── config/
│   ├── app-context.ts      # Application context setup
│   ├── env.validator.ts    # Environment variable validation
│   └── __tests__/
├── modules/
│   ├── auth/               # Authentication (login, register, JWT)
│   │   ├── dto/
│   │   ├── guards/
│   │   ├── pipes/
│   │   └── __tests__/
│   ├── user/               # User management
│   │   └── __tests__/
│   ├── token/              # Token lifecycle (issue, refresh, revoke)
│   │   └── __tests__/
│   ├── key/                # RSA key management and rotation
│   │   └── __tests__/
│   ├── redis/              # Redis connection and caching
│   └── logging/            # MongoDB-backed logging (pino + chalk)
│       └── __tests__/
├── shared/
│   ├── exceptions/         # Exception filters and custom exceptions
│   ├── interceptors/       # Response transformation interceptors
│   ├── logging/            # Pino logger, chalk transport, middleware
│   ├── transaction/        # Database transaction utilities
│   ├── types/              # Shared request types
│   └── utils/              # Utility functions (geo-lookup, etc.)
├── types/                  # Application-wide type definitions
│   ├── api-response.types.ts
│   ├── jwt.types.ts
│   └── keys.types.ts
├── scripts/                # Setup and maintenance scripts
│   └── setup-keys.ts
├── app.module.ts           # Root application module
├── app.controller.ts       # Root controller (health check)
├── main.ts                 # Application bootstrap
└── index.ts                # Public API exports
```

**Directory purposes:**

| Directory | Purpose |
|---|---|
| `modules/` | Feature modules, each encapsulating a domain concern |
| `shared/` | Cross-cutting utilities used by multiple modules |
| `config/` | Environment validation and application context |
| `common/ports/` | Port interfaces enabling dependency inversion between modules |
| `types/` | Shared TypeScript type definitions |
| `scripts/` | One-off setup and maintenance scripts |

## 4. Available Scripts

| Script | Description |
|---|---|
| `npm run start:dev` | Start the application in watch mode (hot reload) |
| `npm run start:debug` | Start in watch mode with Node.js inspector attached |
| `npm run start:prod` | Run the compiled application from `dist/` |
| `npm run build` | Compile TypeScript to JavaScript in `dist/` |
| `npm test` | Run all unit tests with Jest |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:cov` | Run tests with coverage report |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run lint` | Run ESLint with auto-fix on `src/` and `test/` |
| `npm run lint:fix` | Alias for `lint` |
| `npm run setup:keys` | Generate RSA key pair for JWT signing |
| `npm run db:migrate` | Run TypeORM database migrations |
| `npm run db:seed` | Seed the database with initial data |

## 5. Path Aliases

The project defines the following TypeScript path aliases:

| Alias | Maps To |
|---|---|
| `@modules/*` | `src/modules/*` |
| `@shared/*` | `src/shared/*` |
| `@config/*` | `src/config/*` |

**Usage in imports:**

```typescript
// Instead of relative paths like:
import { UserService } from '../../user/user.service';

// Use path aliases:
import { UserService } from '@modules/user/user.service';
import { PinoLogger } from '@shared/logging/pino-logger';
import { envValidator } from '@config/env.validator';
```

## 6. Module Development Pattern

### Creating a new module

```bash
nest g module modules/<module-name>
nest g service modules/<module-name>
nest g controller modules/<module-name>
```

### Module structure

Each feature module follows this layout:

```
src/modules/<module-name>/
├── <module-name>.module.ts    # NestJS module definition
├── <module-name>.service.ts   # Business logic
├── <entity>.entity.ts         # TypeORM entity (if applicable)
├── dto/                       # Data transfer objects (Zod schemas)
└── __tests__/                 # Unit tests
```

### Port interface pattern

For loose coupling between modules, define port interfaces in `src/common/ports/`:

```typescript
// src/common/ports/user.port.ts
export abstract class UserPort {
  abstract findById(id: string): Promise<User | null>;
}
```

Implement the port in the owning module and provide it via NestJS dependency injection. Consuming modules depend on the port, not the concrete implementation.

### Dependency injection

Modules declare their dependencies in the `@Module` decorator. Services are injected via constructor parameters using `@Injectable()` and the port interfaces defined in `common/ports/`.

## 7. Testing

### Unit tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run with coverage report
npm run test:cov
```

Unit test files are located in `__tests__/` directories alongside the code they test, using the `.spec.ts` suffix.

### End-to-end tests

```bash
npm run test:e2e
```

E2E tests are located in the `test/` directory at the project root and use a separate Jest configuration (`test/jest-e2e.json`).

### Test conventions

- Test files use the `.spec.ts` extension.
- Tests reside in `__tests__/` directories within each module or shared directory.
- Use `@nestjs/testing` for creating test modules with proper dependency injection.
- Mock external dependencies (databases, external services) using Jest mocks.

## 8. Code Style

### ESLint

The project uses ESLint 9 with `@typescript-eslint`. Run linting with:

```bash
npm run lint
```

Key rules enforced:
- Consistent type imports.
- No unused variables or explicit `any` types.
- Enforced code style via Prettier integration.

### Prettier

Formatting is handled by Prettier with the ESLint plugin, so linting also applies formatting fixes. The configuration is defined in `eslint.config.mjs`.

### TypeScript

The project uses TypeScript 5.8 with `strict: true` enabled. This means:
- Strict null checks.
- No implicit `any`.
- Strict function types.
- All strict family checks are active.

Always ensure new code compiles without errors by running `npm run build` before committing.

## 9. Database

### PostgreSQL (TypeORM)

- Used for core domain data (users, tokens, keys).
- Entity files are located within each module directory (e.g., `user.entity.ts`, `auth-token.entity.ts`).
- TypeORM connects via environment variables defined in `.env`.

### MongoDB (Mongoose)

- Used for structured logging and demographics tracking.
- Schemas are defined in the logging module (`demographics.schema.ts`).
- Connection is managed by `@nestjs/mongoose`.

### Migrations

```bash
npm run db:migrate
```

Migrations are managed via the TypeORM CLI. The data source configuration is located at `src/config/data-source.ts`.

### Seeding

```bash
npm run db:seed
```

Populates the database with initial data required for development.

## 10. Debugging

### VS Code

The project includes a launch configuration for VS Code. Press `F5` to start debugging with breakpoints, variable inspection, and call stack support.

### Node Inspector

To attach an external debugger or use Chrome DevTools:

```bash
npm run start:debug
```

This starts the application with `--inspect-brk` and watches for file changes.

To debug tests:

```bash
npm run test:debug
```

This runs Jest with the Node.js inspector attached, pausing execution on the first line.

### Docker Services

To inspect running infrastructure:

```bash
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```
