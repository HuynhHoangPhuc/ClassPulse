import { verifyToken } from "@clerk/backend";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../env.js";

// Extend Hono context variables with authenticated userId
type Variables = { userId: string };

/**
 * Clerk JWT verification middleware.
 * Extracts Bearer token, verifies with Clerk, sets userId on context.
 * Returns 401 JSON on missing or invalid token.
 */
export const authMiddleware: MiddlewareHandler<Env & { Variables: Variables }> =
  async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Missing or malformed Authorization header" }, 401);
    }

    const token = authHeader.slice(7);

    try {
      const payload = await verifyToken(token, {
        secretKey: c.env.CLERK_SECRET_KEY,
      });

      if (!payload?.sub) {
        return c.json({ error: "Invalid token payload" }, 401);
      }

      c.set("userId", payload.sub);
      await next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Token verification failed";
      return c.json({ error: message }, 401);
    }
  };
