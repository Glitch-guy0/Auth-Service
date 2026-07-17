# Story 8.2: Pino Logger Provider

**As a developer,**
**I want the pino + chalk logger provider for colorful console output,**
**So that logs are readable, fast, and structured.**

## Acceptance Criteria:

**Given** the project
**When** I check `src/logging/logger.provider.ts`
**Then** `createLogger()` function returns a Pino logger instance
**And** it configures Pino with pino-setting options
**And** chalk is used for colored console output
**And** log levels are configurable via LOG_LEVEL environment variable
**And** the logger is exported for use across the application

**Given** the project
**When** I check the logger's behavior
**Then** log messages should be formatted with colors when running in terminal
**And** they should output structured JSON when redirected to a file
**And** debug-level logs should be filtered when LOG_LEVEL is set to warn or error
