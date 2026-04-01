# Brainstorm: Teaching Platform

## Problem Statement

Build web-based teaching platform with 3 roles (teacher, student, parent) supporting question banks, auto-generated assessments, classrooms with social features, and parent analytics dashboard. Deploy entirely on Cloudflare.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Platform | Web only (SPA) | All behind auth, no SEO needed |
| Scale | Small (1-10 teachers) | Personal/small tutoring center |
| Architecture | Hono API + React SPA | Clean API separation, CF-native, mobile-ready |
| Auth | Clerk (Google login) | No registration, teacher pre-defines users in dashboard |
| Database | Cloudflare D1 + Drizzle | SQLite-based, free tier generous, type-safe ORM |
| Real-time | Durable Objects (WebSocket) | CF-native, no external dependency |
| File Storage | Cloudflare R2 | Images in questions/posts |
| Content Format | Markdown | Code blocks, images, Mermaid diagrams, LaTeX math |
| Monorepo | Turborepo + pnpm | Fast builds, caching, shared packages |
| Delivery | Phase by phase | Each subsystem fully working before next |
| Timeline | Quality-first | No rush |

## Tech Stack

### Frontend (React SPA on Cloudflare Pages)
- **React 19** + **Vite**
- **TanStack Router** — type-safe file-based routing
- **TanStack Query** — data fetching, caching, mutations
- **Clerk React SDK** — auth UI components, session management
- **Tailwind CSS v4** + **shadcn/ui** — styling and components
- **react-markdown** + rehype-highlight + remark-gfm + remark-math + rehype-katex — render question content
- **Mermaid** — diagram rendering in markdown
- **MDXEditor** or **Milkdown** — markdown editor for teachers
- **Hono RPC client** — type-safe API calls (end-to-end type safety)

### Backend (Hono on Cloudflare Workers)
- **Hono** — lightweight, Workers-native framework
- **Drizzle ORM** — type-safe queries, D1 driver
- **Zod** — request validation schemas
- **Clerk Backend SDK** — JWT verification, user management
- **Hono middleware** — CORS, auth, rate limiting, error handling

### Infrastructure (Cloudflare — ALL FREE TIER)
- **Pages** — SPA hosting with CDN (unlimited bandwidth, 500 builds/mo)
- **Workers** — API compute (100K requests/day, 10ms CPU/request)
- **D1** — SQLite database (5GB, 5M reads/day, 100K writes/day)
- **R2** — Object storage for images (10GB, 1M writes/mo, 10M reads/mo)
- **Durable Objects** — WebSocket connections for real-time (100K requests/day, 5GB storage — FREE since Apr 2025)

### Shared (packages/shared)
- TypeScript types (API request/response types)
- Zod validation schemas (shared between frontend and backend)
- Constants and enums

## Monorepo Structure

```
teaching-platform/
├── apps/
│   ├── web/                    # React SPA (CF Pages)
│   │   ├── src/
│   │   │   ├── components/     # UI components
│   │   │   ├── features/       # Feature modules
│   │   │   │   ├── auth/
│   │   │   │   ├── questions/
│   │   │   │   ├── assessments/
│   │   │   │   ├── classrooms/
│   │   │   │   ├── dashboard/
│   │   │   │   └── notifications/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── routes/         # TanStack Router file-based routes
│   │   ├── public/
│   │   └── vite.config.ts
│   └── api/                    # Hono API (CF Workers)
│       ├── src/
│       │   ├── routes/         # Hono route handlers
│       │   │   ├── questions.ts
│       │   │   ├── assessments.ts
│       │   │   ├── classrooms.ts
│       │   │   ├── posts.ts
│       │   │   ├── comments.ts
│       │   │   └── notifications.ts
│       │   ├── middleware/     # Auth, CORS, validation
│       │   ├── services/      # Business logic
│       │   ├── db/
│       │   │   ├── schema.ts  # Drizzle schema
│       │   │   └── migrations/
│       │   ├── durable-objects/
│       │   │   └── notification-hub.ts
│       │   └── index.ts       # Hono app entry
│       └── wrangler.toml      # CF Workers config
├── packages/
│   └── shared/                # Shared types, schemas, constants
│       ├── src/
│       │   ├── types/
│       │   ├── schemas/       # Zod schemas
│       │   └── constants/
│       └── package.json
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Data Model

### Core Entities

```
Users (synced from Clerk via webhook)
├── id: text (Clerk user ID)
├── email: text
├── name: text
├── avatar_url: text?
├── role: enum (teacher | student | parent)
├── created_at: timestamp
└── updated_at: timestamp

ParentStudent (parent-child linking)
├── id: text
├── parent_id: text → Users
├── student_id: text → Users
└── created_at: timestamp

Tags (per-teacher question categories)
├── id: text
├── name: text
├── teacher_id: text → Users
├── color: text? (for UI display)
└── created_at: timestamp

