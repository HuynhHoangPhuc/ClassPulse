# ClassPulse API Endpoints Exploration Report

**Date:** April 4, 2026
**Status:** Complete
**Scope:** Question creation, Question banks, AI agent question creation

---

## Executive Summary

ClassPulse is a teaching assessment platform with Hono-based REST APIs. The platform supports:
- **Manual question creation** with tagging and complexity levels
- **AI-powered bulk question generation** via markdown format
- **Question filtering and discovery** with cursor pagination
- **Tag management** for organizing questions
- **API Key authentication** with scope-based access control (for third-party AI integrations)

There is **NO dedicated "question bank" entity** — questions serve as the core asset, organized via tags and assessments.

---

## API Architecture

**Framework:** Hono (lightweight REST framework running on Cloudflare Workers)
**Database:** SQLite (D1) with Drizzle ORM
**Authentication:** Dual auth system
  - Clerk JWT tokens (session-based, admin/teacher access)
  - Clerk API Keys (scope-restricted, third-party AI integration)

---

## Question-Related API Endpoints

### 1. Standard Question CRUD

**Base Path:** `/api/questions`

#### GET /api/questions
**List questions with filters and cursor pagination**

- **Authentication:** Required (JWT or API Key)
- **Method:** GET
- **Query Parameters:**
  ```
  - limit: number (1-50, default 20)
  - cursor: string (pagination cursor, question ID)
  - search: string (search question content)
  - complexityMin: number (1-5)
  - complexityMax: number (1-5)
  - complexityType: string (enum: knowledge, comprehension, application, analysis, synthesis, evaluation)
  - tagIds: string (comma-separated tag IDs)
  ```
- **Response (200):**
  ```json
  {
    "items": [
      {
        "id": "q_xyz",
        "teacherId": "user_abc",
        "content": "What is 2+2?",
        "options": [
          { "id": "opt_1", "text": "4", "isCorrect": true },
          { "id": "opt_2", "text": "5", "isCorrect": false }
        ],
        "complexity": 1,
        "complexityType": "knowledge",
        "explanation": "Basic arithmetic",
        "createdAt": 1700000000000,
        "updatedAt": 1700000000000,
        "tags": [
          { "id": "tag_1", "name": "Math", "color": "#10B981" }
        ]
      }
    ],
    "nextCursor": "q_next_id"
  }
  ```

#### GET /api/questions/:id
**Fetch a single question by ID**

- **Authentication:** Required
- **Method:** GET
- **Path Parameters:** `id` (question ID)
- **Response (200):** Same as single item from GET /api/questions
- **Response (404):** `{ "error": "Question not found" }`

#### POST /api/questions
**Create a question**

- **Authentication:** Required
- **Method:** POST
- **Request Body:**
  ```json
  {
    "content": "What is the capital of France?",
    "options": [
      { "id": "o1", "text": "Paris", "isCorrect": true },
      { "id": "o2", "text": "Lyon", "isCorrect": false },
      { "id": "o3", "text": "Marseille", "isCorrect": false }
    ],
    "complexity": 1,
    "complexityType": "knowledge",
    "explanation": "Paris is the capital city of France",
    "tagIds": ["tag_1", "tag_2"]
  }
  ```
- **Validation:**
  - `content`: required, non-empty string
  - `options`: required array of 2-6 objects with `{ id, text, isCorrect }`
  - `complexity`: required, integer 1-5
  - `complexityType`: required, enum value
  - `explanation`: optional string
  - `tagIds`: optional array of existing tag IDs (must be owned by teacher)
- **Response (201):** Created question object with tags
- **Response (400):** `{ "error": "Invalid request", "details": {...} }`

#### PUT /api/questions/:id
**Update a question**

- **Authentication:** Required
- **Method:** PUT
- **Path Parameters:** `id` (question ID)
- **Request Body:** (all fields optional)
  ```json
  {
    "content": "Updated question text",
    "options": [...],
    "complexity": 2,
    "complexityType": "comprehension",
    "explanation": "Updated explanation",
    "tagIds": ["tag_1"]
  }
  ```
- **Response (200):** Updated question object
- **Response (404):** `{ "error": "Question not found" }`

#### DELETE /api/questions/:id
**Delete a question**

- **Authentication:** Required
- **Method:** DELETE
- **Path Parameters:** `id` (question ID)
- **Response (200):** `{ "deleted": true }`
- **Response (404):** `{ "error": "Question not found" }`

#### POST /api/questions/bulk
**Bulk delete or retag questions**

