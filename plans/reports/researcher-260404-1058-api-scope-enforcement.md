---
name: API Key Scope Enforcement Patterns Research
description: Best practices for scope-based authorization in Node.js/Hono APIs on Cloudflare Workers
type: reference
---

# API Key Scope Enforcement Patterns Research

## Finding 1: Scope-to-Route Mapping — Hierarchical Pattern Wins

**Pattern:** Use hierarchical scopes with colon separators (e.g., `ai:questions:write`, `ai:*`).

**Why:** Industry standard (GitHub, Stripe, Vercel). Curity docs confirm: "when you design scopes for real-world systems, you set boundaries by business area and data sensitivity."

**How to apply:** Map scopes to route prefixes. For `ai:questions:write`, restrict to `/api/v1/ai/questions/*` (POST/PATCH/DELETE). Wildcard scopes like `ai:*` grant full access to that subtree.

---

## Finding 2: Middleware-Level > Route-Level for Scope Enforcement

**Recommendation:** Add scope validation in auth middleware, NOT per-route decorators.

**Why:** 
- Hono best practice: Use bearer auth middleware with custom verification
- Reduces duplication across routes
- Cloudflare Workers optimization: Scope checks at edge before route handler execution
- ASP.NET Core docs confirm: "Middleware-based approach keeps authentication logic separate, providing better separation of concerns"

**Implementation:**
```javascript
// Hono middleware pattern (pseudo-code)
app.use('/api/v1/ai/*', async (c, next) => {
  const scope = c.get('auth').scope; // From JWT or API key
  const requiredScope = 'ai:questions:write';
  
  if (!hasScope(scope, requiredScope)) {
    return c.json({ error: 'Insufficient scope' }, 403);
  }
  await next();
});
```

---

## Finding 3: JWT Sessions = No Scope Checks (Existing Approach)

**Pattern:** JWT auth context already has permission system. Skip scope checks for JWT tokens.

**Why:** GitHub/Stripe separate token types:
- API keys → scope-gated
- User sessions (JWT/OAuth) → full access via role system

**How to apply:** In middleware, check token type:
```javascript
if (isApiKey(token)) {
  validateScope(scope, requiredScope);
} else if (isJWT(token)) {
  // JWT already has roles/permissions, skip scope check
  await next();
}
```

---

## Finding 4: Simplest Secure Approach (YAGNI Compliant)

**Start here for `ai:questions:write` only:**

1. **Scope check in single middleware** — validate before route handler
2. **String match, not regex** — `hasScope('ai:questions:write', 'ai:questions:write')` ✓
3. **No wildcard expansion yet** — Add only when second scope appears
4. **Reuse existing Hono bearer auth** — Don't reinvent; extend `verifyToken` option

**Why this works:** GitHub fine-grained PATs started with explicit permission lists. Stripe uses restricted keys. Both avoided hierarchical expansion until necessary.

---

## Finding 5: Cloudflare Workers Edge Execution Advantage

**Benefit:** Scope checks happen at edge before origin requests. No latency penalty.

**Implementation:** Hono on Workers naturally places middleware at request entry—scope validation runs before any downstream logic.

---

## Platform Reference Implementations

| Platform | Scope Model | Enforcement | Key Insight |
|----------|------------|-------------|------------|
| **GitHub** | Hierarchical (`repository:read`) + explicit list | Middleware-level in GraphQL/REST routers | Targets specific repos + permissions |
| **Stripe** | Flat key restrictions + OAuth scopes | At API gateway layer | Separate API key types from session tokens |
| **Vercel** | Hierarchical (`project:read`, `deployment:write`) | Token middleware + scope headers | Integrations request scopes upfront |
| **Unkey** | Arbitrary metadata + Hono integration | @unkey/hono middleware | Built for serverless; Hono-native support |

---

## Recommendations (Ranked)

### 1. **Middleware-Only Scope Validation (Recommended)**
- Add scope check to existing auth middleware
- String-match only (YAGNI)
- Scope stored in JWT `scope` claim or API key metadata
- **Effort:** 1–2 hours. **Risk:** Low.

### 2. **Separate Scope Middleware (If Scope Logic Grows)**
- Only if you end up with 3+ scopes AND hierarchical matching
- Keep auth (token validity) separate from authz (scope checks)
- **Defer until:** Multiple scopes exist AND overlap becomes clear

### 3. **Use Unkey Library (If Going Production)**
- @unkey/hono handles scope validation out-of-box
- Verifies keys + enforces metadata permissions
- **Defer until:** Key management system needed (revocation, rotation, analytics)

---

## Unresolved Questions

1. **Does Clerk have fine-grained API key scope support?** Research did not cover Clerk's current API key capabilities. Assume manual scope storage in key metadata for now.
2. **Should scope failures return 401 or 403?** Industry split: 401 (token invalid), 403 (token valid but insufficient permissions). Recommend 403 for clarity.
3. **Expiration + scope rotation?** Not in scope of this research—defer to production hardening phase.

---

## Sources

- [Hono Bearer Auth Middleware](https://hono.dev/docs/middleware/builtin/bearer-auth)
- [GitHub Fine-Grained Personal Access Tokens](https://github.blog/security/application-security/introducing-fine-grained-personal-access-tokens-for-github/)
- [Curity OAuth Scope Best Practices](https://curity.io/resources/learn/scope-best-practices/)
- [Cloudflare Workers JWT Validation](https://blog.cloudflare.com/protecting-apis-with-jwt-validation/)
- [Stripe API Authentication Patterns](https://docs.stripe.com/api/authentication)
- [Vercel API Scopes for Integrations](https://vercel.com/changelog/enhanced-security-with-new-api-scopes-for-integrations)
- [Unkey Hono Integration](https://www.unkey.com/docs/libraries/ts/hono)
- [ASP.NET Core Middleware Authorization Patterns](https://www.devleader.ca/2024/04/18/api-key-authorization-middleware-in-asp-net-core-a-how-to-guide)
