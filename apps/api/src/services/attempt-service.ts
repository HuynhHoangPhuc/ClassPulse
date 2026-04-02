import type { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import {
  assessmentAttempts,
  attemptAnswers,
  assessmentQuestions,
  assessments,
  questions,
  classroomMembers,
} from "../db/schema.js";
import { generateId } from "../lib/id-generator.js";
import { safeParseOptions } from "./assessment-query-service.js";
import { calculateScore } from "./score-calculator-service.js";

type DB = ReturnType<typeof drizzle>;

/** Seeded shuffle using attempt ID as seed (consistent per attempt) */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const result = [...arr];
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  for (let i = result.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1103515245) + 12345) | 0;
    const j = ((h >>> 0) % (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Start a new assessment attempt */
export async function startAttempt(
  db: DB,
  studentId: string,
  assessmentId: string,
  classroomId: string,
) {
  // Verify student is classroom member
  const [membership] = await db
    .select({ role: classroomMembers.role })
    .from(classroomMembers)
    .where(and(eq(classroomMembers.classroomId, classroomId), eq(classroomMembers.userId, studentId)))
    .limit(1);
  if (!membership) throw new Error("Not a member of this classroom");

  // Verify assessment exists
  const [assessment] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.id, assessmentId))
    .limit(1);
  if (!assessment) throw new Error("Assessment not found");

  // Check no existing in_progress attempt
  const [existing] = await db
    .select({ id: assessmentAttempts.id })
    .from(assessmentAttempts)
    .where(
      and(
        eq(assessmentAttempts.studentId, studentId),
        eq(assessmentAttempts.assessmentId, assessmentId),
        eq(assessmentAttempts.classroomId, classroomId),
        eq(assessmentAttempts.status, "in_progress"),
      ),
    )
    .limit(1);
  if (existing) throw new Error("Already have an in-progress attempt");

  const id = generateId();
  const now = Date.now();

  // Get questions in order
  const aqs = await db
    .select({
      questionId: assessmentQuestions.questionId,
      orderIndex: assessmentQuestions.orderIndex,
    })
    .from(assessmentQuestions)
    .where(eq(assessmentQuestions.assessmentId, assessmentId))
    .orderBy(assessmentQuestions.orderIndex);

  // Shuffle if enabled
  let orderedIds = aqs.map((q) => q.questionId);
  if (assessment.shuffleQuestions) {
    orderedIds = seededShuffle(orderedIds, id);
  }

  await db.insert(assessmentAttempts).values({
    id,
    assessmentId,
    studentId,
    classroomId,
    startedAt: now,
    status: "in_progress",
    tabSwitchCount: 0,
    questionOrder: JSON.stringify(orderedIds),
  });

  // Fetch questions without correct answers
  const questionRows = await db
    .select({
      id: questions.id,
      content: questions.content,
      options: questions.options,
      complexity: questions.complexity,
      complexityType: questions.complexityType,
    })
    .from(questions)
    .where(
      sql`${questions.id} IN (${sql.join(orderedIds.map((qid) => sql`${qid}`), sql`, `)})`
    );

  const questionMap = new Map(questionRows.map((q) => [q.id, q]));

  // Build ordered questions (strip isCorrect, skip deleted)
  const orderedQuestions = orderedIds.flatMap((qid, idx) => {
    const q = questionMap.get(qid);
    if (!q) return [];
    let opts = safeParseOptions(q.options) as Array<{ id: string; text: string; isCorrect: boolean }>;
    // Shuffle options if enabled
    if (assessment.shuffleOptions) {
      opts = seededShuffle(opts, id + qid);
    }
    return {
      questionId: qid,
      orderIndex: idx,
      content: q.content,
      options: opts.map(({ id, text }) => ({ id, text })),
      complexity: q.complexity,
      complexityType: q.complexityType,
    };
  });

  const timeLimitSeconds = assessment.timeLimitMinutes ? assessment.timeLimitMinutes * 60 : null;

  return {
    attemptId: id,
    assessmentTitle: assessment.title,
    assessmentDescription: assessment.description,
    timeLimitSeconds,
    serverTime: now,
    timeRemainingSeconds: timeLimitSeconds,
    questions: orderedQuestions,
    scorePerCorrect: assessment.scorePerCorrect,
    penaltyPerIncorrect: assessment.penaltyPerIncorrect,
  };
}

