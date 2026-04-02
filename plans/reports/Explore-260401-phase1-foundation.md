# Phase 1 Foundation Setup Exploration Report

**Date:** April 1, 2026  
**Thoroughness:** Complete - all key files read in full

---

## 1. MONOREPO STRUCTURE

**Root-level orchestration:**
- **pnpm workspaces** configured in `pnpm-workspace.yaml` with two top-level globs:
  - `apps/*` (api, web)
  - `packages/*` (shared)
- **Turbo** manages task pipeline (build, dev, lint, typecheck)
  - `dev` marked as non-cached, persistent
  - `build` depends on `^build` for proper ordering
  - `lint` and `typecheck` depend on `^build`

**Directory layout:**
```
/apps/api/          → Cloudflare Worker backend (Hono + D1 + R2)
/apps/web/          → React frontend (Vite + TanStack Router/Query)
/packages/shared/   → Shared types, constants, Zod schemas
```

**Package management:**
- pnpm 9.15.0 required (specified in root package.json)
- All apps reference `@teaching/shared` via workspace protocol (`workspace:*`)
- TypeScript 5.7.0 across all packages

---

## 2. API SETUP (apps/api)

### Entry Point & Route Registration

**File:** `src/index.ts`

```typescript
type Variables = { userId: string };
const app = new Hono<Env & { Variables: Variables }>();

// Global error handler (must be first)
app.onError(errorMiddleware);

// CORS (applied to all routes)
app.use("*", corsMiddleware());

// Public routes (no auth required)
app.route("/webhook/clerk", clerkWebhookRoute);

// Auth guard for /api/* routes
app.use("/api/*", authMiddleware);

// Protected API routes
const routes = app.route("/api/users", usersRoute);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Export AppType for RPC client type inference
export type AppType = typeof routes;
export default app;
```

**Key patterns:**
- Hono context typed with `Env & { Variables }` for type-safe bindings
- Middleware registration order: error → CORS → public routes → auth → protected routes
- Health check unprotected at `/health`
- `AppType` exported for Hono RPC client generation

### Middleware Stack

**CORS Middleware** (`src/middleware/cors-middleware.ts`)
- Factory pattern: reads `CORS_ORIGIN` from env at request time
- Allows: GET, POST, PUT, DELETE, OPTIONS
- Headers: Authorization, Content-Type
- Max age: 86400 seconds

**Auth Middleware** (`src/middleware/auth-middleware.ts`)
- Uses `@clerk/backend` for JWT verification
- Extracts Bearer token from Authorization header
- Verifies with Clerk using `CLERK_SECRET_KEY`
- Sets `userId` on context from token's `sub` claim
- Returns 401 JSON on missing/invalid token

**Error Middleware** (`src/middleware/error-middleware.ts`)
- ZodError → 400 with field-level validation messages
- HTTPException → preserves status code
- Other errors → 500 with generic message
- All responses are JSON

### Routes

**Users Route** (`src/routes/users-route.ts`)

Two sub-routes:

1. **GET /api/users/me** (protected)
   - Returns authenticated user from D1
   - Queries `users` table by `userId` from context

2. **POST /webhook/clerk** (public)
   - Listens to `user.created` and `user.updated` events
   - Verifies Svix HMAC signature (if `CLERK_WEBHOOK_SECRET` set)
   - Timestamp validation: must be within 5 minutes
   - Signature verification: parses base64-encoded secret, computes HMAC-SHA256
   - Syncs user to D1 using upsert:
     ```typescript
     await db.insert(users).values({...})
       .onConflictDoUpdate({
         target: users.id,
         set: { /* updated fields */ }
       });
     ```
   - Extracts role from `public_metadata.role` with validation against `USER_ROLES`
   - Defaults to "student" if role invalid

**Existing API routes:** Only `/api/users` mounted  
**Health check:** `/health` unprotected

---

## 3. DATABASE SCHEMA (Drizzle ORM)

**File:** `src/db/schema.ts`  
**Migration:** `src/db/migrations/0000_quick_shatterstar.sql`  
**Dialect:** SQLite (Cloudflare D1)

### Tables & Relationships

#### Core User Management
- **users** (primary key: id)
  - Fields: id (text/Clerk ID), email, name, avatarUrl, role, createdAt, updatedAt
  - Type: `InferSelectModel<typeof users>`

