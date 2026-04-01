import { Hono } from "hono";
import type { Env } from "./env.js";
import { corsMiddleware } from "./middleware/cors-middleware.js";
import { authMiddleware } from "./middleware/auth-middleware.js";
import { errorMiddleware } from "./middleware/error-middleware.js";
import { usersRoute, clerkWebhookRoute } from "./routes/users-route.js";

type Variables = { userId: string };

const app = new Hono<Env & { Variables: Variables }>();

// ── Global error handler (must be registered first) ────────────────────────────
app.onError(errorMiddleware);

// ── CORS (applied to all routes) ───────────────────────────────────────────────
app.use("*", corsMiddleware());

// ── Public routes (no auth required) ──────────────────────────────────────────
app.route("/webhook/clerk", clerkWebhookRoute);

// ── Auth guard for all /api/* routes ──────────────────────────────────────────
app.use("/api/*", authMiddleware);

// ── Protected API routes ───────────────────────────────────────────────────────
const routes = app.route("/api/users", usersRoute);

// ── Health check ───────────────────────────────────────────────────────────────
app.get("/health", (c) => c.json({ status: "ok" }));

// Export app type for Hono RPC client type inference in the web app
export type AppType = typeof routes;
export default app;
