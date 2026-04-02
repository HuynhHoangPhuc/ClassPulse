import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql, desc } from "drizzle-orm";
import { notifications } from "../db/schema.js";
import type { Env } from "../env.js";

type Variables = { userId: string };
const notificationRoutes = new Hono<Env & { Variables: Variables }>();

// GET /notifications — paginated list for current user
notificationRoutes.get("/notifications", async (c) => {
  const userId = c.get("userId");
  const cursor = c.req.query("cursor");
  const limit = Math.min(Number(c.req.query("limit")) || 20, 50);
  const db = drizzle(c.env.DB);

  const conditions = [eq(notifications.userId, userId)];
  if (cursor) {
    conditions.push(sql`${notifications.createdAt} < ${Number(cursor)}`);
  }

  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(items[items.length - 1].createdAt) : null;

  return c.json({ items, nextCursor });
});

// GET /notifications/unread-count — count of unread notifications
notificationRoutes.get("/notifications/unread-count", async (c) => {
  const userId = c.get("userId");
  const db = drizzle(c.env.DB);

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)));

  return c.json({ count: row?.count ?? 0 });
});

// PUT /notifications/read-all — mark all as read
notificationRoutes.put("/notifications/read-all", async (c) => {
  const userId = c.get("userId");
  const db = drizzle(c.env.DB);

  await db
    .update(notifications)
    .set({ isRead: 1 })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)));

  return c.json({ updated: true });
});

// PUT /notifications/:id/read — mark single as read
notificationRoutes.put("/notifications/:id/read", async (c) => {
  const userId = c.get("userId");
  const notifId = c.req.param("id");
  const db = drizzle(c.env.DB);

  const [existing] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, notifId), eq(notifications.userId, userId)))
    .limit(1);

  if (!existing) return c.json({ error: "Notification not found" }, 404);

  await db.update(notifications).set({ isRead: 1 }).where(eq(notifications.id, notifId));
  return c.json({ updated: true });
});

export { notificationRoutes };
