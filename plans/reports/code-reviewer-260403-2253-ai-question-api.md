# Code Review: AI-Native Question Creation API

## Scope
- **Files reviewed**: 5 new/modified + 5 context files
- **LOC (new)**: ~530 (parser: 194, route: 218, tests: 311, schema additions: ~10, index change: ~3)
- **Focus**: Security, edge cases, performance, type safety, API contracts

## Overall Assessment

Well-structured implementation with clean separation of concerns. The pure-function parser design is excellent for testability. The partial-success model is appropriate for bulk operations. Several issues identified below, ranging from critical security gaps to minor improvements.

---

## Critical Issues

### C1. No `content` or `image` size limit in Zod schema -- memory/DoS vector

**File**: `packages/shared/src/schemas/index.ts:154-157`

```ts
export const aiQuestionItemSchema = z.object({
  content: z.string().min(1),     // no max
  image: z.string().optional(),   // no max
});
```

**Impact**: An attacker can send a single request with 50 questions, each containing multi-megabyte `content` strings and multi-megabyte base64 `image` strings. On a Cloudflare Worker with 128MB memory limit, this could OOM the worker or cause extreme latency. The base64 regex `(.+)$` will also backtrack catastrophically on very large non-matching strings.

The existing `createQuestionSchema` has `content: z.string().min(1)` without a max too, but the AI endpoint also accepts the `image` field (potentially ~6.7MB base64 for a 5MB image per item, times 50 = 335MB of image data alone).

**Fix**:
```ts
export const aiQuestionItemSchema = z.object({
  content: z.string().min(1).max(10_000),
  image: z.string().max(7_000_000).optional(), // ~5MB decoded = ~6.7MB base64
});
```

### C2. `atob()` throws on invalid base64 -- unhandled exception crashes the question

**File**: `apps/api/src/routes/ai-question-routes.ts:50`

```ts
const binary = atob(encoded);
```

`atob` throws `DOMException` on invalid base64 characters. While the outer `try/catch` at line 200 would catch this, the error message would be an opaque `"Invalid character"` rather than a user-friendly message. More importantly, the regex `(.+)$` matches any character after `base64,` including non-base64 characters, so invalid data will reach `atob`.

**Fix**: Wrap in try/catch with a clear error message:
```ts
let binary: string;
try {
  binary = atob(encoded);
} catch {
  return { error: "Invalid base64 encoding in image data URI" };
}
```

### C3. No role-based authorization -- students/parents can create questions

**File**: `apps/api/src/routes/ai-question-routes.ts:127`

The endpoint only verifies authentication (via `authMiddleware`) but never checks that the user's role is `teacher`. Any authenticated user (student, parent) can call `POST /api/questions/ai` and create questions + tags in the system.

**Note**: This is a pre-existing pattern -- `questions-route.ts` also doesn't check roles. The `createQuestion` service uses `teacherId` parameter from `userId`, meaning a student's ID would be stored as `teacherId`. This is a systemic issue but the AI endpoint amplifies the risk because it also auto-creates tags.

**Recommendation**: Add role checking middleware or inline check. At minimum, document this as a known gap and create a follow-up ticket. For immediate mitigation:
```ts
const user = await db.select({ role: users.role }).from(users).where(eq(users.id, teacherId)).get();
if (!user || user.role !== "teacher") {
  return c.json({ error: "Only teachers can create questions" }, 403);
}
```

---

## High Priority

### H1. N+1 query: `resolveTagNames` fetches ALL teacher tags for EVERY question

**File**: `apps/api/src/routes/ai-question-routes.ts:82-83`

For a batch of 50 questions, each calling `resolveTagNames` independently, the function executes `SELECT * FROM tags WHERE teacher_id = ?` inside each call -- that is 50 identical queries. Additionally, newly created tags within one question's resolution are added to the local `nameToId` map but NOT visible to subsequent question iterations because each call creates a fresh map.

**Impact**: 
- 50 redundant identical queries
- Duplicate tags created: If questions 1 and 5 both reference a new tag "algebra", both will create it (since each call fetches fresh and doesn't see the other's insert)

**Fix**: Hoist tag resolution outside the loop. Fetch all teacher tags once, pass the map into each iteration, and update it as new tags are created:

