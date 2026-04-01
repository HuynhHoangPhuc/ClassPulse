import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { Env } from "../env.js";

/**
 * Global error handler for the Hono app.
 * - ZodError → 400 with field-level validation messages
 * - HTTPException (hono) → use its status
 * - Everything else → 500
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const errorMiddleware: ErrorHandler<any> = (err, c) => {
  console.error("[error]", err);

  if (err instanceof ZodError) {
    return c.json(
      {
        error: "Validation error",
        issues: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      400,
    );
  }

  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }

  return c.json({ error: "Internal server error" }, 500);
};
