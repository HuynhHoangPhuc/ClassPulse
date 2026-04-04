import { Hono } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import type { Env } from "../env.js"
import { users } from "../db/schema.js"
import { createApiKeySchema } from "@teaching/shared"
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "../services/clerk-api-key-service.js"

type Variables = { userId: string }
const apiKeyRoutes = new Hono<Env & { Variables: Variables }>()

/** Middleware: only teachers can manage API keys */
apiKeyRoutes.use("/*", async (c, next) => {
  const userId = c.get("userId")
  const db = drizzle(c.env.DB)
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!user || user.role !== "teacher") {
    return c.json({ error: "Teacher role required" }, 403)
  }
  await next()
})

// POST / — create a new API key for the authenticated user
apiKeyRoutes.post("/", async (c) => {
  const userId = c.get("userId")

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400)
  }

  const parsed = createApiKeySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400)
  }

  const { name, description, scopes, expiresInDays } = parsed.data

  try {
    const apiKey = await createApiKey(c.env.CLERK_SECRET_KEY, {
      name,
      subject: userId,
      description,
      scopes: scopes ?? ["ai:questions:write"],
      secondsUntilExpiration: expiresInDays ? expiresInDays * 86400 : undefined,
    })

    // Return secret — only time it's available
    return c.json({
      id: apiKey.id,
      name: apiKey.name,
      secret: apiKey.secret,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
    }, 201)
  } catch {
    return c.json({ error: "Failed to create API key" }, 500)
  }
})

// GET / — list API keys for the authenticated user (no secrets)
apiKeyRoutes.get("/", async (c) => {
  const userId = c.get("userId")

  try {
    const keys = await listApiKeys(c.env.CLERK_SECRET_KEY, userId)
    return c.json(keys.map((k) => ({
      id: k.id,
      name: k.name,
      scopes: k.scopes,
      revoked: k.revoked,
      expiration: k.expiration,
      createdAt: k.createdAt,
    })))
  } catch {
    return c.json({ error: "Failed to list API keys" }, 500)
  }
})

// DELETE /:id — revoke an API key (with ownership check)
apiKeyRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId")
  const apiKeyId = c.req.param("id")

  try {
    // Verify the key belongs to this user before revoking
    const userKeys = await listApiKeys(c.env.CLERK_SECRET_KEY, userId)
    const ownsKey = userKeys.some((k) => k.id === apiKeyId)
    if (!ownsKey) {
      return c.json({ error: "API key not found" }, 404)
    }

    await revokeApiKey(c.env.CLERK_SECRET_KEY, apiKeyId)
    return c.json({ revoked: true })
  } catch {
    return c.json({ error: "Failed to revoke API key" }, 500)
  }
})

export { apiKeyRoutes }
