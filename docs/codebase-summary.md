# Codebase Summary — Teaching Platform

**Last Updated:** 2026-04-03
**Phase:** Phase 7 + QA Bugfix Batch + AI Question API
**Total Files:** 188 | **Total Tokens:** ~265K

---

## 1. Project Overview

Teaching Platform is a monorepo-based SaaS for educators to create, manage, and grade assessments with real-time student feedback and parent visibility. Built with Turborepo, Hono (API), React 19 (Web), and SQLite (Database).

---

## 2. Repository Structure

```
teaching-platform/
├── apps/
│   ├── api/                          # Backend (Hono + Drizzle ORM + Durable Objects)
│   │   ├── src/
│   │   │   ├── db/schema.ts          # 17 tables, Drizzle schema
│   │   │   ├── durable-objects/      # NotificationHub WebSocket DO (Phase 7)
│   │   │   ├── middleware/           # Auth, CORS, error handling
│   │   │   ├── routes/               # 12 route files (users, questions, ai-questions, assessments, classrooms, attempts, comments, notifications, websocket, etc.)
│   │   │   ├── services/             # Business logic (13 service files, includes ai-question-parser)
│   │   │   ├── lib/id-generator.ts   # Custom ID generation
│   │   │   ├── env.ts                # Environment types
│   │   │   └── index.ts              # Hono app entry
│   │   ├── wrangler.toml             # Cloudflare Workers + DO config
│   │   ├── drizzle.config.ts         # Drizzle migrations
│   │   └── tsconfig.json
│   │
│   └── web/                          # Frontend (React 19 + Vite)
│       ├── src/
│       │   ├── routes/               # TanStack Router (7 route files)
│       │   ├── features/             # Feature modules (questions, assessments, classrooms, notifications)
│       │   │   ├── questions/        # Question bank (7 components)
│       │   │   ├── assessments/      # Assessment management & taking (12 components)
│       │   │   ├── classrooms/       # Classroom management & discussion (14 components)
│       │   │   └── notifications/    # Real-time notifications (5 components) (Phase 7)
│       │   ├── components/           # Reusable UI (layout, ui)
│       │   ├── hooks/                # Custom hooks (use-websocket) (Phase 7)
│       │   ├── lib/                  # API client, utilities
│       │   ├── app.tsx               # Root component
│       │   ├── app.css               # Global styles
│       │   └── main.tsx              # Vite entry
│       ├── vite.config.ts
│       └── tsconfig.json
│
├── packages/
│   └── shared/                       # TypeScript types & constants
│       ├── src/
│       │   ├── constants/            # Roles, complexity, assessment/post/notification types
│       │   ├── types/                # User, question, assessment, classroom, notification types
│       │   └── schemas/              # Zod validation schemas
│       └── tsconfig.json
│
├── plans/                            # Development plans & reports
│   ├── 260401-2041-teaching-platform/   # Phase plans (1-8)
│   └── reports/                         # Research, testing, review reports
│
├── docs/                             # Documentation
│   ├── system-architecture.md        # Technical architecture
│   ├── code-standards.md             # Coding conventions
│   ├── project-overview-pdr.md       # PDR & roadmap
│   ├── design-guidelines.md          # UI/UX design system
│   ├── codebase-summary.md           # This file
│   └── journals/                     # Phase completion journals
│
├── turbo.json                        # Turborepo pipeline
├── pnpm-workspace.yaml               # Workspace config
├── tsconfig.base.json                # Base TypeScript config
└── package.json                      # Root scripts
```

---

## 3. Core Modules & Responsibilities

### Backend Routes (12 files)

| Route File | Purpose | Methods | Key Endpoints |
|-----------|---------|---------|---------------|
| **users-route.ts** | User profile management | GET, PATCH | `/api/users` |
| **questions-route.ts** | Question CRUD | GET, POST, PUT, DELETE | `/api/questions`, `/api/questions/bulk` |
| **ai-question-routes.ts** | AI-native question creation | POST | `/api/questions/ai` (markdown frontmatter + base64 image) |
| **tags-route.ts** | Tag management | GET, POST, PUT, DELETE | `/api/tags` |
| **assessment-routes.ts** | Assessment creation & preview | GET, POST, PUT, DELETE | `/api/assessments`, `/api/assessments/:id/duplicate`, `/api/assessments/:id/preview` |
| **classroom-routes.ts** | Classroom management | GET, POST, PUT, DELETE | `/api/classrooms`, `/api/classrooms/:id/regenerate-code` |
| **classroom-member-routes.ts** | Member management | GET, POST, DELETE, PUT | `/api/classrooms/:id/members` |
| **classroom-post-routes.ts** | Feed & posts | GET, POST, PUT, DELETE | `/api/classrooms/:id/posts` |
| **comment-routes.ts** | Comments & mentions | GET, POST, PUT, DELETE | `/posts/:postId/comments`, `/classrooms/:id/members/search` |
| **attempt-routes.ts** | Assessment taking | POST, GET | `/api/attempts/start`, `/save`, `/submit`, `/results`, `/detail` |
| **notification-routes.ts** | User notifications (Phase 7) | GET, PUT | `/api/notifications`, `/api/notifications/unread-count`, `/api/notifications/:id`, `/api/notifications/read-all` |
| **websocket-routes.ts** | WebSocket upgrade (Phase 7) | GET | `/ws/classroom/:classroomId?token=<jwt>` |
| **dashboard-routes.ts** | Dashboard KPIs (QA Bugfix) | GET | `/api/dashboard/stats` |
| **settings-routes.ts** | Settings management (QA Bugfix) | GET, PUT | `/api/settings` |
| **upload-route.ts** | Image asset storage | POST, GET | `/api/upload/image` |

