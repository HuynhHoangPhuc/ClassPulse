# Explore: ClassPulse API Architecture & Auth System

**Date:** 2026-04-03  
**Context:** Understanding full API structure, auth middleware, database schema, and frontend auth patterns for API key implementation.

---

## 1. API Route Structure & Entry Point

**File:** `/Users/phuc/work/ClassPulse/apps/api/src/index.ts`

### Route Organization
- **Framework:** Hono (edge runtime on Cloudflare Workers)
- **Architecture:** Middleware → Route Registration → Export

### Middleware Application Order
1. **Global error handler** (registered first with `onError()`)
2. **CORS middleware** (applied to `*` routes globally)
3. **Public routes** (webhook paths, no auth)
4. **WebSocket route** (auth via query param, must be before auth guard)
5. **Auth middleware guard** (applied to `/api/*` routes)
6. **Protected API routes** (all mounted under this guard)

```typescript
// Global error handler
app.onError(errorMiddleware);

// CORS for all routes
app.use("*", corsMiddleware());

// Public routes
app.route("/webhook/clerk", clerkWebhookRoute);

// WebSocket (before auth guard)
app.route("/", websocketRoutes);

// Auth guard for all /api/* routes
app.use("/api/*", authMiddleware);

// Protected routes mounted after auth guard
const routes = app
  .route("/api/users", usersRoute)
  .route("/api/tags", tagsRoute)
  .route("/api/questions/ai", aiQuestionRoutes)
  .route("/api/questions", questionsRoute)
  .route("/api/upload/image", uploadRoute)
  .route("/api/assessments", assessmentRoutes)
  .route("/api/classrooms", classroomRoutes)
  // ... more routes
```

### Key Pattern
- Routes are **sub-routers** (Hono instances) that handle specific domains
- Auth middleware is **applied globally** to `/api/*` prefix
- `c.get("userId")` gives all handlers the authenticated user ID
- WebSocket route is special: auth happens via query param (`?token=...`)

---

## 2. Auth Middleware Details

**File:** `/Users/phuc/work/ClassPulse/apps/api/src/middleware/auth-middleware.ts`

### Current Implementation
```typescript
export const authMiddleware: MiddlewareHandler<Env & { Variables: Variables }> =
  async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Missing or malformed Authorization header" }, 401);
    }

    const token = authHeader.slice(7);

    try {
      const payload = await verifyToken(token, {
        secretKey: c.env.CLERK_SECRET_KEY,
      });

      if (!payload?.sub) {
        return c.json({ error: "Invalid token payload" }, 401);
      }

      c.set("userId", payload.sub);
      await next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Token verification failed";
      return c.json({ error: message }, 401);
    }
  };
```

### Current Behavior
- Expects `Authorization: Bearer {jwt-token}` header
- Uses Clerk's `verifyToken()` from `@clerk/backend` (^1.20.0)
- Extracts `sub` claim (Clerk user ID) and stores in context
- Returns 401 on any verification failure
- **No support for API keys yet** — this is where we'll need to add dual verification

### Key Insights for API Key Implementation
1. The middleware runs synchronously (not async bottleneck)
2. Clerk secret is available via `c.env.CLERK_SECRET_KEY`
3. Context storage pattern: `c.set("userId", ...)` and retrieval: `c.get("userId")`
4. Error responses are JSON with consistent shape: `{ error: "message" }`

---

## 3. Environment & Cloudflare Bindings

**File:** `/Users/phuc/work/ClassPulse/apps/api/src/env.ts`

```typescript
export type Env = {
  Bindings: {
    DB: D1Database;                          // SQLite D1
    STORAGE: R2Bucket;                       // R2 object storage
    NOTIFICATION_HUB: DurableObjectNamespace;// Durable Object for WebSocket hub
    CLERK_PUBLISHABLE_KEY: string;
    CLERK_SECRET_KEY: string;
    CORS_ORIGIN: string;
    CLERK_WEBHOOK_SECRET?: string;
  };
};
```

### Wrangler Configuration

**File:** `/Users/phuc/work/ClassPulse/apps/api/wrangler.toml`

