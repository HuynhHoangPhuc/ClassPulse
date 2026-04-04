# Phase 3 — Unit Tests (Mock-Based)

## Context Links
- [Testing Patterns Research](../reports/researcher-260404-1058-api-key-testing-patterns.md)
- [Auth Middleware (after Phase 2)](../../apps/api/src/middleware/auth-middleware.ts)
- [Scope Guard Middleware (new in Phase 2)](../../apps/api/src/middleware/scope-guard-middleware.ts)
- [Clerk API Key Service (after Phase 1)](../../apps/api/src/services/clerk-api-key-service.ts)
- [API Key Routes](../../apps/api/src/routes/api-key-routes.ts)
- [AI Question Routes](../../apps/api/src/routes/ai-question-routes.ts)
- [Existing Tests](../../apps/api/src/services/__tests__/ai-question-parser.test.ts)

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 3h
- **Depends on:** Phase 2 (scope enforcement in place)

Write ~40 unit tests covering auth middleware (dual auth + scope enforcement), Clerk API key service (SDK wrapper), and API key routes (CRUD + role guard + ownership). All tests use Vitest mocks — no real Clerk API, no real D1.

## Key Insights

1. **No vitest.config exists.** Vitest runs via `vitest run` (package.json script). Need to create `vitest.config.ts` or verify Vitest picks up `tsconfig.json` paths.
2. **Existing test pattern:** `apps/api/src/services/__tests__/ai-question-parser.test.ts` uses plain `describe/it/expect` — no special config, no CF pool. Follow same pattern.
3. **Mock strategy:** `vi.mock('@clerk/backend')` for `verifyToken`, mock the service functions for route tests, `vi.stubGlobal('fetch')` only if testing the REST wrapper directly (may not be needed post-Phase 1 since service now uses SDK).
4. **Hono testClient vs direct app.request:** `testClient()` gives type-safe calls but requires chained route definition. Since `index.ts` already chains routes, import `app` and use `app.request()` for simplicity. `testClient()` is optional.
5. **D1 mock for role guard:** The API key routes query `users` table for role check. Mock `drizzle()` or mock the entire route middleware. Simplest: mock `drizzle-orm/d1` module to return a mock db that resolves teacher/student role.

## Test File Organization

```
apps/api/src/
├── __tests__/
│   ├── auth-middleware.test.ts          # ~12 tests
│   ├── scope-guard-middleware.test.ts   # ~6 tests
│   ├── clerk-api-key-service.test.ts    # ~10 tests
│   └── api-key-routes.test.ts          # ~12 tests
├── services/__tests__/
│   └── ai-question-parser.test.ts       # existing (unchanged)
```

**Why `src/__tests__/`?** Separates integration-style route/middleware tests from unit-level service tests. Existing pattern uses `services/__tests__/` for pure function tests.

## Test Matrix

### File 1: `auth-middleware.test.ts` (~12 tests)

Tests the dual auth middleware in isolation using a minimal Hono app.

| # | Test Case | Mock Setup | Expected |
|---|-----------|-----------|----------|
| 1 | Missing Authorization header | None | 401, "Missing or malformed" |
| 2 | Authorization header without "Bearer " prefix | None | 401 |
| 3 | Valid JWT token | `verifyToken` returns `{sub: "user_123"}` | 200, userId set |
| 4 | Valid JWT sets authType="session" | `verifyToken` returns `{sub: "user_123"}` | `authType` = "session", `scopes` = [] |
| 5 | Invalid JWT, valid API key | `verifyToken` throws, `verifyApiKey` returns key | 200, userId = key.subject |
| 6 | Valid API key sets authType="api_key" | `verifyToken` throws, `verifyApiKey` returns key with scopes | `authType` = "api_key", `scopes` = ["ai:questions:write"] |
| 7 | Invalid JWT, invalid API key | Both throw | 401, "Invalid token or API key" |
| 8 | API key with no subject | `verifyApiKey` returns `{subject: ""}` | 401, "no associated user" |
| 9 | API key with null subject | `verifyApiKey` returns `{subject: null}` | 401 |
| 10 | JWT takes priority over API key | `verifyToken` succeeds | `verifyApiKey` never called |
| 11 | JWT payload without sub | `verifyToken` returns `{}` | Falls through to API key path |
| 12 | Empty bearer token | `verifyToken` throws | Falls through to API key path |

**Mock setup pattern:**
```typescript
import { vi, describe, it, expect, beforeEach } from "vitest"
import { Hono } from "hono"
import { authMiddleware } from "../middleware/auth-middleware.js"

// Mock @clerk/backend
vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(),
}))

// Mock the service
vi.mock("../services/clerk-api-key-service.js", () => ({
  verifyApiKey: vi.fn(),
}))

import { verifyToken } from "@clerk/backend"
import { verifyApiKey } from "../services/clerk-api-key-service.js"

// Create test app
function createTestApp() {
  const app = new Hono()
  app.use("/*", authMiddleware)
  app.get("/test", (c) => c.json({
    userId: c.get("userId"),
    authType: c.get("authType"),
    scopes: c.get("scopes"),
  }))
  return app
}
```

