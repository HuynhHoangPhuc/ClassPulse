export const USER_ROLES = ["teacher", "student", "parent"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
};
