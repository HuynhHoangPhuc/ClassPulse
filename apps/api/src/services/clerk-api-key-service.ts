/**
 * Clerk API Keys service — wraps @clerk/backend SDK v3 apiKeys methods.
 * Keeps function signatures stable so downstream imports don't change.
 */

import { createClerkClient } from "@clerk/backend"

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

function getClient(secretKey: string) {
  return createClerkClient({ secretKey })
}

/** Verify an API key secret. Returns key metadata if valid, throws on invalid/revoked/expired. */
export async function verifyApiKey(
  secret: string,
  secretKey: string,
): Promise<ClerkApiKey> {
  const client = getClient(secretKey)
  const result = await client.apiKeys.verify(secret)
  return result as unknown as ClerkApiKey
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
  const client = getClient(secretKey)
  const result = await client.apiKeys.create({
    name: params.name,
    subject: params.subject,
    description: params.description,
    scopes: params.scopes ?? ["ai:questions:write"],
    createdBy: params.subject,
    secondsUntilExpiration: params.secondsUntilExpiration,
  })
  return result as unknown as ClerkApiKeyWithSecret
}

/** List API keys for a given subject (user ID). */
export async function listApiKeys(
  secretKey: string,
  subject: string,
): Promise<ClerkApiKey[]> {
  const client = getClient(secretKey)
  const result = await client.apiKeys.list({ subject })
  return result.data as unknown as ClerkApiKey[]
}

/** Revoke an API key by ID. */
export async function revokeApiKey(
  secretKey: string,
  apiKeyId: string,
): Promise<ClerkApiKey> {
  const client = getClient(secretKey)
  const result = await client.apiKeys.revoke({ apiKeyId, revocationReason: "Revoked by user" })
  return result as unknown as ClerkApiKey
}

export type { ClerkApiKey, ClerkApiKeyWithSecret }
