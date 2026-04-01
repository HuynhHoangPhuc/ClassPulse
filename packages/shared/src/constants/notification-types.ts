export const NOTIFICATION_TYPES = [
  "mention",
  "comment_reply",
  "assessment_assigned",
  "assessment_submitted",
  "announcement",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const REFERENCE_TYPES = ["post", "comment", "assessment"] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];
