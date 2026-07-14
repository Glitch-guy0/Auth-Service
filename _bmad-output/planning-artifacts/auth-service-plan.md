# AuthService — Planning Document

**Author:** Mary (Business Analyst) + Paige (Tech Writer)  
**Date:** 2026-07-14  
**Status:** APPROVED — Aligned with Final UML Specifications  
**Project:** AuthService

---

## 1. Executive Summary

This document outlines the final plan, feature set, and architectural decisions for AuthService — a scalable backend authentication service built with NestJS. It provides user signup, login, password reset, and authorization capabilities with analytics and session management.

---

## 2. Core Authentication & Session Strategy

### 2.1 Core Authentication Flows

| Flow | Inputs | Outputs | Status |
|------|--------|---------|--------|
| **Signup** | Username, Email, Password | Account created + JWT Access Token | ✅ Approved |
| **Login** | Username/Email + Password | Access Token + Refresh Token (HttpOnly Cookie) | ✅ Approved |
| **Reset Password** | Email (Returned in response for v1) | Reset Token (1 hour expiry, in-memory) | ✅ Approved |
| **Logout** | — | Token invalidation (DB delete + Redis blacklist) | ✅ Approved |

### 2.2 Logout & Token Management Decisions

The system implements a robust hybrid approach to logout and token lifecycle management:
1.  **Stateful Refresh Tokens:** Refresh tokens are hashed using bcrypt and stored in the PostgreSQL database.
2.  **Single Session Constraint:** To maximize security, a user is allowed exactly one active refresh token session at a time. This is enforced at the database layer where `user_id` is the Primary Key of the `auth_tokens` table.
3.  **Stateless JWT Access Tokens:** Access tokens are short-lived (1 day expiry) JWTs signed using RSA key pairs with kids managed by `KeyManager`.
4.  **Best-Effort Blacklisting (Logout):** On logout, the refresh token record is deleted from PostgreSQL, and the access token is blacklisted in Redis with a TTL matching its remaining lifespan. The `JwtAuthGuard` checks the Redis blacklist before authorizing any request.

---

## 3. Technology Stack & Databases

The service is built as a backend HTTP API with no frontend/UI client delivery in scope for v1.

| Layer | Technology | Purpose |
|------|----------|---------|
| **Framework** | NestJS (TypeScript) | Core application platform (Hexagonal Ports/Adapters pattern) |
| **Relational DB** | PostgreSQL (TypeORM) | Core storage for `users`, `auth_tokens`, and `public_key_registry` |
| **Document DB** | MongoDB (Mongoose) | Demographics logging (`user_demographics`), audit logs, and activity records |
| **In-Memory DB** | Redis | Token blacklisting, session caching, and rate limiting |
| **Validation** | Zod (Schemas) | Strict input parser validation at entry point controllers |

---

## 4. Technical Requirements

### 4.1 Security & Logging

*   **User IP & Geolocation Capture:** IP address and country/city information are captured on authentication events and written asynchronously to MongoDB.
*   **Rate Limiting:** Implemented via Redis-backed rate limiting to protect endpoints against brute force attacks.
*   **Role-Based Access Control (RBAC):** Supported roles include `Admin` (full access), `User` (own data access), and `Client` (public read-only endpoints).

### 4.2 Key Management

*   **Dynamic Signing:** JWTs are signed with a private RSA key. Public keys are registered in `PUBLIC_KEY_REGISTRY` with unique Key IDs (`kid`).
*   **Key Rotation:** The `KeyManager` handles key retrieval and clears the private key from memory immediately after use.

---

## 5. Resolved Open Questions

1.  **Logout implementation strategy?**  
    *   **Decision:** Hybrid approach. The refresh token hash is deleted from PostgreSQL and the access token is blacklisted in Redis.
2.  **Token strategy: JWT vs Session vs Hybrid?**  
    *   **Decision:** Hybrid. Stateless RSA JWT for access token, stateful bcrypt hash in PostgreSQL for refresh token.
3.  **Password reset token expiry duration?**  
    *   **Decision:** 1 hour expiry. v1 implements in-memory tokens with no email client (token shown in response).
4.  **SSO providers to support?**  
    *   **Decision:** None for v1. Enterprise SSO is out of scope.
5.  **Backend technology stack?**  
    *   **Decision:** NestJS, TypeScript, TypeORM, Mongoose.
6.  **Frontend framework?**  
    *   **Decision:** None. It is a backend HTTP API only.
7.  **Database choice?**  
    *   **Decision:** PostgreSQL (relational) + MongoDB (analytical logging) + Redis (cache).
