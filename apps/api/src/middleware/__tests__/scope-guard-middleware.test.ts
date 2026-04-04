import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"
import { scopeGuard } from "../scope-guard-middleware.js"

type Variables = { userId: string; authType: "session" | "api_key"; scopes: string[] }

function buildApp(authType: "session" | "api_key", scopes: string[], requiredScope: string) {
  const app = new Hono<{ Variables: Variables }>()

  // Pre-middleware: inject auth context manually
  app.use("/*", async (c, next) => {
    c.set("userId", "user_test")
    c.set("authType", authType)
    c.set("scopes", scopes)
    await next()
  })

  app.get("/protected", scopeGuard(requiredScope), (c) => c.json({ ok: true }))
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("scopeGuard", () => {
  it("authType=session bypasses scope check → 200", async () => {
    const app = buildApp("session", [], "ai:questions:write")
    const res = await app.request("/protected")
    expect(res.status).toBe(200)
  })

  it("authType=api_key with matching scope → 200", async () => {
    const app = buildApp("api_key", ["ai:questions:write"], "ai:questions:write")
    const res = await app.request("/protected")
    expect(res.status).toBe(200)
  })

  it("authType=api_key without matching scope → 403", async () => {
    const app = buildApp("api_key", ["ai:questions:read"], "ai:questions:write")
    const res = await app.request("/protected")
    expect(res.status).toBe(403)
  })

  it("authType=api_key with empty scopes → 403", async () => {
    const app = buildApp("api_key", [], "ai:questions:write")
    const res = await app.request("/protected")
    expect(res.status).toBe(403)
  })

  it("authType=api_key with multiple scopes including required → 200", async () => {
    const app = buildApp("api_key", ["ai:questions:read", "ai:questions:write", "admin"], "ai:questions:write")
    const res = await app.request("/protected")
    expect(res.status).toBe(200)
  })

  it("403 response body contains 'Insufficient scope'", async () => {
    const app = buildApp("api_key", ["other:scope"], "ai:questions:write")
    const res = await app.request("/protected")
    expect(res.status).toBe(403)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toContain("Insufficient scope")
  })
})