```toml
name = "teaching-api"
main = "src/index.ts"
compatibility_date = "2026-04-02"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "teaching-db"
database_id = "da67407a-abe8-4492-8d94-38041b279730"
migrations_dir = "src/db/migrations"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "teaching-storage"

[durable_objects]
bindings = [
  { name = "NOTIFICATION_HUB", class_name = "NotificationHub" }
]

[vars]
CORS_ORIGIN = "https://thayphuc.pages.dev,http://localhost:5173"
```

### Secrets (via `wrangler secret put`)
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_WEBHOOK_SECRET` (optional, for webhook verification)

### Design Pattern
- `DB` binding gives direct access to Drizzle ORM instance
- `CORS_ORIGIN` supports comma-separated values (parsed in middleware)
- All bindings available via `c.env.*` in route handlers
- Perfect for injecting API key verification (can add new binding or use existing DB)

---

## 4. Database Schema

**File:** `/Users/phuc/work/ClassPulse/apps/api/src/db/schema.ts`

### Users Table
```typescript
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),           // Clerk user ID
  email: text("email").notNull(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull(),          // "teacher" | "student" | "parent"
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
```

### Current Structure
- **NO existing API key table** — will need to create one
- **NO token/credentials table** — this is a greenfield addition
- User roles: teacher, student, parent (from `/packages/shared/src/constants/roles.ts`)
- Clerk user IDs are the primary key (UUIDs)

### Recommended API Key Schema
```typescript
export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),              // Unique key identifier
    userId: text("user_id").notNull().references(() => users.id),
    name: text("name").notNull(),             // "ChatGPT Integration", etc
    keyHash: text("key_hash").notNull(),      // Hashed API key (never store plaintext)
    scopes: text("scopes").notNull(),         // JSON array: ["questions:write"]
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at"),         // NULL = never expires
    lastUsedAt: integer("last_used_at"),
    revokedAt: integer("revoked_at"),         // NULL = active, set = revoked
  },
  (t) => ({
    userIdx: index("api_keys_user_id_idx").on(t.userId),
    keyHashIdx: index("api_keys_key_hash_idx").on(t.keyHash), // For quick lookup
  }),
);
```

### Other Key Tables (for context)
- **questions**: content, options (JSON), complexity, tags
- **assessments**: title, scoring rules, generation config
- **classrooms**: with invite code, members
- **assessmentAttempts**: student attempts with scores, tab-switch tracking
- **notifications**: user notifications with reference type/ID

### Data Types
- IDs: `text` (nanoid or UUID)
- Timestamps: `integer` (milliseconds since epoch)
- JSON data: `text` (serialized, parsed in business logic)
- Relationships: foreign keys with references

---

## 5. Frontend Auth Pattern

### ClerkProvider Setup

**File:** `/Users/phuc/work/ClassPulse/apps/web/src/app.tsx`

```typescript
export function App() {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ClerkProvider>
  );
}
```

**Key Points:**
- Clerk is outermost provider (auth context)
- React Query for server state
- TanStack Router for navigation
- Auth state available via `useAuth()` hook

### Authenticated API Calls

**File:** `/Users/phuc/work/ClassPulse/apps/web/src/lib/fetch-api.ts`

```typescript
export async function fetchApi(
  path: string,
  options: RequestInit = {},
  token?: string | null,
  getToken?: () => Promise<string | null>,
): Promise<unknown> {
  const res = await doFetch(path, options, token);

  // Retry once on 401 with a fresh token
  if (res.status === 401 && getToken) {
    try {
      const freshToken = await getToken();
      if (freshToken && freshToken !== token) {
        const retryRes = await doFetch(path, options, freshToken);
        // ... handle retry response
      }
    } catch (e) {
      // Token refresh failed, fall through to original 401 handling
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(sanitizeErrorMessage(body as { error?: string }, res.status));
  }

  if (res.status === 204) return null;
  return res.json();
}

// In header, token is set via:
headers: {
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...options.headers,
}
```

**Pattern:**
1. `useAuth()` hook gets Clerk session token via `getToken()`
2. Pass token to `fetchApi()` as third argument
3. `fetchApi()` injects `Authorization: Bearer {token}` header
4. Automatic 401 retry with fresh token (handles expiry gracefully)
5. All errors sanitized: 401 → "Session expired", etc.

### Current User Hook

**File:** `/Users/phuc/work/ClassPulse/apps/web/src/hooks/use-current-user.ts`

```typescript
export function useCurrentUser() {
  const { getToken } = useAuth()

  return useQuery<CurrentUser>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const token = await getToken()
      return fetchApi("/api/users/me", {}, token) as Promise<CurrentUser>
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
```

**Usage:**
```typescript
const { data: appUser } = useCurrentUser();
// appUser.role, appUser.email, etc
```

### Settings Page (Potential Home for API Key UI)

**File:** `/Users/phuc/work/ClassPulse/apps/web/src/features/settings/settings-page.tsx`

Current sections:
- **Profile:** Name, Email, Role (read-only from Clerk + DB)
- **Appearance:** Dark/light mode toggle
- **Notifications:** Placeholder for future settings

**Structure:** Uses `Card` component + `SettingsRow` helper for consistent layout.

**Perfect location to add API Key Management section:**
- Same card-based layout pattern
- Has access to `useCurrentUser()` for role check (can restrict to teachers)
- Same authentication flow already tested

---

## 6. Route Pattern Example

**File:** `/Users/phuc/work/ClassPulse/apps/api/src/routes/tags-route.ts`

Shows the full CRUD pattern used throughout:

```typescript
const tagsRoute = new Hono<Env & { Variables: Variables }>();

// GET / — list all tags for authenticated teacher
tagsRoute.get("/", async (c) => {
  const teacherId = c.get("userId");  // <-- Auth middleware set this
  const db = drizzle(c.env.DB);       // <-- D1 binding injected
  
  const result = await db.select().from(tags)
    .where(eq(tags.teacherId, teacherId))
    .orderBy(tags.name);
  
  return c.json(result);
});

// POST / — create new tag (with Zod validation)
tagsRoute.post("/", async (c) => {
  const teacherId = c.get("userId");
  const body = await c.req.json();
  const parsed = createTagSchema.safeParse(body);
  
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  
  const { name, color } = parsed.data;
  const db = drizzle(c.env.DB);
  const now = Date.now();
  const id = generateId();
  
  await db.insert(tags).values({ id, name, teacherId, color: color ?? null, createdAt: now });
  
  const [created] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  return c.json(created, 201);
});

// PUT /:id — update tag (with ownership check)
tagsRoute.put("/:id", async (c) => {
  const teacherId = c.get("userId");
  const tagId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateTagSchema.safeParse(body);
  
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  
  const db = drizzle(c.env.DB);
  
  // Verify ownership
  const [existing] = await db.select().from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.teacherId, teacherId)))
    .limit(1);
  
  if (!existing) {
    return c.json({ error: "Tag not found" }, 404);
  }
  
  // Update
  const updates: Partial<typeof existing> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color ?? null;
  
  await db.update(tags).set(updates).where(eq(tags.id, tagId));
  
  const [updated] = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1);
  return c.json(updated);
});

