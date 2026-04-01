# Phase 2: Question Bank

## Context

- [Phase 1 Foundation](./phase-01-foundation.md) — monorepo, schema, auth
- [Design Guidelines §6.3](../../docs/design-guidelines.md) — Question Bank page design

## Overview

- **Priority**: P1
- **Status**: Pending
- **Effort**: 12h
- **Depends On**: Phase 1
- **Description**: Full CRUD for multiple-choice questions with markdown content, tag management, complexity scoring, image upload to R2, and list/grid views with filtering.

## Key Insights

- Questions use markdown for content — need editor + live preview with same rendering pipeline
- Options stored as JSON array in text column: `[{id, text, is_correct}]`
- Tags are per-teacher (teacher A's tags isolated from teacher B)
- Image upload goes to R2, returns URL embedded in markdown
- Filtering happens server-side (D1 queries) for pagination support

## Requirements

### Functional
- CRUD questions with markdown body + 4 MCQ options
- Tag CRUD (create, edit, delete, assign to questions)
- Complexity score (1-5) and type (Bloom's taxonomy) per question
- Optional explanation field (markdown, shown post-answer)
- Image upload to R2 via drag-drop or toolbar button
- List view (compact) and grid view (preview-rich)
- Filter by: tags (multi-select), complexity (range), search text
- Bulk delete and bulk re-tag
- Pagination (cursor-based)

### Non-Functional
- Markdown rendering: code highlight (Shiki), images, Mermaid diagrams, KaTeX math
- Editor and preview use identical rendering pipeline
- Image upload max 5MB, client-side compression for images > 1MB
- Question list loads in < 500ms

## Architecture

### API Routes

```
GET    /api/questions          — List with filters, pagination
GET    /api/questions/:id      — Get single question
POST   /api/questions          — Create question
PUT    /api/questions/:id      — Update question
DELETE /api/questions/:id      — Delete question
POST   /api/questions/bulk     — Bulk operations (delete, re-tag)

GET    /api/tags               — List teacher's tags
POST   /api/tags               — Create tag
PUT    /api/tags/:id           — Update tag
DELETE /api/tags/:id           — Delete tag

POST   /api/upload/image       — Upload image to R2, return URL
```

### Data Flow

```
Teacher → Markdown Editor → API (validate + save) → D1
                                                      ↓
Teacher ← Rendered Preview ← react-markdown ← API (fetch) ← D1
                                    ↑
                              Same plugins:
                              remark-gfm, rehype-highlight,
                              remark-math, rehype-katex, mermaid
```

## Related Code Files

### Files to Create
- `apps/api/src/routes/questions-routes.ts` — Question CRUD endpoints
- `apps/api/src/routes/tags-routes.ts` — Tag CRUD endpoints
- `apps/api/src/routes/upload-routes.ts` — R2 image upload
- `apps/api/src/services/question-service.ts` — Question business logic
- `apps/api/src/services/tag-service.ts` — Tag business logic
- `apps/web/src/features/questions/` — Question bank feature module
  - `question-list-page.tsx` — Main list/grid page
  - `question-editor-page.tsx` — Create/edit page
  - `question-card.tsx` — Card component for list/grid
  - `question-filter-panel.tsx` — Filter sidebar
  - `markdown-editor.tsx` — Markdown editor with toolbar
  - `markdown-preview.tsx` — Markdown renderer (shared)
  - `tag-selector.tsx` — Multi-select tag picker with create
  - `complexity-selector.tsx` — Visual 1-5 scale selector
  - `image-upload-button.tsx` — R2 image upload
- `packages/shared/src/schemas/question-schemas.ts` — Zod schemas
- `packages/shared/src/schemas/tag-schemas.ts`

## Implementation Steps

### 1. Tag Management API + UI (2h)

1. Create tag CRUD endpoints in Hono (scoped to teacher_id)
2. Create tag Zod schemas: `createTagSchema`, `updateTagSchema`
3. Build tag management UI: list, create inline, edit name/color, delete with confirmation
4. Tag selector component: multi-select dropdown with color dots, "Create new" option

### 2. Question CRUD API (3h)

1. Create question endpoints with Drizzle queries:
   - List: filter by tag_ids, complexity range, search text; cursor pagination
   - Create: validate with Zod, insert question + question_tags in transaction
   - Update: update question + sync tags (delete old, insert new)
   - Delete: cascade delete question_tags, check no assessment links (warn)
2. Bulk endpoint: accept action (delete | retag) + question_ids + optional tag_ids
3. Image upload endpoint: validate file type/size, upload to R2, return public URL

### 3. Markdown Editor Component (3h)

1. Install `@mdxeditor/editor` or use plain textarea + toolbar approach
   - Recommend: textarea + custom toolbar for simplicity (KISS)
   - Toolbar buttons: Bold, Italic, Code, Code Block, Image, Link, Math
2. Create `markdown-preview.tsx` — shared renderer using:
   ```
   react-markdown + remark-gfm + remark-math + rehype-katex + rehype-highlight
   ```
   Plus Mermaid rendering via `mermaid` library (lazy loaded)
3. Split view: editor left, preview right (desktop), tabbed (mobile)
4. Image upload: toolbar button triggers R2 upload, inserts `![](url)` at cursor

### 4. Question List Page (2h)

1. Page layout: header (title + search + view toggle + "New Question" button)
2. Filter panel: collapsible sidebar or sheet
   - Tag multi-select (from tag selector component)
   - Complexity range (two dropdowns: min-max)
   - Complexity type dropdown
3. List view: compact cards with truncated preview, tags, complexity badge, actions menu
4. Grid view: larger cards with more markdown preview
5. Empty state per design guidelines
6. Pagination: "Load more" button (cursor-based)

### 5. Question Editor Page (2h)

1. Full-page form: split markdown editor + preview
2. Options editor: 4 text inputs with radio button for "correct answer"
   - Allow adding/removing options (min 2, max 6)
3. Tag selector (from step 1)
4. Complexity selector: 5 colored circles (1-5) matching design color scale
5. Complexity type: dropdown with Bloom's taxonomy values
6. Explanation field: collapsible markdown editor
7. Save: validate with Zod, POST/PUT to API
8. Success: redirect to question list with toast

## Todo

- [ ] Create tag CRUD API endpoints
- [ ] Create tag management UI component
- [ ] Create tag selector (multi-select with create)
- [ ] Create question CRUD API with filtering/pagination
- [ ] Create bulk operations endpoint
- [ ] Create R2 image upload endpoint
- [ ] Build markdown editor component with toolbar
- [ ] Build markdown preview component (shared renderer)
- [ ] Build question list page (list + grid views)
- [ ] Build filter panel (tags, complexity, search)
- [ ] Build question editor page (form + split preview)
- [ ] Build complexity selector component
- [ ] Build options editor (MCQ choices)
- [ ] Add empty states and loading skeletons
- [ ] Test markdown rendering: code, images, mermaid, math

## Success Criteria

- Teacher can create question with markdown content, 4 options, tags, complexity
- Markdown renders correctly: code highlighting, images, mermaid, KaTeX
- Tag management works (CRUD, assignment)
- Image upload to R2 works, URL embedded in markdown
- Filter by tag + complexity returns correct results
- List and grid views render properly
- Bulk delete and re-tag work
- Pagination loads more questions on scroll/click

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Markdown editor bundle size (MDXEditor is heavy) | Medium | Use plain textarea + toolbar, lazy-load preview |
| Mermaid rendering performance | Low | Lazy load mermaid, render on demand |
| R2 upload CORS issues | Medium | Configure R2 CORS policy in wrangler.toml |
| D1 text search limitations (no full-text) | Low | Use LIKE queries; sufficient for small scale |

## Security

- Questions scoped to teacher_id (teacher can only see/edit own questions)
- Image upload validates file type (png, jpg, gif, webp) and size (< 5MB)
- R2 bucket not publicly readable — serve through Worker with auth check
- Zod validation on all inputs
