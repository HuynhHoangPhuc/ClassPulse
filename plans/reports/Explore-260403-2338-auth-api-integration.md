# ClassPulse Authentication & AI Question API Exploration Report

**Date:** April 3, 2026 | **Project:** ClassPulse | **Focus:** Clerk Auth Setup, AI Question API, Token Validation

---

## 1. Tech Stack Overview

### Backend
- **Framework:** Hono (v4.7.0) running on Cloudflare Workers
- **Database:** Drizzle ORM + Cloudflare D1 (SQLite)
- **Storage:** Cloudflare R2 (object storage)
- **Auth:** Clerk (JWT-based)
- **Build:** Wrangler (Cloudflare Workers tooling)

### Frontend
- **Framework:** React 19 + TanStack Router v1.95, React Query v5.65
- **Auth:** Clerk React SDK (v5.20.0)
- **Build:** Vite v6

### Monorepo
- **Manager:** pnpm (v9.15.0)
- **Build Orchestration:** Turbo v2.4.0
- **TypeScript:** v5.7.0

### Packages
- `@teaching/api` - Backend API (Hono)
- `@teaching/web` - Frontend (React + Vite)
- `@teaching/shared` - Shared types and schemas (Zod)

---

## 2. Clerk Authentication Setup

### 2.1 Environment Configuration

**File:** `/Users/phuc/work/ClassPulse/apps/api/wrangler.toml`

```toml
# Non-secret env vars (visible in config)
[vars]
CORS_ORIGIN = "https://thayphuc.pages.dev,http://localhost:5173"

# Secrets managed via CLI or dashboard (not in file)
# Required: CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, CLERK_WEBHOOK_SECRET
```

**File:** `/Users/phuc/work/ClassPulse/apps/api/src/env.ts`

```typescript
export type Env = {
  Bindings: {
    DB: D1Database;
    STORAGE: R2Bucket;
    NOTIFICATION_HUB: DurableObjectNamespace;
    CLERK_PUBLISHABLE_KEY: string;
    CLERK_SECRET_KEY: string;
    CORS_ORIGIN: string;
    CLERK_WEBHOOK_SECRET?: string;
  };
};
```

**Key Details:**
- Secrets stored via `wrangler secret put` or Cloudflare Dashboard
- CORS_ORIGIN supports comma-separated origins for local dev + production
- Webhook secret is optional (dev mode allows unauthenticated webhooks)

---

## 3. Auth Middleware

**File:** `/Users/phuc/work/ClassPulse/apps/api/src/middleware/auth-middleware.ts`

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

**Validation Method:**
1. Extracts Bearer token from `Authorization` header
2. Uses `@clerk/backend` `verifyToken()` to validate JWT
3. Extracts `sub` claim (user ID) and stores in Hono context as `userId`
4. Returns 401 JSON on missing/invalid tokens

**Usage in Routes:**
```typescript
// Applied globally to all /api/* routes in index.ts
app.use("/api/*", authMiddleware);

// Inside route handlers, retrieve userId:
const teacherId = c.get("userId");
```

---

## 4. WebSocket Auth (Special Case)

**File:** `/Users/phuc/work/ClassPulse/apps/api/src/routes/websocket-routes.ts`

WebSocket routes use **query param auth** (browsers cannot send Authorization headers on WS):

```typescript
websocketRoutes.get("/ws/classroom/:classroomId", async (c) => {
  // Token passed as query param: /ws/classroom/123?token=jwt
  const token = c.req.query("token");
  if (!token) return c.json({ error: "Missing token query param" }, 401);

  let userId: string;
  try {
    const payload = await verifyToken(token, { secretKey: c.env.CLERK_SECRET_KEY });
    if (!payload?.sub) return c.json({ error: "Invalid token" }, 401);
    userId = payload.sub;
  } catch {
    return c.json({ error: "Token verification failed" }, 401);
  }

  // Additional membership check before allowing upgrade
  if (!(await isClassroomMember(db, classroomId, userId))) {
    return c.json({ error: "Not a member of this classroom" }, 403);
  }

  // Forward to Durable Object
  return stub.fetch(new Request(url.toString(), ...));
});
```

**Key Detail:** Route is registered **outside `/api/*`** to bypass Bearer auth middleware, implementing its own query-param validation.

---

## 5. Clerk Webhook Integration

