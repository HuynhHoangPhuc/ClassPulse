---
phase: 2
title: "API Route + Integration"
status: complete
effort: 3h
priority: high
---

# Phase 2 — API Route + Integration

## Overview

Create `POST /api/questions/ai` endpoint. Handle base64 image upload to R2, tag resolution (name → ID, auto-create), question creation via existing `createQuestion` service, partial success batch response.

## Context Links

- Parser from Phase 1: `apps/api/src/services/ai-question-parser.ts`
- Existing question service: `apps/api/src/services/question-service.ts` (reuse `createQuestion`, `fetchTagsForQuestions`)
- Upload route (R2 pattern): `apps/api/src/routes/upload-route.ts`
- App entry: `apps/api/src/index.ts`
- Env bindings: `apps/api/src/env.ts` (`STORAGE` = R2 bucket)

## Key Insights

- Reuse existing `createQuestion()` from question-service.ts — don't duplicate DB insert logic
- But `createQuestion` expects `tagIds[]`, not tag names → need tag resolution step between parse and create
- Base64 image upload differs from existing multipart upload → new utility function needed
- R2 put pattern: `c.env.STORAGE.put(key, arrayBuffer, { httpMetadata: { contentType } })`
- Partial success: process each question independently, collect results

## Requirements

### Functional
- Accept `{ questions: [{ content, image? }] }` JSON body
- Parse each question's markdown via Phase 1 parser
- Upload base64 images to R2, replace `(image)` placeholder in content
- Resolve tag names to IDs: case-insensitive match by `name` + `teacherId`, create missing
- Create question + tags via existing service
- Return per-question status (created/error) + aggregate counts + list of newly created tags

### Non-functional
- JWT auth (existing `/api/*` middleware)
- Max 50 questions per request (Zod validation)
- Max 5MB per image (base64 decoded size)
- Max 10 new tags auto-created per request

## Related Code Files

### New
- `apps/api/src/routes/ai-question-routes.ts` — endpoint handler

### Modified
- `apps/api/src/index.ts` — register new route
- `apps/api/src/services/question-service.ts` — may need to export helper or add tag-by-name lookup

## Implementation Steps

1. **Create `ai-question-routes.ts`** with route handler:

   ```typescript
   const aiQuestionRoutes = new Hono<Env & { Variables: Variables }>();

   aiQuestionRoutes.post("/", async (c) => {
     // 1. Validate request body with aiCreateQuestionsSchema
     // 2. Loop questions with partial success
     // 3. For each: parse → upload image → resolve tags → create question
     // 4. Aggregate and return results
   });
   ```

2. **Base64 image upload utility** (inside route file or small helper):
   - Parse data URI: `data:image/png;base64,<data>` → extract MIME + buffer
   - Validate MIME (png/jpg/gif/webp) and decoded size (≤5MB)
   - Upload to R2: `STORAGE.put("images/{id}.{ext}", buffer, { httpMetadata })`
   - Return URL: `/api/upload/image/images/{id}.{ext}`

3. **Image placeholder replacement**:
   - If content contains `![` + `](image)` → replace `image` src with uploaded URL
   - If content has no `![...](image)` → prepend `![](url)\n\n` to content

4. **Tag resolution** (inside route handler):
   - Query existing tags: `SELECT id, name FROM tags WHERE teacher_id = ? AND LOWER(name) IN (?)`
   - Build name→ID map (case-insensitive)
   - For unmatched names: `INSERT INTO tags` with `generateId()`, `teacherId`, `color: null`
   - Cap new tags at 10 per request
   - Collect `tagsCreated` list for response

5. **Question creation**:
   - Build `CreateQuestionInput` from parsed data + resolved tag IDs
   - Call existing `createQuestion(db, teacherId, input)`
   - On success: `{ id, index, status: "created" }`
   - On error: `{ index, status: "error", error: message }`

6. **Wire route in `index.ts`**:
   ```typescript
   import { aiQuestionRoutes } from "./routes/ai-question-routes.js";
   // Add after existing questions route:
   .route("/api/questions/ai", aiQuestionRoutes)
   ```
   **IMPORTANT:** Register BEFORE `/api/questions` to avoid path conflict (Hono matches first).

7. **Response shape**:
   ```typescript
   return c.json({
     created: successCount,
     failed: failCount,
     questions: results, // [{id, index, status} | {index, status, error}]
     tagsCreated: newTagNames,
   });
   ```

## Todo List

- [x] Create `ai-question-routes.ts` with POST handler skeleton
- [x] Implement base64 → R2 upload utility
- [x] Implement image placeholder replacement in content
- [x] Implement tag name → ID resolution with auto-create
- [x] Integrate with `parseAiQuestion` from Phase 1
- [x] Integrate with existing `createQuestion` service
- [x] Build partial-success response aggregation
- [x] Register route in `index.ts` (before `/api/questions`)
- [x] Run typecheck (clean)
- [x] Code review fixes: max lengths, base64 handling, N+1 prevention

## Success Criteria

- `POST /api/questions/ai` with valid markdown returns 200 with created questions
- Base64 images uploaded to R2 and URL injected into content
- Tags resolved by name, new tags created when missing
- Partial failure: good questions created, bad ones return errors
- Created questions visible in existing question bank UI (GET /api/questions)

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Route path conflict `/api/questions/ai` vs `/api/questions/:id` | Medium | Register AI route first in index.ts |
| Base64 decode OOM on large images | Medium | Validate encoded length before decode (~1.37x of 5MB = ~6.85MB max) |
| Tag name collisions (case sensitivity) | Low | Use LOWER() in SQL, normalize before comparison |
| Concurrent tag creation race | Low | D1 is single-writer; INSERT OR IGNORE pattern |

## Security Considerations

- Auth: JWT required (existing middleware covers `/api/*`)
- Owner scoping: all questions + tags scoped to `teacherId` from JWT
- Input size: Zod limits 50 questions, 5MB per image
- No arbitrary file writes: only `images/` prefix in R2
