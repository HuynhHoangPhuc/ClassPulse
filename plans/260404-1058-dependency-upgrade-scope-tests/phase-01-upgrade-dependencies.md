# Phase 1 — Upgrade All Dependencies to Latest

## Context Links
- [Clerk SDK Research](../reports/researcher-260404-1058-clerk-sdk-apikeys-support.md)
- [Current API package.json](../../apps/api/package.json)
- [Current Web package.json](../../apps/web/package.json)
- [Root package.json](../../package.json)
- [Clerk API Key Service](../../apps/api/src/services/clerk-api-key-service.ts)
- [Auth Middleware](../../apps/api/src/middleware/auth-middleware.ts)

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 3h
- **Depends on:** Nothing

Upgrade all dependencies across the monorepo to latest versions. Critical upgrade: `@clerk/backend` v1.20 -> v3.x which unlocks native `apiKeys.*` SDK methods and removes the need for the REST wrapper service.

## Key Insights

1. **`@clerk/backend` v3.x** requires Node 20+ (already met — `engines.node >= 20` in root `package.json`)
2. **Breaking changes v1 -> v3:** `verifySecret()` removed (use `verify()`), `samlAccount` removed (use `enterpriseAccount`). Neither used in this codebase.
3. **`@clerk/clerk-react` v5** is Core 3 compatible — no separate upgrade needed
4. **`nodejs_compat` flag** already set in `wrangler.toml` — CF Workers edge compatibility confirmed
5. **No `clerkClient` instantiation** exists in codebase — will need to add it in Phase 2 when replacing REST wrapper

## Data Flow (Before/After)

```
BEFORE (v1.x):
  Token -> verifyToken(token, {secretKey}) -> JWT payload
  API Key -> fetch("clerk.com/v1/api_keys/verify") -> key metadata

AFTER (v3.x):
  Token -> verifyToken(token, {secretKey}) -> JWT payload (unchanged)
  API Key -> clerkClient.apiKeys.verify(secret) -> key metadata (SDK-native)
```

## Related Code Files

### Files to Modify
- `package.json` (root) — turbo, typescript
- `apps/api/package.json` — `@clerk/backend`, hono, drizzle-orm, zod, wrangler, vitest, etc.
- `apps/web/package.json` — `@clerk/clerk-react`, react, tanstack, vite, tailwind, etc.
- `packages/shared/package.json` — zod, typescript
- `pnpm-lock.yaml` — auto-updated
- `apps/api/src/services/clerk-api-key-service.ts` — replace REST calls with SDK methods
- `apps/api/src/middleware/auth-middleware.ts` — update `verifyApiKey` import path (if service interface changes)

### Files NOT to Modify (yet)
- `apps/api/src/routes/api-key-routes.ts` — imports from service stay the same (re-export unchanged interface)
- `apps/api/src/index.ts` — no changes needed

## Implementation Steps

### Step 1: General Dependency Upgrade (all workspaces)

```bash
# From monorepo root
pnpm update --latest -r
```

This upgrades ALL deps across all workspaces to latest. Then immediately verify:

```bash
pnpm typecheck
```

If typecheck fails, identify which packages caused breakage. Common candidates:
- TanStack Router/Query (major bumps may rename exports)
- Vite/Tailwind (config format changes)
- drizzle-orm/drizzle-kit (API changes)

**Rollback strategy per package:** If a specific package causes breakage, pin it back:
```bash
pnpm --filter @teaching/web add @tanstack/react-router@1.95.0
```

### Step 2: Verify Clerk Upgrade Specifically

```bash
# Check installed version
pnpm --filter @teaching/api list @clerk/backend

# Run Clerk's upgrade CLI to detect breaking changes
npx @clerk/upgrade
```

Review output. Known breaking changes for this codebase:
- `verifyToken()` — **still exists in v3**, signature unchanged. No action needed.
- `apiKeys.verifySecret()` — renamed to `apiKeys.verify()`. Only affects new code (Phase 2).
- No usage of `samlAccount` or `m2m.verifyToken()` in codebase.

### Step 3: Replace REST Wrapper with SDK Methods

