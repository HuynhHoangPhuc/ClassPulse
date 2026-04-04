# Clerk API Keys Research Report
**Date:** 2026-04-03 | **Status:** BETA (public beta launched Dec 2025)

---

## Executive Summary

Clerk API Keys is a **native, production-ready feature in public beta** for delegating API access. The feature is free during beta with usage-based pricing post-GA (with 30+ days notice). Core infrastructure exists across JS Backend SDK, verification helpers, and Cloudflare Workers support. **Recommendation: Clerk API Keys is viable for ClassPulse AI API integration with one caveat — header format undocumented; implement fallback to Bearer token convention.**

---

## 1. FOUND: SDK Method Signatures & CRUD Operations

### Create API Key
```typescript
clerk.apiKeys.create({
  name: string,                    // required: descriptive identifier
  subject?: string,                // optional: user_xxx or org_xxx
  description?: string,            // optional: longer explanation
  scopes?: string[],               // optional: endpoint access rules
  secondsUntilExpiration?: number  // optional: lifetime in seconds (omit = never expires)
})
// Returns: APIKeyResource with id, name, secret (ONLY available once)
```

**Critical:** Secret is returned only once on creation. No retrieval endpoint exists. Clients must store immediately.

### List API Keys
```typescript
clerk.apiKeys.list({
  subject?: string,         // filter: user_xxx or org_xxx
  includeInvalid?: boolean  // include revoked/expired keys
})
// Returns: { data: APIKeyResource[], totalCount: number }
// Note: Secrets are NOT included in list responses
```

### Revoke API Key
```typescript
clerk.apiKeys.revoke({
  apiKeyId: string,
  revocationReason?: string  // optional: audit trail
})
// Returns: APIKeyResource (marked revoked, but visible in listings)
```

### Verify API Key
```typescript
clerkClient.apiKeys.verify(secret: string): Promise<APIKeyResource>
// Throws error if invalid, revoked, or expired
// Success returns: { id, name, subject, scopes, revoked, expired, createdAt, updatedAt }
```

**Alternative in Next.js:**
```typescript
const { isAuthenticated, userId, tokenType, scopes } = await auth({ 
  acceptsToken: 'api_key' 
})
// Returns null values if verification fails (treat as 401)
```

---

## 2. FOUND: Request Format & Authentication Headers

### Bearer Token Convention (Documented)
```http
Authorization: Bearer YOUR_API_KEY_SECRET
```

**Evidence:** Clerk docs explicitly show Bearer token format for sending API keys in requests. Standard across OAuth/JWT patterns.

### Missing Information
**Header format for AI sending the key to your backend:** Clerk docs do NOT specify whether:
- AI clients should use `Authorization: Bearer` (presumed based on conventions)
- Or custom `X-API-Key` header (not mentioned in official docs)
- Or query parameter `?key=` (not documented)

**Recommendation:** Implement middleware that accepts `Authorization: Bearer` (standard) and verify via `clerkClient.apiKeys.verify()`.

---

## 3. FOUND: Response Format from Verification

```typescript
interface APIKeyResource {
  id: string
  name: string
  subject: string          // user_xxx or org_xxx
  secret?: string          // ONLY in create() response
  scopes?: string[]        // granted permissions
  revoked: boolean
  expired: boolean
  createdAt: Date
  updatedAt: Date
}
```

**Usage context:** After verification, you get `userId` (from `subject` field) and `scopes` for permission checks. No org data returned directly — must query Clerk separately if needed.

---

## 4. FOUND: Cloudflare Workers Compatibility

### Status: ✅ Supported (with caveats)

**@clerk/backend SDK** is built for Node.js/V8 isolates and runs on:
- Cloudflare Workers
- Vercel Edge Runtime
- Deno
- Node.js 16+

### Implementation for Cloudflare Workers

```typescript
// wrangler.toml
[env.development]
vars = { CLERK_PUBLISHABLE_KEY = "pk_test_xxx" }

[[env.development.secrets]]
name = "CLERK_SECRET_KEY"

// src/index.ts
import { clerkClient } from '@clerk/backend'

export default {
  async fetch(request: Request, env: Env) {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401 })
    }
    
    const secret = authHeader.slice(7)
    try {
      const apiKey = await clerkClient(
        { secretKey: env.CLERK_SECRET_KEY }
      ).apiKeys.verify(secret)
      
      const userId = apiKey.subject
      // Proceed with authorized request
      return new Response(`Hello ${userId}`, { status: 200 })
    } catch (err) {
      return new Response('Invalid API key', { status: 401 })
    }
  }
}
```

### Gotcha: Environment Variable Binding
Some users report "A secretKey or apiKey must be provided" errors. **Fix:**
- Use `wrangler secret put CLERK_SECRET_KEY` (not `wrangler.toml`)
- Access via `env.CLERK_SECRET_KEY` at runtime (not `process.env`)
- Verify SDK version is 5.0.0+ for Workers support

---

