import { Hono } from "hono";
import type { Env } from "./env.js";
import { corsMiddleware } from "./middleware/cors-middleware.js";
import { authMiddleware } from "./middleware/auth-middleware.js";
import { errorMiddleware } from "./middleware/error-middleware.js";
import { usersRoute, clerkWebhookRoute } from "./routes/users-route.js";
import { tagsRoute } from "./routes/tags-route.js";
import { questionsRoute } from "./routes/questions-route.js";
import { uploadRoute } from "./routes/upload-route.js";
import { assessmentRoutes } from "./routes/assessment-routes.js";
import { classroomRoutes } from "./routes/classroom-routes.js";
import { classroomMemberRoutes } from "./routes/classroom-member-routes.js";
import { classroomPostRoutes } from "./routes/classroom-post-routes.js";
import { attemptRoutes } from "./routes/attempt-routes.js";
import { commentRoutes } from "./routes/comment-routes.js";

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
const routes = app
  .route("/api/users", usersRoute)
  .route("/api/tags", tagsRoute)
  .route("/api/questions", questionsRoute)
  .route("/api/upload/image", uploadRoute)
  .route("/api/assessments", assessmentRoutes)
  .route("/api/classrooms", classroomRoutes)
  .route("/api/classrooms", classroomMemberRoutes)
  .route("/api/classrooms", classroomPostRoutes)
  .route("/api/attempts", attemptRoutes)
  .route("/api", commentRoutes);

// ── Health check ───────────────────────────────────────────────────────────────
app.get("/health", (c) => c.json({ status: "ok" }));

// Export app type for Hono RPC client type inference in the web app
export type AppType = typeof routes;
export default app;
