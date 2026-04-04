---
name: API Key Testing Patterns for Hono + Vitest on Cloudflare Workers
description: Testing approaches for dual-auth middleware, Clerk API key service, and D1-backed routes
type: reference
---

# API Key Testing Patterns — Hono + Vitest + Cloudflare Workers

## Quick Answers

### 1. Mock `fetch()` to Clerk REST API
**Use Vitest's global fetch mock:**
```ts
import { vi } from 'vitest'
vi.stubGlobal('fetch', vi.fn((url: string) => {
  if (url.includes('/api_keys/verify')) {
    return Promise.resolve(new Response(JSON.stringify({
      id: 'key_123',
      subject: 'user_456',
      scopes: ['ai:questions:write'],
      revoked: false
    })))
  }
  return Promise.reject(new Error('Not mocked'))
}))
```
**Alternative:** Use MSW (Mock Service Worker) — preferred by `@clerk/backend` team; intercepts fetch at event level.

### 2. Mock `verifyToken` from `@clerk/backend`
**Use module mocking:**
```ts
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => {
    if (token === 'valid-jwt') {
      return { sub: 'user_123' }
    }
    throw new Error('Invalid token')
  })
}))
```
Import the mocked function and use `vi.mocked()` to access spy methods in tests.

### 3. Test Hono Routes & Middleware
**Use `testClient()` from `hono/testing`:**
```ts
import { testClient } from 'hono/testing'

const client = testClient(app)
const res = await client.search.$get(
  { query: { q: 'test' } },
  { headers: { Authorization: 'Bearer token' } }
)
```
**CRITICAL:** Routes must be defined via chained methods on Hono instance for type inference to work.

**For context variables:** testClient passes through middleware normally. Context vars set via `c.set('userId', ...)` are available to downstream handlers in the same request.

### 4. Test Middleware Context Variables
Middleware runs before handlers in testClient. Test by:
- Mock external calls (verifyToken, fetch)
- Call route via testClient
- Assert response code (200 = middleware passed, 401 = auth failed)
- Assert response body contains expected userId if route reads context

### 5. Test D1 Database Calls (role guard in api-key-routes)
**Two approaches:**

**A) Use real D1 in tests (integration test):**
```ts
// In vitest.config.ts
import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
export default defineConfig({
  test: {
    pool: 'cloudflare',
    poolOptions: { cloudflare: { miniflare: { d1Databases: ['DB'] } } }
  }
})
```
Use `applyD1Migrations(env.DB)` before test to seed schema.

**B) Mock drizzle query (unit test):**
```ts
vi.mock('drizzle-orm', () => ({ /* return mock db */ }))
```
Less common; full D1 mock requires substantial setup.

**Recommended:** Option A (real D1 in test). Cloudflare's vitest pool handles D1 in-process without external DB.

### 6. Clerk API Key Testing Patterns
**No official utilities from Clerk.** Use these patterns:

- **Unit test verifyApiKey():** Mock fetch, test error handling (invalid/revoked/expired keys)
- **Integration test createApiKey():** Mock Clerk REST endpoint, verify request body format, assert secret returned once
- **Route test POST /:** Mock verifyApiKey, assert role guard fires before creation, assert 201 + secret in response
- **Ownership check (DELETE):** Mock listApiKeys to return keys for user; test ownership validation before revoke

**Middleware testing:** Test JWT path (mock verifyToken success → userId set) separately from API key path (mock verifyApiKey success → userId set). Use separate test cases.

---

## Recommended Test Stack

| Component | Tool | Notes |
|-----------|------|-------|
| Route handlers | `testClient()` from hono/testing | Type-safe, no HTTP server needed |
| fetch mocking | `vi.stubGlobal()` or MSW | Global stub simpler; MSW for complex intercepting |
| verifyToken mocking | `vi.mock('@clerk/backend')` | Module-level mock |
| D1 database | `@cloudflare/vitest-pool-workers` | Native support; no external DB |
| Test runner | Vitest 4.1+ | Already in stack |

---

## Adoption Risk

- **testClient:** Stable Hono feature (v3+); widely used
- **Vitest mocking:** Jest-compatible API; mature
- **Cloudflare vitest pool:** Well-supported; requires `wrangler types` + config update (minor lift)
- **D1 in tests:** Works well for integration tests; slower than unit tests (~100ms per test vs ~5ms)

---

## Unresolved Questions

1. Does your monorepo have a shared test setup file? (e.g., `vitest.config.ts` already configured)
2. Should API key service unit tests use real Clerk sandbox or mocked REST entirely?
3. Do you want route tests to hit real D1 (slower, more realistic) or mock it (fast, brittle)?

---

## Sources

- [Hono Testing Helper Docs](https://hono.dev/docs/helpers/testing)
- [Hono Testing Guide](https://hono.dev/docs/guides/testing)
- [Cloudflare Workers Vitest Integration](https://developers.cloudflare.com/workers/testing/vitest-integration/)
- [Cloudflare D1 Testing](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/)
- [Testing with Clerk](https://clerk.com/docs/guides/development/testing/overview)
- [@clerk/backend Testing](https://clerk.com/blog/testing-clerk-nextjs)
- [Vitest Mocking Guide](https://vitest.dev/guide/mocking)
- [Drizzle ORM D1 Testing](https://github.com/yusukebe/testing-d1-app-with-types)
