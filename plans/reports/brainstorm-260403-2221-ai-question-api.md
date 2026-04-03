# Brainstorm: AI-Native Question Creation API

**Date:** 2026-04-03
**Status:** Approved

---

## Problem Statement

Current `POST /api/questions` expects structured JSON with explicit fields (`content`, `options[]`, `complexity`, etc.) — optimized for UI forms, not AI agents. AI agents generate markdown more fluently than structured JSON. Need an endpoint where AI sends a markdown blob and server parses it into the existing question schema.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Format | Full markdown w/ YAML frontmatter | Most natural for LLMs, single text gen |
| Endpoint | `POST /api/questions/ai` (separate) | Clean separation, independent validation |
| Bulk | Array of `{content, image}` objects | Batch creation in one request |
| Tags | Name-based, auto-create missing | AI doesn't know tag IDs |
| Image | Base64 inline | AI doesn't need separate upload step |
| Options | Bare checkboxes `[ ]`/`[x]`, single-line, rich inline markdown | Simple parsing, covers 99% cases |
| Batch mode | Partial success | Each question succeeds/fails independently |

---

## API Specification

### `POST /api/questions/ai`

**Auth:** JWT (same as existing endpoints). Questions scoped to `teacherId` from token.

### Request Body

```json
{
  "questions": [
    {
      "content": "---\ncomplexity: 3\ncomplexityType: application\ntags:\n  - algebra\n  - quadratic equations\nexplanation: |\n  Factor x² + 5x + 6 = (x+2)(x+3), so x = -2, -3.\n---\n\nWhat is the solution to $x^2 + 5x + 6 = 0$?\n\n![diagram](image)\n\n[x] $x = -2, x = -3$\n[ ] $x = 1, x = 6$\n[ ] $x = 2, x = 3$\n[ ] $x = -1, x = -6$",
      "image": "data:image/png;base64,iVBOR..."
    },
    {
      "content": "---\ncomplexity: 1\ncomplexityType: knowledge\ntags:\n  - vocabulary\n---\n\nWhat does **HTTP** stand for?\n\n[x] HyperText Transfer Protocol\n[ ] High Transfer Text Protocol\n[ ] HyperText Transmission Protocol"
    }
  ]
}
```

### Markdown Format (what AI generates per question)

```markdown
---
complexity: 3
complexityType: application
tags:
  - algebra
  - quadratic equations
explanation: |
  Factor x² + 5x + 6 = (x+2)(x+3), so x = -2, -3.
---

What is the solution to the equation $x^2 + 5x + 6 = 0$?

![diagram](image)

[x] $x = -2, x = -3$
[ ] $x = 1, x = 6$
[ ] $x = 2, x = 3$
[ ] $x = -1, x = -6$
```

### Frontmatter Fields

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `complexity` | integer | Yes | — | 1-5 |
| `complexityType` | string | Yes | — | knowledge, comprehension, application, analysis, synthesis, evaluation |
| `tags` | string[] | No | `[]` | Tag names, case-insensitive match |
| `explanation` | string | No | `null` | Free text, supports markdown |

### Response

```json
{
  "created": 1,
  "failed": 1,
  "questions": [
    { "id": "q_abc123def456", "index": 0, "status": "created" },
    {
      "index": 1,
      "status": "error",
      "error": "Options must have at least 1 correct answer (marked with [x])"
    }
  ],
  "tagsCreated": ["quadratic equations"]
}
```

**HTTP Status:** `200` (even with partial failures — check per-question `status`). `400` only if the top-level JSON is malformed.

---

## Server Parsing Pipeline

1. **Validate JSON**: Ensure `questions` array exists, each item has `content` string
2. **Per question** (loop, partial success):
   a. **Frontmatter extraction**: Split on `---` delimiters, extract YAML block
   b. **YAML parse**: Extract `complexity`, `complexityType`, `tags`, `explanation`
   c. **Body split**: Everything after second `---` = question body
   d. **Option extraction**: Lines matching `^\[[ x]\]\s+(.+)$` → `[x]` = correct, `[ ]` = incorrect
   e. **Question content**: Body text before first checkbox line (trimmed)
   f. **Image upload**: If `image` field has base64 → upload to R2 → get URL
   g. **Image placement**: Replace `(image)` in `![...](image)` with real URL. If no placeholder, prepend `![](url)\n\n` to content
   h. **Tag resolution**: For each tag name → case-insensitive lookup by `name` + `teacherId` → create if missing
   i. **Validate**: 2-6 options, ≥1 correct, valid complexity/type
   j. **Create**: Insert question + question_tags in transaction
3. **Aggregate results**: Collect created/failed counts, list of newly created tags

---

## Key Constraints

- **Single-line options only**: Each `[ ]`/`[x]` option must be one line. Rich inline markdown (code, math, bold) supported. Multi-line code blocks inside options are NOT supported.
- **One image per question**: `image` field is optional, max one per question item.
- **Tag auto-creation**: New tags get `teacherId` from JWT, `color` defaults to null.
- **Partial success**: Each question processed independently. Failure of one doesn't roll back others.
- **Error messages include valid values**: e.g., `"Invalid complexityType 'recall'. Valid: knowledge, comprehension, application, analysis, synthesis, evaluation"` — helps AI self-correct.

---

## Implementation Considerations

### New Files Needed
- `apps/api/src/routes/ai-question-routes.ts` — endpoint + validation
- `apps/api/src/services/ai-question-parser.ts` — markdown/frontmatter parsing logic
- `packages/shared/src/schemas/index.ts` — add `aiCreateQuestionSchema` Zod schema

### Dependencies
- `yaml` or `js-yaml` package for YAML frontmatter parsing (check if already in deps)
- Existing R2 upload logic in `upload-route.ts` can be extracted into shared utility

### Parsing Library Choice
- Use `js-yaml` (lightweight, well-maintained) for frontmatter
- Regex-based checkbox extraction (no need for full markdown AST parser)

### Rate Limiting
- Consider higher rate limit than standard endpoints since AI sends batch requests
- Suggest: 10 requests/minute per teacher, max 50 questions per request

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Malformed YAML from AI | Medium | Clear error messages with valid values |
| `---` in question content breaks frontmatter | Low | Only match first two `---` delimiters |
| Base64 image too large | Medium | Enforce max size (e.g., 5MB), return clear error |
| Tag name explosion (AI creates too many) | Low | Cap new tags per request (e.g., 10) |
| AI sends >50 questions | Low | Enforce max array size in Zod validation |

---

## Success Metrics

- AI agent can create questions with a single API call (no multi-step workflow)
- Parsing success rate >95% with well-prompted AI
- Error messages actionable enough for AI self-correction
- Existing question bank UI displays AI-created questions identically to manually created ones

---

## Next Steps

1. Create implementation plan with phases
2. Implement markdown parser + tests
3. Implement API endpoint
4. Integration test with sample AI payloads
