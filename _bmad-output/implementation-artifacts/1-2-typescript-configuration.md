---
story_id: 1.2
story_key: 1-2-typescript-configuration
story_title: "TypeScript Configuration"
epic_num: 1
story_num: 2
status: ready-for-dev
created_date: 2025-01-01
---

# Story 1.2: TypeScript Configuration

## Story Summary
As a developer, I want strict TypeScript configuration with path aliases, so that the codebase is type-safe and imports are clean.

## User Story
**As a** developer,  
**I want** strict TypeScript configuration with path aliases,  
**So that** the codebase is type-safe and imports are clean.

## Acceptance Criteria

### Given the project
- When I check `tsconfig.json`
- Then strict mode is enabled (`"strict": true`)
- And path aliases are configured (`@shared/*`, `@modules/*`, `@config/*`, `@database/*`)
- And `baseUrl` is set to `"."`

### Given Jest configuration
- When I run tests with path-aliased imports
- Then Jest resolves them correctly via `moduleNameMapper`

## Technical Requirements

### TypeScript Configuration
- Use TypeScript 5.x with strict mode enabled
- Configure path aliases for clean imports
- Set `baseUrl` to `"."`

### Path Aliases
- `@shared/*` → `src/shared/*`
- `@modules/*` → `src/modules/*`
- `@config/*` → `src/config/*`
- `@database/*` → `src/database/*`

### Jest Integration
- Jest `moduleNameMapper` in `package.json` mirrors all path aliases
- `tsconfig.build.json` extends `tsconfig.json`

### Compiler Options
- `target`: ES2021
- `module`: CommonJS
- `moduleResolution`: node
- `esModuleInterop`: true
- `removeComments`: false (preserve comments for Swagger)
- `emitDecoratorMetadata`: true (required for TypeORM/NestJS decorators)
- `experimentalDecorators`: true
- `allowSyntheticDefaultImports`: true
- `sourceMap`: true
- `outDir`: `./dist`
- `baseUrl`: `.`
- `incremental`: true

## Developer Context

### File Structure Requirements
```
/
├── tsconfig.json            # Main TypeScript configuration
├── tsconfig.build.json      # Build-specific config (extends tsconfig.json)
└── package.json             # Jest moduleNameMapper for path aliases
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
    "declaration": true,
    "removeComments": false,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": ".",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@modules/*": ["src/modules/*"],
      "@config/*": ["src/config/*"],
      "@database/*": ["src/database/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### tsconfig.build.json
```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts", "**/*e2e-spec.ts"]
}
```

### Jest moduleNameMapper
```json
{
  "jest": {
    "moduleNameMapper": {
      "^@shared/(.*)$": "<rootDir>/src/shared/$1",
      "^@modules/(.*)$": "<rootDir>/src/modules/$1",
      "^@config/(.*)$": "<rootDir>/src/config/$1",
      "^@database/(.*)$": "<rootDir>/src/database/$1"
    }
  }
}
```

### Key Configuration Details
- **baseUrl**: `"."` — enables non-relative imports from project root
- **paths**: Each alias maps `@scope/*` to `src/scope/*` — keeps imports clean and predictable
- **strict**: `true` — enables all strict type-checking options (`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`)
- **emitDecoratorMetadata** and **experimentalDecorators**: Required for TypeORM entities and NestJS decorators (`@Injectable`, `@Module`, etc.)

## Architecture Compliance

### Hexagonal Architecture
- Path aliases support the hexagonal pattern by making imports clean between modules, ports, and adapters
- `@modules/*` aliases align with the feature-based module structure defined in ARCHITECTURE-SPINE.md §Structural Seed
- `@shared/*` aliases support cross-cutting concerns (types, exceptions, transactions)

### Module Structure
- Path aliases match the structural seed layout:
  - `@modules/auth/` → `src/modules/auth/`
  - `@modules/user/` → `src/modules/user/`
  - `@modules/token/` → `src/modules/token/`
  - `@modules/key/` → `src/modules/key/`
  - `@shared/types/` → `src/shared/types/`
  - `@shared/exceptions/` → `src/shared/exceptions/`
  - `@shared/transaction/` → `src/shared/transaction/`
  - `@config/` → `src/config/`

### Import Convention
- Use path aliases for all cross-directory imports
- Relative imports (`./`) are acceptable within the same module directory
- Example: `import { User } from '@modules/user/user.entity';` instead of `import { User } from '../../modules/user/user.entity';`

## Testing Requirements

### Jest Path Resolution
- Verify `moduleNameMapper` in `package.json` matches `tsconfig.json` paths exactly
- All four aliases must work: `@shared`, `@modules`, `@config`, `@database`
- Run `npm test` to verify path resolution works

### Type Checking
- Verify `tsc --noEmit` completes without errors
- Verify strict mode catches potential issues (implicit any, null checks, etc.)
- Ensure decorator metadata is emitted correctly for TypeORM/NestJS

### Build Verification
- Verify `npm run build` produces valid output in `./dist`
- Verify `tsconfig.build.json` excludes test files from build output

## Business Context

### Project Goals
- Build a secure, scalable authentication service
- TypeScript strict mode prevents runtime type errors
- Path aliases reduce cognitive overhead when navigating the codebase

### Success Criteria
- `tsconfig.json` has `"strict": true`
- All four path aliases configured and functional
- `baseUrl` set to `"."`
- Jest `moduleNameMapper` mirrors path aliases
- `tsc --noEmit` passes without errors
- `npm run build` succeeds
- Developer experience improved with clean, short imports

## Implementation Notes

### Key Considerations
- The existing `tsconfig.json` may already have some of these settings — verify and augment
- Ensure `tsconfig.build.json` extends `tsconfig.json` (not re-declares)
- Jest `moduleNameMapper` must exactly mirror the TypeScript `paths` configuration
- Path aliases are a developer convenience — they don't affect runtime behavior
- `baseUrl: "."` is required for the path aliases to resolve correctly

### Common Pitfalls
- Forgetting to update Jest `moduleNameMapper` when adding/changing TypeScript paths
- Using `baseUrl: "./"` vs `"."` — both work, but be consistent
- Missing `emitDecoratorMetadata` breaks TypeORM and NestJS decorator-based DI
- Not excluding test files from `tsconfig.build.json` build output

## Dependencies

### Epic Dependencies
- Depends on Story 1.1 (package.json and project structure must exist)
- Foundation for Story 1.3 (path aliases used for `@config/*` imports)

### External Dependencies
- TypeScript 5.x (installed in Story 1.1)
- Node.js v18.x or later

## Checklist

- [ ] Verify existing `tsconfig.json` settings
- [ ] Set `"strict": true` in `tsconfig.json`
- [ ] Set `"baseUrl": "."` in `tsconfig.json`
- [ ] Configure path aliases: `@shared/*`, `@modules/*`, `@config/*`, `@database/*`
- [ ] Create or verify `tsconfig.build.json` extends `tsconfig.json`
- [ ] Add Jest `moduleNameMapper` to `package.json` mirroring path aliases
- [ ] Run `tsc --noEmit` to verify type checking passes
- [ ] Run `npm run build` to verify build succeeds
- [ ] Run `npm test` to verify Jest resolves path aliases
- [ ] Verify decorator metadata is emitted (`emitDecoratorMetadata: true`)

---

*Story created using bmad-create-story workflow*  
*Status: ready-for-dev*  
*Next: Developer will implement TypeScript configuration*
