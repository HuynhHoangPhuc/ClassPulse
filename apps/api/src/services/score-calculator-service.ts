import type { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { assessmentQuestions, questions } from "../db/schema.js";
import { safeParseOptions } from "./assessment-query-service.js";

type DB = ReturnType<typeof drizzle>;

interface AnswerRecord {
  questionId: string;
  selectedOptionId: string;
}

interface ScoreResult {
  score: number;
  totalPossible: number;
  perQuestion: Array<{
    questionId: string;
    selectedOptionId: string | null;
    correctOptionId: string;
    isCorrect: boolean;
    pointsEarned: number;
  }>;
}

/** Calculate score for a submitted attempt */
export async function calculateScore(
  db: DB,
  assessmentId: string,
  scorePerCorrect: number,
  penaltyPerIncorrect: number,
  answers: AnswerRecord[],
): Promise<ScoreResult> {
  // Fetch assessment questions with correct answers
  const aqs = await db
    .select({
      questionId: assessmentQuestions.questionId,
      customScore: assessmentQuestions.customScore,
      customPenalty: assessmentQuestions.customPenalty,
      options: questions.options,
    })
    .from(assessmentQuestions)
    .innerJoin(questions, eq(assessmentQuestions.questionId, questions.id))
    .where(eq(assessmentQuestions.assessmentId, assessmentId));

  const answerMap = new Map(answers.map((a) => [a.questionId, a.selectedOptionId]));

  let score = 0;
  let totalPossible = 0;
  const perQuestion: ScoreResult["perQuestion"] = [];

  for (const aq of aqs) {
    const pts = aq.customScore ?? scorePerCorrect;
    const penalty = aq.customPenalty ?? penaltyPerIncorrect;
    totalPossible += pts;

    const opts = safeParseOptions(aq.options) as Array<{ id: string; isCorrect: boolean }>;
    const correctOpt = opts.find((o) => o.isCorrect);
    const correctOptionId = correctOpt?.id ?? "";
    const selected = answerMap.get(aq.questionId) ?? null;

    let isCorrect = false;
    let pointsEarned = 0;

    if (selected) {
      isCorrect = selected === correctOptionId;
      pointsEarned = isCorrect ? pts : -penalty;
      score += pointsEarned;
    }

    perQuestion.push({
      questionId: aq.questionId,
      selectedOptionId: selected,
      correctOptionId,
      isCorrect,
      pointsEarned,
    });
  }

  return { score: Math.max(0, score), totalPossible, perQuestion };
}
