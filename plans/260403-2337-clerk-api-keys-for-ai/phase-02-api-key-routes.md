## Phase 2: API Key Management Routes

**Priority:** High
**Status:** Complete
**Effort:** 2h
**Depends on:** Phase 1

### Context Links
- [Tags route (CRUD pattern reference)](../../apps/api/src/routes/tags-route.ts)
- [App entry point](../../apps/api/src/index.ts)
- [Clerk API Keys custom flow docs](https://clerk.com/docs/guides/development/custom-flows/api-keys/manage-api-keys)

### Overview

Add backend routes for teachers to create, list, and revoke API keys via Clerk's SDK. These routes power the Settings UI in Phase 3. Keys are managed entirely through Clerk — no local DB table needed.

### Key Insights

- Clerk stores and manages API keys server-side; no local `api_keys` table required
- `create()` returns the secret only once — frontend must display it immediately
- `list()` returns metadata only (no secrets) — safe for display
- `revoke()` takes `apiKeyId` + optional reason
- `subject` param ties keys to `user_xxx` (the creating teacher's Clerk userId)
- Scopes are passed on creation and stored by Clerk; enforcement is our responsibility

### Requirements

**Functional:**
- `POST /api/users/api-keys` — create API key (name, scopes, optional expiration)
- `GET /api/users/api-keys` — list user's API keys (no secrets)
- `DELETE /api/users/api-keys/:id` — revoke API key

**Non-functional:**
- Teacher role only (students/parents cannot create API keys)
- Follow existing route patterns (Hono sub-router, Zod validation)
- Consistent error responses

### Related Code Files

**Create:**
- `apps/api/src/routes/api-key-routes.ts` — new route file

**Modify:**
- `apps/api/src/index.ts` — mount new route

### Implementation Steps

1. **Create route file** `apps/api/src/routes/api-key-routes.ts`:

   ```typescript
   import { Hono } from "hono"
   import { createClerkClient } from "@clerk/backend"
   import type { Env } from "../env.js"

   type Variables = { userId: string }
   const apiKeyRoutes = new Hono<Env & { Variables: Variables }>()

   // POST / — create API key
   apiKeyRoutes.post("/", async (c) => {
     const userId = c.get("userId")
     const body = await c.req.json()
     // Validate: name (required, max 100), scopes (optional string[])

     const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY })
     const apiKey = await clerk.apiKeys.create({
       name: body.name,
       subject: userId, // ties key to this teacher
       description: body.description,
       scopes: body.scopes ?? ["ai:questions:write"],
       secondsUntilExpiration: body.expiresInDays
         ? body.expiresInDays * 86400
         : undefined,
     })

     // Return secret — only time it's available
     return c.json({
       id: apiKey.id,
       name: apiKey.name,
       secret: apiKey.secret, // ⚠️ show once, never again
       scopes: apiKey.scopes,
       createdAt: apiKey.createdAt,
     }, 201)
   })

   // GET / — list user's API keys (no secrets)
   apiKeyRoutes.get("/", async (c) => {
     const userId = c.get("userId")
     const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY })

     const result = await clerk.apiKeys.list({ subject: userId })
     return c.json(result.data.map((k) => ({
       id: k.id,
       name: k.name,
       scopes: k.scopes,
       revoked: k.revoked,
       expired: k.expired,
       createdAt: k.createdAt,
     })))
   })

   // DELETE /:id — revoke API key
   apiKeyRoutes.delete("/:id", async (c) => {
     const apiKeyId = c.req.param("id")
     const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY })

     await clerk.apiKeys.revoke({
       apiKeyId,
       revocationReason: "Revoked by user",
     })

     return c.json({ revoked: true })
   })

   export { apiKeyRoutes }
   ```

2. **Add Zod validation schema** in `packages/shared/src/schemas/index.ts`:
   ```typescript
   export const createApiKeySchema = z.object({
     name: z.string().min(1).max(100),
     description: z.string().max(500).optional(),
     scopes: z.array(z.string()).optional(),
     expiresInDays: z.number().int().min(1).max(365).optional(),
   })
   ```

3. **Mount route** in `apps/api/src/index.ts`:
   ```typescript
   import { apiKeyRoutes } from "./routes/api-key-routes.js"
   // After auth guard, alongside other /api/* routes:
   .route("/api/users/api-keys", apiKeyRoutes)
   ```

4. **Compile check**: `pnpm --filter api typecheck`

### Todo List

- [x] Create `api-key-routes.ts` with POST/GET/DELETE handlers
- [x] Add `createApiKeySchema` to shared schemas
- [x] Mount route in `index.ts`
- [x] Add role guard (teacher only) — check user role before allowing key creation
- [x] Compile check

### Implementation Notes

Added teacher role guard middleware (matching parent-routes.ts pattern). Added IDOR protection on DELETE with ownership verification.

### Success Criteria

- `POST /api/users/api-keys` returns secret on creation
- `GET /api/users/api-keys` returns key list (no secrets)
- `DELETE /api/users/api-keys/:id` revokes key successfully
- Only teachers can access these endpoints
- Consistent error handling matching existing patterns