- **parentStudent** (composite key: parentId + studentId)
  - Tracks parent-child relationships
  - Both IDs reference `users.id`

#### Question Bank
- **questions** (primary key: id)
  - Fields: id, teacherId, content, options (JSON string), complexity (1-5), complexityType, explanation, createdAt, updatedAt
  - Referenced by: assessmentQuestions, attemptAnswers

- **tags** (primary key: id)
  - Fields: id, name, teacherId, color, createdAt
  - Teacher-owned labels for organizing questions

- **questionTags** (composite key: questionId + tagId)
  - Many-to-many relationship with unique constraint

#### Assessments & Grading
- **assessments** (primary key: id)
  - Fields: id, teacherId, title, description, type, timeLimitMinutes, scorePerCorrect, penaltyPerIncorrect, shuffleQuestions, shuffleOptions, showResults ("immediately"/"after_due"/"never"), parentDetailView ("scores_only"/"full_detail"), generationConfig (JSON), createdAt, updatedAt

- **assessmentQuestions** (composite key: assessmentId + questionId)
  - Ordered by `orderIndex`
  - Allows per-question score/penalty overrides via `customScore`, `customPenalty`

- **assessmentAttempts** (primary key: id)
  - Fields: id, assessmentId, studentId, classroomId, startedAt, submittedAt, isAutoSubmitted, score, totalPossible, status ("in_progress"/"submitted"/"graded")
  - Indexes on: studentId, assessmentId

- **attemptAnswers** (composite key: attemptId + questionId)
  - Fields: attemptId, questionId, selectedOptionId, isCorrect, answeredAt
  - Tracks individual question responses

#### Classroom & Collaboration
- **classrooms** (primary key: id)
  - Fields: id, teacherId, name, description, inviteCode (unique), createdAt, updatedAt

- **classroomMembers** (composite key: classroomId + userId)
  - Fields: classroomId, userId, role, joinedAt

- **posts** (primary key: id)
  - Fields: id, classroomId, authorId, type, title, content, assessmentId (nullable), dueDate, createdAt, updatedAt
  - Index on: classroomId

- **comments** (primary key: id)
  - Fields: id, postId, authorId, parentCommentId (nullable, self-ref), content, createdAt, updatedAt
  - Index on: postId
  - Supports nested/threaded comments

- **commentMentions** (composite key: commentId + userId)
  - Tracks @mentions in comments

#### Notifications
- **notifications** (primary key: id)
  - Fields: id, userId, type, referenceType, referenceId, message, isRead, createdAt
  - Index on: userId
  - Types: "mention", "comment_reply", "assessment_assigned", "assessment_submitted", "announcement"

### Inferred Types
All tables have corresponding Drizzle-generated types exported (User, Tag, Question, etc.)

---

## 4. ENVIRONMENT & WRANGLER CONFIGURATION

**File:** `apps/api/wrangler.toml`

```toml
name = "teaching-api"
main = "src/index.ts"
compatibility_date = "2024-09-25"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "teaching-db"
database_id = "local"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "teaching-storage"

[vars]
CLERK_PUBLISHABLE_KEY = ""
CORS_ORIGIN = "http://localhost:5173"
# CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET: use `wrangler secret put` or .dev.vars
```

**File:** `src/env.ts` (Hono type bindings)

```typescript
export type Env = {
  Bindings: {
    DB: D1Database;
    STORAGE: R2Bucket;
    CLERK_PUBLISHABLE_KEY: string;
    CLERK_SECRET_KEY: string;
    CORS_ORIGIN: string;
    CLERK_WEBHOOK_SECRET?: string;
  };
};
```

**Configuration notes:**
- D1 database binding name: `DB`, local database named `teaching-db`
- R2 bucket binding name: `STORAGE`, bucket: `teaching-storage`
- Secrets managed via `wrangler secret put` (not in config)
- Dev server runs on Cloudflare's local wrangler
- Node.js compatibility enabled for crypto/utilities

---

## 5. AUTH MIDDLEWARE (Clerk Integration)

**Implementation pattern:**
1. Frontend sends Bearer token in Authorization header after Clerk sign-in
2. Backend verifies token using `@clerk/backend`'s `verifyToken(token, { secretKey })`
3. Payload contains `sub` (user ID) which is stored in context
4. Webhook syncs Clerk user events to D1 database

