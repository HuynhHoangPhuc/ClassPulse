import type { MiddlewareHandler } from "hono"
import type { Env } from "../env.js"

type Variables = { userId: string; authType: "session" | "api_key"; scopes: string[] }

/**
 * Scope guard factory — returns middleware that checks API key scopes.
 * JWT sessions bypass scope checks entirely (they use role-based auth).
 * Returns 403 for API key tokens lacking the required scope.
 */
export function scopeGuard(
  requiredScope: string,
): MiddlewareHandler<Env & { Variables: Variables }> {
  return async (c, next) => {
    const authType = c.get("authType")

    // JWT sessions skip scope enforcement — use existing role system
    if (authType === "session") {
      await next()
      return
    }

    // API key tokens must have the required scope
    const scopes = c.get("scopes")
    if (!scopes.includes(requiredScope)) {
      return c.json({ error: "Insufficient scope" }, 403)
    }

    await next()
  }
}
