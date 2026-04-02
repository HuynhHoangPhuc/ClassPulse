import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import type { Env } from "../env.js";
import { createClassroomSchema, updateClassroomSchema } from "@teaching/shared";
import {
  createClassroom,
  getClassroomById,
  listClassrooms,
  updateClassroom,
  deleteClassroom,
  regenerateInviteCode,
  isClassroomTeacher,
  isClassroomMember,
} from "../services/classroom-service.js";

type Variables = { userId: string };
const classroomRoutes = new Hono<Env & { Variables: Variables }>();

// GET / — list user's classrooms
classroomRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const db = drizzle(c.env.DB);
  const items = await listClassrooms(db, userId);
  return c.json({ items });
});

// POST / — create classroom (teacher only)
classroomRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = createClassroomSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const db = drizzle(c.env.DB);
  const classroom = await createClassroom(db, userId, parsed.data);
  return c.json(classroom, 201);
});

// GET /:id — classroom detail
classroomRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = drizzle(c.env.DB);

  // Must be a member — also fetch user's role for the response
  const isTeacher = await isClassroomTeacher(db, id, userId);
  const isMember = isTeacher || await isClassroomMember(db, id, userId);
  if (!isMember) {
    return c.json({ error: "Not a member of this classroom" }, 403);
  }

  const classroom = await getClassroomById(db, id);
  if (!classroom) return c.json({ error: "Classroom not found" }, 404);
  return c.json({ ...classroom, isTeacher });
});

// PUT /:id — update classroom (teacher only)
classroomRoutes.put("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateClassroomSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const db = drizzle(c.env.DB);

  if (!(await isClassroomTeacher(db, id, userId))) {
    return c.json({ error: "Only teachers can update classrooms" }, 403);
  }

  const classroom = await updateClassroom(db, id, parsed.data);
  return c.json(classroom);
});

// DELETE /:id — archive classroom (teacher only)
classroomRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = drizzle(c.env.DB);

  if (!(await isClassroomTeacher(db, id, userId))) {
    return c.json({ error: "Only teachers can delete classrooms" }, 403);
  }

  await deleteClassroom(db, id);
  return c.json({ deleted: true });
});

// POST /:id/regenerate-code — regenerate invite code (teacher only)
classroomRoutes.post("/:id/regenerate-code", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = drizzle(c.env.DB);

  if (!(await isClassroomTeacher(db, id, userId))) {
    return c.json({ error: "Only teachers can regenerate invite codes" }, 403);
  }

  const newCode = await regenerateInviteCode(db, id);
  return c.json({ inviteCode: newCode });
});

export { classroomRoutes };
