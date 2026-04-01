# Phase 1: Foundation & Project Setup

## Context

- [Brainstorm](../reports/brainstorm-260401-1835-teaching-platform.md) — monorepo structure, tech stack
- [Design Guidelines](../../docs/design-guidelines.md) — color tokens, typography, layout system

## Overview

- **Priority**: P1 (blocking all other phases)
- **Status**: Complete
- **Effort**: 12h
- **Description**: Scaffold Turborepo monorepo, configure Hono API + React SPA + shared package, setup D1 schema with Drizzle, integrate Clerk auth, implement base layout with design system tokens.

## Key Insights

- Hono RPC gives end-to-end type safety between API and SPA — configure early
- D1 schema should include ALL tables upfront (even if UI comes later) to avoid migration headaches
- Clerk webhook syncs users to D1 — critical for foreign key integrity
- shadcn/ui components should be initialized with custom theme tokens from design guidelines

## Requirements

### Functional
- Turborepo monorepo with apps/web, apps/api, packages/shared
- Hono API with CORS, auth middleware, error handling
- React SPA with routing, auth guard, role-based layouts
- Full D1 schema (all 13 tables from brainstorm)
- Clerk Google login working end-to-end
- User sync via Clerk webhook → D1

### Non-Functional
- TypeScript strict mode across all packages
- Type-safe API calls via Hono RPC client
- Shared Zod schemas between frontend and backend
- Dev server with hot reload for both apps
- Wrangler local dev with D1 local database

## Architecture

```
teaching-platform/
├── apps/
│   ├── web/                    # React SPA → CF Pages
│   │   ├── src/
│   │   │   ├── components/     # Shared UI components
│   │   │   │   ├── ui/         # shadcn/ui components
│   │   │   │   └── layout/     # Shell, sidebar, header
│   │   │   ├── features/       # Feature modules (empty, scaffolded)
│   │   │   ├── hooks/          # Custom hooks
│   │   │   ├── lib/            # Utils, API client, constants
│   │   │   ├── routes/         # TanStack Router file-based routes
│   │   │   └── main.tsx
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   └── api/                    # Hono API → CF Workers
│       ├── src/
│       │   ├── routes/         # Route handlers (scaffolded)
│       │   ├── middleware/
│       │   │   ├── auth-middleware.ts      # Clerk JWT verification
│       │   │   ├── cors-middleware.ts      # CORS config
│       │   │   └── error-middleware.ts     # Global error handler
│       │   ├── services/       # Business logic (empty)
│       │   ├── db/
│       │   │   ├── schema.ts              # Drizzle schema (all tables)
│       │   │   └── migrations/            # Generated migrations
│       │   ├── lib/
│       │   │   └── id-generator.ts        # nanoid for primary keys
│       │   └── index.ts                   # Hono app entry
│       ├── wrangler.toml
│       └── tsconfig.json
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   │   ├── user-types.ts
│       │   │   ├── question-types.ts
│       │   │   ├── assessment-types.ts
│       │   │   ├── classroom-types.ts
│       │   │   └── notification-types.ts
│       │   ├── schemas/        # Zod validation schemas
│       │   │   └── index.ts
│       │   ├── constants/
│       │   │   ├── roles.ts
│       │   │   ├── complexity.ts
│       │   │   └── assessment-types.ts
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── .gitignore
```

## Related Code Files

### Files to Create
- `package.json` — root workspace config
- `pnpm-workspace.yaml` — workspace definition
- `turbo.json` — Turborepo pipeline config
- `.gitignore`
- `apps/web/*` — full React SPA scaffold
- `apps/api/*` — full Hono API scaffold
- `packages/shared/*` — shared types and schemas

## Implementation Steps

### 1. Monorepo Scaffold (1h)

1. `pnpm init` at root, configure workspaces
2. Create `pnpm-workspace.yaml`:
   ```yaml
   packages:
     - "apps/*"
     - "packages/*"
   ```
3. Create `turbo.json` with pipelines: `build`, `dev`, `lint`, `typecheck`
4. Add root scripts: `dev`, `build`, `lint`, `typecheck`