**Security patterns:**
- Bearer token verification at route level via middleware
- Svix HMAC signature validation for webhook events
- Timestamp anti-replay check (5-minute window)
- Role validation against whitelist before database sync

**User sync flow:**
- Clerk event → webhook handler
- Extract email, name, image, role from Clerk metadata
- Upsert into D1 (create if new, update if exists)
- Role defaults to "student" if not valid

---

## 6. FRONTEND SETUP (apps/web)

### Root Structure

**File:** `src/main.tsx`
- Mounts React app to `#root` DOM element

**File:** `src/app.tsx` (Provider Stack)
```typescript
<ClerkProvider publishableKey={...}>
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
</ClerkProvider>
```

**Provider configuration:**
- Clerk: requires `VITE_CLERK_PUBLISHABLE_KEY` env var
- React Query: staleTime 1 minute, retry 1, default cache behavior
- TanStack Router: default preload "intent" (on link hover)

### TanStack Router Setup

**File:** `src/routes/router.ts`

```typescript
const routeTree = rootRoute.addChildren([
  indexRoute,      // / → redirect to /dashboard
  loginRoute,      // /login
  authedLayout.addChildren([
    dashboardRoute,      // /dashboard
    questionsRoute,      // /questions
    assessmentsRoute,    // /assessments
    classroomsRoute,     // /classrooms
    notificationsRoute,  // /notifications
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});
```

**Route patterns:**

1. **Root Route** (`root-route.tsx`)
   - Wraps entire app tree
   - Simple `<Outlet />` layout

2. **Login Route** (`login-route.tsx`)
   - Public path at `/login`
   - Clerk's `<SignIn routing="hash" />` component
   - Styled with glass morphism (Tailwind + inline styles)
   - Custom Clerk appearance config (transparent card, white text inputs)

3. **Authed Layout** (`authed-layout.tsx`)
   - Guards all `/api/*` routes
   - Checks `useAuth().isSignedIn` and `isLoaded`
   - Shows loading spinner while Clerk initializes
   - Redirects to `/login` if not signed in
   - Wraps children with `<AppShell>`

4. **Dashboard Route** (`dashboard-route.tsx`)
   - Protected: nests under authedLayout
   - Role-based rendering: teacher (KPI cards) vs student vs parent
   - Role currently hardcoded to "teacher" (TODO: derive from Clerk metadata)
   - Shows placeholder content for each role

5. **Placeholder Routes** (`placeholder-routes.tsx`)
   - Questions, Assessments, Classrooms, Notifications
   - All marked as Phase 2+ (coming soon)
   - Show `EmptyState` with icon and description

### App Shell & Layout Components

**File:** `src/components/layout/app-shell.tsx`
```typescript
<div className="flex h-screen overflow-hidden">
  <Sidebar role={role} mobileOpen={mobileOpen} onMobileClose={onMobileClose} />
  <div className="flex flex-col flex-1">
    <Header onMenuClick={() => setMobileOpen()} />
    <main className="flex-1 overflow-y-auto">
      {/* Page content */}
    </main>
  </div>
</div>
```

**Sidebar** (`src/components/layout/sidebar.tsx`)
- Collapsible sidebar with role-based nav items
- Desktop (md+): always visible with collapse toggle
- Mobile: slides in/out via controlled state
- Active link styling with color-mix
- Nav items per role:
  - **Teacher:** Dashboard, Questions, Assessments, Classrooms, Settings
  - **Student:** Dashboard, Classrooms, Assessments
  - **Parent:** Dashboard, Classrooms
- Logo area matches header height (--header-height)

**Header** (`src/components/layout/header.tsx`)
- Fixed height: `var(--header-height)`
- Left: mobile menu toggle (md:hidden) + optional page title
- Right: dark mode toggle + notifications bell + Clerk UserButton
- Responsive layout with proper spacing

**Dark Mode Toggle** (`src/components/layout/dark-mode-toggle.tsx`)
- Persists preference to localStorage ("dark" / "light")
- Falls back to OS prefers-color-scheme on first visit
- Toggles `.dark` class on `<html>`
- Manual localStorage sync in useEffect

### Design System & Styling

**File:** `src/app.css` (Tailwind @theme)

