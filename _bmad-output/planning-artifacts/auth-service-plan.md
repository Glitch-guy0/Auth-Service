# AuthService — Planning Document

**Author:** Mary (Business Analyst) + Paige (Tech Writer)  
**Date:** 2026-07-11  
**Status:** DRAFT — Awaiting Clarifications  
**Project:** AuthService

---

## 1. Executive Summary

This document outlines the requirements and planning for an authentication service that provides user signup, login, password reset, and authorization capabilities with analytics and SSO integration.

---

## 2. User Requirements

### 2.1 Core Authentication Flows

| Flow | Inputs | Outputs | Status |
|------|--------|---------|--------|
| **Signup** | Username, Email, Password | Account created | ✅ Defined |
| **Login** | Username/Email + Password | Access Token + Refresh Token | ✅ Defined |
| **Reset Password** | Email | Reset Token (email) | ✅ Defined |
| **Logout** | — | Token invalidation | ⚠️ TBD |

### 2.2 Logout Decision Required

**Options:**
- **Option A:** Client-side only (clear tokens from storage) — Simple, no revocation
- **Option B:** Server-side session invalidation + client clear — Recommended for security
- **Option C:** Token blacklisting — Full revocation, requires storage

**Recommendation:** Option B for most use cases; Option C if compliance requires explicit revocation.

---

## 3. HTML/UI Delivery Strategy

Two delivery modes identified:

| Mode | Use Case | Pros | Cons |
|------|----------|------|------|
| **Full Page** | Standalone apps, SSR | SEO, simple | Less reusable |
| **Component** | SPAs, micro-frontends | Reusable, lazy-load | Requires framework |

**Decision Required:** Which frontend framework? (React, Vue, Angular, vanilla JS)

---

## 4. Technical Requirements

### 4.1 Security & Logging

| Requirement | Description | Priority |
|-------------|-------------|----------|
| User IP Capture | Log source IP on auth events | **High** |
| Geolocation | Country/location from IP | **High** |
| Rate Limiting | Prevent brute force on login | **Critical** |
| RBAC | Role-based access (Admin/User/Client) | **High** |

### 4.2 Token Management

| Component | Description | Priority |
|-----------|-------------|----------|
| Access Token | Short-lived JWT for API auth | **Critical** |
| Refresh Token | Long-lived, stored securely | **Critical** |
| Token Rotation | Refresh on use, revoke old | **High** |

### 4.3 Analytics & Admin

| Feature | Description | Priority |
|---------|-------------|----------|
| Login Analytics | Track auth events, success/failure rates | **Medium** |
| Analytics Dashboard | Admin page for usage metrics | **Medium** |
| SSO Client Library | Simplified OAuth2 integration | **Medium** |

---

## 5. RBAC Model

```
Admin
├── Full system access
├── User management
└── Analytics access

User
├── Profile management
├── Own data access
└── Limited API access

Client
├── Read-only API access
└── Public endpoints only
```

---

## 6. Open Questions (Blocking)

| # | Question | Impact | Owner |
|---|----------|--------|-------|
| 1 | Logout implementation strategy? | Security model | Prajwal |
| 2 | Token strategy: JWT vs Session vs Hybrid? | Architecture | Prajwal |
| 3 | Password reset token expiry duration? | UX + Security | Prajwal |
| 4 | SSO providers to support? | Scope | Prajwal |
| 5 | Backend technology stack? | Implementation | Prajwal |
| 6 | Frontend framework? | UI delivery | Prajwal |
| 7 | Database choice? | Data layer | Prajwal |

---

## 7. Recommended Next Steps

1. **Resolve open questions** (blocking)
2. **Create PRD** with full requirements
3. **Design architecture** (token flow, RBAC model)
4. **Define API contracts**
5. **Plan sprint backlog**

---

*Document will be updated as decisions are made.*
