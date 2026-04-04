# System Architecture — Teaching Platform

**Current Phase:** Phase 7 + QA Bugfix Batch + AI Question API (JWT Refresh, Settings, Dashboard Stats, AI-Native Question Creation)

---

## 1. Architecture Overview

Teaching Platform is a monorepo-based SaaS for educators to create, assign, and grade assessments with real-time student feedback and parent visibility.

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js | 20+ |
| **Monorepo** | Turborepo | 2.4.0 |
| **API** | Hono | 4.7 |
| **Database** | Drizzle ORM + SQLite/D1 | 0.38 |
| **Auth** | Clerk | JWT + webhooks |
| **Web Framework** | React | 19 |
| **Build Tool** | Vite | 6 |
| **Router** | TanStack Router | 1.95 (code-based) |
| **State** | TanStack Query | 5.65 |
| **Styling** | Tailwind CSS | 4.0 (CSS-based) |
| **Icons** | Lucide React | Latest |
| **Package Manager** | pnpm | 9.15+ |
| **Markdown** | react-markdown + remark plugins | Latest |
| **Math Rendering** | rehype-katex + remark-math | Latest |
| **Code Highlighting** | rehype-highlight | Latest |

---

## 2. Monorepo Structure

```
teaching-platform/
├── apps/
│   ├── api/                    # Hono API backend
│   │   ├── src/
│   │   │   ├── db/schema.ts           # Drizzle ORM schema (15 tables)
│   │   │   ├── middleware/            # cors, auth, error handling
│   │   │   ├── routes/                # API route handlers (users, questions, tags, upload)
│   │   │   ├── services/              # Business logic (question service)
│   │   │   ├── lib/                   # Utilities (ID generation)
│   │   │   ├── env.ts                 # Environment types
│   │   │   └── index.ts               # Hono app entry
│   │   ├── drizzle.config.ts          # Drizzle CLI config
│   │   └── package.json
│   │
│   └── web/                    # React + Vite frontend
│       ├── src/
│       │   ├── routes/                # TanStack Router routes
│       │   ├── features/              # Feature-specific components & logic
│       │   │   └── questions/         # Question bank UI (list, editor, filters)
│       │   ├── components/
│       │   │   ├── layout/            # Shell, sidebar, header, dark-mode
│       │   │   └── ui/                # Reusable UI components
│       │   ├── lib/                   # API client, utilities
│       │   ├── app.tsx                # Root component
│       │   └── main.tsx               # Entry point
│       ├── vite.config.ts
│       └── package.json
│
├── packages/
│   └── shared/                 # TypeScript types & constants
│       ├── src/
│       │   ├── constants/             # Roles, complexity, assessment types
│       │   ├── types/                 # User, question, assessment types
│       │   ├── schemas/               # Zod validation schemas
│       │   └── index.ts               # Public exports
│       └── package.json
│
├── turbo.json                  # Turborepo pipeline config
├── pnpm-workspace.yaml         # Workspace setup
├── tsconfig.base.json          # Base TypeScript config
└── package.json                # Root scripts (dev, build, lint, typecheck)
```

---

## 3. Database Schema (17 Tables, Phase 7)

### Core Users
- **users** — User account data, roles (teacher/student/parent)
- **parentStudent** — Parent ↔ Student relationships (one parent can monitor multiple students)

### Question & Assessment Management
- **tags** — Teacher-created labels for categorizing questions
- **questions** — Question content, options, complexity, explanation
- **questionTags** — Many-to-many linking questions to tags
- **assessments** — Assessment metadata (title, type, scoring rules, AI generation config)
- **assessmentQuestions** — Ordered list of questions per assessment with optional score overrides
- **assessmentDuplicates** — Tracks assessment copies for deduplication

### Classroom & Communication (Phase 4 Complete)
- **classrooms** — Classroom containers with invite codes, description, settings
- **classroomMembers** — Members + roles (teacher/student/parent) per classroom
- **posts** — Feed items (announcements, assessment assignments with due dates)
- **comments** — Post comments with threading (parent-child relationships)
- **commentMentions** — @mention tracking for notifications

### Assessment Taking & Results
- **assessmentAttempts** — Attempt metadata (started, submitted, score, status)
- **attemptAnswers** — Question-level answers (selected option, correctness, timestamp)