### 2. Shared Package (1h)

1. Create `packages/shared/package.json` with `zod` dependency
2. Define TypeScript types matching brainstorm data model:
   - `UserRole`: `teacher | student | parent`
   - `ComplexityType`: `knowledge | comprehension | application | analysis | synthesis | evaluation`
   - `AssessmentType`: `test | quiz | practice`
   - `ShowResults`: `immediately | after_due | never`
   - `PostType`: `announcement | assessment_assignment`
   - `NotificationType`: `mention | comment_reply | assessment_assigned | assessment_submitted | announcement`
3. Define Zod schemas for API request/response validation
4. Export constants (complexity levels, role definitions)

### 3. Hono API Setup (3h)

1. Create `apps/api/package.json` with deps:
   - `hono`, `drizzle-orm`, `@clerk/backend`, `zod`, `nanoid`
   - Dev: `wrangler`, `drizzle-kit`, `typescript`
2. Create `wrangler.toml`:
   ```toml
   name = "teaching-api"
   compatibility_date = "2024-09-25"
   
   [[d1_databases]]
   binding = "DB"
   database_name = "teaching-db"
   database_id = "local"
   
   [[r2_buckets]]
   binding = "STORAGE"
   bucket_name = "teaching-storage"
   
   [durable_objects]
   bindings = [
     { name = "NOTIFICATION_HUB", class_name = "NotificationHub" }
   ]
   
   [[migrations]]
   tag = "v1"
   new_classes = ["NotificationHub"]
   ```
3. Create `src/index.ts` — Hono app with middleware chain:
   ```typescript
   const app = new Hono<{ Bindings: Env }>()
     .use('*', corsMiddleware())
     .use('/api/*', authMiddleware())
     .route('/api/users', usersRoute)
     // ... more routes added in later phases
   ```
4. Create auth middleware: verify Clerk JWT, extract userId, attach to context
5. Create CORS middleware: allow Pages domain
6. Create error middleware: catch errors, return JSON responses
7. Create Clerk webhook handler at `/webhooks/clerk` for user sync

### 4. D1 Database Schema (2h)

Create `apps/api/src/db/schema.ts` with ALL tables using Drizzle:

```typescript
// All 13 tables from brainstorm data model
export const users = sqliteTable('users', { ... })
export const parentStudent = sqliteTable('parent_student', { ... })
export const tags = sqliteTable('tags', { ... })
export const questions = sqliteTable('questions', { ... })
export const questionTags = sqliteTable('question_tags', { ... })
export const assessments = sqliteTable('assessments', { ... })
export const assessmentQuestions = sqliteTable('assessment_questions', { ... })
export const classrooms = sqliteTable('classrooms', { ... })
export const classroomMembers = sqliteTable('classroom_members', { ... })
export const posts = sqliteTable('posts', { ... })
export const comments = sqliteTable('comments', { ... })
export const commentMentions = sqliteTable('comment_mentions', { ... })
export const assessmentAttempts = sqliteTable('assessment_attempts', { ... })
export const attemptAnswers = sqliteTable('attempt_answers', { ... })
export const notifications = sqliteTable('notifications', { ... })
```

- Use `text` for IDs (nanoid), timestamps as `integer` (unix epoch)
- JSON columns stored as `text` (D1 SQLite limitation)
- Run `drizzle-kit generate` to create migration files
- Run `wrangler d1 migrations apply` for local DB

### 5. React SPA Setup (3h)

1. Create `apps/web` with Vite + React 19 + TypeScript
2. Install deps:
   - `react`, `react-dom`, `@tanstack/react-router`, `@tanstack/react-query`
   - `@clerk/clerk-react`, `tailwindcss@4`, `lucide-react`
   - `hono` (for RPC client type inference)
3. Configure Tailwind v4 with design system tokens:
   - Colors from design guidelines (primary, secondary, accent, etc.)
   - Font families: Outfit (heading), Inter (sans), JetBrains Mono (mono)
   - Border radius scale, spacing scale
