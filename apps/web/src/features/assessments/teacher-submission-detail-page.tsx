import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/fetch-api";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { AssessmentQuestionView } from "./assessment-question-view";
import { ArrowLeft, CheckCircle, XCircle, MinusCircle, AlertTriangle } from "lucide-react";
import { useState } from "react";

interface DetailQuestion {
  questionId: string;
  content: string;
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean;
  explanation: string | null;
}

interface SubmissionDetail {
  attemptId: string;
  classroomId: string;
  student: { name: string; email: string; avatarUrl: string | null };
  startedAt: number;
  submittedAt: number | null;
  isAutoSubmitted: boolean;
  score: number | null;
  totalPossible: number | null;
  status: string;
  tabSwitchCount: number;
  questions: DetailQuestion[];
}

interface TeacherSubmissionDetailPageProps {
  attemptId: string;
  classroomId: string;
  assessmentId: string;
}

export function TeacherSubmissionDetailPage({ attemptId, classroomId, assessmentId }: TeacherSubmissionDetailPageProps) {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [currentIdx, setCurrentIdx] = useState(0);

  const { data, isLoading } = useQuery<SubmissionDetail>({
    queryKey: ["attempts", attemptId, "detail"],
    queryFn: async () => {
      const t = await getToken();
      return fetchApi(`/api/attempts/${attemptId}/detail`, {}, t) as Promise<SubmissionDetail>;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Submission Detail" />
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
  const timeTaken = data.submittedAt
    ? `${Math.floor((data.submittedAt - data.startedAt) / 60000)}m ${Math.floor(((data.submittedAt - data.startedAt) % 60000) / 1000)}s`
    : "—";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Submission Detail"
        actions={
          <button
            type="button"
            onClick={() => navigate({
              to: "/classrooms/$classroomId/assessments/$assessmentId/submissions",
              params: { classroomId, assessmentId },
            })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm transition-colors hover:bg-[var(--color-muted)]"
            style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
          >
            <ArrowLeft size={14} /> Back
          </button>
        }
      />

      {/* Student info + score */}
      <div
        className="rounded-[var(--radius-card)] border p-6 space-y-4"
        style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center gap-3">
          {data.student.avatarUrl ? (
            <img src={data.student.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: "var(--color-primary)", color: "#fff" }}
            >
              {data.student.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-medium" style={{ color: "var(--color-foreground)" }}>{data.student.name}</p>
            <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>{data.student.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl p-3" style={{ background: "var(--color-muted)" }}>
            <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Score</p>
            <p className="text-lg font-bold" style={{ color: "var(--color-primary)" }}>
              {data.score ?? 0}/{data.totalPossible ?? 0} <span className="text-xs font-normal">({percentage}%)</span>
            </p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "var(--color-muted)" }}>
            <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Time</p>
            <p className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>{timeTaken}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "var(--color-muted)" }}>
            <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Status</p>
            <Badge variant={data.isAutoSubmitted ? "warning" : "success"} className="mt-1">
              {data.isAutoSubmitted ? "Auto-submitted" : "Submitted"}
            </Badge>
          </div>
          <div className="rounded-xl p-3" style={{ background: "var(--color-muted)" }}>
            <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Tab Switches</p>
            <p className="text-lg font-bold flex items-center gap-1" style={{ color: data.tabSwitchCount > 0 ? "var(--color-warning)" : "var(--color-foreground)" }}>
              {data.tabSwitchCount > 0 && <AlertTriangle size={14} />}
              {data.tabSwitchCount}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
          <span className="flex items-center gap-1" style={{ color: "var(--color-success)" }}>
            <CheckCircle size={12} /> {correct} correct
          </span>
          <span className="flex items-center gap-1" style={{ color: "var(--color-destructive)" }}>
            <XCircle size={12} /> {incorrect} incorrect
          </span>
          {unanswered > 0 && (
            <span className="flex items-center gap-1">
              <MinusCircle size={12} /> {unanswered} skipped
            </span>
          )}
        </div>
      </div>

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

      {/* Question detail */}
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
      <div className="flex items-center justify-between pb-8">
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
    </div>
  );
}
