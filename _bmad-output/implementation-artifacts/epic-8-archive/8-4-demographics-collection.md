# Story 8.4: Demographics Collection

Status: done

## Story

As a developer,
I want demographics collection to MongoDB,
so that user activity is tracked.

## Acceptance Criteria

1. **Given** a successful login or registration event
   **When** demographics are logged
   **Then** a document is inserted into the `user_demographics` MongoDB collection
   **And** includes `user_id`, `last_ip`, `location` (country, city), and `created_at`

2. **Given** a demographics insert attempt
   **When** the document is created
   **Then** `user_id` is a UUID string matching the authenticated user
   **And** `last_ip` is the client's IP address (from `req.ip` or `x-forwarded-for`)
   **And** `location` is an object with `country` and `city` strings

3. **Given** MongoDB connection failure or insert error
   **When** `logDemographics()` is called
   **Then** the error is logged at `warn` level
   **And** the login/registration flow continues successfully (graceful degradation per NFR-3)

4. **Given** demographics logging is triggered
   **When** the call is made from the auth flow
   **Then** it is fire-and-forget — does not block or await in the critical auth path

## Tasks / Subtasks

- [ ] Task 1: Create `DemographicsRepository` in the logging module (AC: 1, 2, 3)
  - [ ] Create file `src/modules/logging/demographics.repository.ts`
  - [ ] Inject `@InjectModel(Demographics)` to get the Mongoose `Model<DemographicsDocument>`
  - [ ] Implement `insert(data: DemographicsData): Promise<void>` method
  - [ ] Inside `insert()`: call `this.model.create({ ...data, created_at: new Date() })`
  - [ ] Wrap `insert()` body in try/catch — on error, log warning via `Logger` and do not rethrow
  - [ ] Export `DemographicsRepository` for use by `LoggingModule`

- [ ] Task 2: Create `DemographicsService` in the logging module (AC: 1, 4)
  - [ ] Create file `src/modules/logging/demographics.service.ts`
  - [ ] Implement `logDemographics(userId: string, ip: string, location?: { country: string; city: string }): Promise<void>`
  - [ ] Delegate to `DemographicsRepository.insert()` with mapped fields: `{ user_id: userId, last_ip: ip, location }`
  - [ ] Catch and log errors from repository — never propagate to caller
  - [ ] Export `DemographicsService` for injection into other modules

- [ ] Task 3: Update `LoggingModule` with MongoDB setup (AC: 1, 3)
  - [ ] Update `src/modules/logging/logging.module.ts`
  - [ ] Import `MongooseModule.forRootAsync()` using `ConfigService` to read `MONGODB_URL` from env
  - [ ] Register `MongooseModule.forFeature([{ name: 'Demographics', schema: DemographicsSchema }])` for the model
  - [ ] Add `DemographicsRepository` and `DemographicsService` as providers
  - [ ] Export `DemographicsService` so other modules can inject it
  - [ ] Use `forRootAsync` with a try/catch in the factory so MongoDB connection failure returns gracefully (app boots without MongoDB, demographics is disabled)

- [ ] Task 4: Update `UserService` to delegate to `DemographicsService` (AC: 1, 2, 4)
  - [ ] Update `src/modules/user/user.service.ts`
  - [ ] Import and inject `DemographicsService` from `@modules/logging/demographics.service`
  - [ ] Implement `logDemographics()` method body — call `this.demographicsService.logDemographics(userId, ip, location)`
  - [ ] Remove the `throw new Error('Not implemented')` stub

- [ ] Task 5: Update `UserModule` to provide `DemographicsService` dependency (AC: 1)
  - [ ] Update `src/modules/user/user.module.ts`
  - [ ] Add `LoggingModule` to `imports` array so `DemographicsService` is available for injection

- [ ] Task 6: Wire demographics call into `AuthService` login and register flows (AC: 1, 4)
  - [ ] Update `src/modules/auth/auth.service.ts`
  - [ ] In `login()`: after token storage, call `this.userService.logDemographics(user.id, ip).catch(() => {})` (fire-and-forget)
  - [ ] In `register()`: after token storage, call `this.userService.logDemographics(user.id, ip).catch(() => {})` (fire-and-forget)
  - [ ] Note: IP parameter comes from the controller via request context or is passed down from the controller — check how auth.controller passes IP currently

