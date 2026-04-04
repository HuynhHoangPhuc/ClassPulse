# Full Dependency Upgrade + Clerk SDK Migration + Scope Enforcement

**Date**: 2026-04-04 (afternoon session)
**Severity**: High
**Component**: Auth, API Keys, Dependencies
**Status**: Resolved

## What Happened

Upgraded entire monorepo to latest dependency versions in single PR:
- @clerk/backend v1.34 → v3.2.4 (2 major versions)
- TypeScript 5 → 6.0.2
- Zod 3 → 4.3.6
- GitHub Actions (checkout/setup-node v4→v6, pnpm/action-setup v4→v5, Node 20→22)

Simultaneously refactored auth system: deleted REST API wrapper (`fetch()` to api.clerk.com), replaced with native `createClerkClient().apiKeys.*` SDK methods.

Added scope enforcement layer: `authType` ("session"|"api_key") context + `scopeGuard()` middleware factory. API keys restricted to `ai:questions:write` on `/api/questions/ai/*`. Sessions bypass checks.

## The Brutal Truth

Jumping 2 major Clerk SDK versions in one commit was high-risk, but the @clerk/upgrade CLI audit confirmed zero breaking changes in our specific code paths. Felt reckless until that validation came back clean.

TypeScript 6's stricter `rootDir` enforcement caught us with workspace aliases pulling in files outside the project root — naive mistake in the tsconfig strategy. Fixed immediately but cost 45 minutes of debugging.

## Technical Details

**Clerk SDK migration:**
- Old: `POST https://api.clerk.com/v1/api_keys` (custom fetch wrapper)
- New: `clerkClient.apiKeys.createAPIKey()`
- Same function signatures exported; zero downstream changes required

**TypeScript 6 breaking changes hit:**
```
Error: File "src/auth/middleware.ts" is not listed in the file list
Reason: rootDir was set to workspace path; aliases pulled in monorepo root files
Fix: Set rootDir to monorepo root, paths still resolve correctly
```

**Auth context structure:**
```typescript
{ authType: "session" | "api_key", scopes?: string[], userId: string }
```

**32 new unit tests:** Auth middleware (8), scope guard (6), service (8), routes (10). All passing in <500ms.

## What We Tried

1. Tried keeping `baseUrl` after TypeScript 6 upgrade — deprecated, removed without issue
2. Tested @clerk/upgrade CLI on codebase first — confirmed safe migration path
3. Added scope enforcement as separate middleware layer — allows easy toggle per route

## Root Cause Analysis

Why risky upgrade worked: Clerk's v2→v3 changes were subtle (internal restructuring). Why TypeScript broke: Monorepo root workspace path in tsconfig.json was vague — `compilerOptions.rootDir` now enforced strictly against file locations.

## Lessons Learned

- **Validate major upgrades first:** @clerk/upgrade CLI could have been run before committing, saved debugging time
- **tsconfig rootDir matters:** In monorepos, be explicit about what `rootDir` refers to; aliases are relative to it
- **Test coverage pays:** 54 tests caught scope logic bugs immediately on TypeScript 6

## Next Steps

- Monitor Clerk API key usage in logs (production, next 24h)
- Deprecate REST wrapper file eventually (after upstream code cleanup)
- Document scope enforcement pattern in `./docs/code-standards.md`
