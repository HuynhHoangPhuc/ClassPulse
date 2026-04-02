# Code Review: Phase 3 (Assessment Bank) + Phase 4 (Classroom)

## Scope
- **Files reviewed:** 26 (7 API, 8 shared/schemas, 11 web)
- **LOC:** ~2,700 across API services/routes, shared schemas, web features
- **Focus:** Security, correctness, N+1 queries, edge cases, pattern consistency

## Overall Assessment

Solid implementation that closely follows the established question-bank patterns (thin routes, Zod validation, service layer, Drizzle ORM). Auth middleware applies globally via `/api/*`, and ownership/membership checks are present at every sensitive endpoint. Two critical issues found (N+1 in list endpoints, authz gap in `addMember`), plus several high/medium items.

---

## Critical Issues

### C1. N+1 Query in `listAssessments` -- per-assessment `fetchQuestionCount`
**File:** `apps/api/src/services/assessment-service.ts:152-159`

```ts
const withCounts = await Promise.all(
  items.map(async (a) => ({
    ...a,
    questionCount: await fetchQuestionCount(db, a.id),
  }))
);
```

Each assessment fires an individual `SELECT count(*)`. With 20 items per page this is 20 extra queries. For D1 on Cloudflare Workers this is particularly expensive since every query is a separate fetch to the D1 edge proxy.

**Fix:** Single aggregation query:
```ts
const counts = await db
  .select({
    assessmentId: assessmentQuestions.assessmentId,
    count: sql<number>`count(*)`,
  })
  .from(assessmentQuestions)
  .where(sql`${assessmentQuestions.assessmentId} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`)
  .groupBy(assessmentQuestions.assessmentId);
```

### C2. N+1 Query in `listClassrooms` -- per-classroom member count
**File:** `apps/api/src/services/classroom-service.ts:82-89`

Same pattern: `Promise.all` over individual count queries. A teacher with 15 classrooms triggers 15 count queries.

**Fix:** Same approach -- batch with `GROUP BY`.

### C3. N+1 Query in `classroom-post-routes.ts` feed enrichment
**File:** `apps/api/src/routes/classroom-post-routes.ts:60-73`

```ts
const enriched = await Promise.all(
  items.map(async (post) => {
    if (post.type === "assessment_assignment" && post.assessmentId) {
      const [assessment] = await db.select(...)...
```

Each assessment_assignment post fires its own assessment lookup. In a busy classroom, 20 posts with assignments = 20 queries.

**Fix:** Collect unique `assessmentId`s from results, batch-fetch with `IN (...)`, then join in-memory.

### C4. `addMember` allows adding a user as "teacher" role -- privilege escalation vector
**File:** `apps/api/src/services/classroom-member-service.ts:8` + `packages/shared/src/schemas/index.ts:197`

The `addMemberSchema` accepts `role: userRoleSchema` which includes `"teacher"`. The route checks `isClassroomTeacher` for the caller, but any classroom teacher can elevate any registered user to "teacher" role. More critically, the `USER_ROLES` filter in `add-member-dialog.tsx:68` filters out `"teacher"` in the UI, but the API has no such restriction.

An API-level request `POST /api/classrooms/:id/members { email: "x@y.com", role: "teacher" }` will succeed. Whether this is intentional depends on the product spec, but it bypasses the UI guard entirely.

**Recommendation:** If only classroom creators should be able to add teachers, enforce it server-side. At minimum, document the intent. If it should be blocked:
```ts
// In addMemberSchema or in the route handler:
role: z.enum(["student", "parent"])  // or validate in route
```

---

## High Priority

### H1. `deleteAssessment` does not verify teacherId ownership
**File:** `apps/api/src/services/assessment-service.ts:216-221`

```ts
export async function deleteAssessment(db: DB, id: string) {
  await db.batch([...]);
}
```

The function takes only `id`, not `teacherId`. The *route* does call `getAssessmentById(db, id, teacherId)` first (assessment-routes.ts:102-103), so ownership is checked. However, the service function's API contract is unsafe for any future caller that forgets the guard. The existing question-service pattern embeds ownership in the delete query itself.

**Recommendation:** Pass `teacherId` into `deleteAssessment` and include `eq(assessments.teacherId, teacherId)` in the WHERE clause for defense-in-depth.