### Backend Services (13 files)

| Service | Purpose | Key Functions |
|---------|---------|----------------|
| **question-service.ts** | Question CRUD | Create, update, delete, bulk import |
| **ai-question-parser.ts** | Markdown frontmatter parsing (AI API) | Parse YAML, extract checkboxes, validate structure |
| **assessment-service.ts** | Assessment CRUD | Create, update, delete, duplicate |
| **assessment-query-service.ts** | Complex assessment queries | Get with questions, filtering, pagination |
| **assessment-generator-service.ts** | AI question generation logic | Generate, sample questions |
| **classroom-service.ts** | Classroom CRUD | Create, update, delete, invite code management |
| **classroom-member-service.ts** | Member management | Add, remove, role updates, permissions checks |
| **comment-service.ts** | Comments & mentions | List, create, update, delete, mention extraction |
| **notification-service.ts** | Notification creation | Create mentions, submissions, assignment notifications |
| **realtime-service.ts** | Real-time event broadcasting (Phase 7) | Broadcast to NotificationHub DO, event routing |
| **attempt-service.ts** | Assessment attempt CRUD | Start, save, submit, validate answers |
| **attempt-query-service.ts** | Attempt queries | Get results, detail, student answers |
| **score-calculator-service.ts** | Scoring logic | Calculate scores with penalties, custom per-question scoring |

### Frontend Components

#### Questions Feature (7 components)
- question-list-page.tsx — List with filters/search
- question-editor-page.tsx — Create/edit form
- question-card.tsx — Card preview
- markdown-editor.tsx — Content editor with live preview
- markdown-preview.tsx — Markdown rendering
- question-filter-panel.tsx — Filter/sort controls
- tag-selector.tsx, complexity-selector.tsx — Filter dropdowns

#### Assessments Feature (12 components)
- assessment-list-page.tsx — List with pagination
- assessment-wizard-page.tsx — 3-step creation wizard
- assessment-preview-page.tsx — Student-facing preview
- assessment-taking-page.tsx — Full-screen taking interface (Phase 5)
- assessment-question-view.tsx — Question display during taking
- assessment-question-grid.tsx — Navigation grid
- assessment-timer.tsx — Countdown timer (Phase 5)
- assessment-results-page.tsx — Score display (Phase 5)
- teacher-submissions-page.tsx — Submission list (Phase 5)
- teacher-submission-detail-page.tsx — Detail view with tab-switch counts (Phase 5)
- question-picker.tsx — Question selector for creation
- auto-gen-config.tsx, distribution-bar.tsx — AI generation UI

#### Classrooms Feature (14 components)
- classroom-list-page.tsx — Classroom selector
- classroom-detail-page.tsx — 4-tab layout (Feed, Members, Assessments, Settings)
- classroom-feed-tab.tsx — Post list + composer
- classroom-members-tab.tsx — Member management
- classroom-assessments-tab.tsx — Classroom assessments
- classroom-settings-tab.tsx — Configuration
- post-card.tsx — Post display with comment section
- post-composer.tsx — Create/edit post
- comment-section.tsx — Threaded comments container
- comment-item.tsx — Individual comment
- comment-input.tsx — Text input with @mention autocomplete
- mention-autocomplete.tsx — Member search dropdown
- mention-renderer.tsx — @mention rendering
- add-member-dialog.tsx — Add students/parents

#### Notifications Feature (5 components, Phase 7)
- notification-provider.tsx — Context provider + WebSocket connection management
- notification-bell.tsx — Header bell icon with unread badge
- notification-panel.tsx — Dropdown panel showing notification list
- notification-item.tsx — Individual notification card
- notification-toast.tsx — Toast alert for new real-time events

#### Settings Feature (3 components, QA Bugfix)
- settings-page.tsx — Settings layout with tabs (profile, appearance, notifications)
- profile-settings-tab.tsx — User profile editor
- appearance-settings-tab.tsx — Theme and UI preferences