**File:** `/Users/phuc/work/ClassPulse/apps/api/src/routes/users-route.ts`

**Route:** `POST /webhook/clerk` (public, no Bearer auth)

**Purpose:** Sync Clerk user.created/user.updated events to D1 database

```typescript
clerkWebhookRoute.post("/", async (c) => {
  // Verify Svix signature if webhook secret is configured
  if (webhookSecret) {
    const svixId = c.req.header("svix-id");
    const svixTimestamp = c.req.header("svix-timestamp");
    const svixSignature = c.req.header("svix-signature");

    // Timestamp validation: within 5 minutes (prevent replay attacks)
    const timestampSeconds = parseInt(svixTimestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestampSeconds) > 300) {
      return c.json({ error: "Webhook timestamp too old" }, 401);
    }

    // HMAC-SHA256 verification of signed content
    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
    // Verify signature matches...
  } else {
    // Dev mode: no signature verification
    var body = await c.req.json();
  }

  // Handle user.created and user.updated events
  // Upsert user record with Clerk metadata (name, email, avatar, role)
});
```

**Security Features:**
- Svix signature verification (HMAC-SHA256)
- Timestamp freshness check (5-minute window)
- Role validation against allowed enum values
- Upsert pattern (handles both create and update)

---

## 6. AI Question Creation API

### 6.1 Route Definition

**File:** `/Users/phuc/work/ClassPulse/apps/api/src/routes/ai-question-routes.ts`

**Endpoint:** `POST /api/questions/ai`

**Authentication:** Bearer token via `authMiddleware` (required)

**Request Schema:**
```typescript
export const aiCreateQuestionsSchema = z.object({
  questions: z.array(aiQuestionItemSchema).min(1).max(50),
});

export const aiQuestionItemSchema = z.object({
  content: z.string().min(1).max(10_000),
  image: z.string().max(7_000_000).optional(),  // base64 data URI
});
```

**Response:**
```json
{
  "created": 5,
  "failed": 1,
  "questions": [
    { "id": "q1", "index": 0, "status": "created" },
    { "index": 1, "status": "error", "error": "Invalid YAML..." }
  ],
  "tagsCreated": ["NewTag1", "NewTag2"]
}
```

### 6.2 Implementation Flow

**Step 1: Parse YAML Frontmatter** (via `parseAiQuestion`)
- Content is markdown with YAML frontmatter
- Extracts: complexity, complexityType, explanation, tagNames
- Parses checkbox options (marked `[x]` = correct, `[ ]` = incorrect)

Example input:
```markdown
---
complexity: 3
complexityType: "knowledge"
tags: ["biology", "cells"]
explanation: "The mitochondria is responsible for ATP production"
---

What is the powerhouse of the cell?

[x] Mitochondria
[ ] Nucleus
[ ] Ribosome
[ ] Golgi Apparatus
```

**Step 2: Upload Base64 Images** (optional)
- Decodes data URI format: `data:image/png;base64,...`
- Validates MIME type (png, jpg, gif, webp)
- Enforces 5MB size limit
- Stores in R2: `/images/{generatedId}.{ext}`
- Returns public URL: `/api/upload/image/images/...`

**Step 3: Resolve Tag Names to IDs**
- Builds cache of teacher's existing tags at request start
- For each tag name:
  - Returns existing ID if found
  - Creates new tag (up to 10 per request limit)
  - Updates cache for subsequent questions
- Validates tag names (max 50 chars)

**Step 4: Create Question via Service**
```typescript
const question = await createQuestion(db, teacherId, {
  content,
  options,
  complexity: 1-5,
  complexityType: "knowledge" | "application" | "analysis",
  explanation: string | undefined,
  tagIds: string[] | undefined,
});
```

### 6.3 Response Structure

```typescript
{
  created: number;           // successful questions
  failed: number;            // failed questions
  questions: Array<
    | { id: string; index: number; status: "created" }
    | { index: number; status: "error"; error: string }
  >;
  tagsCreated: string[];     // deduplicated newly created tags
}
```

---

## 7. Client-Side API Integration

### 7.1 Frontend Fetch Wrapper

**File:** `/Users/phuc/work/ClassPulse/apps/web/src/lib/fetch-api.ts`

