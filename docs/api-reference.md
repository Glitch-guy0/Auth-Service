# API Reference

**AuthService REST API v1**

---

## Overview

| Property | Value |
|----------|-------|
| Base URL | `http://localhost:3000` |
| Versioning | URI prefix (`/v1/auth/...`) |
| Swagger UI | `/api` |
| Auth Method | Bearer token + httpOnly refresh cookie |

### Response Envelope

Every response follows a consistent envelope format.

**Success:**

```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "timestamp": "2026-07-18T12:00:00.000Z",
    "path": "/v1/auth/authenticate"
  }
}
```

The `TransformResponseInterceptor` wraps all successful responses in `{ success: true, data }`. The `AllExceptionsFilter` wraps all errors in `{ success: false, error }`.

### Authentication

- **Access tokens** are passed via the `Authorization: Bearer <token>` header.
- **Refresh tokens** are delivered and consumed exclusively through `httpOnly` cookies.
- Interactive API docs are available at [GET /api](/api).

### Related Diagrams

- [Registration Flow](./diagrams/01-sequence-registration.mmd)
- [Login Flow](./diagrams/02-sequence-login.mmd)
- [Refresh Flow](./diagrams/03-sequence-refresh.mmd)
- [Logout + Blacklist](./diagrams/04-sequence-logout.mmd)

---

## POST /v1/auth/register

Create a new user account.

**Request Body:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `username` | string | min 3 chars, unique | User's display name |
| `email` | string | valid email format, unique | User's email address |
| `password` | string | min 8 chars | User's password |

Validation is performed by `RegisterSchema` (Zod) via `ZodValidationPipe`.

**Example Request:**

```http
POST /v1/auth/register HTTP/1.1
Content-Type: application/json

{
  "username": "alice",
  "email": "alice@example.com",
  "password": "securepass123"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "a1b2c3d4e5f6...",
    "expiresIn": 86400
  }
}
```

The refresh token is also set as an `httpOnly` cookie via the `Set-Cookie` header. See [Cookie Details](#cookie-details).

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body fails Zod validation (missing fields, invalid email, short password) |
| `VALIDATION_USER_EXISTS` | 409 | Username or email already registered |

See also: [Registration sequence diagram](./diagrams/01-sequence-registration.mmd).

---

## POST /v1/auth/authenticate

Authenticate with username/email and password.

**Request Body:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `usernameOrEmail` | string | 3-254 chars | Username or email address |
| `password` | string | 8-20 chars | User's password |

Validation is performed by `LoginSchema` (Zod) via `ZodValidationPipe`.

The service resolves the input by checking for `@` to distinguish email from username.

**Example Request:**

```http
POST /v1/auth/authenticate HTTP/1.1
Content-Type: application/json

{
  "usernameOrEmail": "alice@example.com",
  "password": "securepass123"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "a1b2c3d4e5f6...",
    "expiresIn": 86400
  }
}
```

The refresh token is also set as an `httpOnly` cookie. See [Cookie Details](#cookie-details).

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body fails Zod validation |
| `AUTH_INVALID_CREDENTIALS` | 401 | User not found or password mismatch |
| `AUTH_USER_BLOCKED` | 403 | User account has been blocked |

See also: [Login sequence diagram](./diagrams/02-sequence-login.mmd).

---

## POST /v1/auth/refresh

Rotate tokens using the refresh token from the cookie.

**Required:** `Cookie: refreshToken=<token>` (set automatically by register or authenticate).

No request body is needed. The refresh token is read from the cookie by the controller.

**Example Request:**

```http
POST /v1/auth/refresh HTTP/1.1
Cookie: refreshToken=a1b2c3d4e5f6...
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "newRefreshTokenValue...",
    "expiresIn": 86400
  }
}
```

A new refresh token is rotated on every call. The old token is invalidated. A new `Set-Cookie` header is returned.

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Refresh token not found or rotation failed |
| `TOKEN_EXPIRED` | 401 | Refresh token has exceeded its 7-day expiry |

See also: [Refresh sequence diagram](./diagrams/03-sequence-refresh.mmd).

---

## POST /v1/auth/logout

Revoke all tokens and log out the user.

**Required:** `Authorization: Bearer <access_token>`

No request body is needed. The access token is used to identify the user and revoke their session.

**Example Request:**

```http
POST /v1/auth/logout HTTP/1.1
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

**Success Response (200):**

```json
{
  "success": true,
  "data": null
}
```

**Side Effects:**

1. The refresh token is deleted from PostgreSQL.
2. The access token is blacklisted in Redis (best-effort; Redis failures are silently caught).
3. The `refreshToken` cookie is cleared by the response.

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `AUTH_ERROR` | 401 | Missing or invalid Authorization header |

Note: Logout is designed to complete even if the access token is already invalid or expired.

See also: [Logout sequence diagram](./diagrams/04-sequence-logout.mmd).

---

## Error Codes Reference

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body fails Zod validation |
| `VALIDATION_USER_EXISTS` | 409 | Username or email already exists |
| `AUTH_INVALID_CREDENTIALS` | 401 | Invalid username/email or password |
| `AUTH_USER_BLOCKED` | 403 | User account has been blocked |
| `AUTH_USER_NOT_FOUND` | 401 | User does not exist |
| `TOKEN_EXPIRED` | 401 | JWT or refresh token has expired |
| `TOKEN_REVOKED` | 401 | Token was revoked via logout/blacklist |
| `TOKEN_INVALID_SIGNATURE` | 401 | JWT signature verification failed |
| `AUTH_ERROR` | 401 | Generic authentication failure |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

Error codes are machine-readable strings. Use them to drive client-side logic rather than parsing the message text.

---

## Cookie Details

The refresh token is stored in an `httpOnly` cookie with the following attributes:

| Attribute | Value | Description |
|-----------|-------|-------------|
| Name | `refreshToken` | Cookie key name |
| `httpOnly` | `true` | Not accessible via JavaScript |
| `secure` | `true` | Sent only over HTTPS |
| `sameSite` | `strict` | Not sent on cross-origin requests |
| `path` | `/auth` | Scoped to auth endpoints only |
| `maxAge` | `604800000` (7 days) | Automatic expiry in milliseconds |

In local development without HTTPS, the `secure` flag may cause the cookie to not be set by the browser. Use a reverse proxy with TLS or test against `https://localhost` if available.

---

## Swagger

Interactive API documentation is available at:

```
GET http://localhost:3000/api
```

The Swagger UI is generated from the NestJS decorators on the controller and supports trying requests directly from the browser.

---

*Last updated: 2026-07-18*
