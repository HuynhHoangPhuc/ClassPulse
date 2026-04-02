# Code Review: Phase 8 — Parent Dashboard

**Reviewer:** code-reviewer  
**Date:** 2026-04-02  
**Scope:** 17 files (backend service, routes, shared schemas, 12 frontend components, 2 modified files)

---

## Overall Assessment

Solid implementation. Auth boundary is well-enforced (role middleware + per-endpoint link verification). Drizzle ORM prevents SQL injection. N+1 in `getStudentClassrooms` was correctly resolved with batch queries. Frontend uses lazy-loaded charts and cursor pagination. Several issues found — two critical (division-by-zero in SQL, missing DB index), rest medium/low.

---

## Critical Issues

### C1. Division-by-zero in SQL when `totalPossible` is 0 or NULL

**File:** `apps/api/src/services/parent-dashboard-service.ts` lines 50, 89

```ts
avgPercent: sql<number>`AVG(${assessmentAttempts.score} / ${assessmentAttempts.totalPossible} * 100)`
```

`totalPossible` is `real("total_possible")` which is nullable. If a submitted attempt has `totalPossible = 0` or `NULL`, this produces `NaN`/`NULL` silently corrupting averages. SQLite division by zero returns `NULL`, which AVG ignores — so a zero-score attempt with `totalPossible = 0` would silently vanish from averages rather than surfacing an error.

**Fix:**
```sql
AVG(CASE WHEN ${assessmentAttempts.totalPossible} > 0
     THEN ${assessmentAttempts.score} / ${assessmentAttempts.totalPossible} * 100
     ELSE 0 END)
```

Same issue exists on line 89 in `getScoreTrend`.

### C2. Missing index on `parent_student` table

**File:** `apps/api/src/db/schema.ts` line 16

The `parent_student` table has no indexes beyond the primary key. Every `verifyParentStudentLink` call does a full table scan on `(parent_id, student_id)`. This is called on **every single parent API request** (7 endpoints). As the table grows, this becomes a production bottleneck.

**Fix:** Add a composite index:
```ts
export const parentStudent = sqliteTable("parent_student", {
  id: text("id").primaryKey(),
  parentId: text("parent_id").notNull().references(() => users.id),
  studentId: text("student_id").notNull().references(() => users.id),
  createdAt: integer("created_at").notNull(),
}, (t) => ({
  parentStudentIdx: index("parent_student_parent_id_student_id_idx").on(t.parentId, t.studentId),
}));
```

Generate a new migration after updating the schema.

---

## High Priority

### H1. N+1 race in parent auto-link (classroom-member-routes)

**File:** `apps/api/src/routes/classroom-member-routes.ts` lines 55-72

When adding a parent to a classroom, the code loops through all student members and performs a SELECT + conditional INSERT per student **sequentially without a transaction**:

```ts
for (const student of studentMembers) {
  const [existing] = await db.select(...)  // N queries
  if (!existing) {
    await db.insert(...)                    // up to N inserts
  }
}
```

**Issues:**
1. **No transaction:** If the loop fails midway, partial links are created with no rollback.
2. **Race condition:** Two concurrent "add parent" requests could create duplicate links since there's no unique constraint on `(parent_id, student_id)`.
3. **N+1 pattern:** For a classroom with 30 students, this fires 30-60 queries.

