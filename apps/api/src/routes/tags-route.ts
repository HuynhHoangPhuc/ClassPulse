import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { tags, questionTags } from "../db/schema.js";
import type { Env } from "../env.js";
import { generateId } from "../lib/id-generator.js";
import { createTagSchema, updateTagSchema } from "@teaching/shared";

type Variables = { userId: string };

const tagsRoute = new Hono<Env & { Variables: Variables }>();

// GET / — list all tags belonging to the authenticated teacher
tagsRoute.get("/", async (c) => {
  const teacherId = c.get("userId");
  const db = drizzle(c.env.DB);

  const result = await db
    .select()
    .from(tags)
    .where(eq(tags.teacherId, teacherId))
    .orderBy(tags.name);

  return c.json(result);
});

// POST / — create a new tag
tagsRoute.post("/", async (c) => {
  const teacherId = c.get("userId");
  const body = await c.req.json();
  const parsed = createTagSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const { name, color } = parsed.data;
  const db = drizzle(c.env.DB);
  const now = Date.now();
  const id = generateId();

  await db.insert(tags).values({ id, name, teacherId, color: color ?? null, createdAt: now });

  const [created] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  return c.json(created, 201);
});

// PUT /:id — update an existing tag
tagsRoute.put("/:id", async (c) => {
  const teacherId = c.get("userId");
  const tagId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateTagSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const db = drizzle(c.env.DB);

  const [existing] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.teacherId, teacherId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Tag not found" }, 404);
  }

  const updates: Partial<typeof existing> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color ?? null;

  await db.update(tags).set(updates).where(eq(tags.id, tagId));

  const [updated] = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1);
  return c.json(updated);
});

// DELETE /:id — delete tag and its question associations
tagsRoute.delete("/:id", async (c) => {
  const teacherId = c.get("userId");
  const tagId = c.req.param("id");
  const db = drizzle(c.env.DB);

  const [existing] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.teacherId, teacherId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Tag not found" }, 404);
  }

  // Use batch to atomically delete question_tags then tag
  await db.batch([
    db.delete(questionTags).where(eq(questionTags.tagId, tagId)),
    db.delete(tags).where(eq(tags.id, tagId)),
  ]);

  return c.json({ deleted: true });
});

export { tagsRoute };
