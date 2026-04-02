import { Hono } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import type { Env } from "../env.js"
import { users } from "../db/schema.js"
import {
  parentScoreTrendSchema,
  parentActivitySchema,
  parentHistorySchema,
} from "@teaching/shared"
import {
  verifyParentStudentLink,
  getLinkedStudents,
  getStudentOverview,
  getScoreTrend,
  getTagPerformance,
  getStudentActivity,
  getAssessmentHistory,
  getStudentClassrooms,
} from "../services/parent-dashboard-service.js"

type Variables = { userId: string }
const parentRoutes = new Hono<Env & { Variables: Variables }>()

/** Middleware: verify caller is a parent */
parentRoutes.use("/*", async (c, next) => {
  const userId = c.get("userId")
  const db = drizzle(c.env.DB)
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!user || user.role !== "parent") {
    return c.json({ error: "Parent role required" }, 403)
  }
  await next()
})

// GET /students — list linked students
parentRoutes.get("/students", async (c) => {
  const parentId = c.get("userId")
  const db = drizzle(c.env.DB)
  const students = await getLinkedStudents(db, parentId)
  return c.json({ items: students })
})

/** Helper: validate parent-student access */
async function validateAccess(c: any, db: any, parentId: string, studentId: string) {
  const hasAccess = await verifyParentStudentLink(db, parentId, studentId)
  if (!hasAccess) {
    return c.json({ error: "Not linked to this student" }, 403)
  }
  return null
}

// GET /students/:studentId/overview — KPIs
parentRoutes.get("/students/:studentId/overview", async (c) => {
  const parentId = c.get("userId")
  const studentId = c.req.param("studentId")
  const db = drizzle(c.env.DB)

  const denied = await validateAccess(c, db, parentId, studentId)
  if (denied) return denied

  const overview = await getStudentOverview(db, studentId)
  return c.json(overview)
})

// GET /students/:studentId/trend — score trend
parentRoutes.get("/students/:studentId/trend", async (c) => {
  const parentId = c.get("userId")
  const studentId = c.req.param("studentId")
  const db = drizzle(c.env.DB)

  const denied = await validateAccess(c, db, parentId, studentId)
  if (denied) return denied

  const parsed = parentScoreTrendSchema.safeParse({
    studentId,
    days: c.req.query("days"),
  })
  const days = parsed.success ? parsed.data.days : 30

  const trend = await getScoreTrend(db, studentId, days)
  return c.json({ items: trend })
})

// GET /students/:studentId/tags — per-tag performance
parentRoutes.get("/students/:studentId/tags", async (c) => {
  const parentId = c.get("userId")
  const studentId = c.req.param("studentId")
  const db = drizzle(c.env.DB)

  const denied = await validateAccess(c, db, parentId, studentId)
  if (denied) return denied

  const performance = await getTagPerformance(db, studentId)
  return c.json({ items: performance })
})

// GET /students/:studentId/activity — recent activity feed
parentRoutes.get("/students/:studentId/activity", async (c) => {
  const parentId = c.get("userId")
  const studentId = c.req.param("studentId")
  const db = drizzle(c.env.DB)

  const denied = await validateAccess(c, db, parentId, studentId)
  if (denied) return denied

  const parsed = parentActivitySchema.safeParse({
    studentId,
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
  })
  const cursor = parsed.success ? parsed.data.cursor : undefined
  const limit = parsed.success ? parsed.data.limit : 20

  const activity = await getStudentActivity(db, studentId, cursor, limit)
  return c.json(activity)
})

// GET /students/:studentId/history — assessment history (paginated)
parentRoutes.get("/students/:studentId/history", async (c) => {
  const parentId = c.get("userId")
  const studentId = c.req.param("studentId")
  const db = drizzle(c.env.DB)

  const denied = await validateAccess(c, db, parentId, studentId)
  if (denied) return denied

  const parsed = parentHistorySchema.safeParse({
    studentId,
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
  })
  const cursor = parsed.success ? parsed.data.cursor : undefined
  const limit = parsed.success ? parsed.data.limit : 20

  const history = await getAssessmentHistory(db, studentId, cursor, limit)
  return c.json(history)
})

// GET /students/:studentId/classrooms — classroom overview
parentRoutes.get("/students/:studentId/classrooms", async (c) => {
  const parentId = c.get("userId")
  const studentId = c.req.param("studentId")
  const db = drizzle(c.env.DB)

  const denied = await validateAccess(c, db, parentId, studentId)
  if (denied) return denied

  const classroomList = await getStudentClassrooms(db, studentId)
  return c.json({ items: classroomList })
})

export { parentRoutes }
