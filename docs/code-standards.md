# Code Standards — Teaching Platform

**Phase:** Phase 4 Complete (Assessment Bank & Classroom)

Coding conventions and architectural patterns for maintaining consistency across the monorepo.

---

## 1. TypeScript & General Code Style

### Strict Mode
- All TypeScript files compiled with `strict: true`
- No `any` types allowed — use proper type annotations or generics
- Null/undefined must be explicitly handled

### Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| **Files** | kebab-case | `auth-middleware.ts`, `dark-mode-toggle.tsx` |
| **Directories** | kebab-case | `src/routes/`, `src/components/layout/` |
| **Classes** | PascalCase | `class UserService {` |
| **Functions** | camelCase | `function getUserById()` |
| **Constants** | UPPER_SNAKE_CASE | `const MAX_ATTEMPTS = 5;` |
| **Variables** | camelCase | `let currentUser: User;` |
| **React Components** | PascalCase | `export function DarkModeToggle()` |
| **DB Tables** | camelCase | `users`, `assessmentAttempts`, `commentMentions` |
| **DB Columns** | snake_case | `created_at`, `user_id`, `is_correct` |
| **API Routes** | kebab-case | `GET /api/users`, `POST /api/classrooms/:id/members` |

### Code Formatting
- Max line length: 100 characters (except long strings, URLs)
- Indentation: 2 spaces
- Trailing commas in multi-line objects/arrays
- Use `const` by default, `let` only for reassignment
- No semicolons (configured in repo)

### Imports
- Group in order: React/external packages → local types → local functions/constants
- Use ES6 modules with `.js` file extensions in imports (Node.js ESM)

```typescript
import type { User, Assessment } from "@repo/shared/types";
import { ROLES } from "@repo/shared/constants";
import { Hono } from "hono";
import { usersRoute } from "./routes/users-route.js";
```

---

## 2. Architecture Patterns

### API Layer (Hono)

#### Route Handlers
- One route file per domain (e.g., `users-route.ts`, `assessments-route.ts`)
- Routes export a Hono app instance

```typescript
import { Hono } from "hono";
import type { Env } from "../env.js";

const app = new Hono<Env & { Variables: { userId: string } }>();

app.get("/", (c) => {
  const userId = c.get("Variables").userId;
  return c.json({ user: userId });
});

export const usersRoute = app;
```

#### Middleware
- Middleware files in `src/middleware/` — one per concern
- Naming: `{concern}-middleware.ts`
- Middleware wraps errors or enriches context

```typescript
app.use("/api/*", async (c, next) => {
  c.set("Variables", { userId: extractUserId(c) });
  await next();
});
```

#### Services Layer
- Service files in `src/services/` — encapsulate business logic
- Naming: `{domain}-service.ts` for CRUD, `{domain}-query-service.ts` for complex reads, `{domain}-generator-service.ts` for generation logic
- Keep route handlers thin: delegate to services for complex operations
- Example services: `question-service.ts`, `assessment-service.ts`, `assessment-query-service.ts`, `assessment-generator-service.ts`, `classroom-service.ts`, `classroom-member-service.ts`

```typescript
// src/services/assessment-service.ts (CRUD)
export async function createAssessment(db, teacherId, data: CreateAssessment) {
  // Insert assessment + assessmentQuestions with ordering
}

// src/services/assessment-query-service.ts (Complex reads)
export async function getAssessmentWithQuestions(db, assessmentId, teacherId) {
  // Join with full question data
}

// src/services/assessment-generator-service.ts (Generation logic)
export async function generateAssessment(db, teacherId, config: GenerateConfig) {
  // AI generation or smart selection based on config
}
```

#### Error Handling
- Centralized via `app.onError()` — catches all errors
- Returns JSON: `{ message: string, code: string, details?: any }`

```typescript
app.onError((err, c) => {
  const statusCode = err instanceof ValidationError ? 400 : 500;
  return c.json({ message: err.message, code: err.code }, statusCode);
});
```

### Database Layer (Drizzle ORM)

#### Schema
- All tables defined in `src/db/schema.ts`
- Use `text()` for IDs (Clerk user IDs or custom generated)
- Use `integer()` for timestamps (Unix milliseconds or seconds)
- Foreign keys explicitly referenced: `.references(() => table.column)`
- Indexes on frequently queried fields: `index("idx_name").on(column)`

```typescript
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  createdAt: integer("created_at").notNull(),
});

export type User = InferSelectModel<typeof users>;
```

#### Queries
- Use Drizzle query builder, not raw SQL (unless performance critical)
- Always handle null cases
- Use transactions for multi-step operations