4. Initialize shadcn/ui with custom theme matching design guidelines
5. Setup TanStack Router with file-based routing:
   ```
   routes/
   ├── __root.tsx           # Root layout
   ├── _authed.tsx          # Auth guard layout
   ├── _authed/
   │   ├── dashboard.tsx    # Role-based dashboard
   │   ├── questions/       # Question bank (Phase 2)
   │   ├── assessments/     # Assessment bank (Phase 3)
   │   ├── classrooms/      # Classrooms (Phase 4)
   │   └── notifications.tsx # Notifications (Phase 7)
   ├── login.tsx            # Login page
   └── index.tsx            # Redirect to /dashboard
   ```
6. Create Hono RPC client in `src/lib/api-client.ts`:
   ```typescript
   import { hc } from 'hono/client'
   import type { AppType } from '@teaching/api'
   export const api = hc<AppType>(import.meta.env.VITE_API_URL)
   ```
7. Wrap app with Clerk provider + TanStack QueryClient + Router

### 6. Base Layout & Design System (2h)

1. Create app shell component:
   - Sidebar navigation (collapsible, 256px/72px)
   - Header bar (64px) with user avatar, role badge, notification bell
   - Main content area with max-width 1200px
2. Implement role-based navigation:
   - **Teacher**: Dashboard, Questions, Assessments, Classrooms, Settings
   - **Student**: Dashboard, Classrooms, Assessments
   - **Parent**: Dashboard, Classrooms
3. Create reusable components matching design guidelines:
   - `Card` (standard, glass, accent variants)
   - `Badge` (tag, complexity, status variants)
   - `EmptyState` (illustration + headline + CTA pattern)
   - `PageHeader` (title + description + actions)
4. Implement dark mode toggle with `prefers-color-scheme` detection
5. Create login page: gradient bg + centered glass card + Clerk `<SignIn />`
6. Create placeholder dashboard page per role

## Todo

- [x] Init Turborepo monorepo with pnpm workspaces
- [x] Create shared package with types, schemas, constants
- [x] Scaffold Hono API with middleware chain
- [x] Create D1 schema with all 13 tables via Drizzle
- [x] Run initial migration on local D1
- [x] Setup Clerk webhook for user sync
- [x] Scaffold React SPA with Vite + TanStack Router
- [x] Configure Tailwind v4 with design system tokens
- [x] Init shadcn/ui with custom theme
- [x] Create Hono RPC client for type-safe API calls (deferred to Phase 2 — CF types don't resolve across monorepo boundary for now)
- [x] Build app shell (sidebar + header + content area)
- [x] Implement role-based routing and navigation
- [x] Create login page with Clerk Google auth
- [x] Create placeholder dashboards per role
- [x] Verify dev server (both apps) with hot reload
- [x] Verify Clerk login → user sync → D1 end-to-end

## Success Criteria

- `pnpm dev` starts both API and web with hot reload
- Clerk Google login works, user synced to D1
- Role-based sidebar navigation renders correctly per role
- Hono RPC client provides autocomplete in frontend
- All 13 tables created in D1 with correct relations
- Design tokens (colors, fonts, spacing) match design guidelines
- Dark mode toggle works
- TypeScript strict mode passes across all packages

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Hono RPC type inference breaks across monorepo | High | Use `tsconfig` project references, verify in CI |
| D1 migration issues with complex schema | Medium | Start simple, add indexes incrementally |
| Clerk webhook unreliable in dev | Low | Add manual sync endpoint for development |
| Tailwind v4 breaking changes vs shadcn/ui | Medium | Pin versions, test component rendering early |

## Security

- Clerk JWT verified on every `/api/*` request
- Webhook endpoint validates Clerk signature
- CORS restricted to Pages domain
- No API keys in frontend code (Clerk publishable key only)
- Rate limiting middleware on auth-sensitive routes

## Next Steps

- Phase 2 builds question CRUD on this foundation
- Phase 4 can start in parallel with Phase 2 (both depend only on Phase 1)