```typescript
export async function fetchApi(
  path: string,
  options: RequestInit = {},
  token?: string | null,
  getToken?: () => Promise<string | null>,
): Promise<unknown> {
  // Injects Authorization header with Bearer token
  const res = await doFetch(path, options, token);

  // Auto-retry on 401 with fresh token (Clerk session refresh)
  if (res.status === 401 && getToken) {
    const freshToken = await getToken();
    if (freshToken && freshToken !== token) {
      const retryRes = await doFetch(path, options, freshToken);
      if (!retryRes.ok) throw new Error(sanitizeErrorMessage(...));
      return retryRes.json();
    }
  }

  if (!res.ok) throw new Error(sanitizeErrorMessage(...));
  return res.json();
}
```

**Key Features:**
- Automatically adds `Authorization: Bearer {token}` header
- Supports file uploads via FormData (omits Content-Type)
- Auto-retries once on 401 with fresh token (Clerk SDK integration)
- Sanitizes error messages (401 → "Session expired")

### 7.2 Usage in Components

```typescript
// Clerk hook provides token function
const { getToken } = useAuth();

// Call API with auto-refresh:
const data = await fetchApi(
  "/api/questions/ai",
  { method: "POST", body: JSON.stringify(payload) },
  token,
  getToken  // Enable auto-retry on 401
);
```

### 7.3 Hono RPC Client

**File:** `/Users/phuc/work/ClassPulse/apps/web/src/lib/api-client.ts`

```typescript
const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8787";
export const api = hc<Hono>(apiUrl);
```

**Status:** Currently uses base Hono type. Full type-safe RPC (with AppType) deferred to Phase 2 pending build system improvements.

---