### Shared Package (Types & Constants)

**Constants:**
- roles.ts — "teacher" | "student" | "parent"
- complexity.ts — 1-5 levels with colors
- assessment-types.ts — "test" | "quiz" | "practice"
- post-types.ts — "announcement" | "assessment_assignment"
- notification-types.ts — Event types for mentions, submissions, assignments

**Types:**
- user-types.ts — User profile, roles
- question-types.ts — Question, option, tag interfaces
- assessment-types.ts — Assessment, attempt, answer types
- classroom-types.ts — Classroom, member, post, comment types
- notification-types.ts — Notification event types

**Schemas (Zod):**
- Question schemas (create, update, bulk)
- Tag schemas (create, update)
- Assessment schemas (create, update, generate config)
- Classroom schemas (create, update, member add)
- Comment schemas (create, update)
- Filter schemas (questions, assessments)

---

## 4. Database Schema (17 Tables)

### Users & Auth
- **users** — User account data, roles, profile
- **parentStudent** — Parent ↔ student relationships

### Questions & Assessments
- **tags** — Teacher-created question labels
- **questions** — Question content, options, complexity
- **questionTags** — Many-to-many question ↔ tags
- **assessments** — Assessment metadata, scoring rules
- **assessmentQuestions** — Ordered questions per assessment
- **assessmentDuplicates** — Tracks assessment copies

### Classroom & Discussion
- **classrooms** — Classroom containers, invite codes
- **classroomMembers** — Members + roles per classroom
- **posts** — Feed items (announcements, assignments)
- **comments** — Post comments with threading
- **commentMentions** — @mention tracking

### Assessment Taking (Phase 5)
- **assessmentAttempts** — Attempt metadata (started, submitted, score)
- **attemptAnswers** — Question-level answers

### Notifications (Phase 4)
- **notifications** — Aggregated user notifications

---

## 5. API Endpoints Summary

### Public
- `POST /webhook/clerk` — Clerk webhook for user sync
- `GET /health` — Health check

### WebSocket (Phase 7)
- `GET /ws/classroom/:classroomId?token=<jwt>` — Upgrade to NotificationHub DO

### Protected (/api/*)
- **Users:** GET/PATCH `/api/users`
- **Questions:** GET/POST/PUT/DELETE `/api/questions`, POST `/api/questions/ai` (AI API), POST `/api/questions/bulk`
- **Tags:** GET/POST/PUT/DELETE `/api/tags`
- **Assessments:** GET/POST/PUT/DELETE `/api/assessments`, POST `/generate`, GET `/preview`, POST `/duplicate`
- **Classrooms:** GET/POST/PUT/DELETE `/api/classrooms`, POST `/regenerate-code`
- **Members:** GET/POST/DELETE/PUT `/api/classrooms/:id/members`
- **Posts:** GET/POST/PUT/DELETE `/api/classrooms/:id/posts`
- **Comments:** GET/POST/PUT/DELETE `/posts/:postId/comments`
- **Member Search:** GET `/classrooms/:id/members/search` (for @mention autocomplete)
- **Attempts:** POST `/start`, `/save`, `/submit`, GET `/results`, `/detail`
- **Notifications (Phase 7):** GET `/api/notifications`, GET `/api/notifications/unread-count`, PUT `/api/notifications/:id`, PUT `/api/notifications/read-all`
- **Dashboard (QA Bugfix):** GET `/api/dashboard/stats`
- **Settings (QA Bugfix):** GET/PUT `/api/settings`
- **Upload:** POST/GET `/api/upload/image`

---

## 6. Key Features by Phase

### Phase 1: Foundation (Complete)
- Monorepo scaffolding (Turborepo, pnpm)
- API skeleton (Hono, Cloudflare Workers)
- Database schema (17 tables)
- Web shell (routes, layout, components)
- Clerk authentication

### Phase 2: Question Bank (Complete)
- Question CRUD API
- Tag management with colors
- Markdown editor with math/code support
- Image upload & storage
- Bulk question import
- Question filtering (tags, complexity, search)

### Phase 3: Assessment Bank (Complete)
- Assessment CRUD API
- 3-step creation wizard
- Assessment auto-generation with AI config
- Assessment preview
- Assessment duplication
- Question picker with advanced search

### Phase 4: Classroom (Complete)
- Classroom CRUD API
- Member management + role support
- Invite codes
- Post/feed API with announcements & assignments
- Comment system with threading
- @mention support
- Classroom detail page (4 tabs)

### Phase 5: Assessment Taking (Complete)
- Timed assessment interface (countdown, grace period)
- Anti-cheat tab-switch detection
- Auto-save during attempt
- Seeded question/option shuffle
- Score calculation with custom scoring
- Immediate result display
- Teacher submission viewer
- Atomic submit guard (prevent resubmit)

