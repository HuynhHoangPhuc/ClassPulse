## Phase 1: SDK Spike & Dual Auth Middleware

**Priority:** Critical — blocks all other phases
**Status:** Complete
**Effort:** 3h

### Context Links
- [Auth middleware](../../apps/api/src/middleware/auth-middleware.ts)
- [Clerk API Keys verify() docs](https://clerk.com/docs/reference/backend/api-keys/verify)
- [Research report](../reports/researcher-260403-2346-clerk-api-keys-research.md)

### Overview

Modify `auth-middleware.ts` to accept both Clerk JWT tokens (existing) and Clerk API Keys (new). The middleware tries JWT first; if it fails, tries API key verification. Both paths end with `userId` set on Hono context.

### Key Insights

- `verifyToken()` throws on non-JWT strings — use as discriminator
- `clerkClient` from `@clerk/backend` provides `apiKeys.verify(secret)` method
- API key `subject` field returns `user_xxx` format — extract Clerk userId
- Clerk API key verification is a network call (not self-verifying like JWT)
- Scopes are client-enforced; Clerk stores but doesn't validate them

### Requirements

**Functional:**
- Bearer tokens that are valid JWTs → existing Clerk JWT flow
- Bearer tokens that are API keys → Clerk API Key verification
- Both paths set `c.set("userId", ...)` for downstream handlers
- Add `c.set("authType", "jwt" | "api_key")` for audit logging
- Return 401 JSON for invalid/revoked/expired keys

**Non-functional:**
- No breaking changes to existing JWT auth
- No new env vars (reuses `CLERK_SECRET_KEY`)
- Must work on Cloudflare Workers (edge runtime)

### Architecture

```
Authorization: Bearer {token}
       │
       ▼
  Try verifyToken(token, secretKey)
       │
    ┌──┴──┐
  Success  Error
    │       │
    │    Try clerkClient.apiKeys.verify(token)
    │       │
    │    ┌──┴──┐
    │  Success  Error
    │    │       │
    ▼    ▼       ▼
  userId  userId  401
```

### Related Code Files

**Modify:**
- `apps/api/src/middleware/auth-middleware.ts` — add dual verification

### Implementation Steps

1. **Spike first**: In a test script or the middleware itself, verify that `clerkClient` from `@clerk/backend` v1.20 exposes `apiKeys.verify()`. If not, check if SDK upgrade is needed.

2. **Import `clerkClient`** (or `createClerkClient`) from `@clerk/backend`:
   ```typescript
   import { verifyToken, createClerkClient } from "@clerk/backend"
   ```

3. **Modify middleware flow**:
   ```typescript
   export const authMiddleware: MiddlewareHandler<Env & { Variables: Variables }> =
     async (c, next) => {
       const authHeader = c.req.header("Authorization")
       if (!authHeader?.startsWith("Bearer ")) {
         return c.json({ error: "Missing or malformed Authorization header" }, 401)
       }

       const token = authHeader.slice(7)

       // Try 1: Clerk JWT verification (existing flow)
       try {
         const payload = await verifyToken(token, {
           secretKey: c.env.CLERK_SECRET_KEY,
         })
         if (payload?.sub) {
           c.set("userId", payload.sub)
           await next()
           return
         }
       } catch {
         // Not a valid JWT — fall through to API key verification
       }

       // Try 2: Clerk API Key verification
       try {
         const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY })
         const apiKey = await clerk.apiKeys.verify(token)

         if (apiKey.revoked || apiKey.expired) {
           return c.json({ error: "API key is revoked or expired" }, 401)
         }

         if (!apiKey.subject) {
           return c.json({ error: "API key has no associated user" }, 401)
         }

         // subject format: "user_xxx" — this IS the Clerk userId
         c.set("userId", apiKey.subject)
         await next()
       } catch {
         return c.json({ error: "Invalid token or API key" }, 401)
       }
     }
   ```

4. **Verify compilation**: `pnpm --filter api build` or `pnpm --filter api typecheck`

5. **Manual test**: Create an API key in Clerk Dashboard, send request with `curl`:
   ```bash
   curl -X POST https://your-api/api/questions/ai \
     -H "Authorization: Bearer sk_xxx" \
     -H "Content-Type: application/json" \
     -d '{"questions": [...]}'
   ```

### Todo List

- [x] Verify `createClerkClient` or `clerkClient` exports from `@clerk/backend` v1.20
- [x] Verify `apiKeys.verify()` method exists and works on CF Workers
- [x] Modify auth-middleware.ts with dual verification
- [x] Compile check (`pnpm --filter api typecheck`)
- [x] Manual test with API key from Clerk Dashboard

### Implementation Notes

SDK spike confirmed apiKeys not available on v1.34. Used REST API wrapper in `clerk-api-key-service.ts` as fallback for verification.

### Success Criteria

- Existing JWT auth continues to work (no regression)
- API key bearer tokens authenticate successfully
- `userId` context variable set correctly from API key's `subject`
- 401 returned for invalid/revoked/expired API keys
- Compiles and runs on Cloudflare Workers

### Risk Assessment

- **SDK incompatibility**: If `apiKeys.verify()` doesn't exist on v1.20, need to upgrade `@clerk/backend` or call Clerk's REST API directly via `fetch()`
- **Latency**: API key verification is a network call to Clerk. At <100 req/day this is fine. Monitor if volume grows.
