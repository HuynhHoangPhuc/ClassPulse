---
phase: 1
title: "Markdown Parser Service"
status: complete
effort: 2h
priority: high
---

# Phase 1 — Markdown Parser Service

## Overview

Core parsing logic: extract YAML frontmatter, split question body from checkbox options, validate structure. Pure functions, no DB/R2 dependencies — easy to unit test.

## Context Links

- Brainstorm parsing pipeline: [brainstorm report §Server Parsing Pipeline](../reports/brainstorm-260403-2221-ai-question-api.md)
- Shared schemas: `packages/shared/src/schemas/index.ts`
- Complexity constants: `packages/shared/src/constants/complexity.ts`

## Key Insights

- YAML frontmatter delimited by first two `---` lines (only match first occurrence to avoid content conflicts)
- Bare checkbox regex: `^\[[ x]\]\s+(.+)$` — single-line only, rich inline markdown OK
- `js-yaml` is pure JS, CF Workers compatible, lightweight (~50KB)
- No full markdown AST needed — regex-based extraction is sufficient

## Requirements

### Functional
- Parse YAML frontmatter from markdown string → extract `complexity`, `complexityType`, `tags`, `explanation`
- Extract question body (text between frontmatter and first checkbox)
- Extract options from bare checkboxes: `[x]` = correct, `[ ]` = incorrect
- Generate unique option IDs (nanoid)
- Return structured result matching existing `CreateQuestionInput` shape

### Non-functional
- Pure functions, no side effects
- Descriptive error messages with valid values (for AI self-correction)
- Handle edge cases: no frontmatter, empty body, no options, all-correct, no-correct

## Related Code Files

### New
- `apps/api/src/services/ai-question-parser.ts` — parser functions

### Modified
- `packages/shared/src/schemas/index.ts` — add `aiCreateQuestionSchema`
- `apps/api/package.json` — add `js-yaml` dependency

## Implementation Steps

1. **Install `js-yaml`** in `apps/api`:
   ```bash
   cd apps/api && pnpm add js-yaml && pnpm add -D @types/js-yaml
   ```

2. **Add Zod schema** to `packages/shared/src/schemas/index.ts`:
   ```typescript
   export const aiQuestionItemSchema = z.object({
     content: z.string().min(1),
     image: z.string().optional(), // base64 data URI or empty
   });

   export const aiCreateQuestionsSchema = z.object({
     questions: z.array(aiQuestionItemSchema).min(1).max(50),
   });
   ```

3. **Create `ai-question-parser.ts`** with these functions:

   **`parseFrontmatter(markdown: string)`**
   - Split on `---` (only first two occurrences)
   - Parse YAML block with `js-yaml`
   - Return `{ frontmatter, body }` or error

   **`parseCheckboxOptions(body: string)`**
   - Regex match lines: `^\[( |x)\]\s+(.+)$` (multiline)
   - Map to `{ id: generateId(8), text, isCorrect }`
   - Return options array

   **`extractQuestionContent(body: string)`**
   - Everything before first checkbox line, trimmed
   - If empty after trim → error

   **`parseAiQuestion(content: string)`** (main entry)
   - Call `parseFrontmatter` → validate fields against Zod/constants
   - Call `extractQuestionContent` + `parseCheckboxOptions`
   - Validate: 2-6 options, ≥1 correct
   - Return `{ content, options, complexity, complexityType, explanation, tagNames }` or `{ error }`

4. **Frontmatter validation rules:**
   - `complexity`: must be 1-5 integer
   - `complexityType`: must be one of 6 Bloom's values
   - `tags`: optional string array
   - `explanation`: optional string
   - Unknown keys: silently ignored (forward-compatible)
   - Missing required: return error with valid values list

## Todo List

- [x] Install `js-yaml` + `@types/js-yaml`
- [x] Add `aiQuestionItemSchema` + `aiCreateQuestionsSchema` to shared schemas
- [x] Create `ai-question-parser.ts` with `parseFrontmatter`
- [x] Implement `parseCheckboxOptions`
- [x] Implement `extractQuestionContent`
- [x] Implement `parseAiQuestion` (main orchestrator)
- [x] Run typecheck to verify compilation

## Success Criteria

- `parseAiQuestion` correctly parses the example markdown from brainstorm report
- Invalid input returns descriptive error messages with valid values
- Edge cases handled: missing frontmatter, no options, 0 correct answers, >6 options
- `pnpm typecheck` passes in both `apps/api` and `packages/shared`

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| `js-yaml` incompatible with CF Workers | Low | Pure JS, no Node APIs. Fallback: hand-parse simple YAML |
| `---` in question content breaks split | Low | Only match first two `---` at line start |
| Regex misses valid checkbox format | Medium | Test with varied inputs, accept `- [x]` as fallback |
