# Phase 8: Parent Dashboard

## Context

- [Phase 5 Assessment Taking](./phase-05-assessment-taking.md) — attempt data, scores
- [Design Guidelines §6.7](../../docs/design-guidelines.md) — Parent Dashboard page design

## Overview

- **Priority**: P2
- **Status**: Complete
- **Effort**: 8h
- **Depends On**: Phase 5
- **Description**: Parent-student linking, student activity feed, assessment metrics (avg score, trend, per-tag performance), classroom overview. Charts with Recharts.

## Key Insights

- Parent can have multiple students (parent_student table)
- All data is read-only for parents — they observe, not interact
- Metrics computed server-side (D1 aggregation queries) to stay within 10ms CPU
- Charts: Recharts (lightweight, React-native, good for simple dashboards)
- Per-tag performance requires joining attempts → assessment_questions → question_tags

## Requirements

### Functional
- Parent-student linking (teacher sets up in classroom member management)
- Student selector dropdown (if parent has multiple children)
- Overall score KPI (gauge: average across all assessments)
- Score trend (line chart: scores over time)
- Per-tag performance (horizontal bar chart: avg score per tag)
- Recent activity feed (assessments taken, classrooms joined)
- Assessment history table (expandable per-question detail — controlled by teacher)
- Classroom overview cards (teacher name, completion rate)
- **Validated**: Teacher controls visibility per assessment. Assessment has `parent_detail_view` field: `scores_only | full_detail`. Parents see per-question breakdown only if teacher allows.

### Non-Functional
- Dashboard loads in < 1 second
- Metrics pre-computed or efficiently queried (no N+1)
- Charts responsive (simplify on mobile)

## Architecture

### API Routes

```
GET  /api/parent/students                     — List linked students
GET  /api/parent/students/:studentId/overview — KPIs + metrics
GET  /api/parent/students/:studentId/trend    — Score trend data (30 days)
GET  /api/parent/students/:studentId/tags     — Per-tag performance
GET  /api/parent/students/:studentId/activity — Recent activity feed
GET  /api/parent/students/:studentId/history  — Assessment history (paginated)
GET  /api/parent/students/:studentId/classrooms — Classroom overview
```

### Data Aggregation Queries

```sql
-- Overall average score
SELECT AVG(score / total_possible * 100) as avg_percent
FROM assessment_attempts
WHERE student_id = ? AND status = 'submitted'

-- Score trend (last 30 days)
SELECT DATE(submitted_at) as date, AVG(score / total_possible * 100) as avg
FROM assessment_attempts
WHERE student_id = ? AND submitted_at > datetime('now', '-30 days')
GROUP BY DATE(submitted_at)

-- Per-tag performance
SELECT t.name, t.color, AVG(CASE WHEN aa.is_correct THEN 1 ELSE 0 END) * 100 as accuracy
FROM attempt_answers aa
JOIN assessment_questions aq ON aa.question_id = aq.question_id
JOIN question_tags qt ON aa.question_id = qt.question_id
JOIN tags t ON qt.tag_id = t.id
JOIN assessment_attempts at ON aa.attempt_id = at.id
WHERE at.student_id = ?
GROUP BY t.id
```

## Related Code Files

### Files to Create
- `apps/api/src/routes/parent-routes.ts` — Parent dashboard endpoints
- `apps/api/src/services/parent-dashboard-service.ts` — Aggregation queries
- `apps/web/src/features/dashboard/` — Parent dashboard feature
  - `parent-dashboard-page.tsx` — Main dashboard layout
  - `student-selector.tsx` — Dropdown to select child
  - `score-gauge-card.tsx` — Overall score KPI with gauge
  - `score-trend-chart.tsx` — Line chart (30 days)
  - `tag-performance-chart.tsx` — Horizontal bar chart
  - `activity-feed.tsx` — Recent activity list
  - `assessment-history-table.tsx` — Paginated table with expand
  - `classroom-overview-card.tsx` — Classroom summary card
- `packages/shared/src/schemas/parent-schemas.ts`

### Files to Modify
- `apps/web/src/routes/_authed/dashboard.tsx` — Route parent role to parent dashboard
- `apps/api/src/routes/classroom-member-routes.ts` — Auto-create parent_student link when parent added to classroom

