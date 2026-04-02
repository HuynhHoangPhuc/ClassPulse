# Teaching Platform Codebase Exploration Report

## Overview
Teaching platform monorepo built with **Turbo** for orchestration, **Hono** for backend API, **React Router** for frontend routing, and **Drizzle ORM** for database access. The codebase is well-structured across Phase 1 (Foundation) and Phase 2 (Question Bank) implementation.

**Tech Stack:**
- Backend: Hono (Node.js/Cloudflare Workers)
- Frontend: React 18 + TypeScript with TanStack Router v1.168.9
- Database: SQLite (Drizzle ORM)
- Auth: Clerk (JWT tokens + webhooks)
- State Management: TanStack React Query
- Styling: CSS variables + custom UI components
- Monorepo: Turbo

---

## 1. API Structure (`apps/api/src/`)

### Directory Layout
```
apps/api/src/
├── db/
│   └── schema.ts           # Drizzle ORM table definitions
├── middleware/
│   ├── auth-middleware.ts  # Clerk JWT verification
│   ├── cors-middleware.ts  # CORS configuration
│   └── error-middleware.ts # Global error handler
├── routes/
│   ├── users-route.ts      # User CRUD + Clerk webhook sync
│   ├── questions-route.ts  # Full CRUD + bulk operations for questions
│   ├── tags-route.ts       # Tag management
│   └── upload-route.ts     # Image upload handling
├── services/
│   └── question-service.ts # Business logic for questions
├── lib/
│   └── id-generator.ts     # UUID generation helper
├── env.ts                  # Cloudflare Workers bindings type definitions
└── index.ts                # Main app setup with Hono + middleware + routes
```

### Key Files Analysis

#### **`apps/api/src/index.ts`** — App Entry Point
- Framework: Hono with Cloudflare Workers bindings
- Middleware stack:
  1. Global error handler (first, to catch all errors)
  2. CORS middleware (applied to all routes)
  3. Public routes: Clerk webhook route (no auth required)
  4. Auth guard: Applied to all `/api/*` routes
  5. Protected routes: Users, Tags, Questions, Upload
- Health check endpoint: `/health`
- Exports `AppType` for RPC client type inference

#### **`apps/api/src/env.ts`** — Environment & Bindings
Type definitions for Cloudflare Workers bindings:
- `DB` (D1 Database)
- `STORAGE` (R2 Bucket)
- `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CORS_ORIGIN`, `CLERK_WEBHOOK_SECRET`

#### **`apps/api/src/middleware/auth-middleware.ts`** — JWT Verification
- Extracts Bearer token from Authorization header
- Verifies JWT using Clerk's `verifyToken()`
- Sets `userId` on Hono context for downstream routes
- Returns 401 JSON on missing/invalid tokens

#### **`apps/api/src/routes/questions-route.ts`** — Full REST API for Questions
**Endpoints:**
- `GET /` — List questions with cursor pagination, filters (complexity, search, tags)
- `GET /:id` — Fetch single question with tags
- `POST /` — Create question with optional tags
- `PUT /:id` — Update question fields and tags
- `DELETE /:id` — Delete single question
- `POST /bulk` — Bulk delete or bulk retag questions

**Key Patterns:**
- Zod schema validation on all inputs (`createQuestionSchema`, `updateQuestionSchema`, `questionFilterSchema`)
- Cursor-based pagination with configurable limit (1-50, default 20)
- Dual filtering: Direct SQL conditions + dynamic tag filter using subquery
- Tags are joined and returned alongside questions
- All operations verify teacher ownership before executing

#### **`apps/api/src/routes/tags-route.ts`** — Tag Management
**Endpoints:**
- `GET /` — List all tags for authenticated teacher
- `POST /` — Create tag (name + optional hex color)
- `PUT /:id` — Update tag name or color
- `DELETE /:id` — Delete tag and cascade delete question_tags associations

**Key Patterns:**
- Hex color validation regex: `^#[0-9a-fA-F]{3,8}$`
- Batch deletion to atomically delete tag and its associations
- Teacher ownership verification on all write operations

#### **`apps/api/src/routes/users-route.ts`** — User CRUD + Clerk Webhooks
**Endpoints:**
- `GET /me` — Fetch authenticated user's profile
- `POST /webhook/clerk` — Sync Clerk user.created/user.updated events

