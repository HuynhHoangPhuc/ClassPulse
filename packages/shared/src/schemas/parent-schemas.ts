import { z } from "zod"

/* ── Parent dashboard query schemas ── */

export const parentStudentOverviewSchema = z.object({
  studentId: z.string(),
})

export const parentScoreTrendSchema = z.object({
  studentId: z.string(),
  days: z.coerce.number().int().min(7).max(90).default(30),
})

export const parentActivitySchema = z.object({
  studentId: z.string(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const parentHistorySchema = z.object({
  studentId: z.string(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