```typescript
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
});

if (!user) {
  throw new NotFoundError("User not found");
}
```

### Frontend Layer (React + TanStack)

#### Components
- Functional components with hooks only (no class components)
- Co-locate related files: component + hook + styles in same directory (if needed)
- Props as a single typed object parameter

```typescript
interface DarkModeToggleProps {
  onChange?: (theme: "light" | "dark") => void;
}

export function DarkModeToggle({ onChange }: DarkModeToggleProps) {
  return <button>Toggle</button>;
}
```

#### Hooks
- Custom hooks start with `use` prefix
- Custom hooks in `src/hooks/` or co-located if single-use
- Use TanStack Query for async server state

```typescript
function useFetchUser(userId: string) {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: async () => apiClient.users.get({ query: { id: userId } }),
  });
}
```

#### Routing
- Code-based routes via TanStack Router
- Route files named `{page}-route.tsx`
- Lazy load heavy route components

```typescript
// routes/dashboard-route.tsx
export const dashboardRoute = new Route({
  getParentRoute: () => authedRoute,
  path: "/dashboard",
  component: () => <Dashboard />,
});
```

#### Content Rendering (Phase 2+)
- Use `react-markdown` with plugins for markdown support in questions
- Always render markdown safely with sanitization where applicable
- Support code highlighting via `rehype-highlight`
- Support math rendering via `rehype-katex` for LaTeX equations

```tsx
import ReactMarkdown from 'react-markdown';
import { remarkGfm } from 'remark-gfm';
import { rehypeKatex } from 'rehype-katex';

export function QuestionContent({ content }: Props) {
  return (
    <ReactMarkdown 
      remarkPlugins={[remarkGfm]} 
      rehypePlugins={[rehypeKatex]}
    >
      {content}
    </ReactMarkdown>
  );
}
```

#### Styling
- Tailwind CSS utility classes (no custom CSS unless critical)
- Use design tokens from design-guidelines.md
- Dark mode via `dark:` prefix (Tailwind v4)

```tsx
<div className="p-6 bg-card rounded-lg border border-border dark:bg-card dark:border-white/8">
  Content
</div>
```

---

## 3. Testing Standards

### Unit Tests
- Jest for TypeScript/JavaScript tests
- Test file naming: `{module}.test.ts`
- Keep tests focused: one concern per test
- Use descriptive test names

```typescript
describe("getUserById", () => {
  it("should return user by ID", async () => {
    const user = await getUserById("123");
    expect(user?.id).toBe("123");
  });

  it("should return undefined if user not found", async () => {
    const user = await getUserById("nonexistent");
    expect(user).toBeUndefined();
  });
});
```

### Integration Tests (Phase 2+)
- Test API routes + database interactions
- Use test database (separate from dev)
- Clean up data after each test (transactions, truncate)

### Test Coverage
- Target: 80% coverage minimum
- Focus on business logic, edge cases
- Mock external dependencies (Clerk API, OpenAI)

---

## 4. Error Handling

### Custom Error Classes
- Extend Error class for domain-specific errors
- Include HTTP status code + error code

```typescript
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
    this.code = "VALIDATION_ERROR";
  }
  statusCode: number;
  code: string;
}
```

### Error Handling Rules
- **API routes**: Catch errors, return JSON response
- **Components**: Use error boundaries for React errors
- **Database**: Wrap queries in try-catch, return user-friendly messages
- **Never** expose internal error details in production

```typescript
app.post("/assessments", async (c) => {
  try {
    const data = await c.req.json();
    const assessment = await createAssessment(data);
    return c.json(assessment);
  } catch (err) {
    if (err instanceof ValidationError) {
      return c.json({ message: err.message, code: err.code }, 400);
    }
    return c.json({ message: "Internal server error" }, 500);
  }
});
```

---

## 5. Validation & Type Safety

### Input Validation
- Use Zod schemas for API request/response validation
- Define schemas in `@repo/shared/schemas`
- Validate in API route before processing

```typescript
const createQuestionSchema = z.object({
  content: z.string().min(10),
  options: z.array(z.object({ text: z.string(), isCorrect: z.boolean() })),
  complexity: z.number().min(1).max(5),
});

const createQuestion = (data: unknown) => {
  const validated = createQuestionSchema.parse(data);
  return db.insert(questions).values(validated);
};
```

### Type Generation
- Export types from Drizzle schema: `export type User = InferSelectModel<typeof users>`
- Export types from Zod: `type CreateQuestion = z.infer<typeof createQuestionSchema>`

