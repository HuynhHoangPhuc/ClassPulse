# ClassPulse Architecture Exploration Report

**Date:** 2026-04-03 | **Scope:** Question models, API endpoints, tech stack, markdown handling

---

## 1. Tech Stack Overview

### Monorepo Structure (Turbo + pnpm)
- **Package Manager:** pnpm 9.15.0
- **Monorepo Tool:** Turbo 2.4.0
- **TypeScript:** 5.7.0
- **Node.js:** ≥20

### Backend (apps/api/)
- **Framework:** Hono 4.7.0 (lightweight HTTP framework)
- **ORM:** Drizzle 0.38.0 (SQLite)
- **Database:** Cloudflare D1 (SQLite)
- **Runtime:** Cloudflare Workers
- **Deployment Tool:** Wrangler 3.100.0
- **Validation:** Zod 3.24.0
- **Auth:** Clerk 1.20.0 (backend)
- **ID Generation:** nanoid 5.0.0

### Frontend (apps/web/)
- **Framework:** React 19.0.0 + Vite 6.0.0
- **Routing:** TanStack Router 1.95.0
- **Data Fetching:** TanStack React Query 5.65.0
- **Auth:** Clerk 5.20.0 (client)
- **Markdown:** react-markdown 10.1.0 + remark/rehype plugins
- **Math Rendering:** KaTeX 0.16.44
- **Code Highlighting:** rehype-highlight 7.0.2
- **Styling:** Tailwind CSS 4.0.0
- **Icons:** lucide-react 0.469.0
- **Charts:** Recharts 3.8.1

### Shared Package (packages/shared/)
- Type definitions, Zod schemas, constants
- Exports: question types, assessment types, schemas for validation

---

## 2. Question Models & Database Schema

### Questions Table
**File:** `/Users/phuc/work/ClassPulse/apps/api/src/db/schema.ts:39–50`

```typescript
export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),              // nanoid (21 chars)
  teacherId: text("teacher_id").notNull(),  // FK to users.id
  content: text("content").notNull(),       // Main question text (supports markdown)
  options: text("options").notNull(),       // JSON string: { id, text, isCorrect }[]
  complexity: integer("complexity").notNull(), // 1–5 scale
  complexityType: text("complexity_type").notNull(), // Knowledge|Comprehension|Application|Analysis|Synthesis|Evaluation
  explanation: text("explanation"),         // Optional answer explanation
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
```

### Related Tables
- **question_tags:** Many-to-many relationship with tags
- **assessmentQuestions:** Links questions to assessments with optional score overrides

### Question Types (TypeScript)
**File:** `/Users/phuc/work/ClassPulse/packages/shared/src/types/question-types.ts`

```typescript
export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  teacherId: string;
  content: string;               // Supports markdown
  options: QuestionOption[];
  complexity: ComplexityLevel;   // 1–5
  complexityType: ComplexityType; // 6 Bloom's taxonomy levels
  explanation: string | null;
  createdAt: number;
  updatedAt: number;
}
```

### Complexity Constants
**File:** `/Users/phuc/work/ClassPulse/packages/shared/src/constants/complexity.ts`

```typescript
COMPLEXITY_TYPES = ["knowledge", "comprehension", "application", "analysis", "synthesis", "evaluation"]
COMPLEXITY_LEVELS = [1, 2, 3, 4, 5]  // Easy to Hard
COMPLEXITY_LABELS: { 1: "Easy", 2: "Medium-Easy", 3: "Medium", 4: "Medium-Hard", 5: "Hard" }
COMPLEXITY_COLORS: { 1: "#10B981", ... 5: "#F43F5E" }  // Color-coded by difficulty
```

---

## 3. API Endpoints for Questions

### Route File
**Path:** `/Users/phuc/work/ClassPulse/apps/api/src/routes/questions-route.ts`
**Mount Point:** `/api/questions` (requires auth via Clerk)

#### Endpoints

| Method | Path | Function | Notes |
|--------|------|----------|-------|
| GET | / | List questions | Filters: tagIds, complexityMin/Max, complexityType, search; cursor pagination (limit 1–50, default 20) |
| GET | /:id | Fetch single | Returns question + associated tags |
| POST | / | Create question | Validates via createQuestionSchema; auto-assigns nanoid; tags optional |
| PUT | /:id | Update question | Partial updates; atomically replaces tags |
| DELETE | /:id | Delete question | Cascades to question_tags entries |
| POST | /bulk | Bulk operations | Actions: delete, retag (requires ownership verification) |

#### Request Schema
**File:** `/Users/phuc/work/ClassPulse/packages/shared/src/schemas/index.ts:40–47`

```typescript
export const createQuestionSchema = z.object({
  content: z.string().min(1),                          // Question text (markdown supported)
  options: z.array(questionOptionSchema).min(2).max(6), // 2–6 multiple choice
  complexity: complexityLevelSchema,                   // 1–5
  complexityType: complexityTypeSchema,                // Knowledge|Comprehension|Application|...
  explanation: z.string().nullable().optional(),      // Answer explanation
  tagIds: z.array(z.string()).optional(),             // Teacher-created tags
});

export const updateQuestionSchema = z.object({
  // All fields optional for PATCH-like behavior
  content: z.string().min(1).optional(),
  options: z.array(questionOptionSchema).min(2).max(6).optional(),
  complexity: complexityLevelSchema.optional(),
  complexityType: complexityTypeSchema.optional(),
  explanation: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
});
```