### H2. `updateAssessment` does not verify ownership in its own WHERE clause
**File:** `apps/api/src/services/assessment-service.ts:182`

```ts
await db.update(assessments).set(updates).where(eq(assessments.id, id));
```

The update targets by `id` alone, relying on the route to have verified ownership beforehand. If a TOCTOU gap existed (unlikely in single-threaded Workers, but defense-in-depth matters), a different teacher's assessment could be updated.

**Fix:** Add `and(eq(assessments.id, id), eq(assessments.teacherId, teacherId))`.

### H3. `generateAssessment` does not validate that tag percent sums equal 100
**File:** `apps/api/src/services/assessment-generator-service.ts:37-38` and `packages/shared/src/schemas/index.ts:170-183`

The `generateAssessmentSchema` validates individual tag percentages (0-100) and individual complexity percentages (0-100), but does not validate that:
- Tag percentages sum to 100
- Per-tag complexity percentages sum to 100

The UI shows warnings (auto-gen-config.tsx:144, 199) but does not block submission. A request with tag percentages summing to 300% would produce more questions than `totalQuestions`, then get silently truncated at line 79 (`selected.length = input.totalQuestions`). This leads to unpredictable question distribution.

**Fix:** Add `.refine()` on the schema:
```ts
tags: z.array(tagConfigSchema).min(1)
  .refine(tags => tags.reduce((s, t) => s + t.percent, 0) === 100,
    { message: "Tag percentages must sum to 100" })
```

### H4. Classroom invite code has no collision check
**File:** `apps/api/src/services/classroom-service.ts:13-20`

`generateInviteCode()` produces a random 6-char string from a 54-char alphabet (~54^6 = ~24B combinations). Collision probability is low but non-zero. The `invite_code` column has a `UNIQUE` constraint (schema.ts:95), so a duplicate would throw a raw DB error that surfaces as an unhandled 500 via the global error middleware.

**Recommendation:** Catch the unique constraint violation and retry (or use a longer code). Low probability, but the failure mode is an ugly 500 rather than a meaningful error.

### H5. Empty `questionIds` array causes SQL syntax error in `createAssessment`
**File:** `apps/api/src/services/assessment-service.ts:38`

```ts
sql`${questions.id} IN (${sql.join(input.questionIds.map(...), sql`, `)})`
```

If `input.questionIds` is empty, `sql.join` produces empty output, generating `id IN ()` -- which is invalid SQL. The schema enforces `questionIds: z.array(z.string()).min(1)`, so this is currently guarded. But `updateAssessment` (line 193-195) has the same pattern, and `input.questionIds` there could theoretically be set to an empty array since the update schema allows `min(1)` on the optional array. If the schema ever loosened, this would break.

**Recommendation:** Add an early return/guard for empty arrays at the service level.

---

## Medium Priority

### M1. Preview endpoint leaks `complexity` and `complexityType` to students
**File:** `apps/api/src/routes/assessment-routes.ts:124-130`

The preview strips `isCorrect` from options and removes `explanation`, but includes `complexity` and `complexityType`. Whether this is intended depends on the product, but complexity metadata could let students estimate difficulty and game their time allocation.

### M2. Classroom detail page uses `classroom.teacherId === userId` for teacher check
**File:** `apps/web/src/features/classrooms/classroom-detail-page.tsx:53`

```ts
const isTeacher = classroom.teacherId === userId;
```

This checks the *creator* (teacherId on the classroom table), not the *membership role*. If a second teacher is added to the classroom, they would not get teacher UI capabilities (settings tab hidden, post composer hidden). The API uses `isClassroomTeacher` which correctly checks the membership table.

**Fix:** Use the `userRole` field returned from `listClassrooms` (which comes from `classroomMembers.role`), or fetch the user's role for this classroom.

### M3. Feed pagination state accumulation in `classroom-feed-tab.tsx`
**File:** `apps/web/src/features/classrooms/classroom-feed-tab.tsx:30-44`

```ts
const [allPosts, setAllPosts] = useState<FeedPost[]>([]);
const posts: FeedPost[] = cursor ? [...allPosts, ...(data?.items ?? [])] : (data?.items ?? []);
```

