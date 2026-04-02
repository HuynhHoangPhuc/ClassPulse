# Code Review: Phase 2 — Question Bank Implementation

**Reviewer:** code-reviewer  
**Date:** 2026-04-01  
**Scope:** 17 files (4 backend routes/services, 1 index, 1 shared schema, 10 frontend components, 1 route def)

---

## Overall Assessment

Solid implementation with good auth scoping, consistent schema validation, and proper separation of concerns. The code follows existing codebase patterns well. However, there are several production-impacting issues that need attention before ship.

---

## Critical Issues

### 1. [SECURITY] Upload route serves ANY R2 key — path traversal / unauthorized access

**File:** `apps/api/src/routes/upload-route.ts:46-58`

The `GET /:key{.+}` endpoint serves any R2 object by key with **zero auth check** and no path prefix enforcement. An attacker can read any object in the R2 bucket by guessing or brute-forcing keys.

```ts
// Current — no auth, no prefix validation
uploadRoute.get("/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.STORAGE.get(key);
  // ...serves it
});
```

The route is mounted under `/api/upload/image` which is behind `authMiddleware`, but the image serve endpoint should arguably be public (for embedded images in assessments). However, the key is user-controlled — a path like `../../secrets` or any arbitrary key can be requested.

**Fix options:**
- (a) Validate that `key` starts with `images/` prefix: `if (!key.startsWith("images/")) return c.json({ error: "Invalid path" }, 400);`
- (b) If images must be public, mount the GET route outside the auth guard and still enforce the `images/` prefix.
- (c) Add `Cache-Control` headers for served images since they are immutable.

**Impact:** Information disclosure of any object in the R2 bucket.

### 2. [SECURITY] No MIME type validation on `tag.color` — stored XSS vector

**File:** `packages/shared/src/schemas/index.ts:49-52`

The `createTagSchema` and `updateTagSchema` accept `color` as `z.string().nullable().optional()` with no format constraint. A malicious value like `red" onmouseover="alert(1)` could be injected and rendered unescaped in the frontend via inline `style={{ background: tag.color }}`.

React's style prop does prevent script injection in the `style` attribute itself. However, the `tag.color` value is also used in string concatenation: `${tag.color}22` which is rendered in `background` CSS. If the color contains something like `url(javascript:...)` or CSS injection payloads, this could be exploited in older browsers.

**Fix:** Add a regex constraint to the color field:
```ts
color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).nullable().optional(),
```

**Impact:** Low-medium. React's style handling mitigates most vectors, but defense in depth says validate.

### 3. [DATA INTEGRITY] Race condition in question update — tag deletion + insertion not atomic

**File:** `apps/api/src/routes/questions-route.ts:132-142`

The PUT endpoint deletes old tags in the route handler (line 134), then calls `updateQuestion` which inserts new tags (line 145 in service). These are **separate database operations** — if the insert fails (e.g., invalid tagId), the old tags are already deleted with no rollback.

```ts
// Route handler deletes tags:
if (parsed.data.tagIds !== undefined) {
  await db.delete(questionTags).where(eq(questionTags.questionId, questionId));
}
// Service inserts new tags — if this throws, old tags are gone:
const question = await updateQuestion(db, questionId, teacherId, parsed.data);
```

**Fix:** Move the tag deletion inside `updateQuestion` and use `db.batch()` to make both operations atomic, or at minimum, wrap in a try/catch that re-inserts old tags on failure. Better yet, use D1 batch:

```ts
// In updateQuestion, do both in a batch:
await db.batch([
  db.delete(questionTags).where(eq(questionTags.questionId, questionId)),
  db.insert(questionTags).values(newRows),
]);
```

**Impact:** Data loss — user's tag associations silently disappear on partial failure.

---

## High Priority

### 4. [PERFORMANCE] N+1 risk in search — `LIKE '%search%'` without full-text index

**File:** `apps/api/src/services/question-service.ts:60`

The search filter uses `LIKE '%term%'` which forces a full table scan on every search. D1 is SQLite-based, so there is no FTS5 module available by default. For small datasets this is acceptable, but as the question bank grows this becomes a problem.

**Mitigation:** No immediate fix needed, but add a comment noting the scaling concern and consider FTS or application-level search (e.g., Algolia) if question count exceeds ~1K per teacher.

