# Code Review: Clerk API Keys for Third-Party AI Access

## Scope
- **Files reviewed:** 8 (auth-middleware.ts, clerk-api-key-service.ts, api-key-routes.ts, schemas/index.ts, index.ts, settings-page.tsx, api-key-management-card.tsx, api-key-creation-dialog.tsx)
- **LOC changed:** ~450 new/modified
- **Focus:** Security, auth bypass, data leaks, API contract correctness
- **Scout findings:** 3 critical, 2 high, 2 medium issues

## Overall Assessment

The implementation is structurally sound -- REST API wrapper is a reasonable fallback given SDK v1.34 limitations, the UI handles the "show secret once" flow correctly, and the code follows existing codebase patterns. However, there are **serious authorization gaps** that would allow privilege escalation and unauthorized key revocation in production.

---

## Critical Issues

### C1. Missing server-side role guard on API key routes (Authorization Bypass)

**File:** `apps/api/src/routes/api-key-routes.ts`

The plan explicitly requires "Teacher role only" (phase-02 TODO: "Add role guard (teacher only)"). The UI guards this with `appUser?.role === "teacher"`, but the **backend has no role check**. Any authenticated user (student, parent) can call `POST /api/users/api-keys` directly and create API keys for themselves.

**Impact:** A student could create an API key, then use it to call `POST /api/questions/ai` and inject arbitrary questions into the platform under their userId. While the AI question route uses `c.get("userId")` as `teacherId`, the question creation service itself does not validate that the user is actually a teacher.

**Fix:** Add a role guard middleware, following the established pattern in `parent-routes.ts` (lines 26-38):

```typescript
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { users } from "../db/schema.js"

// Before route handlers:
apiKeyRoutes.use("/*", async (c, next) => {
  const userId = c.get("userId")
  const db = drizzle(c.env.DB)
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!user || user.role !== "teacher") {
    return c.json({ error: "Teacher role required" }, 403)
  }
  await next()
})
```

### C2. DELETE /:id has no ownership check (IDOR vulnerability)

**File:** `apps/api/src/routes/api-key-routes.ts`, lines 75-85

The DELETE endpoint takes an `apiKeyId` from the URL parameter and revokes it unconditionally. There is **no verification that the API key belongs to the requesting user**. Any authenticated user can revoke any other user's API keys if they know/guess the key ID.

**Impact:** Denial-of-service against other teachers' integrations. Clerk API key IDs may be guessable or enumerable.

**Fix:** Before revoking, verify ownership by fetching the key from Clerk and checking its `subject` matches the authenticated user:

```typescript
apiKeyRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId")
  const apiKeyId = c.req.param("id")

  try {
    // Fetch the key to verify ownership before revocation
    const keys = await listApiKeys(c.env.CLERK_SECRET_KEY, userId)
    const ownsKey = keys.some((k) => k.id === apiKeyId)
    if (!ownsKey) {
      return c.json({ error: "API key not found" }, 404)
    }

    await revokeApiKey(c.env.CLERK_SECRET_KEY, apiKeyId)
    return c.json({ revoked: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to revoke API key"
    return c.json({ error: message }, 500)
  }
})
```

Note: Returning 404 (not 403) avoids leaking information about key existence.

### C3. Clerk REST API error body leaked to client (Internal Data Leak)

**File:** `apps/api/src/routes/api-key-routes.ts`, lines 48-50, 68-69, 82-83

When Clerk API calls fail, the error message (`err.message`) is passed directly to the client response. The `clerkFetch` helper in `clerk-api-key-service.ts` (line 49) embeds the raw Clerk API response body into the error message:

```typescript
throw new Error(`Clerk API error (${res.status}): ${body}`)
```

This means `Clerk API error (403): {"errors":[{"message":"Invalid API key","long_message":"...","code":"..."}]}` would be sent verbatim to the frontend, leaking internal Clerk API structure, status codes, and potentially the `CLERK_SECRET_KEY` format in error cases.

**Fix:** Return generic error messages to the client; log the full error server-side:

```typescript
} catch (err) {
  console.error("[api-keys] create failed:", err)
  return c.json({ error: "Failed to create API key" }, 500)
}
```

