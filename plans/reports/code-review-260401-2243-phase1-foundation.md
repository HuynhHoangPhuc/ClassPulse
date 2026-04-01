# Code Review: Phase 1 Foundation Scaffold

**Date:** 2026-04-01
**Reviewer:** code-reviewer
**Scope:** Full Phase 1 — packages/shared (12 files), apps/api (8 files), apps/web (19 files)
**LOC:** ~1,150 across 39 source files
**Verdict:** PASS WITH CONCERNS

---

## Overall Assessment

Solid greenfield scaffold. Clean module boundaries, consistent patterns, good type derivation strategy (const arrays -> type unions -> Zod schemas). The critical finding is a **missing webhook signature verification** on the Clerk webhook endpoint, which is a security blocker for production deployment. Several other medium-priority issues around type drift, missing DB indexes, and error message leaking are noted below.

---

## Critical Issues (Blocking)

### C1. Clerk webhook endpoint has NO signature verification
**File:** `apps/api/src/routes/users-route.ts:30-87`
**Impact:** Anyone can POST fabricated payloads to `/webhook/clerk` and create/update arbitrary user records in D1. This is an auth bypass and data integrity vulnerability.
**Details:**
- The `CLERK_WEBHOOK_SECRET` binding exists in `env.ts:12` (marked optional with `?`), but is never used.
- Clerk signs webhooks with Svix. The `@clerk/backend` package exports webhook verification helpers, or the `svix` package can be used directly.
- Without verification, an attacker can:
  - Create admin/teacher accounts by setting `public_metadata.role = "teacher"`
  - Overwrite any user's email/name/avatar by spoofing their Clerk ID
  - Inject arbitrary data

**Fix:**
```typescript
import { Webhook } from "svix";

clerkWebhookRoute.post("/", async (c) => {
  const secret = c.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return c.json({ error: "Webhook secret not configured" }, 500);
  }

  const payload = await c.req.text();
  const headers = {
    "svix-id": c.req.header("svix-id") ?? "",
    "svix-timestamp": c.req.header("svix-timestamp") ?? "",
    "svix-signature": c.req.header("svix-signature") ?? "",
  };

  const wh = new Webhook(secret);
  let body: WebhookEvent;
  try {
    body = wh.verify(payload, headers) as WebhookEvent;
  } catch {
    return c.json({ error: "Invalid webhook signature" }, 401);
  }
  // ...proceed with body
});
```
- Add `svix` to `apps/api/package.json` dependencies.
- Make `CLERK_WEBHOOK_SECRET` non-optional in `env.ts`.

### C2. Error middleware leaks internal error messages to clients
**File:** `apps/api/src/middleware/error-middleware.ts:33-34`
**Impact:** The catch-all 500 handler returns `err.message` directly. In production, this can leak stack info, file paths, or DB error details (e.g., constraint violation messages from D1 containing table/column names).
**Fix:**
```typescript
// Replace:
const message = err instanceof Error ? err.message : "Internal server error";
// With:
console.error("[error]", err);
const message = "Internal server error";
```
Always log the real error server-side but return a generic message to the client.

---

## High Priority

### H1. Webhook role field accepts arbitrary strings — no validation
**File:** `apps/api/src/routes/users-route.ts:62`
```typescript
const role = (data.public_metadata?.role as string) ?? "student";
```
**Impact:** The role is cast blindly from Clerk metadata and inserted into DB without validation against the `USER_ROLES` constant. If Clerk metadata contains `"admin"` or `"superuser"`, it goes straight into the DB. Downstream code comparing against `UserRole` values will silently mismatch.
**Fix:**
```typescript
import { USER_ROLES } from "@teaching/shared";

const rawRole = data.public_metadata?.role;
const role = USER_ROLES.includes(rawRole as any) ? rawRole as string : "student";
```

### H2. Type drift between shared types and Drizzle schema
**File:** `packages/shared/src/types/*` vs `apps/api/src/db/schema.ts`
**Impact:** Two parallel type systems exist — shared interfaces use `boolean` for fields like `isCorrect`, `isAutoSubmitted`, `isRead`, `shuffleQuestions`, `shuffleOptions`; the Drizzle schema uses `integer` (SQLite has no native boolean). The Drizzle `InferSelectModel` types at the bottom of `schema.ts` will produce `number` for these fields, conflicting with the shared `boolean` types.

Specific mismatches:
| Field | Shared Type | Drizzle InferSelectModel |
|-------|------------|------------------------|
| `Question.options` | `QuestionOption[]` | `string` (JSON stored as text) |
| `Assessment.shuffleQuestions` | `boolean` | `number` |
| `Assessment.shuffleOptions` | `boolean` | `number` |
| `AssessmentAttempt.isAutoSubmitted` | `boolean` | `number` |
| `AttemptAnswer.isCorrect` | `boolean` | `number` |
| `Notification.isRead` | `boolean` | `number` |

