import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";
import type { InferSelectModel } from "drizzle-orm";

// ── Users ──────────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // Clerk user ID
  email: text("email").notNull(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull(), // teacher | student | parent
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ── Parent ↔ Student relationship ─────────────────────────────────────────────
export const parentStudent = sqliteTable(
  "parent_student",
  {
    id: text("id").primaryKey(),
    parentId: text("parent_id").notNull().references(() => users.id),
    studentId: text("student_id").notNull().references(() => users.id),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    parentStudentIdx: index("parent_student_parent_student_idx").on(t.parentId, t.studentId),
  }),
);

// ── Tags (teacher-created labels for questions) ────────────────────────────────
export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  color: text("color"),
  createdAt: integer("created_at").notNull(),
});

// ── Questions ─────────────────────────────────────────────────────────────────
export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  // JSON string: { id, text, isCorrect }[]
  options: text("options").notNull(),
  complexity: integer("complexity").notNull(), // 1–5
  complexityType: text("complexity_type").notNull(),
  explanation: text("explanation"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ── Question ↔ Tag (many-to-many) ─────────────────────────────────────────────
export const questionTags = sqliteTable(
  "question_tags",
  {
    questionId: text("question_id").notNull().references(() => questions.id),
    tagId: text("tag_id").notNull().references(() => tags.id),
  },
  (t) => ({ pk: primaryKey({ columns: [t.questionId, t.tagId] }) }),
);

// ── Assessments ───────────────────────────────────────────────────────────────
export const assessments = sqliteTable("assessments", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  timeLimitMinutes: integer("time_limit_minutes"),
  scorePerCorrect: real("score_per_correct").notNull().default(1),
  penaltyPerIncorrect: real("penalty_per_incorrect").notNull().default(0),
  shuffleQuestions: integer("shuffle_questions").notNull().default(0),
  shuffleOptions: integer("shuffle_options").notNull().default(0),
  showResults: text("show_results").notNull().default("immediately"),
  parentDetailView: text("parent_detail_view").notNull().default("scores_only"),
  // JSON string for AI generation config
  generationConfig: text("generation_config"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ── Assessment ↔ Question (ordered, with optional score overrides) ─────────────
export const assessmentQuestions = sqliteTable(
  "assessment_questions",
  {
    assessmentId: text("assessment_id").notNull().references(() => assessments.id),
    questionId: text("question_id").notNull().references(() => questions.id),
    orderIndex: integer("order_index").notNull(),
    customScore: real("custom_score"),
    customPenalty: real("custom_penalty"),
  },
  (t) => ({ pk: primaryKey({ columns: [t.assessmentId, t.questionId] }) }),
);

// ── Classrooms ────────────────────────────────────────────────────────────────
export const classrooms = sqliteTable("classrooms", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ── Classroom Members ─────────────────────────────────────────────────────────
export const classroomMembers = sqliteTable(
  "classroom_members",
  {
    classroomId: text("classroom_id").notNull().references(() => classrooms.id),
    userId: text("user_id").notNull().references(() => users.id),
    role: text("role").notNull(),
    joinedAt: integer("joined_at").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.classroomId, t.userId] }) }),
);

// ── Posts (classroom feed items) ──────────────────────────────────────────────
export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    classroomId: text("classroom_id").notNull().references(() => classrooms.id),
    authorId: text("author_id").notNull().references(() => users.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    assessmentId: text("assessment_id").references(() => assessments.id),
    dueDate: integer("due_date"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    classroomIdx: index("posts_classroom_id_idx").on(t.classroomId),
  }),
);

// ── Comments ──────────────────────────────────────────────────────────────────
export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull().references(() => posts.id),
    authorId: text("author_id").notNull().references(() => users.id),
    parentCommentId: text("parent_comment_id"),
    content: text("content").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    postIdx: index("comments_post_id_idx").on(t.postId),
  }),
);

// ── Comment Mentions ──────────────────────────────────────────────────────────
export const commentMentions = sqliteTable(
  "comment_mentions",
  {
    commentId: text("comment_id").notNull().references(() => comments.id),
    userId: text("user_id").notNull().references(() => users.id),
  },
  (t) => ({ pk: primaryKey({ columns: [t.commentId, t.userId] }) }),
);

// ── Assessment Attempts ───────────────────────────────────────────────────────
export const assessmentAttempts = sqliteTable(
  "assessment_attempts",
  {
    id: text("id").primaryKey(),
    assessmentId: text("assessment_id").notNull().references(() => assessments.id),
    studentId: text("student_id").notNull().references(() => users.id),
    classroomId: text("classroom_id").notNull().references(() => classrooms.id),
    startedAt: integer("started_at").notNull(),
    submittedAt: integer("submitted_at"),
    isAutoSubmitted: integer("is_auto_submitted").notNull().default(0),
    score: real("score"),
    totalPossible: real("total_possible"),
    status: text("status").notNull().default("in_progress"),
    tabSwitchCount: integer("tab_switch_count").notNull().default(0),
    questionOrder: text("question_order"), // JSON string of ordered question IDs (for shuffle)
  },
  (t) => ({
    studentIdx: index("attempts_student_id_idx").on(t.studentId),
    assessmentIdx: index("attempts_assessment_id_idx").on(t.assessmentId),
    classroomAssessmentIdx: index("attempts_classroom_assessment_idx").on(t.classroomId, t.assessmentId),
  }),
);

// ── Attempt Answers ───────────────────────────────────────────────────────────
export const attemptAnswers = sqliteTable(
  "attempt_answers",
  {
    attemptId: text("attempt_id").notNull().references(() => assessmentAttempts.id),
    questionId: text("question_id").notNull().references(() => questions.id),
    selectedOptionId: text("selected_option_id").notNull(),
    isCorrect: integer("is_correct").notNull(),
    answeredAt: integer("answered_at").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.attemptId, t.questionId] }) }),
);

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    type: text("type").notNull(),
    referenceType: text("reference_type").notNull(),
    referenceId: text("reference_id").notNull(),
    message: text("message").notNull(),
    isRead: integer("is_read").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    userIdx: index("notifications_user_id_idx").on(t.userId),
  }),
);

// ── Inferred select types ──────────────────────────────────────────────────────
export type User = InferSelectModel<typeof users>;
export type ParentStudent = InferSelectModel<typeof parentStudent>;
export type Tag = InferSelectModel<typeof tags>;
export type Question = InferSelectModel<typeof questions>;
export type QuestionTag = InferSelectModel<typeof questionTags>;
export type Assessment = InferSelectModel<typeof assessments>;
export type AssessmentQuestion = InferSelectModel<typeof assessmentQuestions>;
export type Classroom = InferSelectModel<typeof classrooms>;
export type ClassroomMember = InferSelectModel<typeof classroomMembers>;
export type Post = InferSelectModel<typeof posts>;
export type Comment = InferSelectModel<typeof comments>;
export type CommentMention = InferSelectModel<typeof commentMentions>;
export type AssessmentAttempt = InferSelectModel<typeof assessmentAttempts>;
export type AttemptAnswer = InferSelectModel<typeof attemptAnswers>;
export type Notification = InferSelectModel<typeof notifications>;
