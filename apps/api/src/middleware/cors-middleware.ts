import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../env.js";

/**
 * CORS middleware factory — reads allowed origins from Cloudflare env binding.
 * CORS_ORIGIN supports comma-separated origins (e.g. "https://app.com,http://localhost:5173").
 * Falls back to localhost for local dev when unset.
 */
export const corsMiddleware = (): MiddlewareHandler<Env> =>
  async (c, next) => {
    const raw = c.env.CORS_ORIGIN ?? "http://localhost:5173";
    const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);

    return cors({
      origin: allowed.length === 1 ? allowed[0] : allowed,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type"],
      maxAge: 86400,
    })(c, next);
  };
