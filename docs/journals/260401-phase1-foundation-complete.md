# Phase 1 Complete: Foundation & Project Setup

**Date**: 2026-04-01 14:30
**Severity**: Low (setup phase — no blocking issues)
**Component**: Teaching Platform (Turborepo monorepo)
**Status**: Resolved

## What Happened

Scaffolded entire foundation for multi-role teaching platform on Cloudflare free tier. Spun up Turborepo with 3 packages, defined 15-table D1 schema upfront, integrated Clerk auth with webhook sync, and built React SPA with TanStack Router + Query. All 49 source files pass TypeScript strict mode. Dev environments start cleanly. Ready for parallel Phase 2 (Question Bank) and Phase 4 (Classroom) work.

## The Brutal Truth

This should have been smooth — it mostly was. The frustration came from two entirely avoidable security issues that slipped through initial implementation: an unverified Clerk webhook and error middleware leaking internal messages. Both are textbook mistakes that got caught only during code review, not testing. That's exactly the kind of careless failure you see at 2am when someone copies webhook examples without reading the Svix docs.

The Hono RPC client type issue is annoying but manageable — it's a monorepo boundary problem that only matters once we start consuming the API from the web app, so kicking it to Phase 2 was the right call.

## Technical Details

**Architecture:**
- Hono API (CF Workers) at `apps/api`, routes defined with strict TypeScript inference
- React SPA (Vite) at `apps/web`, routed via TanStack Router (code-based FSR pattern)
- Shared types at `packages/shared` with Zod schemas for request validation

**Security fixes applied:**
1. Clerk webhook: Added Svix HMAC signature verification on incoming events (prevents replay/injection attacks)
2. Error middleware: Changed 500 handler from `res.json({error: err.message})` to `res.json({error: "Internal Server Error"})`

**Database schema:**
15 tables created via Drizzle migrations (users, classrooms, posts, comments, assessments, question_banks, submissions, notifications, etc.). Added missing indexes on foreign key columns — noticed during schema review that `posts.classroomId`, `comments.postId`, and others had no index coverage.

**Build output:**
- API minified: 385KB
- Web JS: 440KB, CSS: 22KB (Tailwind v4 with design system tokens)
- Zero TypeScript errors across all packages

## What We Tried

1. **Hono RPC client:** Attempted to use `hc<AppType>()` with Worker type bindings. Failed — RPC client can't resolve `D1Database` or `R2Bucket` types across monorepo imports. Switched to generic `hc<Hono>()` placeholder. Will revisit with type registry pattern or separate RPC schema in Phase 2.

2. **tsconfig inheritance:** `rootDir` in root tsconfig conflicted with package-specific imports. Removed it (unnecessary with `noEmit: true` and explicit `include` paths). This fixed `@teaching/shared` resolution.

3. **Clerk webhook implementation:** First pass used simple existence check on webhook payload. Code review caught missing HMAC verification. Added Svix signature validation — now production-ready.

## Root Cause Analysis

**Why did security issues slip through?**
Copied webhook and error handling patterns from Hono examples without fully internalizing the security implications. This is lazy. The Svix docs were in the browser tab; I just didn't read them carefully. Error middleware leak is even worse — standard practice is to never expose `err.message` to clients, yet it happened because no one questioned the initial implementation.

**Why the RPC type issue?**
Hono's RPC inference is excellent within a single package but struggles at monorepo boundaries when types aren't explicitly exported. Not a blocker — just a reminder that cross-package TS inference has limits, and we need a deliberate RPC contract strategy.

**Why the tsconfig problem existed?**
Used a boilerplate Turborepo template without reading it. `rootDir` in the root config was fighting with package-level paths. Should have stripped it immediately instead of discovering it later.

## Lessons Learned

1. **Security: Review before testing.** No test suite would have caught the webhook signature issue. Code review did. This means security patterns deserve explicit peer review, not just test coverage.

2. **Boilerplate requires cleanup.** Turborepo templates ship with sensible defaults that become invisible. The tsconfig issue would have vanished with 5 minutes of deliberate review. Don't trust scaffolding — read what it generated.

3. **Monorepo type boundaries are real.** Hono's RPC is type-safe within a single package. Cross-package, we need explicit schema exports. File this under "infrastructure debt to handle early."

4. **Webhook implementation is not boilerplate.** It's security-critical. Every webhook needs: signature verification (we added it), idempotency tracking (not yet), rate limiting (deferred). Don't pattern-match from examples.

5. **Schema definition upfront was the right call.** Defining all 15 tables at Phase 1 instead of incrementally adding them means we caught index gaps early and won't fight migration headaches later.

## Next Steps

1. **Phase 2 & 4 can start immediately** — both depend only on Phase 1 foundation. No blockers.

2. **RPC type issue:** Phase 2 should establish explicit RPC contract (separate schema exports) rather than relying on type inference across packages. This unblocks strong typing for web app → API calls.

3. **Webhook idempotency:** Phase 3 or 4 should add idempotency key tracking to Clerk sync. Current implementation has no protection against duplicate events.

4. **Security audit checklist:** Create and enforce a pre-review checklist for auth, webhooks, and error handling. This catches lazy pattern-matching.

---

**Owner of next steps:** Phase 2 lead should tackle RPC contract; Phase 3 (if security-focused) should harden webhook sync.

**Estimated time to unblock Phase 2:** None — already unblocked.
