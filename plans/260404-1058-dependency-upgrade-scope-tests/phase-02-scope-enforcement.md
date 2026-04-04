# Phase 2 — API Key Scope Enforcement

## Context Links
- [Scope Enforcement Research](../reports/researcher-260404-1058-api-scope-enforcement.md)
- [Auth Middleware (current)](../../apps/api/src/middleware/auth-middleware.ts)
- [App Entry / Route Mounting](../../apps/api/src/index.ts)
- [AI Question Routes](../../apps/api/src/routes/ai-question-routes.ts)
- [Env Types](../../apps/api/src/env.ts)

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 2h
- **Depends on:** Phase 1 (Clerk v3 SDK available)

Add scope enforcement so API key tokens can ONLY access routes matching their scopes. JWT sessions bypass scope checks entirely (use existing role system). Only one scope exists today: `ai:questions:write` -> `POST /api/questions/ai`.

## Key Insights

1. **YAGNI:** Only 1 scope exists (`ai:questions:write`). Simple string match, no wildcard/hierarchy engine.
2. **JWT vs API key distinction:** Auth middleware already has two code paths. Add `authType` context var to let downstream code distinguish.
3. **403 not 401:** Valid API key with insufficient scope = 403 Forbidden. 401 is for invalid/missing tokens.
4. **Scope source:** Clerk API key objects have a `scopes: string[]` field. After `apiKeys.verify()`, scopes are on the returned object.
5. **Middleware-level enforcement:** Research recommends scope check in middleware, not per-route. But since we have a single scope mapped to a single route prefix, the simplest approach is: store scopes on context, then add a tiny scope-check middleware on the specific route.

## Data Flow

```
Request with API Key token
  |
  v
authMiddleware:
  1. Try JWT verify -> fails
  2. Try apiKeys.verify(token) -> success
  3. Set c.var.userId = apiKey.subject
  4. Set c.var.authType = "api_key"
  5. Set c.var.scopes = apiKey.scopes  (e.g. ["ai:questions:write"])
  6. Call next()
  |
  v
scopeGuard("ai:questions:write") on /api/questions/ai:
  - If authType === "session" -> skip (JWT uses role system)
  - If authType === "api_key" AND scopes includes required -> next()
  - If authType === "api_key" AND scopes missing -> 403
  |
  v
Route handler (aiQuestionRoutes)
```

```
Request with JWT token
  |
  v
authMiddleware:
  1. Try JWT verify -> success
  2. Set c.var.userId = payload.sub
  3. Set c.var.authType = "session"
  4. Call next()
  |
  v
scopeGuard("ai:questions:write") on /api/questions/ai:
  - authType === "session" -> skip scope check, next()
  |
  v
Route handler
```

## Related Code Files

### Files to Modify
- `apps/api/src/middleware/auth-middleware.ts` — add `authType`, `scopes` to context; set them in API key path
- `apps/api/src/index.ts` — add `scopeGuard` middleware on `/api/questions/ai` route

### Files to Create
- `apps/api/src/middleware/scope-guard-middleware.ts` — small middleware factory (~30 lines)

### Files NOT to Modify
- `apps/api/src/routes/ai-question-routes.ts` — no changes; scope enforced before it runs
- `apps/api/src/routes/api-key-routes.ts` — already has teacher role guard; no scope needed (JWT-only route in practice)
- `apps/api/src/services/clerk-api-key-service.ts` — no changes (already returns scopes)

## Architecture: Context Variables

Extend the `Variables` type used across middleware and routes:

```typescript
type Variables = {
  userId: string
  authType: "session" | "api_key"
  scopes: string[]  // empty for JWT sessions
}
```

**Backwards compatibility:** Existing routes only read `userId`. Adding `authType` and `scopes` is purely additive. No existing code breaks.

## Implementation Steps

### Step 1: Update Auth Middleware Variables + Logic

**File:** `apps/api/src/middleware/auth-middleware.ts`

Changes:
1. Extend `Variables` type to include `authType` and `scopes`
2. In JWT success path: set `authType = "session"`, `scopes = []`
3. In API key success path: set `authType = "api_key"`, `scopes = apiKey.scopes`

```typescript
type Variables = {
  userId: string
  authType: "session" | "api_key"
  scopes: string[]
}

// JWT path (line ~29):
c.set("userId", payload.sub)
c.set("authType", "session")
c.set("scopes", [])
await next()

// API key path (line ~44):
c.set("userId", apiKey.subject)
c.set("authType", "api_key")
c.set("scopes", apiKey.scopes ?? [])
await next()
```

**Note:** The `Variables` type is duplicated in `index.ts`, route files, etc. Currently they all declare `{ userId: string }`. The extended type is only needed where `authType`/`scopes` are read. Hono's `c.get()` is loosely typed — existing routes calling `c.get("userId")` won't break even if their local `Variables` type doesn't include the new fields. But for type safety, update `index.ts` to use the new type.