- [ ] Task 7: Create geo-lookup utility (AC: 2)
  - [ ] Create file `src/shared/utils/geo-lookup.ts`
  - [ ] Export `geoLookup(ip: string): { country: string; city: string }`
  - [ ] Phase 1 implementation: return `{ country: 'unknown', city: 'unknown' }` (no external dependency)
  - [ ] Document placeholder for future MaxMind GeoLite2 integration

- [ ] Task 8: Write unit tests for `DemographicsRepository` (AC: 1, 3)
  - [ ] Create `src/modules/logging/__tests__/demographics.repository.spec.ts`
  - [ ] Test: successful insert creates document with correct fields
  - [ ] Test: MongoDB error is caught and logged, no exception thrown
  - [ ] Test: `created_at` is set to current date

- [ ] Task 9: Write unit tests for `DemographicsService` (AC: 1, 4)
  - [ ] Create `src/modules/logging/__tests__/demographics.service.spec.ts`
  - [ ] Test: `logDemographics()` delegates to repository with correct field mapping
  - [ ] Test: error in repository is caught by service, no exception propagated
  - [ ] Test: default location `{ country: 'unknown', city: 'unknown' }` when location not provided

- [ ] Task 10: Write unit tests for `UserService.logDemographics()` update (AC: 1)
  - [ ] Update `src/modules/user/__tests__/user.service.spec.ts`
  - [ ] Test: `logDemographics()` delegates to `DemographicsService` with correct arguments

## Dev Notes

### Project Structure Notes

- **Logging module** lives at `src/modules/logging/` — currently contains only `demographics.schema.ts` and an empty `logging.module.ts`
- **User module** lives at `src/modules/user/` — `UserService` already has the `logDemographics()` stub in the `IUserService` port
- **Auth module** lives at `src/modules/auth/` — `AuthService.login()` already calls `this.userService.logDemographics(user.id, '').catch(() => {})` on line 100 — this is a placeholder that needs the actual IP/location passed in
- **Path aliases**: `@modules/*`, `@shared/*`, `@config/*`, `@database/*` (from `tsconfig.json`)
- Tests follow `__tests__/` subdirectory convention

### Existing Code Context

**Auth Service** (`src/modules/auth/auth.service.ts`):

- `login()` (line 100): already has `this.userService.logDemographics(user.id, '').catch(() => {})` — the empty string `''` for IP needs to be replaced with actual IP. The `.catch(() => {})` pattern is already correct for fire-and-forget.
- `register()` (line 60): does NOT yet call `logDemographics()` — must be added after token storage.
- The service currently injects `IUserService` and `ITokenService` — no changes to constructor needed.

**Auth Controller** (`src/modules/auth/auth.controller.ts`):

- Must check how IP is currently accessed — likely via `req.ip` or `req.headers['x-forwarded-for']`
- The controller will need to pass IP down to the service, or the service must receive it via request context

**User Service** (`src/modules/user/user.service.ts`):

- `logDemographics()` (lines 40-46): currently throws `new Error('Not implemented')` — must be replaced with delegation to `DemographicsService`
- Constructor currently only injects `userRepository` — must add `DemographicsService`

**User Module** (`src/modules/user/user.module.ts`):

- Currently imports only `TypeOrmModule.forFeature([User])`
- Must add `LoggingModule` to imports so `DemographicsService` is available

**Logging Module** (`src/modules/logging/logging.module.ts`):

- Currently an empty `@Module({})` — must be populated with MongooseModule, providers, exports

**Demographics Schema** (`src/modules/logging/demographics.schema.ts`):

- Already fully implemented — `Demographics` class with `user_id`, `last_ip`, `location`, `created_at` fields
- Collection name: `user_demographics`
- Exported: `DemographicsSchema`, `DemographicsDocument`, `Demographics`

**IUserService Port** (`src/common/ports/user.port.ts`):

- Already defines: `logDemographics(userId: string, ip: string, location?: { country: string; city: string }): Promise<void>`

### Architecture References

