---
story_id: 1.1
story_key: 1-1-nestjs-project-initialization
story_title: "NestJS Project Initialization"
epic_num: 1
story_num: 1
status: ready-for-dev
created_date: 2025-01-01
---

# Story 1.1: NestJS Project Initialization

## Story Summary
As a developer, I want a properly initialized NestJS project with all dependencies, so that I can start building features on a solid foundation.

## User Story
**As a** developer,  
**I want** a properly initialized NestJS project with all dependencies,  
**So that** I can start building features on a solid foundation.

## Acceptance Criteria

### Given the project repository
- When I run `npm install`
- Then all dependencies are installed without errors

### Given the project
- When I check `package.json`
- Then it contains all required dependencies (NestJS, TypeORM, jose, bcrypt, pino, zod)
- And scripts are defined (start:dev, build, test, test:e2e, lint, setup:keys, db:migrate, db:seed)

## Technical Requirements

### NestJS Framework
- Use NestJS v10.x as the application framework
- Configure NestJS CLI for project scaffolding

### TypeScript Configuration
- TypeScript 5.x with strict mode enabled
- Path aliases configured for clean imports

### Dependencies
- Core dependencies: @nestjs/core, @nestjs/common, @nestjs/platform-express
- Database: TypeORM, PostgreSQL driver, Mongoose for MongoDB, ioredis for Redis
- Security: jose (JWT), bcrypt (password hashing)
- Validation: Zod for schema validation
- Logging: pino, chalk for colorful output
- Documentation: Swagger, @nestjs/swagger

### Project Structure
- Follow NestJS standard project structure
- Organize by feature modules
- Implement hexagonal architecture pattern

## Developer Context

### File Structure Requirements
```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── config/                    # Configuration files
├── modules/                   # Feature modules
│   ├── auth/                  # Authentication module
│   ├── user/                  # User management module
│   ├── token/                 # Token management module
│   └── logging/               # Logging module
├── shared/                    # Shared utilities
├── common/                    # Common types and interfaces
└── types/                     # TypeScript type definitions
```

### Package.json Scripts
- `start:dev`: Start development server with hot-reload
- `build`: Compile TypeScript to JavaScript
- `test`: Run unit tests
- `test:e2e`: Run end-to-end tests
- `lint`: Run ESLint and Prettier
- `setup:keys`: Generate RSA key pairs for JWT signing
- `db:migrate`: Run database migrations
- `db:seed`: Seed database with initial data

### Dependencies to Install
```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "typeorm": "^0.3.17",
    "pg": "^8.11.3",
    "mongoose": "^7.6.3",
    "ioredis": "^5.3.2",
    "jose": "^5.1.0",
    "bcrypt": "^5.1.1",
    "zod": "^3.22.4",
    "pino": "^8.16.2",
    "chalk": "^4.1.2",
    "@nestjs/swagger": "^7.1.16",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@types/node": "^20.9.0",
    "@types/bcrypt": "^5.0.0",
    "typescript": "^5.2.2",
    "ts-node": "^10.9.1",
    "@nestjs/cli": "^10.2.1",
    "@nestjs/testing": "^10.2.1",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "supertest": "^6.3.3",
    "eslint": "^8.53.0",
    "prettier": "^3.1.0",
    "@typescript-eslint/eslint-plugin": "^6.10.0",
    "@typescript-eslint/parser": "^6.10.0"
  }
}
```

## Architecture Compliance

### Hexagonal Architecture
- Implement Ports & Adapters pattern
- Separate business logic from infrastructure
- Define interfaces (ports) for external dependencies

### Module Lifecycle
- Follow NestJS module lifecycle: setup() → run() → shutdown()
- Each module should be self-contained
- Use dependency injection for loose coupling

### Type Safety
- Enable TypeScript strict mode
- Use type inference where possible
- Define explicit types for all public APIs

## Testing Requirements

### Unit Tests
- Test each service and controller independently
- Mock external dependencies
- Achieve >80% code coverage

### Integration Tests
- Test module interactions
- Verify database operations
- Test API endpoints with Supertest

### Test Configuration
- Jest configuration in `jest.config.js`
- Separate test environments for unit and e2e tests

## Business Context

### Project Goals
- Build a secure, scalable authentication service
- Implement JWT-based authentication with refresh tokens
- Support user registration, login, logout, and token refresh

### Success Criteria
- Application starts without errors
- All dependencies installed correctly
- TypeScript compilation works
- Basic NestJS application boots successfully
- Development environment ready for feature development

## Implementation Notes

### Key Considerations
- Use environment variables for configuration
- Implement proper logging from the start
- Set up Swagger documentation early
- Configure path aliases for clean imports

### Common Pitfalls
- Don't forget to install all required dependencies
- Ensure TypeScript strict mode is enabled
- Set up proper module imports in app.module.ts
- Configure path aliases correctly in tsconfig.json

## Dependencies

### Epic Dependencies
- This is the first story in epic 1
- No dependencies on other stories
- Foundation for all subsequent stories

### External Dependencies
- Node.js v18.x or later
- npm v9.x or later
- PostgreSQL (for later stories)
- MongoDB (for later stories)
- Redis (for later stories)

## Checklist

- [ ] Initialize NestJS project
- [ ] Install all dependencies
- [ ] Configure TypeScript
- [ ] Set up project structure
- [ ] Create package.json scripts
- [ ] Verify application boots
- [ ] Run basic tests
- [ ] Set up development environment

---

*Story created using bmad-create-story workflow*  
*Status: ready-for-dev*  
*Next: Developer will implement NestJS project initialization*