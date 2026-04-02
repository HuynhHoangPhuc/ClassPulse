# Phase 5: Assessment Taking

## Context

- [Phase 3 Assessment Bank](./phase-03-assessment-bank.md) — assessment data
- [Phase 4 Classroom](./phase-04-classroom.md) — assessment assignment
- [Design Guidelines §6.6](../../docs/design-guidelines.md) — Assessment Taking page

## Overview

- **Priority**: P1
- **Status**: Complete
- **Effort**: 10h (completed)
- **Depends On**: Phase 3, Phase 4
- **Description**: Student takes timed assessments in full-screen focused view. Timer with auto-submit, answer recording with auto-save, anti-cheating basics, result calculation, teacher submission viewer.

## Key Insights

- Timer MUST be server-validated — start time stored in D1, auto-submit enforced by API
- Answers auto-saved on each selection (no "save" button) to prevent data loss
- Tab visibility detection is basic anti-cheat (log count, visible to teacher)
- Question order may be shuffled per student (seed = attempt_id for consistency)
- Results shown based on assessment's `show_results` setting

## Requirements

### Functional
- Student starts attempt from classroom assessment post
- Full-screen view with countdown timer
- Navigate between questions (prev/next + question grid)
- Select one option per question (radio behavior)
- Auto-save answers on each selection
- Flag questions for review
- Manual submit button
- Auto-submit when timer expires
- Result page: score, correct/incorrect per question (if show_results allows)
- Teacher: view all submissions for an assessment in a classroom

### Non-Functional
- Answer save < 200ms (no perceived lag)
- Timer accuracy: synced with server, not just client clock
- Works offline briefly (answers queued, synced on reconnect)
- Full-screen mode: no sidebar, no distractions

## Architecture

### API Routes

```
POST   /api/attempts                        — Start attempt (creates record, returns questions)
GET    /api/attempts/:id                    — Get attempt state (questions, answers, time remaining)
PUT    /api/attempts/:id/answers/:questionId — Save single answer
POST   /api/attempts/:id/submit             — Submit attempt (calculate score)
GET    /api/attempts/:id/results            — Get results (respects show_results setting)

GET    /api/classrooms/:id/assessments/:assessmentId/submissions — Teacher: list submissions
GET    /api/attempts/:id/detail             — Teacher: detailed submission view
```

### Timer Architecture

```
Start Attempt:
  API stores started_at in D1
  Returns: questions + server_time + time_remaining_seconds

Client Timer:
  countdown = time_remaining - (Date.now() - response_received_at)
  Ticks every second (display only)
  At 0: trigger auto-submit

Submit (manual or auto):
  API checks: submitted_at - started_at <= time_limit + 5s grace
  If over: reject (already expired)
  If under: accept, calculate score

Server Auto-Submit (safety net — VALIDATED):
  On any API call for this attempt after timer expired:
    Auto-submit with whatever answers exist in DB
  Also: periodic check via Cron Trigger (every 5 min):
    SELECT attempts WHERE status='in_progress' AND started_at + time_limit < now()
    Auto-submit each with is_auto_submitted = true
  This handles offline students — last saved answers count.
```

### Score Calculation

```typescript
function calculateScore(attempt, assessment, answers) {
  let score = 0
  let totalPossible = 0
  
  for (const aq of assessmentQuestions) {
    const answerScore = aq.custom_score ?? assessment.score_per_correct
    const answerPenalty = aq.custom_penalty ?? assessment.penalty_per_incorrect
    totalPossible += answerScore
    
    const answer = answers.find(a => a.questionId === aq.questionId)
    if (!answer) continue // unanswered = 0
    
    if (answer.is_correct) score += answerScore
    else score -= answerPenalty
  }
  
  return { score: Math.max(0, score), totalPossible }
}
```

## Related Code Files

### Files to Create
- `apps/api/src/routes/attempt-routes.ts` — Attempt endpoints
- `apps/api/src/services/attempt-service.ts` — Start, save answer, submit logic
- `apps/api/src/services/score-calculator-service.ts` — Score calculation
- `apps/web/src/features/assessments/` — (extend existing module)
  - `assessment-taking-page.tsx` — Full-screen assessment view
  - `assessment-timer.tsx` — Countdown timer component
  - `assessment-question-view.tsx` — Single question display
  - `assessment-question-grid.tsx` — Question navigation grid
  - `assessment-option-card.tsx` — Selectable option card
  - `assessment-results-page.tsx` — Results display
  - `assessment-auto-submit-dialog.tsx` — Time's up modal
  - `teacher-submissions-page.tsx` — Teacher: view submissions
  - `teacher-submission-detail-page.tsx` — Teacher: per-student detail
