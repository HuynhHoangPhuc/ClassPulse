import { drizzle } from "drizzle-orm/d1";
import { eq, and, like, sql } from "drizzle-orm";
import { assessments, assessmentQuestions, questions } from "../db/schema.js";
import type { z } from "zod";
import type { assessmentFilterSchema } from "@teaching/shared";

type DB = ReturnType<typeof drizzle>;
type FilterInput = z.infer<typeof assessmentFilterSchema>;

export function safeParseOptions(raw: string): unknown[] {
  try { return JSON.parse(raw); } catch { return []; }
}

/** Fetch question count for a single assessment */
export async function fetchQuestionCount(db: DB, assessmentId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(assessmentQuestions)
    .where(eq(assessmentQuestions.assessmentId, assessmentId));
  return row?.count ?? 0;
}

/** Batch fetch question counts for multiple assessments (avoids N+1) */
export async function fetchQuestionCountsBatch(
  db: DB,
  assessmentIds: string[],
): Promise<Record<string, number>> {
  if (assessmentIds.length === 0) return {};
  const rows = await db
    .select({
      assessmentId: assessmentQuestions.assessmentId,
      count: sql<number>`count(*)`,
    })
    .from(assessmentQuestions)
    .where(sql`${assessmentQuestions.assessmentId} IN (${sql.join(assessmentIds.map((id) => sql`${id}`), sql`, `)})`)
    .groupBy(assessmentQuestions.assessmentId);

  const map: Record<string, number> = {};
  for (const row of rows) map[row.assessmentId] = row.count;
  return map;
}

/** Get single assessment with question count */
export async function getAssessmentById(db: DB, id: string, teacherId: string) {
  const [assessment] = await db
    .select()
    .from(assessments)
    .where(and(eq(assessments.id, id), eq(assessments.teacherId, teacherId)))
    .limit(1);

  if (!assessment) return null;

  const questionCount = await fetchQuestionCount(db, id);
  return { ...assessment, questionCount };
}

/** Get assessment with full question list (for detail/preview) */
export async function getAssessmentWithQuestions(db: DB, id: string, teacherId: string) {
  const [assessment] = await db
    .select()
    .from(assessments)
    .where(and(eq(assessments.id, id), eq(assessments.teacherId, teacherId)))
    .limit(1);

  if (!assessment) return null;

  const qs = await db
    .select({
      questionId: assessmentQuestions.questionId,
      orderIndex: assessmentQuestions.orderIndex,
      customScore: assessmentQuestions.customScore,
      customPenalty: assessmentQuestions.customPenalty,
      content: questions.content,
      options: questions.options,
      complexity: questions.complexity,
      complexityType: questions.complexityType,
      explanation: questions.explanation,
    })
    .from(assessmentQuestions)
    .innerJoin(questions, eq(assessmentQuestions.questionId, questions.id))
    .where(eq(assessmentQuestions.assessmentId, id))
    .orderBy(assessmentQuestions.orderIndex);

  return {
    ...assessment,
    questions: qs.map((q) => ({
      ...q,
      options: safeParseOptions(q.options),
    })),
  };
}

/** List assessments with filters and cursor pagination */
export async function listAssessments(db: DB, teacherId: string, filters: FilterInput) {
  const conditions = [eq(assessments.teacherId, teacherId)];

  if (filters.type) {
    conditions.push(eq(assessments.type, filters.type));
  }
  if (filters.search) {
    conditions.push(like(assessments.title, `%${filters.search}%`));
  }
  if (filters.cursor) {
    conditions.push(sql`${assessments.id} > ${filters.cursor}`);
  }

  const limit = filters.limit;
  const rows = await db
    .select()
    .from(assessments)
    .where(and(...conditions))
    .orderBy(assessments.id)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const countMap = await fetchQuestionCountsBatch(db, items.map((a) => a.id));
  const withCounts = items.map((a) => ({
    ...a,
    questionCount: countMap[a.id] ?? 0,
  }));

  return { items: withCounts, nextCursor };
}
