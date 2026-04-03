import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { sql, eq, and, gt, count, countDistinct, avg } from "drizzle-orm";
import type { Env } from "../env.js";
import {
  classrooms,
  classroomMembers,
  assessments,
  questions,
  assessmentAttempts,
} from "../db/schema.js";

type Variables = { userId: string };
const dashboardRoutes = new Hono<Env & { Variables: Variables }>();

// GET /stats — aggregated KPIs for the current teacher's dashboard
dashboardRoutes.get("/stats", async (c) => {
  const userId = c.get("userId");
  const db = drizzle(c.env.DB);

  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

  // Run queries in parallel
  const [studentRows, assessmentRows, questionRows, scoreRows] = await Promise.all([
    // Total distinct students across teacher's classrooms
    db
      .select({ count: countDistinct(classroomMembers.userId) })
      .from(classroomMembers)
      .innerJoin(classrooms, eq(classroomMembers.classroomId, classrooms.id))
      .where(and(eq(classrooms.teacherId, userId), eq(classroomMembers.role, "student"))),

    // Total assessments authored
    db
      .select({ count: count() })
      .from(assessments)
      .where(eq(assessments.teacherId, userId)),

    // Total questions authored
    db
      .select({ count: count() })
      .from(questions)
      .where(eq(questions.teacherId, userId)),

    // Avg score from attempts on teacher's assessments (last 30 days)
    db
      .select({ avg: avg(assessmentAttempts.score) })
      .from(assessmentAttempts)
      .innerJoin(assessments, eq(assessmentAttempts.assessmentId, assessments.id))
      .where(
        and(
          eq(assessments.teacherId, userId),
          gt(assessmentAttempts.startedAt, thirtyDaysAgo),
          sql`${assessmentAttempts.score} IS NOT NULL`,
        ),
      ),
  ]);

  return c.json({
    totalStudents: studentRows[0]?.count ?? 0,
    activeAssessments: assessmentRows[0]?.count ?? 0,
    questionsBank: questionRows[0]?.count ?? 0,
    avgScore: scoreRows[0]?.avg != null ? Math.round(Number(scoreRows[0].avg) * 10) / 10 : null,
  });
});

export { dashboardRoutes };