**Recommendation:** Either:
1. Add a mapping/transform layer in the API that converts DB rows to shared types before returning (recommended), or
2. Use Drizzle's `{ mode: "boolean" }` on integer columns that represent booleans (Drizzle supports this for SQLite)

### H3. Missing database indexes for common query patterns
**File:** `apps/api/src/db/schema.ts`
**Impact:** No secondary indexes defined. As data grows, the following queries will degrade:
- `users` table: no unique index on `email` — searching by email will be a full scan, and duplicate emails are not prevented at DB level
- `notifications` table: filtering by `userId` + `isRead` (the most common notification query) has no index
- `assessmentAttempts` table: no index on `studentId` or `assessmentId` — student attempt lookups will scan
- `posts` table: no index on `classroomId` — classroom feed queries will scan
- `comments` table: no index on `postId` — comment loading per post will scan

**Fix:** Add indexes in the schema definition:
```typescript
import { index } from "drizzle-orm/sqlite-core";

// Example for users:
export const users = sqliteTable("users", { ... }, (t) => ({
  emailIdx: index("users_email_idx").on(t.email),
}));
```

### H4. `comments.parentCommentId` has no foreign key constraint
**File:** `apps/api/src/db/schema.ts:132`
**Impact:** The self-referencing FK for threaded comments is declared as plain `text("parent_comment_id")` with no `.references()`. This means the DB will not enforce referential integrity — orphaned comments can exist if a parent is deleted. The comment at line 131 acknowledges this is intentional for self-reference, but Drizzle supports self-referencing FKs.
**Fix:**
```typescript
parentCommentId: text("parent_comment_id").references(() => comments.id),
```

---

## Medium Priority

### M1. CORS origin does not support multiple origins or pattern matching
**File:** `apps/api/src/middleware/cors-middleware.ts:11`
**Impact:** `CORS_ORIGIN` is a single string. When deploying with preview URLs (Cloudflare Pages generates unique URLs per deploy), or when needing both staging + production origins, this will not work. Hono's `cors()` accepts an array or a function.
**Recommendation:** Support comma-separated origins or a callback:
```typescript
const origins = c.env.CORS_ORIGIN?.split(",").map(s => s.trim()) ?? ["http://localhost:5173"];
return cors({ origin: origins, ... })(c, next);
```

### M2. `AppType` export only includes the users route
**File:** `apps/api/src/index.ts:25,31`
```typescript
const routes = app.route("/api/users", usersRoute);
export type AppType = typeof routes;
```
**Impact:** When additional routes are added in later phases, they need to be chained onto `routes` or `AppType` will not include their types. This is a known Hono RPC pattern constraint but easy to forget. Add a comment or use a chaining pattern:
```typescript
const routes = app
  .route("/api/users", usersRoute)
  // .route("/api/questions", questionsRoute) // Phase 2
```

### M3. API client in web app is not wired to real types
**File:** `apps/web/src/lib/api-client.ts:8-9`
```typescript
export const api = hc<Hono>(apiUrl);
```
**Impact:** Using bare `Hono` as the generic parameter gives no type safety — all routes resolve to `any`. The comment says "Phase 2" but this should track as a known gap.

### M4. `window.location.replace` used for auth redirect instead of router navigation
**File:** `apps/web/src/routes/authed-layout.tsx:41`
```typescript
window.location.replace("/login");
```
**Impact:** Full page reload discards all client state (QueryClient cache, etc.). Use `router.navigate({ to: "/login" })` or TanStack Router's `redirect()` in `beforeLoad`. The comment says `beforeLoad` cannot use hooks, which is true, but `beforeLoad` can return `redirect({ to: "/login" })` by checking auth status via a non-hook approach (e.g., Clerk's `getAuth()` or a global auth store).

### M5. `wrangler.toml` contains empty secret values in plain text
**File:** `apps/api/wrangler.toml:16-17`
```toml
CLERK_PUBLISHABLE_KEY = ""
CLERK_SECRET_KEY = ""
```
**Impact:** While currently empty, these should use `wrangler secret put` and not appear in `[vars]` at all. Having them in `[vars]` means they will be deployed as environment variables in plaintext via `wrangler deploy`. When real values are added, they could be committed to git.
**Fix:** Remove from `[vars]`, use `wrangler secret put CLERK_SECRET_KEY` for production. Keep only non-secret vars in `[vars]`.

### M6. Hardcoded role="teacher" in AppShell and DashboardPage
**Files:** `apps/web/src/components/layout/app-shell.tsx:24`, `apps/web/src/routes/dashboard-route.tsx:85`
**Impact:** Known Phase 1 limitation (noted with TODOs), but the double-cast `"teacher" as unknown as Role` at dashboard-route.tsx:85 is a code smell that should be tracked.

---

## Minor / Informational

### L1. `nanoid` default size of 21 is fine for IDs but could be documented
**File:** `apps/api/src/lib/id-generator.ts`
**Note:** nanoid(21) gives ~149 bits of entropy, which is sufficient. Collision probability at 1M IDs is negligible. No issue here.

