import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"

vi.mock("../../services/clerk-api-key-service.js", () => ({
  createApiKey: vi.fn(),
  listApiKeys: vi.fn(),
  revokeApiKey: vi.fn(),
}))

// Mock drizzle and the D1 query chain
vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(),
}))

import { createApiKey, listApiKeys, revokeApiKey } from "../../services/clerk-api-key-service.js"
import { drizzle } from "drizzle-orm/d1"
import { apiKeyRoutes } from "../api-key-routes.js"

const mockCreateApiKey = vi.mocked(createApiKey)
const mockListApiKeys = vi.mocked(listApiKeys)
const mockRevokeApiKey = vi.mocked(revokeApiKey)
const mockDrizzle = vi.mocked(drizzle)

const fakeEnv = { CLERK_SECRET_KEY: "sk_test_fake", DB: {} as D1Database }

const baseKey = {
  id: "key_abc",
  name: "My Key",
  subject: "user_teacher",
  description: null,
  scopes: ["ai:questions:write"],
  claims: {},
  createdBy: "user_teacher",
  createdAt: 1700000000,
  updatedAt: 1700000000,
  expiration: null,
  revoked: false,
  revocationReason: null,
}

/** Build a mock drizzle DB that returns a given user row */
function mockDb(userRow: { role: string } | null) {
  const queryChain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(userRow ? [userRow] : []),
  }
  mockDrizzle.mockReturnValue(queryChain as never)
}

/** Build Hono test app with auth context pre-injected */
function buildApp(userId = "user_teacher") {
  const app = new Hono<{ Bindings: typeof fakeEnv; Variables: { userId: string } }>()
  app.use("/*", async (c, next) => {
    c.set("userId", userId)
    await next()
  })
  app.route("/api-keys", apiKeyRoutes)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api-keys — create API key", () => {
  it("valid body → 201 with secret", async () => {
    mockDb({ role: "teacher" })
    mockCreateApiKey.mockResolvedValueOnce({ ...baseKey, secret: "sk_live_new" })
    const app = buildApp()
    const res = await app.fetch(
      new Request("http://localhost/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Key" }),
      }),
      fakeEnv,
    )
    expect(res.status).toBe(201)
    const body = await res.json() as Record<string, unknown>
    expect(body.secret).toBe("sk_live_new")
    expect(body.id).toBe("key_abc")
  })

  it("invalid body (empty name) → 400", async () => {
    mockDb({ role: "teacher" })
    const app = buildApp()
    const res = await app.fetch(
      new Request("http://localhost/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      }),
      fakeEnv,
    )
    expect(res.status).toBe(400)
  })

  it("missing body → 400", async () => {
    mockDb({ role: "teacher" })
    const app = buildApp()
    const res = await app.fetch(
      new Request("http://localhost/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json{{",
      }),
      fakeEnv,
    )
    expect(res.status).toBe(400)
  })

  it("expiresInDays converts to seconds", async () => {
    mockDb({ role: "teacher" })
    mockCreateApiKey.mockResolvedValueOnce({ ...baseKey, secret: "sk_live_exp" })
    const app = buildApp()
    await app.fetch(
      new Request("http://localhost/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Expiring Key", expiresInDays: 7 }),
      }),
      fakeEnv,
    )
    expect(mockCreateApiKey).toHaveBeenCalledWith(
      "sk_test_fake",
      expect.objectContaining({ secondsUntilExpiration: 7 * 86400 }),
    )
  })
})

describe("GET /api-keys — list keys", () => {
  it("returns 200 with key list (no secrets)", async () => {
    mockDb({ role: "teacher" })
    mockListApiKeys.mockResolvedValueOnce([baseKey, { ...baseKey, id: "key_xyz" }])
    const app = buildApp()
    const res = await app.fetch(new Request("http://localhost/api-keys"), fakeEnv)
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>[]
    expect(body).toHaveLength(2)
    // Secrets must NOT be included
    expect(body[0].secret).toBeUndefined()
    expect(body[0].id).toBe("key_abc")
  })
})

describe("DELETE /api-keys/:id — revoke key", () => {
  it("key owned by user → 200 revoked", async () => {
    mockDb({ role: "teacher" })
    mockListApiKeys.mockResolvedValueOnce([baseKey])
    mockRevokeApiKey.mockResolvedValueOnce({ ...baseKey, revoked: true })
    const app = buildApp()
    const res = await app.fetch(
      new Request("http://localhost/api-keys/key_abc", { method: "DELETE" }),
      fakeEnv,
    )
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.revoked).toBe(true)
  })

  it("key NOT owned by user → 404", async () => {
    mockDb({ role: "teacher" })
    mockListApiKeys.mockResolvedValueOnce([]) // no keys for this user
    const app = buildApp()
    const res = await app.fetch(
      new Request("http://localhost/api-keys/key_other_user", { method: "DELETE" }),
      fakeEnv,
    )
    expect(res.status).toBe(404)
  })
})

describe("Role guard", () => {
  it("teacher role → 200 on GET", async () => {
    mockDb({ role: "teacher" })
    mockListApiKeys.mockResolvedValueOnce([])
    const app = buildApp()
    const res = await app.fetch(new Request("http://localhost/api-keys"), fakeEnv)
    expect(res.status).toBe(200)
  })

  it("non-teacher role → 403", async () => {
    mockDb({ role: "student" })
    const app = buildApp()
    const res = await app.fetch(new Request("http://localhost/api-keys"), fakeEnv)
    expect(res.status).toBe(403)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toContain("Teacher role required")
  })
})
