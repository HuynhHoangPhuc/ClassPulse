import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { assessments } from "../db/schema.js";
import type { Env } from "../env.js";
import {
  createAssessmentSchema,
  updateAssessmentSchema,
  assessmentFilterSchema,
  generateAssessmentSchema,
} from "@teaching/shared";
import {
  createAssessment,
  updateAssessment,
  deleteAssessment,
  duplicateAssessment,
} from "../services/assessment-service.js";
import {
  getAssessmentById,
  getAssessmentWithQuestions,
  listAssessments,
} from "../services/assessment-query-service.js";
import { generateAssessment } from "../services/assessment-generator-service.js";

type Variables = { userId: string };
const assessmentRoutes = new Hono<Env & { Variables: Variables }>();

// GET / — list assessments with filters
assessmentRoutes.get("/", async (c) => {
  const teacherId = c.get("userId");
  const parsed = assessmentFilterSchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "Invalid query params", details: parsed.error.flatten() }, 400);
  }
  const db = drizzle(c.env.DB);
  const result = await listAssessments(db, teacherId, parsed.data);
  return c.json(result);
});

// GET /:id — single assessment with question count
assessmentRoutes.get("/:id", async (c) => {
  const teacherId = c.get("userId");
  const db = drizzle(c.env.DB);
  const assessment = await getAssessmentWithQuestions(db, c.req.param("id"), teacherId);
  if (!assessment) return c.json({ error: "Assessment not found" }, 404);
  return c.json(assessment);
});

// POST / — create assessment (manual)
assessmentRoutes.post("/", async (c) => {
  const teacherId = c.get("userId");
  const body = await c.req.json();
  const parsed = createAssessmentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const db = drizzle(c.env.DB);
  try {
    const assessment = await createAssessment(db, teacherId, parsed.data);
    return c.json(assessment, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to create assessment" }, 400);
  }
});

// POST /generate — auto-generate assessment
assessmentRoutes.post("/generate", async (c) => {
  const teacherId = c.get("userId");
  const body = await c.req.json();
  const parsed = generateAssessmentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const db = drizzle(c.env.DB);
  const result = await generateAssessment(db, teacherId, parsed.data);
  return c.json(result, 201);
});

// PUT /:id — update assessment
assessmentRoutes.put("/:id", async (c) => {
  const teacherId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateAssessmentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const db = drizzle(c.env.DB);
  const existing = await getAssessmentById(db, id, teacherId);
  if (!existing) return c.json({ error: "Assessment not found" }, 404);
  try {
    const assessment = await updateAssessment(db, id, teacherId, parsed.data);
    return c.json(assessment);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to update assessment" }, 400);
  }
});

// DELETE /:id — delete assessment
assessmentRoutes.delete("/:id", async (c) => {
  const teacherId = c.get("userId");
  const id = c.req.param("id");
  const db = drizzle(c.env.DB);
  const existing = await getAssessmentById(db, id, teacherId);
  if (!existing) return c.json({ error: "Assessment not found" }, 404);
  await deleteAssessment(db, id, teacherId);
  return c.json({ deleted: true });
});

// POST /:id/duplicate — clone assessment
assessmentRoutes.post("/:id/duplicate", async (c) => {
  const teacherId = c.get("userId");
  const db = drizzle(c.env.DB);
  const result = await duplicateAssessment(db, c.req.param("id"), teacherId);
  if (!result) return c.json({ error: "Assessment not found" }, 404);
  return c.json(result, 201);
});

// GET /:id/preview — student-view preview data
assessmentRoutes.get("/:id/preview", async (c) => {
  const teacherId = c.get("userId");
  const db = drizzle(c.env.DB);
  const assessment = await getAssessmentWithQuestions(db, c.req.param("id"), teacherId);
  if (!assessment) return c.json({ error: "Assessment not found" }, 404);

  // Strip correct answers and explanations for student-view simulation
  const previewQuestions = assessment.questions.map((q) => ({
    questionId: q.questionId,
    orderIndex: q.orderIndex,
    content: q.content,
    options: (q.options as Array<{ id: string; text: string }>).map(({ id, text }) => ({ id, text })),
    complexity: q.complexity,
    complexityType: q.complexityType,
  }));

  return c.json({
    id: assessment.id,
    title: assessment.title,
    description: assessment.description,
    type: assessment.type,
    timeLimitMinutes: assessment.timeLimitMinutes,
    scorePerCorrect: assessment.scorePerCorrect,
    penaltyPerIncorrect: assessment.penaltyPerIncorrect,
    questionCount: previewQuestions.length,
    questions: previewQuestions,
  });
});

export { assessmentRoutes };
