---
title: "Dependency Upgrade + API Key Scope Enforcement + Unit Tests"
description: "Upgrade all deps (Clerk v1->v3), add scope enforcement to auth middleware, write ~40 unit tests"
status: pending
priority: P1
effort: 8h
branch: main
tags: [clerk, auth, api-keys, testing, upgrade]
created: 2026-04-04
---

# Dependency Upgrade + Scope Enforcement + Unit Tests

## Objective

Three sequential tasks: (1) upgrade all monorepo deps to latest (critical: `@clerk/backend` v1 -> v3), (2) add scope enforcement to auth middleware for API key tokens, (3) write ~40 mock-based unit tests for the API key feature.

## Phase Table

| # | Phase | Status | Effort | Files Modified | Depends On |
|---|-------|--------|--------|----------------|------------|
| 1 | [Upgrade Dependencies](./phase-01-upgrade-dependencies.md) | Pending | 3h | `package.json` files, `clerk-api-key-service.ts`, `auth-middleware.ts` | -- |
| 2 | [Scope Enforcement](./phase-02-scope-enforcement.md) | Pending | 2h | `auth-middleware.ts`, `index.ts`, `env.ts` | Phase 1 |
| 3 | [Unit Tests](./phase-03-unit-tests.md) | Pending | 3h | new test files in `apps/api/src/__tests__/` | Phase 2 |

## Key Architecture Decisions

1. **Clerk SDK migration:** Replace REST wrapper (`clerk-api-key-service.ts`) with `@clerk/backend` v3 SDK `clerkClient.apiKeys.*` methods
2. **Scope enforcement:** Add `authType` context variable; scope check runs only for API key tokens, JWT sessions bypass (use existing role system)
3. **403 vs 401:** Valid token + insufficient scope = 403 Forbidden (not 401)
4. **Test approach:** Pure Vitest mocks (no Cloudflare pool), `vi.mock()` for `@clerk/backend`, `vi.stubGlobal('fetch')` for REST calls, `testClient()` for route tests

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Clerk v3 breaking changes beyond documented | Low | High | Use `@clerk/upgrade` CLI; typecheck after each step |
| `@clerk/clerk-react` v5 incompatible with `@clerk/backend` v3 | Low | High | Check Clerk compatibility matrix; both are Core 3 |
| TanStack Router/Query major version breaks | Medium | Medium | `pnpm update --latest` then `pnpm typecheck`; revert individual packages if needed |
| Vitest mock isolation issues with Hono middleware | Low | Medium | Use `beforeEach(vi.restoreAllMocks)` |

## Rollback Strategy

- **Phase 1:** `git stash` or revert commit; `pnpm install` restores old lockfile
- **Phase 2:** Revert single file (`auth-middleware.ts`); no schema changes
- **Phase 3:** Tests are additive; delete test files to revert

## Success Criteria

- [ ] `pnpm typecheck` passes across all workspaces
- [ ] `@clerk/backend` is v3.x in `apps/api/package.json`
- [ ] API key tokens with wrong scope get 403 on protected routes
- [ ] JWT sessions skip scope checks entirely
- [ ] ~40 test cases pass via `pnpm --filter @teaching/api test`
- [ ] No runtime regressions on `pnpm --filter @teaching/api dev`
