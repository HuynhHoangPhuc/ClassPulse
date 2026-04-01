export const COMPLEXITY_TYPES = [
  "knowledge",
  "comprehension",
  "application",
  "analysis",
  "synthesis",
  "evaluation",
] as const;
export type ComplexityType = (typeof COMPLEXITY_TYPES)[number];

export const COMPLEXITY_LEVELS = [1, 2, 3, 4, 5] as const;
export type ComplexityLevel = (typeof COMPLEXITY_LEVELS)[number];

export const COMPLEXITY_LABELS: Record<ComplexityLevel, string> = {
  1: "Easy",
  2: "Medium-Easy",
  3: "Medium",
  4: "Medium-Hard",
  5: "Hard",
};

export const COMPLEXITY_COLORS: Record<ComplexityLevel, string> = {
  1: "#10B981",
  2: "#14B8A6",
  3: "#F59E0B",
  4: "#F97316",
  5: "#F43F5E",
};
