---
title: @clerk/backend API Keys Support Research
date: 2026-04-04
status: DONE
---

## Executive Summary

`@clerk/backend` v3.0+ fully supports API Keys with create/list/verify/revoke methods. Your v1.34.0 is outdated; latest is **v3.2.4** (published ~13h ago). apiKeys entered public beta Dec 2025. Major upgrade required: Node.js 20+ mandatory, several breaking changes, but migration tooling available.

---

## Findings

### Q1: Latest Version & Release Info
- **Current:** v3.2.4 (latest)
- **Current status:** Published Feb 23, 2026 (~13 hours ago)
- **Your version:** v1.34.0 (significantly outdated)
- **Gap:** ~2 major versions behind

### Q2: API Keys Methods Support
**YES** — all methods exposed in v3.0+:
- `clerkClient.apiKeys.create()` — create with name, subject (user/org), scopes, expiration
- `clerkClient.apiKeys.list()` — paginated list with subject filter & includeInvalid flag
- `clerkClient.apiKeys.verify(secret)` — returns key object or throws if invalid/revoked/expired
- `clerkClient.apiKeys.revoke(keyId, reason?)` — immediate invalidation with optional reason
- `clerkClient.apiKeys.get(keyId)` — get single key

### Q3: Version Introduced
- **v2.7.0**: First M2M token support (Create/Revoke/Verify)
- **v3.0.0**: Standardized verify methods; removed deprecated `verifySecret()` in favor of `verify()`
- **Dec 11, 2025**: API Keys entered public beta (feature-complete)

**Breaking change in v3.0.0:**
```ts
// v2.x (deprecated)
await clerkClient.apiKeys.verifySecret(secret);

// v3.0+ (required)
await clerkClient.apiKeys.verify(secret);
```

### Q4: Breaking Changes (v1.34 → v3.0+)
- **Node.js 20+ required** (v1.34 supports Node 18)
- `apiKeys.verifySecret()` removed → use `verify()`
- `samlAccount` removed → use `enterpriseAccount`
- `m2m.verifyToken()` removed → use `m2m.verify()`
- `idpOAuthAccessToken.verifyAccessToken()` removed → use `idpOAuthAccessToken.verify()`

### Q5: Migration Guide Available
**YES** — official upgrade paths documented:
- [Core 2 upgrade guide](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-2/backend)
- [Core 3 upgrade guide](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-3)
- **CLI tool**: `@clerk/upgrade` auto-detects & applies fixes
- Recommended: Upgrade to latest Core 2 first, then to Core 3

### Q6: Cloudflare Workers Compatibility
- **YES** — v3.0+ fully compatible with edge runtimes (CF Workers, Vercel Edge)
- `apiKeys.verify()` works on edge (crypto ops are non-blocking)
- Requires: `nodejs_compat` compatibility flag in Cloudflare Workers
- **Note:** Node.js 20 requirement may impact legacy CF Worker setups

---

## Architectural Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| **Maturity** | STABLE | Public beta since Dec 2025, part of v3 stable release |
| **Adoption Risk** | MEDIUM | 2-version jump; Node 20 requirement breaking |
| **Community** | ACTIVE | Official Clerk SDK, well-maintained |
| **Documentation** | EXCELLENT | Full reference, migration guides, blog examples |
| **Edge Support** | YES | Cloudflare Workers fully supported |

---

## Recommendation

**UPGRADE TO v3.2.4** with staged approach:
1. Audit Node.js environment (must support v20+)
2. Use `@clerk/upgrade` CLI to detect breaking changes
3. Test migration in staging (v1.34 → v2.latest → v3.latest)
4. Update `apiKeys.verifySecret()` calls to `apiKeys.verify()`
5. Verify CF Workers setup includes `nodejs_compat` flag

**Implementation risk:** LOW (breaking changes few & well-documented)
**Adoption timeline:** 2–4 weeks depending on codebase size

---

## Unresolved Questions

- Exact release date for v2.7.0 (when apiKeys first appeared)
- Performance overhead of `apiKeys.verify()` on edge vs origin
- Pricing details post-public-beta (currently free during beta)

---

## Sources
- [API Keys Public Beta](https://clerk.com/changelog/2025-12-11-api-keys-public-beta)
- [Using API Keys Documentation](https://clerk.com/docs/guides/development/machine-auth/api-keys)
- [APIKeys SDK Reference](https://clerk.com/docs/reference/javascript/api-keys)
- [GitHub @clerk/backend CHANGELOG](https://github.com/clerk/javascript/blob/main/packages/backend/CHANGELOG.md)
- [Upgrading Clerk Core Guides](https://clerk.com/docs/guides/development/upgrading/overview)
- [Cloudflare Workers Node.js Compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