**Fix:**
- Add a `UNIQUE` constraint on `(parent_id, student_id)` in the schema.
- Use `INSERT ... ON CONFLICT IGNORE` pattern (Drizzle's `.onConflictDoNothing()`).
- Wrap in a D1 batch or transaction.

### H2. `studentId` passed to service functions without format validation

**File:** `apps/api/src/routes/parent-routes.ts` (all route handlers)

`c.req.param("studentId")` is used directly without any format validation. While Drizzle parameterizes it (no injection risk), a malformed or excessively long string still reaches the DB layer. The `parentStudentOverviewSchema` exists but is never used for the overview endpoint.

**Fix:** Validate `studentId` format (e.g., min length, alphanumeric pattern) before passing to service layer. Apply Zod parsing consistently across all endpoints.

### H3. `parentDetailView` field leaks assessment configuration to parents

**File:** `apps/api/src/services/parent-dashboard-service.ts` line 207

`getAssessmentHistory` returns `parentDetailView` to the client. While this is used in the frontend to gate the expand button, a parent can see the raw value in DevTools/network tab. Currently the value is just `"scores_only"` or `"full_detail"`, which is not truly sensitive — but the field name and value reveal teacher configuration intent.

**Severity:** Low-medium. Acceptable for now, but note that actual per-question detail data is NOT returned (the expand panel just shows a placeholder), so the access control is effectively enforced by not serving the detailed data. This is correct.

---

## Medium Priority

### M1. Assessment history pagination uses ascending ID order (inconsistent UX)

**File:** `apps/api/src/services/parent-dashboard-service.ts` line 214

`getAssessmentHistory` orders by `assessmentAttempts.id` ascending with forward cursor (`id > cursor`). This means oldest assessments appear first. The activity feed orders by `submittedAt DESC` (newest first). This inconsistency will confuse users.

**Fix:** Use `submittedAt DESC` ordering with `submittedAt < cursor` for consistent newest-first pagination, matching the activity feed.

### M2. React state mutation in queryFn (assessment history)

**File:** `apps/web/src/features/dashboard/parent-dashboard-page.tsx` lines 131-144

```ts
queryFn: async () => {
  // ...
  setHistoryItems((prev) => historyCursor ? [...prev, ...result.items] : result.items)
  return result
}
```

Calling `setHistoryItems` inside `queryFn` is a side effect in what React Query treats as a pure data-fetching function. This causes:
- Double-appends on React Query refetches (window focus, stale refetch)
- State desync if the query is retried after failure
- The component re-renders mid-queryFn execution

**Fix:** Derive `historyItems` from query cache instead of local state. Use `useInfiniteQuery` which is designed for this exact pattern:
```ts
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ["parent", "history", selectedStudentId],
  queryFn: ({ pageParam }) => fetchHistory(pageParam),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
})
const historyItems = data?.pages.flatMap(p => p.items) ?? []
```

### M3. Score trend chart title hardcoded to "30 days"

**File:** `apps/web/src/features/dashboard/score-trend-chart.tsx` line 20

The title says "Score Trend (30 days)" but the API accepts a `days` parameter (7-90). If the default ever changes or becomes user-configurable, the title will be wrong.

### M4. `relativeTime` uses client-side `Date.now()` against server timestamps

**File:** `apps/web/src/features/dashboard/activity-feed.tsx` line 19

`Date.now()` (client clock) is compared against `item.timestamp` (server-generated `Date.now()` at submission time). Clock skew between client and server could show "just now" for items submitted hours ago or negative time. This is a common pattern and acceptable for relative times, but worth noting.

### M5. Hardcoded chart color `#06B6D4`

**File:** `apps/web/src/features/dashboard/score-trend-chart-inner.tsx` lines 48-49

Uses a hardcoded hex color instead of CSS variables like `var(--color-primary)`. This breaks if the theme changes. Other parts of the dashboard correctly use CSS variables.

**Fix:** Use `stroke="var(--color-primary)"` or a theme-aware constant.

---

## Low Priority

### L1. Duplicate interface definitions across files

`TrendPoint`, `TagPerf`, `ActivityItem`, `HistoryItem`, `ClassroomInfo`, `Student` are each defined in both the parent page and the child component files. If the API shape changes, you'd need to update 2+ files.

**Fix:** Create a shared `types.ts` in the dashboard feature folder and import from there.

### L2. `StudentSelector` returns `null` when only one student

**File:** `apps/web/src/features/dashboard/student-selector.tsx` line 17

When a parent has exactly one linked student, the selector is hidden. This is reasonable UX, but the parent has no visual indication of *which* student they're viewing. Consider showing the student name as static text instead of hiding entirely.

### L3. Missing `aria-label` on score gauge SVG

**File:** `apps/web/src/features/dashboard/score-gauge-card.tsx` line 32

The SVG gauge has no `aria-label` or `role="img"` for screen readers. The score text below is accessible, but the gauge itself is a visual-only element that should be marked as decorative or given an accessible name.

### L4. Tag performance chart uses `(props as any).payload`

**File:** `apps/web/src/features/dashboard/tag-performance-chart-inner.tsx` line 43

```ts
formatter={(value, _name, props) =>
  [`${Math.round(Number(value))}% (${(props as any).payload.totalAnswers} answers)`, "Accuracy"]
}
```

The `as any` cast bypasses type safety. Recharts types are notoriously incomplete — this is pragmatically fine but worth a `// eslint-disable-next-line` or typed wrapper.

---

## Security Assessment

| Check | Status | Notes |
|-------|--------|-------|
| Auth on all endpoints | PASS | `authMiddleware` on `/api/*`, parent role middleware on `/api/parent/*` |
| Parent-student link check | PASS | `verifyParentStudentLink` called on every student-specific endpoint |
| SQL injection | PASS | All queries use Drizzle ORM parameterized queries |
| PII exposure | PASS | Student email exposed to linked parent only (via `getLinkedStudents`) |
| IDOR (Insecure Direct Object Reference) | PASS | `studentId` from URL param is verified against parent link before data access |
| Rate limiting | NOT CHECKED | No rate limiting visible; 7 parallel queries per page load could be abused |

---

## Performance Assessment

| Check | Status | Notes |
|-------|--------|-------|
| N+1 queries | PASS (mostly) | `getStudentClassrooms` uses batch pattern. Auto-link in member routes is N+1 (see H1) |
| Missing indexes | FAIL | `parent_student` has no index on `(parent_id, student_id)` — see C2 |
| Lazy loading | PASS | Recharts loaded via `React.lazy` / `Suspense` |
| Query parallelism | PASS | React Query fires all dashboard queries in parallel |
| Unbounded results | PASS | All list endpoints have limit/pagination |

---

## Positive Observations

- Clean separation: service layer handles data, routes handle auth + validation
- Consistent auth pattern: role middleware + per-endpoint link verification is defense-in-depth
- Lazy-loaded chart components prevent large Recharts bundle from blocking initial render
- Cursor-based pagination throughout (no offset-based)
- Loading skeletons for all async sections
- `parentDetailView` field on assessments gives teachers control over what parents can see
- Empty states are well-handled with helpful guidance text

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Add `NULLIF`/`CASE` guard around division by `totalPossible` in SQL queries
2. **[CRITICAL]** Add composite index on `parent_student(parent_id, student_id)`
3. **[HIGH]** Wrap parent auto-link loop in transaction + add unique constraint + use batch insert
4. **[HIGH]** Validate `studentId` param format consistently across all route handlers
5. **[MEDIUM]** Replace `setHistoryItems` in `queryFn` with `useInfiniteQuery`
6. **[MEDIUM]** Fix assessment history sort order to DESC (newest first)
7. **[LOW]** Extract shared TypeScript interfaces to a feature-level `types.ts`
8. **[LOW]** Replace hardcoded chart color with CSS variable

---

## Unresolved Questions

1. Should there be a unique constraint on `parent_student(parent_id, student_id)` at the DB level? Currently nothing prevents duplicates except the check-then-insert pattern in the auto-link code, which has a race condition.
2. Is there a plan to add rate limiting to the parent dashboard endpoints? A single page load triggers 7 API calls per student switch.
3. The `parentDetailView = "full_detail"` expand panel shows a placeholder message. Is there a plan to actually serve per-question breakdown data to parents? If so, that will need its own access control logic.
