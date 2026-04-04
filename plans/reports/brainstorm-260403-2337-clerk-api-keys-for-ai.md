# Brainstorm: Clerk API Keys for Third-Party AI Access

**Date:** 2026-04-03
**Decision:** Approach A — Clerk API Keys
**Status:** Approved

## Problem
Third-party AI tools need to call `POST /api/questions/ai` but can't handle Clerk's browser-based JWT refresh. Need Clerk-native stable credential for M2M communication.

## Decision Context
- Caller: Third-party AI tools (ChatGPT, Zapier, custom scripts)
- Constraint: Must stay within Clerk ecosystem
- Volume: Low (<100 requests/day)
- Current auth: `@clerk/backend` verifyToken() in Hono middleware on Cloudflare Workers

## Evaluated Approaches

| Approach | Verdict | Reason |
|----------|---------|--------|
| **Clerk API Keys** | ✅ Chosen | Purpose-built for user-delegated third-party access |
| Clerk M2M Tokens | ❌ Rejected | Designed for own services, not arbitrary third parties |
| JWT Templates (long TTL) | ❌ Rejected | Not revokable, security risk |

## Chosen Solution: Clerk API Keys

### Flow
1. Teacher creates API key in ClassPulse (scoped to `questions:write`)
2. Teacher copies key to their AI tool
3. AI tool sends `Authorization: Bearer {api-key}` per request
4. Auth middleware detects API key vs JWT, verifies via Clerk SDK
5. Request proceeds with teacher's userId context

### Key Benefits
- Long-lived, no refresh needed
- Instantly revokable by user
- Tied to user identity (audit trail)
- Fine-grained scopes
- Clerk-native (`@clerk/backend` SDK)

### Implementation Impact
- Modify `auth-middleware.ts` to support dual verification (JWT + API key)
- Add API key management UI (create, list, revoke)
- Add API key CRUD routes
- Scope enforcement on API key verification

### Risks
- Clerk API Keys still in beta — API surface may change
- Per-verification cost (~$0.00001, negligible at volume)

## Unresolved Questions
1. Clerk API Keys beta timeline to GA?
2. Exact SDK method signatures for key verification — need to check latest `@clerk/backend` docs
3. Does Clerk API Key verification work on Cloudflare Workers (edge runtime)?