- **Authentication:** Required
- **Method:** POST
- **Request Body:**
  ```json
  {
    "action": "delete" | "retag",
    "questionIds": ["q_1", "q_2", "q_3"],
    "tagIds": ["tag_1", "tag_2"]  // Required if action === "retag"
  }
  ```
- **Response (200):** `{ "affected": 3 }`
- **Response (400):** `{ "error": "tagIds required for retag action" }`
- **Response (403):** `{ "error": "One or more questions not found or not owned by teacher" }`

---

### 2. AI-Powered Question Creation

**Base Path:** `/api/questions/ai`

#### POST /api/questions/ai
**Bulk create questions from AI-generated markdown**

- **Authentication:** Required (JWT or API Key with scope: `ai:questions:write`)
- **Method:** POST
- **Scope Requirement:** `ai:questions:write` (enforced for API keys; JWT sessions bypass)
- **Request Body:**
  ```json
  {
    "questions": [
      {
        "content": "---\ncomplexity: 2\ncomplexityType: application\ntags:\n  - Geometry\n  - Shapes\nexplanation: 'Square has 4 equal sides'\n---\n\nWhat shape has 4 equal sides?\n\n[x] Square\n[ ] Circle\n[ ] Triangle",
        "image": "data:image/png;base64,iVBORw0KGgoAAAANS..."  // Optional
      },
      {
        "content": "---\ncomplexity: 3\ncomplexityType: analysis\n---\nAnalyze the following...\n\n[x] Option A\n[ ] Option B"
      }
    ]
  }
  ```
- **Markdown Format (YAML Frontmatter + Checkboxes):**
  - Frontmatter between `---` delimiters
  - Required fields: `complexity` (1-5), `complexityType` (enum), `options` (checkbox list)
  - Optional fields: `explanation`, `tags` (string array)
  - Question content: text before first checkbox
  - Options: `[x]` for correct, `[ ]` for incorrect (2-6 options, min 1 correct)
  - Image: Optional base64 data URI (png, jpg, gif, webp, max 5MB)
- **Validation:**
  - Max 50 questions per request
  - Max 10 new tags per request (auto-creates missing tags)
  - Max 7MB total image data
  - All tag names limited to 50 characters
- **Response (200):**
  ```json
  {
    "created": 2,
    "failed": 0,
    "questions": [
      { "id": "q_new1", "index": 0, "status": "created" },
      { "id": "q_new2", "index": 1, "status": "created" }
    ],
    "tagsCreated": ["Geometry", "Shapes"]
  }
  ```
- **Response (200 with errors):**
  ```json
  {
    "created": 1,
    "failed": 1,
    "questions": [
      { "id": "q_new1", "index": 0, "status": "created" },
      { "index": 1, "status": "error", "error": "Found 1 option(s), minimum is 2" }
    ],
    "tagsCreated": ["Geometry"]
  }
  ```
- **Response (400):** `{ "error": "Invalid request", "details": {...} }`

**Image Injection:**
- If markdown contains `](image)`, placeholder is replaced with image URL
- Otherwise, image prepended to content
- Images stored at `/api/upload/image/images/{id}.{ext}`

---

### 3. Tag Management

**Base Path:** `/api/tags`

#### GET /api/tags
**List all tags for authenticated teacher**

- **Authentication:** Required
- **Method:** GET
- **Response (200):**
  ```json
  [
    { "id": "tag_1", "name": "Algebra", "teacherId": "user_1", "color": "#10B981", "createdAt": 1700000000000 },
    { "id": "tag_2", "name": "Geometry", "teacherId": "user_1", "color": "#F59E0B", "createdAt": 1700000000001 }
  ]
  ```

#### POST /api/tags
**Create a new tag**

- **Authentication:** Required
- **Method:** POST
- **Request Body:**
  ```json
  {
    "name": "Trigonometry",
    "color": "#FF6B6B"
  }
  ```
