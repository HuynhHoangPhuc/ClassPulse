import type {
  AssessmentType,
  AttemptStatus,
  ParentDetailView,
  ShowResults,
} from "../constants/assessment-types.js";

export interface Assessment {
  id: string;
  teacherId: string;
  title: string;
  description: string | null;
  type: AssessmentType;
  timeLimitMinutes: number | null;
  scorePerCorrect: number;
  penaltyPerIncorrect: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResults: ShowResults;
  parentDetailView: ParentDetailView;
  generationConfig: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AssessmentQuestion {
  assessmentId: string;
  questionId: string;
  orderIndex: number;
  customScore: number | null;
  customPenalty: number | null;
}

export interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  studentId: string;
  classroomId: string;
  startedAt: number;
  submittedAt: number | null;
  isAutoSubmitted: boolean;
  score: number | null;
  totalPossible: number | null;
  status: AttemptStatus;
}

export interface AttemptAnswer {
  attemptId: string;
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  answeredAt: number;
}