Questions
├── id: text
├── teacher_id: text → Users
├── content: text (markdown — question body)
├── options: text (JSON array: [{id, text, is_correct}])
├── complexity: integer (1-5)
├── complexity_type: enum (knowledge | comprehension | application | analysis | synthesis | evaluation)
├── explanation: text? (markdown — shown post-answer)
├── created_at: timestamp
└── updated_at: timestamp

QuestionTags (many-to-many)
├── question_id: text → Questions
└── tag_id: text → Tags

Assessments
├── id: text
├── teacher_id: text → Users
├── title: text
├── description: text?
├── type: enum (test | quiz | practice)
├── time_limit_minutes: integer?
├── score_per_correct: real (default 1)
├── penalty_per_incorrect: real (default 0)
├── shuffle_questions: boolean (default false)
├── shuffle_options: boolean (default false)
├── show_results: enum (immediately | after_due | never)
├── parent_detail_view: enum (scores_only | full_detail) — default scores_only
├── generation_config: text? (JSON — auto-gen params for reference)
├── created_at: timestamp
└── updated_at: timestamp

AssessmentQuestions (many-to-many with order)
├── assessment_id: text → Assessments
├── question_id: text → Questions
├── order_index: integer
├── custom_score: real? (override assessment default)
└── custom_penalty: real? (override)

Classrooms
├── id: text
├── teacher_id: text → Users
├── name: text
├── description: text?
├── invite_code: text (unique, for joining)
├── created_at: timestamp
└── updated_at: timestamp

ClassroomMembers (many-to-many)
├── classroom_id: text → Classrooms
├── user_id: text → Users
├── role: enum (teacher | student | parent)
└── joined_at: timestamp

Posts (unified feed: announcements + assessment assignments)
├── id: text
├── classroom_id: text → Classrooms
├── author_id: text → Users
├── type: enum (announcement | assessment_assignment)
├── title: text
├── content: text? (markdown, for announcements)
├── assessment_id: text? → Assessments (for assessment_assignment)
├── due_date: timestamp?
├── created_at: timestamp
└── updated_at: timestamp

Comments (threaded)
├── id: text
├── post_id: text → Posts
├── author_id: text → Users
├── parent_comment_id: text? → Comments (for replies)
├── content: text (markdown)
├── created_at: timestamp
└── updated_at: timestamp

CommentMentions
├── comment_id: text → Comments
└── user_id: text → Users (mentioned)

AssessmentAttempts
├── id: text
├── assessment_id: text → Assessments
├── student_id: text → Users
├── classroom_id: text → Classrooms
├── started_at: timestamp
├── submitted_at: timestamp?
├── is_auto_submitted: boolean (timer expired)
├── score: real?
├── total_possible: real?
└── status: enum (in_progress | submitted | graded)

AttemptAnswers
├── attempt_id: text → AssessmentAttempts
├── question_id: text → Questions
├── selected_option_id: text
├── is_correct: boolean
└── answered_at: timestamp

Notifications
├── id: text
├── user_id: text → Users (recipient)
├── type: enum (mention | comment_reply | assessment_assigned | assessment_submitted | announcement)
├── reference_type: text (post | comment | assessment)
├── reference_id: text
├── message: text
├── is_read: boolean (default false)
└── created_at: timestamp
```

### Key Relationships Diagram

```
Teacher ──creates──> Questions ──tagged──> Tags
    │                    │
    │                    ├──linked──> AssessmentQuestions ──> Assessments
    │                    │                                      │
    │                    └──answered──> AttemptAnswers          │
    │                                      │                    │
    ├──creates──> Classrooms              │                    │
    │                │                     │                    │
    │                ├── Members ──> Students ──> Attempts ─────┘
    │                │                     │
    │                ├── Posts ──> Comments (threaded + mentions)
    │                │
    │                └── AssessmentAssignments (via Posts)
    │
    └──creates──> Assessments (reusable across classrooms)

Parent ──linked──> Student (via ParentStudent)
    └──views──> Dashboard (student activities, scores, metrics)
```

## Auto-Generation Algorithm

Teacher inputs:
1. Total question count (N)
2. Tag distribution: `[{tag_id, percent}]`
3. Complexity distribution per tag: `[{tag_id, complexity, percent}]`
4. Score/penalty per question

```
function generateAssessment(config):
  selected = []
  shortfalls = []

  for each {tag, tag_percent} in config.tags:
    tag_count = round(N * tag_percent / 100)

    for each {complexity, comp_percent} in config.complexities[tag]:
      target = round(tag_count * comp_percent / 100)
      candidates = db.query(questions WHERE tag=tag AND complexity=complexity)
      picked = randomSample(candidates, min(target, candidates.length))
      selected.push(...picked)

      if picked.length < target:
        shortfalls.push({tag, complexity, needed: target, available: picked.length})

  // Fix rounding: adjust to exactly N questions
  adjustForRounding(selected, N)

  // Return results + any shortfall warnings
  return { questions: selected, shortfalls }
