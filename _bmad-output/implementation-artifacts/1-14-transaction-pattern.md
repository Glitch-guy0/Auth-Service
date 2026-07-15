---
story_id: 1.14
story_key: 1-14-transaction-pattern
story_title: "Transaction Pattern"
epic_num: 1
story_num: 14
status: ready-for-dev
created_date: 2025-01-01
---

# Story 1.14: Transaction Pattern

## Story Summary
As a developer, I want the Transaction pattern defined (createTransaction/discard), so that database operations are properly wrapped.

## User Story
**As a** developer,  
**I want** the Transaction pattern defined (createTransaction/discard),  
**So that** database operations are properly wrapped.

## Acceptance Criteria

### Given the project
- When I check the transaction file
- Then createTransaction(callback) function is defined

### Given the project
- When createTransaction(callback) is called
- Then callback receives self-contained tx object

### Given the project
- When the callback completes without error
- Then the transaction auto-commits

### Given the project
- When the callback throws an error
- Then the transaction auto-rollbacks and rethrows the error

### Given the project
- When I call discard() on the tx object
- Then explicit cleanup is performed (rollback + resource release)

## Technical Requirements

### Transaction Wrapper
- Implement `createTransaction(callback)` function that accepts an async callback
- The callback receives a self-contained `tx` object with access to database query methods
- The `tx` object should expose the same repository methods as the standard datasource but within a transactional context

### Auto-Commit on Success
- When the callback resolves successfully, automatically commit the transaction
- Ensure all changes within the callback are atomically persisted
- No manual commit call required from the consumer

### Auto-Rollback + Rethrow on Error
- When the callback throws an error or rejects, automatically rollback the transaction
- Rethrow the original error to the caller after rollback completes
- Ensure no partial state leaks from failed transactions

### Explicit Cleanup (discard)
- Provide `discard()` method on the `tx` object for explicit cleanup
- `discard()` performs rollback and releases any held resources
- Safe to call even after the transaction has already committed or rolled back (idempotent)

### Type Safety
- Define TypeScript types/interfaces for the Transaction object
- Type the callback signature: `(tx: Transaction) => Promise<T>`
- Ensure the `createTransaction` return type matches the callback return type

## Developer Context

### File Structure Requirements
```
src/
└── shared/
    └── transaction/
        ├── transaction.ts          # createTransaction implementation
        └── transaction.types.ts    # Transaction type definitions
```

### Function Signature
```typescript
// transaction.types.ts
interface Transaction {
  getRepository<T>(entity: new () => T): TransactionalRepository<T>;
  discard(): Promise<void>;
}

type TransactionCallback<T> = (tx: Transaction) => Promise<T>;

// transaction.ts
function createTransaction<T>(callback: TransactionCallback<T>): Promise<T>;
```

### Key Implementation Details
- The `tx` object wraps a TypeORM QueryRunner (or equivalent datasource transaction)
- `getRepository()` returns a repository bound to the transaction's connection
- `createTransaction` manages the full lifecycle: begin → callback → commit/rollback
- `discard()` should be idempotent — safe to call multiple times without error
- Errors from the callback are caught, trigger rollback, then rethrown as-is

### Error Handling
- Wrap the callback in try/catch
- On success: commit transaction, return result
- On error: rollback transaction, rethrow original error
- On discard: rollback if still active, release query runner

## Architecture Compliance

### Hexagonal Architecture
- Transaction pattern is a shared infrastructure concern
- Used by repository adapters to ensure atomicity
- Business logic should not know it is inside a transaction — the `tx` object abstracts this

### Module Lifecycle
- Transaction is a utility — no module lifecycle involvement
- Must be usable from any module that needs transactional database access

### Type Safety
- Strict TypeScript types for all transaction interfaces
- Generic return type propagation from callback to `createTransaction`

## Testing Requirements

### Unit Tests
- Test successful callback commits the transaction
- Test failed callback rolls back and rethrows the error
- Test discard() performs rollback
- Test discard() is idempotent
- Test callback return value is propagated correctly
- Test that query runner is properly released after transaction

### Integration Tests
- Test with real TypeORM datasource (in-memory or test DB)
- Verify atomicity: partial writes are rolled back on error
- Verify commit: all writes persist after successful callback

### Test Configuration
- Use Jest for unit tests
- Mock QueryRunner for unit tests
- Use test database for integration tests

## Business Context

### Project Goals
- Ensure all multi-step database operations are transactional
- Prevent partial state corruption on failures
- Provide a clean, ergonomic API for developers to wrap operations in transactions

### Success Criteria
- `createTransaction` function compiles without type errors
- Successful callbacks result in committed data
- Failed callbacks result in rolled-back data with error propagation
- `discard()` releases resources and prevents leaks
- Transaction pattern is used consistently across all repository operations

## Implementation Notes

### Key Considerations
- Use TypeORM's QueryRunner for transaction management
- The `tx` object should be self-contained — no access to non-transactional repositories
- Consider making the transaction timeout configurable (future enhancement)
- Ensure proper resource cleanup even in edge cases (e.g., callback throws synchronously)

### Common Pitfalls
- Forgetting to release the query runner after commit/rollback (resource leak)
- Not making discard() idempotent (double-call crashes)
- Swallowing errors instead of rethrowing after rollback
- Exposing non-transactional repositories through the `tx` object

## Dependencies

### Epic Dependencies
- Depends on Story 1.6 (User Entity Definition) — needs TypeORM entity setup
- Depends on Story 1.12 (Service Interfaces / Ports) — needs repository interfaces to type the tx object
- Depends on Story 1.13 (Exception Hierarchy) — may use exception types for error handling

### External Dependencies
- TypeORM QueryRunner (from `typeorm` package)
- PostgreSQL (runtime dependency for actual transactions)

## Checklist

- [ ] Define Transaction types and interfaces
- [ ] Implement createTransaction(callback) function
- [ ] Implement auto-commit on successful callback
- [ ] Implement auto-rollback on failed callback with error rethrow
- [ ] Implement discard() for explicit cleanup
- [ ] Ensure discard() is idempotent
- [ ] Write unit tests for commit/rollback/discard scenarios
- [ ] Write integration tests with real database
- [ ] Verify type safety across all interfaces
- [ ] Ensure proper resource cleanup (query runner release)

---

*Story created using bmad-create-story workflow*  
*Status: ready-for-dev*  
*Next: Developer will implement Transaction pattern (createTransaction/discard)*
