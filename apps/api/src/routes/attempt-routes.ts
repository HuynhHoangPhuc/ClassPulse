import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import type { Env } from "../env.js";
import { startAttemptSchema, submitAnswerSchema } from "@teaching/shared";
import { startAttempt, saveAnswer, submitAttempt, recordTabSwitch } from "../services/attempt-service.js";
import { getAttemptState, getAttemptResults, getSubmissionDetail } from "../services/attempt-query-service.js";
import { isClassroomTeacher } from "../services/classroom-service.js";

type Variables = { userId: string };
const attemptRoutes = new Hono<Env & { Variables: Variables }>();

// POST / — start a new attempt
attemptRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = startAttemptSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const db = drizzle(c.env.DB);
  try {
    const result = await startAttempt(db, userId, parsed.data.assessmentId, parsed.data.classroomId);
    return c.json(result, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to start attempt" }, 400);
  }
});

// GET /:id — get attempt state (student, during assessment)
attemptRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const db = drizzle(c.env.DB);
  const state = await getAttemptState(db, c.req.param("id"), userId);
  if (!state) return c.json({ error: "Attempt not found" }, 404);
  return c.json(state);
});

// PUT /:id/answers/:questionId — save single answer
attemptRoutes.put("/:id/answers/:questionId", async (c) => {
  const userId = c.get("userId");
  const attemptId = c.req.param("id");
  const questionId = c.req.param("questionId");
  const body = await c.req.json();
  const parsed = submitAnswerSchema.safeParse({ questionId, selectedOptionId: body.selectedOptionId });
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const db = drizzle(c.env.DB);
  try {
    const result = await saveAnswer(db, attemptId, userId, questionId, parsed.data.selectedOptionId);
    return c.json(result);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to save answer" }, 400);
  }
});

// POST /:id/submit — submit attempt
attemptRoutes.post("/:id/submit", async (c) => {
  const userId = c.get("userId");
  const db = drizzle(c.env.DB);
  try {
    const result = await submitAttempt(db, c.req.param("id"), userId);
    return c.json(result);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to submit" }, 400);
  }
});

// POST /:id/tab-switch — record tab switch event
attemptRoutes.post("/:id/tab-switch", async (c) => {
  const userId = c.get("userId");
  const db = drizzle(c.env.DB);
  await recordTabSwitch(db, c.req.param("id"), userId);
  return c.json({ recorded: true });
});

// GET /:id/results — get results (student view, respects showResults)
attemptRoutes.get("/:id/results", async (c) => {
  const userId = c.get("userId");
  const db = drizzle(c.env.DB);
  const results = await getAttemptResults(db, c.req.param("id"), userId);
  if (!results) return c.json({ error: "Results not available" }, 404);
  return c.json(results);
});

// GET /:id/detail — teacher: detailed submission view
attemptRoutes.get("/:id/detail", async (c) => {
  const userId = c.get("userId");
  const db = drizzle(c.env.DB);
  const detail = await getSubmissionDetail(db, c.req.param("id"));
  if (!detail) return c.json({ error: "Submission not found" }, 404);

  const isTeacher = await isClassroomTeacher(db, detail.classroomId, userId);
  if (!isTeacher) return c.json({ error: "Forbidden" }, 403);
  return c.json(detail);
});

export { attemptRoutes };
