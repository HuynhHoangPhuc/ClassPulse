import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/fetch-api";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { AssessmentQuestionView } from "./assessment-question-view";
import { ArrowLeft, CheckCircle, XCircle, MinusCircle } from "lucide-react";
import { useState } from "react";

interface ResultQuestion {
  questionId: string;
  content: string;
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean;
  explanation: string | null;
}

interface ResultsData {
  attemptId: string;
  score: number | null;
  totalPossible: number | null;
  showDetails: boolean;
  questions: ResultQuestion[];
}

interface AssessmentResultsPageProps {
  attemptId: string;
  classroomId: string;
  assessmentId: string;
}

export function AssessmentResultsPage({ attemptId, classroomId, assessmentId }: AssessmentResultsPageProps) {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [currentIdx, setCurrentIdx] = useState(0);

  const { data, isLoading } = useQuery<ResultsData>({
    queryKey: ["attempts", attemptId, "results"],
    queryFn: async () => {
      const t = await getToken();
      return fetchApi(`/api/attempts/${attemptId}/results`, {}, t) as Promise<ResultsData>;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4 p-4">
        <PageHeader title="Results" />
        <div className="animate-pulse space-y-3">
          <div className="h-4 rounded w-1/3" style={{ background: "var(--color-muted)" }} />
          <div className="h-32 rounded" style={{ background: "var(--color-muted)" }} />
        </div>
      </div>
    );
  }

  const percentage = data.totalPossible && data.totalPossible > 0
    ? Math.round(((data.score ?? 0) / data.totalPossible) * 100)
    : 0;

  const correct = data.questions.filter((q) => q.isCorrect).length;
  const incorrect = data.questions.filter((q) => q.selectedOptionId && !q.isCorrect).length;
  const unanswered = data.questions.filter((q) => !q.selectedOptionId).length;

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4">
      <PageHeader
        title="Assessment Results"
        actions={
          <button
            type="button"
            onClick={() => navigate({ to: "/classrooms/$classroomId", params: { classroomId } })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm transition-colors hover:bg-[var(--color-muted)]"
            style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
          >
            <ArrowLeft size={14} /> Back
          </button>
        }
      />

      {/* Score summary */}
      <div
        className="rounded-[var(--radius-card)] border p-6 text-center space-y-3"
        style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
      >
        <p className="text-3xl font-bold" style={{ color: "var(--color-primary)" }}>
          {data.score ?? 0} / {data.totalPossible ?? 0}
        </p>
        <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
          {percentage}% correct
        </p>
        {data.showDetails && (
          <div className="flex items-center justify-center gap-4 pt-2">
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-success)" }}>
              <CheckCircle size={14} /> {correct} correct
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-destructive)" }}>
              <XCircle size={14} /> {incorrect} incorrect
            </span>
            {unanswered > 0 && (
              <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                <MinusCircle size={14} /> {unanswered} skipped
              </span>
            )}
          </div>
        )}
      </div>

      {/* Per-question breakdown */}
      {data.showDetails && data.questions.length > 0 && (
        <>
          {/* Question navigation */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {data.questions.map((q, i) => (
              <button
                key={q.questionId}
                type="button"
                onClick={() => setCurrentIdx(i)}
                className="w-8 h-8 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: i === currentIdx
                    ? "var(--color-primary)"
                    : q.isCorrect
                      ? "color-mix(in srgb, var(--color-success) 20%, transparent)"
                      : q.selectedOptionId
                        ? "color-mix(in srgb, var(--color-destructive) 20%, transparent)"
                        : "var(--color-muted)",
                  color: i === currentIdx ? "#fff" : "var(--color-foreground)",
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {/* Current question detail */}
          {data.questions[currentIdx] && (() => {
            const q = data.questions[currentIdx];
            return (
              <div className="space-y-3">
                <AssessmentQuestionView
                  questionIndex={currentIdx}
                  totalQuestions={data.questions.length}
                  content={q.content}
                  complexity={0}
                  options={q.options}
                  selectedOptionId={q.selectedOptionId}
                  isFlagged={false}
                  onSelectOption={() => {}}
                  onToggleFlag={() => {}}
                  correctOptionId={q.correctOptionId}
                  showResult
                />
                {q.explanation && (
                  <div
                    className="rounded-xl border p-4 text-sm"
                    style={{ background: "var(--color-muted)", borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                  >
                    <span className="font-medium">Explanation: </span>
                    {q.explanation}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Nav buttons */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="px-4 py-2 rounded-xl border text-sm transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
              style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.min(data.questions.length - 1, i + 1))}
              disabled={currentIdx === data.questions.length - 1}
              className="px-4 py-2 rounded-xl border text-sm transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
              style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
            >
              Next
            </button>
          </div>
        </>
      )}

      {!data.showDetails && (
        <p className="text-sm text-center" style={{ color: "var(--color-muted-foreground)" }}>
          Detailed results are not available for this assessment.
        </p>
      )}
    </div>
  );
}
