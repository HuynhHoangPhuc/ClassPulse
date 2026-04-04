import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(),
}))

vi.mock("../../services/clerk-api-key-service.js", () => ({
  verifyApiKey: vi.fn(),
}))

import { verifyToken } from "@clerk/backend"
import { verifyApiKey } from "../../services/clerk-api-key-service.js"
import { authMiddleware } from "../auth-middleware.js"

const mockVerifyToken = vi.mocked(verifyToken)
const mockVerifyApiKey = vi.mocked(verifyApiKey)

function buildApp() {
  const app = new Hono<{ Bindings: { CLERK_SECRET_KEY: string }; Variables: { userId: string; authType: string; scopes: string[] } }>()
  app.use("/*", authMiddleware)
  app.get("/me", (c) =>
    c.json({ userId: c.get("userId"), authType: c.get("authType"), scopes: c.get("scopes") }),
  )
  return app
}

function makeRequest(token?: string) {
  const headers: Record<string, string> = {}
  if (token !== undefined) headers["Authorization"] = token
  return new Request("http://localhost/me", { headers })
}

const fakeEnv = { CLERK_SECRET_KEY: "sk_test_fake" }

beforeEach(() => {
  vi.clearAllMocks()
})

describe("authMiddleware", () => {
  it("valid JWT → 200 with userId, authType=session, scopes=[]", async () => {
    mockVerifyToken.mockResolvedValueOnce({ sub: "user_jwt_123" } as never)
    const app = buildApp()
    const res = await app.fetch(makeRequest("Bearer valid.jwt.token"), fakeEnv)
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.userId).toBe("user_jwt_123")
    expect(body.authType).toBe("session")
    expect(body.scopes).toEqual([])
  })

  it("invalid JWT + valid API key → 200 with userId from apiKey, authType=api_key, scopes from key", async () => {
    mockVerifyToken.mockRejectedValueOnce(new Error("invalid token"))
    mockVerifyApiKey.mockResolvedValueOnce({
      id: "key_1",
      subject: "user_apikey_456",
      scopes: ["ai:questions:write"],
    } as never)
    const app = buildApp()
    const res = await app.fetch(makeRequest("Bearer sk_live_apikey"), fakeEnv)
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.userId).toBe("user_apikey_456")
    expect(body.authType).toBe("api_key")
    expect(body.scopes).toEqual(["ai:questions:write"])
  })

  it("invalid JWT + invalid API key → 401", async () => {
    mockVerifyToken.mockRejectedValueOnce(new Error("bad jwt"))
    mockVerifyApiKey.mockRejectedValueOnce(new Error("bad key"))
    const app = buildApp()
    const res = await app.fetch(makeRequest("Bearer garbage"), fakeEnv)
    expect(res.status).toBe(401)
  })

  it("missing Authorization header → 401", async () => {
    const app = buildApp()
    const res = await app.fetch(makeRequest(undefined), fakeEnv)
    expect(res.status).toBe(401)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toContain("Missing or malformed")
  })

  it("malformed Authorization header (no Bearer prefix) → 401", async () => {
    const app = buildApp()
    const res = await app.fetch(makeRequest("Token abc123"), fakeEnv)
    expect(res.status).toBe(401)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toContain("Missing or malformed")
  })

  it("JWT with no sub → falls through to API key verification", async () => {
    // verifyToken succeeds but returns no sub — should fall through
    mockVerifyToken.mockResolvedValueOnce({ sub: undefined } as never)
    mockVerifyApiKey.mockResolvedValueOnce({
      id: "key_2",
      subject: "user_fallback",
      scopes: [],
    } as never)
    const app = buildApp()
    const res = await app.fetch(makeRequest("Bearer ambiguous.token"), fakeEnv)
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.authType).toBe("api_key")
    expect(body.userId).toBe("user_fallback")
  })

  it("API key with no subject → 401", async () => {
    mockVerifyToken.mockRejectedValueOnce(new Error("bad jwt"))
    mockVerifyApiKey.mockResolvedValueOnce({ id: "key_3", subject: null, scopes: [] } as never)
    const app = buildApp()
    const res = await app.fetch(makeRequest("Bearer sk_live_nosubject"), fakeEnv)
    expect(res.status).toBe(401)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toContain("no associated user")
  })

  it("valid JWT takes priority — verifyApiKey never called", async () => {
    mockVerifyToken.mockResolvedValueOnce({ sub: "user_jwt_priority" } as never)
    const app = buildApp()
    const res = await app.fetch(makeRequest("Bearer valid.priority.jwt"), fakeEnv)
    expect(res.status).toBe(200)
    expect(mockVerifyApiKey).not.toHaveBeenCalled()
  })
})
