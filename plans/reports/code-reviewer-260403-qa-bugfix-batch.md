# Code Review: QA Bugfix Batch

**Date:** 2026-04-03
**Reviewer:** code-reviewer agent
**Scope:** 11 files across `apps/web` and `apps/api`

---

## Overall Assessment

Solid batch of fixes. The 401-retry logic in `fetch-api.ts` is well-structured with token comparison guard. Dashboard API queries run in parallel, which is good. Settings page is clean. A few issues warrant attention before shipping -- one critical, two high-priority.

---

## Critical Issues

### C1. Dashboard `count()` over-counts students (duplicate rows)

**File:** `apps/api/src/routes/dashboard-routes.ts:27-30`

```ts
db.select({ count: count() })
  .from(classroomMembers)
  .innerJoin(classrooms, eq(classroomMembers.classroomId, classrooms.id))
  .where(and(eq(classrooms.teacherId, userId), eq(classroomMembers.role, "student")))
```

This counts **membership rows**, not **distinct students**. A student enrolled in 3 of the same teacher's classrooms is counted 3 times. The KPI label says "Total Students" which implies unique people.

**Fix:** Use `countDistinct(classroomMembers.userId)` from `drizzle-orm`:

```ts
import { countDistinct } from "drizzle-orm";

db.select({ count: countDistinct(classroomMembers.userId) })
  .from(classroomMembers)
  .innerJoin(classrooms, eq(classroomMembers.classroomId, classrooms.id))
  .where(and(eq(classrooms.teacherId, userId), eq(classroomMembers.role, "student")))
```

---

## High Priority

### H1. 401-retry silently falls through on same-token refresh

**File:** `apps/web/src/lib/fetch-api.ts:41-51`

When `getToken()` returns the **same** stale token (Clerk cache not yet refreshed) or returns `null`, the code falls through to the `if (!res.ok)` block below, which re-throws the original 401 error. This is functionally correct but the path is subtle.

However, there is a real edge case: if `getToken()` **throws** (network error, Clerk SDK issue), the exception propagates **unhandled** with no sanitization. The caller sees a raw Clerk error instead of a user-friendly message.

**Fix:** Wrap `getToken()` call in try-catch:

```ts
if (res.status === 401 && getToken) {
  try {
    const freshToken = await getToken();
    if (freshToken && freshToken !== token) {
      const retryRes = await doFetch(path, options, freshToken);
      if (!retryRes.ok) {
        const body = await retryRes.json().catch(() => ({ error: "Request failed" }));
        throw new Error(sanitizeErrorMessage(body as { error?: string }, retryRes.status));
      }
      return retryRes.json();
    }
  } catch (e) {
    // If getToken itself failed, fall through to original 401 handling
    if (e instanceof Error && e.message !== "Session expired. Please refresh the page.") {
      // swallow token refresh failure, let original 401 path handle it
    } else {
      throw e; // re-throw sanitized errors from retry path
    }
  }
}
```

### H2. `fetchApi` returns `res.json()` on empty 204 responses

**File:** `apps/web/src/lib/fetch-api.ts:58`

If any future API endpoint returns `204 No Content`, `res.json()` will throw. Currently all endpoints return JSON, but this is a latent bug.

**Fix (low-effort):**

```ts
if (res.status === 204) return null;
return res.json();
```

### H3. No role-based guard on dashboard stats endpoint

**File:** `apps/api/src/routes/dashboard-routes.ts:17`

The `/api/dashboard/stats` endpoint has no role check. Any authenticated user (student, parent) can call it. Because queries filter by `teacherId = userId`, students/parents get zeros -- not a data leak, but unnecessary DB work and a confusing API surface.

**Recommendation:** Add a lightweight role check or document this as by-design. If adding a check, query the `users` table for role or use a middleware.

---

## Medium Priority

### M1. `question-editor-page.tsx` load-path uses stale `initialToken`

**File:** `apps/web/src/features/questions/question-editor-page.tsx:64`

The edit-mode load (`fetchApi(..., initialToken)`) uses the token cached at mount time. If the token expires between mount and load, the request fails with 401 and there is no retry (no `getToken` passed as 4th arg).

**Fix:** Pass `getToken` as the 4th argument to enable retry, or fetch a fresh token inline:

```ts
const t = await getToken();
fetchApi(`/api/questions/${questionId}`, {}, t, getToken)
```