### User Notifications
- **notifications** — Aggregated user notifications (mentions, submissions, assignments)

---

## 4. API Architecture

### Server: Hono on Cloudflare Workers + Durable Objects (Phase 7)

```
Hono App (src/index.ts)
├── Global Error Handler (errorMiddleware)
├── CORS Middleware (all routes)
├── Public Routes
│   └── POST /webhook/clerk — Clerk webhook for user sync
├── WebSocket Routes (Phase 7)
│   └── GET /ws/classroom/:classroomId?token=<jwt> — Upgrade to NotificationHub DO
├── Protected Routes (/api/*)
│   ├── Auth Middleware (JWT verification)
│   ├── /api/users
│   │   ├── GET / — Current user profile
│   │   ├── PATCH / — Update profile
│   │   └── Other user-related endpoints
│   ├── /api/tags
│   │   ├── GET / — List all tags for teacher
│   │   ├── POST / — Create tag
│   │   ├── PUT /:id — Update tag
│   │   └── DELETE /:id — Delete tag
│   ├── /api/questions
│   │   ├── GET / — List questions with filters (tags, complexity, search, pagination)
│   │   ├── POST / — Create question
│   │   ├── POST /ai — Create from markdown frontmatter + bare checkboxes, base64 image, auto-create tags
│   │   ├── POST /bulk — Bulk import questions
│   │   ├── GET /:id — Get single question
│   │   ├── PUT /:id — Update question
│   │   └── DELETE /:id — Delete question
│   ├── /api/assessments
│   │   ├── GET / — List assessments (filtered, paginated)
│   │   ├── POST / — Create assessment (manual with questions list)
│   │   ├── POST /generate — Auto-generate assessment with AI
│   │   ├── GET /:id — Get assessment with questions
│   │   ├── PUT /:id — Update assessment
│   │   ├── DELETE /:id — Delete assessment
│   │   ├── POST /:id/duplicate — Clone assessment
│   │   └── GET /:id/preview — Student-facing assessment preview
│   ├── /api/classrooms
│   │   ├── GET / — List user's classrooms
│   │   ├── POST / — Create classroom (teacher only)
│   │   ├── GET /:id — Get classroom detail
│   │   ├── PUT /:id — Update classroom (teacher only)
│   │   ├── DELETE /:id — Archive classroom (teacher only)
│   │   └── POST /:id/regenerate-code — Regenerate invite code
│   ├── /api/classrooms/:id/members
│   │   ├── GET / — List classroom members
│   │   ├── POST / — Add member (teacher/invite code only)
│   │   ├── DELETE /:memberId — Remove member (teacher only)
│   │   └── PUT /:memberId — Update member role (teacher only)
│   ├── /api/classrooms/:id/posts
│   │   ├── GET / — List feed (paginated, filtered)
│   │   ├── POST / — Create post (announcement or assignment)
│   │   ├── PUT /:postId — Update post (author only)
│   │   ├── DELETE /:postId — Delete post (author only)
│   │   └── /posts/:postId/comments
│   │       ├── GET / — List threaded comments with author info
│   │       ├── POST / — Create comment with @mention extraction
│   │       ├── PUT /:commentId — Update comment (author only)
│   │       └── DELETE /:commentId — Delete comment (author only, cascade to mentions)
│   ├── /api/classrooms/:id/members/search
│   │   └── GET / — Search classroom members by name (for @mention autocomplete)
│   ├── /api/attempts
│   │   ├── POST /start — Start assessment attempt
│   │   ├── POST /:attemptId/save — Save current progress
│   │   ├── POST /:attemptId/submit — Submit assessment (atomic, no resubmit)
│   │   ├── GET /:attemptId/results — Get scores + explanations
│   │   └── GET /:attemptId/detail — Get detailed attempt with all answers
│   ├── /api/notifications (Phase 7)
│   │   ├── GET / — List user's notifications
│   │   ├── GET /unread-count — Get unread notification count
│   │   ├── PUT /:id — Mark single notification as read
│   │   └── PUT /read-all — Mark all as read
│   ├── /api/dashboard (QA Bugfix)
│   │   └── GET /stats — Get dashboard KPIs (student count, assessment count, avg score)
│   ├── /api/settings (QA Bugfix)
│   │   ├── GET / — Get user settings (profile, appearance, notifications)
│   │   └── PUT / — Update user settings
│   ├── /api/parent (Phase 8)
│   │   ├── GET /students — List linked students
│   │   ├── GET /students/:studentId/overview — KPIs + aggregated metrics
│   │   ├── GET /students/:studentId/trend — Score trend (30 days)
│   │   ├── GET /students/:studentId/tags — Per-tag performance accuracy
│   │   ├── GET /students/:studentId/activity — Recent activity feed
│   │   ├── GET /students/:studentId/history — Assessment history (paginated)
│   │   └── GET /students/:studentId/classrooms — Classroom overview
│   └── /api/upload
│       ├── POST /image — Upload image asset
│       └── GET /image/:id — Retrieve image
└── Health Check (/health)
```

