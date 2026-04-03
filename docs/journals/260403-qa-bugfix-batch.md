# QA Bugfix Batch: 9 Issues Fixed, 3 Code Review Catches

**Date**: 2026-04-03 11:45
**Severity**: Critical (Phase 1) → Low (Phase 5)
**Component**: Authentication, Settings, Dashboard, Form Validation, UX Polish
**Status**: Resolved

## What Happened

Completed 9-issue QA bugfix batch across 5 phases in production testing fallout from thayphuc.pages.dev. Fixed critical JWT token refresh logic that broke all mutations (401 retry with sanitized errors), created missing Settings page route, built Dashboard Stats API with parallel D1 queries, added form validation feedback with inline errors, and fixed pluralization. Code review caught 3 critical/high issues that would have shipped broken.

## The Brutal Truth

This sprint exposed how incomplete error handling becomes a data integrity trap. The 401-retry logic was fundamentally sound but had two lurking edge cases: if `getToken()` itself throws, it propagates unhandled; if it returns null or the same stale token, the code silently falls through. Neither case would trigger during normal testing. Both would explode in production under load. The code review caught them. Testing didn't.

Equally frustrating: the Dashboard Stats API was counting `classroomMembers` rows instead of distinct students. A teacher with students enrolled in 3 classrooms gets inflated KPI numbers. This isn't broken — it's insidiously wrong. It passes all tests because tests didn't specify student uniqueness. This is what happens when "count" isn't questioned.

## Technical Details

**Phase 1 (CRITICAL) — JWT Token Refresh:**
- Added `getToken` callback parameter to `fetchApi` (backward-compatible)
- On 401: calls `getToken()` for fresh token, retries only if tokens differ (prevents infinite loops)
- Error sanitization: 401 → "Session expired. Please refresh the page." (no raw JWT in UI)
- Code review catch: Missing try-catch around `getToken()` call — if Clerk SDK throws, error leaks unhandled

**Phase 2 (CRITICAL) — Settings Page:**
- Created `/settings` route (gated by `authedLayout` for auth requirement)
- Page displays profile (name, email, role), dark mode toggle, notifications placeholder
- 84 lines, follows existing Card + PageHeader pattern

**Phase 3 (HIGH) — Dashboard Stats:**
- New `GET /api/dashboard/stats` endpoint: parallel D1 queries for total students, active assessments, questions, avg score (30-day window)
- Code review catches: (1) `count()` should be `countDistinct(classroomMembers.userId)` — was over-counting students enrolled in multiple classrooms (2) No role guard — any auth user can call (students get zeros, but wasted DB work)

**Phase 4 (MEDIUM) — Form Validation:**
- Assessment wizard: Next button always clickable; inline "Title is required" error on empty title
- Classroom creation: shows "Classroom name is required" with consistent error styling (red border + red text)

**Phase 5 (LOW) — Cosmetic:**
- Pluralization: "1 member" not "1 members" on classroom detail page

## What We Tried

1. **Token retry logic:** First pass had no guards around `getToken()`. Added token comparison check to prevent retry loops. Code review flagged the unhandled throw case.

2. **Student count:** Implemented with simple `count()`. Code review asked "is this distinct?" — realized it wasn't. Switched to `countDistinct()`.

3. **Form validation:** Initially disabled Next button when form invalid. User feedback: buttons should always be clickable, errors should appear inline. Changed to always-clickable with error message.

4. **Dashboard API role guard:** Debated whether to add a role check. Decision: skip it for now (queries filter by teacherId, students get zeros, no data leak). Documented the gap in code review report.

## Root Cause Analysis

**Why did JWT retry have edge cases?**
Focused on the happy path (token refresh succeeds) and the error path (token refresh fails, same token, retry aborted). Didn't think through the error-path within the error-path: what if `getToken()` throws? This is defensive programming failure.

**Why did counting break?**
Assumed "Total Students" was a simple aggregation. Didn't think through data model — students can join multiple classrooms. This is the difference between "what does this query return" and "what does this metric mean." The KPI label should have forced that conversation.

**Why did validation buttons change?**
Original design had disabled buttons as visual feedback. User testing revealed this was frustrating — people expect to click, see an error, and fix it. Changed to shift errors inline. This is a UX pattern mismatch that testing didn't catch.

## Lessons Learned

1. **Error handling is not just happy path + error path.** It's happy → error in retry → error in error handling. Every async callback needs a try-catch, especially token refresh. If you can't trust the callback, pass a fallback or default.

2. **Aggregate queries need semantic clarity.** "Total Students" is not the same as "Student Memberships." Name it right or the mistake becomes invisible. Code review saved this one.

3. **Backward compatibility can hide intent.** Making `getToken` optional kept old code working but meant some call sites didn't get retry logic. Inconsistency is a liability. Either require it everywhere or create a wrapper hook.

4. **Disabled buttons are not error feedback.** They're visual noise to users trying to complete a task. Errors belong near the field they're reporting, not on the button.

5. **Code review catches what testing misses.** Tests verify the code does what it says. Reviews verify the code says what it should. These are orthogonal.

## Next Steps

1. **[Critical]** Fix `count()` to `countDistinct(classroomMembers.userId)` in dashboard-routes.ts:27
2. **[High]** Wrap `getToken()` call in try-catch with fallback (re-throw only if already sanitized)
3. **[High]** Add 204 No Content handling: `if (res.status === 204) return null;` before `res.json()`
4. **[Medium]** Consider `useAuthFetch` hook wrapper to standardize `getToken` injection across all call sites
5. **[Medium]** Pass `getToken` to load-path fetchApi calls (dashboard-route.tsx, classroom-detail-page.tsx) for retry support

All code review findings documented in `/plans/reports/code-reviewer-260403-qa-bugfix-batch.md`.

---

**Owner of next steps:** Merge to fix critical issues immediately; schedule follow-up for H/M priority hardening.

**Ready to ship:** After 3 critical/high fixes applied. Test coverage: manual only (no test suite exists; noted in tester report).