**Color tokens (light mode):**
- Primary: #6366F1 (indigo)
- Secondary: #8B5CF6 (purple)
- Accent: #F97316 (orange)
- Background: #FAFAFE (very light)
- Foreground: #0F172A (dark slate)
- Card: #FFFFFF
- Border: #E2E8F0
- Success: #10B981 (green)
- Warning: #F59E0B (amber)
- Info: #06B6D4 (cyan)
- Destructive: #EF4444 (red)

**Dark mode overrides:**
- Primary: #818CF8 (lighter indigo)
- Background: #0B0F1A (very dark)
- Card: #151A2D
- Border: rgba(255, 255, 255, 0.08)

**Typography:**
- Heading: "Outfit" (sans-serif)
- Body: "Inter" (sans-serif)
- Mono: "JetBrains Mono" (monospace)

**Layout tokens:**
- Sidebar width: 256px (collapsed: 72px)
- Header height: 64px
- Content max width: 1200px
- Border radius: card 16px, button 12px, input 10px, badge 8px

### UI Components

**Badge** (`src/components/ui/badge.tsx`)
- Variants: default, secondary, destructive, success, warning
- Uses CSS custom properties for color inheritance
- Inline-flex with px-2.5 py-0.5 padding

**Card** (`src/components/ui/card.tsx`)
- Variants: standard (solid), glass (frosted), accent (tinted)
- Standard: solid background with border and shadow-sm
- Glass: white/10 with backdrop-blur-md and white borders
- Accent: colored background at 10% opacity

**PageHeader** (`src/components/ui/page-header.tsx`)
- Title + description + optional actions slot
- Flexbox with gap-4, responsive alignment
- Uses font-heading for title

**EmptyState** (`src/components/ui/empty-state.tsx`)
- Icon + headline + description + optional action
- Centered flex column with dashed border
- Muted background for icon container

### Utility Functions

**File:** `src/lib/utils.ts`

```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Merges Tailwind classes with conflict resolution using clsx + tailwind-merge.

### API Client Setup

**File:** `src/lib/api-client.ts`

```typescript
const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8787";
export const api = hc<Hono>(apiUrl);
```

**Current state:**
- Uses base Hono type for now
- Comment indicates Phase 2 plan: import `AppType` from `@teaching/api`
- Type-safe RPC awaiting CF module boundary resolution

**Development:**
- API URL defaults to `http://localhost:8787` (Wrangler dev server)
- Environment variable: `VITE_API_URL`

### Build & Dev Configuration

**File:** `vite.config.ts`
```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { port: 5173 },
});
```

**TypeScript** (`tsconfig.json`)
- Extends base config
- JSX: react-jsx
- Paths: `@/*` → `./src/*`, `@teaching/shared` → monorepo package
- No emit (tsc --noEmit for typecheck)
- Allows importing .ts extensions (for monorepo packages)

---

## 7. SHARED PACKAGE (packages/shared)

### Index & Exports

**File:** `src/index.ts`

Exports organized in three sections:
1. Constants (roles, complexity, assessment types, post types, notification types)
2. Types (user, question, assessment, classroom, notification)
3. Zod Schemas (validation schemas)

### Constants

**roles.ts:**
```typescript
export const USER_ROLES = ["teacher", "student", "parent"] as const;
export type UserRole = typeof USER_ROLES[number];
```

**complexity.ts:**
```typescript
export const COMPLEXITY_TYPES = ["knowledge", "comprehension", "application", "analysis", "synthesis", "evaluation"];
export const COMPLEXITY_LEVELS = [1, 2, 3, 4, 5];
// COMPLEXITY_LABELS: 1→"Easy", 2→"Medium-Easy", 3→"Medium", 4→"Medium-Hard", 5→"Hard"
// COMPLEXITY_COLORS: gradient from green (1) to pink (5)
```

**assessment-types.ts:**
```typescript
export const ASSESSMENT_TYPES = ["test", "quiz", "practice"];
export const SHOW_RESULTS_OPTIONS = ["immediately", "after_due", "never"];
export const PARENT_DETAIL_VIEW_OPTIONS = ["scores_only", "full_detail"];
export const ATTEMPT_STATUSES = ["in_progress", "submitted", "graded"];
```

**post-types.ts:**
```typescript
export const POST_TYPES = ["announcement", "assessment_assignment"];
```