/** Save a single answer (upsert) */
export async function saveAnswer(
  db: DB,
  attemptId: string,
  studentId: string,
  questionId: string,
  selectedOptionId: string,
) {
  // Verify attempt ownership and in_progress
  const [attempt] = await db
    .select({ id: assessmentAttempts.id, assessmentId: assessmentAttempts.assessmentId, status: assessmentAttempts.status })
    .from(assessmentAttempts)
    .where(and(eq(assessmentAttempts.id, attemptId), eq(assessmentAttempts.studentId, studentId)))
    .limit(1);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.status !== "in_progress") throw new Error("Attempt already submitted");

  // Check if question belongs to assessment
  const [aq] = await db
    .select({ questionId: assessmentQuestions.questionId })
    .from(assessmentQuestions)
    .where(
      and(eq(assessmentQuestions.assessmentId, attempt.assessmentId), eq(assessmentQuestions.questionId, questionId))
    )
    .limit(1);
  if (!aq) throw new Error("Question not part of this assessment");

  // Determine correctness (but don't reveal to student)
  const [question] = await db
    .select({ options: questions.options })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  const opts = safeParseOptions(question.options) as Array<{ id: string; isCorrect: boolean }>;

  // H1: Validate option ID exists
  const validIds = new Set(opts.map((o) => o.id));
  if (!validIds.has(selectedOptionId)) throw new Error("Invalid option");

  const isCorrect = opts.some((o) => o.id === selectedOptionId && o.isCorrect) ? 1 : 0;

  // Upsert answer
  await db
    .insert(attemptAnswers)
    .values({
      attemptId,
      questionId,
      selectedOptionId,
      isCorrect,
      answeredAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: [attemptAnswers.attemptId, attemptAnswers.questionId],
      set: { selectedOptionId, isCorrect, answeredAt: Date.now() },
    });

  return { saved: true };
}

/** Submit an attempt — calculate score and finalize */
export async function submitAttempt(
  db: DB,
  attemptId: string,
  studentId: string,
  autoSubmit = false,
) {
  // Atomic guard: only transition in_progress → submitted (prevents double-submit race)
  const now = Date.now();

  const [attempt] = await db
    .select()
    .from(assessmentAttempts)
    .where(and(eq(assessmentAttempts.id, attemptId), eq(assessmentAttempts.studentId, studentId)))
    .limit(1);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.status !== "in_progress") throw new Error("Attempt already submitted");

  // Fetch assessment for time validation
  const [assessment] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.id, attempt.assessmentId))
    .limit(1);
  if (!assessment) throw new Error("Assessment not found");

  // Server-side time validation (5s grace)
  let wasAutoSubmitted = autoSubmit;
  if (assessment.timeLimitMinutes) {
    const timeLimitMs = assessment.timeLimitMinutes * 60 * 1000;
    const graceMs = 5000;
    if (now - attempt.startedAt > timeLimitMs + graceMs) {
      wasAutoSubmitted = true;
    }
  }

  // Get saved answers
  const answers = await db
    .select()
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId));

  const result = await calculateScore(
    db,
    attempt.assessmentId,
    assessment.scorePerCorrect,
    assessment.penaltyPerIncorrect,
    answers.map((a) => ({ questionId: a.questionId, selectedOptionId: a.selectedOptionId })),
  );

  // CAS-style atomic update: only update if still in_progress
  const updated = await db
    .update(assessmentAttempts)
    .set({
      submittedAt: now,
      status: "submitted",
      isAutoSubmitted: wasAutoSubmitted ? 1 : 0,
      score: result.score,
      totalPossible: result.totalPossible,
    })
    .where(
      and(
        eq(assessmentAttempts.id, attemptId),
        eq(assessmentAttempts.status, "in_progress"),
      ),
    );

  return {
    score: result.score,
    totalPossible: result.totalPossible,
    isAutoSubmitted: wasAutoSubmitted,
  };
}

/** Record a tab switch */
export async function recordTabSwitch(db: DB, attemptId: string, studentId: string) {
  const [attempt] = await db
    .select({ id: assessmentAttempts.id, status: assessmentAttempts.status })
    .from(assessmentAttempts)
    .where(and(eq(assessmentAttempts.id, attemptId), eq(assessmentAttempts.studentId, studentId)))
    .limit(1);
  if (!attempt || attempt.status !== "in_progress") return;

  await db
    .update(assessmentAttempts)
    .set({ tabSwitchCount: sql`${assessmentAttempts.tabSwitchCount} + 1` })
    .where(eq(assessmentAttempts.id, attemptId));
}
