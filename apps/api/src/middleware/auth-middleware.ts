import { verifyToken } from "@clerk/backend";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../env.js";
import { verifyApiKey } from "../services/clerk-api-key-service.js";

// Auth context variables set by middleware
type AuthType = "session" | "api_key";
type Variables = { userId: string; authType: AuthType; scopes: string[] };

/**
 * Dual auth middleware: tries Clerk JWT first, falls back to Clerk API Key.
 * Both paths set userId on context for downstream handlers.
 * Returns 401 JSON on missing or invalid token.
 */
export const authMiddleware: MiddlewareHandler<Env & { Variables: Variables }> =
  async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Missing or malformed Authorization header" }, 401);
    }

    const token = authHeader.slice(7);

    // Try 1: Clerk JWT verification (existing flow)
    try {
      const payload = await verifyToken(token, {
        secretKey: c.env.CLERK_SECRET_KEY,
      });

      if (payload?.sub) {
        c.set("userId", payload.sub);
        c.set("authType", "session");
        c.set("scopes", []);
        await next();
        return;
      }
    } catch {
      // Not a valid JWT — fall through to API key verification
    }

    // Try 2: Clerk API Key verification (for third-party AI tools)
    try {
      const apiKey = await verifyApiKey(token, c.env.CLERK_SECRET_KEY);

      if (!apiKey.subject) {
        return c.json({ error: "API key has no associated user" }, 401);
      }

      c.set("userId", apiKey.subject);
      c.set("authType", "api_key");
      c.set("scopes", apiKey.scopes ?? []);
      await next();
    } catch {
      return c.json({ error: "Invalid token or API key" }, 401);
    }
  };
