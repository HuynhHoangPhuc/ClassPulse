import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock must be hoisted before imports that use createClerkClient
vi.mock("@clerk/backend", () => {
  const mockApiKeys = {
    verify: vi.fn(),
    create: vi.fn(),
    list: vi.fn(),
    revoke: vi.fn(),
  }
  return {
    createClerkClient: vi.fn(() => ({ apiKeys: mockApiKeys })),
    __mockApiKeys: mockApiKeys,
  }
})

import { createClerkClient } from "@clerk/backend"
import {
  verifyApiKey,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "../clerk-api-key-service.js"

const SECRET = "sk_test_fake"

const baseKey = {
  id: "key_abc",
  name: "My Key",
  subject: "user_123",
  description: null,
  scopes: ["ai:questions:write"],
  claims: {},
  createdBy: "user_123",
  createdAt: 1700000000,
  updatedAt: 1700000000,
  expiration: null,
  revoked: false,
  revocationReason: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("verifyApiKey", () => {
  it("valid secret → returns key metadata", async () => {
    const clerk = createClerkClient({ secretKey: SECRET })
    vi.mocked(clerk.apiKeys.verify).mockResolvedValueOnce(baseKey as never)
    const result = await verifyApiKey("sk_live_valid", SECRET)
    expect(result.id).toBe("key_abc")
    expect(result.subject).toBe("user_123")
    expect(result.scopes).toEqual(["ai:questions:write"])
  })

  it("invalid secret → throws", async () => {
    const clerk = createClerkClient({ secretKey: SECRET })
    vi.mocked(clerk.apiKeys.verify).mockRejectedValueOnce(new Error("Invalid API key"))
    await expect(verifyApiKey("sk_bad", SECRET)).rejects.toThrow("Invalid API key")
  })
})

describe("createApiKey", () => {
  it("returns key with secret", async () => {
    const clerk = createClerkClient({ secretKey: SECRET })
    const keyWithSecret = { ...baseKey, secret: "sk_live_newkey_secret" }
    vi.mocked(clerk.apiKeys.create).mockResolvedValueOnce(keyWithSecret as never)
    const result = await createApiKey(SECRET, {
      name: "My Key",
      subject: "user_123",
      scopes: ["ai:questions:write"],
    })
    expect(result.secret).toBe("sk_live_newkey_secret")
    expect(result.name).toBe("My Key")
  })

  it("uses default scopes when none provided", async () => {
    const clerk = createClerkClient({ secretKey: SECRET })
    vi.mocked(clerk.apiKeys.create).mockResolvedValueOnce({
      ...baseKey,
      scopes: ["ai:questions:write"],
      secret: "sk_live_default",
    } as never)
    await createApiKey(SECRET, { name: "Default Key", subject: "user_123" })
    expect(clerk.apiKeys.create).toHaveBeenCalledWith(
      expect.objectContaining({ scopes: ["ai:questions:write"] }),
    )
  })
})

describe("listApiKeys", () => {
  it("returns array of keys", async () => {
    const clerk = createClerkClient({ secretKey: SECRET })
    vi.mocked(clerk.apiKeys.list).mockResolvedValueOnce({ data: [baseKey, { ...baseKey, id: "key_xyz" }] } as never)
    const result = await listApiKeys(SECRET, "user_123")
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe("key_abc")
  })

  it("passes subject filter to SDK", async () => {
    const clerk = createClerkClient({ secretKey: SECRET })
    vi.mocked(clerk.apiKeys.list).mockResolvedValueOnce({ data: [] } as never)
    await listApiKeys(SECRET, "user_filter_target")
    expect(clerk.apiKeys.list).toHaveBeenCalledWith({ subject: "user_filter_target" })
  })
})

describe("revokeApiKey", () => {
  it("calls revoke with apiKeyId and reason", async () => {
    const clerk = createClerkClient({ secretKey: SECRET })
    const revokedKey = { ...baseKey, revoked: true, revocationReason: "Revoked by user" }
    vi.mocked(clerk.apiKeys.revoke).mockResolvedValueOnce(revokedKey as never)
    await revokeApiKey(SECRET, "key_to_revoke")
    expect(clerk.apiKeys.revoke).toHaveBeenCalledWith({
      apiKeyId: "key_to_revoke",
      revocationReason: "Revoked by user",
    })
  })

  it("returns revoked key metadata", async () => {
    const clerk = createClerkClient({ secretKey: SECRET })
    const revokedKey = { ...baseKey, revoked: true, revocationReason: "Revoked by user" }
    vi.mocked(clerk.apiKeys.revoke).mockResolvedValueOnce(revokedKey as never)
    const result = await revokeApiKey(SECRET, "key_abc")
    expect(result.revoked).toBe(true)
    expect(result.revocationReason).toBe("Revoked by user")
  })
})