### File 2: `scope-guard-middleware.test.ts` (~6 tests)

Tests the scope guard middleware in isolation. No mocks needed — just set context vars manually.

| # | Test Case | Context Setup | Expected |
|---|-----------|--------------|----------|
| 1 | Session authType bypasses scope check | `authType="session"` | 200 (next called) |
| 2 | API key with matching scope passes | `authType="api_key"`, `scopes=["ai:questions:write"]` | 200 |
| 3 | API key with wrong scope returns 403 | `authType="api_key"`, `scopes=["other:scope"]` | 403, "Insufficient scope" |
| 4 | API key with empty scopes returns 403 | `authType="api_key"`, `scopes=[]` | 403 |
| 5 | API key with multiple scopes including required | `authType="api_key"`, `scopes=["foo", "ai:questions:write"]` | 200 |
| 6 | 403 response includes required scope name | `authType="api_key"`, `scopes=[]` | body.required = "ai:questions:write" |

**Mock setup pattern:**
```typescript
function createScopedApp(requiredScope: string) {
  const app = new Hono()
  // Pre-set context vars (simulating authMiddleware already ran)
  app.use("/*", async (c, next) => {
    c.set("authType", testAuthType)
    c.set("scopes", testScopes)
    c.set("userId", "user_123")
    await next()
  })
  app.use("/*", scopeGuard(requiredScope))
  app.post("/test", (c) => c.json({ ok: true }))
  return app
}
```

### File 3: `clerk-api-key-service.test.ts` (~10 tests)

Tests the SDK-based service functions. After Phase 1, this service wraps `createClerkClient().apiKeys.*`.

| # | Test Case | Mock Setup | Expected |
|---|-----------|-----------|----------|
| 1 | verifyApiKey success | `apiKeys.verify` returns valid key | Returns key object |
| 2 | verifyApiKey with revoked key | `apiKeys.verify` throws | Throws error |
| 3 | verifyApiKey with expired key | `apiKeys.verify` throws | Throws error |
| 4 | createApiKey success | `apiKeys.create` returns key with secret | Returns key + secret |
| 5 | createApiKey sets default scope | `apiKeys.create` called | Verify params include `["ai:questions:write"]` |
| 6 | createApiKey with custom expiration | `apiKeys.create` called | Verify `secondsUntilExpiration` passed |
| 7 | listApiKeys returns user's keys | `apiKeys.list` returns `{data: [...]}` | Returns array of keys |
| 8 | listApiKeys for user with no keys | `apiKeys.list` returns `{data: []}` | Returns empty array |
| 9 | revokeApiKey success | `apiKeys.revoke` returns key | Returns revoked key |
| 10 | revokeApiKey on nonexistent key | `apiKeys.revoke` throws | Throws error |

**Mock strategy:** Mock `createClerkClient` from `@clerk/backend` to return an object with mock `apiKeys` methods:

```typescript
vi.mock("@clerk/backend", () => ({
  createClerkClient: vi.fn(() => ({
    apiKeys: {
      verify: vi.fn(),
      create: vi.fn(),
      list: vi.fn(),
      revoke: vi.fn(),
    },
  })),
  verifyToken: vi.fn(),
}))
```

### File 4: `api-key-routes.test.ts` (~12 tests)

Tests API key CRUD routes. Requires mocking auth middleware, drizzle (for role guard), and service functions.

| # | Test Case | Setup | Expected |
|---|-----------|-------|----------|
| 1 | POST / — teacher creates key | Mock role=teacher, service returns key | 201 + secret in body |
| 2 | POST / — student rejected | Mock role=student | 403, "Teacher role required" |
| 3 | POST / — no user in DB | Mock empty DB result | 403 |
| 4 | POST / — invalid JSON body | Send malformed body | 400, "Invalid JSON" |
| 5 | POST / — Zod validation fails (missing name) | Send `{}` | 400, "Invalid request" |
| 6 | POST / — service throws | Mock service error | 500 |
| 7 | GET / — teacher lists own keys | Mock role=teacher, service returns 2 keys | 200, array of 2 |
| 8 | GET / — teacher with no keys | Mock role=teacher, service returns [] | 200, empty array |
| 9 | DELETE /:id — teacher revokes own key | Mock ownership check passes | 200, `{revoked: true}` |
| 10 | DELETE /:id — teacher revokes key they don't own | Mock listApiKeys returns no match | 404 |
| 11 | DELETE /:id — service throws on revoke | Mock revokeApiKey throws | 500 |
| 12 | GET / — filters out sensitive fields | Mock service returns full key objects | Response lacks `subject`, `description` etc. |

**Mock strategy for drizzle + auth:**

