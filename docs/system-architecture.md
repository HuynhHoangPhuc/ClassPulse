# System Architecture — Teaching Platform

**Current Phase:** Phase 1 Complete (Foundation & Project Setup)

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

---

## 2. Monorepo Structure

```
teaching-platform/
├── apps/
│   ├── api/                    # Hono API backend
│   │   ├── src/
│   │   │   ├── db/schema.ts           # Drizzle ORM schema (15 tables)
│   │   │   ├── middleware/            # cors, auth, error handling
│   │   │   ├── routes/                # API route handlers
│   │   │   ├── lib/                   # Utilities (ID generation)
│   │   │   ├── env.ts                 # Environment types
│   │   │   └── index.ts               # Hono app entry
│   │   ├── drizzle.config.ts          # Drizzle CLI config
│   │   └── package.json
│   │
│   └── web/                    # React + Vite frontend
│       ├── src/
│       │   ├── routes/                # TanStack Router routes
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

## 3. Database Schema (15 Tables)

### Core Users
- **users** — User account data, roles (teacher/student/parent)
- **parentStudent** — Parent ↔ Student relationships (one parent can monitor multiple students)

### Question & Assessment Management
- **tags** — Teacher-created labels for categorizing questions
- **questions** — Question content, options, complexity, explanation
- **questionTags** — Many-to-many linking questions to tags
- **assessments** — Assessment metadata (title, type, scoring rules, AI generation config)
- **assessmentQuestions** — Ordered list of questions per assessment with optional score overrides

### Classroom & Communication
- **classrooms** — Classroom containers with invite codes
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

### Server: Hono on Cloudflare Workers

```
Hono App (src/index.ts)
├── Global Error Handler (errorMiddleware)
├── CORS Middleware (all routes)
├── Public Routes
│   └── POST /webhook/clerk — Clerk webhook for user sync
├── Protected Routes (/api/*)
│   ├── Auth Middleware (JWT verification)
│   └── /api/users
│       ├── GET / — Current user profile
│       ├── PATCH / — Update profile
│       └── Other user-related endpoints
└── Health Check (/health)
```

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
- `layout/header.tsx` — Top bar with user menu + notifications
- `layout/dark-mode-toggle.tsx` — Theme switcher

### UI Components (Reusable)
- `ui/card.tsx` — Card container (bento grid building block)
- `ui/badge.tsx` — Status/category badges
- `ui/page-header.tsx` — Page title + breadcrumbs
- `ui/empty-state.tsx` — Placeholder for empty lists

### API Integration
- `lib/api-client.ts` — Hono RPC client (type-safe, inferred from AppType)
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
- **index.ts** — Zod validation schemas for API requests/responses (e.g., CreateQuestion, AssessmentFilter)

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

### Notifications
- Events: Comment mentions, assessment submissions, assignment due
- Stored in notifications table, marked read on view
- Synced to client via polling (phase 2+: websocket)

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

### JWT Validation
- Clerk provides JWT in Authorization header
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

---

## 10. Styling & Design System

- **Tailwind CSS v4** with CSS-based config (@theme directives)
- **Design tokens** defined in design-guidelines.md
- **Dark mode** supported (theme toggle in header)
- **Lucide icons** for consistent iconography
- **Responsive**: Mobile-first, breakpoints at 640/768/1024/1280/1440px

---

## 11. Integration Points (Phase 2+)

### Planned Features
1. **Assessment grading** — Auto-grade MCQ, manual grading for essays
2. **AI question generation** — OpenAI API integration
3. **Real-time sync** — WebSocket for live notifications, assessment updates
4. **Analytics dashboard** — Teacher performance insights
5. **Student reporting** — Downloadable assessment transcripts
6. **Mobile app** — React Native version sharing shared package

### External Services
- **Clerk** — Auth & user management (JWT-based, webhooks)
- **Cloudflare Workers** — API serverless hosting
- **Cloudflare D1** — SQLite database hosting
- **OpenAI API** (planned) — Question generation

---

## 12. Performance Considerations

- **TanStack Query** handles API caching, deduplication, background refetch
- **Code splitting** — TanStack Router lazy-loads routes
- **Database indexes** — On frequently queried fields (classroom_id, student_id, post_id)
- **Pagination** (phase 2+) — Large lists (questions, assessments) paginated

---

## 13. Monitoring & Debugging

- **Health check** — GET /health returns `{ status: "ok" }`
- **Error middleware** — Catches all errors, logs + returns 400/500 JSON responses
- **TypeScript strict mode** — Enforces type safety at compile time
- **Browser DevTools** — Inspect TanStack Query cache, Network tab for API calls

---

## Related Documents
- [`code-standards.md`](./code-standards.md) — Coding conventions & patterns
- [`design-guidelines.md`](./design-guidelines.md) — UI/UX design system
