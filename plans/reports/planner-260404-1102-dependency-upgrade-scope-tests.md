---
title: Plan Report — Dependency Upgrade + Scope Enforcement + Unit Tests
date: 2026-04-04
status: DONE
---

## Summary

Created 3-phase implementation plan for upgrading all monorepo dependencies, adding API key scope enforcement, and writing ~40 unit tests.

## Plan Location

`/Users/phuc/work/ClassPulse/plans/260404-1058-dependency-upgrade-scope-tests/`

## Phases

| # | Phase | Effort | Key Files | Risk |
|---|-------|--------|-----------|------|
| 1 | Upgrade Dependencies | 3h | `package.json` files, `clerk-api-key-service.ts` | Medium — Clerk v1->v3 jump |
| 2 | Scope Enforcement | 2h | `auth-middleware.ts`, new `scope-guard-middleware.ts`, `index.ts` | Low |
| 3 | Unit Tests | 3h | 4 new test files in `src/__tests__/` | Low |

**Total effort:** 8h

## Key Decisions

1. **Clerk SDK migration:** Replace entire REST wrapper (`clerkFetch` + manual endpoints) with `createClerkClient().apiKeys.*` SDK methods. Same export signatures preserved — zero impact on `api-key-routes.ts`.
2. **Scope enforcement via middleware factory:** New `scopeGuard(requiredScope)` returns middleware. Applied only to `/api/questions/ai/*`. JWT sessions bypass entirely. Simple string `includes()` check — no hierarchy engine (YAGNI).
3. **Context variables:** Added `authType: "session" | "api_key"` and `scopes: string[]` to Hono context. Purely additive — existing routes reading only `userId` are unaffected.
4. **403 for insufficient scope** (not 401). 401 reserved for invalid/missing tokens.
5. **Test approach:** Pure Vitest mocks, no CF Workers pool, no real D1. Uses `app.request()` for route tests. Drizzle chain mock for role guard.

## File Ownership (no overlap between phases)

- **Phase 1:** `package.json` files, `clerk-api-key-service.ts`, lockfile
- **Phase 2:** `auth-middleware.ts`, `scope-guard-middleware.ts` (new), `index.ts`
- **Phase 3:** 4 new test files (read-only on Phase 1/2 files)

## Risks Addressed

- Clerk v3 breaking changes: only `verifySecret->verify` rename, not used in current codebase. `verifyToken` unchanged.
- `nodejs_compat` already in `wrangler.toml`. Node 20 already in `engines`.
- Each phase independently revertable (git revert single commit per phase).

**Status:** DONE
**Summary:** 3-phase plan created with full test matrix (40 cases), data flow diagrams, and implementation steps.