```typescript
// Mock auth middleware — set userId directly
vi.mock("../middleware/auth-middleware.js", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("userId", "user_teacher_1")
    c.set("authType", "session")
    c.set("scopes", [])
    await next()
  }),
}))

// Mock drizzle for role guard
vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}))
```

For the drizzle mock, the role guard does:
```typescript
const [user] = await db.select({role: users.role}).from(users).where(...).limit(1)
```

Create a chainable mock:
```typescript
const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve([{ role: "teacher" }])),
      })),
    })),
  })),
}
```

Alternatively, create a simpler test app that mounts `apiKeyRoutes` with a pre-set role middleware instead of mocking drizzle. This avoids brittle chain mocks:

```typescript
function createTestApp(role: string) {
  const app = new Hono()
  // Simulate auth
  app.use("/*", async (c, next) => {
    c.set("userId", "user_123")
    await next()
  })
  app.route("/api-keys", apiKeyRoutes)
  return app
}
```

But this means the role guard inside `apiKeyRoutes` still calls drizzle. **Decision: mock drizzle** since the role guard is inlined in the routes file and cannot be bypassed without mocking.

## Implementation Steps

### Step 1: Create Vitest Config (if needed)

Check if Vitest works without config. The existing test runs via `vitest run`. If it works, no config needed. If path aliases (`@teaching/shared`) fail in tests, create:

**File:** `apps/api/vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
  },
  resolve: {
    alias: {
      "@teaching/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
})
```

### Step 2: Write Auth Middleware Tests

**File:** `apps/api/src/__tests__/auth-middleware.test.ts`

- Import mocked `verifyToken` and `verifyApiKey`
- Create minimal Hono app with `authMiddleware` + echo handler
- 12 test cases per matrix above
- Use `beforeEach(() => vi.restoreAllMocks())` for isolation
- Use `app.request("/test", { headers: { Authorization: "Bearer xxx" } })` pattern

### Step 3: Write Scope Guard Tests

**File:** `apps/api/src/__tests__/scope-guard-middleware.test.ts`

- No external mocks needed — just set context variables via setup middleware
- 6 test cases per matrix above
- Create test app per-test with different context values

### Step 4: Write Clerk API Key Service Tests

**File:** `apps/api/src/__tests__/clerk-api-key-service.test.ts`

- Mock `createClerkClient` from `@clerk/backend`
- 10 test cases per matrix above
- Verify correct params passed to SDK methods (spy assertions)

### Step 5: Write API Key Routes Tests

**File:** `apps/api/src/__tests__/api-key-routes.test.ts`

- Mock `drizzle-orm/d1` for role guard DB query
- Mock `../services/clerk-api-key-service.js` for CRUD operations
- Mock auth middleware to set userId
- 12 test cases per matrix above
- Test Zod validation edge cases

### Step 6: Run All Tests

```bash
pnpm --filter @teaching/api test
```

Verify:
- All ~40 tests pass
- Existing `ai-question-parser.test.ts` still passes
- No test interference (mock isolation clean)

## Todo List

- [ ] Verify Vitest runs without config; create `vitest.config.ts` if needed
- [ ] Create `apps/api/src/__tests__/` directory
- [ ] Write `auth-middleware.test.ts` (12 tests)
- [ ] Write `scope-guard-middleware.test.ts` (6 tests)
- [ ] Write `clerk-api-key-service.test.ts` (10 tests)
- [ ] Write `api-key-routes.test.ts` (12 tests)
- [ ] Run full test suite: `pnpm --filter @teaching/api test`
- [ ] Verify existing tests still pass
- [ ] Verify no console warnings about unhandled mocks

## Success Criteria

- ~40 test cases pass
- Existing `ai-question-parser.test.ts` (18 tests) unaffected
- Test execution < 10 seconds
- No flaky tests (all deterministic via mocks)
- `pnpm --filter @teaching/api test` exits 0

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Drizzle chain mock too brittle | Medium | Medium | If chain breaks, switch to test app with inline role middleware |
| `vi.mock()` hoisting issues with ESM | Medium | Low | Use `vi.mock()` at top of file; dynamic imports if needed |
| Hono `app.request()` not setting env bindings | Medium | Medium | Pass env in request init: `app.request(url, init, env)` |
| Path alias resolution in tests | Low | Low | Add `vitest.config.ts` with alias if needed |

## Security Considerations

- Tests use fake tokens only — no real Clerk keys
- Mock data uses obviously fake IDs (`user_123`, `key_abc`)
- No `.env` files read during tests
- Test files never committed to production builds (excluded by tsconfig)

## Unresolved Questions

1. Should `api-key-routes.test.ts` use a standalone app or import from `index.ts`? Standalone avoids loading all routes; importing from `index.ts` tests real middleware ordering. **Recommendation:** Standalone for unit tests; save `index.ts` integration tests for later.
2. Does Vitest need `--pool=forks` for mock isolation? Default pool should work; switch if mock leakage observed.