**notification-types.ts:**
```typescript
export const NOTIFICATION_TYPES = ["mention", "comment_reply", "assessment_assigned", "assessment_submitted", "announcement"];
export const REFERENCE_TYPES = ["post", "comment", "assessment"];
```

### Types

**user-types.ts:**
```typescript
export interface User {
  id: string; email: string; name: string;
  avatarUrl: string | null; role: UserRole;
  createdAt: number; updatedAt: number;
}

export interface ParentStudent {
  id: string; parentId: string; studentId: string; createdAt: number;
}
```

**question-types.ts:**
```typescript
export interface QuestionOption {
  id: string; text: string; isCorrect: boolean;
}

export interface Question {
  id: string; teacherId: string; content: string;
  options: QuestionOption[]; complexity: ComplexityLevel;
  complexityType: ComplexityType; explanation: string | null;
  createdAt: number; updatedAt: number;
}

export interface Tag {
  id: string; name: string; teacherId: string;
  color: string | null; createdAt: number;
}

export interface QuestionTag {
  questionId: string; tagId: string;
}
```

**assessment-types.ts:**
```typescript
export interface Assessment {
  id: string; teacherId: string; title: string; description: string | null;
  type: AssessmentType; timeLimitMinutes: number | null;
  scorePerCorrect: number; penaltyPerIncorrect: number;
  shuffleQuestions: boolean; shuffleOptions: boolean;
  showResults: ShowResults; parentDetailView: ParentDetailView;
  generationConfig: string | null; createdAt: number; updatedAt: number;
}

export interface AssessmentQuestion {
  assessmentId: string; questionId: string;
  orderIndex: number; customScore: number | null;
  customPenalty: number | null;
}

export interface AssessmentAttempt {
  id: string; assessmentId: string; studentId: string;
  classroomId: string; startedAt: number; submittedAt: number | null;
  isAutoSubmitted: boolean; score: number | null;
  totalPossible: number | null; status: AttemptStatus;
}

export interface AttemptAnswer {
  attemptId: string; questionId: string;
  selectedOptionId: string; isCorrect: boolean; answeredAt: number;
}
```

**classroom-types.ts:**
```typescript
export interface Classroom {
  id: string; teacherId: string; name: string;
  description: string | null; inviteCode: string;
  createdAt: number; updatedAt: number;
}

export interface ClassroomMember {
  classroomId: string; userId: string; role: UserRole; joinedAt: number;
}

export interface Post {
  id: string; classroomId: string; authorId: string;
  type: PostType; title: string; content: string | null;
  assessmentId: string | null; dueDate: number | null;
  createdAt: number; updatedAt: number;
}

export interface Comment {
  id: string; postId: string; authorId: string;
  parentCommentId: string | null; content: string;
  createdAt: number; updatedAt: number;
}

export interface CommentMention {
  commentId: string; userId: string;
}
```

**notification-types.ts:**
```typescript
export interface Notification {
  id: string; userId: string; type: NotificationType;
  referenceType: ReferenceType; referenceId: string;
  message: string; isRead: boolean; createdAt: number;
}
```

### Zod Schemas

**File:** `src/schemas/index.ts`

Request validation schemas:

```typescript
// Primitives
export const userRoleSchema = z.enum(USER_ROLES);
export const complexityTypeSchema = z.enum(COMPLEXITY_TYPES);
export const complexityLevelSchema = z.union([z.literal(1), z.literal(2), ...]);
export const assessmentTypeSchema = z.enum(ASSESSMENT_TYPES);
export const showResultsSchema = z.enum(SHOW_RESULTS_OPTIONS);
export const parentDetailViewSchema = z.enum(PARENT_DETAIL_VIEW_OPTIONS);
export const postTypeSchema = z.enum(POST_TYPES);
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export const referenceTypeSchema = z.enum(REFERENCE_TYPES);

// Question option
export const questionOptionSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

// Request schemas
export const createQuestionSchema = z.object({
  content: z.string().min(1),
  options: z.array(questionOptionSchema).min(2).max(6),
  complexity: complexityLevelSchema,
  complexityType: complexityTypeSchema,
  explanation: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
});

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().nullable().optional(),
});

export const createAssessmentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  type: assessmentTypeSchema,
  timeLimitMinutes: z.number().int().positive().nullable().optional(),
  scorePerCorrect: z.number().default(1),
  penaltyPerIncorrect: z.number().default(0),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  showResults: showResultsSchema.default("immediately"),
  parentDetailView: parentDetailViewSchema.default("scores_only"),
  questionIds: z.array(z.string()).min(1),
});

export const createClassroomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
});

export const createPostSchema = z.object({
  classroomId: z.string(),
  type: postTypeSchema,
  title: z.string().min(1).max(200),
  content: z.string().nullable().optional(),
  assessmentId: z.string().nullable().optional(),
  dueDate: z.number().nullable().optional(),
});

export const createCommentSchema = z.object({
  postId: z.string(),
  parentCommentId: z.string().nullable().optional(),
  content: z.string().min(1),
  mentionUserIds: z.array(z.string()).optional(),
});

export const submitAnswerSchema = z.object({
  questionId: z.string(),
  selectedOptionId: z.string(),
});
```