This accumulates all pages in state. Combined with React Query caching, pages are duplicated in memory. For long feeds, this could become a memory issue. Also, the query key includes `cursor`, so each page creates a separate cache entry. If the user navigates away and back, only the first page loads (cursor is reset), but old paginated cache entries linger.

Same pattern in `assessment-list-page.tsx`.

### M4. `handleAddMember` and `handleRemoveMember` lack error handling
**File:** `apps/web/src/features/classrooms/classroom-members-tab.tsx:51-66`

These are raw async functions called from click handlers with no try/catch. If the API returns an error (user not found, duplicate member), the error silently disappears. The `AddMemberDialog` has its own error handling, but `handleAddMember` re-throws to the dialog. However, `handleRemoveMember` has no error boundary at all.

**Fix:** Add try/catch or use `useMutation` for both operations (consistent with patterns elsewhere).

### M5. Settings tab uses stale props for invite code after regeneration
**File:** `apps/web/src/features/classrooms/classroom-settings-tab.tsx:15, 53`

The `inviteCode` is passed as a prop from the parent's query cache. After `regenMutation` succeeds, it invalidates the parent query, which re-fetches. But `handleCopy()` on line 53 reads from the *prop* `inviteCode`, not from the mutation response. Between the invalidation and the refetch completing, copying could give the old code.

### M6. `classroomId` not validated as a path parameter
All classroom routes accept `classroomId` from URL params without format validation. If `classroomId` is a garbage string, the DB query returns nothing, which is fine (404). But there is no length/format guard, allowing very long strings to hit the DB. Minor, but a defense-in-depth opportunity.

---

## Edge Cases Found by Scouting

1. **Auto-gen with 0% tags:** User can add a tag with 0% allocation. The algorithm processes it, computes `tagCount = 0`, skips all complexities, contributing nothing but adding visual noise to shortfall reporting.

2. **Duplicate question IDs in `createAssessment`:** The schema `z.array(z.string()).min(1)` does not enforce uniqueness. Passing `["q1", "q1"]` would insert duplicate rows in `assessment_questions`, violating the composite primary key and causing a DB error. Add `.refine(ids => new Set(ids).size === ids.length)` to the schema.

3. **Classroom delete cascading:** `deleteClassroom` deletes members and the classroom, but does NOT delete associated posts, comments, or assessment assignments referencing this classroom. Posts have a foreign key to `classrooms.id`, so D1/SQLite would raise a FK constraint error (if enabled) or leave orphaned records.

4. **`Math.random()` for invite codes in Workers:** `Math.random()` in Cloudflare Workers may have lower entropy than expected. Consider using `crypto.getRandomValues()` for the invite code generator.

---

## Positive Observations

- Consistent application of the thin-route/service-layer pattern across both features
- Zod schemas shared between API and frontend validation
- Proper cursor-based pagination instead of offset-based
- Membership checks (`isClassroomMember`, `isClassroomTeacher`) applied at every classroom endpoint
- Assessment preview endpoint correctly strips `isCorrect` from options
- Wizard state persistence to `sessionStorage` for recovery on refresh
- Debounced search in both question picker and assessment list
- Proper empty state and loading skeleton components throughout

---

## Recommended Actions (Priority Order)

1. **[Critical]** Fix N+1 queries in `listAssessments`, `listClassrooms`, and feed enrichment -- batch with GROUP BY / IN clause
2. **[Critical]** Decide and enforce server-side policy on `addMember` teacher-role escalation
3. **[High]** Add `teacherId` to `deleteAssessment` and `updateAssessment` WHERE clauses
4. **[High]** Add Zod refinement for tag/complexity percent sums in `generateAssessmentSchema`
5. **[High]** Add uniqueness refinement to `questionIds` arrays in assessment schemas
6. **[Medium]** Fix `isTeacher` check in `classroom-detail-page.tsx` to use membership role, not `teacherId`
7. **[Medium]** Add error handling to `handleRemoveMember` in members tab
8. **[Medium]** Handle classroom deletion cascading (delete or reassign posts/comments)
9. **[Low]** Use `crypto.getRandomValues()` for invite code generation in Workers environment

## Unresolved Questions

- Is teacher-role assignment via `addMember` intentional for multi-teacher classrooms? Needs product clarification.
- Should `complexity`/`complexityType` be visible in student preview? Product decision.
- Should classroom deletion be a hard delete or soft delete (archive)?