### Step 2: Create Scope Guard Middleware

**File:** `apps/api/src/middleware/scope-guard-middleware.ts` (~30 lines)

```typescript
import type { MiddlewareHandler } from "hono"
import type { Env } from "../env.js"

type Variables = {
  userId: string
  authType: "session" | "api_key"
  scopes: string[]
}

/**
 * Middleware factory: require a specific scope for API key tokens.
 * JWT sessions bypass — they use the existing role system.
 */
export function scopeGuard(
  requiredScope: string,
): MiddlewareHandler<Env & { Variables: Variables }> {
  return async (c, next) => {
    const authType = c.get("authType")

    // JWT sessions use role-based auth, skip scope check
    if (authType === "session") {
      await next()
      return
    }

    // API key tokens must have the required scope
    const scopes = c.get("scopes")
    if (!scopes.includes(requiredScope)) {
      return c.json({ error: "Insufficient scope", required: requiredScope }, 403)
    }

    await next()
  }
}
```

### Step 3: Apply Scope Guard to AI Questions Route

**File:** `apps/api/src/index.ts`

Add scope guard before the `aiQuestionRoutes` mount:

```typescript
import { scopeGuard } from "./middleware/scope-guard-middleware.js"

// Before the route registrations, add scope guard for AI question endpoint
app.use("/api/questions/ai/*", scopeGuard("ai:questions:write"))

// Existing route mount (unchanged):
.route("/api/questions/ai", aiQuestionRoutes)
```

**Important ordering:** The `app.use("/api/*", authMiddleware)` runs first (sets `authType`/`scopes`), then the scope guard runs, then the route handler.

**Why `/api/questions/ai/*`?** The `aiQuestionRoutes` is mounted at `/api/questions/ai`. The scope guard needs to match the same prefix. The `/*` wildcard ensures it covers `POST /api/questions/ai/` (the only route in that sub-app).

### Step 4: Update Variables Type in index.ts

**File:** `apps/api/src/index.ts`

Update the `Variables` type at the top to include new fields:

```typescript
type Variables = {
  userId: string
  authType: "session" | "api_key"
  scopes: string[]
}
```

### Step 5: Verify

```bash
pnpm --filter @teaching/api typecheck
pnpm --filter @teaching/api dev
```

Manual test:
- JWT token -> `POST /api/questions/ai` -> should work (scope check skipped)
- API key with `ai:questions:write` scope -> `POST /api/questions/ai` -> should work
- API key with `ai:questions:write` scope -> `GET /api/users` -> should work (no scope guard on that route)
- API key with NO scopes -> `POST /api/questions/ai` -> should get 403

**Note on unguarded routes:** Routes without `scopeGuard` middleware allow any authenticated token (JWT or API key). This is intentional per YAGNI — add scope guards to other routes only when needed. Currently API key users can hit any authenticated route. The scope guard narrows access only on routes that require it.

## Todo List

- [ ] Update `Variables` type in `auth-middleware.ts` to include `authType` and `scopes`
- [ ] Set `authType` and `scopes` in both JWT and API key paths
- [ ] Create `scope-guard-middleware.ts` with `scopeGuard()` factory
- [ ] Apply `scopeGuard("ai:questions:write")` to `/api/questions/ai/*` in `index.ts`
- [ ] Update `Variables` type in `index.ts`
- [ ] Run `pnpm --filter @teaching/api typecheck`
- [ ] Smoke test with JWT and API key tokens

## Success Criteria

- JWT sessions access all routes without scope checks (existing behavior preserved)
- API key with `ai:questions:write` can access `POST /api/questions/ai`
- API key WITHOUT `ai:questions:write` gets 403 on `POST /api/questions/ai`
- API key can still access other routes (no scope guard on them)
- `authType` and `scopes` available on context for downstream handlers
- `pnpm typecheck` passes

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `c.get("authType")` returns undefined if middleware order wrong | Low | High | Scope guard runs after authMiddleware (same `/api/*` prefix); test in Phase 3 |
| Breaking existing JWT flow | Very Low | Critical | JWT path only adds 2 `c.set()` calls; no logic change |
| Hono middleware ordering ambiguity | Low | Medium | `app.use()` registered before `app.route()` — Hono processes in registration order |
| API key users locked out of non-scoped routes | None | N/A | Scope guard only on `/api/questions/ai/*`; other routes have no guard |

## Security Considerations

- Scope enforcement is server-side only — cannot be bypassed by client
- 403 response does NOT leak which scopes the key has (only states required scope)
- JWT sessions retain full access via role system — no regression
- Defensive: `scopes ?? []` handles keys without scopes field gracefully