---

## 6. Database Conventions

### Timestamp Handling
- Store as integer (Unix milliseconds): `Math.floor(Date.now())`
- Always track `createdAt` and `updatedAt`
- Use timestamps for audit trails (immutable created_at)

### Relationships
- Foreign keys use explicit `.references()` in Drizzle
- Denormalize sparingly (only for read-heavy paths)
- Prefer queries with JOINs to joining in application code

### Soft Deletes (Phase 2+)
- Use `deletedAt` column (nullable integer timestamp)
- Filter out soft-deleted records in queries: `.where(isNull(deletedAt))`
- Prevents orphaned foreign key references

---

## 7. API Design

### Response Format
All responses are JSON with consistent structure:

**Success (2xx):**
```json
{
  "data": { /* response payload */ }
}
```

**Error (4xx/5xx):**
```json
{
  "error": {
    "message": "User not found",
    "code": "NOT_FOUND",
    "details": null
  }
}
```

### Pagination (Phase 2+)
- Query params: `?page=1&limit=20&sort=createdAt:desc`
- Response: `{ data: [...], pagination: { total, page, limit } }`

### Rate Limiting (Phase 2+)
- Via Cloudflare Workers rate-limit headers
- Per-user limits: 1000 requests/hour

### Versioning
- API version in URL path: `/api/v1/users` (plan for v2 if breaking changes)
- Accept breaking changes only in major versions

---

## 8. Security Best Practices

### Authentication
- All `/api/*` routes require auth middleware
- JWT validation: extract from Authorization header, verify signature
- Clerk webhook secret verification for user sync

### Authorization
- Role-based checks in route handlers
- Teacher can only access own questions/assessments/classrooms
- Student/Parent can only view assigned assessments

```typescript
app.patch("/assessments/:id", async (c) => {
  const userId = c.get("Variables").userId;
  const assessmentId = c.req.param("id");
  const assessment = await db.query.assessments.findFirst({
    where: eq(assessments.id, assessmentId),
  });
  
  if (assessment?.teacherId !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }
  // Update logic
});
```

### Secrets Management
- Use environment variables: `c.env.DATABASE_URL`, `c.env.CLERK_SECRET`
- Never commit `.env` or secrets to git
- Cloudflare Workers: store in project settings (not local .env)

### Input Sanitization
- Zod validates type/length
- HTML sanitize markdown before rendering (phase 2: use `rehype-sanitize`)
- SQL injection prevented by Drizzle ORM (parameterized queries)

---

## 9. Performance Standards

### Database Queries
- Add indexes on frequently queried fields
- Avoid N+1 queries (use Drizzle relations or single JOINs)
- Prefer `findFirst()` to `findMany()` with LIMIT 1

### Frontend
- Code split routes via TanStack Router
- Lazy load heavy components (e.g., Markdown editor)
- Use React.memo() for components re-rendered frequently

### Caching
- TanStack Query: default staleTime 5 minutes
- Browser cache: static assets with long max-age headers
- Database: query results cached via TanStack Query

---

## 10. Git & Commit Standards

### Commit Messages
- Format: `{type}: {description}` (conventional commits)
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- Example: `feat: add assessment auto-submit on time limit`

### Branching
- Main branch: `main` (production)
- Development: create feature branches `feature/assessment-grading`
- Never force-push to main

### Code Review
- All PRs require review before merge
- Tests must pass before merge
- Lint errors must be fixed

---

## 11. Documentation Standards

### Code Comments
- Explain **why**, not what (code already shows what)
- Use comments for complex business logic, algorithms, edge cases
- Keep comments up-to-date with code

```typescript
// Rate limit: 10 attempts per hour per user (prevents brute force attacks)
const MAX_FAILED_ATTEMPTS = 10;
```

### Function Documentation
- JSDoc for public API functions

```typescript
/**
 * Create a new assessment from a template with auto-generated questions.
 * @param templateId - ID of assessment template
 * @param classroomId - Classroom to assign assessment to
 * @throws ValidationError if template not found
 * @returns Created assessment
 */
export async function createAssessmentFromTemplate(
  templateId: string,
  classroomId: string
): Promise<Assessment> {
  // Implementation
}
```

### README Files
- Each workspace has README.md explaining its purpose, setup, development
- Root README.md: project overview, quick start, deployment

---

## 12. File Organization

