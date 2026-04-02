# Code Review: Phase 5 -- Assessment Taking

**Score: 6.5/10**
**Verdict: Conditional pass -- 2 critical, 3 high-priority issues must be addressed before merge**

## Scope

- **Files reviewed**: 18 (6 backend, 1 shared, 10 frontend, 1 migration)
- **LOC**: ~1500 new
- **Focus**: Security, correctness, data integrity, consistency with existing patterns

---

## Critical Issues

### C1. Missing DB Migration for `tab_switch_count` and `question_order` columns

**File**: `apps/api/src/db/schema.ts:173-174` vs `apps/api/src/db/migrations/0000_quick_shatterstar.sql`

The schema defines `tabSwitchCount` and `questionOrder` on `assessmentAttempts`, but the initial migration SQL does not include these columns. The migration snapshot JSON also lacks them. Any fresh D1 deployment will fail on insert because the columns don't exist.

**Fix**: Run `drizzle-kit generate` to produce a new migration (e.g., `0001_*.sql`) adding these two columns. Alternatively, if this is a fresh project with no production data, regenerate `0000` from scratch.

### C2. Race condition: Double submit via concurrent requests

**File**: `apps/api/src/services/attempt-service.ts:211-217`

`submitAttempt` checks `attempt.status !== "in_progress"` then updates to `"submitted"` -- but these are two separate queries with no transactional locking. Two concurrent `POST /:id/submit` calls (network retry, double-click, client bug) can both pass the status check and calculate/write scores twice.

The second execution re-calculates and overwrites `score`, `submittedAt`, etc. While the final state may be consistent, it's wasteful and could cause confusing audit trails.

**Fix**: Use `db.batch()` or a CAS-style update:
```ts
const result = await db.update(assessmentAttempts)
  .set({ status: "submitted", submittedAt: now, ... })
  .where(and(
    eq(assessmentAttempts.id, attemptId),
    eq(assessmentAttempts.studentId, studentId),
    eq(assessmentAttempts.status, "in_progress") // atomic guard
  ));
// Check rows affected: if 0, attempt was already submitted
```

---

## High Priority

### H1. `selectedOptionId` not validated against actual question options

**File**: `apps/api/src/services/attempt-service.ts:150-201`

`saveAnswer` accepts any string as `selectedOptionId`. It checks correctness against the question's options, but does NOT reject an ID that doesn't match any option. A malformed or tampered request saves a nonsense option ID, which silently scores as incorrect.

While not a security vulnerability per se, it pollutes data integrity. A student with a buggy client or a bad actor can submit garbage option IDs that look like valid answers in the DB.

**Fix**: After parsing options at line 183, add:
```ts
const validIds = new Set(opts.map(o => o.id));
if (!validIds.has(selectedOptionId)) throw new Error("Invalid option");
```

### H2. Answer save failure silently dropped on frontend (no revert)

**File**: `apps/web/src/features/assessments/assessment-taking-page.tsx:134-139`

The `.catch(() => {})` swallows all errors from the save-answer API call. The comment says "Revert on failure" but no revert is implemented. If the backend rejects the save (e.g., attempt already submitted, network error), the student sees their selection as saved but it's lost.

**Fix**: Implement actual revert in the catch handler:
```ts
.catch(() => {
  // Revert optimistic update
  setAnswers((prev) => {
    const next = { ...prev };
    delete next[qid];
    return next;
  });
});
```
Consider also displaying a toast/notification for transient errors.

### H3. Missing composite index on `(classroomId, assessmentId)` for submissions query

**File**: `apps/api/src/db/schema.ts:177-179`

The `listSubmissions` query filters by `classroomId AND assessmentId` but there's no composite index for this. The existing indexes are only on `studentId` and `assessmentId` individually. The schema also defines indexes that are missing from the migration SQL entirely (see C1 -- all indexes on `assessmentAttempts`, `posts`, `comments`, `notifications` are absent from the migration).

**Fix**: Add a composite index to the schema:
```ts
classroomAssessmentIdx: index("attempts_classroom_assessment_idx")
  .on(t.classroomId, t.assessmentId),
```
And regenerate migration.

---

## Medium Priority

### M1. `getAttemptState` crash on missing question in map

**File**: `apps/api/src/services/attempt-query-service.ts:73`

`questionMap.get(qid)!` uses non-null assertion. If a question was deleted after the attempt started (e.g., teacher edits assessment), this throws an unhandled runtime error. Same issue at `attempt-service.ts:118`.

**Fix**: Add a null guard:
```ts
const q = questionMap.get(qid);
if (!q) continue; // skip deleted questions gracefully
```

### M2. Tab switch fires on returning to tab, not on leaving

**File**: `apps/web/src/features/assessments/assessment-taking-page.tsx:114-116`

