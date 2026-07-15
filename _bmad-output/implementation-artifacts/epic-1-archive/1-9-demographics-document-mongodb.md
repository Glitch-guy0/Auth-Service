---
story_id: 1.9
story_key: 1-9-demographics-document-mongodb
story_title: "Demographics Document (MongoDB)"
epic_num: 1
story_num: 9
status: done
created_date: 2025-01-01
---

# Story 1.9: Demographics Document (MongoDB)

## Story Summary
As a developer, I want the Demographics document type for MongoDB logging, so that demographics logging has type safety.

## User Story
**As a** developer,  
**I want** the Demographics document type for MongoDB logging,  
**So that** demographics logging has type safety.

## Acceptance Criteria

### Given the project
- When I check the demographics entity file
- Then Demographics document has fields: user_id (UUID), last_ip (string), location (object with country, city), created_at (Date)
- And it uses MongoDB collection `user_demographics`

### Given the Demographics document
- When I inspect the document definition
- Then it uses Mongoose schema decorators for MongoDB mapping
- And user_id is a UUID type (string format)
- And location is a nested object with country and city fields

### Given the Demographics document
- When I check the document exports
- Then it is properly exported for use in other modules

## Technical Requirements

### Mongoose Schema Definition
- Use `@Schema()` decorator to define the collection name
- Use `@Prop()` decorator for field definitions
- Use `@Schema({ collection: 'user_demographics' })` to specify collection name

### Field Specifications
- **user_id**: UUID (string), required, references `users.id`
- **last_ip**: string, required (IPv4 or IPv6 address)
- **location**: object, optional (semi-structured)
  - **country**: string (ISO 3166-1 alpha-2 or country name)
  - **city**: string (city name)
- **created_at**: Date, auto-generated on creation (default: `Date.now`)

### Database Configuration
- Collection name: `user_demographics`
- MongoDB connection for logging (secondary database)
- Use snake_case for field names
- Timestamps handled by document definition (not Mongoose auto-timestamps)

### Schema Options
- Enable versioning if needed (optional)
- Disable `_id` management (use `user_id` as logical key)
- Consider indexing `user_id` for efficient lookups

## Developer Context

### File Structure Requirements
```
src/modules/logging/
├── demographics.schema.ts      # Demographics Mongoose schema
├── logging.module.ts           # Logging module (future)
├── logging.service.ts          # Logging service (future)
└── logging.controller.ts       # Logging controller (future)
```

### Schema Code Structure
```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DemographicsDocument = Demographics & Document;

@Schema({ collection: 'user_demographics' })
export class Demographics {
  @Prop({ required: true })
  user_id: string;

  @Prop({ required: true })
  last_ip: string;

  @Prop({
    type: {
      country: { type: String },
      city: { type: String },
    },
    _id: false,
  })
  location: {
    country: string;
    city: string;
  };

  @Prop({ default: Date.now })
  created_at: Date;
}

export const DemographicsSchema = SchemaFactory.createForClass(Demographics);
```

### Import Paths
- Import from `@nestjs/mongoose` for decorators
- Import `Document` from `mongoose`
- Use path alias `@modules/logging` for cross-module imports

### Design Rationale
- **Hybrid database**: PostgreSQL for core auth data, MongoDB for logging (AD-3)
- **user_id as UUID**: References `users.id` in PostgreSQL, maintains referential integrity
- **last_ip**: Tracks last known IP for security auditing
- **location**: Semi-structured for flexibility (country, city, optional fields)
- **created_at**: Auto-generated for audit trail

## Architecture Compliance

### Hexagonal Architecture
- Schema represents the data model for logging
- No business logic in schema definition
- Pure data structure for MongoDB mapping

### Type Safety
- All fields have explicit TypeScript types
- Use strict mode compatible types
- Export document type for type inference in other modules

### Module Organization
- Place schema in logging module directory
- Follow NestJS module conventions
- Prepare for future module expansion

### Architecture Spine Compliance
- **AD-3**: Demographics lives in MongoDB (logging data)
- **AD-14**: Logging module writes demographics on auth events
- **AD-16**: DemographicsRepository owns all writes to user_demographics collection

## Testing Requirements

### Unit Tests
- Test schema instantiation with valid data
- Test field types and constraints
- Test required field validation (user_id, last_ip)
- Test default value for created_at
- Test location object structure

### Integration Tests
- Verify schema maps correctly to MongoDB collection
- Test document creation with valid data
- Test field validation (required fields)
- Test location object nesting

### Test File Location
```
src/modules/logging/
└── __tests__/
    └── demographics.schema.spec.ts
```

## Business Context

### Project Goals
- Build a secure, scalable authentication service
- Implement JWT-based authentication with refresh tokens
- Support user demographics logging for analytics

### Success Criteria
- Demographics document defined with all required fields
- MongoDB collection `user_demographics` configured
- Type-safe schema for demographics logging
- Compatible with NestJS Mongoose integration

### Demographics Logging
- Demographics tracks user login metadata (IP, location)
- Used for security auditing and analytics
- Semi-structured location for flexibility (city, country, optional fields)
- References user_id for correlation with user data

## Implementation Notes

### Key Considerations
- Use Mongoose decorators for MongoDB schema mapping
- Keep schema definition simple and focused
- No business logic in schema
- user_id references PostgreSQL users.id (cross-database reference)
- location is semi-structured (can extend with optional fields)
- created_at uses default: Date.now for auto-generation

### Common Pitfalls
- Don't forget to import `Document` from mongoose for type safety
- Use `_id: false` on location to prevent Mongoose from adding ObjectId
- Ensure user_id is string type (UUID stored as string in MongoDB)
- Don't use auto-timestamps (Mongoose timestamps option) — use explicit created_at
- Consider indexing user_id for efficient queries

### Future Enhancements
- Add index on user_id for efficient lookups
- Add index on created_at for time-range queries
- Add more location fields (timezone, coordinates) if needed
- Add login_count or session metadata
- Consider TTL index for automatic cleanup of old demographics

## Dependencies

### Epic Dependencies
- Depends on story 1.1 (NestJS Project Initialization)
- Depends on story 1.2 (TypeScript Configuration)
- Depends on story 1.6 (User Entity Definition) — user_id reference
- Foundation for logging module implementation

### External Dependencies
- Mongoose v7.x for MongoDB schema decorators
- @nestjs/mongoose for NestJS integration
- MongoDB v6.x or later for database
- No additional npm packages required

## Checklist

- [ ] Create logging module directory structure
- [ ] Define Demographics schema with Mongoose decorators
- [ ] Add user_id field (string, required)
- [ ] Add last_ip field (string, required)
- [ ] Add location object (country, city)
- [ ] Add created_at field (Date, default Date.now)
- [ ] Configure collection name `user_demographics`
- [ ] Export schema and document type
- [ ] Write unit tests for schema definition
- [ ] Verify schema compiles with TypeScript
- [ ] Document schema structure

---

*Story created using bmad-create-story workflow*  
*Status: ready-for-dev*  
*Next: Developer will implement Demographics document for MongoDB logging*
