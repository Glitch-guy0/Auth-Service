# Story 8.4: Demographics Collection

**As a developer,**
**I want demographics collection to MongoDB,**
**So that user activity (IP, location) is tracked during login/registration.**

## Acceptance Criteria:

**Given** a login or registration event
**When** demographics are logged
**Then** a document is inserted into user_demographics collection
**And** it includes user_id, last_ip, location (country, city)
**And** MongoDB connection failure is handled gracefully (no crash)
**And** the demographics service uses connection from AppContext
**And** the Demographics entity (already defined) is used for type safety
