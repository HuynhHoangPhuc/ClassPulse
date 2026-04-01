export const POST_TYPES = ["announcement", "assessment_assignment"] as const;
export type PostType = (typeof POST_TYPES)[number];
