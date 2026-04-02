import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { comments, posts } from "../db/schema.js";
import type { Env } from "../env.js";
import { createCommentSchema, updateCommentSchema } from "@teaching/shared";
import { isClassroomTeacher, isClassroomMember } from "../services/classroom-service.js";
import {
  listComments,
  createComment,
  updateComment,
  deleteComment,
  searchClassroomMembers,
} from "../services/comment-service.js";
import { notifyClassroom } from "../services/realtime-service.js";

type Variables = { userId: string };
const commentRoutes = new Hono<Env & { Variables: Variables }>();

// GET /posts/:postId/comments — list threaded comments
commentRoutes.get("/posts/:postId/comments", async (c) => {
  const userId = c.get("userId");
  const postId = c.req.param("postId");
  const db = drizzle(c.env.DB);

  // Verify post exists and user is classroom member
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) return c.json({ error: "Post not found" }, 404);

  if (!(await isClassroomMember(db, post.classroomId, userId))) {
    return c.json({ error: "Not a member of this classroom" }, 403);
  }

  const items = await listComments(db, postId);
  return c.json({ items });
});

// POST /posts/:postId/comments — create comment
commentRoutes.post("/posts/:postId/comments", async (c) => {
  const userId = c.get("userId");
  const postId = c.req.param("postId");
  const body = await c.req.json();
  const parsed = createCommentSchema.safeParse({ ...body, postId });
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const db = drizzle(c.env.DB);

  // Verify post exists and user is classroom member
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) return c.json({ error: "Post not found" }, 404);

  if (!(await isClassroomMember(db, post.classroomId, userId))) {
    return c.json({ error: "Not a member of this classroom" }, 403);
  }

  // Validate parent comment belongs to same post
  if (parsed.data.parentCommentId) {
    const [parent] = await db
      .select()
      .from(comments)
      .where(and(eq(comments.id, parsed.data.parentCommentId), eq(comments.postId, postId)))
      .limit(1);
    if (!parent) return c.json({ error: "Parent comment not found" }, 404);
  }

  const commentId = await createComment(
    db,
    postId,
    userId,
    parsed.data.content,
    parsed.data.parentCommentId ?? null,
    parsed.data.mentionUserIds ?? [],
  );

  // Broadcast real-time notification to classroom (use underscore types matching DB)
  await notifyClassroom(c.env, post.classroomId, {
    type: parsed.data.parentCommentId ? "comment_reply" : "mention",
    data: { commentId, postId, authorId: userId },
    senderId: userId,
  });

  return c.json({ id: commentId }, 201);
});

// PUT /comments/:id — edit comment (author only)
commentRoutes.put("/comments/:id", async (c) => {
  const userId = c.get("userId");
  const commentId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateCommentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const db = drizzle(c.env.DB);

  const [existing] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
  if (!existing) return c.json({ error: "Comment not found" }, 404);

  // Verify user is still a classroom member
  const [post] = await db.select().from(posts).where(eq(posts.id, existing.postId)).limit(1);
  if (!post) return c.json({ error: "Post not found" }, 404);
  if (!(await isClassroomMember(db, post.classroomId, userId))) {
    return c.json({ error: "Not a member of this classroom" }, 403);
  }

  if (existing.authorId !== userId) {
    return c.json({ error: "Only the author can edit this comment" }, 403);
  }

  await updateComment(db, commentId, parsed.data.content, parsed.data.mentionUserIds ?? []);
  return c.json({ updated: true });
});

// DELETE /comments/:id — delete comment (author or classroom teacher)
commentRoutes.delete("/comments/:id", async (c) => {
  const userId = c.get("userId");
  const commentId = c.req.param("id");
  const db = drizzle(c.env.DB);

  const [existing] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
  if (!existing) return c.json({ error: "Comment not found" }, 404);

  // Get post to find classroom and verify membership
  const [post] = await db.select().from(posts).where(eq(posts.id, existing.postId)).limit(1);
  if (!post) return c.json({ error: "Post not found" }, 404);
  if (!(await isClassroomMember(db, post.classroomId, userId))) {
    return c.json({ error: "Not a member of this classroom" }, 403);
  }

  const isTeacher = await isClassroomTeacher(db, post.classroomId, userId);
  if (existing.authorId !== userId && !isTeacher) {
    return c.json({ error: "Not authorized to delete this comment" }, 403);
  }

  await deleteComment(db, commentId);
  return c.json({ deleted: true });
});

// GET /classrooms/:id/members/search — search members for @mention autocomplete
commentRoutes.get("/classrooms/:id/members/search", async (c) => {
  const userId = c.get("userId");
  const classroomId = c.req.param("id");
  const query = c.req.query("q") ?? "";
  const db = drizzle(c.env.DB);

  if (!(await isClassroomMember(db, classroomId, userId))) {
    return c.json({ error: "Not a member of this classroom" }, 403);
  }

  const members = await searchClassroomMembers(db, classroomId, query);
  return c.json({ items: members });
});

export { commentRoutes };