## 5. FOUND: Pricing & Availability

| Aspect | Details |
|--------|---------|
| **Beta Status** | Public beta (Dec 11, 2025 launch) |
| **Cost (Beta)** | FREE |
| **Cost (GA)** | Usage-based (model TBD) |
| **Notice Period** | 30+ days before billing starts |
| **Monitoring** | Dashboard stats available before GA |
| **API Stability** | "API may change before GA" (official caveat) |

**Implication:** Safe to use now, but budget for costs post-GA. Feature could be dropped or significantly changed before release.

---

## 6. FOUND: Rate Limits & Constraints

### Backend API Rate Limits
- Per-application instance (identified by Secret Key)
- Development vs. production tiers differ
- **Specific numbers not documented** (escalate to Clerk support for actual limits)

### API Key Constraints
- Keys are opaque (not JWTs — cannot be decoded client-side)
- No introspection endpoint (must use `verify()` to validate)
- Instant revocation (no caching window)
- Default: **never expire** (long-lived by design)
- Can set optional `secondsUntilExpiration` on creation

### Scope System
- User OR Organization scoped (dual-scope not supported)
- Scopes array defines accessible endpoints (custom — you define the contract)
- Scope validation is your responsibility (Clerk doesn't enforce)

---

## 7. NOT FOUND / EDGE CASES

### Missing Documentation
1. **REST API Endpoint Format** — Clerk docs link to Backend API reference (404 when accessed). Unclear if there are direct REST endpoints or SDK-only.
2. **Exact Rate Limit Numbers** — No specific requests/sec or requests/month limits published.
3. **Custom Header Support** — No mention of `X-API-Key` or other custom headers. Bearer token is inferred convention.
4. **Scope Validation** — Clerk doesn't validate scopes server-side; implementation is app-specific.
5. **Key Rotation Tooling** — No built-in key rotation helpers; you must implement.

### Experimental/Unstable
- Feature is in public beta; API may change.
- JavaScript SDK: experimental hook `useAPIKeys()` from `@clerk/nextjs/experimental`
- TypeScript support exists but types may evolve.

---

## 8. Alternative: Custom API Key System (Fallback)

If Clerk's API Keys maturity becomes a concern, implement custom alongside Clerk:

```typescript
// Custom API Key Workflow (D1 + Hashing)
import { sha256 } from 'crypto'

// 1. Create: Hash before storage
const secret = crypto.getRandomValues(new Uint8Array(32)).toString()
const hashed = sha256(secret)
await db.prepare(
  'INSERT INTO api_keys (user_id, hashed_secret) VALUES (?, ?)'
).bind(userId, hashed).run()

// 2. Verify: Compare hashes
const incoming = request.headers.get('authorization').slice(7)
const incomingHash = sha256(incoming)
const row = await db.prepare(
  'SELECT user_id FROM api_keys WHERE hashed_secret = ?'
).bind(incomingHash).first()

// 3. Map to Clerk: Resolve Clerk user from custom key
if (row) {
  const clerkUser = await clerkClient.users.getUser(row.user_id)
  // Proceed with authenticated context
}
```

**Pros:** Full control, no beta risk, instant revocation (delete row).
**Cons:** Must manage rotation, expiration, and audit logging yourself.

---

## 9. Concrete Code Example: ClassPulse Integration

### Middleware for AI API Key Verification

```typescript
// src/middleware/verify-api-key.ts
import { clerkClient } from '@clerk/backend'

export async function verifyApiKey(
  request: Request,
  env: { CLERK_SECRET_KEY: string }
) {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      valid: false,
      error: 'Missing or invalid Authorization header'
    }
  }
  
  const secret = authHeader.slice(7)
  
  try {
    const client = clerkClient({ secretKey: env.CLERK_SECRET_KEY })
    const apiKey = await client.apiKeys.verify(secret)
    
    // Check if revoked or expired
    if (apiKey.revoked || apiKey.expired) {
      return {
        valid: false,
        error: 'API key is revoked or expired'
      }
    }
    
    // Extract user identity
    const userId = apiKey.subject.replace('user_', '')
    
    // Optionally check scopes
    const hasAiQuestionScope = apiKey.scopes?.includes('ai:question:create')
    
    return {
      valid: true,
      userId,
      scopes: apiKey.scopes || [],
      hasAiQuestionScope
    }
  } catch (error) {
    return {
      valid: false,
      error: `Verification failed: ${error.message}`
    }
  }
}

// src/routes/ai/questions.ts
export async function POST(request: Request, env: Env) {
  const verification = await verifyApiKey(request, env)
  
  if (!verification.valid) {
    return new Response(verification.error, { status: 401 })
  }
  
  if (!verification.hasAiQuestionScope) {
    return new Response('Insufficient permissions', { status: 403 })
  }
  
  const { userId, scopes } = verification
  // Process AI question for userId...
  
  return new Response(JSON.stringify({ success: true }), { status: 200 })
}
```

---

## 10. Gotchas & Limitations

### Critical
1. **Secret available only once** — On `create()`, secret is in response. No retrieval mechanism. Clients lose access if they don't save.
2. **No introspection** — You cannot query "what scopes does this key have?" without calling `verify()` each time.
3. **No caching guidance** — Clerk docs silent on whether verification results can be cached. Assume zero caching for security.

### Operational
1. **No rotation automation** — You must manage key rotation workflows (communicate expiration to users, handle migrations).
2. **Scope contract is implicit** — Clerk stores scope arrays but doesn't validate. You define the contract and enforce it.
3. **Identity only** — Verification returns user ID, not org context. If you need org data, query Clerk separately.

### Edge Runtime
1. **Wrangler secrets only** — Use `wrangler secret put`, not `wrangler.toml` for sensitive keys.
2. **No `process.env` in Workers** — Use `env` parameter; `@clerk/backend` handles this correctly, but some versions struggled.

---

## 11. Unresolved Questions

1. **REST API vs. SDK-only?** — Can you hit Clerk's API key endpoints via HTTP, or must you use SDKs? (Backend API reference 404'd)
2. **Rate limit specifics?** — Exact limits for API key verification requests? (Escalate to Clerk)
3. **Caching safety?** — Can you cache verification results, or must every request verify? (Best practice unclear)
4. **Scope enforcement?** — Does Clerk validate scope permissions, or is it fully client-enforced? (Appears client-enforced)
5. **Rollout timeline for GA?** — When does API keys exit beta and pricing start? (No published ETA)