### Durable Objects (Phase 7)
- **NotificationHub** — Per-classroom WebSocket connection manager
  - Accepts WebSocket connections from clients
  - Stores active client sessions mapped by userId
  - Broadcasts events to specific users or all classroom members
  - Persists across Worker request/response cycles via hibernation
  - Internal broadcast endpoint: `POST /broadcast` (called by Worker API)

### Type Safety
- Hono exports `AppType` for RPC client type inference in the web app
- Middleware attached to request context: `Variables.userId`

### Key Middleware
- **corsMiddleware** — Handles cross-origin requests
- **authMiddleware** — Extracts and validates Clerk JWT, sets userId
- **errorMiddleware** — Centralized error handling & response formatting

---

## 5. Web Frontend Architecture

### Entry Point
- `main.tsx` — Vite entry, mounts `<App>`
- `app.tsx` — Root component with Clerk provider + router setup

### Router: Code-Based TanStack Router
- `routes/router.ts` — Router definition
- `routes/root-route.tsx` — Layout outlet
- `routes/login-route.tsx` — Unauthenticated login (Clerk sign-in)
- `routes/authed-layout.tsx` — Protected routes wrapper
- `routes/dashboard-route.tsx` — Teacher/student/parent main dashboard
- `routes/placeholder-routes.tsx` — Skeleton routes for phase 2+

### Layout Components
- `layout/app-shell.tsx` — Main wrapper with sidebar + header
- `layout/sidebar.tsx` — Navigation menu (collapsible)
- `layout/header.tsx` — Top bar with user menu + notification bell (Phase 7)
- `layout/dark-mode-toggle.tsx` — Theme switcher

### Notifications (Phase 7)
- `features/notifications/notification-provider.tsx` — Provides notification context + WebSocket connection
- `features/notifications/notification-bell.tsx` — Header bell icon with unread badge
- `features/notifications/notification-panel.tsx` — Dropdown panel showing notifications
- `features/notifications/notification-item.tsx` — Individual notification card
- `features/notifications/notification-toast.tsx` — Toast for new real-time events
- `hooks/use-websocket.ts` — WebSocket connection hook with auto-reconnect + ping/pong

### Parent Dashboard (Phase 8)
- `features/dashboard/parent-dashboard-page.tsx` — Main dashboard layout with bento grid
- `features/dashboard/student-selector.tsx` — Dropdown to switch between linked children
- `features/dashboard/score-gauge-card.tsx` — Overall score KPI with radial gauge
- `features/dashboard/score-trend-chart.tsx` — Line chart showing 30-day trend
- `features/dashboard/tag-performance-chart.tsx` — Horizontal bar chart by tag accuracy
- `features/dashboard/activity-feed.tsx` — Recent assessments & classroom join events
- `features/dashboard/assessment-history-table.tsx` — Paginated table with expandable rows
- `features/dashboard/classroom-overview-card.tsx` — Classroom summary with completion rate
- `hooks/use-current-user.ts` — Current user profile hook

### UI Components (Reusable)
- `ui/card.tsx` — Card container (bento grid building block)
- `ui/badge.tsx` — Status/category badges
- `ui/page-header.tsx` — Page title + breadcrumbs
- `ui/empty-state.tsx` — Placeholder for empty lists

### API Integration
- `lib/api-client.ts` — Hono RPC client (type-safe, inferred from AppType); includes 401 token refresh retry + sanitized error messages (QA Bugfix)
- `lib/utils.ts` — Helper functions

---

## 6. Shared Package