## 8. Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT (React)                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 1. Clerk SDK initializes & manages JWT                  │   │
│ │ 2. Component calls useAuth().getToken() → JWT           │   │
│ │ 3. fetchApi(path, options, token, getToken)             │   │
│ └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                    Authorization: Bearer {JWT}
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ HONO ROUTER (Cloudflare Workers)                                │
│                                                                 │
│ [1] CORS Middleware                                             │
│     ↓ Sets Access-Control-* headers                             │
│ [2] Public Routes (no auth)                                     │
│     ├─ POST /webhook/clerk (Svix signature validation)          │
│     └─ GET /health                                              │
│ [3] Auth Middleware (applied to /api/*)                         │
│     ├─ Extract Bearer token                                     │
│     ├─ Verify via Clerk verifyToken(token, secretKey)           │
│     ├─ Set userId on context                                    │
│     └─ Return 401 if invalid                                    │
│ [4] Protected Routes (/api/*)                                   │
│     ├─ POST /api/questions/ai (AI question creation)            │
│     ├─ POST /api/questions (single question)                    │
│     ├─ GET /api/questions (list with filters)                   │
│     └─ ... (all other /api/* routes)                            │
│                                                                 │
│ Special: WebSocket Routes (bypass /api/*, use query param)      │
│     └─ GET /ws/classroom/:id?token=JWT                          │
└─────────────────────────────────────────────────────────────────┘
                               │
                      Clerk Backend SDK
                   verifyToken(jwt, secretKey)
                               │
                               ▼
                    ┌───────────────────┐
                    │  Clerk Auth       │
                    │  (External SaaS)  │
                    └───────────────────┘
```

---

## 9. Token Validation Details

### 9.1 JWT Verification

**Library:** `@clerk/backend` (v1.20.0)

```typescript
import { verifyToken } from "@clerk/backend";

const payload = await verifyToken(token, {
  secretKey: c.env.CLERK_SECRET_KEY,
});

// payload contains:
// {
//   sub: "user_xxxxx",          // Clerk user ID
//   aud: ["issuer_id"],         // Audience
//   exp: 1234567890,            // Expiration timestamp
//   iat: 1234567000,            // Issued at
//   // ... other OIDC claims
// }
```

### 9.2 Validation Points

| Check | Location | Behavior |
|-------|----------|----------|
| Bearer format | authMiddleware.ts:16 | Return 401 if missing or malformed |
| JWT signature | @clerk/backend verifyToken | Return 401 if invalid signature |
| Token expiry | @clerk/backend verifyToken | Return 401 if expired |
| sub claim exists | authMiddleware.ts:27 | Return 401 if missing |
| Webhook timestamp | users-route.ts:43-46 | Return 401 if >5 min old |
| Webhook signature | users-route.ts:56-71 | Return 401 if HMAC doesn't match |

### 9.3 Context Pattern

All protected routes retrieve userId from Hono context:

```typescript
// In any route handler with authMiddleware applied:
const userId = c.get("userId");  // From payload.sub
const db = drizzle(c.env.DB);

// Typically used for:
// - Ownership checks (is this user's question?)
// - Access control (is user a classroom member?)
// - Data scoping (filter to user's data only)
```

---

## 10. No M2M/Service-to-Service Auth Pattern Found

**Observation:** The codebase does not currently implement machine-to-machine (M2M) authentication. All API calls assume a human user with a Clerk JWT token.

**Clerk M2M Support Available:**
- Clerk offers M2M tokens via Backend API
- Can be added if backend service needs to call other services
- Would require: separate `CLERK_API_KEY` and M2M token request logic

---

## 11. CORS Configuration

**File:** `/Users/phuc/work/ClassPulse/apps/api/src/middleware/cors-middleware.ts`

```typescript
export const corsMiddleware = (): MiddlewareHandler<Env> =>
  async (c, next) => {
    const raw = c.env.CORS_ORIGIN ?? "http://localhost:5173";
    const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);

    return cors({
      origin: allowed.length === 1 ? allowed[0] : allowed,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type"],
      maxAge: 86400,
    })(c, next);
  };
```

**Current Origins (from wrangler.toml):**
- Production: `https://thayphuc.pages.dev`
- Local dev: `http://localhost:5173`

---

## 12. File Paths Reference

### Core Auth Files
- `/Users/phuc/work/ClassPulse/apps/api/src/middleware/auth-middleware.ts` - Bearer token validation
- `/Users/phuc/work/ClassPulse/apps/api/src/middleware/cors-middleware.ts` - CORS config
- `/Users/phuc/work/ClassPulse/apps/api/src/routes/users-route.ts` - Webhook & user management
- `/Users/phuc/work/ClassPulse/apps/api/src/env.ts` - Environment type definitions

### AI Question API
- `/Users/phuc/work/ClassPulse/apps/api/src/routes/ai-question-routes.ts` - Main endpoint
- `/Users/phuc/work/ClassPulse/apps/api/src/services/ai-question-parser.ts` - YAML/markdown parsing
- `/Users/phuc/work/ClassPulse/packages/shared/src/schemas/index.ts` - Request schemas (aiCreateQuestionsSchema)

### Frontend Integration
- `/Users/phuc/work/ClassPulse/apps/web/src/lib/fetch-api.ts` - HTTP fetch wrapper with auto-retry
- `/Users/phuc/work/ClassPulse/apps/web/src/lib/api-client.ts` - Hono RPC client setup

### Configuration
- `/Users/phuc/work/ClassPulse/apps/api/wrangler.toml` - Cloudflare Workers config
- `/Users/phuc/work/ClassPulse/apps/api/package.json` - Backend dependencies (includes @clerk/backend)
- `/Users/phuc/work/ClassPulse/apps/web/package.json` - Frontend dependencies (includes @clerk/clerk-react)

---

## Summary

**Clerk Auth Setup:**
- ✅ JWT-based Bearer token auth via `@clerk/backend` SDK
- ✅ Webhook signature validation (Svix) for user sync
- ✅ Hono middleware pattern for protecting /api/* routes
- ✅ Special query-param auth for WebSocket connections
- ✅ Auto-retry on 401 (Clerk session refresh) in frontend

**AI Question API:**
- ✅ `POST /api/questions/ai` accepts up to 50 questions
- ✅ YAML frontmatter parsing for metadata (complexity, tags, explanation)
- ✅ Base64 image upload with MIME validation & size limits
- ✅ Tag creation on-the-fly (cached per request)
- ✅ Bulk response with individual question status + errors

**Security:**
- ✅ All API routes require Bearer token
- ✅ Webhook signature verification (Svix HMAC-SHA256)
- ✅ 5-minute webhook timestamp freshness window
- ✅ Role validation on user sync
- ✅ CORS configured for production + local dev

**Tech Stack:**
- Hono 4.7.0 + Cloudflare Workers
- Drizzle ORM + D1 database
- Zod schema validation
- Clerk for identity (JWT + webhooks)
- React 19 + TanStack ecosystem on frontend