This requires converting the `useEffect` to use `getToken` directly rather than depending on `initialToken`.

### M2. `initialToken` pattern is fragile

**File:** `apps/web/src/features/questions/question-editor-page.tsx:51-59`

The `initialToken` state + useEffect pattern caches a token at mount time and passes it to child components (`TagSelector`, `ImageUploadButton`). These children will use a stale token if the session lasts longer than token expiry (typically 60s for Clerk short-lived tokens).

**Recommendation:** Pass `getToken` function to children instead of a cached token string, or use a context/hook that always returns fresh tokens.

### M3. Missing `getToken` retry on several `fetchApi` call sites

**Files:** `dashboard-route.tsx:34`, `classroom-list-page.tsx:33`, `classroom-detail-page.tsx:48`

These query functions call `fetchApi(url, {}, t)` without passing `getToken` as 4th arg, so the 401-retry logic is never activated. The pattern is inconsistent -- `question-editor-page.tsx` passes `getToken` for mutations but not for loads.

**Recommendation:** Standardize. Either always pass `getToken` or create a wrapper hook that does it automatically.

### M4. `assessmentAttempts.startedAt` index missing for dashboard time filter

**File:** `apps/api/src/routes/dashboard-routes.ts:52`

The avg-score query filters on `gt(assessmentAttempts.startedAt, thirtyDaysAgo)`. The `assessment_attempts` table has indexes on `studentId`, `assessmentId`, and `(classroomId, assessmentId)` but none on `startedAt`. For small datasets this is fine; as attempts grow, this becomes a full table scan after the join.

**Recommendation:** Add a composite index `(assessmentId, startedAt)` or accept the cost for now with a TODO comment.

---

## Low Priority

### L1. Settings page displays PII without masking

**File:** `apps/web/src/features/settings/settings-page.tsx:32`

Email is displayed in full. This is the user's own settings page so it's expected behavior, but confirm no screenshot/share features could leak it.

### L2. Dashboard role fallback defaults to "teacher"

**File:** `apps/web/src/routes/dashboard-route.tsx:97`

```ts
const role = user?.role ?? "teacher";
```

If the user profile load fails or returns null role, a student would see the teacher dashboard (with zeros). Consider defaulting to a neutral state or showing a loading/error instead.

### L3. `res.json()` called without checking Content-Type

**File:** `apps/web/src/lib/fetch-api.ts:46,49,54,58`

If the server returns HTML (e.g., Cloudflare error page), `res.json()` will throw a parse error. The `.catch(() => ({ error: "Request failed" }))` on error paths handles this, but the success path (line 49, 58) does not.

---

## Positive Observations

1. **Token comparison guard** in retry logic (`freshToken !== token`) prevents infinite retry loops. Well done.
2. **Error sanitization** prevents leaking internal error details to the UI.
3. **Parallel queries** in dashboard stats with `Promise.all` -- good for D1 latency.
4. **Consistent validation messages** across wizard and classroom create dialogs.
5. **Pluralization fix** on classroom member count (`member(s)`) is correct.
6. **FormData detection** in `doFetch` correctly omits Content-Type for file uploads.

---

## Recommended Actions (Priority Order)

1. **[Critical]** Fix `count()` to `countDistinct()` for student count in dashboard stats
2. **[High]** Add try-catch around `getToken()` in retry path
3. **[High]** Handle `204 No Content` in `fetchApi` return path
4. **[Medium]** Pass `getToken` to load-path `fetchApi` calls for retry support
5. **[Medium]** Consider standardizing a `useAuthFetch` hook that always injects `getToken`
6. **[Low]** Add guard for `res.json()` on success path (non-JSON responses)

---

## Checklist Verification

- [x] Concurrency: no shared mutable state; retry is single-attempt with guard
- [x] Error boundaries: sanitization present; getToken throw path needs hardening (H1)
- [x] API contracts: `fetchApi` return type is `Promise<unknown>`, callers cast -- acceptable
- [x] Backwards compatibility: no breaking changes; new endpoints only
- [x] Input validation: dashboard endpoint has no user input beyond auth token
- [x] Auth/authz: auth middleware covers all `/api/*`; role guard missing but not exploitable (H3)
- [x] N+1 / query efficiency: parallel queries good; count vs countDistinct bug (C1); missing index noted (M4)
- [x] Data leaks: error sanitization in place; no PII exposure beyond user's own settings page
