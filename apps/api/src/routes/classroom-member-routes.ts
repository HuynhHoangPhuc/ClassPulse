import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import type { Env } from "../env.js";
import { addMemberSchema } from "@teaching/shared";
import { isClassroomTeacher, isClassroomMember } from "../services/classroom-service.js";
import { addMember, removeMember, listMembers } from "../services/classroom-member-service.js";

type Variables = { userId: string };
const classroomMemberRoutes = new Hono<Env & { Variables: Variables }>();

// GET /:id/members — list members
classroomMemberRoutes.get("/:id/members", async (c) => {
  const userId = c.get("userId");
  const classroomId = c.req.param("id");
  const db = drizzle(c.env.DB);

  if (!(await isClassroomMember(db, classroomId, userId))) {
    return c.json({ error: "Not a member of this classroom" }, 403);
  }

  const members = await listMembers(db, classroomId);
  return c.json({ items: members });
});

// POST /:id/members — add member (teacher only)
classroomMemberRoutes.post("/:id/members", async (c) => {
  const userId = c.get("userId");
  const classroomId = c.req.param("id");
  const body = await c.req.json();
  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const db = drizzle(c.env.DB);

  if (!(await isClassroomTeacher(db, classroomId, userId))) {
    return c.json({ error: "Only teachers can add members" }, 403);
  }

  const result = await addMember(db, classroomId, parsed.data.email, parsed.data.role);
  if ("error" in result) {
    return c.json({ error: result.error }, 400);
  }
  return c.json(result, 201);
});

// DELETE /:id/members/:userId — remove member (teacher only)
classroomMemberRoutes.delete("/:id/members/:userId", async (c) => {
  const currentUserId = c.get("userId");
  const classroomId = c.req.param("id");
  const targetUserId = c.req.param("userId");
  const db = drizzle(c.env.DB);

  if (!(await isClassroomTeacher(db, classroomId, currentUserId))) {
    return c.json({ error: "Only teachers can remove members" }, 403);
  }

  const result = await removeMember(db, classroomId, targetUserId);
  if ("error" in result) {
    return c.json({ error: result.error }, 400);
  }
  return c.json(result);
});

export { classroomMemberRoutes };