### Root `src/` Structure (API)
```
apps/api/src/
├── db/
│   └── schema.ts                        # All Drizzle tables + types (17 tables)
├── middleware/
│   ├── auth-middleware.ts               # JWT verification
│   ├── error-middleware.ts              # Error handling
│   └── cors-middleware.ts               # CORS
├── routes/
│   ├── users-route.ts                   # GET/PATCH /api/users
│   ├── questions-route.ts               # CRUD + bulk import for questions
│   ├── tags-route.ts                    # CRUD for tags
│   ├── assessment-routes.ts             # GET/POST/PUT/DELETE /api/assessments + generate + preview
│   ├── classroom-routes.ts              # GET/POST/PUT/DELETE /api/classrooms + regenerate-code
│   ├── classroom-member-routes.ts       # GET/POST/DELETE /api/classrooms/:id/members
│   ├── classroom-post-routes.ts         # GET/POST/PUT/DELETE /api/classrooms/:id/posts + comments
│   ├── upload-route.ts                  # Image upload & retrieval
│   └── ...
├── services/
│   ├── question-service.ts              # Question CRUD + helpers
│   ├── assessment-service.ts            # Assessment CRUD + duplicate
│   ├── assessment-query-service.ts      # Assessment complex reads (with questions)
│   ├── assessment-generator-service.ts  # Assessment auto-generation
│   ├── classroom-service.ts             # Classroom CRUD + invite code management
│   ├── classroom-member-service.ts      # Member management + role checks
│   └── ...
├── lib/
│   └── id-generator.ts                  # Custom ID generation
├── env.ts                               # Environment type definitions
└── index.ts                             # Hono app entry, exports AppType
```

### Root `src/` Structure (Web)
```
apps/web/src/
├── routes/
│   ├── router.ts                    # Router definition
│   ├── root-route.tsx               # Layout outlet
│   ├── login-route.tsx              # Public login
│   ├── authed-layout.tsx            # Protected layout
│   ├── dashboard-route.tsx          # Main dashboard
│   ├── questions-routes.tsx         # Question bank routes
│   ├── assessments-routes.tsx       # Assessment routes
│   ├── classrooms-routes.tsx        # Classroom routes
│   └── ...
├── features/
│   ├── questions/                   # Question bank feature module
│   │   ├── question-list-page.tsx
│   │   ├── question-editor-page.tsx
│   │   └── ...
│   ├── assessments/                 # Assessment feature module (Phase 3)
│   │   ├── assessment-list-page.tsx
│   │   ├── assessment-wizard-page.tsx      # 3-step creation wizard
│   │   ├── assessment-preview-page.tsx
│   │   ├── question-picker.tsx
│   │   ├── auto-gen-config.tsx
│   │   ├── wizard-step-*.tsx
│   │   └── ...
│   └── classrooms/                  # Classroom feature module (Phase 4)
│       ├── classroom-list-page.tsx
│       ├── classroom-detail-page.tsx       # 4-tab layout (Feed/Members/Assessments/Settings)
│       ├── classroom-feed-tab.tsx
│       ├── classroom-members-tab.tsx
│       ├── classroom-assessments-tab.tsx
│       ├── classroom-settings-tab.tsx
│       ├── post-composer.tsx
│       ├── add-member-dialog.tsx
│       └── ...
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── dark-mode-toggle.tsx
│   └── ui/
│       ├── card.tsx
│       ├── badge.tsx
│       ├── page-header.tsx
│       └── empty-state.tsx
├── lib/
│   ├── api-client.ts                # Hono RPC client
│   └── utils.ts                     # Helper functions
├── app.tsx                          # Root component
└── main.tsx                         # Vite entry
```

---

## 13. Dependencies & Package Management

### Workspace Dependencies
- Use workspace dependencies: `@repo/shared`
- Version in root `package.json`, workspaces inherit

### Adding Dependencies
- Keep dependencies minimal (YAGNI principle)
- Prefer libraries with active maintenance, good TypeScript support
- Run `pnpm install` (don't use npm, yarn)

### Pinning Versions
- Pin major.minor (caret): `^4.7.0` allows minor/patch updates
- Use exact for devDependencies if development requires it

---

## 14. Development Setup Checklist

- [ ] Node 20+ installed
- [ ] pnpm 9.15+ installed
- [ ] Clone repo, run `pnpm install`
- [ ] Copy `.env.example` to `.env.local` (API only)
- [ ] Set Clerk keys in `.env.local`
- [ ] Run `pnpm run dev` to start dev servers
- [ ] Run `pnpm run typecheck` before commits

---

## Related Documents
- [`system-architecture.md`](./system-architecture.md) — Project structure & tech stack
- [`design-guidelines.md`](./design-guidelines.md) — UI/UX standards