// DELETE /:id — delete tag (with batch operation)
tagsRoute.delete("/:id", async (c) => {
  const teacherId = c.get("userId");
  const tagId = c.req.param("id");
  const db = drizzle(c.env.DB);
  
  const [existing] = await db.select().from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.teacherId, teacherId)))
    .limit(1);
  
  if (!existing) {
    return c.json({ error: "Tag not found" }, 404);
  }
  
  // Atomic delete via batch
  await db.batch([
    db.delete(questionTags).where(eq(questionTags.tagId, tagId)),
    db.delete(tags).where(eq(tags.id, tagId)),
  ]);
  
  return c.json({ deleted: true });
});

export { tagsRoute };
```

**Patterns to follow for API key routes:**
1. Extract userId from context: `const userId = c.get("userId")`
2. Validate input with Zod: `schema.safeParse(body)`
3. Check ownership before write operations
4. Use Drizzle batch for atomic multi-table operations
5. Return 404 if not found, 201 for creates, 200 for updates
6. New routes exported as `export { tagsRoute }`

---

## 7. Brainstorm Context: Clerk API Keys Decision

**File:** `/Users/phuc/work/ClassPulse/plans/reports/brainstorm-260403-2337-clerk-api-keys-for-ai.md`

### Decision Summary
**Chosen: Clerk API Keys** (vs JWT templates, vs M2M tokens)

### Rationale
- ✅ Purpose-built for user-delegated third-party access
- ✅ Long-lived, no refresh needed
- ✅ Instantly revokable by user
- ✅ Tied to user identity (audit trail)
- ✅ Fine-grained scopes possible
- ✅ Clerk-native integration (`@clerk/backend` SDK)

### Implementation Requirements
1. **Dual-mode auth middleware:**
   - Detect API key vs JWT in `Authorization: Bearer` header
   - Verify API key via Clerk SDK
   - Extract userId from verified key

2. **API key management UI:**
   - Create/list/revoke keys
   - Scopes selection
   - Expiration options
   - Last used tracking

3. **API key CRUD routes:**
   - POST `/api/users/api-keys` — create key
   - GET `/api/users/api-keys` — list keys
   - DELETE `/api/users/api-keys/{id}` — revoke key

4. **Scope enforcement:**
   - Check scope on each request (e.g., `questions:write`)
   - Return 403 if insufficient scope

### Unresolved at Time of Brainstorm
1. Clerk API Keys beta timeline to GA
2. Exact SDK method signatures (need latest `@clerk/backend` docs)
3. Edge runtime compatibility (Cloudflare Workers)

---

## Summary: Key Files for Implementation

| Component | File | Key Code |
|-----------|------|----------|
| **API Entry** | `apps/api/src/index.ts` | Route registration, middleware order |
| **Auth Logic** | `apps/api/src/middleware/auth-middleware.ts` | JWT verification (needs API key support) |
| **Environment** | `apps/api/src/env.ts` | Binding types |
| **Config** | `apps/api/wrangler.toml` | D1/R2/Durable Objects setup |
| **Schema** | `apps/api/src/db/schema.ts` | User/question/assessment tables (needs apiKeys table) |
| **Example Route** | `apps/api/src/routes/tags-route.ts` | CRUD pattern, Drizzle usage |
| **Frontend Auth** | `apps/web/src/lib/fetch-api.ts` | Token injection, retry logic |
| **User Hook** | `apps/web/src/hooks/use-current-user.ts` | Pattern for authenticated queries |
| **Settings Page** | `apps/web/src/features/settings/settings-page.tsx` | UI location for API key management |
| **Clerk Setup** | `apps/web/src/app.tsx` | Provider hierarchy |
| **Decision** | `plans/reports/brainstorm-260403-2337-clerk-api-keys-for-ai.md` | Requirements & rationale |

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (React/TanStack)                              │
│  ├─ ClerkProvider (auth context)                        │
│  ├─ useAuth() → getToken() → Clerk JWT                  │
│  └─ fetchApi(path, opts, token) → "Authorization: Bearer JWT" │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP
┌────────────────────▼────────────────────────────────────┐
│  Hono Router (Cloudflare Workers)                       │
│  ├─ CORS middleware (global)                            │
│  ├─ Auth middleware (verifyToken on /api/*)             │
│  │  └─ Extract Clerk user ID → c.set("userId")          │
│  └─ Route handlers (tags, questions, assessments, ...)  │
│     └─ c.get("userId") → Drizzle queries               │
└────────────────────┬────────────────────────────────────┘
                     │ SQL
┌────────────────────▼────────────────────────────────────┐
│  Drizzle ORM ↔ Cloudflare D1 (SQLite)                   │
│  ├─ users (Clerk sync via webhook)                      │
│  ├─ questions, tags, assessments                        │
│  ├─ classrooms, classroomMembers                        │
│  ├─ assessmentAttempts, attemptAnswers                  │
│  └─ notifications                                        │
└─────────────────────────────────────────────────────────┘
```

### For API Key Implementation
- **Auth middleware** will need to detect & verify API keys (Clerk SDK)
- **Schema** will need `apiKeys` table (hashed keys, scopes, revocation)
- **Routes** will add CRUD endpoints under `/api/users/api-keys`
- **Settings UI** will add API key management card
- **Frontend fetch** will work unchanged (both JWT and API key use same header format)