```ts
// Before the loop:
const existingTags = await db.select({ id: tags.id, name: tags.name })
  .from(tags).where(eq(tags.teacherId, teacherId));
const nameToId = new Map<string, string>();
for (const t of existingTags) nameToId.set(t.name.toLowerCase(), t.id);

// In the loop, use the shared nameToId map
```

### H2. Data URI regex `(.+)$` with `s`-flag behavior -- newlines in base64

**File**: `apps/api/src/routes/ai-question-routes.ts:32`

```ts
const match = dataUri.match(/^data:(image\/\w+);base64,(.+)$/);
```

By default in JS, `.` does not match `\n`. If the base64 string contains embedded newlines (which is valid in many base64 encoders), the regex will fail to match. The fix is either to strip whitespace from the encoded data before processing, or use `[\s\S]+` instead of `.+`.

**Fix**:
```ts
const match = dataUri.match(/^data:(image\/\w+);base64,([\s\S]+)$/);
// Then strip whitespace before decoding:
const encoded = match[2].replace(/\s/g, '');
```

### H3. R2 key path allows subdirectory injection

**File**: `apps/api/src/routes/ai-question-routes.ts:172`

```ts
const key = `images/${generateId()}.${imageResult.ext}`;
```

Currently `ext` is derived from `ALLOWED_IMAGE_TYPES` lookup (line 38), so it can only be `png`, `jpg`, `gif`, or `webp`. This is safe. However, the regex `image\/\w+` on line 32 would match `image/png_../../etc` -- but the ALLOWED_IMAGE_TYPES check on line 38-41 prevents this from reaching `key` construction. Defense in depth is adequate here.

**Status**: Safe -- noting for documentation purposes.

### H4. Missing HTTP status code on success response

**File**: `apps/api/src/routes/ai-question-routes.ts:215`

```ts
return c.json({ created, failed, questions: results, tagsCreated: uniqueTagsCreated });
```

The endpoint returns 200 even when all questions fail. The existing `POST /api/questions` returns 201 on success. For partial success semantics, consider:
- 201 when all succeed
- 207 (Multi-Status) or 200 when partial
- 400 when all fail

**Recommendation**:
```ts
const status = failed === 0 ? 201 : created > 0 ? 207 : 400;
return c.json({ created, failed, questions: results, tagsCreated: uniqueTagsCreated }, status);
```

---

## Medium Priority

### M1. YAML `!!binary`, `!!timestamp` type coercion risks

**File**: `apps/api/src/services/ai-question-parser.ts:54`

js-yaml v4's `yaml.load` uses `DEFAULT_SCHEMA` (equivalent to `JSON_SCHEMA` + some extras). It handles `!!timestamp`, `!!merge`, etc. While not a code execution risk (v4 removed that), YAML type tags could cause `fm.complexity` to be a `Date` object instead of a number if someone writes `complexity: 2024-01-01`. The `Number()` coercion on line 115 would produce `NaN`, which would be caught by the `isInteger` check. So this is defended, but using `yaml.load(yamlBlock, { schema: yaml.JSON_SCHEMA })` would be stricter.

### M2. Tag name length unbounded in auto-creation

**File**: `apps/api/src/routes/ai-question-routes.ts:114`

```ts
await db.insert(tags).values({ id, name, teacherId, color: null, createdAt: now });
```

The existing `createTagSchema` enforces `.max(50)` on tag names, but the AI route bypasses this schema since tag names come from YAML frontmatter. A malicious input could create tags with extremely long names.

**Fix**: Add validation in `resolveTagNames` or in `validateFrontmatter`:
```ts
tagNames = fm.tags.map((t) => String(t).trim()).filter(Boolean);
if (tagNames.some(n => n.length > 50)) {
  return { ok: false, error: "Tag names must be 50 characters or fewer" };
}
```

### M3. `injectImageUrl` only replaces FIRST `](image)` occurrence

**File**: `apps/api/src/routes/ai-question-routes.ts:63-64`

```ts
return content.replace(/\]\(image\)/, `](${imageUrl})`);
```

If the AI-generated content contains multiple `![...](image)` placeholders, only the first is replaced. This may be intentional (one image per question), but if so, subsequent `](image)` placeholders remain as broken links.

