# Clerk API Keys Implementation Complete

**Date**: 2026-04-04
**Severity**: High
**Component**: Authentication / API Design
**Status**: Resolved

## What Happened

Completed implementation of Clerk API key authentication enabling third-party AI integrations (ChatGPT, Zapier) to call `POST /api/questions/ai` without browser JWT refresh cycles.

## The Brutal Truth

Shipped with 3 critical security holes caught in review. The "just call the API" pragmatism masked that role guards and ownership checks weren't automatic—we coded ourselves into IDOR vulnerabilities. Real wake-up call that auth scaffolding needs security review before implementation, not after.

## Technical Details

**SDK Reality Check**: `@clerk/backend` v1.34.0 lacks `client.apiKeys()` methods. Fell back to REST API wrapper via `fetch()` to `https://api.clerk.com/v1/api_keys/*`. Works but adds HTTP call latency and error surface.

**Vulnerabilities Found**:
- C1: Any user could create API keys (no teacher role guard) → fixed with `requireTeacher()` middleware matching `parent-routes.ts` pattern
- C2: DELETE endpoint had IDOR; users could revoke others' keys → fixed by verifying `key.userId === currentUser.id`
- C3: Clerk API error bodies leaked credential hints to clients → fixed with generic "API integration failed" messages

**Bugs Fixed**: `expiresInDays: 0` validation bypass (H2), missing URL encoding on revoke endpoint (M1).

## What We Tried

- Attempted SDK upgrade first—doesn't exist. Stuck with REST wrapper.
- Initially left scopes unimplemented (all API keys get full account access). Documented as future work.

## Root Cause Analysis

Skipped security-first review. Built auth scaffolding with "assume role guards exist" mindset. IDOR bugs happen when ownership assumptions aren't enforced at the DB query layer—we verified after the fact instead of by design.

## Lessons Learned

1. **Auth is not implementation detail**: Review role/ownership rules before coding, not after shipping.
2. **External API errors are secrets**: Never surface provider error messages to clients. Wrap with generic feedback.
3. **SDK limitations are real constraints**: Check for methods before upgrading expectations; fallback planning saves time.

## Next Steps

- Document API key scope enforcement design for future work (currently all keys = full access)
- Add integration tests for IDOR scenarios to prevent regression
- Evaluate Clerk SDK upgrade path quarterly; v1.35+ may add `apiKeys()` methods

**Files**: `apps/api/src/services/clerk-api-key-service.ts`, `apps/api/src/routes/api-key-routes.ts`, settings UI components. Commits: `ee0e8f7`, `8996e0c`.