### Constants (`src/constants/`)
- **roles.ts** — `ROLES = ["teacher", "student", "parent"]`
- **complexity.ts** — `COMPLEXITY_LEVELS = [1,2,3,4,5]`, color mapping
- **assessment-types.ts** — Assessment type options (test, quiz, practice)
- **post-types.ts** — Post type options (announcement, assessment_assignment)
- **notification-types.ts** — Notification event types

### Types (`src/types/`)
- **user-types.ts** — User profile, roles
- **question-types.ts** — Question, option, tag interfaces
- **assessment-types.ts** — Assessment, attempt, answer types
- **classroom-types.ts** — Classroom, member, post types
- **notification-types.ts** — Notification event types

### Schemas (`src/schemas/`)
- **index.ts** — Zod validation schemas for API requests/responses:
  - `createQuestionSchema`, `updateQuestionSchema`, `bulkQuestionSchema`
  - `createTagSchema`, `updateTagSchema`
  - `questionFilterSchema` (for listing with filters)
  - `hexColorSchema` (for tag colors)

---

## 7. Data Flow

### User Authentication
1. User lands on `/login` → Clerk sign-in widget
2. Clerk JWT issued after successful auth
3. JWT stored in browser (Clerk SDK manages)
4. All API requests include JWT via Authorization header
5. **authMiddleware** validates JWT, extracts Clerk user ID, sets context
6. Clerk webhook syncs user (sign-up/profile changes) to DB

### Assessment Creation & Taking
1. **Teacher creates assessment** → Web form → POST /api/assessments (with questions list)
2. **Teacher assigns to classroom** → Creates post with assessment_id + dueDate
3. **Student sees assignment** → Navigation to take assessment
4. **Assessment taking** → Read-only question view, answer selection, submit
5. **Results** → Scored immediately (if show_results = "immediately"), stored in assessmentAttempts/attemptAnswers
6. **Parent visibility** → Parent dashboard queries child's assessmentAttempts, filtered by parentDetailView config

### Notifications (Phase 7: Real-time via WebSocket)
1. **Event generation** — When comment is posted with @mention or assessment submitted, event created
2. **NotificationHub broadcast** — Worker calls NotificationHub.broadcast() with event + recipients
3. **WebSocket delivery** — All connected clients in classroom receive event in real-time via DO
4. **Notification storage** — Events persisted to notifications table for history/read status
5. **Client handling** — React component receives event → updates query cache → displays toast + increments badge
6. **Read tracking** — User clicks notification → PUT /api/notifications/:id marks as read
7. **Fallback** — GET /api/notifications endpoint for missing history on reconnect

---

## 8. Development Workflow

### Setup
```bash
pnpm install                      # Install all workspace dependencies
pnpm run dev                      # Start API (Wrangler) + Web (Vite) in parallel
pnpm run build                    # Build all apps
pnpm run lint                     # Lint code (turborepo)
pnpm run typecheck                # Type-check all (turborepo)
```

### Local Database
- SQLite during development (Cloudflare D1 in production)
- Drizzle ORM provides type-safe database layer
- Migrations via `drizzle-kit` (not yet configured, phase 1 manual schema setup)

### Code Generation
- Hono RPC client types from AppType export
- Zod runtime validation for API contracts

---

## 9. Security & Auth Strategy

### Dual Authentication (JWT + API Key)
- **Primary (JWT):** Browser-based clients authenticate via Clerk JWT issued on sign-in
- **Fallback (API Key):** Third-party tools (AI agents) authenticate via Clerk API keys stored in `users` table
- **authMiddleware** attempts JWT validation first; on failure, validates API key
- Both flows set `userId` on request context for downstream authorization
- API keys scoped to user, created/managed via `/api/users/api-keys` endpoints

### JWT Validation
- Clerk provides JWT in Authorization header (existing flow)
- **authMiddleware** validates signature using Clerk's JWKS endpoint
- Extracts user ID from JWT claims, sets as request context

### Webhook Verification
- **POST /webhook/clerk** receives user events (created, updated, deleted)
- Verifies webhook signature using Clerk secret
- Syncs user data to `users` table (insert/update/delete)

### Role-Based Access Control (RBAC)
- User roles: teacher, student, parent
- API routes enforce role checks (routes return 403 if unauthorized)
- Frontend hides/shows features by role (e.g., "Create Assessment" only for teachers)