**Recommendation**: Document this as single-image-per-question behavior, or replace all occurrences, or reject content with multiple image placeholders.

### M4. `complexityType` case normalization may drift from DB

**File**: `apps/api/src/services/ai-question-parser.ts:127`

```ts
const complexityType = String(fm.complexityType).toLowerCase();
```

The parser lowercases the complexityType, and the `COMPLEXITY_TYPES` are all lowercase. However, the `createQuestion` service stores whatever is passed. If a future change adds mixed-case types to `COMPLEXITY_TYPES`, the parser's `.toLowerCase()` would silently match but store the lowercased version. This is a minor fragility.

---

## Low Priority

### L1. `parseFrontmatter` matches `---` with surrounding whitespace

**File**: `apps/api/src/services/ai-question-parser.ts:39`

```ts
const firstIdx = lines.findIndex((l) => l.trim() === "---");
```

Using `.trim()` allows `   ---   ` to match. Standard YAML frontmatter spec requires `---` at column 0. This is more permissive than necessary but unlikely to cause issues in practice.

### L2. Test coverage gap: no tests for `parseBase64DataUri` or `injectImageUrl`

These route-level helper functions have no unit tests. Consider extracting them to a utility module and adding tests, especially for edge cases (invalid base64, missing placeholder, newlines in data).

### L3. Sequential DB writes in a loop without batching

**File**: `apps/api/src/routes/ai-question-routes.ts:150-207`

Each question does: parse -> upload -> resolve tags (with potential INSERT) -> createQuestion (with INSERT + SELECT + optional INSERT). For 50 questions, this is ~150-250 sequential DB operations. D1 has per-request limits. Consider batching where possible, though the partial-success model makes this harder.

---

## Positive Observations

1. **Pure function parser**: Clean separation of parsing logic from side effects. Excellent testability.
2. **Comprehensive validation**: Frontmatter fields validated with clear error messages including valid values.
3. **Partial success model**: Each question processed independently with proper error isolation. The outer try/catch ensures unknown exceptions don't halt the batch.
4. **Route ordering**: Correctly placed before `/api/questions` to avoid Hono's `:id` param capturing "ai".
5. **Size estimation before decode**: Checking base64 encoded length before calling `atob` avoids allocating huge buffers.
6. **Test quality**: 23 tests covering happy paths, validation errors, edge cases (all-correct, unknown frontmatter keys, empty body).

---

## Recommended Actions (priority order)

1. **[Critical]** Add `.max()` limits to `aiQuestionItemSchema` content and image fields
2. **[Critical]** Wrap `atob()` in try/catch with clear error message
3. **[Critical]** Add role authorization check (teacher-only) -- or document as tech debt
4. **[High]** Hoist tag resolution outside the question processing loop to fix N+1 and duplicate tag creation
5. **[High]** Handle newlines in base64 data (strip whitespace or use `[\s\S]+`)
6. **[Medium]** Enforce tag name max length (50 chars) consistent with `createTagSchema`
7. **[Medium]** Consider appropriate HTTP status codes for partial/full failure responses
8. **[Low]** Extract and unit-test `parseBase64DataUri` and `injectImageUrl`

---

## Metrics

| Metric | Value |
|--------|-------|
| TypeScript compilation | Clean (0 errors) |
| Unit tests | 23/23 passing |
| Test coverage | Parser: good; Route handlers: 0% (no integration tests) |
| Linting | Not run (no lint config changes) |

---

## Unresolved Questions

1. Is role-based authorization intentionally deferred across all question endpoints, or was it missed? The current design allows any authenticated user to act as a teacher.
2. Should the endpoint support multi-image questions (multiple `](image)` placeholders), or is single-image-per-question the intended constraint?
3. What is the expected Cloudflare Worker memory/CPU budget for this endpoint? A 50-question batch with images could be resource-intensive.

**Status:** DONE_WITH_CONCERNS
**Summary:** Well-designed feature with clean parser architecture and good test coverage. Three critical issues found: missing input size limits (DoS), unhandled atob exception, and missing role authorization.
**Concerns:** The N+1 tag resolution query will cause duplicate tags in production when multiple questions in the same batch reference the same new tag name. The missing content/image size limits on the Zod schema are the most urgent fix.
