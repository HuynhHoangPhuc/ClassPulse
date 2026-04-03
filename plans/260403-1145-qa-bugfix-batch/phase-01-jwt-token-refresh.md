# Phase 1 — JWT Token Refresh & Error UX

## Priority: CRITICAL
## Status: Complete
## Effort: 2h

## Context

- [QA Report: JWT expired after ~2 min, all POST/write operations fail with 401]
- Error: "JWT is expired. Expiry date: Fri, 03 Apr 2026 11:37:24 GMT"
- GET retries succeed (React Query `retry: 1` + fresh `getToken()`) but POST mutations fail permanently
- Raw JWT expiry timestamps leak to user in error banner

## Root Cause Analysis

Clerk's `getToken()` returns a cached JWT. Clerk's browser SDK refreshes tokens proactively, but there's a race condition:
1. Component mounts, calls `getToken()` and stores token in local state
2. User spends time filling a form (>60s, Clerk's default short-lived JWT)
3. User submits → mutation uses the **stale** cached token → 401

**Key files with the bug pattern:**
- `apps/web/src/features/questions/question-editor-page.tsx` — caches token in `useState` on mount (line 58)
- Any mutation that uses a pre-fetched token instead of calling `getToken()` at mutation time

## Requirements

### Functional
- All API mutations must use a fresh token at call time, not a cached one
- On 401 response, retry once with a fresh token before failing
- Error messages must be user-friendly, not raw JWT debug strings

### Non-functional
- Zero additional UX friction — token refresh is invisible to user
- No full-page reloads needed

## Architecture

### Approach: fetchApi retry wrapper + fresh token per mutation

```
fetchApi() → 401 → getToken({skipCache:true}) → retry → success/fail
```

**NOT** adding a global axios interceptor — keep it simple with the existing fetch wrapper.

## Related Code Files

### Files to modify:
- `apps/web/src/lib/fetch-api.ts` — Add 401 retry with token refresh
- `apps/web/src/features/questions/question-editor-page.tsx` — Remove cached token `useState`, use `getToken()` per call

### Files to read for context:
- `apps/web/src/app.tsx` — QueryClient config (retry: 1)
- `apps/web/src/features/assessments/assessment-wizard-page.tsx` — Check if it caches tokens

## Implementation Steps

### Step 1: Add token-refresh-aware fetch wrapper

**File:** `apps/web/src/lib/fetch-api.ts`

1. Add optional `getToken` callback parameter to `fetchApi`
2. On 401 response, if `getToken` provided:
   - Call `getToken()` to get fresh token
   - Retry the request once with new token
3. On final failure, sanitize error message (strip JWT debug info)

```typescript
// Pseudocode
export async function fetchApi(
  path: string,
  options: RequestInit = {},
  token?: string | null,
  getToken?: () => Promise<string | null>  // NEW: for retry
): Promise<unknown> {
  const res = await doFetch(path, options, token);

  if (res.status === 401 && getToken) {
    const freshToken = await getToken();
    if (freshToken && freshToken !== token) {
      const retryRes = await doFetch(path, options, freshToken);
      if (!retryRes.ok) throw sanitizedError(retryRes);
      return retryRes.json();
    }
  }

  if (!res.ok) throw sanitizedError(res);
  return res.json();
}
```

### Step 2: Sanitize 401 error messages

Replace raw JWT error with user-friendly message:
```typescript
function sanitizeError(body: { error?: string }, status: number): string {
  if (status === 401) return "Session expired. Please refresh the page.";
  return body.error || `Request failed (${status})`;
}
```

### Step 3: Fix token caching in question editor

**File:** `apps/web/src/features/questions/question-editor-page.tsx`

- Remove `const [token, setToken] = useState<string | null>(null)` pattern
- Pass `getToken` from `useAuth()` directly to mutations
- Each `handleSave()` calls `await getToken()` fresh

### Step 4: Audit all mutation patterns for stale tokens

Search all files for the pattern `useState.*token` and ensure mutations call `getToken()` at call time, not from cached state.

## Todo List

- [x] Add retry-on-401 logic to `fetchApi.ts`
- [x] Add error message sanitization for 401 responses
- [x] Fix question-editor-page.tsx stale token pattern
- [x] Audit all mutations for stale token caching
- [x] Test: create question after waiting >2 min on form

## Success Criteria

- Creating a question after 5+ min on form succeeds without page refresh
- No raw JWT error messages shown to users
- 401 responses trigger one invisible retry with fresh token

## Risk Assessment

- **Low risk**: `fetchApi` changes are backward-compatible (new optional param)
- **Edge case**: If Clerk's session itself expired (user idle >1h), retry will also fail — user gets "Session expired" message, which is correct