### Phase 7: Real-time Notifications (Complete)
- WebSocket connections via Durable Objects (one DO per classroom)
- Real-time event broadcasting to connected clients
- Notification API (GET, PUT for read tracking)
- NotificationHub DO for connection management
- Notification bell with unread count badge
- Notification panel + dropdown UI
- Toast notifications for real-time events
- Auto-reconnect with exponential backoff
- Ping/pong keepalive for stable connections

---

## 7. Development Workflow

### Setup
```bash
pnpm install                      # Install workspace dependencies
pnpm run dev                      # Start API (Wrangler) + Web (Vite) in parallel
pnpm run build                    # Build all apps
pnpm run lint                     # Lint code
pnpm run typecheck                # Type-check all
```

### Key Technologies
| Layer | Tech | Version |
|-------|------|---------|
| **Runtime** | Node.js | 20+ |
| **Monorepo** | Turborepo | 2.4.0 |
| **API** | Hono | 4.7 |
| **Database** | Drizzle ORM + SQLite/D1 | 0.38 |
| **Auth** | Clerk | JWT + webhooks |
| **Web** | React | 19 |
| **Build** | Vite | 6 |
| **Router** | TanStack Router | 1.95 |
| **State** | TanStack Query | 5.65 |
| **Styling** | Tailwind CSS | 4.0 |
| **Markdown** | react-markdown + plugins | Latest |

---

## 8. Code Organization Standards

### Naming
- Files: kebab-case
- Directories: kebab-case
- Classes: PascalCase
- Functions: camelCase
- Constants: UPPER_SNAKE_CASE
- DB tables: camelCase
- DB columns: snake_case
- API routes: kebab-case

### Architecture Patterns
- **Routes:** One file per domain, export Hono app instance
- **Services:** Business logic separated by concern (CRUD, queries, generation)
- **Middleware:** One file per concern (auth, CORS, error handling)
- **Components:** Functional hooks-based, co-located related files
- **Hooks:** Custom hooks prefixed with `use`, use TanStack Query for async state

---

## 9. File Statistics (Top 5 by Token Count)

1. `apps/api/src/db/migrations/meta/0001_snapshot.json` (8,327 tokens)
2. `plans/reports/tester-260402-1647-phase-6-validation.md` (7,744 tokens)
3. `docs/system-architecture.md` (7,543 tokens)
4. `docs/code-standards.md` (7,090 tokens)
5. `plans/reports/Explore-260401-exploration-report.md` (5,449 tokens)

---

## 10. Testing & Quality

- **Linting:** Configured in root package.json
- **TypeScript:** Strict mode enabled
- **Testing:** Jest (configured, Phase 2+ coverage target: 80%)
- **Code Review:** Required before merge
- **Pre-commit:** Type checking + linting

---

## 11. Related Documentation

- [`system-architecture.md`](./system-architecture.md) — Technical details, API routes
- [`code-standards.md`](./code-standards.md) — Coding conventions, patterns
- [`project-overview-pdr.md`](./project-overview-pdr.md) — PDR, roadmap, requirements
- [`design-guidelines.md`](./design-guidelines.md) — UI/UX design tokens, components

---

## 12. Plans & Reports

**Phase Plans:** `plans/260401-2041-teaching-platform/phase-{01-08}-*.md`

**Recent Reports:**
- Code Review (Phase 5 Assessment Taking)
- Code Review (Phase 6 Comments/Mentions validation)
- Tester reports (Phase 5, Phase 6)
- Docs Manager reports (Phase 1, 2, 3-4)

---

## 13. AI-Native Question Creation API

**New:** `POST /api/questions/ai` (Apr 3, 2026)
- Markdown frontmatter parsing (YAML: complexity, complexityType, tags, explanation)
- Bare checkbox option extraction (`[x]` = correct, `[ ]` = incorrect)
- Base64 image upload to R2 with URL injection
- Tag auto-creation by name (scoped to teacher)
- Partial success batch response (created count, failed count, per-question status)
- Validation: 2-6 options, ≥1 correct, max 10K content, max 7M image, max 50 questions/request
- Test coverage: 23 unit tests, all passing

---

## 14. Next Steps (Phase 9+)

1. **Analytics & Parent Dashboards** — Performance metrics, trend visualization
2. **Manual Grading Interface** — Essay/short-answer grading
3. **Enhanced AI Integration** — OpenAI API, more generation options
4. **Student Progress Reports** — Downloadable transcripts
5. **Mobile App** — React Native version

---

**Last Generated:** 2026-04-03 by project-manager agent  
**Codebase Compaction:** See `repomix-output.xml` for full repository pack
