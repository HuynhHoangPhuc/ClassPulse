# Phase 3: Assessment Bank

## Context

- [Phase 2 Question Bank](./phase-02-question-bank.md) — questions CRUD, tags
- [Design Guidelines §6.4](../../docs/design-guidelines.md) — Assessment Bank page design
- [Brainstorm — Auto-Generation Algorithm](../reports/brainstorm-260401-1835-teaching-platform.md)

## Overview

- **Priority**: P1
- **Status**: Complete
- **Effort**: 12h
- **Depends On**: Phase 2
- **Description**: Assessment creation (manual + auto-generation), multi-step wizard UI, scoring configuration, assessment preview, duplication.

## Key Insights

- Auto-generation is the most complex feature — constraint-satisfaction problem with tag % + complexity % distribution
- Assessment ↔ Question is many-to-many (AssessmentQuestions junction with ordering)
- Assessments are reusable across classrooms (assigned in Phase 4)
- generation_config stored as JSON for reference/re-generation
- 10ms CPU limit per Worker request — auto-gen must be efficient (pre-query counts)

## Requirements

### Functional
- Manual assessment creation: pick questions from bank, set order
- Auto-generation: configure tag %, complexity % per tag, total count
- Scoring config: score per correct, penalty per incorrect, per-question overrides
- Assessment settings: time limit, shuffle questions/options, show results mode
- Assessment preview: student-view simulation
- Duplicate assessment (clone with new ID)
- Assessment types: test, quiz, practice

### Non-Functional
- Auto-generation responds in < 2 seconds
- Assessment with 100+ questions handles without UI lag
- Wizard state preserved if user navigates away (session storage)

## Architecture

### API Routes

```
GET    /api/assessments              — List teacher's assessments
GET    /api/assessments/:id          — Get assessment with questions
POST   /api/assessments              — Create assessment (manual)
POST   /api/assessments/generate     — Auto-generate assessment
PUT    /api/assessments/:id          — Update assessment
DELETE /api/assessments/:id          — Delete assessment
POST   /api/assessments/:id/duplicate — Clone assessment
GET    /api/assessments/:id/preview  — Get preview data (student view)
```

### Auto-Generation Flow

```
Teacher Config                    Backend Algorithm
─────────────                    ──────────────────
Total: 20 questions              For each (tag, complexity):
Tags: [JS: 50%, CSS: 50%]    →    target = round(N * tag% * comp%)
Complexity per tag:                candidates = SELECT ... WHERE tag AND complexity
  JS: [easy:40%, hard:60%]         picked = random_sample(candidates, target)
  CSS: [easy:60%, hard:40%]        if shortfall → add to warnings
Score: 2pts correct              Adjust rounding to exactly N
Penalty: -0.5 incorrect         Return {questions, shortfalls, config}
```

## Related Code Files

### Files to Create
- `apps/api/src/routes/assessment-routes.ts` — Assessment endpoints
- `apps/api/src/services/assessment-service.ts` — CRUD logic
- `apps/api/src/services/assessment-generator-service.ts` — Auto-gen algorithm
- `apps/web/src/features/assessments/` — Assessment feature module
  - `assessment-list-page.tsx` — Main list page
  - `assessment-wizard-page.tsx` — Multi-step creation wizard
  - `assessment-preview-page.tsx` — Student-view simulation
  - `wizard-step-basic-info.tsx` — Step 1: title, type, time limit
  - `wizard-step-questions.tsx` — Step 2: manual select or auto-gen
  - `wizard-step-settings.tsx` — Step 3: shuffle, scoring, review
  - `question-picker.tsx` — Searchable question selector
  - `auto-gen-config.tsx` — Tag/complexity distribution editor
  - `distribution-bar.tsx` — Visual percentage bar component
  - `assessment-card.tsx` — Card for list view
- `packages/shared/src/schemas/assessment-schemas.ts` — Zod schemas

## Implementation Steps

### 1. Assessment CRUD API (2h)

1. Create/update/delete endpoints with Drizzle transactions:
   - Create: insert assessment + assessment_questions (with order_index)
   - Update: update assessment, replace assessment_questions
   - Delete: cascade delete assessment_questions, check no active attempts
2. List endpoint: filter by type, search by title, pagination
3. Duplicate endpoint: clone assessment + questions with new IDs