- **Validation:**
  - `name`: required, 1-50 chars
  - `color`: optional hex color (#RGB or #RRGGBB or #RRGGBBAA)
- **Response (201):** Created tag object

#### PUT /api/tags/:id
**Update a tag**

- **Authentication:** Required
- **Method:** PUT
- **Request Body:** (all fields optional)
  ```json
  {
    "name": "Advanced Trigonometry",
    "color": "#8B5CF6"
  }
  ```
- **Response (200):** Updated tag object
- **Response (404):** `{ "error": "Tag not found" }`

#### DELETE /api/tags/:id
**Delete a tag (removes all associations)**

- **Authentication:** Required
- **Method:** DELETE
- **Response (200):** `{ "deleted": true }`
- **Response (404):** `{ "error": "Tag not found" }`

---

## Database Schema

### questions table
```sql
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  teacherId TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  options TEXT NOT NULL,  -- JSON array: [{ id, text, isCorrect }]
  complexity INTEGER NOT NULL,  -- 1-5
  complexityType TEXT NOT NULL,  -- knowledge, comprehension, application, analysis, synthesis, evaluation
  explanation TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

### question_tags table (many-to-many)
```sql
CREATE TABLE question_tags (
  questionId TEXT NOT NULL REFERENCES questions(id),
  tagId TEXT NOT NULL REFERENCES tags(id),
  PRIMARY KEY (questionId, tagId)
);
```

### tags table
```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  teacherId TEXT NOT NULL REFERENCES users(id),
  color TEXT,  -- hex color
  createdAt INTEGER NOT NULL
);
```

---

## Authentication & Authorization

### JWT Session Authentication
- **Header:** `Authorization: Bearer <jwt_token>`
- **Issuer:** Clerk
- **Includes:** User ID in `sub` claim
- **Scope:** Full access to all question APIs (role-based authorization)

### API Key Authentication
- **Header:** `Authorization: Bearer <api_key>`
- **Format:** Clerk API Key
- **Scope Requirements:**
  - `ai:questions:write` — required for POST /api/questions/ai
  - Other routes allow any API key (no scope enforcement)
- **Default Scope:** `ai:questions:write` (when key created without explicit scopes)
- **Ownership Check:** API keys are teacher-owned (created by `POST /api/users/api-keys`)

#### API Key Management
**POST /api/users/api-keys**
- Create API key with scopes and expiration

**GET /api/users/api-keys**
- List API keys (no secrets returned)

**DELETE /api/users/api-keys/:id**
- Revoke an API key

---

## Complexity Framework

**Levels:** 1-5 (Easy to Hard)
```
1 = Easy (green: #10B981)
2 = Medium-Easy (teal: #14B8A6)
3 = Medium (amber: #F59E0B)
4 = Medium-Hard (orange: #F97316)
5 = Hard (rose: #F43F5E)
```

**Types** (Bloom's Taxonomy):
- `knowledge` — recall facts
- `comprehension` — understand concepts
- `application` — apply knowledge
- `analysis` — analyze relationships
- `synthesis` — combine elements
- `evaluation` — judge/critique

---

## Assessment-Related APIs (Question Bank Context)

While there's no dedicated "question bank" entity, **assessments function as question collections**:

**POST /api/assessments**
- Create assessment with selected questions

**POST /api/assessments/generate**
- Auto-generate assessment by sampling questions by tag/complexity

**GET /api/assessments/:id**
- Fetch assessment with all questions

---

## File Paths Summary

### API Routes
- `/Users/phuc/work/ClassPulse/apps/api/src/routes/questions-route.ts` — Main question CRUD
- `/Users/phuc/work/ClassPulse/apps/api/src/routes/ai-question-routes.ts` — AI question bulk creation
- `/Users/phuc/work/ClassPulse/apps/api/src/routes/tags-route.ts` — Tag management
- `/Users/phuc/work/ClassPulse/apps/api/src/routes/api-key-routes.ts` — API key management
- `/Users/phuc/work/ClassPulse/apps/api/src/routes/assessment-routes.ts` — Assessment/question collection management
- `/Users/phuc/work/ClassPulse/apps/api/src/index.ts` — Main router registration

### Services
- `/Users/phuc/work/ClassPulse/apps/api/src/services/question-service.ts` — CRUD logic, filtering
- `/Users/phuc/work/ClassPulse/apps/api/src/services/ai-question-parser.ts` — Markdown parsing for AI questions
- `/Users/phuc/work/ClassPulse/apps/api/src/services/clerk-api-key-service.ts` — Clerk API key verification

### Database
- `/Users/phuc/work/ClassPulse/apps/api/src/db/schema.ts` — Drizzle schema

### Schemas/Validation
- `/Users/phuc/work/ClassPulse/packages/shared/src/schemas/index.ts` — Zod schemas for all requests
- `/Users/phuc/work/ClassPulse/packages/shared/src/constants/complexity.ts` — Complexity enums and colors

### Middleware
- `/Users/phuc/work/ClassPulse/apps/api/src/middleware/auth-middleware.ts` — Dual JWT/API Key verification
- `/Users/phuc/work/ClassPulse/apps/api/src/middleware/scope-guard-middleware.ts` — Scope enforcement for API keys

### Tests
- `/Users/phuc/work/ClassPulse/apps/api/src/routes/__tests__/api-key-routes.test.ts` — Example API key flow tests

---

## Key Implementation Details

### Question Parsing (AI)
- **Parser:** `parseAiQuestion()` in ai-question-parser.ts
- **Frontmatter:** YAML with `complexity`, `complexityType`, optional `explanation`, `tags`
- **Options:** Checkbox markdown syntax: `[x]` (correct), `[ ]` (incorrect)
- **Validation:** Ensures 2-6 options, min 1 correct, valid complexity type

### Tag Resolution
- **Auto-creation:** Missing tags created on-demand (up to 10 per request)
- **Deduplication:** Shared tag cache prevents duplicates in bulk operations
- **Case-insensitive lookup:** Tags matched by lowercase name

### Cursor Pagination
- **Implementation:** ID-based, not offset
- **Query:** `WHERE id > cursor ORDER BY id LIMIT 21`
- **Handling:** Fetch N+1 rows; if more than N exist, set nextCursor to last item ID

### Image Handling
- **Format:** Base64 data URIs
- **Validation:** Max 5MB decoded size
- **Supported Types:** PNG, JPEG, GIF, WebP
- **Storage:** Cloudflare R2 (STORAGE binding)
- **Path:** `/api/upload/image/images/{id}.{ext}`

---

## Error Responses

All errors follow JSON format:

```json
{
  "error": "Error message",
  "details": {
    "formErrors": { "field": ["error"] },
    "fieldErrors": {}
  }
}
```

### Common Status Codes
- `400` — Invalid input, validation failure
- `401` — Missing/invalid authentication
- `403` — Insufficient permissions or scope
- `404` — Resource not found
- `500` — Server error

---

## Known Limitations & Gaps

1. **No OpenAPI/Swagger spec** — type-safe only via Hono RPC client
2. **Question banks are implicit** — no dedicated collection entity (use assessments as workaround)
3. **No batch tagging endpoint** — only bulk delete or retag all questions at once
4. **No search across tags** — only by name match or ID array
5. **No soft deletes** — questions permanently removed
6. **Limited image validation** — relies on size check, no MIME sniffing

---

## Integration Points for AI Agents

### Option 1: JWT Session (Existing Teacher)
1. Get Clerk JWT from authenticated user
2. Call `POST /api/questions/ai` with Bearer token
3. Response includes created question IDs and any new tags

### Option 2: API Key (Third-party Service)
1. Teacher creates API key via `POST /api/users/api-keys` with scope `ai:questions:write`
2. Return secret key to teacher (only shown once)
3. Third-party service calls `POST /api/questions/ai` with Bearer token
4. Same response as JWT flow

### Example AI Integration Flow
```
1. AI service receives prompt from teacher
2. AI generates markdown-formatted questions
3. AI calls POST /api/questions/ai with markdown + optional images
4. API parses, uploads images, creates tags, returns question IDs
5. UI fetches and displays created questions
```

---

## Response Examples

### Create Question (Success)
```bash
curl -X POST http://localhost:8787/api/questions \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "What is photosynthesis?",
    "options": [
      {"id":"1","text":"Process where plants make food","isCorrect":true},
      {"id":"2","text":"Process where plants eat","isCorrect":false}
    ],
    "complexity": 2,
    "complexityType": "comprehension",
    "explanation": "Photosynthesis converts light energy to chemical energy",
    "tagIds": ["tag_biology"]
  }'
```

### Create AI Questions (Success)
```bash
curl -X POST http://localhost:8787/api/questions/ai \
  -H "Authorization: Bearer <api_key_or_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "questions": [
      {
        "content": "---\ncomplexity: 1\ncomplexityType: knowledge\ntags:\n  - Biology\n---\nWhat is photosynthesis?\n\n[x] Process of making food from sunlight\n[ ] Process of eating food",
        "image": "data:image/png;base64,..."
      }
    ]
  }'
```

Response:
```json
{
  "created": 1,
  "failed": 0,
  "questions": [
    {"id": "q_new123", "index": 0, "status": "created"}
  ],
  "tagsCreated": ["Biology"]
}
```

---

## Testing Notes

- Unit tests for API key routes available at `/Users/phuc/work/ClassPulse/apps/api/src/routes/__tests__/api-key-routes.test.ts`
- Mock patterns use Vitest with VI mocking for Drizzle and Clerk services
- Pre-inject `userId` and auth context for route testing

---

**End of Report**
