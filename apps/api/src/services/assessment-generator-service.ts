import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import { questions, questionTags, assessments, assessmentQuestions } from "../db/schema.js";
import { generateId } from "../lib/id-generator.js";
import type { z } from "zod";
import type { generateAssessmentSchema } from "@teaching/shared";

type DB = ReturnType<typeof drizzle>;
type GenerateInput = z.infer<typeof generateAssessmentSchema>;

interface Shortfall {
  tagId: string;
  complexity: number;
  needed: number;
  available: number;
}

/** Fisher-Yates shuffle, returns first `take` elements */
function shuffleAndTake<T>(arr: T[], take: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, take);
}

/**
 * Auto-generate assessment by sampling questions per tag/complexity distribution.
 * Returns created assessment with shortfall warnings if insufficient questions.
 */
export async function generateAssessment(db: DB, teacherId: string, input: GenerateInput) {
  const selected: Array<{ id: string }> = [];
  const usedIds = new Set<string>();
  const shortfalls: Shortfall[] = [];

  for (const tagConfig of input.tags) {
    const tagCount = Math.round(input.totalQuestions * tagConfig.percent / 100);

    for (const compConfig of tagConfig.complexities) {
      const target = Math.round(tagCount * compConfig.percent / 100);
      if (target === 0) continue;

      // Query candidates: teacher's questions with this tag + complexity
      const candidates = await db
        .select({ id: questions.id })
        .from(questions)
        .innerJoin(questionTags, eq(questionTags.questionId, questions.id))
        .where(
          and(
            eq(questions.teacherId, teacherId),
            eq(questionTags.tagId, tagConfig.tagId),
            eq(questions.complexity, compConfig.level)
          )
        );

      // Filter out already-selected questions to avoid duplicates
      const available = candidates.filter((c) => !usedIds.has(c.id));
      const picked = shuffleAndTake(available, target);

      for (const p of picked) {
        selected.push(p);
        usedIds.add(p.id);
      }

      if (picked.length < target) {
        shortfalls.push({
          tagId: tagConfig.tagId,
          complexity: compConfig.level,
          needed: target,
          available: picked.length,
        });
      }
    }
  }

  // Adjust for rounding: if we have too many, trim; if too few, that's a shortfall
  if (selected.length > input.totalQuestions) {
    selected.length = input.totalQuestions;
  }

  // Create the assessment with selected questions
  const now = Date.now();
  const id = generateId();

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
    generationConfig: JSON.stringify({
      totalQuestions: input.totalQuestions,
      tags: input.tags,
    }),
    createdAt: now,
    updatedAt: now,
  });

  if (selected.length > 0) {
    await db.insert(assessmentQuestions).values(
      selected.map((q, idx) => ({
        assessmentId: id,
        questionId: q.id,
        orderIndex: idx,
      }))
    );
  }

  // Fetch created assessment with question count
  const [assessment] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.id, id))
    .limit(1);

  return {
    assessment: { ...assessment, questionCount: selected.length },
    shortfalls,
    totalSelected: selected.length,
    totalRequested: input.totalQuestions,
  };
}
