import { drizzle } from "drizzle-orm/d1";
import { eq, and, inArray, like, gte, lte, gt, sql } from "drizzle-orm";
import { questions, questionTags, tags } from "../db/schema.js";
import { generateId } from "../lib/id-generator.js";
import type { z } from "zod";
import type {
  createQuestionSchema,
  updateQuestionSchema,
  questionFilterSchema,
} from "@teaching/shared";

/** Safely parse JSON options, returning empty array on failure */
export function safeParseOptions(raw: string): unknown[] {
  try { return JSON.parse(raw); } catch { return []; }
}

type DB = ReturnType<typeof drizzle>;
type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
type FilterInput = z.infer<typeof questionFilterSchema>;

/** Fetch tags for a list of question IDs, returns map of questionId → tags */
export async function fetchTagsForQuestions(
  db: DB,
  questionIds: string[],
): Promise<Record<string, Array<{ id: string; name: string; color: string | null }>>> {
  if (questionIds.length === 0) return {};

  const rows = await db
    .select({
      questionId: questionTags.questionId,
      tagId: tags.id,
      tagName: tags.name,
      tagColor: tags.color,
    })
    .from(questionTags)
    .innerJoin(tags, eq(questionTags.tagId, tags.id))
    .where(inArray(questionTags.questionId, questionIds));

  const map: Record<string, Array<{ id: string; name: string; color: string | null }>> = {};
  for (const row of rows) {
    if (!map[row.questionId]) map[row.questionId] = [];
    map[row.questionId].push({ id: row.tagId, name: row.tagName, color: row.tagColor ?? null });
  }
  return map;
}

/** Build WHERE conditions array for question list filtering */
export function buildQuestionFilters(
  teacherId: string,
  filters: FilterInput,
) {
  const conditions = [sql`${questions.teacherId} = ${teacherId}`];

  if (filters.complexityMin !== undefined) {
    conditions.push(sql`${questions.complexity} >= ${filters.complexityMin}`);
  }
  if (filters.complexityMax !== undefined) {
    conditions.push(sql`${questions.complexity} <= ${filters.complexityMax}`);
  }
  if (filters.complexityType !== undefined) {
    conditions.push(sql`${questions.complexityType} = ${filters.complexityType}`);
  }
  if (filters.search) {
    conditions.push(sql`${questions.content} LIKE ${"%" + filters.search + "%"}`);
  }
  if (filters.cursor) {
    conditions.push(sql`${questions.id} > ${filters.cursor}`);
  }

  return conditions;
}

/** Insert questionTags rows after verifying all tags belong to teacher */
export async function insertQuestionTags(
  db: DB,
  questionId: string,
  tagIds: string[],
  teacherId: string,
): Promise<{ error: string } | null> {
  if (tagIds.length === 0) return null;

  const ownedTags = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(inArray(tags.id, tagIds), eq(tags.teacherId, teacherId)));

  if (ownedTags.length !== tagIds.length) {
    return { error: "One or more tags not found or not owned by teacher" };
  }

  await db.insert(questionTags).values(tagIds.map((tagId) => ({ questionId, tagId })));
  return null;
}

/** Create a question with optional tags, returns the created question with its tags */
export async function createQuestion(
  db: DB,
  teacherId: string,
  input: CreateQuestionInput,
) {
  const now = Date.now();
  const id = generateId();

  await db.insert(questions).values({
    id,
    teacherId,
    content: input.content,
    options: JSON.stringify(input.options),
    complexity: input.complexity,
    complexityType: input.complexityType,
    explanation: input.explanation ?? null,
    createdAt: now,
    updatedAt: now,
  });

  if (input.tagIds && input.tagIds.length > 0) {
    const err = await insertQuestionTags(db, id, input.tagIds, teacherId);
    if (err) throw new Error(err.error);
  }

  const [question] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  const tagsMap = await fetchTagsForQuestions(db, [id]);

  return {
    ...question,
    options: safeParseOptions(question.options),
    tags: tagsMap[id] ?? [],
  };
}

/** Update question fields and optionally replace its tags */
export async function updateQuestion(
  db: DB,
  questionId: string,
  teacherId: string,
  input: UpdateQuestionInput,
) {
  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  if (input.content !== undefined) updates.content = input.content;
  if (input.options !== undefined) updates.options = JSON.stringify(input.options);
  if (input.complexity !== undefined) updates.complexity = input.complexity;
  if (input.complexityType !== undefined) updates.complexityType = input.complexityType;
  if (input.explanation !== undefined) updates.explanation = input.explanation ?? null;

  await db.update(questions).set(updates).where(eq(questions.id, questionId));

  // Atomically replace tags: delete old + insert new in one batch
  if (input.tagIds !== undefined) {
    if (input.tagIds.length > 0) {
      // Verify ownership before batch
      const ownedTags = await db
        .select({ id: tags.id })
        .from(tags)
        .where(and(inArray(tags.id, input.tagIds), eq(tags.teacherId, teacherId)));
      if (ownedTags.length !== input.tagIds.length) {
        throw new Error("One or more tags not found or not owned by teacher");
      }
      await db.batch([
        db.delete(questionTags).where(eq(questionTags.questionId, questionId)),
        db.insert(questionTags).values(input.tagIds.map((tagId) => ({ questionId, tagId }))),
      ]);
    } else {
      // Clear all tags
      await db.delete(questionTags).where(eq(questionTags.questionId, questionId));
    }
  }

  const [question] = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
  const tagsMap = await fetchTagsForQuestions(db, [questionId]);

  return {
    ...question,
    options: safeParseOptions(question.options),
    tags: tagsMap[questionId] ?? [],
  };
}