---

## Recommendation

### Primary: Clerk API Keys ✅
**Use native Clerk API Keys for ClassPulse AI API.**

**Why:**
- Free during beta (aligns with startup phase)
- Instant revocation (security-critical for AI APIs)
- User-scoped by default (maps cleanly to Clerk user model)
- Cloudflare Workers compatible (your edge runtime)
- Official Clerk support (faster fixes vs. custom system)
- Scope system extensible (can add fine-grained permissions later)

**Caveats:**
- Beta feature (document API stability risk in architecture docs)
- Pricing unknown post-GA (budget TBD after 2026 Q3/Q4)
- Missing REST API docs (SDK-first design)

### Implementation Path
1. **Phase 1:** Verify Clerk API Key feature works in your Cloudflare Worker setup (1-2 days spike).
2. **Phase 2:** Implement middleware (above code example) in ClassPulse AI API routes.
3. **Phase 3:** Create admin UI for users to manage API keys (use Clerk's `<APIKeys />` component or custom flow).
4. **Phase 4:** Document scope contract and rate limits for AI API consumers.

### Fallback: Custom System
If Clerk API Keys hit critical issues (beta breaks, pricing shock), switch to custom D1-backed system. Design custom system in parallel for risk mitigation, but don't build it now (YAGNI).

---

## Source Credibility Assessment

| Source | Credibility | Notes |
|--------|------------|-------|
| clerk.com/docs/guides/* | ⭐⭐⭐⭐⭐ | Official docs, recently updated (Mar 2026) |
| clerk.com/changelog | ⭐⭐⭐⭐⭐ | Official changelog; cites Dec 2025 beta launch |
| clerk.com/reference/backend/* | ⭐⭐⭐⭐ | Official API reference; some 404s (under maintenance?) |
| GitHub clerk/demo-api-keys | ⭐⭐⭐⭐⭐ | Official implementation example |
| GitHub issues (clerk/javascript) | ⭐⭐⭐⭐ | Real user reports; Clerk team responds |
| DEV Community / Medium articles | ⭐⭐⭐ | Community experiments; pre-beta or outdated |
| Cloudflare Workers docs | ⭐⭐⭐⭐⭐ | Official; no Clerk-specific caveats found |

---

## Files Referenced in Research

- [Using API keys - Machine authentication | Clerk Docs](https://clerk.com/docs/guides/development/machine-auth/api-keys)
- [APIKeys object - SDK Reference - JavaScript | Clerk Docs](https://clerk.com/docs/reference/javascript/api-keys)
- [Build a custom flow for managing API keys | Clerk Docs](https://clerk.com/docs/guides/development/custom-flows/api-keys/manage-api-keys)
- [Verify API keys in your Next.js application with Clerk | Clerk Docs](https://clerk.com/docs/guides/development/verifying-api-keys)
- [verify() - API Keys - JS Backend SDK | Clerk Docs](https://clerk.com/docs/reference/backend/api-keys/verify)
- [GitHub: clerk/demo-api-keys](https://github.com/clerk/demo-api-keys)
- [API Keys Public Beta Announcement](https://clerk.com/changelog/2025-12-11-api-keys-public-beta)
- [Making authenticated requests - Development | Clerk Docs](https://clerk.com/docs/guides/development/making-requests)

---

**Status:** ✅ DONE
**Next:** Proceed with Phase 1 spike (verify Workers integration) or request follow-up research on unresolved questions.