| AD    | Title                                | Relevance                                                                                                                                                      |
| ----- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AD-3  | Hybrid Database Architecture         | MongoDB stores demographics logging data. PostgreSQL stores core auth data. Demographics writes never affect auth decisions.                                   |
| AD-10 | Demographics Logging via UserService | AuthService calls `UserService.logDemographics()`. UserService delegates to DemographicsRepository. AuthService never imports DemographicsRepository directly. |
| AD-16 | DemographicsRepository owns writes   | `DemographicsRepository` is the sole writer to `user_demographics` collection.                                                                                 |

### Key Design Decisions

1. **DemographicsService in LoggingModule, not UserModule.** The schema and repository live in the logging module. `UserModule` imports `LoggingModule` to get `DemographicsService`. This keeps MongoDB concerns in the logging module and avoids coupling UserModule to MongoDB directly.

2. **Fire-and-forget.** `logDemographics()` is called with `.catch(() => {})` in the auth flow. The auth response is returned to the client immediately. MongoDB latency or failure has zero impact on auth UX.

3. **Graceful degradation (NFR-3).** Two layers: `DemographicsRepository.insert()` catches its own errors and logs a warning. `DemographicsService.logDemographics()` also catches errors. The auth flow's `.catch(() => {})` is a third safety net. MongoDB failure is never fatal.

4. **No geo-lookup in Phase 1.** Default to `{ country: 'unknown', city: 'unknown' }`. A future story can integrate MaxMind GeoLite2 without changing the service interface.

5. **MongooseModule.forRootAsync for optional connection.** Use `ConfigService` to read `MONGODB_URL`. Wrap the factory in try/catch — if MongoDB is unavailable, the app boots without it (demographics disabled). The `DemographicsRepository` checks if the model is available before attempting inserts.

### What This Story Changes

| File                                                            | Action     | Description                                                             |
| --------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------- |
| `src/modules/logging/demographics.repository.ts`                | **CREATE** | Mongoose-based repository wrapping Demographics model insert            |
| `src/modules/logging/demographics.service.ts`                   | **CREATE** | Service delegating to repository, with error handling                   |
| `src/modules/logging/logging.module.ts`                         | **UPDATE** | Add MongooseModule, providers, exports                                  |
| `src/modules/user/user.service.ts`                              | **UPDATE** | Replace `logDemographics()` stub with delegation to DemographicsService |
| `src/modules/user/user.module.ts`                               | **UPDATE** | Add LoggingModule to imports                                            |
| `src/modules/auth/auth.service.ts`                              | **UPDATE** | Pass IP to `logDemographics()` in login, add call in register           |
| `src/shared/utils/geo-lookup.ts`                                | **CREATE** | Placeholder geo-lookup returning unknown defaults                       |
| `src/modules/logging/__tests__/demographics.repository.spec.ts` | **CREATE** | Unit tests for repository                                               |
| `src/modules/logging/__tests__/demographics.service.spec.ts`    | **CREATE** | Unit tests for service                                                  |
| `src/modules/user/__tests__/user.service.spec.ts`               | **UPDATE** | Add test for logDemographics delegation                                 |

### What Must Be Preserved

- All existing auth endpoints (register, login, refresh, logout) must continue working
- The `IUserService` port interface must not change (method signature already correct)
- `Demographics` schema must not be modified
- `LoggingModule` must be importable by `UserModule` without circular dependencies
- The `.catch(() => {})` fire-and-forget pattern must be preserved

### Dependencies

- **Story 1.9** (Demographics schema — already done, exists at `src/modules/logging/demographics.schema.ts`)
- **Story 1.12** (IUserService port — already done, includes `logDemographics` signature)
- **Story 8.1/8.2** (LoggingModule exists — the empty shell is already registered in AppModule)
- **Epic 3** (Registration flow — `AuthService.register()` exists and works)
- **Epic 4** (Login flow — `AuthService.login()` exists and works)
- `@nestjs/mongoose` and `mongoose` already installed in `package.json`

## Dev Agent Record

### Agent Model Used

(opencode/big-pickle)

### Debug Log References

(none yet)

### Completion Notes List

(none yet)

### File List

(none yet)

---

_Story created for Epic 8: Logging & Observability_
_Status: ready-for-dev_
