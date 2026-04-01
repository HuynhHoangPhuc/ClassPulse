import { z } from "zod";
import { USER_ROLES } from "../constants/roles.js";
import { COMPLEXITY_TYPES, COMPLEXITY_LEVELS } from "../constants/complexity.js";
import {
  ASSESSMENT_TYPES,
  SHOW_RESULTS_OPTIONS,
  PARENT_DETAIL_VIEW_OPTIONS,
} from "../constants/assessment-types.js";
import { POST_TYPES } from "../constants/post-types.js";
import { NOTIFICATION_TYPES, REFERENCE_TYPES } from "../constants/notification-types.js";

/* ── Reusable primitives ── */

export const userRoleSchema = z.enum(USER_ROLES);
export const complexityTypeSchema = z.enum(COMPLEXITY_TYPES);
export const complexityLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export const assessmentTypeSchema = z.enum(ASSESSMENT_TYPES);
export const showResultsSchema = z.enum(SHOW_RESULTS_OPTIONS);
export const parentDetailViewSchema = z.enum(PARENT_DETAIL_VIEW_OPTIONS);
export const postTypeSchema = z.enum(POST_TYPES);
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export const referenceTypeSchema = z.enum(REFERENCE_TYPES);

/* ── Question option ── */

export const questionOptionSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

/* ── Request schemas (for API validation) ── */

export const createQuestionSchema = z.object({
  content: z.string().min(1),
  options: z.array(questionOptionSchema).min(2).max(6),
  complexity: complexityLevelSchema,
  complexityType: complexityTypeSchema,
  explanation: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
});

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "Must be a valid hex color");

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: hexColorSchema.nullable().optional(),
});

export const createAssessmentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  type: assessmentTypeSchema,
  timeLimitMinutes: z.number().int().positive().nullable().optional(),
  scorePerCorrect: z.number().default(1),
  penaltyPerIncorrect: z.number().default(0),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  showResults: showResultsSchema.default("immediately"),
  parentDetailView: parentDetailViewSchema.default("scores_only"),
  questionIds: z.array(z.string()).min(1),
});

export const createClassroomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
});

export const createPostSchema = z.object({
  classroomId: z.string(),
  type: postTypeSchema,
  title: z.string().min(1).max(200),
  content: z.string().nullable().optional(),
  assessmentId: z.string().nullable().optional(),
  dueDate: z.number().nullable().optional(),
});

export const createCommentSchema = z.object({
  postId: z.string(),
  parentCommentId: z.string().nullable().optional(),
  content: z.string().min(1),
  mentionUserIds: z.array(z.string()).optional(),
});

export const submitAnswerSchema = z.object({
  questionId: z.string(),
  selectedOptionId: z.string(),
});

/* ── Update schemas (partial versions of create schemas) ── */

export const updateQuestionSchema = z.object({
  content: z.string().min(1).optional(),
  options: z.array(questionOptionSchema).min(2).max(6).optional(),
  complexity: complexityLevelSchema.optional(),
  complexityType: complexityTypeSchema.optional(),
  explanation: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: hexColorSchema.nullable().optional(),
});

/* ── Bulk operations ── */

export const bulkQuestionSchema = z.object({
  action: z.enum(["delete", "retag"]),
  questionIds: z.array(z.string()).min(1),
  tagIds: z.array(z.string()).optional(),
});

/* ── Question list filters (query params) ── */

export const questionFilterSchema = z.object({
  tagIds: z.string().optional(), // comma-separated tag IDs
  complexityMin: z.coerce.number().int().min(1).max(5).optional(),
  complexityMax: z.coerce.number().int().min(1).max(5).optional(),
  complexityType: complexityTypeSchema.optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
