import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, inArray, sql } from "drizzle-orm";
import { questions, questionTags, tags } from "../db/schema.js";
import type { Env } from "../env.js";
import {
  createQuestionSchema,
  updateQuestionSchema,
  bulkQuestionSchema,
  questionFilterSchema,
} from "@teaching/shared";
import {
  fetchTagsForQuestions,
  buildQuestionFilters,
  insertQuestionTags,
  createQuestion,
  updateQuestion,
  safeParseOptions,
} from "../services/question-service.js";

type Variables = { userId: string };
const questionsRoute = new Hono<Env & { Variables: Variables }>();

// GET / — list questions with filters and cursor pagination
questionsRoute.get("/", async (c) => {
  const teacherId = c.get("userId");
  const rawQuery = c.req.query();
  const parsed = questionFilterSchema.safeParse(rawQuery);

  if (!parsed.success) {
    return c.json({ error: "Invalid query params", details: parsed.error.flatten() }, 400);
  }

  const filters = parsed.data;
  const limit = filters.limit;
  const db = drizzle(c.env.DB);
  const conditions = buildQuestionFilters(teacherId, filters);

  // If filtering by tags, use a subquery via EXISTS
  let rows;
  if (filters.tagIds) {
    const tagIdList = filters.tagIds.split(",").filter(Boolean);
    if (tagIdList.length > 0) {
      conditions.push(
        sql`${questions.id} IN (
          SELECT question_id FROM question_tags WHERE tag_id IN (${sql.join(tagIdList.map((t) => sql`${t}`), sql`, `)})
        )`,
      );
    }
  }

  rows = await db
    .select()
    .from(questions)
    .where(and(...conditions))
    .orderBy(questions.id)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const questionIds = items.map((q) => q.id);
  const tagsMap = await fetchTagsForQuestions(db, questionIds);

  return c.json({
    items: items.map((q) => ({
      ...q,
      options: safeParseOptions(q.options),
      tags: tagsMap[q.id] ?? [],
    })),
    nextCursor,
  });
});

// GET /:id — single question with tags
questionsRoute.get("/:id", async (c) => {
  const teacherId = c.get("userId");
  const questionId = c.req.param("id");
  const db = drizzle(c.env.DB);

  const [question] = await db
    .select()
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.teacherId, teacherId)))
    .limit(1);

  if (!question) return c.json({ error: "Question not found" }, 404);

  const tagsMap = await fetchTagsForQuestions(db, [questionId]);
  return c.json({ ...question, options: safeParseOptions(question.options), tags: tagsMap[questionId] ?? [] });
});

// POST / — create question
questionsRoute.post("/", async (c) => {
  const teacherId = c.get("userId");
  const body = await c.req.json();
  const parsed = createQuestionSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const db = drizzle(c.env.DB);
  try {
    const question = await createQuestion(db, teacherId, parsed.data);
    return c.json(question, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to create question" }, 400);
  }
});

// PUT /:id — update question
questionsRoute.put("/:id", async (c) => {
  const teacherId = c.get("userId");
  const questionId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateQuestionSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const db = drizzle(c.env.DB);
  const [existing] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.teacherId, teacherId)))
    .limit(1);

  if (!existing) return c.json({ error: "Question not found" }, 404);

  try {
    const question = await updateQuestion(db, questionId, teacherId, parsed.data);
    return c.json(question);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to update question" }, 400);
  }
});

// DELETE /:id — delete question
questionsRoute.delete("/:id", async (c) => {
  const teacherId = c.get("userId");
  const questionId = c.req.param("id");
  const db = drizzle(c.env.DB);

  const [existing] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.teacherId, teacherId)))
    .limit(1);

  if (!existing) return c.json({ error: "Question not found" }, 404);

  await db.batch([
    db.delete(questionTags).where(eq(questionTags.questionId, questionId)),
    db.delete(questions).where(eq(questions.id, questionId)),
  ]);

  return c.json({ deleted: true });
});

// POST /bulk — bulk delete or retag
questionsRoute.post("/bulk", async (c) => {
  const teacherId = c.get("userId");
  const body = await c.req.json();
  const parsed = bulkQuestionSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const { action, questionIds, tagIds } = parsed.data;
  const db = drizzle(c.env.DB);

  // Verify all questions belong to teacher
  const owned = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(inArray(questions.id, questionIds), eq(questions.teacherId, teacherId)));

  if (owned.length !== questionIds.length) {
    return c.json({ error: "One or more questions not found or not owned by teacher" }, 403);
  }

  if (action === "delete") {
    await db.batch([
      db.delete(questionTags).where(inArray(questionTags.questionId, questionIds)),
      db.delete(questions).where(inArray(questions.id, questionIds)),
    ]);
    return c.json({ affected: questionIds.length });
  }

  // action === "retag"
  if (!tagIds || tagIds.length === 0) {
    return c.json({ error: "tagIds required for retag action" }, 400);
  }

  // Verify tags belong to teacher
  const ownedTags = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(inArray(tags.id, tagIds), eq(tags.teacherId, teacherId)));

  if (ownedTags.length !== tagIds.length) {
    return c.json({ error: "One or more tags not found or not owned by teacher" }, 403);
  }

  const newRows = questionIds.flatMap((questionId) =>
    tagIds.map((tagId) => ({ questionId, tagId })),
  );

  await db.batch([
    db.delete(questionTags).where(inArray(questionTags.questionId, questionIds)),
    db.insert(questionTags).values(newRows),
  ]);

  return c.json({ affected: questionIds.length });
});

export { questionsRoute };
