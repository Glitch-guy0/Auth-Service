# Story 8.3: Request Logging Interceptor

**As a developer,**
**I want an interceptor that logs all HTTP requests,**
**So that request/response details are tracked with request IDs and sensitive data redaction.**

## Acceptance Criteria:

**Given** an HTTP request
**When** LoggingInterceptor processes it
**Then** it logs method, path, status code, duration
**And** it includes request ID for tracing across microservices
**And** it redacts sensitive data (passwords, tokens) in the logs
**And** it integrates with the AppContext's LogManager for consistency