## Implementation Steps

### 1. Parent-Student Linking (1h)

1. When teacher adds parent to classroom: check if students in same classroom share parent's email in Clerk metadata → auto-link
2. Simpler approach: when adding parent to classroom, show dialog "Link to which students?" with student member list
3. Insert `parent_student` record
4. `GET /api/parent/students`: query parent_student → users, return student list

### 2. Aggregation API (3h)

1. **Overview endpoint**: returns all KPIs in single response
   - Average score percentage (across all submitted attempts)
   - Total assessments taken
   - Total classrooms
   - Assessments this week
2. **Trend endpoint**: daily average scores for last 30 days
3. **Tag performance endpoint**: accuracy per tag (joined from attempts → questions → tags)
4. **Activity endpoint**: recent events (assessment submitted, classroom joined) — query attempts + classroom_members ordered by date
5. **History endpoint**: paginated list of assessment attempts with score, time taken, classroom name
6. **Classrooms endpoint**: classrooms where student is member, with teacher name and completion rate

### 3. Dashboard Page Layout (2h)

1. Student selector at top (if multiple children)
2. Bento grid layout per design guidelines:
   - Row 1: KPI cards (Overall Score gauge, Assessments Taken, Classrooms, This Week)
   - Row 2: Score Trend chart (2-col) + Tag Performance chart (2-col)
   - Row 3: Activity Feed (1-col) + Assessment History (3-col)
   - Row 4: Classroom Overview cards
3. Each KPI card: metric number (32px Outfit), trend badge (+/- vs last period), sparkline

### 4. Charts (1.5h)

1. **Score Gauge**: circular gauge showing avg score vs 100%. Color: green (>80%), amber (50-80%), red (<50%). Text: score percentage in center.
   - Use custom SVG or Recharts PieChart (180 degree)
2. **Score Trend**: `LineChart` with:
   - Student line: cyan (#06B6D4)
   - X-axis: dates, Y-axis: 0-100%
   - Tooltip on hover/tap
   - Responsive: fewer ticks on mobile
3. **Tag Performance**: `BarChart` horizontal with:
   - Bar color: tag's own color
   - Label: tag name + accuracy %
   - Sorted by accuracy descending

### 5. Activity & History (0.5h)

1. **Activity feed**: list of recent events with icon + description + timestamp
   - "Completed Math Quiz 3 — scored 85%" + "2 days ago"
   - "Joined Classroom: Physics 101" + "1 week ago"
2. **Assessment history table**: sortable by date, score, classroom
   - Expandable row: per-question breakdown (correct/incorrect/unanswered)

## Todo

- [x] Implement parent-student linking logic
- [x] Create parent dashboard aggregation API endpoints
- [x] Build student selector component
- [x] Build KPI cards with gauge, trend badges
- [x] Build score trend line chart (Recharts)
- [x] Build tag performance bar chart (Recharts)
- [x] Build activity feed component
- [x] Build assessment history table with expandable rows
- [x] Build classroom overview cards
- [x] Wire parent role dashboard route
- [x] Add loading skeletons for charts
- [x] Add empty states ("No assessments taken yet")
- [x] Test responsive layout (mobile bento → single column)

## Success Criteria

- Parent sees linked students, can switch between them
- Overall score gauge renders correctly
- Score trend shows last 30 days data
- Per-tag performance shows accuracy per category
- Activity feed shows recent events
- Assessment history is paginated and expandable
- Dashboard loads in < 1 second
- Charts responsive on mobile
- Empty states displayed when no data

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Complex D1 aggregation queries hitting CPU limit | Medium | Pre-test query plans; denormalize if needed |
| Per-tag performance join is 4 tables deep | Medium | Cache results, refresh on new attempt |
| Recharts bundle size | Low | Dynamic import for chart components |
| Parent with no linked students | Low | Show "No students linked" with guidance |

## Security

- Parent can ONLY view their linked students' data
- All parent endpoints validate parent_student relationship
- Cannot view other students' data even if in same classroom
- Read-only: no mutations from parent role