### 2. Auto-Generation Algorithm (3h)

1. Implement `generateAssessment` in `assessment-generator-service.ts`:
   ```typescript
   async function generateAssessment(config: GenerateConfig, db: DrizzleD1) {
     const selected: Question[] = []
     const shortfalls: Shortfall[] = []
     
     for (const tagConfig of config.tags) {
       const tagCount = Math.round(config.totalQuestions * tagConfig.percent / 100)
       
       for (const compConfig of tagConfig.complexities) {
         const target = Math.round(tagCount * compConfig.percent / 100)
         const candidates = await db.select()
           .from(questions)
           .innerJoin(questionTags, eq(questionTags.questionId, questions.id))
           .where(and(
             eq(questionTags.tagId, tagConfig.tagId),
             eq(questions.complexity, compConfig.level)
           ))
         
         const picked = shuffleAndTake(candidates, target)
         selected.push(...picked)
         
         if (picked.length < target) {
           shortfalls.push({ tagId, complexity, needed: target, available: picked.length })
         }
       }
     }
     
     adjustForRounding(selected, config.totalQuestions)
     return { questions: selected, shortfalls }
   }
   ```
2. Handle edge cases: rounding errors, insufficient questions, duplicate prevention
3. **Validated**: Show shortfall warnings, let teacher proceed with fewer questions. Do NOT block generation. Return `{ questions, shortfalls }` — UI shows warnings, teacher clicks "Create anyway" or adjusts config.

### 3. Assessment List Page (2h)

1. List page with assessment cards showing: title, type badge, question count, time limit, classroom count
2. Type filter: tabs or toggle group (All | Test | Quiz | Practice)
3. Search by title
4. Action menu per card: Edit, Duplicate, Preview, Delete
5. Empty state per design guidelines

### 4. Creation Wizard (3h)

1. **Step 1 — Basic Info**: title, description (optional), type toggle (test/quiz/practice), time limit input (minutes, optional)
2. **Step 2 — Questions**: tab interface
   - **Manual Select tab**: question picker with search + tag/complexity filters. Drag to reorder. Show selected count.
   - **Auto Generate tab**:
     - Total question count input
     - Tag distribution: add tags with percentage slider, visual bar shows distribution
     - Per-tag complexity distribution: nested sliders per complexity level
     - Score per correct / penalty per incorrect inputs
     - "Generate Preview" button → calls API, shows result with shortfall warnings
     - Teacher reviews, regenerates, or adjusts
3. **Step 3 — Settings**: shuffle toggles, show results mode (radio), review summary, "Create" button
4. Persist wizard state in sessionStorage to survive navigation

### 5. Assessment Preview (2h)

1. Read-only student-view simulation of the assessment
2. Show questions with markdown rendering, options (non-selectable)
3. Navigate between questions
4. Display scoring rules and time limit info
5. No actual answer submission — preview only

## Todo

- [x] Create assessment CRUD API endpoints
- [x] Implement auto-generation algorithm with shortfall warnings
- [x] Create assessment list page with type filter
- [x] Build multi-step creation wizard
- [x] Build question picker (manual selection)
- [x] Build auto-gen config UI (tag/complexity distribution editor)
- [x] Build distribution bar component
- [x] Build assessment preview page (student-view simulation)
- [x] Implement assessment duplication
- [x] Add wizard state persistence (sessionStorage)
- [x] Test auto-generation with edge cases (insufficient questions, rounding)

## Success Criteria

- Teacher can manually create assessment by picking questions
- Auto-generation produces correct question distribution per tag/complexity
- Shortfall warnings displayed when insufficient questions
- Wizard navigates smoothly between steps, state persisted
- Assessment preview shows student-view simulation
- Duplicate creates independent copy
- List page filters and searches correctly

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| 10ms CPU limit for auto-gen with large question banks | Medium | Pre-count available questions per tag/complexity, fail fast if impossible |
| Percentage rounding creates wrong total | Low | Adjust largest group to hit exact total |
| Complex wizard state management | Medium | Use sessionStorage + React state, not URL params |

## Security

- Assessments scoped to teacher_id
- Auto-generation queries only teacher's own questions
- Validate all percentages sum to 100%
- Validate question IDs belong to teacher