---

## 8. ID GENERATION & UTILITIES

**File:** `apps/api/src/lib/id-generator.ts`

```typescript
import { nanoid } from "nanoid";

export function generateId(size = 21): string {
  return nanoid(size);
}
```

Used for generating URL-safe unique IDs across tables.

---

## 9. KEY PATTERNS & CONVENTIONS

### Database
- **ID strategy:** nanoid (21 chars by default, URL-safe)
- **Timestamps:** Unix milliseconds (Date.now())
- **JSON storage:** String columns (e.g., `options` in questions)
- **Composite keys:** Multiple tables use composite PKs for many-to-many
- **Indexes:** Added for frequently queried foreign key columns (studentId, assessmentId, postId, userId)

### API Routes
- **Middleware ordering:** error → CORS → public → auth → protected
- **Response format:** Always JSON
- **Error handling:** Zod validation → 400, Clerk auth → 401, generic → 500
- **Variables:** userId injected via middleware context

### Frontend
- **Provider stack:** Clerk → QueryClient → Router
- **Route guards:** useAuth hook in authed layout
- **Loading state:** Spinner while Clerk initializes
- **Navigation:** TanStack Router with intent preloading
- **Styling:** Tailwind v4 with CSS custom properties for theming

### Shared Package
- **Export pattern:** Constants → Types → Schemas
- **Validation:** Zod for all user input
- **Type inference:** Drizzle InferSelectModel for DB types
- **Enums:** TypeScript as const tuples + union types

---

## 10. CURRENT STATE & PHASE PLANNING

**Phase 1 (Foundation - COMPLETE):**
- ✅ Monorepo structure (Turbo + pnpm workspaces)
- ✅ Hono API with middleware stack
- ✅ D1 database with full schema
- ✅ Clerk auth integration (JWT + webhook)
- ✅ React + TanStack Router + Vite frontend
- ✅ Shared package with types & schemas
- ✅ Design system (colors, typography, components)

**Upcoming phases:**
- Phase 2: Questions CRUD (create, tag, bank management)
- Phase 3: Assessments (creation, templating, delivery)
- Phase 4: Classrooms (management, assignments, roster)
- Phase 5: Assessment taking (timed, shuffled, grading)
- Phase 6: Results & analytics (reports, charts)
- Phase 7: Notifications (in-app + email)

**Known TODOs:**
- Connect Hono RPC client to actual API type (AppType import)
- Derive user role from Clerk public_metadata in frontend
- Implement actual routes for Questions, Assessments, Classrooms
- Wire up real API calls from dashboard
- Add Settings page
- Configure R2 file uploads

---

## 11. TECH STACK SUMMARY

| Layer | Technology | Version |
|-------|------------|---------|
| **Language** | TypeScript | 5.7.0 |
| **Monorepo** | pnpm workspaces + Turbo | 9.15.0 + 2.4.0 |
| **Backend** | Hono | 4.7.0 |
| **Database** | Drizzle ORM + D1 (SQLite) | 0.38.0 |
| **Auth** | Clerk | 1.20.0 (backend), 5.20.0 (frontend) |
| **Frontend** | React + Vite | 19.0.0 + 6.0.0 |
| **Routing** | TanStack Router | 1.95.0 |
| **Data fetching** | TanStack Query + Hono RPC | 5.65.0 + 4.7.0 |
| **Styling** | Tailwind CSS v4 + CSS custom properties | 4.0.0 |
| **Icons** | Lucide React | 0.469.0 |
| **ID generation** | nanoid | 5.0.0 |
| **Validation** | Zod | 3.24.0 |