---

## 4. Question Service (Business Logic)

**File:** `/Users/phuc/work/ClassPulse/apps/api/src/services/question-service.ts`

### Key Functions

#### createQuestion(db, teacherId, input)
- Generates nanoid for question ID
- Serializes options to JSON before storing
- Atomically creates question + question_tags (if provided)
- Validates tag ownership
- Returns deserialized question with tags

#### updateQuestion(db, questionId, teacherId, input)
- Partial updates (only provided fields)
- Atomically replaces tags: delete old + insert new in one batch
- Validates tag ownership
- Returns updated question with tags

#### fetchTagsForQuestions(db, questionIds)
- Joins questionTags + tags tables
- Returns Map<questionId, Tag[]>

#### buildQuestionFilters(teacherId, filters)
- Constructs WHERE conditions for:
  - Complexity range (min/max)
  - Complexity type (Bloom's taxonomy)
  - Full-text search on content
  - Cursor-based pagination

---

## 5. Markdown Handling (Frontend)

### Markdown Editor Component
**File:** `/Users/phuc/work/ClassPulse/apps/web/src/features/questions/markdown-editor.tsx`

- **Rich editor** with live preview (desktop: split-pane, mobile: tabs)
- **Toolbar buttons:** Bold, Italic, Code, Code block, Link, Math, Image upload
- **Features:**
  - Text wrapping/insertion helpers
  - Image upload with progress tracking
  - Responsive design (textarea + live preview)

### Markdown Preview Component
**File:** `/Users/phuc/work/ClassPulse/apps/web/src/features/questions/markdown-preview.tsx`

**Plugins:**
- `remark-gfm` – GitHub Flavored Markdown (tables, strikethrough)
- `remark-math` – Math delimiters ($...$, $$...$$)
- `rehype-katex` – Render LaTeX equations via KaTeX
- `rehype-highlight` – Syntax-highlight code blocks

**Custom Components:**
- All HTML elements styled with CSS vars
- Images auto-responsive with `max-w-full`
- Links open in new tabs
- Code blocks scrollable with monospace font
- Blockquotes styled with left border + primary color

### Question Editor Page
**File:** `/Users/phuc/work/ClassPulse/apps/web/src/features/questions/question-editor-page.tsx`

- Integrated **MarkdownEditor** for question content
- Uses **MarkdownPreview** inline for real-time feedback
- Handles image uploads via `/api/upload/image` endpoint
- Manages options (add/remove/mark correct)
- Supports tag selection and complexity/type selection

---

## 6. Current Limitations & No Frontmatter Support

### Observations

1. **No YAML Frontmatter**
   - Questions store only: content (markdown), options (JSON), complexity, explanation
   - No metadata layer in the database schema
   - Tags are separate table (not embedded)

2. **Options Are JSON**
   - Stored as text in DB: `JSON.stringify([{id, text, isCorrect}])`
   - Parsed at runtime with `safeParseOptions()`
   - No markdown in individual option text (currently)

3. **Explanation Field**
   - Plain text or markdown (no parsing required at DB layer)
   - Optional, nullable
   - Stored separately from question content

4. **Tags**
   - Separate `tags` table (teacher-scoped)
   - Many-to-many via `question_tags`
   - Not embedded in question body

---

## 7. File Paths Summary

### Backend
- Database schema: `/Users/phuc/work/ClassPulse/apps/api/src/db/schema.ts`
- Question routes: `/Users/phuc/work/ClassPulse/apps/api/src/routes/questions-route.ts`
- Question service: `/Users/phuc/work/ClassPulse/apps/api/src/services/question-service.ts`
- Main app: `/Users/phuc/work/ClassPulse/apps/api/src/index.ts`
- ID generator: `/Users/phuc/work/ClassPulse/apps/api/src/lib/id-generator.ts`

### Frontend
- Question editor page: `/Users/phuc/work/ClassPulse/apps/web/src/features/questions/question-editor-page.tsx`
- Markdown editor: `/Users/phuc/work/ClassPulse/apps/web/src/features/questions/markdown-editor.tsx`
- Markdown preview: `/Users/phuc/work/ClassPulse/apps/web/src/features/questions/markdown-preview.tsx`

### Shared
- Type definitions: `/Users/phuc/work/ClassPulse/packages/shared/src/types/question-types.ts`
- Schemas: `/Users/phuc/work/ClassPulse/packages/shared/src/schemas/index.ts`
- Constants: `/Users/phuc/work/ClassPulse/packages/shared/src/constants/complexity.ts`

---

## Key Insights for Feature Development

1. **Extensible Schema:** Question table has room for additional fields (no migration needed for new metadata in options JSON)
2. **Tight Validation:** All create/update operations validated against Zod schemas before DB write
3. **Owner-Scoped:** All questions and tags scoped to teacherId (multi-tenancy via auth)
4. **Markdown-Ready:** Content field already supports markdown; rendering pipeline in place frontend
5. **No Frontmatter:** Current design does NOT parse YAML frontmatter from question content
6. **Options Flexibility:** Options are JSON; could support markdown in individual option text with minimal changes