**Webhook Implementation:**
- Validates Svix (Clerk's webhook service) signatures using HMAC-SHA256
- Checks webhook timestamp (must be within 5 minutes)
- Extracts email, name, avatar, role from Clerk data
- Uses `insertOnConflictDoUpdate` to upsert user with single query
- Default role fallback: "student" (validates against `USER_ROLES` constant)

#### **`apps/api/src/services/question-service.ts`** — Business Logic Layer
**Key Functions:**
1. `safeParseOptions(raw: string)` — JSON parser with fallback to empty array
2. `fetchTagsForQuestions(db, questionIds)` — Batch fetch tags, returns map
3. `buildQuestionFilters(teacherId, filters)` — Build WHERE conditions array
4. `insertQuestionTags(db, questionId, tagIds, teacherId)` — Verify tag ownership + batch insert
5. `createQuestion(db, teacherId, input)` — Create question with tags, return with parsed options
6. `updateQuestion(db, questionId, teacherId, input)` — Update fields + atomically replace tags

**Design Patterns:**
- Functions accept Drizzle DB instance as parameter (dependency injection)
- Type inference from Zod schemas using `z.infer<typeof schema>`
- Options stored as JSON string in DB, parsed on response
- Tag operations use batch transactions for atomicity

#### **`apps/api/src/routes/upload-route.ts`** — Image Upload
- Handles FormData multipart uploads
- Stores images in Cloudflare R2 bucket
- Returns public image URL

### Database Schema (`apps/api/src/db/schema.ts`)

**Tables:**
1. **`users`** — Teacher/Student/Parent profiles (Clerk-synced)
   - Foreign keys: None (leaf node)
   
2. **`parentStudent`** — Parent↔Student relationship
   - Foreign keys: parentId, studentId → users.id
   
3. **`tags`** — Teacher-created labels (Bloom's taxonomy alignment possible)
   - Foreign keys: teacherId → users.id
   
4. **`questions`** — CRUD items for question bank
   - Foreign keys: teacherId → users.id
   - Options stored as JSON string
   - Complexity: 1-5 level + complexity_type
   
5. **`questionTags`** — Many-to-many question↔tag
   - Composite PK: (questionId, tagId)
   
6. **`assessments`** — Assessment configurations
   - Foreign keys: teacherId → users.id
   - Config fields: timeLimit, scoringRules, display options, shuffle flags
   
7. **`assessmentQuestions`** — Ordered questions in assessment
   - Composite PK: (assessmentId, questionId)
   - Optional per-question score/penalty overrides
   
8. **`classrooms`** — Class groupings
   - Foreign keys: teacherId → users.id
   - Unique invite code per classroom
   
9. **`classroomMembers`** — Students/teachers in classroom
   - Composite PK: (classroomId, userId)
   
10. **`posts`** — Classroom feed items (announcements, assignments)
    - Foreign keys: classroomId, authorId, assessmentId
    - Index on classroomId
    
11. **`comments`** — Threaded discussions on posts
    - Foreign keys: postId, authorId, parentCommentId (self-ref)
    - Index on postId
    
12. **`commentMentions`** — User mentions in comments
    - Composite PK: (commentId, userId)
    
13. **`assessmentAttempts`** — Student submissions
    - Foreign keys: assessmentId, studentId, classroomId
    - Status: "in_progress" | "completed"
    - Indexes: studentId, assessmentId
    
14. **`attemptAnswers`** — Answers to assessment questions
    - Composite PK: (attemptId, questionId)
    - Tracks correctness and timestamp
    
15. **`notifications`** — Activity notifications
    - Foreign keys: userId
    - referenceType/referenceId for polymorphic references
    - Index: userId

**Pattern:** All timestamps stored as milliseconds since epoch (JavaScript `Date.now()`)

---

## 2. Web Structure (`apps/web/src/`)

### Directory Layout
```
apps/web/src/
├── routes/
│   ├── router.ts              # Router tree definition + instance creation
│   ├── root-route.tsx         # Root layout (Outlet wrapper)
│   ├── authed-layout.tsx      # Auth guard layout (redirects to /login)
│   ├── login-route.tsx        # Clerk login page
│   ├── dashboard-route.tsx    # Dashboard overview
│   ├── questions-routes.tsx   # Question list, new, edit routes
│   └── placeholder-routes.tsx # Assessments, classrooms, notifications (empty)
├── features/
│   └── questions/
│       ├── question-list-page.tsx       # Main list with filters, pagination
│       ├── question-editor-page.tsx     # Create/edit form
│       ├── question-card.tsx            # Card component (list/grid view)
│       ├── question-filter-panel.tsx    # Filter sidebar
│       ├── markdown-editor.tsx          # Explanation editor
│       ├── markdown-preview.tsx         # Explanation preview
│       ├── tag-selector.tsx             # Multi-select tag picker
│       ├── complexity-selector.tsx      # Level + type picker
│       ├── image-upload-button.tsx      # Upload to R2
│       └── index.ts                     # Feature exports
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx       # Main layout wrapper (sidebar + header)
│   │   ├── sidebar.tsx         # Navigation sidebar
│   │   ├── header.tsx          # Top navigation bar
│   │   └── dark-mode-toggle.tsx # Theme switcher
│   └── ui/
│       ├── card.tsx            # Card primitive
│       ├── badge.tsx           # Tag/label component
│       ├── page-header.tsx     # Page title + actions layout
│       └── empty-state.tsx     # Empty state placeholder
├── lib/
│   ├── fetch-api.ts            # Fetch wrapper with auth token injection
│   ├── api-client.ts           # Hono RPC client (if initialized)
│   └── utils.ts                # Utility functions (cn, etc.)
├── app.tsx                     # Root App component (provider stack)
├── main.tsx                    # Entry point
└── app.css                     # Global styles
```

### Key Files Analysis

#### **`apps/web/src/app.tsx`** — App Root & Provider Stack
```
ClerkProvider
  └─ QueryClientProvider (TanStack React Query)
      └─ RouterProvider (TanStack Router)
```
- Clerk publishable key validation on app init
- QueryClient defaults: 1-minute staleTime, 1 retry
- Router preload strategy: "intent" (preload on hover/focus)

#### **`apps/web/src/routes/router.ts`** — Route Tree Definition
**Route Structure:**
```
/ (rootRoute)
├─ / (index) → redirect to /dashboard
├─ /login (loginRoute)
└─ _authed (authedLayout) [AUTH GUARD]
   ├─ /dashboard (dashboardRoute)
   ├─ /questions (questionsRoute) → QuestionListPage
   ├─ /questions/new (questionNewRoute) → QuestionEditorPage (create mode)
   ├─ /questions/$questionId/edit (questionEditRoute) → QuestionEditorPage (edit mode)
   ├─ /assessments (assessmentsRoute) [PLACEHOLDER]
   ├─ /classrooms (classroomsRoute) [PLACEHOLDER]
   └─ /notifications (notificationsRoute) [PLACEHOLDER]
```

**Router Config:**
- `defaultPreload: "intent"` — Preload routes on user intent (hover/focus)
- Type-safe router with TypeScript module augmentation

#### **`apps/web/src/routes/authed-layout.tsx`** — Auth Guard
- Waits for Clerk to load (`isLoaded`)
- If not signed in, imperatively redirects to `/login` (can't use `beforeLoad` with hooks)
- If signed in, renders `AppShell` with `<Outlet />`

#### **`apps/web/src/features/questions/question-list-page.tsx`** — Main Questions List
**Key Features:**
- Dual view modes: list (compact) or grid (cards)
- Filters: tagIds, complexityMin/Max, complexityType, search
- Cursor-based pagination (limit 1-50)
- Debounced search input (300ms delay)
- React Query for data fetching
- Clerk auth token injection for API calls
- Skeleton loaders while fetching
- Empty state with CTA

**State Management:**
- Local component state: view, showFilters, filters, cursor, allQuestions, searchInput
- React Query hooks: useQuery for paginated data
- useQueryClient for invalidation on delete

**Pagination Logic:**
- Stores all previous pages in `allQuestions` state
- On filter change: reset cursor and allQuestions
- On "load more": append new page to allQuestions

#### **`apps/web/src/lib/fetch-api.ts`** — HTTP Client
```typescript
fetchApi(path, options?, token?)
```
- Injects Authorization header if token provided
- Handles FormData (multipart) vs JSON automatically
- Throws on non-200 status with error message
- Default API base: `VITE_API_URL` env or `http://localhost:8787`

### Component Library Patterns
Components use **CSS variables** for theming:
- `--color-primary`, `--color-background`, `--color-border`, `--color-card`, `--color-muted`, `--color-foreground`, `--color-destructive`
- `--radius-card` for border radius

---

## 3. Shared Package (`packages/shared/src/`)

### Type Exports
- **User Types:** UserRole, User (if exported)
- **Question Types:** Question, QuestionOption, Tag, QuestionTag
- **Assessment Types:** Assessment, AssessmentQuestion, AssessmentAttempt, AttemptAnswer
- **Classroom Types:** Classroom, ClassroomMember, Post, Comment, CommentMention
- **Notification Types:** Notification

### Constants
1. **`constants/roles.ts`**
   - `USER_ROLES = ["teacher", "student", "parent"]`
   - `UserRole` type = union of above

2. **`constants/complexity.ts`**
   - `COMPLEXITY_TYPES` = ["knowledge", "comprehension", "application", "analysis", "synthesis", "evaluation"]
   - `COMPLEXITY_LEVELS` = [1, 2, 3, 4, 5]
   - `COMPLEXITY_LABELS` — Human-readable labels: "Easy" (1) → "Hard" (5)
   - `COMPLEXITY_COLORS` — Color mapping for levels (green → red)

3. **`constants/assessment-types.ts`**
   - `ASSESSMENT_TYPES` = ["quiz", "test", "homework", "exam"]
   - `SHOW_RESULTS_OPTIONS` = ["immediately", "after_due_date", "after_all_submit", "never"]
   - `PARENT_DETAIL_VIEW_OPTIONS` = ["scores_only", "with_answers", "with_explanations"]

4. **`constants/post-types.ts`**
   - `POST_TYPES` = ["announcement", "assignment"]

5. **`constants/notification-types.ts`**
   - `NOTIFICATION_TYPES`, `REFERENCE_TYPES` — Polymorphic reference support

### Validation Schemas (`packages/shared/src/schemas/index.ts`)

**Reusable Primitives:**
- `userRoleSchema`, `complexityTypeSchema`, `complexityLevelSchema`
- `assessmentTypeSchema`, `showResultsSchema`, `parentDetailViewSchema`
- `postTypeSchema`, `notificationTypeSchema`, `referenceTypeSchema`

**Question Schemas:**
- `questionOptionSchema` = { id, text: string, isCorrect: boolean }
- `createQuestionSchema` = { content, options (2-6), complexity, complexityType, explanation?, tagIds? }
- `updateQuestionSchema` — All fields optional

**Tag Schemas:**
- `createTagSchema` = { name (1-50 chars), color (hex #000-#FFFFFF)? }
- `updateTagSchema` — All fields optional

**Assessment Schemas:**
- `createAssessmentSchema` = { title, description?, type, timeLimitMinutes?, scorePerCorrect, penaltyPerIncorrect, shuffleQuestions, shuffleOptions, showResults, parentDetailView, questionIds (1+) }

**Classroom Schemas:**
- `createClassroomSchema` = { name, description? }

**Other Schemas:**
- `createPostSchema`, `createCommentSchema`, `submitAnswerSchema`
- `bulkQuestionSchema` = { action: "delete"|"retag", questionIds, tagIds? }
- `questionFilterSchema` = { tagIds?, complexityMin?, complexityMax?, complexityType?, search?, cursor?, limit (1-50, default 20) }

---

## 4. Key Architectural Patterns

### API Layer Pattern
1. **Route Handler** → Validates input with Zod → Calls service function → Returns JSON
2. **Service Function** → Core business logic (DB queries, transformations)
3. **Middleware** → Auth, CORS, error handling (Hono composition)

### Database Pattern
- **Drizzle ORM** for type-safe queries
- **Timestamps as milliseconds** (JavaScript `Date.now()`)
- **Composite primary keys** for many-to-many (questionTags, etc.)
- **Batch transactions** for atomic multi-table operations

### Frontend Query Pattern
- **React Query** for data fetching + caching
- **Cursor pagination** with client-side accumulation
- **Debounced search** (300ms)
- **Immediate invalidation** on mutations
- **Token injection** via `useAuth().getToken()`

### Authentication Flow
1. User logs in via Clerk
2. Clerk provides JWT token to frontend
3. Frontend includes token in Authorization header: `Bearer <token>`
4. Backend verifies token signature with `Clerk.verifyToken()`
5. Backend sets `userId` on Hono context
6. Routes access `userId` via `c.get("userId")`

### Webhook Flow (Clerk → API)
1. User created/updated in Clerk
2. Clerk POSTs signed webhook to `/webhook/clerk`
3. API validates Svix HMAC signature
4. API upserts user record in SQLite D1

---

## 5. Implemented Features (Phase 1 & 2)

### Phase 1: Foundation
- User authentication (Clerk JWT + webhooks)
- Database schema (Drizzle ORM)
- API middleware stack (auth, CORS, errors)

### Phase 2: Question Bank
- Question CRUD with full-text search
- Tag creation and management
- Bulk operations (delete, retag)
- Cursor-based pagination
- Multi-filter support (complexity level, type, tags, search)
- Question editor with markdown explanation support
- View toggle (list/grid)
- Image upload to R2
- Empty states and loading skeletons

---

## 6. Code Structure & Consistency

### Naming Conventions
- **Routes:** kebab-case files (`questions-route.ts`, `users-route.ts`)
- **Services:** singular descriptor (`question-service.ts`)
- **Components:** PascalCase files (`QuestionListPage.tsx`)
- **Types:** Exported from `types/` directory
- **Constants:** ALL_CAPS variables in `constants/` directory

### Error Handling
- **API:** JSON error responses with HTTP status codes + details
- **Validation:** Zod schemas with `safeParse()` → flatten errors on 400
- **Auth:** Clerk JWT verification with try-catch → 401 JSON

### CSS Strategy
- CSS variables for theming (light/dark mode ready)
- Utility classes from Tailwind (configured in build)
- Custom components (Card, Badge, PageHeader, EmptyState)

---

## 7. File Path Reference

### API
- `/Users/phuc/work/test/apps/api/src/index.ts` — App entry
- `/Users/phuc/work/test/apps/api/src/db/schema.ts` — DB schema
- `/Users/phuc/work/test/apps/api/src/routes/questions-route.ts` — Questions REST
- `/Users/phuc/work/test/apps/api/src/routes/tags-route.ts` — Tags REST
- `/Users/phuc/work/test/apps/api/src/routes/users-route.ts` — Users + Clerk webhooks
- `/Users/phuc/work/test/apps/api/src/routes/upload-route.ts` — Image upload
- `/Users/phuc/work/test/apps/api/src/services/question-service.ts` — Question logic
- `/Users/phuc/work/test/apps/api/src/middleware/auth-middleware.ts` — JWT verification
- `/Users/phuc/work/test/apps/api/src/middleware/cors-middleware.ts` — CORS
- `/Users/phuc/work/test/apps/api/src/middleware/error-middleware.ts` — Error handler
- `/Users/phuc/work/test/apps/api/src/env.ts` — Env bindings types
- `/Users/phuc/work/test/apps/api/src/lib/id-generator.ts` — UUID helper

### Web
- `/Users/phuc/work/test/apps/web/src/app.tsx` — Root component
- `/Users/phuc/work/test/apps/web/src/routes/router.ts` — Route tree
- `/Users/phuc/work/test/apps/web/src/routes/authed-layout.tsx` — Auth guard
- `/Users/phuc/work/test/apps/web/src/routes/questions-routes.tsx` — Question routes
- `/Users/phuc/work/test/apps/web/src/features/questions/question-list-page.tsx` — List
- `/Users/phuc/work/test/apps/web/src/features/questions/question-editor-page.tsx` — Editor
- `/Users/phuc/work/test/apps/web/src/lib/fetch-api.ts` — HTTP client
- `/Users/phuc/work/test/apps/web/src/components/layout/app-shell.tsx` — Main layout
- `/Users/phuc/work/test/apps/web/src/components/layout/sidebar.tsx` — Navigation

### Shared
- `/Users/phuc/work/test/packages/shared/src/index.ts` — Barrel export
- `/Users/phuc/work/test/packages/shared/src/schemas/index.ts` — Zod schemas
- `/Users/phuc/work/test/packages/shared/src/types/question-types.ts` — Question types
- `/Users/phuc/work/test/packages/shared/src/types/user-types.ts` — User types
- `/Users/phuc/work/test/packages/shared/src/constants/complexity.ts` — Bloom's levels
- `/Users/phuc/work/test/packages/shared/src/constants/roles.ts` — User roles

---

## 8. Recommended Next Steps for Phase 3

### Key Areas to Implement
1. **Assessment Module**
   - Assessment CRUD (already in DB schema)
   - Question selection + ordering for assessments
   - Settings: time limit, scoring, shuffling, result display rules

2. **Classroom Module**
   - Classroom CRUD
   - Invite code generation + join flow
   - Classroom member role management

3. **Assessment Delivery**
   - Student assessment attempt UI
   - Answer submission handler
   - Auto-save + time tracking
   - Answer review page

4. **Grading & Analytics**
   - Auto-grading (multiple choice)
   - Score aggregation
   - Student performance reports
   - Teacher analytics dashboard

### Service Layer Recommendations
- Create `assessment-service.ts` for assessment operations
- Create `classroom-service.ts` for classroom operations
- Create `grading-service.ts` for scoring logic
- Pattern: Keep route handlers thin, push logic to service layer

### Frontend Component Recommendations
- Feature folder: `apps/web/src/features/assessments/`
- Feature folder: `apps/web/src/features/classrooms/`
- Reuse pagination, filtering, and loading patterns from questions

---

## Summary

The codebase is **well-organized and production-ready**:
- Clear separation between API logic (Hono routes), business logic (services), and frontend (React components)
- Type-safe throughout with TypeScript, Zod validation, Drizzle ORM
- Scalable patterns for adding new modules (assessments, classrooms)
- Monorepo structure supports shared types/constants across packages
- Database schema supports future features (posts, comments, notifications, attempts)