### L2. No `email` unique constraint on users table
**File:** `apps/api/src/db/schema.ts:7`
**Note:** Since the primary key is the Clerk user ID and email comes from Clerk, uniqueness is de facto guaranteed by Clerk. However, adding `.unique()` to the `email` column would be a defense-in-depth measure against webhook replay or data corruption bugs.

### L3. Shared package has no build step
**File:** `packages/shared/package.json`
**Note:** `"main": "./src/index.ts"` and `"exports": { ".": "./src/index.ts" }` point to raw TypeScript. This works with bundlers (Vite, Wrangler) that handle TS directly, but may break with tools expecting JS. Acceptable for a monorepo with Turborepo, but worth noting.

### L4. `complexityLevelSchema` uses `z.union([z.literal(...)])` instead of `z.enum`
**File:** `packages/shared/src/schemas/index.ts:16-22`
**Note:** Because `COMPLEXITY_LEVELS` is `[1,2,3,4,5]` (numbers, not strings), `z.enum()` cannot be used. The `z.union` approach is correct. A more concise alternative: `z.number().int().min(1).max(5)`.

### L5. `createPostSchema` does not enforce `assessmentId` presence when `type === "assessment_assignment"`
**File:** `packages/shared/src/schemas/index.ts:73-80`
**Note:** A post of type `"assessment_assignment"` should require `assessmentId` to be non-null. Consider using Zod discriminated union or `.refine()`.

### L6. `submitAnswerSchema` is minimal
**File:** `packages/shared/src/schemas/index.ts:89-92`
**Note:** Only validates `questionId` and `selectedOptionId` as strings. No `attemptId`. This schema will need expansion when the attempt submission route is built.

---

## Positive Observations

1. **Clean module boundaries** — shared package cleanly separates constants, types, and schemas with no circular deps
2. **Const-assertion pattern** — `as const` arrays + derived union types is the gold standard for enum-like values in TS
3. **Drizzle schema is complete** — All 15 tables present with proper FK references, composite PKs, and sensible defaults
4. **Error handler covers Zod + HTTPException** — Good pattern for API validation error responses
5. **Auth middleware extracts JWT correctly** — Bearer token parsing, `verifyToken` with secret, null-check on `payload.sub`
6. **Dark mode toggle** — Properly persists to localStorage, respects system preference, syncs `.dark` class on `<html>`
7. **UI components** — Card, Badge, PageHeader, EmptyState are well-typed with sensible variant systems
8. **Turborepo config** — Proper task dependencies with `dependsOn: ["^build"]` for typecheck/lint

---

## Recommendations (Prioritized)

1. **[CRITICAL]** Add Svix webhook signature verification to Clerk webhook endpoint
2. **[CRITICAL]** Stop leaking `err.message` in 500 responses
3. **[HIGH]** Validate role against `USER_ROLES` before DB insert in webhook handler
4. **[HIGH]** Add `{ mode: "boolean" }` to Drizzle integer columns that represent booleans, or build a transform layer
5. **[HIGH]** Add indexes on frequently-queried FK columns (`notifications.userId`, `posts.classroomId`, `comments.postId`, `assessmentAttempts.studentId`)
6. **[HIGH]** Add self-referencing FK on `comments.parentCommentId`
7. **[MEDIUM]** Move `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` to wrangler secrets
8. **[MEDIUM]** Support multiple CORS origins
9. **[MEDIUM]** Replace `window.location.replace` with router-level redirect

---

## Metrics

| Metric | Value |
|--------|-------|
| Type Coverage | High (strict mode enabled, minimal `any` usage — 1 instance in error handler) |
| Test Coverage | 0% (no tests yet — acceptable for Phase 1 scaffold) |
| Linting | Not configured (placeholder `echo` scripts) |
| Security Issues | 1 critical (webhook), 1 high (role validation), 1 medium (secret in vars) |
| Schema Tables | 15/15 present |
| Shared Type/Schema Alignment | Partial — boolean/number drift identified |

---

## Unresolved Questions

1. Is the `STORAGE` R2 bucket binding used anywhere in Phase 1? It is declared in `env.ts` and `wrangler.toml` but never referenced. If not needed yet, removing it avoids confusion.
2. Will Clerk metadata role assignment happen via a Clerk dashboard action or a separate onboarding flow? The webhook handler defaults to `"student"` — is this the intended default for self-signup?
3. The `generationConfig` field on `assessments` (JSON text) — is this for AI-generated assessments? If so, should the schema enforce a JSON structure via Zod at the API layer?

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Scaffold is well-structured and architecturally sound. Two critical security issues (unverified webhook, error message leaking) must be fixed before any production-adjacent deployment. Several high-priority type safety and DB index issues should be addressed before Phase 2.
**Concerns:** Webhook auth bypass is exploitable in any non-localhost environment. Boolean/number type drift between shared types and Drizzle will cause runtime bugs when API responses are consumed by the web app.