---

## 12. FILE STRUCTURE QUICK REFERENCE

```
apps/api/
├── src/
│   ├── index.ts                 (entry, route registration)
│   ├── env.ts                   (Hono Env type)
│   ├── db/
│   │   ├── schema.ts            (14 tables + inferred types)
│   │   └── migrations/
│   │       └── 0000_...sql      (initial schema)
│   ├── middleware/
│   │   ├── auth-middleware.ts   (Clerk JWT verification)
│   │   ├── cors-middleware.ts   (origin config)
│   │   └── error-middleware.ts  (Zod + HTTPException handling)
│   ├── routes/
│   │   └── users-route.ts       (GET /me, POST webhook)
│   └── lib/
│       └── id-generator.ts      (nanoid utility)
├── wrangler.toml                (D1 + R2 bindings, Clerk keys)
├── drizzle.config.ts
└── package.json

apps/web/
├── src/
│   ├── main.tsx                 (React entry)
│   ├── app.tsx                  (Provider stack)
│   ├── app.css                  (@theme with design tokens)
│   ├── routes/
│   │   ├── router.ts            (route tree, preload config)
│   │   ├── root-route.tsx       (Outlet wrapper)
│   │   ├── login-route.tsx      (Clerk SignIn)
│   │   ├── authed-layout.tsx    (useAuth guard)
│   │   ├── dashboard-route.tsx  (role-based KPI cards)
│   │   └── placeholder-routes.tsx (Q/A/C/N stubs)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── app-shell.tsx    (sidebar + header)
│   │   │   ├── sidebar.tsx      (role-based nav)
│   │   │   ├── header.tsx       (title + user menu)
│   │   │   └── dark-mode-toggle.tsx
│   │   └── ui/
│   │       ├── badge.tsx        (5 variants)
│   │       ├── card.tsx         (3 variants)
│   │       ├── page-header.tsx
│   │       └── empty-state.tsx
│   └── lib/
│       ├── api-client.ts        (hc<Hono>)
│       └── utils.ts             (cn utility)
├── vite.config.ts
├── tsconfig.json
└── package.json

packages/shared/
├── src/
│   ├── index.ts                 (main export barrel)
│   ├── constants/
│   │   ├── roles.ts
│   │   ├── complexity.ts
│   │   ├── assessment-types.ts
│   │   ├── post-types.ts
│   │   └── notification-types.ts
│   ├── types/
│   │   ├── user-types.ts
│   │   ├── question-types.ts
│   │   ├── assessment-types.ts
│   │   ├── classroom-types.ts
│   │   └── notification-types.ts
│   └── schemas/
│       └── index.ts             (Zod request schemas)
├── package.json
└── tsconfig.json
```

---

## 13. DEPLOYMENT & CONFIG NOTES

**Backend:**
- Runs on Cloudflare Workers (via Wrangler)
- D1 database binding: `DB` (local SQLite)
- R2 bucket binding: `STORAGE` (not yet used)
- Secrets: Clerk keys set via `wrangler secret put` or `.dev.vars`

**Frontend:**
- Built with Vite (SSG, no SSR)
- Dev: `vite` on port 5173
- Prod: `vite build` outputs to `dist/`
- API URL env: `VITE_API_URL` (default: http://localhost:8787)
- Clerk key: `VITE_CLERK_PUBLISHABLE_KEY` (required)

**Monorepo tasks:**
- `pnpm dev`: runs all dev servers in parallel
- `pnpm build`: builds all packages (respects Turbo cache)
- `pnpm lint`: runs linters (currently noop)
- `pnpm typecheck`: runs tsc on all packages

---

## EXPLORATION COMPLETE

All Phase 1 foundation files have been read in full. The architecture is clean, well-typed, and ready for Phase 2 implementation (Questions CRUD).

**Key takeaways for next phase:**
1. Use `generateId()` for all new DB records
2. Follow Zod schema pattern for all request validation
3. Use Drizzle's `insert().onConflictDoUpdate()` for upserts
4. Keep routes organized by resource (users, questions, etc.)
5. Update API client with `AppType` once CF types resolve
6. Fetch user role from Clerk context for role-based features

