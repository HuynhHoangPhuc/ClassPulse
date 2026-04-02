import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import { posts, users, assessments } from "../db/schema.js";
import type { Env } from "../env.js";
import { createPostSchema, updatePostSchema, classroomFeedFilterSchema } from "@teaching/shared";
import { isClassroomTeacher, isClassroomMember } from "../services/classroom-service.js";
import { generateId } from "../lib/id-generator.js";
import { attemptFilterSchema } from "@teaching/shared";
import { listSubmissions } from "../services/attempt-query-service.js";

type Variables = { userId: string };
const classroomPostRoutes = new Hono<Env & { Variables: Variables }>();

// GET /:id/feed — paginated post feed
classroomPostRoutes.get("/:id/feed", async (c) => {
  const userId = c.get("userId");
  const classroomId = c.req.param("id");
  const parsed = classroomFeedFilterSchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "Invalid query params", details: parsed.error.flatten() }, 400);
  }
  const db = drizzle(c.env.DB);

  if (!(await isClassroomMember(db, classroomId, userId))) {
    return c.json({ error: "Not a member of this classroom" }, 403);
  }

  const { cursor, limit } = parsed.data;
  const conditions = [eq(posts.classroomId, classroomId)];
  if (cursor) {
    conditions.push(sql`${posts.createdAt} < ${Number(cursor)}`);
  }

  const rows = await db
    .select({
      id: posts.id,
      classroomId: posts.classroomId,
      authorId: posts.authorId,
      type: posts.type,
      title: posts.title,
      content: posts.content,
      assessmentId: posts.assessmentId,
      dueDate: posts.dueDate,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
      authorRole: users.role,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(and(...conditions))
    .orderBy(sql`${posts.createdAt} DESC`)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(items[items.length - 1].createdAt) : null;

  // Batch fetch assessment info for assignment posts (avoids N+1)
  const assessmentIds = [...new Set(
    items.filter((p) => p.type === "assessment_assignment" && p.assessmentId).map((p) => p.assessmentId!)
  )];

  const assessmentMap: Record<string, { title: string; timeLimitMinutes: number | null }> = {};
  if (assessmentIds.length > 0) {
    const rows = await db
      .select({ id: assessments.id, title: assessments.title, timeLimitMinutes: assessments.timeLimitMinutes })
      .from(assessments)
      .where(sql`${assessments.id} IN (${sql.join(assessmentIds.map((aid) => sql`${aid}`), sql`, `)})`);
    for (const row of rows) assessmentMap[row.id] = { title: row.title, timeLimitMinutes: row.timeLimitMinutes };
  }

  const enriched = items.map((post) => ({
    ...post,
    assessment: (post.type === "assessment_assignment" && post.assessmentId)
      ? assessmentMap[post.assessmentId] ?? null
      : null,
  }));

  return c.json({ items: enriched, nextCursor });
});

// POST /:id/posts — create post (teacher only)
classroomPostRoutes.post("/:id/posts", async (c) => {
  const userId = c.get("userId");
  const classroomId = c.req.param("id");
  const body = await c.req.json();
  const parsed = createPostSchema.safeParse({ ...body, classroomId });
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const db = drizzle(c.env.DB);

  if (!(await isClassroomTeacher(db, classroomId, userId))) {
    return c.json({ error: "Only teachers can create posts" }, 403);
  }

  const now = Date.now();
  const id = generateId();

  await db.insert(posts).values({
    id,
    classroomId,
    authorId: userId,
    type: parsed.data.type,
    title: parsed.data.title,
    content: parsed.data.content ?? null,
    assessmentId: parsed.data.assessmentId ?? null,
    dueDate: parsed.data.dueDate ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return c.json(post, 201);
});

// PUT /:id/posts/:postId — update post (author or teacher)
classroomPostRoutes.put("/:id/posts/:postId", async (c) => {
  const userId = c.get("userId");
  const classroomId = c.req.param("id");
  const postId = c.req.param("postId");
  const body = await c.req.json();
  const parsed = updatePostSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const db = drizzle(c.env.DB);

  const [existing] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.classroomId, classroomId)))
    .limit(1);

  if (!existing) return c.json({ error: "Post not found" }, 404);

  // Only author or classroom teacher can update
  const isTeacher = await isClassroomTeacher(db, classroomId, userId);
  if (existing.authorId !== userId && !isTeacher) {
    return c.json({ error: "Not authorized to update this post" }, 403);
  }

  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.content !== undefined) updates.content = parsed.data.content ?? null;
  if (parsed.data.dueDate !== undefined) updates.dueDate = parsed.data.dueDate ?? null;

  await db.update(posts).set(updates).where(eq(posts.id, postId));
  const [updated] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  return c.json(updated);
});

// DELETE /:id/posts/:postId — delete post (author or teacher)
classroomPostRoutes.delete("/:id/posts/:postId", async (c) => {
  const userId = c.get("userId");
  const classroomId = c.req.param("id");
  const postId = c.req.param("postId");
  const db = drizzle(c.env.DB);

  const [existing] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.classroomId, classroomId)))
    .limit(1);

  if (!existing) return c.json({ error: "Post not found" }, 404);

  const isTeacher = await isClassroomTeacher(db, classroomId, userId);
  if (existing.authorId !== userId && !isTeacher) {
    return c.json({ error: "Not authorized to delete this post" }, 403);
  }

  await db.delete(posts).where(eq(posts.id, postId));
  return c.json({ deleted: true });
});

// GET /:id/assessments/:assessmentId/submissions — teacher: list submissions
classroomPostRoutes.get("/:id/assessments/:assessmentId/submissions", async (c) => {
  const userId = c.get("userId");
  const classroomId = c.req.param("id");
  const assessmentId = c.req.param("assessmentId");
  const db = drizzle(c.env.DB);

  const isTeacher = await isClassroomTeacher(db, classroomId, userId);
  if (!isTeacher) return c.json({ error: "Forbidden" }, 403);

  const parsed = attemptFilterSchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "Invalid query", details: parsed.error.flatten() }, 400);
  }

  const result = await listSubmissions(db, classroomId, assessmentId, parsed.data);
  return c.json(result);
});

export { classroomPostRoutes };