The visibility handler fires when `visibilityState === "visible"`, meaning it records a tab-switch when the student *returns*. A student who leaves and never comes back won't have it recorded. More importantly, the event semantics are inverted from what teachers expect -- they want to know when the student left, not when they came back.

This is still a reasonable proxy (every return implies a departure), but it misses the last departure if auto-submitted. Consider also firing on `hidden` state or documenting this limitation.

### M3. No attempt resumption flow

**File**: `apps/web/src/features/assessments/assessment-taking-page.tsx:96-99`

When a student already has an in-progress attempt, the `startAttempt` API returns an error. The frontend catches this but shows a generic error message with "Please refresh to resume." But refreshing just calls `startAttempt` again (same error). There's no actual resume mechanism.

**Fix**: The frontend `init()` should catch the "in-progress" error and then call `GET /api/attempts/:id` to fetch existing state. This requires knowing the attempt ID. Options:
1. Add a query endpoint: `GET /api/attempts?assessmentId=X&classroomId=Y&status=in_progress`
2. Return the existing attempt ID in the `startAttempt` error response

### M4. Teacher can view in-progress attempt details

**File**: `apps/api/src/routes/attempt-routes.ts:87-96`

`GET /:id/detail` calls `getSubmissionDetail` which does not filter by status. A teacher can view an in-progress attempt's details. While this may be intentional for monitoring, it also shows answer correctness (`isCorrect` field) for questions not yet submitted, which could leak information if the teacher and student are colluding.

### M5. `getAttemptResults` allows only the student who took the attempt

**File**: `apps/api/src/services/attempt-query-service.ts:113`

The `getAttemptResults` query filters by `studentId = userId`. This means a teacher cannot use this endpoint to see the student's result view. This is correct for the student flow, but means the teacher must use `/:id/detail` instead. Just noting for completeness -- the separation is intentional.

---

## Low Priority

### L1. `isAutoSubmitted` parameter mutation

**File**: `apps/api/src/services/attempt-service.ts:209,235`

The `isAutoSubmitted` parameter is declared without `const` and gets reassigned at line 235. While functionally correct, mutating function parameters is a code smell. Use a separate local variable.

### L2. `tabSwitchCount` in `getAttemptState` leaks anti-cheat info to student

**File**: `apps/api/src/services/attempt-query-service.ts:102`

The student-facing `getAttemptState` response includes `tabSwitchCount`. This tells the student exactly how many tab switches the system has recorded, allowing them to calibrate evasion. Consider omitting this from the student view.

### L3. No pagination on teacher submissions page

**File**: `apps/web/src/features/assessments/teacher-submissions-page.tsx`

The query fetches only the first page. `nextCursor` is returned by the API but never used. Should implement infinite scroll or a "Load More" button.

### L4. `assessmentTitle` not returned by `getAttemptState`

**File**: `apps/api/src/services/attempt-query-service.ts:93-106`

The returned object includes `assessmentTitle` which is good. However, `assessmentDescription` is not included (it is in `startAttempt`). Minor inconsistency.

---

## Positive Observations

- **Correct answer stripping**: `startAttempt` and `getAttemptState` properly strip `isCorrect` from options sent to students. This is the most critical security concern and it's handled correctly.
- **Seeded shuffle**: Using a deterministic seeded shuffle with the attempt ID ensures consistent question order on resume. Good design.
- **Server-side time validation**: The 5-second grace period for submission after time limit is practical and handles clock drift/network latency well.
- **Upsert for answers**: Using `onConflictDoUpdate` for answer saves prevents duplicate inserts -- correct approach.
- **Score clamping**: `Math.max(0, score)` prevents negative total scores from penalties -- good edge case handling.
- **Teacher auth on submissions**: Both submission listing and detail endpoints properly check `isClassroomTeacher`. Good.
- **Consistent patterns**: Route structure, error handling, and Zod validation follow established codebase conventions well.

---

## Summary of Required Actions

| Priority | Issue | Effort |
|----------|-------|--------|
| Critical | C1: Generate migration for new columns | Small |
| Critical | C2: Atomic submit guard | Small |
| High | H1: Validate option ID | Small |
| High | H2: Implement answer revert | Small |
| High | H3: Add composite index | Small |
| Medium | M1: Null guard on question map | Small |
| Medium | M2: Tab switch semantics | Small |
| Medium | M3: Attempt resume flow | Medium |

---

## Unresolved Questions

1. Is there intentional support for multiple completed attempts per student per assessment? The code only blocks `in_progress` duplicates but allows multiple `submitted` attempts. Clarify if re-takes are a feature.
2. Should teachers be able to view in-progress attempts (M4), or should that be gated?
3. Is `tabSwitchCount` visibility to students intentional or a leak (L2)?
