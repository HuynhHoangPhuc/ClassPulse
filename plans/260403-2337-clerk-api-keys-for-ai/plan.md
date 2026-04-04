---
title: "Clerk API Keys for Third-Party AI Access"
description: "Add Clerk API Key auth to allow third-party AI tools to call POST /api/questions/ai without browser-based JWT refresh"
status: complete
priority: P2
effort: 8h
tags: [feature, auth, api, clerk]
blockedBy: []
blocks: []
created: 2026-04-03
---

# Clerk API Keys for Third-Party AI Access

## Overview

Third-party AI tools (ChatGPT, Zapier, custom scripts) need to call `POST /api/questions/ai` but can't handle Clerk's browser-based JWT refresh. This plan adds Clerk API Key verification as a parallel auth path alongside existing JWT auth.

## Context

- Brainstorm: [brainstorm-260403-2337-clerk-api-keys-for-ai.md](../reports/brainstorm-260403-2337-clerk-api-keys-for-ai.md)
- Research: [researcher-260403-2346-clerk-api-keys-research.md](../reports/researcher-260403-2346-clerk-api-keys-research.md)
- Existing auth: `apps/api/src/middleware/auth-middleware.ts` — `verifyToken()` from `@clerk/backend`
- AI endpoint: `apps/api/src/routes/ai-question-routes.ts` — `POST /api/questions/ai`
- Settings UI: `apps/web/src/features/settings/settings-page.tsx`

## Architecture

```
Third-Party AI Tool
  │
  │ Authorization: Bearer {api-key-secret}
  ▼
auth-middleware.ts (enhanced)
  │
  ├─ Try JWT verification (verifyToken) → existing flow
  │   └─ If fails (not a JWT)...
  │
  ├─ Try API Key verification (clerkClient.apiKeys.verify)
  │   └─ Returns { subject: "user_xxx", scopes: [...] }
  │
  └─ Set userId on context → route handler proceeds as normal
```

## Dependencies

- `@clerk/backend` ^1.20.0 (already installed — verify `clerkClient` + `apiKeys.verify()` available)
- Clerk Dashboard: Enable API Keys feature (beta)
- No new packages needed
- **Note:** @clerk/backend v1.34 SDK lacks apiKeys methods — used REST API fallback (fetch to https://api.clerk.com/v1/api_keys/*)

## Phases

| Phase | Name | Status | Effort | Files |
|-------|------|--------|--------|-------|
| 1 | [SDK Spike & Dual Auth Middleware](./phase-01-dual-auth-middleware.md) | Complete | 3h | 1 modified |
| 2 | [API Key Management Routes](./phase-02-api-key-routes.md) | Complete | 2h | 1 new, 1 modified |
| 3 | [API Key Management UI](./phase-03-api-key-ui.md) | Complete | 2h | 2 new, 1 modified |
| 4 | [Testing & Documentation](./phase-04-testing.md) | Partial | 1h | 1 new |

## Dependency Graph

```
Phase 1 (middleware) → Phase 2 (routes) → Phase 3 (UI) → Phase 4 (testing)
```

All sequential. Phase 1 must confirm SDK compatibility before proceeding.

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| `clerkClient.apiKeys.verify()` unavailable on @clerk/backend v1.x | HIGH | Phase 1 spike verifies first. Fallback: upgrade SDK or use REST API directly |
| Clerk API Keys beta breaks | LOW | Feature is in public beta since Dec 2025. Low volume (<100/day) |
| API key leaked by third-party | MEDIUM | Keys are instantly revokable. Add lastUsedAt tracking for audit |