---

## High Priority

### H1. No scope enforcement on API key auth path

**File:** `apps/api/src/middleware/auth-middleware.ts`, lines 38-50

API keys are created with scopes like `["ai:questions:write"]`, but the auth middleware does not check scopes at all. An API key intended for `ai:questions:write` can access **every** route behind `/api/*` -- including `DELETE /api/questions/:id`, `POST /api/assessments`, user management, etc.

The plan acknowledges "Scopes are client-enforced; Clerk stores but doesn't validate them." But there is no client-side enforcement either. The `authType` context variable planned in Phase 1 (`c.set("authType", "jwt" | "api_key")`) was not implemented, which would be needed for downstream scope checks.

**Impact:** A leaked API key grants full access to a teacher's account -- not just AI question creation. This contradicts the principle of least privilege.

**Fix (recommended):** Set `authType` on context and restrict API key auth to specific routes only:

```typescript
// In auth middleware, after API key verification:
c.set("userId", apiKey.subject)
c.set("authType", "api_key")

// Option A: Scope-based middleware on specific routes
// Option B (simpler): Only allow API key auth on /api/questions/ai
```

Simplest approach -- add an API key scope check middleware to `/api/questions/ai` and reject API key auth on other routes:

```typescript
// In ai-question-routes.ts or a shared middleware:
if (c.get("authType") === "api_key") {
  // Only allow API key auth for this specific route
  // Optionally check scopes from the verified key
}
```

### H2. `expiresInDays: 0` sends `undefined` to Clerk (expiration bypass)

**File:** `apps/api/src/routes/api-key-routes.ts`, line 37 and `apps/web/src/features/settings/api-key-creation-dialog.tsx`, line 58

The "Never" expiration option uses `value: 0` in the UI (line 13 of dialog). The body sent is `{ expiresInDays: 0 }`. In the route handler:

```typescript
secondsUntilExpiration: expiresInDays ? expiresInDays * 86400 : undefined
```

`0` is falsy, so `expiresInDays ? ... : undefined` correctly sends `undefined` for "never expires." However, the Zod schema (`createApiKeySchema`) has `z.number().int().min(1).max(365).optional()`, which means `expiresInDays: 0` **fails validation** because `min(1)` rejects 0.

**Impact:** Users selecting "Never" expiration would get a 400 validation error.

**Fix:** In the dialog, send `undefined` when `expiresInDays === 0` instead of `0`:

```typescript
// api-key-creation-dialog.tsx line 56
body: JSON.stringify({
  name: name.trim(),
  expiresInDays: expiresInDays > 0 ? expiresInDays : undefined,
}),
```

Or alternatively, change the schema to `z.number().int().min(0).max(365).optional()`.

---

## Medium Priority

### M1. `clerkFetch` does not validate `apiKeyId` format (path injection)

**File:** `apps/api/src/services/clerk-api-key-service.ts`, lines 107

The `revokeApiKey` function interpolates `apiKeyId` directly into the URL path:

```typescript
return clerkFetch<ClerkApiKey>(`/api_keys/${apiKeyId}/revoke`, ...)
```

If `apiKeyId` contains path traversal characters (e.g., `../../other-endpoint`), it could cause unexpected Clerk API calls.

**Fix:** Validate the ID format or use `encodeURIComponent`:

```typescript
return clerkFetch<ClerkApiKey>(`/api_keys/${encodeURIComponent(apiKeyId)}/revoke`, ...)
```

### M2. Auth middleware makes Clerk API call on every non-JWT request

**File:** `apps/api/src/middleware/auth-middleware.ts`

When a malformed/expired JWT is sent (common in normal browser flows when tokens expire), the middleware falls through to Try 2 and makes a network call to Clerk's `/api_keys/verify` endpoint. This adds latency to every expired-JWT request and generates unnecessary Clerk API usage.

**Fix:** Check if the token looks like a JWT (has 3 dot-separated parts) before attempting JWT verification. If it's not a JWT, skip directly to API key verification. If it IS a JWT but verification fails, return 401 immediately instead of trying API key path:

```typescript
const parts = token.split(".")
if (parts.length === 3) {
  // Looks like JWT - try JWT verification only
  try { ... } catch { return c.json({ error: "Invalid JWT" }, 401) }
} else {
  // Not a JWT - try API key verification
  try { ... } catch { return c.json({ error: "Invalid API key" }, 401) }
}
```

---

## Low Priority

### L1. Missing `Content-Type` header override for non-JSON requests

**File:** `apps/api/src/services/clerk-api-key-service.ts`, line 42

`clerkFetch` always sets `Content-Type: application/json` even when `options.headers` tries to override it. The spread order puts `...options.headers` after the hardcoded header, which is correct (caller wins). But for GET requests, sending `Content-Type` is unnecessary.

### L2. `formatDate` uses Unix milliseconds but Clerk returns Unix seconds

**File:** `apps/web/src/features/settings/api-key-management-card.tsx`, lines 19-24

The `formatDate` function creates `new Date(ms)` but Clerk API returns `createdAt` and `expiration` as **Unix seconds** (not milliseconds). If `createdAt` is `1712188800` (April 2024 in seconds), `new Date(1712188800)` would display as January 1970.

Similarly, the `getKeyStatus` function compares `key.expiration < Date.now()` -- but `Date.now()` returns milliseconds while `key.expiration` is in seconds. This means the expiration check would never show "Expired" status since a seconds-based timestamp will always be less than a milliseconds-based one.

**Fix:** Multiply by 1000:

```typescript
function formatDate(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString(...)
}

function getKeyStatus(key: ApiKeyItem): { label: string; color: string } {
  if (key.revoked) return { label: "Revoked", color: "var(--color-destructive)" }
  if (key.expiration && key.expiration * 1000 < Date.now())
    return { label: "Expired", color: "var(--color-warning)" }
  return { label: "Active", color: "var(--color-success)" }
}
```

**Note:** Verify the actual Clerk API response format -- if they return milliseconds, this is a non-issue.

---

## Positive Observations

1. **REST API wrapper is well-structured** -- clean `clerkFetch` generic, proper error handling, correct use of `encodeURIComponent` for query params in `listApiKeys`
2. **UI correctly conditionally renders** based on role via `appUser?.role === "teacher"`
3. **Secret shown once pattern** is correctly implemented -- secret is only in the creation response, list endpoint strips it
4. **Zod validation** is applied correctly before processing
5. **Dialog state cleanup** on close prevents stale secret display
6. **Error handling** follows existing codebase patterns with try/catch
7. **Consistent use of CSS variables** for theming across new components

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Add server-side teacher role guard to `api-key-routes.ts` (C1)
2. **[CRITICAL]** Add ownership verification on DELETE endpoint (C2)
3. **[CRITICAL]** Stop leaking Clerk error messages to clients (C3)
4. **[HIGH]** Implement `authType` context variable and restrict API key scope (H1)
5. **[HIGH]** Fix `expiresInDays: 0` validation failure (H2)
6. **[MEDIUM]** Add URL encoding for `apiKeyId` in path (M1)
7. **[LOW]** Verify Clerk timestamp format (seconds vs milliseconds) and fix `formatDate`/`getKeyStatus` (L2)

---

## Unresolved Questions

1. Does Clerk's `/api_keys/verify` endpoint already reject revoked/expired keys, or do we need to check those fields explicitly in the response? The middleware currently does not check `revoked`/`expired` fields -- the plan specified checking them but implementation omits it.
2. What is the Clerk API key ID format? If it's a UUID or has a known prefix (e.g., `ak_`), we should validate the format before making API calls.
3. Should there be a limit on how many API keys a teacher can create? Currently unbounded.
4. The plan specified `c.set("authType", "jwt" | "api_key")` for audit logging -- was this intentionally omitted or forgotten?

**Status:** DONE_WITH_CONCERNS
**Summary:** Implementation is functionally complete but has critical authorization gaps (no server-side role guard, no IDOR protection on DELETE) that must be fixed before shipping.
**Concerns:** C1 and C2 are exploitable authorization bypasses. A student can create API keys and a user can revoke another user's keys. These are blocking issues.