### Token Refresh & Error Handling (QA Bugfix)
- **fetchApi** now retries on 401 responses with automatic Clerk token refresh
- Error messages sanitized to prevent leaking sensitive data (tokens, internal paths)
- **Production requirement:** Use Clerk production keys to remove "Development mode" badge

---

## 10. Markdown & Content Rendering

### Question Editor & Preview
- **react-markdown** — Renders markdown in questions and previews
- **remark-gfm** — GitHub-flavored markdown extensions (tables, strikethrough)
- **remark-math** — Math syntax support (LaTeX)
- **rehype-katex** — Renders LaTeX equations (inline & block)
- **rehype-highlight** — Syntax highlighting for code blocks
- **Image embedding** — Questions support embedded images via `/api/upload/image`

### Markdown Support in Questions
- Headings, lists, bold/italic formatting
- Code blocks with language-specific syntax highlighting
- Tables, strikethrough, task lists
- Inline & block LaTeX equations: `$x = y$` and `$$x = y$$`
- Image references: `![alt](image-id)`

---

## 11. Styling & Design System

- **Tailwind CSS v4** with CSS-based config (@theme directives)
- **Design tokens** defined in design-guidelines.md
- **Dark mode** supported (theme toggle in header)
- **Lucide icons** for consistent iconography
- **Responsive**: Mobile-first, breakpoints at 640/768/1024/1280/1440px

---

## 12. Frontend Routes & Features

### QA Bugfix — Settings & Dashboard (Apr 3, 2026)
- `/settings` — User settings page with tabs:
  - **Profile** — Name, email, role information
  - **Appearance** — Dark/light mode preference, UI customization
  - **Notifications** — Email notification preferences, notification toggles
- Features: Form validation with inline errors, settings persistence via API

### Phase 3 — Assessment Bank (Complete)
- `/assessments` — List page with filtering, sorting, pagination
- `/assessments/create` — 3-step wizard (basic info, question selection, settings)
- `/assessments/:id/preview` — Student-facing assessment preview
- `/assessments/:id/edit` — Edit assessment details
- Features: Question picker with search/filter, auto-gen config, duplicate, pagination

### Phase 4 — Classroom (Complete)
- `/classrooms` — List classrooms with create button
- `/classrooms/:id` — Detail page with 4 tabs:
  - **Feed** — Posts (announcements, assignments) with comments & threading
  - **Members** — Add/remove students/parents, manage roles
  - **Assessments** — List classroom assessments, assign new ones
  - **Settings** — Edit name/description, regenerate invite code
- Features: Invite codes, member management, post composer, comment threading

### Completed Features
- **Phase 5: Assessment Taking** — Timed assessment interface, auto-save, anti-cheat tab detection, server-validated timer with 5s grace, seeded question/option shuffle, score calculation with custom per-question scores/penalties. Teacher submission viewer with tab-switch counts.

### Planned Features (Phase 6+)
1. **Analytics & Parent Dashboards** — Teacher performance by topic, parent view of child progress
2. **AI question generation** — OpenAI API integration
3. **Real-time sync** — WebSocket for live notifications, assessment updates
4. **Manual grading** — Teacher interface for essay/short-answer questions
5. **Student reporting** — Downloadable assessment transcripts
6. **Mobile app** — React Native version sharing shared package

### External Services
- **Clerk** — Auth & user management (JWT-based, webhooks)
- **Cloudflare Workers** — API serverless hosting
- **Cloudflare D1** — SQLite database hosting
- **OpenAI API** (planned) — Question generation

---

## 13. Performance Considerations

- **TanStack Query** handles API caching, deduplication, background refetch
- **Code splitting** — TanStack Router lazy-loads routes
- **Database indexes** — On frequently queried fields (classroom_id, student_id, post_id)
- **Pagination** — Large lists (questions, assessments) paginated with cursor-based navigation

---

## 14. Monitoring & Debugging

- **Health check** — GET /health returns `{ status: "ok" }`
- **Error middleware** — Catches all errors, logs + returns 400/500 JSON responses
- **TypeScript strict mode** — Enforces type safety at compile time
- **Browser DevTools** — Inspect TanStack Query cache, Network tab for API calls

---

## Related Documents
- [`code-standards.md`](./code-standards.md) — Coding conventions & patterns
- [`design-guidelines.md`](./design-guidelines.md) — UI/UX design system
