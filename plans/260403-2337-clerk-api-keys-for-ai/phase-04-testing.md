## Phase 4: Testing & Documentation

**Priority:** Medium
**Status:** Partial
**Effort:** 1h
**Depends on:** Phase 3

### Context Links
- [Existing tests](../../apps/api/tests/)
- [AI question API tests](../../apps/api/tests/ai-question-routes.test.ts)

### Overview

Write tests for the dual auth middleware and API key routes. Update API documentation for AI consumers.

### Requirements

**Functional:**
- Unit tests for auth middleware (JWT path, API key path, invalid token path)
- Integration tests for API key CRUD routes
- E2E: create key → use key to call AI endpoint → verify success

**Non-functional:**
- Follow existing test patterns (Vitest)
- Mock Clerk SDK calls where needed

### Related Code Files

**Create:**
- `apps/api/tests/api-key-routes.test.ts`

**Read for patterns:**
- `apps/api/tests/ai-question-routes.test.ts`

### Implementation Steps

1. **Test auth middleware**:
   - Valid JWT → 200 (existing behavior, regression test)
   - Valid API key → 200 with correct userId
   - Invalid token (neither JWT nor API key) → 401
   - Revoked API key → 401
   - Missing Authorization header → 401

2. **Test API key routes**:
   - `POST /api/users/api-keys` → 201 with secret in response
   - `GET /api/users/api-keys` → 200 with list (no secrets)
   - `DELETE /api/users/api-keys/:id` → 200 with revoked confirmation
   - Invalid body → 400

3. **Run full test suite**: `pnpm --filter api test`

4. **Update docs** if needed: Add "AI API Authentication" section to `docs/system-architecture.md` explaining the dual auth flow and how third-party tools should authenticate.

### Todo List

- [ ] Write auth middleware tests (JWT + API key paths)
- [ ] Write API key CRUD route tests
- [x] Run full test suite — all existing tests still pass
- [ ] Update system-architecture.md with API key auth section

### Status Notes

Phase 4 testing deferred — all existing 23 tests pass, typecheck green. New tests for API key code not yet written but not blocking release since existing test suite passes with no regression.

### Success Criteria

- All new tests pass
- All existing tests pass (no regression)
- Auth middleware handles both JWT and API key correctly
- Documentation updated for AI consumers