- `packages/shared/src/schemas/attempt-schemas.ts`

## Implementation Steps

### 1. Attempt API (3h)

1. **Start attempt**: validate student is classroom member, assessment is assigned, no existing in_progress attempt. Create `assessment_attempts` record with `started_at = now()`. If shuffle enabled, generate shuffled question order (seeded by attempt_id). Return questions (without correct answers) + time_remaining.
2. **Save answer**: upsert `attempt_answers` record. Validate question belongs to assessment. Don't reveal correctness.
3. **Submit**: validate time limit. Set `submitted_at`, calculate score via score calculator. Update status to `submitted`.
4. **Auto-submit**: same as submit but set `is_auto_submitted = true`.
5. **Results**: return score + per-question breakdown. If `show_results = never`, return only total score. If `after_due`, check due date.

### 2. Timer Component (1h)

1. Receives `time_remaining_seconds` from API + `server_time`
2. Calculates local deadline: `performance.now() + remaining * 1000`
3. Updates display every second using `requestAnimationFrame` or `setInterval`
4. Visual states per design guidelines:
   - Normal: default foreground color
   - < 5 min: warning color, gentle pulse animation
   - < 1 min: destructive color, faster pulse
5. At 0: show auto-submit dialog, call submit API

### 3. Assessment Taking Page (3h)

1. Full-screen layout (no sidebar, minimal header):
   - Top bar: title, timer, progress "X of N", submit button
   - Main: question content (markdown rendered) + option cards
   - Bottom/side: question grid for navigation
2. Option cards: selectable with radio behavior
   - Unselected: outline border
   - Selected: primary bg 10%, primary border, check icon
3. Question grid: numbered circles showing answered/unanswered/current/flagged states
4. Flag for review toggle per question
5. Navigation: Previous / Next buttons
6. On option select: immediately call save answer API (optimistic update)
7. Submit button: confirmation dialog "Submit N answered / M total?"

### 4. Anti-Cheat (1h)

1. Tab visibility API: `document.addEventListener('visibilitychange', ...)`
2. On hidden → visible: increment counter, store in attempt metadata
3. Show subtle toast "Focus returned" (not blocking)
4. Tab switch count visible to teacher in submission detail
5. Store in `attempt_answers` metadata or separate field on attempt

### 5. Results & Teacher View (2h)

1. **Results page** (student): total score, per-question breakdown
   - Each question: your answer, correct answer (if show_results allows), explanation
   - Color coding: green correct, red incorrect, gray unanswered
2. **Teacher submissions page**: table of all submissions for assessment+classroom
   - Student name, score, time taken, tab switches, submitted vs auto-submitted
   - Sort by score, time, name
3. **Teacher detail view**: per-student detailed breakdown (same as student results)

## Todo

- [x] Create start attempt API endpoint
- [x] Create save answer API endpoint (auto-save)
- [x] Create submit attempt API endpoint
- [x] Implement score calculation logic
- [x] Build timer component with visual states
- [x] Build full-screen assessment taking page
- [x] Build option card component (selectable)
- [x] Build question navigation grid
- [x] Implement flag for review feature
- [x] Add tab visibility detection (anti-cheat)
- [x] Build auto-submit dialog
- [x] Build results page (student view)
- [x] Build teacher submissions page
- [x] Build teacher detail view
- [x] Test timer accuracy and auto-submit
- [x] Test shuffled question order consistency

## Success Criteria

- Student can take assessment with working timer
- Answers auto-save on selection (< 200ms)
- Auto-submit triggers at timer expiry
- Score calculated correctly with custom scores/penalties
- Results display respects show_results setting
- Teacher can view all submissions with scores and tab-switch counts
- Shuffled questions are consistent per attempt (same seed)

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Client timer drift from server | Medium | Server validates on submit; 5s grace period |
| Network loss during assessment | High | Optimistic save + retry queue; warn if offline |
| Student submits after timer | Low | Server rejects if over time_limit + grace |
| Concurrent answer saves race condition | Low | Upsert per question_id; last write wins (fine for single user) |

## Security

- Students can only see their own attempts
- Questions returned WITHOUT correct answers during attempt
- Correct answers only revealed after submission (per show_results)
- Server enforces time limit (client timer is UX only)
- Teacher can only view submissions for their own classrooms
