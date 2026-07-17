# Story 8.1: Logging Module

**As a developer,**
**I want a LoggingModule with a LogManager service for structured logging,**
**So that modules can inject and use structured logging without circular dependencies.**

## Acceptance Criteria:

**Given** the project
**When** I check `src/logging/logging.module.ts`
**Then** LoggingModule is defined with proper imports and exports
**And** it exports LogManager service
**And** LoggingModule is registered as a global module

**Given** the project
**When** I check `src/logging/log-manager.service.ts`
**Then** LogManager service implements LogManager interface
**And** LogManager has methods: info, warn, error, debug, trace, log
**And** LogManager has a reference to the underlying logger (Pino logger)
**And** LogManager methods delegate to the underlying logger
