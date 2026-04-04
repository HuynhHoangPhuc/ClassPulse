# Phase Implementation Report

## Executed Phase
- Phase: clerk-api-key-unit-tests
- Plan: /Users/phuc/work/ClassPulse/plans/260404-1058-dependency-upgrade-scope-tests
- Status: completed

## Files Modified
- `apps/api/src/middleware/__tests__/auth-middleware.test.ts` — created, 125 lines, 8 tests
- `apps/api/src/middleware/__tests__/scope-guard-middleware.test.ts` — created, 62 lines, 6 tests
- `apps/api/src/services/__tests__/clerk-api-key-service.test.ts` — created, 120 lines, 8 tests
- `apps/api/src/routes/__tests__/api-key-routes.test.ts` — created, 155 lines, 10 tests

Total new tests: 32 (pre-existing: 22 in ai-question-parser). Suite total: 54 passing.

## Tasks Completed
- [x] auth-middleware tests: dual auth flow (JWT priority, fallback to API key, missing header, no sub, no subject)
- [x] scope-guard tests: session bypass, scope match/miss, empty scopes, multi-scope, 403 body
- [x] clerk-api-key-service tests: verify valid/invalid, create with/without scopes, list with filter, revoke call args and return
- [x] api-key-routes tests: POST valid/invalid body, GET no secrets, DELETE owned/unowned, teacher role guard, expiresInDays conversion

## Tests Status
- Type check: not run (no `tsc` in CI path for this filter — vitest transform catches type errors)
- Unit tests: **54/54 passed**

## Issues Encountered
- `vi.restoreAllMocks()` only restores `vi.spyOn` spies, not `vi.fn()` call counts — caused the "verifyApiKey never called" assertion to fail because prior tests' calls were still counted. Fixed by switching to `vi.clearAllMocks()` in all `beforeEach` hooks.
- Unused `getMockApiKeys()` helper removed from service test after the `beforeEach` simplification.

## Key Patterns Used
- Module factory mock (`vi.mock("@clerk/backend", () => ({ createClerkClient: vi.fn(() => ({ apiKeys: mockApiKeys })) }))`) keeps a single shared `mockApiKeys` object across all calls — tests grab it via `createClerkClient({ secretKey })` in each test body.
- Hono `app.request()` / `app.fetch()` for route testing with `fakeEnv` bindings injected.
- Pre-middleware pattern to inject auth context variables for scope-guard and route tests without running real auth.
- `mockDrizzle.mockReturnValue(queryChain)` with a chainable query mock object for D1/drizzle simulation.

## Next Steps
- None — all tests green, task complete.
