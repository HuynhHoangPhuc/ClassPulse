export const ASSESSMENT_TYPES = ["test", "quiz", "practice"] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export const SHOW_RESULTS_OPTIONS = [
  "immediately",
  "after_due",
  "never",
] as const;
export type ShowResults = (typeof SHOW_RESULTS_OPTIONS)[number];

export const PARENT_DETAIL_VIEW_OPTIONS = [
  "scores_only",
  "full_detail",
] as const;
export type ParentDetailView = (typeof PARENT_DETAIL_VIEW_OPTIONS)[number];

export const ATTEMPT_STATUSES = [
  "in_progress",
  "submitted",
  "graded",
] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];
