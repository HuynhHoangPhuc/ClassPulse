import type { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import {
  assessmentAttempts,
  attemptAnswers,
  assessmentQuestions,
  assessments,
  questions,
  users,
  posts,
} from "../db/schema.js";
import { safeParseOptions } from "./assessment-query-service.js";
import type { z } from "zod";
import type { attemptFilterSchema } from "@teaching/shared";

type DB = ReturnType<typeof drizzle>;
type FilterInput = z.infer<typeof attemptFilterSchema>;

/** Get attempt state (for student during assessment) */
export async function getAttemptState(db: DB, attemptId: string, studentId: string) {
  const [attempt] = await db
    .select()
    .from(assessmentAttempts)
    .where(and(eq(assessmentAttempts.id, attemptId), eq(assessmentAttempts.studentId, studentId)))
    .limit(1);
  if (!attempt) return null;

  const [assessment] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.id, attempt.assessmentId))
    .limit(1);
  if (!assessment) return null;

  // Get saved answers (without correctness)
  const answers = await db
    .select({
      questionId: attemptAnswers.questionId,
      selectedOptionId: attemptAnswers.selectedOptionId,
    })
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId));

  const answerMap = Object.fromEntries(answers.map((a) => [a.questionId, a.selectedOptionId]));

  // Parse question order
  const questionOrder: string[] = attempt.questionOrder ? JSON.parse(attempt.questionOrder) : [];

  // Fetch questions (strip correct answers)
  let orderedQuestions: Array<{
    questionId: string;
    orderIndex: number;
    content: string;
    options: Array<{ id: string; text: string }>;
    complexity: number;
    complexityType: string;
  }> = [];

  if (questionOrder.length > 0) {
    const questionRows = await db
      .select({
        id: questions.id,
        content: questions.content,
        options: questions.options,
        complexity: questions.complexity,
        complexityType: questions.complexityType,
      })
      .from(questions)
      .where(sql`${questions.id} IN (${sql.join(questionOrder.map((qid) => sql`${qid}`), sql`, `)})`);

    const questionMap = new Map(questionRows.map((q) => [q.id, q]));

    orderedQuestions = questionOrder.flatMap((qid, idx) => {
      const q = questionMap.get(qid);
      if (!q) return [];
      const opts = safeParseOptions(q.options) as Array<{ id: string; text: string }>;
      return {
        questionId: qid,
        orderIndex: idx,
        content: q.content,
        options: opts.map(({ id, text }) => ({ id, text })),
        complexity: q.complexity,
        complexityType: q.complexityType,
      };
    });
  }

  // Calculate time remaining
  const timeLimitSeconds = assessment.timeLimitMinutes ? assessment.timeLimitMinutes * 60 : null;
  const now = Date.now();
  const elapsed = Math.floor((now - attempt.startedAt) / 1000);
  const timeRemainingSeconds = timeLimitSeconds ? Math.max(0, timeLimitSeconds - elapsed) : null;

  return {
    attemptId: attempt.id,
    status: attempt.status,
    assessmentTitle: assessment.title,
    timeLimitSeconds,
    serverTime: now,
    timeRemainingSeconds,
    questions: orderedQuestions,
    answers: answerMap,
    scorePerCorrect: assessment.scorePerCorrect,
    penaltyPerIncorrect: assessment.penaltyPerIncorrect,
  };
}

/** Get attempt results (student view — respects showResults setting) */
export async function getAttemptResults(db: DB, attemptId: string, userId: string) {
  const [attempt] = await db
    .select()
    .from(assessmentAttempts)
    .where(and(eq(assessmentAttempts.id, attemptId), eq(assessmentAttempts.studentId, userId)))
    .limit(1);
  if (!attempt) return null;
  if (attempt.status === "in_progress") return null;

  const [assessment] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.id, attempt.assessmentId))
    .limit(1);
  if (!assessment) return null;

  // Check show_results setting
  if (assessment.showResults === "never") {
    return {
      attemptId: attempt.id,
      score: attempt.score,
      totalPossible: attempt.totalPossible,
      showDetails: false,
      questions: [],
    };
  }

  if (assessment.showResults === "after_due") {
    // Check if there's a post with dueDate for this assessment+classroom
    const [post] = await db
      .select({ dueDate: posts.dueDate })
      .from(posts)
      .where(
        and(
          eq(posts.assessmentId, attempt.assessmentId),
          eq(posts.classroomId, attempt.classroomId),
        ),
      )
      .limit(1);
    if (post?.dueDate && Date.now() < post.dueDate) {
      return {
        attemptId: attempt.id,
        score: attempt.score,
        totalPossible: attempt.totalPossible,
        showDetails: false,
        questions: [],
      };
    }
  }

  // Fetch detailed results
  const answers = await db
    .select()
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId));

  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  // Get questions with correct answers
  const aqs = await db
    .select({
      questionId: assessmentQuestions.questionId,
      orderIndex: assessmentQuestions.orderIndex,
      content: questions.content,
      options: questions.options,
      explanation: questions.explanation,
    })
    .from(assessmentQuestions)
    .innerJoin(questions, eq(assessmentQuestions.questionId, questions.id))
    .where(eq(assessmentQuestions.assessmentId, attempt.assessmentId))
    .orderBy(assessmentQuestions.orderIndex);

  const detailedQuestions = aqs.map((q) => {
    const opts = safeParseOptions(q.options) as Array<{ id: string; text: string; isCorrect: boolean }>;
    const correctOpt = opts.find((o) => o.isCorrect);
    const answer = answerMap.get(q.questionId);

    return {
      questionId: q.questionId,
      content: q.content,
      options: opts.map(({ id, text }) => ({ id, text })),
      correctOptionId: correctOpt?.id ?? "",
      selectedOptionId: answer?.selectedOptionId ?? null,
      isCorrect: answer ? !!answer.isCorrect : false,
      explanation: q.explanation,
    };
  });

  return {
    attemptId: attempt.id,
    score: attempt.score,
    totalPossible: attempt.totalPossible,
    showDetails: true,
    questions: detailedQuestions,
  };
}

