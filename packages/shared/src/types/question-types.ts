import type { ComplexityLevel, ComplexityType } from "../constants/complexity.js";

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  teacherId: string;
  content: string;
  options: QuestionOption[];
  complexity: ComplexityLevel;
  complexityType: ComplexityType;
  explanation: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  teacherId: string;
  color: string | null;
  createdAt: number;
}

export interface QuestionTag {
  questionId: string;
  tagId: string;
}
