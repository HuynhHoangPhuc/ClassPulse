import { Hono } from "hono";
import { verifyToken } from "@clerk/backend";
import type { Env } from "../env.js";
import { drizzle } from "drizzle-orm/d1";
import { isClassroomMember } from "../services/classroom-service.js";

const websocketRoutes = new Hono<Env>();

/**
 * GET /ws/classroom/:classroomId?token=<jwt> — WebSocket upgrade to classroom DO.
 * Auth via query param because browsers can't send headers on WebSocket().
 * Registered OUTSIDE /api/* so it bypasses the Bearer auth middleware.
 */
websocketRoutes.get("/ws/classroom/:classroomId", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader?.toLowerCase() !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade" }, 426);
  }

  // Verify JWT from query param (browsers can't send Authorization header on WS)
  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: "Missing token query param" }, 401);
  }

  let userId: string;
  try {
    const payload = await verifyToken(token, { secretKey: c.env.CLERK_SECRET_KEY });
    if (!payload?.sub) return c.json({ error: "Invalid token" }, 401);
    userId = payload.sub;
  } catch {
    return c.json({ error: "Token verification failed" }, 401);
  }

  const classroomId = c.req.param("classroomId");
  const db = drizzle(c.env.DB);

  // Verify user is classroom member before allowing WS connection
  if (!(await isClassroomMember(db, classroomId, userId))) {
    return c.json({ error: "Not a member of this classroom" }, 403);
  }

  // Get DO stub for this classroom and forward the upgrade request
  const id = c.env.NOTIFICATION_HUB.idFromName(classroomId);
  const stub = c.env.NOTIFICATION_HUB.get(id);

  const url = new URL(c.req.url);
  url.pathname = "/ws";
  url.searchParams.set("userId", userId);

  return stub.fetch(new Request(url.toString(), {
    headers: c.req.raw.headers,
  }));
});

export { websocketRoutes };