```

**Edge cases handled:**
- Rounding errors (percentages don't divide evenly) — adjust largest group
- Insufficient questions — return shortfall warnings, teacher decides to proceed or adjust
- Duplicate prevention — questions already in assessment excluded from candidates

## Real-time Architecture (Durable Objects)

```
┌──────────────┐    WebSocket     ┌─────────────────────┐
│  React SPA   │◄────────────────►│  NotificationHub DO │
│  (per user)  │                  │  (per classroom)    │
└──────────────┘                  │                     │
                                  │  - Track connected  │
                                  │    users            │
                                  │  - Broadcast events │
                                  │  - Buffer offline   │
                                  │    notifications    │
                                  └─────────┬───────────┘
                                            │
                                  ┌─────────▼───────────┐
                                  │   Hono API Worker    │
                                  │  (triggers events)   │
                                  │                      │
                                  │  On new comment:     │
                                  │    → notify DO       │
                                  │    → DO broadcasts   │
                                  │      to connected    │
                                  │      classroom       │
                                  │      members         │
                                  └──────────────────────┘
```

**Events:**
- `comment.new` — new comment on a post
- `comment.mention` — user mentioned in comment
- `assessment.assigned` — new assessment in classroom
- `assessment.submitted` — student submitted (teacher sees)
- `announcement.new` — new announcement posted

## Phased Delivery Plan

### Phase 1: Foundation
- Turborepo monorepo setup
- Hono API skeleton with middleware (CORS, error handling)
- React SPA with TanStack Router, Tailwind, shadcn/ui
- Clerk integration (Google login, JWT verification)
- D1 database schema + Drizzle setup
- User sync via Clerk webhook
- Basic layout: sidebar nav, role-based routing

### Phase 2: Question Bank
- CRUD questions with markdown editor
- Markdown preview (code highlight, images, mermaid)
- Image upload to R2
- Tag management (create, edit, delete)
- Complexity assignment (score + type)
- Filtering/search by tag, complexity
- Bulk operations (delete, re-tag)

### Phase 3: Assessment Bank
- Manual assessment creation (pick questions)
- Auto-generation algorithm with config UI
- Assessment preview and editing
- Scoring configuration
- Assessment duplication

### Phase 4: Classroom
- Classroom CRUD
- Member management (add by email, role assignment)
- Announcement posts with markdown
- Assessment assignment (link assessment + set due date)
- Unified classroom feed

### Phase 5: Assessment Taking
- Student assessment view (timer, question navigation)
- Answer recording with auto-save
- Timer with auto-submit on expiry
- Tab visibility detection (basic anti-cheating)
- Result calculation and display
- Teacher: view submissions and scores

### Phase 6: Comments & Mentions
- Threaded comments on posts
- @mention autocomplete (classroom members)
- Comment editing/deletion
- Mention notifications

### Phase 7: Real-time Notifications
- Durable Objects WebSocket setup
- Connection management per classroom
- Live notification delivery
- Notification inbox (read/unread)
- Notification preferences

### Phase 8: Parent Dashboard
- Parent-student linking
- Activity feed (student's recent actions)
- Assessment result metrics (avg score, trend, per-tag performance)
- Classroom participation overview

## Anti-Cheating Measures (Phase 5)

For small-scale use, basic measures:
- **Tab visibility API** — detect when student switches tabs, log count
- **Timer server-validated** — start time stored server-side, auto-submit enforced by API
- **No back-navigation** — optionally prevent going back to previous questions
- **Randomization** — shuffle questions and options per student
- **Single attempt** — prevent re-taking unless teacher allows

*Not implementing*: screen recording, lockdown browser, IP tracking (overkill for small scale).

## Cost Estimate (All Free Tier)

| Service | Free Tier Limit |
|---------|----------------|
| Pages | Unlimited bandwidth, 500 builds/mo |
| Workers | 100K requests/day, 10ms CPU/req |
| D1 | 5GB storage, 5M reads/day, 100K writes/day |
| R2 | 10GB storage, 1M writes/mo, 10M reads/mo |
| Durable Objects | 100K requests/day, 5GB storage (free since Apr 2025) |
| **Clerk** | 50K MAU free |

**For POC and small scale (1-10 teachers, ~100 students): $0/mo.** All services within free tier limits.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| D1 SQLite limitations (no JSON functions, limited concurrent writes) | Medium | Use JSON as text columns, batch writes, this scale won't hit limits |
| Durable Objects complexity | Medium | Start simple (single DO per classroom), PartyKit as fallback |
| Clerk webhook reliability | Low | Idempotent handler, manual sync fallback |
| Markdown rendering inconsistency (editor vs preview) | Low | Use same remark/rehype plugins on both sides |
| R2 image upload size | Low | Set 5MB limit, client-side compression |

## Success Metrics

- Teacher can create question bank and auto-generate assessment in < 5 minutes
- Student can take timed assessment with smooth experience (no lag, auto-save)
- Real-time notifications delivered within 2 seconds
- Parent dashboard loads student metrics in < 1 second
- System handles 100 concurrent assessment-takers without degradation

## Next Steps

Ready for detailed implementation planning via `/ck:plan` when approved.
