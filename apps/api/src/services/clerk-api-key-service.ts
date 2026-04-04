/**
 * Clerk API Keys service — thin wrapper over Clerk's REST API.
 * The @clerk/backend SDK (v1.x) doesn't expose apiKeys methods,
 * so we call the REST endpoints directly.
 */

const CLERK_API_BASE = "https://api.clerk.com/v1"

interface ClerkApiKey {
  id: string
  name: string
  subject: string
  description: string | null
  scopes: string[]
  claims: Record<string, unknown>
  createdBy: string | null
  createdAt: number
  updatedAt: number
  expiration: number | null
  revoked: boolean
  revocationReason: string | null
}

interface ClerkApiKeyWithSecret extends ClerkApiKey {
  secret: string
}

interface ClerkApiKeyListResponse {
  data: ClerkApiKey[]
  totalCount: number
}

async function clerkFetch<T>(
  path: string,
  secretKey: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${CLERK_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Clerk API error (${res.status}): ${body}`)
  }

  return res.json() as Promise<T>
}

/** Verify an API key secret. Returns key metadata if valid, throws on invalid/revoked/expired. */
export async function verifyApiKey(
  secret: string,
  secretKey: string,
): Promise<ClerkApiKey> {
  return clerkFetch<ClerkApiKey>("/api_keys/verify", secretKey, {
    method: "POST",
    body: JSON.stringify({ secret }),
  })
}

/** Create a new API key tied to a user. Returns the key with secret (shown only once). */
export async function createApiKey(
  secretKey: string,
  params: {
    name: string
    subject: string
    description?: string
    scopes?: string[]
    secondsUntilExpiration?: number
  },
): Promise<ClerkApiKeyWithSecret> {
  return clerkFetch<ClerkApiKeyWithSecret>("/api_keys", secretKey, {
    method: "POST",
    body: JSON.stringify({
      name: params.name,
      subject: params.subject,
      description: params.description,
      scopes: params.scopes ?? ["ai:questions:write"],
      createdBy: params.subject,
      secondsUntilExpiration: params.secondsUntilExpiration,
    }),
  })
}

/** List API keys for a given subject (user ID). */
export async function listApiKeys(
  secretKey: string,
  subject: string,
): Promise<ClerkApiKey[]> {
  const result = await clerkFetch<ClerkApiKeyListResponse>(
    `/api_keys?subject=${encodeURIComponent(subject)}`,
    secretKey,
  )
  return result.data
}

/** Revoke an API key by ID. */
export async function revokeApiKey(
  secretKey: string,
  apiKeyId: string,
): Promise<ClerkApiKey> {
  return clerkFetch<ClerkApiKey>(`/api_keys/${encodeURIComponent(apiKeyId)}/revoke`, secretKey, {
    method: "POST",
    body: JSON.stringify({ revocationReason: "Revoked by user" }),
  })
}

export type { ClerkApiKey, ClerkApiKeyWithSecret }
