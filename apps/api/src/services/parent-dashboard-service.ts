import type { drizzle } from "drizzle-orm/d1"
import { eq, and, sql, desc } from "drizzle-orm"
import {
  parentStudent,
  users,
  assessmentAttempts,
  attemptAnswers,
  assessmentQuestions,
  assessments,
  questions,
  questionTags,
  tags,
  classrooms,
  classroomMembers,
  posts,
} from "../db/schema.js"

type DB = ReturnType<typeof drizzle>

/** Verify parent has access to student */
export async function verifyParentStudentLink(db: DB, parentId: string, studentId: string) {
  const [link] = await db
    .select({ id: parentStudent.id })
    .from(parentStudent)
    .where(and(eq(parentStudent.parentId, parentId), eq(parentStudent.studentId, studentId)))
    .limit(1)
  return !!link
}

/** List all students linked to a parent */
export async function getLinkedStudents(db: DB, parentId: string) {
  const rows = await db
    .select({
      studentId: parentStudent.studentId,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(parentStudent)
    .innerJoin(users, eq(parentStudent.studentId, users.id))
    .where(eq(parentStudent.parentId, parentId))
  return rows
}

/** Overview KPIs for a student */
export async function getStudentOverview(db: DB, studentId: string) {
  // Average score percentage across all submitted attempts (guard division-by-zero)
  const [avgRow] = await db
    .select({
      avgPercent: sql<number>`AVG(CASE WHEN ${assessmentAttempts.totalPossible} > 0 THEN ${assessmentAttempts.score} / ${assessmentAttempts.totalPossible} * 100 ELSE 0 END)`,
      totalAttempts: sql<number>`COUNT(*)`,
    })
    .from(assessmentAttempts)
    .where(and(eq(assessmentAttempts.studentId, studentId), eq(assessmentAttempts.status, "submitted")))

  // Total classrooms
  const [classroomRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(classroomMembers)
    .where(eq(classroomMembers.userId, studentId))

  // Assessments submitted this week (last 7 days)
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const [weekRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(assessmentAttempts)
    .where(
      and(
        eq(assessmentAttempts.studentId, studentId),
        eq(assessmentAttempts.status, "submitted"),
        sql`${assessmentAttempts.submittedAt} > ${weekAgo}`,
      ),
    )

  return {
    avgScore: avgRow?.avgPercent ?? 0,
    totalAttempts: avgRow?.totalAttempts ?? 0,
    totalClassrooms: classroomRow?.count ?? 0,
    attemptsThisWeek: weekRow?.count ?? 0,
  }
}

/** Daily average scores for score trend chart */
export async function getScoreTrend(db: DB, studentId: string, days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const rows = await db
    .select({
      date: sql<string>`DATE(${assessmentAttempts.submittedAt} / 1000, 'unixepoch')`,
      avg: sql<number>`AVG(CASE WHEN ${assessmentAttempts.totalPossible} > 0 THEN ${assessmentAttempts.score} / ${assessmentAttempts.totalPossible} * 100 ELSE 0 END)`,
    })
    .from(assessmentAttempts)
    .where(
      and(
        eq(assessmentAttempts.studentId, studentId),
        eq(assessmentAttempts.status, "submitted"),
        sql`${assessmentAttempts.submittedAt} > ${cutoff}`,
      ),
    )
    .groupBy(sql`DATE(${assessmentAttempts.submittedAt} / 1000, 'unixepoch')`)
    .orderBy(sql`DATE(${assessmentAttempts.submittedAt} / 1000, 'unixepoch')`)

  return rows.map((r) => ({ date: r.date, avg: Math.round((r.avg ?? 0) * 10) / 10 }))
}

/** Per-tag accuracy for tag performance chart */
export async function getTagPerformance(db: DB, studentId: string) {
  const rows = await db
    .select({
      tagId: tags.id,
      name: tags.name,
      color: tags.color,
      accuracy: sql<number>`AVG(CASE WHEN ${attemptAnswers.isCorrect} = 1 THEN 100.0 ELSE 0.0 END)`,
      totalAnswers: sql<number>`COUNT(*)`,
    })
    .from(attemptAnswers)
    .innerJoin(assessmentAttempts, eq(attemptAnswers.attemptId, assessmentAttempts.id))
    .innerJoin(questionTags, eq(attemptAnswers.questionId, questionTags.questionId))
    .innerJoin(tags, eq(questionTags.tagId, tags.id))
    .where(
      and(
        eq(assessmentAttempts.studentId, studentId),
        eq(assessmentAttempts.status, "submitted"),
      ),
    )
    .groupBy(tags.id)
    .orderBy(sql`AVG(CASE WHEN ${attemptAnswers.isCorrect} = 1 THEN 100.0 ELSE 0.0 END) DESC`)

  return rows.map((r) => ({
    tagId: r.tagId,
    name: r.name,
    color: r.color,
    accuracy: Math.round((r.accuracy ?? 0) * 10) / 10,
    totalAnswers: r.totalAnswers ?? 0,
  }))
}

/** Recent activity feed (assessments taken + classroom joins) */
export async function getStudentActivity(
  db: DB,
  studentId: string,
  cursor: string | undefined,
  limit: number,
) {
  // Fetch recent submitted attempts
  const attemptConditions = [
    eq(assessmentAttempts.studentId, studentId),
    eq(assessmentAttempts.status, "submitted"),
  ]
  if (cursor) {
    attemptConditions.push(sql`${assessmentAttempts.submittedAt} < ${Number(cursor)}`)
  }

  const attemptRows = await db
    .select({
      id: assessmentAttempts.id,
      timestamp: assessmentAttempts.submittedAt,
      score: assessmentAttempts.score,
      totalPossible: assessmentAttempts.totalPossible,
      assessmentTitle: assessments.title,
    })
    .from(assessmentAttempts)
    .innerJoin(assessments, eq(assessmentAttempts.assessmentId, assessments.id))
    .where(and(...attemptConditions))
    .orderBy(desc(assessmentAttempts.submittedAt))
    .limit(limit + 1)

  const items = attemptRows.slice(0, limit).map((r) => ({
    type: "assessment_completed" as const,
    id: r.id,
    timestamp: r.timestamp!,
    description: r.assessmentTitle,
    score: r.score,
    totalPossible: r.totalPossible,
  }))

  const hasMore = attemptRows.length > limit
  const nextCursor = hasMore ? String(items[items.length - 1].timestamp) : null

  return { items, nextCursor }
}

/** Paginated assessment history */
export async function getAssessmentHistory(
  db: DB,
  studentId: string,
  cursor: string | undefined,
  limit: number,
) {
  const conditions = [
    eq(assessmentAttempts.studentId, studentId),
    eq(assessmentAttempts.status, "submitted"),
  ]
  if (cursor) {
    conditions.push(sql`${assessmentAttempts.id} > ${cursor}`)
  }

  const rows = await db
    .select({
      attemptId: assessmentAttempts.id,
      assessmentId: assessmentAttempts.assessmentId,
      classroomId: assessmentAttempts.classroomId,
      startedAt: assessmentAttempts.startedAt,
      submittedAt: assessmentAttempts.submittedAt,
      score: assessmentAttempts.score,
      totalPossible: assessmentAttempts.totalPossible,
      assessmentTitle: assessments.title,
      parentDetailView: assessments.parentDetailView,
      classroomName: classrooms.name,
    })
    .from(assessmentAttempts)
    .innerJoin(assessments, eq(assessmentAttempts.assessmentId, assessments.id))
    .innerJoin(classrooms, eq(assessmentAttempts.classroomId, classrooms.id))
    .where(and(...conditions))
    .orderBy(assessmentAttempts.id)
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? items[items.length - 1].attemptId : null

  return {
    items: items.map((r) => ({
      attemptId: r.attemptId,
      assessmentTitle: r.assessmentTitle,
      classroomName: r.classroomName,
      startedAt: r.startedAt,
      submittedAt: r.submittedAt,
      score: r.score,
      totalPossible: r.totalPossible,
      timeTaken: r.submittedAt && r.startedAt ? r.submittedAt - r.startedAt : null,
      parentDetailView: r.parentDetailView,
    })),
    nextCursor,
  }
}

/** Classrooms where student is a member (batch queries, no N+1) */
export async function getStudentClassrooms(db: DB, studentId: string) {
  const rows = await db
    .select({
      classroomId: classrooms.id,
      classroomName: classrooms.name,
      teacherId: classrooms.teacherId,
      teacherName: users.name,
    })
    .from(classroomMembers)
    .innerJoin(classrooms, eq(classroomMembers.classroomId, classrooms.id))
    .innerJoin(users, eq(classrooms.teacherId, users.id))
    .where(eq(classroomMembers.userId, studentId))

  if (rows.length === 0) return []

  const classroomIds = rows.map((r) => r.classroomId)

  // Batch: total assigned assessments per classroom
  const totalRows = await db
    .select({
      classroomId: posts.classroomId,
      count: sql<number>`COUNT(DISTINCT ${posts.assessmentId})`,
    })
    .from(posts)
    .where(
      and(
        sql`${posts.classroomId} IN (${sql.join(classroomIds.map((id) => sql`${id}`), sql`, `)})`,
        eq(posts.type, "assessment_assignment"),
        sql`${posts.assessmentId} IS NOT NULL`,
      ),
    )
    .groupBy(posts.classroomId)

  const totalMap = new Map(totalRows.map((r) => [r.classroomId, r.count ?? 0]))

  // Batch: completed assessments per classroom for this student
  const completedRows = await db
    .select({
      classroomId: assessmentAttempts.classroomId,
      count: sql<number>`COUNT(DISTINCT ${assessmentAttempts.assessmentId})`,
    })
    .from(assessmentAttempts)
    .where(
      and(
        sql`${assessmentAttempts.classroomId} IN (${sql.join(classroomIds.map((id) => sql`${id}`), sql`, `)})`,
        eq(assessmentAttempts.studentId, studentId),
        eq(assessmentAttempts.status, "submitted"),
      ),
    )
    .groupBy(assessmentAttempts.classroomId)

  const completedMap = new Map(completedRows.map((r) => [r.classroomId, r.count ?? 0]))

  return rows.map((r) => {
    const totalAssessments = totalMap.get(r.classroomId) ?? 0
    const completedAssessments = completedMap.get(r.classroomId) ?? 0
    return {
      classroomId: r.classroomId,
      classroomName: r.classroomName,
      teacherName: r.teacherName,
      totalAssessments,
      completedAssessments,
      completionRate: totalAssessments > 0
        ? Math.round((completedAssessments / totalAssessments) * 100)
        : 0,
    }
  })
}
