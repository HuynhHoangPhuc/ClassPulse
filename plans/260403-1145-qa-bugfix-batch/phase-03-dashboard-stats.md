# Phase 3 — Dashboard Stats API Integration

## Priority: HIGH
## Status: Complete
## Effort: 2h
## Depends On: Phase 1 (JWT fix — API calls need working auth)

## Context

- Dashboard shows 4 KPI cards with hardcoded "—" values
- No API endpoint exists for dashboard stats
- No API call made from dashboard component
- Teacher KPIs: Total Students, Active Assessments, Questions Bank, Avg. Score

## Root Cause

Dashboard was implemented as placeholder (Phase 1). Stats API and integration never built.

## Requirements

### Functional
- API endpoint: `GET /api/dashboard/stats` returns aggregated stats for current teacher
- Stats to compute:
  - **Total Students**: COUNT DISTINCT students across all teacher's classrooms
  - **Active Assessments**: COUNT assessments with active assignment posts (dueDate > now)
  - **Questions Bank**: COUNT questions authored by teacher
  - **Avg. Score**: AVG score from all attempts on teacher's assessments (last 30 days)
- Frontend fetches and displays real numbers

### Non-functional
- D1/SQLite query should be efficient (use indexes)
- Loading skeleton while fetching

## Related Code Files

### Files to create:
- `apps/api/src/routes/dashboard-routes.ts` — Dashboard stats endpoint

### Files to modify:
- `apps/api/src/index.ts` — Register dashboard routes
- `apps/web/src/routes/dashboard-route.tsx` — Fetch and display real stats

### Files to read for context:
- `apps/api/src/db/schema.ts` — Table definitions for queries
- `apps/api/src/routes/classroom-routes.ts` — Pattern for route handlers

## Implementation Steps

### Step 1: Create dashboard stats API endpoint

**File:** `apps/api/src/routes/dashboard-routes.ts`

```typescript
// GET /api/dashboard/stats
// Returns: { totalStudents, activeAssessments, questionsBank, avgScore }
```

Queries:
1. Total students: JOIN classrooms → classroomMembers WHERE teacher = userId AND member role = student
2. Active assessments: COUNT assessments WHERE creator = userId
3. Questions bank: COUNT questions WHERE creator = userId
4. Avg score: AVG(assessmentAttempts.score) WHERE assessment.creatorId = userId AND last 30 days

### Step 2: Register route in API index

**File:** `apps/api/src/index.ts`

- Import `dashboardRoutes`
- Add `.route("/api/dashboard", dashboardRoutes)`

### Step 3: Update dashboard page to fetch stats

**File:** `apps/web/src/routes/dashboard-route.tsx`

- Replace hardcoded KPI array with `useQuery` fetching `/api/dashboard/stats`
- Show loading skeleton during fetch
- Format numbers (e.g., avg score as percentage)
- Handle empty state gracefully (0 instead of "—")

## Todo List

- [x] Create `dashboard-routes.ts` with stats aggregation queries
- [x] Register dashboard routes in `index.ts`
- [x] Update `dashboard-route.tsx` to fetch and display real stats
- [x] Handle loading and error states

## Success Criteria

- Dashboard shows real numbers for all 4 KPI cards
- Numbers update when questions/classrooms/assessments are created
- Loading skeleton shows while fetching