Refactor `apps/api/src/services/clerk-api-key-service.ts` to use `@clerk/backend` SDK:

**Current:** Manual `fetch()` calls to `https://api.clerk.com/v1/api_keys/*`
**Target:** `createClerkClient({secretKey}).apiKeys.*` methods

The file should:
1. Export a factory function that takes `secretKey` and returns an object with `verify`, `create`, `list`, `revoke` methods
2. Use `createClerkClient` from `@clerk/backend` internally
3. Keep the same return types (`ClerkApiKey`, `ClerkApiKeyWithSecret`) — or use SDK types directly
4. Keep the same export names so `api-key-routes.ts` imports don't break

**New `clerk-api-key-service.ts` structure:**

```typescript
import { createClerkClient } from "@clerk/backend"

// Re-export types from SDK or define thin wrappers
export interface ClerkApiKey {
  id: string
  name: string
  subject: string
  scopes: string[]
  revoked: boolean
  createdAt: number
  expiration: number | null
}

export interface ClerkApiKeyWithSecret extends ClerkApiKey {
  secret: string
}

function getClient(secretKey: string) {
  return createClerkClient({ secretKey })
}

export async function verifyApiKey(secret: string, secretKey: string): Promise<ClerkApiKey> {
  const client = getClient(secretKey)
  return client.apiKeys.verify(secret)
}

export async function createApiKey(secretKey: string, params: {...}): Promise<ClerkApiKeyWithSecret> {
  const client = getClient(secretKey)
  return client.apiKeys.create({...params})
}

export async function listApiKeys(secretKey: string, subject: string): Promise<ClerkApiKey[]> {
  const client = getClient(secretKey)
  const result = await client.apiKeys.list({ subject })
  return result.data
}

export async function revokeApiKey(secretKey: string, apiKeyId: string): Promise<ClerkApiKey> {
  const client = getClient(secretKey)
  return client.apiKeys.revoke(apiKeyId, "Revoked by user")
}
```

**Key decision:** Keep function signatures identical to current exports. `api-key-routes.ts` and `auth-middleware.ts` import these functions and should not need changes in this phase.

### Step 4: Typecheck + Smoke Test

```bash
pnpm typecheck
pnpm --filter @teaching/api test
pnpm --filter @teaching/api dev  # manual smoke test: hit /health endpoint
```

### Step 5: Verify Web App Still Works

```bash
pnpm --filter @teaching/web build
pnpm --filter @teaching/web dev  # manual: verify login + dashboard loads
```

## Todo List

- [ ] Run `pnpm update --latest -r` from monorepo root
- [ ] Run `pnpm typecheck` — fix any breakage from general upgrades
- [ ] Run `npx @clerk/upgrade` to detect Clerk-specific breaking changes
- [ ] Refactor `clerk-api-key-service.ts` to use `createClerkClient().apiKeys.*`
- [ ] Verify `auth-middleware.ts` still works with updated service (import unchanged)
- [ ] Verify `api-key-routes.ts` still works with updated service (import unchanged)
- [ ] Run `pnpm typecheck` again after service refactor
- [ ] Run `pnpm --filter @teaching/api test` (existing AI parser tests)
- [ ] Build and smoke test web app

## Success Criteria

- `@clerk/backend` version is `^3.x` in `apps/api/package.json`
- `clerk-api-key-service.ts` uses SDK methods, no manual `fetch()` calls
- `pnpm typecheck` passes across all workspaces
- Existing test suite passes (`ai-question-parser.test.ts`)
- No runtime errors on `pnpm dev`

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TanStack major bump breaks router | Medium | Medium | Pin back to current version if typecheck fails |
| Clerk SDK types differ from manual types | Low | Low | Adapt type interfaces; SDK types are superset |
| `createClerkClient` not available in CF Workers | Very Low | High | Already confirmed in research; `nodejs_compat` flag set |
| Lockfile conflicts on merge | Low | Low | Regenerate with `pnpm install` |

## Security Considerations

- `CLERK_SECRET_KEY` usage unchanged — passed to `createClerkClient()` same as before
- No new secrets introduced
- API key verification still server-side only
