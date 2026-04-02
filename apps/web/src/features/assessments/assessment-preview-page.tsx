import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/fetch-api";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Clock, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreviewQuestion {
  questionId: string;
  orderIndex: number;
  content: string;
  options: Array<{ id: string; text: string }>;
  complexity: number;
  complexityType: string;
}

interface PreviewData {
  id: string;
  title: string;
  description: string | null;
  type: string;
  timeLimitMinutes: number | null;
  scorePerCorrect: number;
  penaltyPerIncorrect: number;
  questionCount: number;
  questions: PreviewQuestion[];
}

interface AssessmentPreviewPageProps {
  assessmentId: string;
}

export function AssessmentPreviewPage({ assessmentId }: AssessmentPreviewPageProps) {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [currentIdx, setCurrentIdx] = useState(0);

  const { data, isLoading } = useQuery<PreviewData>({
    queryKey: ["assessments", assessmentId, "preview"],
    queryFn: async () => {
      const t = await getToken();
      return fetchApi(`/api/assessments/${assessmentId}/preview`, {}, t) as Promise<PreviewData>;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Assessment Preview" />
        <div className="animate-pulse space-y-3">
          <div className="h-4 rounded w-1/3" style={{ background: "var(--color-muted)" }} />
          <div className="h-32 rounded" style={{ background: "var(--color-muted)" }} />
        </div>
      </div>
    );
  }

  const question = data.questions[currentIdx];

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.title}
        description="Student-view preview (read-only)"
        actions={
          <button
            type="button"
            onClick={() => navigate({ to: "/assessments" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm transition-colors hover:bg-[var(--color-muted)]"
            style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
          >
            <ArrowLeft size={14} /> Back
          </button>
        }
      />

      {/* Assessment info bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge>{data.type}</Badge>
        <span className="flex items-center gap-1 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
          <FileText size={14} /> {data.questionCount} questions
        </span>
        {data.timeLimitMinutes && (
          <span className="flex items-center gap-1 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
            <Clock size={14} /> {data.timeLimitMinutes} min
          </span>
        )}
        <span className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
          {data.scorePerCorrect}pt / correct
          {data.penaltyPerIncorrect > 0 && ` · -${data.penaltyPerIncorrect}pt / incorrect`}
        </span>
      </div>

      {/* Question navigation dots */}
      <div className="flex items-center gap-1 flex-wrap">
        {data.questions.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrentIdx(i)}
            className={cn(
              "w-8 h-8 rounded-lg text-xs font-medium transition-colors",
              i === currentIdx ? "font-bold" : "hover:bg-[var(--color-muted)]"
            )}
            style={{
              background: i === currentIdx ? "var(--color-primary)" : "transparent",
              color: i === currentIdx ? "#fff" : "var(--color-muted-foreground)",
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question content */}
      {question && (
        <div
          className="rounded-[var(--radius-card)] border p-6 space-y-4"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: "var(--color-muted-foreground)" }}>
              Question {currentIdx + 1} of {data.questionCount}
            </span>
            <Badge variant="secondary">L{question.complexity}</Badge>
          </div>

          <p className="text-sm leading-relaxed" style={{ color: "var(--color-foreground)" }}>
            {question.content}
          </p>

          {/* Options (non-selectable preview) */}
          <div className="space-y-2">
            {question.options.map((opt, i) => (
              <div
                key={opt.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm"
                style={{ borderColor: "var(--color-border)", background: "var(--color-muted)" }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "var(--color-card)", color: "var(--color-muted-foreground)", border: "1px solid var(--color-border)" }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span style={{ color: "var(--color-foreground)" }}>{opt.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prev / Next */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
          style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
        >
          <ArrowLeft size={14} /> Previous
        </button>
        <button
          type="button"
          onClick={() => setCurrentIdx((i) => Math.min(data.questions.length - 1, i + 1))}
          disabled={currentIdx === data.questions.length - 1}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
          style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
        >
          Next <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