/** Teacher: list submissions for an assessment in a classroom */
export async function listSubmissions(
  db: DB,
  classroomId: string,
  assessmentId: string,
  filters: FilterInput,
) {
  const conditions = [
    eq(assessmentAttempts.classroomId, classroomId),
    eq(assessmentAttempts.assessmentId, assessmentId),
  ];

  if (filters.cursor) {
    conditions.push(sql`${assessmentAttempts.id} > ${filters.cursor}`);
  }

  const limit = filters.limit;
  const rows = await db
    .select({
      id: assessmentAttempts.id,
      studentId: assessmentAttempts.studentId,
      startedAt: assessmentAttempts.startedAt,
      submittedAt: assessmentAttempts.submittedAt,
      isAutoSubmitted: assessmentAttempts.isAutoSubmitted,
      score: assessmentAttempts.score,
      totalPossible: assessmentAttempts.totalPossible,
      status: assessmentAttempts.status,
      tabSwitchCount: assessmentAttempts.tabSwitchCount,
      studentName: users.name,
      studentEmail: users.email,
      studentAvatar: users.avatarUrl,
    })
    .from(assessmentAttempts)
    .innerJoin(users, eq(assessmentAttempts.studentId, users.id))
    .where(and(...conditions))
    .orderBy(assessmentAttempts.id)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { items, nextCursor };
}

/** Teacher: get detailed submission view for a specific attempt */
export async function getSubmissionDetail(db: DB, attemptId: string) {
  const [attempt] = await db
    .select()
    .from(assessmentAttempts)
    .where(eq(assessmentAttempts.id, attemptId))
    .limit(1);
  if (!attempt) return null;

  const [student] = await db
    .select({ name: users.name, email: users.email, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, attempt.studentId))
    .limit(1);

  const answers = await db
    .select()
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId));

  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  const aqs = await db
    .select({
      questionId: assessmentQuestions.questionId,
      orderIndex: assessmentQuestions.orderIndex,
      content: questions.content,
      options: questions.options,
      explanation: questions.explanation,
    })
    .from(assessmentQuestions)
    .innerJoin(questions, eq(assessmentQuestions.questionId, questions.id))
    .where(eq(assessmentQuestions.assessmentId, attempt.assessmentId))
    .orderBy(assessmentQuestions.orderIndex);

  const detailedQuestions = aqs.map((q) => {
    const opts = safeParseOptions(q.options) as Array<{ id: string; text: string; isCorrect: boolean }>;
    const correctOpt = opts.find((o) => o.isCorrect);
    const answer = answerMap.get(q.questionId);

    return {
      questionId: q.questionId,
      content: q.content,
      options: opts.map(({ id, text }) => ({ id, text })),
      correctOptionId: correctOpt?.id ?? "",
      selectedOptionId: answer?.selectedOptionId ?? null,
      isCorrect: answer ? !!answer.isCorrect : false,
      explanation: q.explanation,
    };
  });

  return {
    attemptId: attempt.id,
    classroomId: attempt.classroomId,
    student: student ?? { name: "Unknown", email: "", avatarUrl: null },
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    isAutoSubmitted: !!attempt.isAutoSubmitted,
    score: attempt.score,
    totalPossible: attempt.totalPossible,
    status: attempt.status,
    tabSwitchCount: attempt.tabSwitchCount,
    questions: detailedQuestions,
  };
}
