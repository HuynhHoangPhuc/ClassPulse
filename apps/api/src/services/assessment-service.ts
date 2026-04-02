import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import { assessments, assessmentQuestions, questions } from "../db/schema.js";
import { generateId } from "../lib/id-generator.js";
import { getAssessmentById, getAssessmentWithQuestions } from "./assessment-query-service.js";
import type { z } from "zod";
import type { createAssessmentSchema, updateAssessmentSchema } from "@teaching/shared";

type DB = ReturnType<typeof drizzle>;
type CreateInput = z.infer<typeof createAssessmentSchema>;
type UpdateInput = z.infer<typeof updateAssessmentSchema>;

/** Verify all question IDs belong to teacher */
async function verifyQuestionOwnership(db: DB, teacherId: string, questionIds: string[]) {
  if (questionIds.length === 0) return;
  const owned = await db
    .select({ id: questions.id })
    .from(questions)
    .where(
      and(
        eq(questions.teacherId, teacherId),
        sql`${questions.id} IN (${sql.join(questionIds.map((qid) => sql`${qid}`), sql`, `)})`
      )
    );
  if (owned.length !== questionIds.length) {
    throw new Error("One or more questions not found or not owned by teacher");
  }
}

/** Create assessment with ordered question associations */
export async function createAssessment(db: DB, teacherId: string, input: CreateInput) {
  const now = Date.now();
  const id = generateId();

  await verifyQuestionOwnership(db, teacherId, input.questionIds);

  await db.insert(assessments).values({
    id,
    teacherId,
    title: input.title,
    description: input.description ?? null,
    type: input.type,
    timeLimitMinutes: input.timeLimitMinutes ?? null,
    scorePerCorrect: input.scorePerCorrect,
    penaltyPerIncorrect: input.penaltyPerIncorrect,
    shuffleQuestions: input.shuffleQuestions ? 1 : 0,
    shuffleOptions: input.shuffleOptions ? 1 : 0,
    showResults: input.showResults,
    parentDetailView: input.parentDetailView,
    createdAt: now,
    updatedAt: now,
  });

  if (input.questionIds.length > 0) {
    await db.insert(assessmentQuestions).values(
      input.questionIds.map((qid, idx) => ({
        assessmentId: id,
        questionId: qid,
        orderIndex: idx,
      }))
    );
  }

  return getAssessmentById(db, id, teacherId);
}

/** Update assessment fields and optionally replace questions */
export async function updateAssessment(db: DB, id: string, teacherId: string, input: UpdateInput) {
  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description ?? null;
  if (input.type !== undefined) updates.type = input.type;
  if (input.timeLimitMinutes !== undefined) updates.timeLimitMinutes = input.timeLimitMinutes ?? null;
  if (input.scorePerCorrect !== undefined) updates.scorePerCorrect = input.scorePerCorrect;
  if (input.penaltyPerIncorrect !== undefined) updates.penaltyPerIncorrect = input.penaltyPerIncorrect;
  if (input.shuffleQuestions !== undefined) updates.shuffleQuestions = input.shuffleQuestions ? 1 : 0;
  if (input.shuffleOptions !== undefined) updates.shuffleOptions = input.shuffleOptions ? 1 : 0;
  if (input.showResults !== undefined) updates.showResults = input.showResults;
  if (input.parentDetailView !== undefined) updates.parentDetailView = input.parentDetailView;

  await db.update(assessments).set(updates).where(and(eq(assessments.id, id), eq(assessments.teacherId, teacherId)));

  if (input.questionIds !== undefined) {
    await verifyQuestionOwnership(db, teacherId, input.questionIds);
    await db.batch([
      db.delete(assessmentQuestions).where(eq(assessmentQuestions.assessmentId, id)),
      db.insert(assessmentQuestions).values(
        input.questionIds.map((qid, idx) => ({
          assessmentId: id,
          questionId: qid,
          orderIndex: idx,
        }))
      ),
    ]);
  }

  return getAssessmentById(db, id, teacherId);
}

/** Delete assessment and its question associations (ownership enforced) */
export async function deleteAssessment(db: DB, id: string, teacherId: string) {
  await db.batch([
    db.delete(assessmentQuestions).where(eq(assessmentQuestions.assessmentId, id)),
    db.delete(assessments).where(and(eq(assessments.id, id), eq(assessments.teacherId, teacherId))),
  ]);
}

/** Duplicate an assessment with new ID */
export async function duplicateAssessment(db: DB, id: string, teacherId: string) {
  const original = await getAssessmentWithQuestions(db, id, teacherId);
  if (!original) return null;

  const now = Date.now();
  const newId = generateId();

  await db.insert(assessments).values({
    id: newId,
    teacherId,
    title: `${original.title} (Copy)`,
    description: original.description,
    type: original.type,
    timeLimitMinutes: original.timeLimitMinutes,
    scorePerCorrect: original.scorePerCorrect,
    penaltyPerIncorrect: original.penaltyPerIncorrect,
    shuffleQuestions: original.shuffleQuestions,
    shuffleOptions: original.shuffleOptions,
    showResults: original.showResults,
    parentDetailView: original.parentDetailView,
    generationConfig: original.generationConfig,
    createdAt: now,
    updatedAt: now,
  });

  if (original.questions.length > 0) {
    await db.insert(assessmentQuestions).values(
      original.questions.map((q) => ({
        assessmentId: newId,
        questionId: q.questionId,
        orderIndex: q.orderIndex,
        customScore: q.customScore,
        customPenalty: q.customPenalty,
      }))
    );
  }

  return getAssessmentById(db, newId, teacherId);
}