### 5. [CORRECTNESS] Cursor pagination ordered by `questions.id` — non-deterministic for text IDs

**File:** `apps/api/src/routes/questions-route.ts:55`

Pagination uses `.orderBy(questions.id)` with cursor `questions.id > cursor`. The `generateId()` function likely produces ULIDs/UUIDs. If it produces ULIDs, ordering is time-based and correct. If it produces random UUIDs, ordering is lexicographic on random strings which is stable but semantically meaningless (user won't see newest first).

```ts
rows = await db
  .select().from(questions)
  .where(and(...conditions))
  .orderBy(questions.id) // <-- what order is this?
  .limit(limit + 1);
```

**Recommendation:** Verify `generateId()` returns time-sortable IDs (ULID/KSUID). If so, add a comment. If UUID, switch to `.orderBy(desc(questions.createdAt))` and cursor on `createdAt` instead.

### 6. [CORRECTNESS] `JSON.parse(question.options)` — crashes on malformed data

**Files:** `questions-route.ts:67,90` and `question-service.ts:122,155`

Four places do `JSON.parse(question.options)` with no try/catch. If the DB has malformed JSON (manual edit, migration issue, encoding error), the entire API call crashes with an unhandled exception.

**Fix:** Wrap in try/catch or use a safe parse utility:
```ts
function safeParseOptions(raw: string): unknown[] {
  try { return JSON.parse(raw); } catch { return []; }
}
```

### 7. [UX/CORRECTNESS] Search fires a query on every keystroke

**File:** `apps/web/src/features/questions/question-list-page.tsx:129`

```ts
onChange={(e) => handleFiltersChange({ ...filters, search: e.target.value })}
```

`handleFiltersChange` resets cursor and allQuestions, and changing `filters` in state triggers a new TanStack Query fetch. This means every keystroke fires an API call and resets pagination.

**Fix:** Debounce the search input (300-500ms). Either use a local state + debounced effect, or use `useDeferredValue`.

### 8. [CORRECTNESS] Frontend pagination accumulation has duplicate risk

**File:** `apps/web/src/features/questions/question-list-page.tsx:93-100`

```ts
const questions: QuestionWithTags[] = cursor
  ? [...allQuestions, ...(data?.items ?? [])]
  : (data?.items ?? []);
```

When the user clicks "Load more", `allQuestions` is set to the current `questions` array before the cursor changes. However, `queryKey` includes `cursor`, so the query refetches. If the query re-renders while `data` still contains the previous page's items (stale), items could be duplicated.

Additionally, the `queryKey` includes `filters` which is an object — TanStack Query uses structural comparison, but a new object is created on every render if `filters` is not memoized/stable.

**Fix:** Consider using TanStack Query's `useInfiniteQuery` which is designed for exactly this cursor-based pattern and handles deduplication properly.

---

## Medium Priority

### 9. [AUTH] No role check — any authenticated user can CRUD questions

**Files:** All route files.

The auth middleware verifies the JWT and sets `userId`, but there is no check that the user has the `teacher` role. A student or parent with a valid Clerk token can create/modify/delete questions and tags.

The `teacherId` column provides ownership isolation (teacher A can't see teacher B's data), but a student's userId would be stored as `teacherId`, creating orphaned data and violating the domain model.

**Fix:** Add role verification middleware:
```ts
app.use("/api/questions/*", requireRole("teacher"));
app.use("/api/tags/*", requireRole("teacher"));
app.use("/api/upload/*", requireRole("teacher"));
```

Or check role in each handler by querying the users table.

### 10. [CORRECTNESS] `and(...conditions)` crashes when conditions array is empty

**File:** `apps/api/src/routes/questions-route.ts:54`

If `buildQuestionFilters` returns an empty array (it won't currently since it always pushes the teacherId condition), but if someone modifies it, `and()` with no arguments would fail.

The function currently always returns at least one condition, so this is not currently exploitable but is fragile.

### 11. [PERFORMANCE] TagSelector fetches all tags on every mount

**File:** `apps/web/src/features/questions/tag-selector.tsx:24-28`

Each `TagSelector` instance fires its own `fetchApi("/api/tags")` call on mount. The question editor page has one TagSelector, and the filter panel has another — that is 2 API calls for the same data on the list page.

**Fix:** Use TanStack Query with a shared `["tags"]` query key so the data is cached and deduplicated.

### 12. [UX] Delete confirmation timeout leaks on unmount

**File:** `apps/web/src/features/questions/question-card.tsx:35`

```ts
setTimeout(() => setConfirmDelete(false), 3000);
```

If the component unmounts before the 3s timeout fires, React will warn about state update on unmounted component (React 18 removed this warning, but it is still a memory leak pattern).

**Fix:** Use `useEffect` cleanup or `useRef` to track the timeout:
```ts
const timerRef = useRef<ReturnType<typeof setTimeout>>();
// In handleDeleteClick:
timerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
// In useEffect cleanup:
useEffect(() => () => clearTimeout(timerRef.current), []);
```

### 13. [DATA QUALITY] Bulk retag replaces all tags with only the provided set

**File:** `apps/api/src/routes/questions-route.ts:217-219`

The `retag` action does DELETE + INSERT, replacing all existing tags on the selected questions. The frontend may expect additive behavior. This is a design choice, but it should be documented in the API contract.

### 14. [MISSING] No `Cache-Control` on served images

**File:** `apps/api/src/routes/upload-route.ts:55`

Images are served without cache headers. Since uploaded images are immutable (random IDs), they should have aggressive caching:

```ts
headers: {
  "Content-Type": contentType,
  "Cache-Control": "public, max-age=31536000, immutable",
}
```

---

## Low Priority

### 15. Token fetch pattern — repeated `useEffect` + `getToken()` across components

**Files:** `question-list-page.tsx:76-78`, `question-editor-page.tsx:57-59`

Both pages independently fetch and store the auth token in local state. This is a pattern that should be extracted into a shared hook (`useAuthToken`) or better, passed via context. The `getToken()` call is also duplicated in the query function itself (line 85).

### 16. `img` tag in MarkdownPreview has no loading or error handling

**File:** `apps/web/src/features/questions/markdown-preview.tsx:129`

Broken image URLs will show the browser's broken image icon with no fallback.

### 17. Filter panel complexity range allows min > max

**File:** `apps/web/src/features/questions/question-filter-panel.tsx:110-133`

The UI allows selecting min=5, max=1 which produces zero results without clear feedback. Add validation to ensure min <= max.

---

## Positive Observations

- Auth scoping is consistently applied: every DB query filters by `teacherId`
- Zod schemas at the boundary provide good input validation
- D1 `batch()` used for atomic deletes (tags + question, question_tags + questions)
- Proper error shapes returned from API (error field + details)
- Accessible markup: `aria-pressed`, `aria-label` on complexity selector
- Good empty states and loading skeletons
- File upload has both client-side and server-side size/type validation
- Clean separation of query logic into `question-service.ts`

---

## Recommended Actions (prioritized)

1. **[CRITICAL]** Enforce `images/` prefix on R2 GET route to prevent path traversal
2. **[CRITICAL]** Make tag replacement atomic in question update (batch delete+insert)
3. **[HIGH]** Add role check middleware for teacher-only routes
4. **[HIGH]** Debounce search input on list page
5. **[HIGH]** Add try/catch around `JSON.parse(question.options)`
6. **[MEDIUM]** Validate `color` field with hex regex
7. **[MEDIUM]** Use TanStack `useInfiniteQuery` for cursor pagination
8. **[MEDIUM]** Cache tag fetches with TanStack Query instead of raw fetchApi
9. **[MEDIUM]** Add `Cache-Control` headers to image serve endpoint
10. **[LOW]** Extract shared `useAuthToken` hook
11. **[LOW]** Validate complexity range (min <= max) in filter panel

---

## Metrics

| Metric | Value |
|--------|-------|
| Files reviewed | 17 |
| Critical issues | 3 |
| High priority | 5 |
| Medium priority | 6 |
| Low priority | 3 |
| Schema validation | Good (Zod at boundaries) |
| Auth scoping | Present but missing role check |
| Missing indexes | `questions.teacher_id`, `tags.teacher_id` (no index in schema) |

---

## Unresolved Questions

1. What does `generateId()` return? ULID/KSUID (time-sortable) or random UUID? This affects pagination correctness.
2. Should the image serve endpoint be public (for student-facing assessments) or remain behind auth?
3. Is `retag` bulk action intended to be additive or replacement? Current impl is replacement.
4. Are there plans for FTS or external search as the question bank grows?
