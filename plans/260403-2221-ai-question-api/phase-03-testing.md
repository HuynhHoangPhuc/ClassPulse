---
phase: 3
title: "Testing"
status: complete
effort: 1h
priority: medium
---

# Phase 3 — Testing

## Overview

Unit tests for markdown parser functions, integration tests for the full endpoint with sample AI payloads.

## Context Links

- Parser: `apps/api/src/services/ai-question-parser.ts`
- Route: `apps/api/src/routes/ai-question-routes.ts`
- Existing test patterns: check `apps/api` for test config (vitest, jest, etc.)

## Key Insights

- Parser is pure functions → easy unit tests, no mocking needed
- Endpoint integration tests need D1 + R2 mocks (Cloudflare Miniflare or vitest env)
- Focus parser tests on edge cases: malformed YAML, missing fields, tricky checkbox formats

## Requirements

### Parser Unit Tests
- Valid markdown → correct structured output
- Missing frontmatter → descriptive error
- Invalid complexity value → error with valid values
- No checkbox options found → error
- Mixed correct/incorrect options → correct `isCorrect` mapping
- Empty question body → error
- All options correct (multi-answer) → allowed
- >6 options → error
- <2 options → error
- Frontmatter with unknown keys → silently ignored
- `---` in question body (not at line start) → doesn't break parser

### Endpoint Integration Tests
- Happy path: 2 questions, one with image → both created
- Partial failure: 3 questions, 1 malformed → 2 created, 1 error
- Tag auto-creation: new tag name → created, existing name → reused
- Image upload: base64 PNG → R2 stored, URL in content
- Auth required: no JWT → 401
- Validation: >50 questions → 400

## Related Code Files

### New
- `apps/api/src/services/__tests__/ai-question-parser.test.ts` (or similar path per project convention)

## Implementation Steps

1. Check project test setup (vitest/jest config, test script in package.json)
2. Create parser unit test file with test cases from requirements above
3. Write sample markdown fixtures covering edge cases
4. Run tests, fix any parser bugs discovered
5. If integration test infra exists: add endpoint test with D1/R2 mocks

## Todo List

- [x] Check existing test setup/config
- [x] Create parser unit tests
- [x] Test edge cases (malformed YAML, missing fields, checkbox variants)
- [x] Run tests, all passing (23 tests)
- [x] Add integration test if test infra supports it

## Success Criteria (ALL MET)

- [x] All 23 parser unit tests pass
- [x] Edge cases covered: ≥10 test cases (covered 20+)
- [x] No regressions in existing typecheck (clean)
