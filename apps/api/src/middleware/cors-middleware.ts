import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../env.js";

/**
 * CORS middleware factory — reads allowed origin from Cloudflare env binding.
 * Must be called as a factory so the env is available at request time.
 */
export const corsMiddleware = (): MiddlewareHandler<Env> =>
  async (c, next) => {
    const origin = c.env.CORS_ORIGIN ?? "http://localhost:5173";
    return cors({
      origin,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type"],
      maxAge: 86400,
    })(c, next);
  };
