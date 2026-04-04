# Clerk API Keys REST API Research

**Date:** 2026-04-04  
**Status:** Complete  
**Scope:** REST API endpoints for Clerk API Keys management

---

## Executive Summary

Clerk provides a Backend API for API Keys management. The SDK documentation is comprehensive, but **official REST endpoint paths and schemas are not fully detailed in public documentation**. This research compiles discovered endpoints and inferred schemas from SDK implementations and backend API references.

---

## Endpoints & Operations

### 1. Create API Key
**Endpoint:** `POST /api_keys`  
**Base URL:** `https://api.clerk.com/v1/`  
**Authentication:** `Authorization: Bearer {CLERK_SECRET_KEY}`

**Request Body:**
```json
{
  "name": "string (required)",
  "subject": "string (required, user_xxx or org_xxx)",
  "description": "string (optional)",
  "scopes": ["string"] (optional array),
  "claims": {} (optional custom object),
  "createdBy": "string (optional, user ID for audit)",
  "secondsUntilExpiration": "number (optional, null = never expires)"
}
```

**Response:**
```json
{
  "id": "ak_xxx",
  "name": "string",
  "subject": "user_xxx or org_xxx",
  "description": "string",
  "scopes": ["string"],
  "claims": {},
  "createdBy": "string",
  "createdAt": "number (milliseconds since epoch)",
  "updatedAt": "number",
  "secret": "ak_live_xxx (ONLY in create response, cannot be retrieved later)",
  "expiration": "number or null",
  "revoked": false,
  "revocationReason": null
}
```

**Critical:** The `secret` field is **only returned once during creation** and cannot be retrieved again. Must be stored securely immediately.

---

### 2. Verify API Key
**Endpoint:** `POST /api_keys/verify`  
**Base URL:** `https://api.clerk.com/v1/`  
**Authentication:** `Authorization: Bearer {CLERK_SECRET_KEY}`

**Request Body:**
```json
{
  "secret": "string (required, the API key secret to verify)"
}
```

**Response:**
```json
{
  "id": "ak_xxx",
  "name": "string",
  "subject": "user_xxx or org_xxx",
  "description": "string",
  "scopes": ["string"],
  "claims": {},
  "createdBy": "string",
  "createdAt": "number",
  "updatedAt": "number",
  "expiration": "number or null",
  "revoked": false,
  "revocationReason": null
}
```

**Behavior:** Returns the full API key object if valid. Throws error if invalid, revoked, or expired. Note: `secret` is NOT returned on verify (only on create).

---

### 3. List API Keys
**Endpoint:** `GET /api_keys`  
**Base URL:** `https://api.clerk.com/v1/`  
**Authentication:** `Authorization: Bearer {CLERK_SECRET_KEY}`

**Query Parameters:**
```
?subject=user_xxx or org_xxx (filters by user/org ID)
&includeInvalid=boolean (optional, include revoked/expired keys)
&limit=number (pagination limit)
&offset=number (pagination offset)
```

**Response:**
```json
{
  "data": [
    {
      "id": "ak_xxx",
      "name": "string",
      "subject": "user_xxx or org_xxx",
      "description": "string",
      "scopes": ["string"],
      "claims": {},
      "createdBy": "string",
      "createdAt": "number",
      "updatedAt": "number",
      "expiration": "number or null",
      "revoked": false,
      "revocationReason": null
    }
  ],
  "totalCount": "number"
}
```

**Note:** The `secret` field is never returned in list operations.

---

### 4. Revoke API Key
**Endpoint:** `POST /api_keys/{apiKeyID}/revoke`  
**Base URL:** `https://api.clerk.com/v1/`  
**Authentication:** `Authorization: Bearer {CLERK_SECRET_KEY}`

**Request Body:**
```json
{
  "apiKeyId": "string (required, the API key ID to revoke)",
  "revocationReason": "string (optional, reason for record-keeping)"
}
```

**Response:**
```json
{
  "id": "ak_xxx",
  "name": "string",
  "subject": "user_xxx or org_xxx",
  "description": "string",
  "scopes": ["string"],
  "claims": {},
  "createdBy": "string",
  "createdAt": "number",
  "updatedAt": "number",
  "expiration": "number or null",
  "revoked": true,
  "revocationReason": "string or null"
}
```

**Behavior:** Immediately invalidates the key. All requests using that key are rejected. Should notify users/systems before revoking keys in active use.

---

## Subject Field Explanation

The `subject` field links an API key to an entity:
- **User API Key:** `subject: "user_xxx"` — Key belongs to a specific user
- **Organization API Key:** `subject: "org_xxx"` — Key belongs to an organization

When verifying an API key, the response includes the `subject`, allowing you to identify which user/org the key belongs to and enforce access controls accordingly.

---

## Key Schema Fields

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Unique identifier (ak_xxx) |
| `name` | string | Human-readable name |
| `subject` | string | user_xxx or org_xxx |
| `description` | string | Optional description |
| `scopes` | string[] | Permission scopes |
| `claims` | object | Custom metadata |
| `createdBy` | string | User ID of creator (audit) |
| `createdAt` | number | Milliseconds since epoch |
| `updatedAt` | number | Last update timestamp |
| `secret` | string | **ONLY in create response** |
| `expiration` | number \| null | Expiration time or null if never expires |
| `revoked` | boolean | Whether key is revoked |
| `revocationReason` | string \| null | Reason for revocation if revoked |

---

## Authentication

All endpoints require:
```
Authorization: Bearer {CLERK_SECRET_KEY}
```

Where `{CLERK_SECRET_KEY}` is your Clerk secret key from the Clerk dashboard.

---

## Implementation Notes

1. **Secret Storage:** The `secret` is only returned once (create endpoint). Store immediately and securely.
2. **No Secret Retrieval:** There is no endpoint to retrieve a forgotten secret. Users must create a new key.
3. **Immediate Revocation:** Revoking a key takes effect immediately—no grace period.
4. **Pagination:** List endpoint supports pagination via `limit` and `offset` query parameters.
5. **Verification Without Secret Storage:** The verify endpoint requires the secret, so clients must supply it for validation (not stored by server).

---

## Unresolved Questions

1. **Exact pagination defaults:** What are default `limit` and `offset` values if not specified?
2. **Scope validation:** What scopes are valid? Is there documentation of available scopes?
3. **Claims structure:** Any restrictions on the shape/size of the `claims` object?
4. **Error codes:** What specific HTTP status codes and error messages are returned for different failure cases?
5. **Rate limiting:** Are there rate limits on API key endpoints?

---

## Sources

- [Using API keys - Machine authentication | Clerk Docs](https://clerk.com/docs/guides/development/machine-auth/api-keys)
- [SDK Reference: create()](https://clerk.com/docs/reference/backend/api-keys/create)
- [SDK Reference: verify()](https://clerk.com/docs/reference/backend/api-keys/verify)
- [SDK Reference: revoke()](https://clerk.com/docs/reference/backend/api-keys/revoke)
- [SDK Reference: get()](https://clerk.com/docs/reference/backend/api-keys/get)
- [APIKeys object - SDK Reference - JavaScript | Clerk Docs](https://clerk.com/docs/reference/javascript/api-keys)
- [Build a custom flow for managing API keys | Clerk Docs](https://clerk.com/docs/guides/development/custom-flows/api-keys/manage-api-keys)
- [Clerk Backend API Reference Documentation](https://clerk.com/docs/reference/backend-api)
